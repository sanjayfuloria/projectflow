// src/routes/members.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin } = require('../middleware/auth');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', authenticate, async (req, res) => {
  try {
    const members = await prisma.user.findMany({
      select: { id: true, name: true, initials: true, email: true, role: true, avatarColor: true, createdAt: true,
        _count: { select: { tasksAssigned: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ members });
  } catch (err) { res.status(500).json({ error: 'Failed to fetch members' }); }
});

router.patch('/:id/role', authenticate, requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['ADMIN','MEMBER','VIEWER'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
      select: { id: true, name: true, role: true },
    });
    res.json({ user });
  } catch (err) { res.status(500).json({ error: 'Failed to update role' }); }
});

router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot remove yourself' });
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ message: 'Member removed' });
  } catch (err) { res.status(500).json({ error: 'Failed to remove member' }); }
});

module.exports = router;
