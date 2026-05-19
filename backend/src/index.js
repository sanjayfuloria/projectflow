// src/index.js
require('dotenv').config();
const express      = require('express');
const http         = require('http');
const { Server }   = require('socket.io');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit    = require('express-rate-limit');
const jwt          = require('jsonwebtoken');

const authRoutes        = require('./routes/auth');
const taskRoutes        = require('./routes/tasks');
const columnRoutes      = require('./routes/columns');
const memberRoutes      = require('./routes/members');
const commentRoutes     = require('./routes/comments');
const subtaskRoutes     = require('./routes/subtasks');
const attachmentRoutes  = require('./routes/attachments');
const notifRoutes       = require('./routes/notifications');
const dependencyRoutes  = require('./routes/dependencies');
const sprintRoutes      = require('./routes/sprints');
const searchRoutes      = require('./routes/search');
const activityRoutes    = require('./routes/activity');
const automationRoutes  = require('./routes/automations');
const intakeRoutes      = require('./routes/intake');
const slackRoutes       = require('./routes/slack');
const goalsRoutes       = require('./routes/goals');
const emailIntakeRoutes = require('./routes/email-intake');

const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 4000;
const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:5173';

app.set('trust proxy', 1);

// ── Socket.io ─────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: FRONTEND, credentials: true },
  transports: ['websocket', 'polling'],
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('No token'));
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = payload.userId;
    next();
  } catch { next(new Error('Invalid token')); }
});

io.on('connection', (socket) => {
  socket.join(`user:${socket.userId}`);
  socket.join('board');
  socket.on('disconnect', () => {});
});

app.set('io', io);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: [FRONTEND, /\.sanjayfuloria\.tech$/, 'http://localhost:5173'],
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.use('/api/', rateLimit({ windowMs: 15*60*1000, max: 300 }));
app.use('/api/auth/', rateLimit({ windowMs: 15*60*1000, max: 20, message: { error: 'Too many auth attempts.' } }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', version: 'v6', timestamp: new Date().toISOString() }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/tasks',         taskRoutes);
app.use('/api/columns',       columnRoutes);
app.use('/api/members',       memberRoutes);
app.use('/api/comments',      commentRoutes);
app.use('/api/subtasks',      subtaskRoutes);
app.use('/api/attachments',   attachmentRoutes);
app.use('/api/notifications', notifRoutes);
app.use('/api/dependencies',  dependencyRoutes);
app.use('/api/sprints',       sprintRoutes);
app.use('/api/search',        searchRoutes);
app.use('/api/activity',      activityRoutes);
app.use('/api/automations',   automationRoutes);
app.use('/api/intake',        intakeRoutes);
app.use('/api/slack',         slackRoutes);
app.use('/api/goals',         goalsRoutes);
app.use('/api/email-intake',  emailIntakeRoutes);

app.use((req, res) => res.status(404).json({ error: `${req.method} ${req.path} not found` }));
app.use((err, req, res, _next) => {
  console.error('❌', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

// ── Background jobs ───────────────────────────────────────────────────────────
const { startDueDateChecker } = require('./routes/notifications');
const { startRecurrenceChecker } = require('./services/recurrence');
startDueDateChecker(io);
startRecurrenceChecker(io);

server.listen(PORT, () => console.log(`🚀 ProjectFlow API v6 on :${PORT}`));
