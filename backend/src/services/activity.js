// src/services/activity.js
// Central helper to log activity on tasks

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Log an activity entry for a task.
 * @param {object} params
 * @param {string} params.taskId
 * @param {string} params.userId
 * @param {string} params.action  - ActivityAction enum value
 * @param {string} [params.field] - which field changed
 * @param {string} [params.oldValue]
 * @param {string} [params.newValue]
 */
async function logActivity({ taskId, userId, action, field, oldValue, newValue }) {
  try {
    await prisma.activityLog.create({
      data: {
        taskId,
        userId,
        action,
        field:    field    || null,
        oldValue: oldValue ? String(oldValue) : null,
        newValue: newValue ? String(newValue) : null,
      },
    });
  } catch (err) {
    // Never crash the main request due to logging failure
    console.error('Activity log error:', err.message);
  }
}

// Human-readable descriptions for activity actions
function describeActivity(log) {
  const who = log.user?.name || 'Someone';
  switch (log.action) {
    case 'CREATED':           return `${who} created this task`;
    case 'STATUS_CHANGED':    return `${who} moved to ${log.newValue}`;
    case 'ASSIGNED':          return `${who} assigned to ${log.newValue || 'nobody'}`;
    case 'PRIORITY_CHANGED':  return `${who} changed priority to ${log.newValue}`;
    case 'DUE_DATE_CHANGED':  return `${who} set due date to ${log.newValue || 'none'}`;
    case 'COMMENT_ADDED':     return `${who} added a comment`;
    case 'ATTACHMENT_ADDED':  return `${who} attached ${log.newValue}`;
    case 'SUBTASK_ADDED':     return `${who} added subtask "${log.newValue}"`;
    case 'DEPENDENCY_ADDED':  return `${who} added dependency: ${log.newValue}`;
    case 'ADDED_TO_SPRINT':   return `${who} added to sprint "${log.newValue}"`;
    case 'REMOVED_FROM_SPRINT': return `${who} removed from sprint`;
    case 'PROGRESS_UPDATED':  return `${who} updated progress to ${log.newValue}%`;
    case 'UPDATED':           return `${who} updated ${log.field || 'task'}`;
    default:                  return `${who} performed ${log.action}`;
  }
}

module.exports = { logActivity, describeActivity };
