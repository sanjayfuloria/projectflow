// src/services/socket.js
// Central place for all Socket.io emit calls.
// Import this in route handlers: const { emitBoard, emitUser } = require('../services/socket')

/**
 * Emit a board-wide event (all connected users see it).
 * Used for: task created/updated/deleted/moved, column changes
 */
function emitBoard(req, event, payload) {
  const io = req.app.get('io');
  if (io) io.to('board').emit(event, payload);
}

/**
 * Emit a private event to a specific user.
 * Used for: personal notifications
 */
function emitUser(req, userId, event, payload) {
  const io = req.app.get('io');
  if (io) io.to(`user:${userId}`).emit(event, payload);
}

module.exports = { emitBoard, emitUser };
