// src/services/automation.js
// Automation rule engine — runs after task events
// Triggers: task_created, status_changed, priority_changed, due_date_passed, assignee_changed
// Actions:  assign_to, set_priority, move_to_column, send_notification, post_slack, set_tag

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { createNotification } = require('../routes/notifications');
const { notifyTaskMoved, postSlack } = require('./slack');

/**
 * Run all enabled automation rules for a given trigger.
 * @param {object} params
 * @param {string} params.trigger    - e.g. 'status_changed'
 * @param {string} params.triggerValue - e.g. the new columnId
 * @param {object} params.task       - full task object
 * @param {object} params.req        - Express request (for socket io)
 * @param {object} params.actor      - user who triggered the event
 */
async function runAutomations({ trigger, triggerValue, task, req, actor }) {
  try {
    const rules = await prisma.automationRule.findMany({
      where: {
        enabled:      true,
        trigger,
        ...(triggerValue !== undefined ? {
          OR: [
            { triggerValue },
            { triggerValue: null },
          ],
        } : {}),
      },
    });

    for (const rule of rules) {
      await executeAction(rule, task, req, actor);
    }
  } catch (err) {
    console.error('Automation error:', err.message);
  }
}

async function executeAction(rule, task, req, actor) {
  const io = req?.app?.get('io');

  switch (rule.action) {
    case 'assign_to': {
      if (!rule.actionValue) break;
      await prisma.task.update({ where: { id: task.id }, data: { assigneeId: rule.actionValue } });
      await createNotification(prisma, {
        type: 'TASK_ASSIGNED', userId: rule.actionValue, taskId: task.id,
        title: 'Task auto-assigned',
        message: `Automation "${rule.name}" assigned "${task.title}" to you`,
      });
      if (io) io.to(`user:${rule.actionValue}`).emit('notification:new', { message: `Auto-assigned: "${task.title}"` });
      break;
    }

    case 'set_priority': {
      if (!rule.actionValue) break;
      await prisma.task.update({ where: { id: task.id }, data: { priority: rule.actionValue } });
      if (io) io.to('board').emit('task:updated', { task: { ...task, priority: rule.actionValue } });
      break;
    }

    case 'set_tag': {
      if (!rule.actionValue) break;
      await prisma.task.update({ where: { id: task.id }, data: { tag: rule.actionValue } });
      break;
    }

    case 'move_to_column': {
      if (!rule.actionValue) break;
      const col = await prisma.column.findUnique({ where: { id: rule.actionValue } });
      if (!col) break;
      await prisma.task.update({ where: { id: task.id }, data: { columnId: rule.actionValue, status: rule.actionValue } });
      if (io) io.to('board').emit('task:moved', { taskId: task.id, columnId: rule.actionValue });
      break;
    }

    case 'send_notification': {
      if (!task.assigneeId) break;
      await createNotification(prisma, {
        type: 'TASK_ASSIGNED', userId: task.assigneeId, taskId: task.id,
        title: `Automation: ${rule.name}`,
        message: rule.actionValue || `Rule "${rule.name}" was triggered on "${task.title}"`,
      });
      if (io) io.to(`user:${task.assigneeId}`).emit('notification:new', { message: `Automation: ${rule.name}` });
      break;
    }

    case 'post_slack': {
      await postSlack({
        text: `🤖 *Automation triggered:* ${rule.name}\n*Task:* ${task.taskKey}: ${task.title}\n${rule.actionValue || ''}`,
      });
      break;
    }

    default:
      console.warn('Unknown automation action:', rule.action);
  }
}

module.exports = { runAutomations };
