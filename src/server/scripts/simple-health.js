#!/usr/bin/env node

/**
 * Diagnostic fallback server for manual debugging only.
 * This must never present itself as a healthy production API.
 */

const http = require('http');
const port = process.env.PORT || 5000;

const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'diagnostic_fallback',
      message: 'Diagnostic fallback server running; the main API failed to boot.',
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      env: {
        NODE_ENV: process.env.NODE_ENV || 'not set',
        PORT: process.env.PORT || 'not set',
        DATABASE_URL: process.env.DATABASE_URL ? 'set' : 'not set',
        REDIS_URL: process.env.REDIS_URL ? 'set' : 'not set'
      }
    }, null, 2));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(port, () => {
  console.log(`[simple-health] Diagnostic server running on port ${port}`);
  console.log(
    `[simple-health] This endpoint intentionally returns 503 so it cannot masquerade as a healthy production API.`
  );
});

server.on('error', (err) => {
  console.error('[simple-health] Server error:', err);
  process.exit(1);
});
