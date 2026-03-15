#!/usr/bin/env node

/**
 * Startup diagnostic script for production debugging
 * Run this to check if the server can start properly
 */

console.log('[diagnostic] Starting server diagnostic...');
console.log('[diagnostic] Node version:', process.version);
console.log('[diagnostic] Platform:', process.platform);
console.log('[diagnostic] CWD:', process.cwd());

// Load environment
require('./load-env.js');

console.log('[diagnostic] Environment loaded');
console.log('[diagnostic] NODE_ENV:', process.env.NODE_ENV);
console.log('[diagnostic] PORT:', process.env.PORT);
console.log('[diagnostic] DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
console.log('[diagnostic] REDIS_URL:', process.env.REDIS_URL ? 'SET' : 'NOT SET');

// Test basic imports
try {
  console.log('[diagnostic] Testing module-alias...');
  require('module-alias/register');
  console.log('[diagnostic] ✅ module-alias loaded');
} catch (error) {
  console.error('[diagnostic] ❌ module-alias failed:', error.message);
  process.exit(1);
}

try {
  console.log('[diagnostic] Testing config...');
  const { config } = require('../dist/config/index.js');
  console.log('[diagnostic] ✅ Config loaded');
  console.log('[diagnostic] Config nodeEnv:', config.nodeEnv);
  console.log('[diagnostic] Config port:', config.server.port);
} catch (error) {
  console.error('[diagnostic] ❌ Config failed:', error.message);
  process.exit(1);
}

try {
  console.log('[diagnostic] Testing database config...');
  const { connectDB } = require('../dist/infra/database/database.config.js');
  console.log('[diagnostic] ✅ Database config loaded');
} catch (error) {
  console.error('[diagnostic] ❌ Database config failed:', error.message);
  process.exit(1);
}

try {
  console.log('[diagnostic] Testing app creation...');
  const { createApp } = require('../dist/app.js');
  console.log('[diagnostic] ✅ App module loaded');
} catch (error) {
  console.error('[diagnostic] ❌ App creation failed:', error.message);
  console.error('[diagnostic] Stack trace:', error.stack);
  process.exit(1);
}

console.log('[diagnostic] ✅ All basic checks passed');
console.log('[diagnostic] Server should be able to start');