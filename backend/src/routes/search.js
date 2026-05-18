// src/routes/search.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/search  – advanced multi-criteria search
// Query params: q, status, priority, tag, assigneeId, columnId,
//               dueBefore, dueAfter, createdBefore, createdAfter,
//               hasAttachments, hasSubtasks, sprintId, overdue,
//               page, limit, sortBy, sortOrder
router.get('/', authenticate, async (req, res) => {
  try {
    const {
      q,
      status,
      priority,
      tag,
      assigneeId,
      columnId,
      dueBefore,
      dueAfter,
      createdBefore,
      createdAfter,
      hasAttachments,
      hasSubtasks,
      sprintId,
      overdue,
      page     = 1,
      limit    = 20,
      sortBy   = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const where = {};

    // Text search across title and description
    if (q) {
      where.OR = [
        { title:       { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { taskKey:     { contains: q, mode: 'insensitive' } },
      ];
    }

    if (status)     where.status   = status;
    if (columnId)   where.columnId = columnId;
    if (assigneeId) where.assigneeId = assigneeId === 'unassigned' ? null : assigneeId;

    if (priority) {
      const priorities = priority.split(',').map(p => p.toUpperCase());
      where.priority = priorities.length === 1 ? priorities[0] : { in: priorities };
    }

    if (tag) {
      const tags = tag.split(',').map(t => t.toUpperCase());
      where.tag = tags.length === 1 ? tags[0] : { in: tags };
    }

    // Due date range
    if (dueBefore || dueAfter) {
      where.dueDate = {};
      if (dueBefore) where.dueDate.lte = new Date(dueBefore);
      if (dueAfter)  where.dueDate.gte = new Date(dueAfter);
    }

    // Overdue
    if (overdue === 'true') {
      where.dueDate = { lt: new Date() };
      where.NOT = { status: 'done' };
    }

    // Created date range
    if (createdBefore || createdAfter) {
      where.createdAt = {};
      if (createdBefore) where.createdAt.lte = new Date(createdBefore);
      if (createdAfter)  where.createdAt.gte = new Date(createdAfter);
    }

    // Has attachments
    if (hasAttachments === 'true') {
      where.attachments = { some: {} };
    }

    // Has subtasks
    if (hasSubtasks === 'true') {
      where.subtasks = { some: {} };
    }

    // In a specific sprint
    if (sprintId) {
      where.sprints = { some: { sprintId } };
    }

    // Valid sort fields
    const validSortFields = ['createdAt', 'updatedAt', 'dueDate', 'priority', 'title', 'progress'];
    const orderField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const orderDir   = sortOrder === 'asc' ? 'asc' : 'desc';

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = Math.min(parseInt(limit), 50); // max 50 per page

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          assignee: { select: { id: true, name: true, initials: true, avatarColor: true } },
          creator:  { select: { id: true, name: true, initials: true } },
          column:   { select: { id: true, label: true, color: true } },
          _count:   { select: { comments: true, subtasks: true, attachments: true } },
        },
        orderBy: { [orderField]: orderDir },
        skip,
        take,
      }),
      prisma.task.count({ where }),
    ]);

    res.json({
      tasks,
      pagination: {
        total,
        page:       parseInt(page),
        limit:      take,
        totalPages: Math.ceil(total / take),
        hasMore:    skip + take < total,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// GET /api/search/suggestions?q=xxx  – quick autocomplete suggestions
router.get('/suggestions', authenticate, async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json({ suggestions: [] });
  try {
    const tasks = await prisma.task.findMany({
      where: {
        OR: [
          { title:   { contains: q, mode: 'insensitive' } },
          { taskKey: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, taskKey: true, title: true, status: true },
      take: 8,
    });
    res.json({ suggestions: tasks });
  } catch (err) {
    res.status(500).json({ error: 'Suggestions failed' });
  }
});

module.exports = router;
