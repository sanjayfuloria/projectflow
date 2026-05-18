// src/routes/activity.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/activity?taskId=xxx  – get activity log for a task
router.get('/', authenticate, async (req, res) => {
  const { taskId } = req.query;
  if (!taskId) return res.status(400).json({ error: 'taskId required' });
  try {
    const logs = await prisma.activityLog.findMany({
      where: { taskId },
      include: { user: { select: { id: true, name: true, initials: true, avatarColor: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

module.exports = router;
