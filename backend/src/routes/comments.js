// src/routes/comments.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdminOrMember } = require('../middleware/auth');
const { emitBoard, emitUser } = require('../services/socket');
const { sendCommentNotification } = require('../services/email');
const { createNotification } = require('./notifications');
const { logActivity } = require('../services/activity');

const router = express.Router();
const prisma = new PrismaClient();

// Parse @mentions from comment text – returns array of matched initials/names
async function parseMentions(content) {
  const mentionRegex = /@(\w+)/g;
  const matches = [...content.matchAll(mentionRegex)].map(m => m[1].toLowerCase());
  if (!matches.length) return [];

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { initials: { in: matches.map(m => m.toUpperCase()) } },
        { name: { contains: matches.join('|'), mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, initials: true, email: true },
  });

  // Also search by first name or last name
  const allUsers = await prisma.user.findMany({ select: { id: true, name: true, initials: true, email: true } });
  const matchedUsers = allUsers.filter(u => {
    const nameParts = u.name.toLowerCase().split(' ');
    return matches.some(m => nameParts.some(part => part.startsWith(m)) || u.initials.toLowerCase() === m);
  });

  // Deduplicate
  const seen = new Set();
  return [...users, ...matchedUsers].filter(u => {
    if (seen.has(u.id)) return false;
    seen.add(u.id);
    return true;
  });
}

// GET /api/comments?taskId=xxx
router.get('/', authenticate, async (req, res) => {
  const { taskId } = req.query;
  if (!taskId) return res.status(400).json({ error: 'taskId required' });
  try {
    const comments = await prisma.comment.findMany({
      where: { taskId },
      include: {
        author: { select: { id: true, name: true, initials: true, avatarColor: true } },
        mentions: { include: { user: { select: { id: true, name: true, initials: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ comments });
  } catch { res.status(500).json({ error: 'Failed to fetch comments' }); }
});

// POST /api/comments
router.post('/', authenticate, requireAdminOrMember, async (req, res) => {
  const { taskId, content } = req.body;
  if (!taskId || !content?.trim()) return res.status(400).json({ error: 'taskId and content required' });

  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { assignee: { select: { id: true, name: true, email: true } } },
    });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Parse @mentions from the comment
    const mentionedUsers = await parseMentions(content);

    const comment = await prisma.comment.create({
      data: {
        taskId,
        content: content.trim(),
        authorId: req.user.id,
        mentions: {
          create: mentionedUsers
            .filter(u => u.id !== req.user.id) // don't mention yourself
            .map(u => ({ userId: u.id })),
        },
      },
      include: {
        author: { select: { id: true, name: true, initials: true, avatarColor: true } },
        mentions: { include: { user: { select: { id: true, name: true, initials: true } } } },
      },
    });

    // Log activity
    await logActivity({ taskId, userId: req.user.id, action: 'COMMENT_ADDED' });

    // Real-time broadcast
    emitBoard(req, 'comment:created', { taskId, comment });

    // Notify task assignee (if not the commenter)
    if (task.assigneeId && task.assigneeId !== req.user.id) {
      await createNotification(prisma, {
        type: 'COMMENT_ADDED', userId: task.assigneeId, taskId,
        title: 'New comment on your task',
        message: `${req.user.name}: "${content.slice(0, 80)}${content.length > 80 ? '…' : ''}"`,
      });
      emitUser(req, task.assigneeId, 'notification:new', {
        message: `${req.user.name} commented on "${task.title}"`,
      });
      if (task.assignee?.email) {
        sendCommentNotification({
          toEmail: task.assignee.email, toName: task.assignee.name,
          taskKey: task.taskKey, taskTitle: task.title,
          commenterName: req.user.name, commentText: content,
        });
      }
    }

    // Notify each @mentioned user
    for (const mentioned of mentionedUsers) {
      if (mentioned.id === req.user.id || mentioned.id === task.assigneeId) continue;
      await createNotification(prisma, {
        type: 'MENTIONED', userId: mentioned.id, taskId,
        title: `${req.user.name} mentioned you`,
        message: `In "${task.title}": "${content.slice(0, 80)}${content.length > 80 ? '…' : ''}"`,
      });
      emitUser(req, mentioned.id, 'notification:new', {
        message: `${req.user.name} mentioned you in "${task.title}"`,
      });
    }

    res.status(201).json({ comment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// DELETE /api/comments/:id
router.delete('/:id', authenticate, requireAdminOrMember, async (req, res) => {
  try {
    const comment = await prisma.comment.findUnique({ where: { id: req.params.id } });
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    if (comment.authorId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Can only delete your own comments' });
    }
    await prisma.comment.delete({ where: { id: req.params.id } });
    emitBoard(req, 'comment:deleted', { taskId: comment.taskId, commentId: req.params.id });
    res.json({ message: 'Comment deleted' });
  } catch { res.status(500).json({ error: 'Failed to delete comment' }); }
});

module.exports = router;
