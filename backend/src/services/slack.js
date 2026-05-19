// src/services/slack.js
// Slack Incoming Webhooks — free, no app store approval needed
// Setup: https://api.slack.com/messaging/webhooks
// 1. Go to https://api.slack.com/apps → Create New App → From Scratch
// 2. Add "Incoming Webhooks" feature → Activate
// 3. Add to workspace → copy Webhook URL
// 4. Add SLACK_WEBHOOK_URL to your .env

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getSlackConfig() {
  try {
    return await prisma.slackConfig.findFirst({ where: { enabled: true } });
  } catch {
    return null;
  }
}

function colourForPriority(priority) {
  const map = { CRITICAL: '#ff6584', HIGH: '#ffc94d', MEDIUM: '#6c63ff', LOW: '#43d9ad' };
  return map[priority] || '#8b90a7';
}

async function postSlack(payload) {
  const config = await getSlackConfig();
  const webhookUrl = config?.webhookUrl || process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) console.error('Slack webhook failed:', res.status);
  } catch (err) {
    console.error('Slack error:', err.message);
  }
}

const APP_URL = process.env.FRONTEND_URL || 'https://projectflow.sanjayfuloria.tech';

// ── Event senders ─────────────────────────────────────────────────────────────

async function notifyTaskCreated({ task, creatorName }) {
  await postSlack({
    attachments: [{
      color: colourForPriority(task.priority),
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: `✨ *New task created* by ${creatorName}` } },
        { type: 'section', fields: [
          { type: 'mrkdwn', text: `*Task*\n<${APP_URL}|${task.taskKey}: ${task.title}>` },
          { type: 'mrkdwn', text: `*Priority*\n${task.priority}` },
          { type: 'mrkdwn', text: `*Column*\n${task.column?.label || '—'}` },
          { type: 'mrkdwn', text: `*Assignee*\n${task.assignee?.name || 'Unassigned'}` },
        ]},
      ],
    }],
  });
}

async function notifyTaskMoved({ task, fromColumn, toColumn, movedByName }) {
  await postSlack({
    attachments: [{
      color: '#6c63ff',
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: `🔀 *Task moved* by ${movedByName}` } },
        { type: 'section', fields: [
          { type: 'mrkdwn', text: `*Task*\n${task.taskKey}: ${task.title}` },
          { type: 'mrkdwn', text: `*Moved*\n${fromColumn} → ${toColumn}` },
        ]},
      ],
    }],
  });
}

async function notifyCommentAdded({ task, commenterName, commentText }) {
  await postSlack({
    attachments: [{
      color: '#43d9ad',
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: `💬 *New comment* on ${task.taskKey} by ${commenterName}` } },
        { type: 'section', text: { type: 'mrkdwn', text: `*${task.title}*\n${commentText.slice(0, 200)}${commentText.length > 200 ? '…' : ''}` } },
      ],
    }],
  });
}

async function notifySprintStarted({ sprint, startedByName }) {
  await postSlack({
    attachments: [{
      color: '#43d9ad',
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: `🏃 *Sprint started* by ${startedByName}` } },
        { type: 'section', fields: [
          { type: 'mrkdwn', text: `*Sprint*\n${sprint.name}` },
          { type: 'mrkdwn', text: `*Tasks*\n${sprint._count?.tasks || 0}` },
          { type: 'mrkdwn', text: `*Goal*\n${sprint.goal || '—'}` },
          { type: 'mrkdwn', text: `*End Date*\n${sprint.endDate ? new Date(sprint.endDate).toLocaleDateString('en-IN') : '—'}` },
        ]},
      ],
    }],
  });
}

async function notifySprintCompleted({ sprint, completedByName }) {
  await postSlack({
    attachments: [{
      color: '#6c63ff',
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: `✅ *Sprint completed* by ${completedByName}` } },
        { type: 'section', fields: [
          { type: 'mrkdwn', text: `*Sprint*\n${sprint.name}` },
          { type: 'mrkdwn', text: `*Tasks completed*\n${sprint._count?.tasks || 0}` },
        ]},
      ],
    }],
  });
}

async function notifyOverdueTasks({ tasks }) {
  if (!tasks.length) return;
  const list = tasks.slice(0, 10).map(t => `• ${t.taskKey}: ${t.title} (${t.assignee?.name || 'Unassigned'})`).join('\n');
  await postSlack({
    attachments: [{
      color: '#ff6584',
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: `⚠️ *${tasks.length} overdue task${tasks.length > 1 ? 's' : ''}*` } },
        { type: 'section', text: { type: 'mrkdwn', text: list } },
      ],
    }],
  });
}

module.exports = {
  notifyTaskCreated,
  notifyTaskMoved,
  notifyCommentAdded,
  notifySprintStarted,
  notifySprintCompleted,
  notifyOverdueTasks,
  postSlack,
};
