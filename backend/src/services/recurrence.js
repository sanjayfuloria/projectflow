// src/services/recurrence.js
// Checks for tasks with recurrence set and creates copies when due
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function getNextDueDate(recurrence, fromDate) {
  const d = new Date(fromDate);
  switch (recurrence) {
    case 'daily':   d.setDate(d.getDate() + 1);   break;
    case 'weekly':  d.setDate(d.getDate() + 7);   break;
    case 'monthly': d.setMonth(d.getMonth() + 1); break;
    default: return null;
  }
  return d;
}

async function processRecurringTasks(io) {
  try {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    // Find tasks with recurrence that are due today or overdue
    const tasks = await prisma.task.findMany({
      where: {
        recurrence: { not: null, notIn: ['none'] },
        dueDate:    { lte: now },
        recurrenceEnd: { OR: [{ gt: now }, { equals: null }] },
      },
    });

    let created = 0;
    for (const task of tasks) {
      const nextDue = getNextDueDate(task.recurrence, task.dueDate);
      if (!nextDue) continue;
      if (task.recurrenceEnd && nextDue > task.recurrenceEnd) continue;

      // Check if we already created a copy for this next due date (avoid duplicates)
      const existing = await prisma.task.findFirst({
        where: { parentTaskId: task.id, dueDate: nextDue },
      });
      if (existing) continue;

      // Generate new task key
      const count = await prisma.task.count();
      const taskKey = `T-${String(count + 1).padStart(3, '0')}`;

      const newTask = await prisma.task.create({
        data: {
          taskKey,
          title:        task.title,
          description:  task.description,
          status:       task.columnId,
          columnId:     task.columnId,
          priority:     task.priority,
          tag:          task.tag,
          assigneeId:   task.assigneeId,
          creatorId:    task.creatorId,
          dueDate:      nextDue,
          recurrence:   task.recurrence,
          recurrenceEnd: task.recurrenceEnd,
          parentTaskId: task.id,
          progress:     0,
        },
        include: {
          assignee: { select: { id: true, name: true, initials: true, avatarColor: true } },
          column:   { select: { id: true, label: true, color: true } },
          _count:   { select: { comments: true, subtasks: true } },
        },
      });

      // Emit real-time event
      if (io) io.to('board').emit('task:created', { task: newTask });

      // Notify assignee
      if (task.assigneeId) {
        await prisma.notification.create({
          data: {
            type:    'TASK_ASSIGNED',
            userId:  task.assigneeId,
            taskId:  newTask.id,
            title:   'Recurring task created',
            message: `Recurring task "${task.title}" is due on ${nextDue.toLocaleDateString('en-IN')}`,
          },
        });
        if (io) io.to(`user:${task.assigneeId}`).emit('notification:new', {
          message: `Recurring: "${task.title}" due ${nextDue.toLocaleDateString('en-IN')}`,
        });
      }

      created++;
    }

    if (created > 0) console.log(`🔁 Created ${created} recurring task(s)`);
  } catch (err) {
    console.error('Recurrence error:', err.message);
  }
}

let recurrenceInterval = null;
function startRecurrenceChecker(io) {
  if (recurrenceInterval) return;
  // Run every hour
  recurrenceInterval = setInterval(() => processRecurringTasks(io), 60 * 60 * 1000);
  // Also run once at startup after 10 seconds
  setTimeout(() => processRecurringTasks(io), 10000);
  console.log('🔁 Recurrence checker started (runs every hour)');
}

module.exports = { startRecurrenceChecker, processRecurringTasks };
