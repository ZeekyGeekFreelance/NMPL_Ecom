#!/usr/bin/env node

/**
 * Simple health check server for debugging production issues
 * This bypasses the full application startup and just provides basic health info
 */

const http = require('http');
const port = process.env.PORT || 5000;

const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'alive',
      message: 'Simple health check server running',
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
  console.log(`[simple-health] Server running on port ${port}`);
  console.log(`[simple-health] Health check available at http://localhost:${port}/health`);
});

server.on('error', (err) => {
  console.error('[simple-health] Server error:', err);
  process.exit(1);
});