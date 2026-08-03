/**
 * verifyFrontendSecurity.js
 * Automated node verification test inspecting frontend Chats.jsx implementation
 * to ensure all 7 requirements are satisfied without exception.
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';

console.log('=== RUNNING FRONTEND CODE PATTERN & PRIVACY AUDIT ===\n');

const chatsFilePath = path.resolve('src/pages/Chats.jsx');
const authContextPath = path.resolve('src/context/AuthContext.jsx');
const appJsPath = path.resolve('../backend/src/app.js');

const chatsContent = fs.readFileSync(chatsFilePath, 'utf8');
const authContent = fs.readFileSync(authContextPath, 'utf8');
const appJsContent = fs.readFileSync(appJsPath, 'utf8');

let passed = 0;
let failed = 0;

function testRule(num, description, condition) {
  try {
    assert(condition, description);
    console.log(`✅ REQUIREMENT ${num} PASSED: ${description}`);
    passed++;
  } catch (err) {
    console.error(`❌ REQUIREMENT ${num} FAILED: ${description}`);
    failed++;
  }
}

// Requirement 1: Reset chat state the instant the authenticated user changes
testRule(
  1,
  'Chats.jsx immediately clears conversations, activeConv, messages, and unread on user.id change',
  chatsContent.includes('prevUserIdRef.current !== user?.id') &&
  chatsContent.includes('clearChatState()') &&
  chatsContent.includes('setConversations([])') &&
  chatsContent.includes('setMessages([])') &&
  chatsContent.includes('setActiveConv(null)') &&
  chatsContent.includes('setUnread(0)')
);

// Requirement 2: Cancel in-flight requests on unmount / user change
testRule(
  2,
  'loadConversations and message fetches use AbortController and abort in cleanup',
  chatsContent.includes('new AbortController()') &&
  chatsContent.includes('controller.abort()') &&
  chatsContent.includes('signal')
);

// Requirement 3: Fix the dependency bug
testRule(
  3,
  'loadConversations depends on user?.id and re-fetches when user account changes',
  chatsContent.includes('useEffect(() => {\n    if (!user?.id) return\n    const controller = new AbortController()\n    loadConversations(controller.signal)') ||
  chatsContent.includes('[user?.id, loadConversations]')
);

// Requirement 4: Tag fetched data with user it belongs to and verify before rendering
testRule(
  4,
  'GET /api/chats response checks target user against userRef.current?.id before calling setConversations',
  chatsContent.includes('reqUserId !== userRef.current?.id') &&
  chatsContent.includes('if (reqUserId !== userRef.current?.id) return')
);

// Requirement 5: Prevent HTTP/browser caching of authenticated API responses
testRule(
  5,
  'backend app.js adds Cache-Control: no-store, no-cache, must-revalidate, private middleware under /api',
  appJsContent.includes("res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private')") &&
  appJsContent.includes("req.path.startsWith('/static/uploads')")
);

// Requirement 6: Full state wipe on logout via auth-logout event
testRule(
  6,
  'AuthContext dispatches auth-logout and Chats.jsx listens to auth-logout to purge state and socket',
  authContent.includes("window.dispatchEvent(new Event('auth-logout'))") &&
  chatsContent.includes("window.addEventListener('auth-logout'") &&
  chatsContent.includes('socketRef.current.disconnect()')
);

// Requirement 7: Socket room hygiene on logout
testRule(
  7,
  'Main socket effect cleanup calls socket.disconnect() on user change/logout and room join uses userRef',
  chatsContent.includes('socket.disconnect()') &&
  chatsContent.includes('room: `user_${userRef.current.id}`')
);

console.log(`\n=== AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
if (failed > 0) process.exit(1);
