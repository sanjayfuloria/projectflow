// src/routes/automations.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

const VALID_TRIGGERS = ['task_created', 'status_changed', 'priority_changed', 'assignee_changed', 'due_date_passed'];
const VALID_ACTIONS  = ['assign_to', 'set_priority', 'set_tag', 'move_to_column', 'send_notification', 'post_slack'];

// GET /api/automations
router.get('/', authenticate, async (req, res) => {
  try {
    const rules = await prisma.automationRule.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ rules });
  } catch { res.status(500).json({ error: 'Failed to fetch automations' }); }
});

// POST /api/automations
router.post('/', authenticate, requireAdmin, async (req, res) => {
  const { name, trigger, triggerValue, action, actionValue } = req.body;
  if (!name?.trim())              return res.status(400).json({ error: 'Name required' });
  if (!VALID_TRIGGERS.includes(trigger)) return res.status(400).json({ error: 'Invalid trigger' });
  if (!VALID_ACTIONS.includes(action))   return res.status(400).json({ error: 'Invalid action' });
  try {
    const rule = await prisma.automationRule.create({
      data: { name: name.trim(), trigger, triggerValue: triggerValue || null, action, actionValue: actionValue || null, createdById: req.user.id },
    });
    res.status(201).json({ rule });
  } catch { res.status(500).json({ error: 'Failed to create automation' }); }
});

// PUT /api/automations/:id
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  const { name, trigger, triggerValue, action, actionValue, enabled } = req.body;
  try {
    const rule = await prisma.automationRule.update({
      where: { id: req.params.id },
      data: {
        ...(name         !== undefined && { name: name.trim() }),
        ...(trigger      !== undefined && { trigger }),
        ...(triggerValue !== undefined && { triggerValue: triggerValue || null }),
        ...(action       !== undefined && { action }),
        ...(actionValue  !== undefined && { actionValue: actionValue || null }),
        ...(enabled      !== undefined && { enabled: Boolean(enabled) }),
      },
    });
    res.json({ rule });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Rule not found' });
    res.status(500).json({ error: 'Failed to update automation' });
  }
});

// DELETE /api/automations/:id
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await prisma.automationRule.delete({ where: { id: req.params.id } });
    res.json({ message: 'Automation deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Rule not found' });
    res.status(500).json({ error: 'Failed to delete automation' });
  }
});

module.exports = router;
