/**
 * socket.js
 * Socket.IO initialization and event listeners.
 */

import { Server } from 'socket.io';

let ioInstance = null;

export function initSocket(server, allowedOrigins) {
  ioInstance = new Server(server, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
    path: '/socket.io',
  });

  ioInstance.on('connection', (socket) => {
    // console.log(`Socket connected: ${socket.id}`);

    socket.on('join', (data) => {
      const room = data?.room;
      if (room) {
        socket.join(room);
        // console.log(`Socket ${socket.id} joined room ${room}`);
      }
    });

    socket.on('leave', (data) => {
      const room = data?.room;
      if (room) {
        socket.leave(room);
      }
    });

    socket.on('typing', (data) => {
      const room = data?.room;
      const userName = data?.user_name;
      const isTyping = data?.is_typing ?? true;
      if (room) {
        socket.to(room).emit('user_typing', {
          user_name: userName,
          is_typing: isTyping,
        });
      }
    });

    socket.on('disconnect', () => {
      // console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return ioInstance;
}

export function getIO() {
  return ioInstance;
}
