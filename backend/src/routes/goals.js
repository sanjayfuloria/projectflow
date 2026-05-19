// src/routes/goals.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdminOrMember } = require('../middleware/auth');
const { emitBoard } = require('../services/socket');

const router = express.Router();
const prisma = new PrismaClient();

const goalInclude = {
  sprints: {
    include: {
      sprint: {
        include: {
          _count: { select: { tasks: true } },
          tasks: { include: { task: { select: { id: true, status: true, columnId: true } } } },
        },
      },
    },
  },
  _count: { select: { sprints: true } },
};

// Auto-calculate progress from linked sprints
async function calcProgress(goalId) {
  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
    include: {
      sprints: {
        include: {
          sprint: {
            include: { tasks: { include: { task: { select: { status: true } } } } },
          },
        },
      },
    },
  });
  if (!goal || !goal.sprints.length) return 0;
  let total = 0, done = 0;
  for (const gs of goal.sprints) {
    for (const st of gs.sprint.tasks) {
      total++;
      if (gs.sprint.status === 'COMPLETED' || st.task.status === 'col-done') done++;
    }
  }
  return total ? Math.round((done / total) * 100) : 0;
}

// GET /api/goals
router.get('/', authenticate, async (req, res) => {
  try {
    const goals = await prisma.goal.findMany({ include: goalInclude, orderBy: { createdAt: 'desc' } });
    res.json({ goals });
  } catch (err) { res.status(500).json({ error: 'Failed to fetch goals' }); }
});

// POST /api/goals
router.post('/', authenticate, requireAdminOrMember, async (req, res) => {
  const { title, description, targetDate } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title required' });
  try {
    const goal = await prisma.goal.create({
      data: { title: title.trim(), description: description || null, targetDate: targetDate ? new Date(targetDate) : null, createdById: req.user.id },
      include: goalInclude,
    });
    emitBoard(req, 'goal:created', { goal });
    res.status(201).json({ goal });
  } catch { res.status(500).json({ error: 'Failed to create goal' }); }
});

// PUT /api/goals/:id
router.put('/:id', authenticate, requireAdminOrMember, async (req, res) => {
  const { title, description, targetDate, status } = req.body;
  try {
    const goal = await prisma.goal.update({
      where: { id: req.params.id },
      data: {
        ...(title       !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description }),
        ...(targetDate  !== undefined && { targetDate: targetDate ? new Date(targetDate) : null }),
        ...(status      !== undefined && { status }),
      },
      include: goalInclude,
    });
    emitBoard(req, 'goal:updated', { goal });
    res.json({ goal });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Goal not found' });
    res.status(500).json({ error: 'Failed to update goal' });
  }
});

// DELETE /api/goals/:id
router.delete('/:id', authenticate, requireAdminOrMember, async (req, res) => {
  try {
    await prisma.goal.delete({ where: { id: req.params.id } });
    emitBoard(req, 'goal:deleted', { goalId: req.params.id });
    res.json({ message: 'Goal deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Goal not found' });
    res.status(500).json({ error: 'Failed to delete goal' });
  }
});

// POST /api/goals/:id/sprints  – link sprint to goal
router.post('/:id/sprints', authenticate, requireAdminOrMember, async (req, res) => {
  const { sprintId } = req.body;
  if (!sprintId) return res.status(400).json({ error: 'sprintId required' });
  try {
    await prisma.goalSprint.create({ data: { goalId: req.params.id, sprintId } });
    const progress = await calcProgress(req.params.id);
    await prisma.goal.update({ where: { id: req.params.id }, data: { progress } });
    const goal = await prisma.goal.findUnique({ where: { id: req.params.id }, include: goalInclude });
    emitBoard(req, 'goal:updated', { goal });
    res.json({ goal });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Sprint already linked' });
    res.status(500).json({ error: 'Failed to link sprint' });
  }
});

// DELETE /api/goals/:id/sprints/:sprintId  – unlink sprint
router.delete('/:id/sprints/:sprintId', authenticate, requireAdminOrMember, async (req, res) => {
  try {
    await prisma.goalSprint.deleteMany({ where: { goalId: req.params.id, sprintId: req.params.sprintId } });
    const goal = await prisma.goal.findUnique({ where: { id: req.params.id }, include: goalInclude });
    emitBoard(req, 'goal:updated', { goal });
    res.json({ goal });
  } catch { res.status(500).json({ error: 'Failed to unlink sprint' }); }
});

module.exports = router;
