// src/routes/tasks.js
const express    = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdminOrMember } = require('../middleware/auth');
const { emitBoard, emitUser } = require('../services/socket');
const { sendTaskAssigned } = require('../services/email');
const { createNotification } = require('./notifications');
const { logActivity } = require('../services/activity');

const router = express.Router();
const prisma = new PrismaClient();

const taskInclude = {
  assignee: { select: { id:true, name:true, initials:true, avatarColor:true, email:true } },
  creator:  { select: { id:true, name:true, initials:true } },
  column:   { select: { id:true, label:true, color:true } },
  subtasks: { orderBy: { order: 'asc' } },
  attachments: { orderBy: { createdAt: 'desc' }, select: { id:true, filename:true, originalName:true, url:true, size:true, mimeType:true, createdAt:true } },
  _count:   { select: { comments:true, subtasks:true, attachments:true } },
};

// GET /api/tasks
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, priority, tag, assigneeId, search, columnId } = req.query;
    const where = {};
    if (status)     where.status   = status;
    if (priority)   where.priority = priority.toUpperCase();
    if (tag)        where.tag      = tag.toUpperCase();
    if (assigneeId) where.assigneeId = assigneeId;
    if (columnId)   where.columnId = columnId;
    if (search)     where.title    = { contains: search, mode: 'insensitive' };

    const tasks = await prisma.task.findMany({ where, include: taskInclude, orderBy: { createdAt: 'desc' } });
    res.json({ tasks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// POST /api/tasks
router.post('/', authenticate, requireAdminOrMember, [
  body('title').trim().notEmpty().isLength({ max: 200 }),
  body('columnId').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { title, description, columnId, priority, tag, assigneeId, dueDate, progress } = req.body;

    const column = await prisma.column.findUnique({ where: { id: columnId } });
    if (!column) return res.status(404).json({ error: 'Column not found' });

    const count   = await prisma.task.count();
    const taskKey = `T-${String(count + 1).padStart(3, '0')}`;

    const task = await prisma.task.create({
      data: {
        taskKey,
        title,
        description: description || null,
        status:      columnId,
        columnId,
        priority:    (priority || 'MEDIUM').toUpperCase(),
        tag:         (tag || 'FEATURE').toUpperCase(),
        assigneeId:  assigneeId || null,
        creatorId:   req.user.id,
        dueDate:     dueDate ? new Date(dueDate) : null,
        progress:    progress || 0,
      },
      include: taskInclude,
    });

    // Real-time: broadcast new task to everyone on the board
    emitBoard(req, 'task:created', { task });

    // Notify assignee
    if (assigneeId && assigneeId !== req.user.id) {
      const assignee = await prisma.user.findUnique({ where: { id: assigneeId } });
      if (assignee) {
        await createNotification(prisma, {
          type: 'TASK_ASSIGNED', userId: assigneeId, taskId: task.id,
          title: 'Task assigned to you',
          message: `${req.user.name} assigned you "${title}"`,
        });
        emitUser(req, assigneeId, 'notification:new', { message: `${req.user.name} assigned you "${title}"` });
        sendTaskAssigned({ toEmail: assignee.email, toName: assignee.name, taskKey, taskTitle: title, assignerName: req.user.name, columnLabel: column.label, dueDate });
      }
    }

    res.status(201).json({ task });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// GET /api/tasks/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: {
        ...taskInclude,
        comments: {
          include: { author: { select: { id:true, name:true, initials:true, avatarColor:true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ task });
  } catch {
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// PUT /api/tasks/:id
router.put('/:id', authenticate, requireAdminOrMember, async (req, res) => {
  try {
    const existing = await prisma.task.findUnique({ where: { id: req.params.id }, include: { assignee: true } });
    if (!existing) return res.status(404).json({ error: 'Task not found' });

    const { title, description, columnId, priority, tag, assigneeId, dueDate, progress } = req.body;
    const data = {};
    if (title       !== undefined) data.title       = title;
    if (description !== undefined) data.description = description;
    if (priority    !== undefined) data.priority    = priority.toUpperCase();
    if (tag         !== undefined) data.tag         = tag.toUpperCase();
    if (assigneeId  !== undefined) data.assigneeId  = assigneeId || null;
    if (dueDate     !== undefined) data.dueDate     = dueDate ? new Date(dueDate) : null;
    if (progress    !== undefined) data.progress    = parseInt(progress);
    if (columnId    !== undefined) {
      const col = await prisma.column.findUnique({ where: { id: columnId } });
      if (!col) return res.status(404).json({ error: 'Column not found' });
      data.columnId = columnId;
      data.status   = columnId;
    }

    const task = await prisma.task.update({ where: { id: req.params.id }, data, include: taskInclude });

    // Real-time broadcast
    emitBoard(req, 'task:updated', { task });

    // Notify if assignee changed
    const newAssigneeId = assigneeId !== undefined ? assigneeId : existing.assigneeId;
    if (assigneeId && assigneeId !== existing.assigneeId && assigneeId !== req.user.id) {
      const assignee = await prisma.user.findUnique({ where: { id: assigneeId } });
      if (assignee) {
        await createNotification(prisma, {
          type: 'TASK_ASSIGNED', userId: assigneeId, taskId: task.id,
          title: 'Task assigned to you',
          message: `${req.user.name} assigned you "${task.title}"`,
        });
        emitUser(req, assigneeId, 'notification:new', { message: `${req.user.name} assigned you "${task.title}"` });
        sendTaskAssigned({ toEmail: assignee.email, toName: assignee.name, taskKey: task.taskKey, taskTitle: task.title, assignerName: req.user.name, columnLabel: task.column?.label, dueDate: task.dueDate });
      }
    }

    res.json({ task });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Task not found' });
    console.error(err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// PATCH /api/tasks/:id/status  – drag-and-drop
router.patch('/:id/status', authenticate, requireAdminOrMember, async (req, res) => {
  try {
    const { columnId } = req.body;
    const col = await prisma.column.findUnique({ where: { id: columnId } });
    if (!col) return res.status(404).json({ error: 'Column not found' });

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data:  { columnId, status: columnId },
      include: taskInclude,
    });

    emitBoard(req, 'task:moved', { taskId: task.id, columnId, task });

    // Notify assignee of move
    if (task.assigneeId && task.assigneeId !== req.user.id) {
      await createNotification(prisma, {
        type: 'TASK_MOVED', userId: task.assigneeId, taskId: task.id,
        title: 'Task moved',
        message: `${req.user.name} moved "${task.title}" to ${col.label}`,
      });
      emitUser(req, task.assigneeId, 'notification:new', { message: `"${task.title}" moved to ${col.label}` });
    }

    res.json({ task });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Task not found' });
    res.status(500).json({ error: 'Failed to move task' });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', authenticate, requireAdminOrMember, async (req, res) => {
  try {
    const task = await prisma.task.findUnique({ where: { id: req.params.id }, include: { attachments: true } });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Delete Cloudinary attachments first
    if (task.attachments.length > 0) {
      const { deleteFile } = require('../services/cloudinary');
      for (const att of task.attachments) {
        const isImage = att.mimeType.startsWith('image/');
        await deleteFile(att.publicId, isImage ? 'image' : 'raw');
      }
    }

    await prisma.task.delete({ where: { id: req.params.id } });

    emitBoard(req, 'task:deleted', { taskId: req.params.id });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Task not found' });
    console.error(err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

module.exports = router;
