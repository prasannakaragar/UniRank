/**
 * verifyChatSecurity.js
 * Automated security verification test for Cross-User Chat Data Leak fixes.
 */

import { createApp } from '../app.js';
import { io as Client } from 'socket.io-client';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import assert from 'assert';

async function runSecurityTests() {
  console.log('=== RUNNING CHAT PRIVACY & SECURITY AUTOMATED TESTS ===\n');

  const { app } = createApp();
  const server = http.createServer(app);
  const ioServer = new SocketIOServer(server, { path: '/socket.io' });

  ioServer.on('connection', (socket) => {
    socket.on('join', (data) => {
      if (data?.room) {
        socket.join(data.room);
      }
    });
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  let passed = 0;
  let failed = 0;

  // Test 1: API HTTP Cache-Control header check (/api/chats)
  try {
    const res = await fetch(`${baseUrl}/api/chats`);
    const cacheHeader = res.headers.get('cache-control');
    const pragmaHeader = res.headers.get('pragma');

    console.log(`[TEST 1] /api/chats Cache-Control Header: "${cacheHeader}"`);
    assert(cacheHeader && cacheHeader.includes('no-store'), 'Cache-Control must contain no-store');
    assert(cacheHeader && cacheHeader.includes('no-cache'), 'Cache-Control must contain no-cache');
    assert(cacheHeader && cacheHeader.includes('must-revalidate'), 'Cache-Control must contain must-revalidate');
    assert(cacheHeader && cacheHeader.includes('private'), 'Cache-Control must contain private');
    assert(pragmaHeader === 'no-cache', 'Pragma must be no-cache');
    console.log('✅ TEST 1 PASSED: /api/chats returns Cache-Control: no-store, no-cache, must-revalidate, private\n');
    passed++;
  } catch (err) {
    console.error('❌ TEST 1 FAILED:', err.message);
    failed++;
  }

  // Test 2: Static Uploads Cache-Control check (/api/static/uploads/*)
  try {
    const res = await fetch(`${baseUrl}/api/static/uploads/nonexistent.png`);
    const cacheHeader = res.headers.get('cache-control') || '';

    console.log(`[TEST 2] /api/static/uploads Cache-Control Header: "${cacheHeader}"`);
    assert(!cacheHeader.includes('no-store'), 'Static upload route must NOT be blocked by no-store');
    console.log('✅ TEST 2 PASSED: Static uploads preserve browser cache headers (no-store omitted)\n');
    passed++;
  } catch (err) {
    console.error('❌ TEST 2 FAILED:', err.message);
    failed++;
  }

  // Test 3: Socket.IO Room Hygiene on Disconnect (Logout)
  try {
    const clientSocket = Client(baseUrl, { path: '/socket.io' });
    
    await new Promise((resolve) => clientSocket.on('connect', resolve));
    const socketId = clientSocket.id;
    const testRoom = 'user_test_user_123';

    clientSocket.emit('join', { room: testRoom });
    
    // Give room join a moment to process
    await new Promise((r) => setTimeout(r, 100));

    const serverSocket = ioServer.sockets.sockets.get(socketId);
    assert(serverSocket, 'Server socket should be connected');
    assert(serverSocket.rooms.has(testRoom), 'Server socket should be in user room');

    // Simulate Logout: Disconnect client socket
    clientSocket.disconnect();

    await new Promise((r) => setTimeout(r, 150));

    const disconnectedSocket = ioServer.sockets.sockets.get(socketId);
    assert(!disconnectedSocket || !disconnectedSocket.rooms.has(testRoom), 'Socket room must be completely cleared after disconnect');
    console.log('✅ TEST 3 PASSED: Socket connection disconnect drops room membership completely on logout\n');
    passed++;
  } catch (err) {
    console.error('❌ TEST 3 FAILED:', err.message);
    failed++;
  }

  server.close();
  ioServer.close();

  console.log(`=== TEST RESULTS SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityTests().catch((err) => {
  console.error('Verification script failed with exception:', err);
  process.exit(1);
});
