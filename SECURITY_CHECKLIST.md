# Security Audit Checklist

## 🔴 CRITICAL (Must Fix Before Production)

### Authentication & Authorization
- [ ] All JWT secrets are cryptographically secure (64+ bytes)
- [ ] Session secrets are unique and secure
- [ ] Cookie secrets are unique and secure
- [ ] Passwords are hashed with bcrypt (cost factor >= 10)
- [ ] No default/test credentials in production
- [ ] Password reset tokens expire within 1 hour
- [ ] OTP codes expire within 10 minutes
- [ ] Failed login attempts are rate-limited
- [ ] Account lockout after 5 failed attempts

### Database Security
- [ ] Database credentials are not in source code
- [ ] SSL/TLS required for all database connections
- [ ] Database user has minimum required permissions
- [ ] Prepared statements used (Prisma handles this)
- [ ] No SQL injection vulnerabilities
- [ ] Database backups are encrypted
- [ ] Connection pooling configured properly
- [ ] Database firewall rules restrict access

### API Security
- [ ] HTTPS enforced for all endpoints
- [ ] CORS configured with specific origins (no wildcards)
- [ ] CSRF protection enabled for state-changing operations
- [ ] Rate limiting enabled on all endpoints
- [ ] Request size limits configured
- [ ] GraphQL query depth limiting enabled
- [ ] GraphQL query complexity limiting enabled
- [ ] No sensitive data in error messages
- [ ] API versioning implemented

### Secrets Management
- [ ] No secrets in source code
- [ ] No secrets in git history
- [ ] Environment variables used for all secrets
- [ ] Secrets rotated regularly
- [ ] Access to secrets is logged
- [ ] Secrets are encrypted at rest
- [ ] Different secrets for dev/staging/production

### Third-Party Services
- [ ] Payment gateway in live mode (not test)
- [ ] Email service configured with SPF/DKIM
- [ ] SMS provider configured with proper credentials
- [ ] OAuth providers use production credentials
- [ ] Cloudinary API keys are production keys
- [ ] All API keys have IP restrictions (where possible)

---

## 🟡 HIGH PRIORITY (Should Fix)

### Input Validation
- [ ] All user inputs validated on server-side
- [ ] File upload size limits enforced
- [ ] File upload type restrictions enforced
- [ ] Email addresses validated
- [ ] Phone numbers validated
- [ ] XSS protection enabled
- [ ] HTML sanitization for user content
- [ ] Path traversal prevention

### Session Management
- [ ] Sessions expire after inactivity
- [ ] Secure flag set on cookies (HTTPS only)
- [ ] HttpOnly flag set on sensitive cookies
- [ ] SameSite attribute configured
- [ ] Session fixation prevention
- [ ] Concurrent session limits
- [ ] Session invalidation on logout
- [ ] Session invalidation on password change

### Headers & Security Policies
- [ ] Strict-Transport-Security header set
- [ ] X-Frame-Options header set (DENY)
- [ ] X-Content-Type-Options header set (nosniff)
- [ ] X-XSS-Protection header set
- [ ] Content-Security-Policy configured
- [ ] Referrer-Policy configured
- [ ] Permissions-Policy configured
- [ ] Server header removed/obscured

### Logging & Monitoring
- [ ] Authentication events logged
- [ ] Authorization failures logged
- [ ] Payment transactions logged
- [ ] Admin actions logged
- [ ] Error logs don't contain sensitive data
- [ ] Logs are centralized
- [ ] Log retention policy defined
- [ ] Alerts configured for suspicious activity

### Data Protection
- [ ] PII is encrypted at rest
- [ ] PII is encrypted in transit
- [ ] Credit card data is not stored (PCI-DSS)
- [ ] Data retention policy implemented
- [ ] GDPR compliance (if applicable)
- [ ] Right to deletion implemented
- [ ] Data export functionality available
- [ ] Privacy policy published

---

## 🟢 RECOMMENDED (Best Practices)

### Infrastructure
- [ ] Firewall configured
- [ ] Intrusion detection system enabled
- [ ] DDoS protection enabled
- [ ] Load balancer configured
- [ ] Auto-scaling configured
- [ ] Health checks configured
- [ ] Graceful shutdown implemented
- [ ] Zero-downtime deployments

### Code Security
- [ ] Dependencies are up to date
- [ ] No known vulnerabilities (npm audit)
- [ ] Code review process in place
- [ ] Security testing in CI/CD
- [ ] Static code analysis enabled
- [ ] Dependency scanning enabled
- [ ] Container scanning enabled (if using Docker)
- [ ] Secrets scanning enabled

### Access Control
- [ ] Principle of least privilege applied
- [ ] Role-based access control (RBAC) implemented
- [ ] Admin panel has additional authentication
- [ ] Service accounts have minimal permissions
- [ ] SSH key-based authentication only
- [ ] Multi-factor authentication for admins
- [ ] IP whitelisting for admin access
- [ ] Audit trail for privileged actions

### Backup & Recovery
- [ ] Automated daily backups
- [ ] Backups stored in different region
- [ ] Backup restoration tested
- [ ] Disaster recovery plan documented
- [ ] RTO (Recovery Time Objective) defined
- [ ] RPO (Recovery Point Objective) defined
- [ ] Backup encryption enabled
- [ ] Backup access is restricted

### Compliance
- [ ] Terms of Service published
- [ ] Privacy Policy published
- [ ] Cookie Policy published
- [ ] GDPR compliance (EU users)
- [ ] CCPA compliance (California users)
- [ ] PCI-DSS compliance (payment processing)
- [ ] Data processing agreements signed
- [ ] Security incident response plan

---

## 🔍 Security Testing

### Automated Tests
```bash
# 1. Dependency vulnerabilities
npm audit
npm audit fix

# 2. OWASP dependency check
npm install -g retire
retire --path src/server

# 3. Static code analysis
npm install -g eslint-plugin-security
eslint --plugin security src/server/src

# 4. Secrets scanning
npm install -g trufflehog
trufflehog filesystem . --json

# 5. Container scanning (if using Docker)
docker scan nmpl-server:latest
```

### Manual Tests

#### 1. Authentication Bypass
- [ ] Try accessing protected routes without token
- [ ] Try using expired tokens
- [ ] Try using tokens from different users
- [ ] Try SQL injection in login form
- [ ] Try brute force attacks (should be rate-limited)

#### 2. Authorization Bypass
- [ ] Try accessing admin endpoints as regular user
- [ ] Try modifying other users' data
- [ ] Try accessing other users' orders
- [ ] Try privilege escalation

#### 3. Input Validation
- [ ] Try XSS payloads in all input fields
- [ ] Try SQL injection in all input fields
- [ ] Try path traversal in file uploads
- [ ] Try uploading malicious files
- [ ] Try extremely large inputs

#### 4. Session Management
- [ ] Try session fixation attacks
- [ ] Try CSRF attacks (should be blocked)
- [ ] Try session hijacking
- [ ] Verify session expires after logout

#### 5. API Security
- [ ] Try GraphQL introspection in production
- [ ] Try deeply nested GraphQL queries
- [ ] Try batch GraphQL queries (DoS)
- [ ] Try accessing API without CORS headers

---

## 🛠️ Security Tools

### Recommended Tools

1. **OWASP ZAP** - Web application security scanner
   ```bash
   docker run -t owasp/zap2docker-stable zap-baseline.py -t https://yourdomain.com
   ```

2. **Burp Suite** - Manual security testing
   - Download: https://portswigger.net/burp

3. **Nmap** - Network security scanner
   ```bash
   nmap -sV -sC yourdomain.com
   ```

4. **SSL Labs** - SSL/TLS configuration test
   - Test: https://www.ssllabs.com/ssltest/

5. **Security Headers** - HTTP security headers test
   - Test: https://securityheaders.com

---

## 📋 Pre-Launch Security Checklist

### Week Before Launch
- [ ] Run full security audit
- [ ] Fix all critical vulnerabilities
- [ ] Update all dependencies
- [ ] Review all environment variables
- [ ] Test backup restoration
- [ ] Review access controls
- [ ] Update security documentation

### Day Before Launch
- [ ] Run automated security tests
- [ ] Verify SSL certificates
- [ ] Test rate limiting
- [ ] Verify CORS configuration
- [ ] Check error handling
- [ ] Review logs for anomalies
- [ ] Notify security team

### Launch Day
- [ ] Monitor authentication attempts
- [ ] Monitor error rates
- [ ] Monitor API usage
- [ ] Check for unusual traffic patterns
- [ ] Verify all security headers
- [ ] Test critical user flows
- [ ] Have rollback plan ready

### Post-Launch (First Week)
- [ ] Daily security log review
- [ ] Monitor for brute force attempts
- [ ] Check for SQL injection attempts
- [ ] Review failed authentication logs
- [ ] Monitor API rate limit hits
- [ ] Check for unusual data access patterns
- [ ] Verify backup completion

---

## 🚨 Incident Response Plan

### Detection
1. Monitor logs for suspicious activity
2. Set up alerts for:
   - Multiple failed login attempts
   - Unusual API usage patterns
   - Database errors
   - High error rates
   - Unauthorized access attempts

### Response
1. **Identify** the security incident
2. **Contain** the threat (block IPs, disable accounts)
3. **Eradicate** the vulnerability
4. **Recover** normal operations
5. **Document** the incident
6. **Review** and improve security

### Contacts
- Security Team Lead: [email]
- DevOps Lead: [email]
- Legal Team: [email]
- PR Team: [email]

---

## 📚 Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [PCI-DSS Requirements](https://www.pcisecuritystandards.org/)
- [GDPR Compliance](https://gdpr.eu/)

---

## ✅ Sign-Off

**Security Audit Completed By:** ___________________

**Date:** ___________________

**Critical Issues Found:** ___________________

**All Critical Issues Resolved:** [ ] Yes [ ] No

**Approved for Production:** [ ] Yes [ ] No

**Approver Signature:** ___________________
