// src/routes/columns.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin } = require('../middleware/auth');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', authenticate, async (req, res) => {
  try {
    const columns = await prisma.column.findMany({
      orderBy: { order: 'asc' },
      include: { _count: { select: { tasks: true } } },
    });
    res.json({ columns });
  } catch (err) { res.status(500).json({ error: 'Failed to fetch columns' }); }
});

router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { label, color } = req.body;
    if (!label?.trim()) return res.status(400).json({ error: 'Label required' });
    const maxOrder = await prisma.column.aggregate({ _max: { order: true } });
    const column = await prisma.column.create({
      data: { label: label.trim(), color: color || '#6c63ff', order: (maxOrder._max.order || 0) + 1 },
    });
    res.status(201).json({ column });
  } catch (err) { res.status(500).json({ error: 'Failed to create column' }); }
});

router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { label, color, order } = req.body;
    const data = {};
    if (label !== undefined) data.label = label.trim();
    if (color !== undefined) data.color = color;
    if (order !== undefined) data.order = parseInt(order);
    const column = await prisma.column.update({ where: { id: req.params.id }, data });
    res.json({ column });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Column not found' });
    res.status(500).json({ error: 'Failed to update column' });
  }
});

router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const taskCount = await prisma.task.count({ where: { columnId: req.params.id } });
    if (taskCount > 0) return res.status(400).json({ error: `Column has ${taskCount} tasks. Move or delete them first.` });
    await prisma.column.delete({ where: { id: req.params.id } });
    res.json({ message: 'Column deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Column not found' });
    res.status(500).json({ error: 'Failed to delete column' });
  }
});

module.exports = router;
