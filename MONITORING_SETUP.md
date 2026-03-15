# Production Monitoring Setup

## 🔍 Monitoring Stack

### 1. Application Performance Monitoring (APM)

#### Sentry Integration (Error Tracking)

```bash
# Install Sentry
cd src/server
npm install @sentry/node @sentry/tracing

cd ../client
npm install @sentry/nextjs
```

**Server Setup** (`src/server/src/monitoring/sentry.ts`):
```typescript
import * as Sentry from "@sentry/node";
import { config } from "@/config";

if (config.isProduction) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: config.nodeEnv,
    tracesSampleRate: 0.1,
    profilesSampleRate: 0.1,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app: require("../app") }),
    ],
  });
}

export default Sentry;
```

**Client Setup** (`src/client/sentry.client.config.js`):
```javascript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  debug: false,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
});
```

### 2. Uptime Monitoring

#### UptimeRobot Configuration

**Monitors to Create:**
- **Main Website**: `https://yourdomain.com` (HTTP, 5-minute intervals)
- **API Health**: `https://api.yourdomain.com/health` (HTTP, 5-minute intervals)
- **GraphQL**: `https://api.yourdomain.com/api/v1/graphql` (HTTP POST, 10-minute intervals)
- **Database**: Via health endpoint (included in API Health)

**Alert Channels:**
- Email notifications
- Slack webhook
- SMS (for critical alerts)

#### Pingdom Configuration (Alternative)

```javascript
// Health check endpoint enhancement
// src/server/src/routes/health.routes.ts

export const healthCheck = async (req: Request, res: Response) => {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    external_apis: await checkExternalAPIs(),
    disk_space: await checkDiskSpace(),
    memory: await checkMemory(),
  };

  const isHealthy = Object.values(checks).every(check => check.status === 'ok');
  
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks,
    version: process.env.npm_package_version,
  });
};
```

### 3. Log Aggregation

#### Papertrail Setup

```yaml
# docker-compose.prod.yml
services:
  server:
    logging:
      driver: syslog
      options:
        syslog-address: "udp://logs.papertrailapp.com:YOUR_PORT"
        tag: "nmpl-server"
  
  client:
    logging:
      driver: syslog
      options:
        syslog-address: "udp://logs.papertrailapp.com:YOUR_PORT"
        tag: "nmpl-client"
```

#### CloudWatch Logs (AWS)

```bash
# Install CloudWatch agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i amazon-cloudwatch-agent.deb

# Configure log groups
aws logs create-log-group --log-group-name /nmpl/server
aws logs create-log-group --log-group-name /nmpl/client
```

### 4. Performance Monitoring

#### New Relic Integration

```bash
# Install New Relic
cd src/server
npm install newrelic

# Create newrelic.js config
cp node_modules/newrelic/newrelic.js ./
```

**Configuration** (`src/server/newrelic.js`):
```javascript
exports.config = {
  app_name: ['NMPL Ecommerce API'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY,
  logging: {
    level: 'info'
  },
  allow_all_headers: true,
  attributes: {
    exclude: [
      'request.headers.cookie',
      'request.headers.authorization',
      'request.headers.proxyAuthorization',
      'request.headers.setCookie*',
      'request.headers.x*',
      'response.headers.cookie',
      'response.headers.authorization',
      'response.headers.proxyAuthorization',
      'response.headers.setCookie*',
      'response.headers.x*'
    ]
  }
};
```

### 5. Database Monitoring

#### Neon Dashboard Monitoring
- Connection pool usage
- Query performance
- Storage usage
- Backup status

#### Custom Database Metrics

```typescript
// src/server/src/monitoring/database.ts
import prisma from "@/infra/database/database.config";

export const getDatabaseMetrics = async () => {
  const [
    userCount,
    productCount,
    orderCount,
    activeConnections
  ] = await Promise.all([
    prisma.user.count(),
    prisma.product.count(),
    prisma.order.count(),
    prisma.$queryRaw`SELECT count(*) FROM pg_stat_activity WHERE state = 'active'`
  ]);

  return {
    users: userCount,
    products: productCount,
    orders: orderCount,
    active_connections: activeConnections[0].count,
    timestamp: new Date().toISOString()
  };
};
```

### 6. Business Metrics Dashboard

#### Grafana + Prometheus Setup

**Docker Compose Addition**:
```yaml
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-storage:/var/lib/grafana
```

**Key Metrics to Track**:
- Daily/Monthly Active Users
- Order conversion rate
- Average order value
- Payment success rate
- API response times
- Error rates by endpoint
- Database query performance

### 7. Security Monitoring

#### Fail2Ban Configuration

```bash
# Install Fail2Ban
sudo apt install fail2ban

# Configure for NMPL
sudo nano /etc/fail2ban/jail.local
```

```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[nmpl-auth]
enabled = true
port = http,https
filter = nmpl-auth
logpath = /var/log/nmpl/auth.log
maxretry = 3
bantime = 7200

[nmpl-api]
enabled = true
port = http,https
filter = nmpl-api
logpath = /var/log/nmpl/api.log
maxretry = 10
bantime = 1800
```

#### Rate Limiting Alerts

```typescript
// src/server/src/monitoring/security.ts
export const trackSecurityEvent = (event: SecurityEvent) => {
  // Log to security log
  securityLogger.warn('Security event detected', {
    type: event.type,
    ip: event.ip,
    userAgent: event.userAgent,
    timestamp: new Date().toISOString()
  });

  // Send to Sentry for critical events
  if (event.severity === 'critical') {
    Sentry.captureException(new Error(`Security event: ${event.type}`), {
      tags: { security: true },
      extra: event
    });
  }

  // Trigger alert for multiple failed attempts
  if (event.type === 'failed_login' && event.count > 5) {
    sendSlackAlert(`🚨 Multiple failed login attempts from ${event.ip}`);
  }
};
```

### 8. Alert Configuration

#### Slack Webhook Integration

```typescript
// src/server/src/monitoring/alerts.ts
export const sendSlackAlert = async (message: string, severity: 'info' | 'warning' | 'critical' = 'info') => {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) return;

  const colors = {
    info: '#36a64f',
    warning: '#ff9500',
    critical: '#ff0000'
  };

  await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attachments: [{
        color: colors[severity],
        title: `NMPL Ecommerce Alert - ${severity.toUpperCase()}`,
        text: message,
        timestamp: Math.floor(Date.now() / 1000)
      }]
    })
  });
};
```

#### Email Alerts

```typescript
// src/server/src/monitoring/email-alerts.ts
export const sendEmailAlert = async (subject: string, message: string) => {
  const transporter = nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: process.env.ALERT_EMAIL_RECIPIENTS,
    subject: `[NMPL Alert] ${subject}`,
    html: `
      <h2>NMPL Ecommerce Alert</h2>
      <p><strong>Time:</strong> ${new Date().toISOString()}</p>
      <p><strong>Message:</strong> ${message}</p>
      <p><strong>Environment:</strong> ${process.env.NODE_ENV}</p>
    `
  });
};
```

### 9. Monitoring Checklist

#### Daily Monitoring Tasks
- [ ] Check error rates in Sentry
- [ ] Review API response times
- [ ] Monitor database performance
- [ ] Check payment success rates
- [ ] Review security logs
- [ ] Verify backup completion

#### Weekly Monitoring Tasks
- [ ] Analyze user growth trends
- [ ] Review conversion funnel
- [ ] Check infrastructure costs
- [ ] Update security patches
- [ ] Review alert thresholds
- [ ] Test disaster recovery

#### Monthly Monitoring Tasks
- [ ] Performance optimization review
- [ ] Security audit
- [ ] Capacity planning
- [ ] Cost optimization
- [ ] Update monitoring tools
- [ ] Review and update runbooks

### 10. Incident Response Runbook

#### High Error Rate (>5%)
1. Check Sentry for error patterns
2. Review recent deployments
3. Check database connectivity
4. Verify third-party service status
5. Scale resources if needed
6. Rollback if necessary

#### Database Issues
1. Check connection pool usage
2. Review slow query log
3. Monitor disk space
4. Check backup status
5. Contact Neon support if needed

#### Payment Failures
1. Check Razorpay/Stripe dashboard
2. Review payment logs
3. Test payment flow manually
4. Check webhook endpoints
5. Contact payment provider

#### Security Incidents
1. Identify attack vector
2. Block malicious IPs
3. Review access logs
4. Check for data breaches
5. Notify stakeholders
6. Document incident

### 11. Environment Variables for Monitoring

```env
# Monitoring & Alerting
SENTRY_DSN=https://your-sentry-dsn
NEW_RELIC_LICENSE_KEY=your-new-relic-key
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/your/webhook/url
ALERT_EMAIL_RECIPIENTS=admin@yourdomain.com,ops@yourdomain.com

# Monitoring Thresholds
ERROR_RATE_THRESHOLD=5
RESPONSE_TIME_THRESHOLD=2000
MEMORY_THRESHOLD=80
CPU_THRESHOLD=80
DISK_THRESHOLD=85
```

### 12. Monitoring Dashboard URLs

Once set up, bookmark these URLs:

- **Sentry**: https://sentry.io/organizations/your-org/projects/
- **UptimeRobot**: https://uptimerobot.com/dashboard
- **New Relic**: https://one.newrelic.com
- **Grafana**: https://your-domain.com:3001
- **Neon Dashboard**: https://console.neon.tech
- **Railway Dashboard**: https://railway.app/dashboard
- **Vercel Dashboard**: https://vercel.com/dashboard

This monitoring setup provides comprehensive visibility into your production environment and enables proactive issue resolution.