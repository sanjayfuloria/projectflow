// src/routes/notifications.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// ── Helper: create a notification (used by other routes) ─────────────────────
async function createNotification(prismaClient, { type, userId, taskId, title, message }) {
  try {
    return await prismaClient.notification.create({
      data: { type, userId, taskId: taskId || null, title, message },
    });
  } catch (err) {
    console.error('createNotification error:', err.message);
    return null;
  }
}

// GET /api/notifications  – get my notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const unreadCount = notifications.filter(n => !n.read).length;
    res.json({ notifications, unreadCount });
  } catch {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// PATCH /api/notifications/read-all  – mark all as read
router.patch('/read-all', authenticate, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, read: false },
      data:  { read: true },
    });
    res.json({ message: 'All marked as read' });
  } catch {
    res.status(500).json({ error: 'Failed to mark read' });
  }
});

// PATCH /api/notifications/:id/read  – mark one as read
router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    await prisma.notification.update({
      where: { id: req.params.id, userId: req.user.id },
      data:  { read: true },
    });
    res.json({ message: 'Marked as read' });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

// DELETE /api/notifications/clear  – delete all read notifications
router.delete('/clear', authenticate, async (req, res) => {
  try {
    await prisma.notification.deleteMany({ where: { userId: req.user.id, read: true } });
    res.json({ message: 'Cleared' });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Due-date checker – call this on a cron (or manually via POST /api/notifications/check-due) ──
// On Railway free tier, use a simple setInterval in index.js instead of a real cron service
router.post('/check-due', authenticate, async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' });
  try {
    const count = await runDueDateCheck(req.app.get('io'));
    res.json({ message: `Checked. Sent ${count} notifications.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function runDueDateCheck(io) {
  const { sendDueSoonReminder, sendOverdueAlert } = require('../services/email');

  const now      = new Date();
  const today    = new Date(now); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const dayAfter = new Date(today); dayAfter.setDate(today.getDate() + 2);

  // Tasks due tomorrow
  const dueTomorrow = await prisma.task.findMany({
    where: {
      dueDate:    { gte: tomorrow, lt: dayAfter },
      status:     { not: 'done' },
      assigneeId: { not: null },
    },
    include: { assignee: true },
  });

  // Overdue tasks
  const overdue = await prisma.task.findMany({
    where: {
      dueDate:    { lt: today },
      status:     { not: 'done' },
      assigneeId: { not: null },
    },
    include: { assignee: true },
  });

  let count = 0;
  for (const task of dueTomorrow) {
    if (!task.assignee) continue;
    const notif = await createNotification(prisma, {
      type: 'TASK_DUE_SOON', userId: task.assigneeId, taskId: task.id,
      title: 'Task due tomorrow',
      message: `"${task.title}" is due tomorrow`,
    });
    if (notif && io) io.to(`user:${task.assigneeId}`).emit('notification:new', { message: `"${task.title}" is due tomorrow` });
    sendDueSoonReminder({ toEmail: task.assignee.email, toName: task.assignee.name, taskKey: task.taskKey, taskTitle: task.title, dueDate: task.dueDate });
    count++;
  }

  for (const task of overdue) {
    if (!task.assignee) continue;
    const notif = await createNotification(prisma, {
      type: 'TASK_OVERDUE', userId: task.assigneeId, taskId: task.id,
      title: 'Task overdue',
      message: `"${task.title}" is overdue!`,
    });
    if (notif && io) io.to(`user:${task.assigneeId}`).emit('notification:new', { message: `"${task.title}" is overdue!` });
    sendOverdueAlert({ toEmail: task.assignee.email, toName: task.assignee.name, taskKey: task.taskKey, taskTitle: task.title, dueDate: task.dueDate });
    count++;
  }

  return count;
}

// Auto-run due date check every 6 hours when this module is first loaded
let dueDateInterval = null;
function startDueDateChecker(io) {
  if (dueDateInterval) return;
  dueDateInterval = setInterval(() => {
    runDueDateCheck(io).catch(console.error);
  }, 6 * 60 * 60 * 1000); // every 6 hours
  console.log('⏰ Due-date checker started (runs every 6h)');
}

module.exports = router;
module.exports.createNotification = createNotification;
module.exports.startDueDateChecker = startDueDateChecker;
