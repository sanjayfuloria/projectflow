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

const authRoutes       = require('./routes/auth');
const taskRoutes       = require('./routes/tasks');
const columnRoutes     = require('./routes/columns');
const memberRoutes     = require('./routes/members');
const commentRoutes    = require('./routes/comments');
const subtaskRoutes    = require('./routes/subtasks');
const attachmentRoutes = require('./routes/attachments');
const notifRoutes      = require('./routes/notifications');

const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 4000;
const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:5173';

// ── Socket.io ─────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: FRONTEND, credentials: true },
  transports: ['websocket', 'polling'],
});

// JWT auth for sockets
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('No token'));
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = payload.userId;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  socket.join(`user:${socket.userId}`);
  socket.join('board');
  socket.on('disconnect', () => {});
});

// Make io available in route handlers via req.app.get('io')
app.set('io', io);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: FRONTEND, credentials: true, methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use('/api/', rateLimit({ windowMs: 15*60*1000, max: 300 }));
app.use('/api/auth/', rateLimit({ windowMs: 15*60*1000, max: 20, message: { error: 'Too many auth attempts.' } }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/tasks',         taskRoutes);
app.use('/api/columns',       columnRoutes);
app.use('/api/members',       memberRoutes);
app.use('/api/comments',      commentRoutes);
app.use('/api/subtasks',      subtaskRoutes);
app.use('/api/attachments',   attachmentRoutes);
app.use('/api/notifications', notifRoutes);

app.use((req, res) => res.status(404).json({ error: `${req.method} ${req.path} not found` }));
app.use((err, req, res, _next) => {
  console.error('❌', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

server.listen(PORT, () => console.log(`🚀 ProjectFlow API + Socket.io on :${PORT}`));
