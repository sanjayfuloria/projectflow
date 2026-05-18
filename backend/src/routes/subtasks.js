// src/routes/subtasks.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdminOrMember } = require('../middleware/auth');
const { emitBoard } = require('../services/socket');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/subtasks?taskId=xxx  – get all subtasks for a task
router.get('/', authenticate, async (req, res) => {
  const { taskId } = req.query;
  if (!taskId) return res.status(400).json({ error: 'taskId required' });
  try {
    const subtasks = await prisma.subtask.findMany({
      where: { taskId },
      orderBy: { order: 'asc' },
    });
    res.json({ subtasks });
  } catch {
    res.status(500).json({ error: 'Failed to fetch subtasks' });
  }
});

// POST /api/subtasks  – create subtask
router.post('/', authenticate, requireAdminOrMember, async (req, res) => {
  const { taskId, title } = req.body;
  if (!taskId || !title?.trim()) return res.status(400).json({ error: 'taskId and title required' });

  try {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const maxOrder = await prisma.subtask.aggregate({ where: { taskId }, _max: { order: true } });
    const subtask = await prisma.subtask.create({
      data: { title: title.trim(), taskId, order: (maxOrder._max.order || 0) + 1 },
    });

    emitBoard(req, 'subtask:created', { taskId, subtask });
    res.status(201).json({ subtask });
  } catch {
    res.status(500).json({ error: 'Failed to create subtask' });
  }
});

// PATCH /api/subtasks/:id  – toggle complete or rename
router.patch('/:id', authenticate, requireAdminOrMember, async (req, res) => {
  try {
    const { completed, title } = req.body;
    const data = {};
    if (completed !== undefined) data.completed = Boolean(completed);
    if (title     !== undefined) data.title     = title.trim();

    const subtask = await prisma.subtask.update({ where: { id: req.params.id }, data });

    // Update parent task progress automatically based on subtask completion
    const all  = await prisma.subtask.findMany({ where: { taskId: subtask.taskId } });
    const done = all.filter(s => s.completed).length;
    const auto = all.length > 0 ? Math.round((done / all.length) * 100) : 0;
    await prisma.task.update({ where: { id: subtask.taskId }, data: { progress: auto } });

    emitBoard(req, 'subtask:updated', { taskId: subtask.taskId, subtask, progress: auto });
    res.json({ subtask, progress: auto });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Subtask not found' });
    res.status(500).json({ error: 'Failed to update subtask' });
  }
});

// DELETE /api/subtasks/:id
router.delete('/:id', authenticate, requireAdminOrMember, async (req, res) => {
  try {
    const subtask = await prisma.subtask.delete({ where: { id: req.params.id } });
    emitBoard(req, 'subtask:deleted', { taskId: subtask.taskId, subtaskId: req.params.id });
    res.json({ message: 'Subtask deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Subtask not found' });
    res.status(500).json({ error: 'Failed to delete subtask' });
  }
});

// PATCH /api/subtasks/reorder  – drag to reorder
router.patch('/reorder', authenticate, requireAdminOrMember, async (req, res) => {
  const { taskId, orderedIds } = req.body;
  if (!taskId || !Array.isArray(orderedIds)) return res.status(400).json({ error: 'taskId and orderedIds required' });
  try {
    await Promise.all(orderedIds.map((id, idx) =>
      prisma.subtask.update({ where: { id }, data: { order: idx } })
    ));
    const subtasks = await prisma.subtask.findMany({ where: { taskId }, orderBy: { order: 'asc' } });
    emitBoard(req, 'subtask:reordered', { taskId, subtasks });
    res.json({ subtasks });
  } catch {
    res.status(500).json({ error: 'Failed to reorder subtasks' });
  }
});

module.exports = router;
