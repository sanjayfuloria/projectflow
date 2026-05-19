// src/routes/slack.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/slack/config
router.get('/config', authenticate, requireAdmin, async (req, res) => {
  try {
    const config = await prisma.slackConfig.findFirst();
    res.json({ config });
  } catch { res.status(500).json({ error: 'Failed to fetch Slack config' }); }
});

// POST /api/slack/config  – create or update
router.post('/config', authenticate, requireAdmin, async (req, res) => {
  const { webhookUrl, channel, enabled, events } = req.body;
  if (!webhookUrl?.trim()) return res.status(400).json({ error: 'Webhook URL required' });
  try {
    const existing = await prisma.slackConfig.findFirst();
    const config = existing
      ? await prisma.slackConfig.update({
          where: { id: existing.id },
          data: { webhookUrl: webhookUrl.trim(), channel: channel || null, enabled: Boolean(enabled), events: events || [] },
        })
      : await prisma.slackConfig.create({
          data: { webhookUrl: webhookUrl.trim(), channel: channel || null, enabled: Boolean(enabled ?? true), events: events || [], createdById: req.user.id },
        });
    res.json({ config });
  } catch { res.status(500).json({ error: 'Failed to save Slack config' }); }
});

// POST /api/slack/test  – send a test message
router.post('/test', authenticate, requireAdmin, async (req, res) => {
  const { webhookUrl } = req.body;
  const url = webhookUrl || (await prisma.slackConfig.findFirst())?.webhookUrl;
  if (!url) return res.status(400).json({ error: 'No webhook URL configured' });
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '✅ ProjectFlow Slack integration is working! 🚀' }),
    });
    if (response.ok) res.json({ message: 'Test message sent successfully!' });
    else res.status(400).json({ error: `Slack returned ${response.status}. Check your webhook URL.` });
  } catch (err) {
    res.status(500).json({ error: `Failed to reach Slack: ${err.message}` });
  }
});

module.exports = router;
