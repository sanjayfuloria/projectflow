// src/routes/sprints.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdminOrMember, requireAdmin } = require('../middleware/auth');
const { emitBoard } = require('../services/socket');
const { logActivity } = require('../services/activity');
const { createNotification } = require('./notifications');

const router = express.Router();
const prisma = new PrismaClient();

const sprintInclude = {
  tasks: {
    include: {
      task: {
        include: {
          assignee: { select: { id: true, name: true, initials: true, avatarColor: true } },
          column:   { select: { id: true, label: true, color: true } },
          _count:   { select: { comments: true, subtasks: true } },
        },
      },
    },
    orderBy: { order: 'asc' },
  },
  _count: { select: { tasks: true } },
};

// GET /api/sprints – get all sprints
router.get('/', authenticate, async (req, res) => {
  try {
    const sprints = await prisma.sprint.findMany({
      include: sprintInclude,
      orderBy: { createdAt: 'desc' },
    });
    res.json({ sprints });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sprints' });
  }
});

// GET /api/sprints/active – get active sprint
router.get('/active', authenticate, async (req, res) => {
  try {
    const sprint = await prisma.sprint.findFirst({
      where: { status: 'ACTIVE' },
      include: sprintInclude,
    });
    res.json({ sprint });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch active sprint' });
  }
});

// GET /api/sprints/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const sprint = await prisma.sprint.findUnique({ where: { id: req.params.id }, include: sprintInclude });
    if (!sprint) return res.status(404).json({ error: 'Sprint not found' });
    res.json({ sprint });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sprint' });
  }
});

// POST /api/sprints – create sprint
router.post('/', authenticate, requireAdminOrMember, async (req, res) => {
  const { name, goal, startDate, endDate } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Sprint name required' });
  try {
    const sprint = await prisma.sprint.create({
      data: {
        name: name.trim(),
        goal: goal || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate:   endDate   ? new Date(endDate)   : null,
      },
      include: sprintInclude,
    });
    emitBoard(req, 'sprint:created', { sprint });
    res.status(201).json({ sprint });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create sprint' });
  }
});

// PUT /api/sprints/:id – update sprint
router.put('/:id', authenticate, requireAdminOrMember, async (req, res) => {
  const { name, goal, startDate, endDate } = req.body;
  try {
    const sprint = await prisma.sprint.update({
      where: { id: req.params.id },
      data: {
        ...(name      !== undefined && { name: name.trim() }),
        ...(goal      !== undefined && { goal }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate   !== undefined && { endDate:   endDate   ? new Date(endDate)   : null }),
      },
      include: sprintInclude,
    });
    emitBoard(req, 'sprint:updated', { sprint });
    res.json({ sprint });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Sprint not found' });
    res.status(500).json({ error: 'Failed to update sprint' });
  }
});

// PATCH /api/sprints/:id/status – start or complete a sprint
router.patch('/:id/status', authenticate, requireAdminOrMember, async (req, res) => {
  const { status } = req.body;
  if (!['PLANNED','ACTIVE','COMPLETED'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

  try {
    // Only one sprint can be active at a time
    if (status === 'ACTIVE') {
      const active = await prisma.sprint.findFirst({ where: { status: 'ACTIVE' } });
      if (active && active.id !== req.params.id) {
        return res.status(400).json({ error: `Sprint "${active.name}" is already active. Complete it first.` });
      }
    }

    const sprint = await prisma.sprint.update({
      where: { id: req.params.id },
      data: {
        status,
        ...(status === 'ACTIVE'    && { startDate: new Date() }),
        ...(status === 'COMPLETED' && { endDate:   new Date() }),
      },
      include: sprintInclude,
    });

    emitBoard(req, 'sprint:status', { sprint });

    // Notify all assignees of tasks in this sprint
    if (status === 'ACTIVE' || status === 'COMPLETED') {
      const taskIds = sprint.tasks.map(st => st.task.id);
      const assignees = await prisma.task.findMany({
        where: { id: { in: taskIds }, assigneeId: { not: null } },
        select: { assigneeId: true, title: true },
      });
      for (const t of assignees) {
        if (t.assigneeId && t.assigneeId !== req.user.id) {
          await createNotification(prisma, {
            type: status === 'ACTIVE' ? 'SPRINT_STARTED' : 'SPRINT_COMPLETED',
            userId: t.assigneeId, taskId: null,
            title: status === 'ACTIVE' ? `Sprint "${sprint.name}" started` : `Sprint "${sprint.name}" completed`,
            message: status === 'ACTIVE'
              ? `Sprint "${sprint.name}" is now active. Your task "${t.title}" is included.`
              : `Sprint "${sprint.name}" has been completed.`,
          });
        }
      }
    }

    res.json({ sprint });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Sprint not found' });
    res.status(500).json({ error: 'Failed to update sprint status' });
  }
});

// POST /api/sprints/:id/tasks – add task to sprint
router.post('/:id/tasks', authenticate, requireAdminOrMember, async (req, res) => {
  const { taskId } = req.body;
  if (!taskId) return res.status(400).json({ error: 'taskId required' });
  try {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const maxOrder = await prisma.sprintTask.aggregate({ where: { sprintId: req.params.id }, _max: { order: true } });
    await prisma.sprintTask.create({
      data: { sprintId: req.params.id, taskId, order: (maxOrder._max.order || 0) + 1 },
    });

    await logActivity({ taskId, userId: req.user.id, action: 'ADDED_TO_SPRINT',
      newValue: (await prisma.sprint.findUnique({ where: { id: req.params.id }, select: { name: true } }))?.name });

    const sprint = await prisma.sprint.findUnique({ where: { id: req.params.id }, include: sprintInclude });
    emitBoard(req, 'sprint:updated', { sprint });
    res.json({ sprint });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Task already in sprint' });
    res.status(500).json({ error: 'Failed to add task to sprint' });
  }
});

// DELETE /api/sprints/:id/tasks/:taskId – remove task from sprint
router.delete('/:id/tasks/:taskId', authenticate, requireAdminOrMember, async (req, res) => {
  try {
    await prisma.sprintTask.deleteMany({
      where: { sprintId: req.params.id, taskId: req.params.taskId },
    });
    await logActivity({ taskId: req.params.taskId, userId: req.user.id, action: 'REMOVED_FROM_SPRINT' });
    const sprint = await prisma.sprint.findUnique({ where: { id: req.params.id }, include: sprintInclude });
    emitBoard(req, 'sprint:updated', { sprint });
    res.json({ sprint });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove task from sprint' });
  }
});

// DELETE /api/sprints/:id
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await prisma.sprint.delete({ where: { id: req.params.id } });
    emitBoard(req, 'sprint:deleted', { sprintId: req.params.id });
    res.json({ message: 'Sprint deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Sprint not found' });
    res.status(500).json({ error: 'Failed to delete sprint' });
  }
});

module.exports = router;
