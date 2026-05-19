// src/routes/intake.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { emitBoard } = require('../services/socket');
const { runAutomations } = require('../services/automation');

const router = express.Router();
const prisma = new PrismaClient();

// ── Admin routes (protected) ──────────────────────────────────────────────────

// GET /api/intake  – list all forms (admin)
router.get('/', authenticate, async (req, res) => {
  try {
    const forms = await prisma.intakeForm.findMany({
      include: { _count: { select: { submissions: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ forms });
  } catch { res.status(500).json({ error: 'Failed to fetch forms' }); }
});

// POST /api/intake  – create form (admin)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  const { name, description, columnId, defaultPriority, defaultTag, defaultAssigneeId, fields, slug } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  if (!columnId)     return res.status(400).json({ error: 'columnId required' });

  // Auto-generate slug if not provided
  const finalSlug = slug?.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);

  try {
    const form = await prisma.intakeForm.create({
      data: {
        name: name.trim(),
        slug: finalSlug,
        description: description || null,
        columnId,
        defaultPriority: defaultPriority || 'MEDIUM',
        defaultTag:      defaultTag      || 'FEATURE',
        defaultAssigneeId: defaultAssigneeId || null,
        fields: fields || [
          { id: 'title',       label: 'Task Title',   type: 'text',     required: true },
          { id: 'description', label: 'Description',  type: 'textarea', required: false },
          { id: 'email',       label: 'Your Email',   type: 'email',    required: false },
        ],
        createdById: req.user.id,
      },
    });
    res.status(201).json({ form });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Slug already taken' });
    res.status(500).json({ error: 'Failed to create form' });
  }
});

// PUT /api/intake/:id  – update form (admin)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  const { name, description, columnId, defaultPriority, defaultTag, defaultAssigneeId, fields, enabled } = req.body;
  try {
    const form = await prisma.intakeForm.update({
      where: { id: req.params.id },
      data: {
        ...(name               !== undefined && { name: name.trim() }),
        ...(description        !== undefined && { description }),
        ...(columnId           !== undefined && { columnId }),
        ...(defaultPriority    !== undefined && { defaultPriority }),
        ...(defaultTag         !== undefined && { defaultTag }),
        ...(defaultAssigneeId  !== undefined && { defaultAssigneeId: defaultAssigneeId || null }),
        ...(fields             !== undefined && { fields }),
        ...(enabled            !== undefined && { enabled: Boolean(enabled) }),
      },
    });
    res.json({ form });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Form not found' });
    res.status(500).json({ error: 'Failed to update form' });
  }
});

// DELETE /api/intake/:id
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await prisma.intakeForm.delete({ where: { id: req.params.id } });
    res.json({ message: 'Form deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Form not found' });
    res.status(500).json({ error: 'Failed to delete form' });
  }
});

// GET /api/intake/:id/submissions  – view submissions (admin)
router.get('/:id/submissions', authenticate, async (req, res) => {
  try {
    const submissions = await prisma.intakeSubmission.findMany({
      where: { formId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ submissions });
  } catch { res.status(500).json({ error: 'Failed to fetch submissions' }); }
});

// ── Public routes (no auth) ───────────────────────────────────────────────────

// GET /api/intake/public  – list all enabled forms (public, no auth)
router.get('/public', async (req, res) => {
  try {
    const forms = await prisma.intakeForm.findMany({
      where: { enabled: true },
      select: { id: true, name: true, description: true, slug: true, defaultTag: true, enabled: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ forms });
  } catch { res.status(500).json({ error: 'Failed to fetch forms' }); }
});

// GET /api/intake/public/:slug  – get form for public display
router.get('/public/:slug', async (req, res) => {
  try {
    const form = await prisma.intakeForm.findUnique({
      where: { slug: req.params.slug },
      select: { id: true, name: true, description: true, fields: true, enabled: true },
    });
    if (!form)         return res.status(404).json({ error: 'Form not found' });
    if (!form.enabled) return res.status(403).json({ error: 'This form is currently disabled' });
    res.json({ form });
  } catch { res.status(500).json({ error: 'Failed to fetch form' }); }
});

// POST /api/intake/public/:slug/submit  – submit form (public, no auth)
router.post('/public/:slug/submit', async (req, res) => {
  try {
    const form = await prisma.intakeForm.findUnique({ where: { slug: req.params.slug } });
    if (!form)         return res.status(404).json({ error: 'Form not found' });
    if (!form.enabled) return res.status(403).json({ error: 'This form is disabled' });

    const data = req.body;

    // Validate required fields
    const fields = form.fields;
    for (const field of fields) {
      if (field.required && !data[field.id]?.trim()) {
        return res.status(400).json({ error: `"${field.label}" is required` });
      }
    }

    // Build task title and description from form data
    const title       = data.title || data[fields[0]?.id] || 'New task from intake form';
    const description = data.description || Object.entries(data)
      .filter(([k]) => k !== 'title' && k !== 'email')
      .map(([k, v]) => `**${k}**: ${v}`)
      .join('\n');

    // Generate task key
    const count   = await prisma.task.count();
    const taskKey = `T-${String(count + 1).padStart(3, '0')}`;

    // Find a system user to be the creator (use first admin)
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!admin) return res.status(500).json({ error: 'No admin user found' });

    const task = await prisma.task.create({
      data: {
        taskKey,
        title,
        description,
        status:     form.columnId,
        columnId:   form.columnId,
        priority:   form.defaultPriority,
        tag:        form.defaultTag,
        assigneeId: form.defaultAssigneeId || null,
        creatorId:  admin.id,
      },
      include: {
        column:   { select: { id: true, label: true, color: true } },
        assignee: { select: { id: true, name: true, initials: true, avatarColor: true } },
        _count:   { select: { comments: true, subtasks: true } },
      },
    });

    // Save submission record
    await prisma.intakeSubmission.create({
      data: { formId: form.id, taskId: task.id, data, submitterEmail: data.email || null },
    });

    // Emit real-time event
    const io = req.app.get('io');
    if (io) io.to('board').emit('task:created', { task });

    // Run automations
    await runAutomations({ trigger: 'task_created', task, req, actor: admin });

    res.status(201).json({ message: 'Submitted successfully! Your request has been received.', taskKey });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Submission failed. Please try again.' });
  }
});

module.exports = router;
