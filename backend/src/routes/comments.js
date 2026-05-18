// src/routes/comments.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdminOrMember } = require('../middleware/auth');
const { emitBoard } = require('../services/socket');
const { sendCommentNotification } = require('../services/email');
const { createNotification } = require('./notifications');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/comments?taskId=xxx
router.get('/', authenticate, async (req, res) => {
  const { taskId } = req.query;
  if (!taskId) return res.status(400).json({ error: 'taskId required' });
  try {
    const comments = await prisma.comment.findMany({
      where: { taskId },
      include: { author: { select: { id:true, name:true, initials:true, avatarColor:true } } },
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
      include: { assignee: { select: { id:true, name:true, email:true } } },
    });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const comment = await prisma.comment.create({
      data: { taskId, content: content.trim(), authorId: req.user.id },
      include: { author: { select: { id:true, name:true, initials:true, avatarColor:true } } },
    });

    // Real-time: broadcast new comment to the whole board room
    emitBoard(req, 'comment:created', { taskId, comment });

    // Notify task assignee (if not the commenter)
    if (task.assigneeId && task.assigneeId !== req.user.id) {
      await createNotification(prisma, {
        type: 'COMMENT_ADDED', userId: task.assigneeId, taskId,
        title: 'New comment on your task',
        message: `${req.user.name}: "${content.slice(0, 80)}${content.length > 80 ? '…' : ''}"`,
      });
      const io = req.app.get('io');
      if (io) io.to(`user:${task.assigneeId}`).emit('notification:new', {
        message: `${req.user.name} commented on "${task.title}"`,
      });
      if (task.assignee?.email) {
        sendCommentNotification({
          toEmail:       task.assignee.email,
          toName:        task.assignee.name,
          taskKey:       task.taskKey,
          taskTitle:     task.title,
          commenterName: req.user.name,
          commentText:   content,
        });
      }
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
