// src/routes/email-intake.js
// Brevo Inbound Email Parsing — free tier
// Setup: https://app.brevo.com → Inbound Parsing → Add a new inbound domain
// Point your MX record to Brevo, then set webhook URL to:
// https://projectflow.sanjayfuloria.tech/api/email-intake/webhook
// Brevo will POST parsed email data to this endpoint

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { emitBoard } = require('../services/socket');
const { runAutomations } = require('../services/automation');

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/email-intake/webhook  – Brevo inbound email webhook
router.post('/webhook', async (req, res) => {
  try {
    // Brevo sends parsed email as JSON
    const payload = req.body;

    // Handle both single email and batch
    const emails = Array.isArray(payload) ? payload : [payload];

    for (const email of emails) {
      const from    = email.From || email.from || '';
      const subject = email.Subject || email.subject || 'Task from email';
      const text    = email.Text || email.text || email.RawTextBody || '';
      const html    = email.Html || email.html || '';

      // Extract sender email
      const senderEmail = from.match(/<(.+?)>/)?.[ 1] || from.trim();

      // Find user by email (optional — creates task regardless)
      const sender = senderEmail
        ? await prisma.user.findUnique({ where: { email: senderEmail } })
        : null;

      // Get admin as fallback creator
      const admin = sender || await prisma.user.findFirst({ where: { role: 'ADMIN' } });
      if (!admin) continue;

      // Get first column (To Do)
      const column = await prisma.column.findFirst({ orderBy: { order: 'asc' } });
      if (!column) continue;

      // Generate task key
      const count   = await prisma.task.count();
      const taskKey = `T-${String(count + 1).padStart(3, '0')}`;

      // Clean up description
      const description = text.trim() || html.replace(/<[^>]+>/g, '').trim() || 'Created from email';

      const task = await prisma.task.create({
        data: {
          taskKey,
          title:       subject.slice(0, 200),
          description: description.slice(0, 2000),
          status:      column.id,
          columnId:    column.id,
          priority:    'MEDIUM',
          tag:         'FEATURE',
          assigneeId:  sender?.id || null,
          creatorId:   admin.id,
          progress:    0,
        },
        include: {
          assignee: { select: { id: true, name: true, initials: true, avatarColor: true } },
          column:   { select: { id: true, label: true, color: true } },
          _count:   { select: { comments: true, subtasks: true } },
        },
      });

      // Real-time emit
      const io = req.app.get('io');
      if (io) io.to('board').emit('task:created', { task });

      // Run automations
      await runAutomations({ trigger: 'task_created', task, req, actor: admin });

      console.log(`📧 Email task created: ${taskKey} from ${senderEmail}`);
    }

    // Always return 200 to Brevo so it doesn't retry
    res.status(200).json({ message: 'OK' });
  } catch (err) {
    console.error('Email intake error:', err.message);
    res.status(200).json({ message: 'OK' }); // Still 200 to prevent Brevo retries
  }
});

// GET /api/email-intake/status  – check if email intake is configured
router.get('/status', async (req, res) => {
  res.json({
    webhookUrl: `${process.env.FRONTEND_URL?.replace(/\/$/, '')}/api/email-intake/webhook`,
    instructions: [
      '1. Go to app.brevo.com → Inbound Parsing',
      '2. Add your domain (e.g. projectflow.sanjayfuloria.tech)',
      '3. Set webhook URL to the webhookUrl above',
      '4. Add MX record: 10 inbound.brevo.com to your domain DNS',
      '5. Send an email to any@projectflow.sanjayfuloria.tech',
      '6. It will appear as a task on your board!',
    ],
  });
});

module.exports = router;
