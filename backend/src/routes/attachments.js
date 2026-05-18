// src/routes/attachments.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdminOrMember } = require('../middleware/auth');
const { emitBoard } = require('../services/socket');

const router = express.Router();
const prisma = new PrismaClient();

// Lazy-load cloudinary only if configured, so the server starts without it
function getUpload() {
  const { isConfigured, upload } = require('../services/cloudinary');
  if (!isConfigured) return null;
  return upload;
}

// POST /api/attachments  – upload file to task
router.post('/', authenticate, requireAdminOrMember, async (req, res) => {
  const upload = getUpload();

  if (!upload) {
    return res.status(503).json({
      error: 'File uploads not configured. Add CLOUDINARY_* env vars to enable.',
    });
  }

  // Run multer middleware
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const { taskId } = req.body;
    if (!taskId) return res.status(400).json({ error: 'taskId required' });

    try {
      const task = await prisma.task.findUnique({ where: { id: taskId } });
      if (!task) return res.status(404).json({ error: 'Task not found' });

      // Cloudinary puts metadata on req.file
      const attachment = await prisma.attachment.create({
        data: {
          filename:     req.file.filename || req.file.public_id,
          originalName: req.file.originalname,
          url:          req.file.path,          // Cloudinary secure URL
          publicId:     req.file.filename,      // Cloudinary public_id
          size:         req.file.size,
          mimeType:     req.file.mimetype,
          taskId,
          uploadedById: req.user.id,
        },
      });

      emitBoard(req, 'attachment:added', { taskId, attachment });
      res.status(201).json({ attachment });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to save attachment' });
    }
  });
});

// GET /api/attachments?taskId=xxx
router.get('/', authenticate, async (req, res) => {
  const { taskId } = req.query;
  if (!taskId) return res.status(400).json({ error: 'taskId required' });
  try {
    const attachments = await prisma.attachment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ attachments });
  } catch {
    res.status(500).json({ error: 'Failed to fetch attachments' });
  }
});

// DELETE /api/attachments/:id
router.delete('/:id', authenticate, requireAdminOrMember, async (req, res) => {
  try {
    const att = await prisma.attachment.findUnique({ where: { id: req.params.id } });
    if (!att) return res.status(404).json({ error: 'Attachment not found' });

    // Delete from Cloudinary
    const { deleteFile } = require('../services/cloudinary');
    const isImage = att.mimeType.startsWith('image/');
    await deleteFile(att.publicId, isImage ? 'image' : 'raw');

    await prisma.attachment.delete({ where: { id: req.params.id } });
    emitBoard(req, 'attachment:deleted', { taskId: att.taskId, attachmentId: req.params.id });
    res.json({ message: 'Attachment deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    console.error(err);
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
});

module.exports = router;
