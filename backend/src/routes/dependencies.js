// src/routes/dependencies.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdminOrMember } = require('../middleware/auth');
const { emitBoard } = require('../services/socket');
const { logActivity } = require('../services/activity');
const { createNotification } = require('./notifications');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/dependencies?taskId=xxx  – get all dependencies for a task
router.get('/', authenticate, async (req, res) => {
  const { taskId } = req.query;
  if (!taskId) return res.status(400).json({ error: 'taskId required' });
  try {
    const [blockedBy, blocks] = await Promise.all([
      // Tasks that block this task
      prisma.taskDependency.findMany({
        where: { blockedTaskId: taskId },
        include: {
          blockingTask: {
            include: {
              column: { select: { label: true, color: true } },
              assignee: { select: { name: true, initials: true, avatarColor: true } },
            },
          },
        },
      }),
      // Tasks that this task blocks
      prisma.taskDependency.findMany({
        where: { blockingTaskId: taskId },
        include: {
          blockedTask: {
            include: {
              column: { select: { label: true, color: true } },
              assignee: { select: { name: true, initials: true, avatarColor: true } },
            },
          },
        },
      }),
    ]);

    res.json({
      blockedBy: blockedBy.map(d => ({ depId: d.id, ...d.blockingTask })),
      blocks:    blocks.map(d => ({ depId: d.id, ...d.blockedTask })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch dependencies' });
  }
});

// POST /api/dependencies  – add a dependency
router.post('/', authenticate, requireAdminOrMember, async (req, res) => {
  const { blockingTaskId, blockedTaskId } = req.body;
  if (!blockingTaskId || !blockedTaskId) return res.status(400).json({ error: 'blockingTaskId and blockedTaskId required' });
  if (blockingTaskId === blockedTaskId) return res.status(400).json({ error: 'A task cannot depend on itself' });

  try {
    // Check for circular dependency
    const wouldBeCircular = await checkCircular(blockingTaskId, blockedTaskId);
    if (wouldBeCircular) return res.status(400).json({ error: 'This would create a circular dependency' });

    const dep = await prisma.taskDependency.create({
      data: { blockingTaskId, blockedTaskId },
      include: {
        blockingTask: { select: { id: true, taskKey: true, title: true } },
        blockedTask:  { select: { id: true, taskKey: true, title: true } },
      },
    });

    // Log activity on both tasks
    await logActivity({ taskId: blockedTaskId,  userId: req.user.id, action: 'DEPENDENCY_ADDED', newValue: `blocked by ${dep.blockingTask.taskKey}` });
    await logActivity({ taskId: blockingTaskId, userId: req.user.id, action: 'DEPENDENCY_ADDED', newValue: `blocks ${dep.blockedTask.taskKey}` });

    emitBoard(req, 'dependency:added', { dep });

    // Notify assignees
    const [blocking, blocked] = await Promise.all([
      prisma.task.findUnique({ where: { id: blockingTaskId }, include: { assignee: true } }),
      prisma.task.findUnique({ where: { id: blockedTaskId },  include: { assignee: true } }),
    ]);

    if (blocked?.assigneeId && blocked.assigneeId !== req.user.id) {
      await createNotification(prisma, {
        type: 'DEPENDENCY_ADDED', userId: blocked.assigneeId, taskId: blockedTaskId,
        title: 'Task dependency added',
        message: `"${blocking?.title}" now blocks "${blocked?.title}"`,
      });
    }

    res.status(201).json({ dep });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Dependency already exists' });
    console.error(err);
    res.status(500).json({ error: 'Failed to add dependency' });
  }
});

// DELETE /api/dependencies/:id
router.delete('/:id', authenticate, requireAdminOrMember, async (req, res) => {
  try {
    await prisma.taskDependency.delete({ where: { id: req.params.id } });
    emitBoard(req, 'dependency:removed', { depId: req.params.id });
    res.json({ message: 'Dependency removed' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Dependency not found' });
    res.status(500).json({ error: 'Failed to remove dependency' });
  }
});

// ── Circular dependency check ─────────────────────────────────────────────────
async function checkCircular(blockingTaskId, blockedTaskId, visited = new Set()) {
  if (visited.has(blockingTaskId)) return false;
  visited.add(blockingTaskId);

  // If the task being blocked already blocks the blocking task (directly or indirectly), it's circular
  const downstream = await prisma.taskDependency.findMany({ where: { blockingTaskId: blockedTaskId } });
  for (const dep of downstream) {
    if (dep.blockedTaskId === blockingTaskId) return true;
    if (await checkCircular(dep.blockedTaskId, blockingTaskId, visited)) return true;
  }
  return false;
}

module.exports = router;
