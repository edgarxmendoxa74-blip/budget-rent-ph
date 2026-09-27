# Security Audit Checklist - Budget Rent PH

## 🔍 Pre-Deployment Security Audit

Run through this checklist before deploying to production.

---

## 1. Authentication & Authorization

- [ ] Admin bypass vulnerability removed
  - [ ] No `?admin=true` URL parameter
  - [ ] No localStorage admin toggle
  - [ ] Admin check only uses authenticated email

- [ ] Password requirements configured
  - [ ] Min 8 characters
  - [ ] Uppercase & lowercase required
  - [ ] Numbers required
  - [ ] Special characters required

- [ ] Session management
  - [ ] JWT expiry set to 1 hour
  - [ ] Refresh token rotation enabled
  - [ ] Session cleared on logout
  - [ ] Expired sessions handled gracefully

- [ ] 2FA setup (optional but recommended)
  - [ ] Enable for admin accounts
  - [ ] Document 2FA recovery procedures

---

## 2. Input Validation

- [ ] All user inputs validated
  - [ ] Property titles (3-200 chars)
  - [ ] Prices (₱100-₱999,999)
  - [ ] Locations (3-200 chars)
  - [ ] Email addresses (valid format)
  - [ ] Phone numbers (Philippines format)
  - [ ] Search queries (max 100 chars)

- [ ] XSS prevention
  - [ ] Special characters stripped
  - [ ] HTML tags removed
  - [ ] String length limits enforced
  - [ ] CSP headers configured

- [ ] SQL injection prevention
  - [ ] Parameterized queries used
  - [ ] No raw SQL concatenation
  - [ ] Supabase client library used correctly

---

## 3. Data Protection

- [ ] Sensitive data handling
  - [ ] No passwords in localStorage
  - [ ] No API keys exposed in frontend
  - [ ] No personal data in logs
  - [ ] Credentials only in .env

- [ ] HTTPS enforcement
  - [ ] HTTPS-only certificate
  - [ ] HSTS header set
  - [ ] Redirect HTTP → HTTPS
  - [ ] All external resources over HTTPS

- [ ] Data encryption
  - [ ] Database connections encrypted
  - [ ] API calls over HTTPS
  - [ ] Supabase connection secure

---

## 4. Database Security

- [ ] Row Level Security (RLS)
  - [ ] Enabled on properties table
  - [ ] Enabled on verification_requests table
  - [ ] SELECT policy: verified OR own properties
  - [ ] INSERT policy: user_id must match auth.uid()
  - [ ] UPDATE policy: only own properties
  - [ ] DELETE policy: only own properties

- [ ] Audit logging
  - [ ] property_audit_log table created
  - [ ] Trigger logs all CREATE/UPDATE/DELETE
  - [ ] User tracking enabled
  - [ ] Timestamp recorded

- [ ] Database indexes
  - [ ] Index on properties.user_id
  - [ ] Index on properties.is_verified
  - [ ] Index on verification_requests.user_id

---

## 5. API Security

- [ ] Rate limiting
  - [ ] API: 10 requests/minute
  - [ ] Auth: 5 attempts/15 minutes
  - [ ] Search: 30 searches/minute
  - [ ] Submit: 3 submissions/minute

- [ ] CORS policy
  - [ ] Supabase CORS configured
  - [ ] Only allowed origins
  - [ ] Credentials handling correct

- [ ] Error handling
  - [ ] Generic error messages (no info leakage)
  - [ ] Errors logged securely
  - [ ] Stack traces not exposed

---

## 6. Frontend Security

- [ ] Content Security Policy (CSP)
  - [ ] default-src 'self'
  - [ ] script-src 'self' 'wasm-unsafe-eval'
  - [ ] style-src 'self' 'unsafe-inline'
  - [ ] img-src 'self' data: https:
  - [ ] connect-src limited to Supabase

- [ ] Security headers
  - [ ] X-Content-Type-Options: nosniff
  - [ ] X-Frame-Options: DENY
  - [ ] X-XSS-Protection: 1; mode=block
  - [ ] Strict-Transport-Security set

- [ ] Dependencies
  - [ ] npm audit passes
  - [ ] No known vulnerabilities
  - [ ] Packages are maintained
  - [ ] Versions pinned (not wildcards)

---

## 7. File Uploads (if applicable)

- [ ] Image validation
  - [ ] Only image formats allowed (.jpg, .png, .webp, .gif)
  - [ ] HTTPS URLs only
  - [ ] File size limits enforced
  - [ ] Filename sanitized

- [ ] Storage security
  - [ ] Supabase Storage used
  - [ ] RLS policies on storage
  - [ ] Public/private buckets configured correctly

---

## 8. Third-Party Integrations

- [ ] Supabase
  - [ ] Anon key used in frontend
  - [ ] Service key never exposed
  - [ ] API keys in environment variables
  - [ ] Keys never committed to git

- [ ] External services
  - [ ] API keys secured
  - [ ] Rate limits respected
  - [ ] Error handling implemented

---

## 9. Environment & Configuration

- [ ] Environment files
  - [ ] .env.local not committed
  - [ ] .env.example documented
  - [ ] No secrets in git history
  - [ ] Git pre-commit hooks configured

- [ ] Build process
  - [ ] Production build optimized
  - [ ] Source maps excluded from production
  - [ ] Unused code removed
  - [ ] Dependencies minimized

---

## 10. Monitoring & Logging

- [ ] Error tracking
  - [ ] Errors logged securely
  - [ ] No sensitive data logged
  - [ ] Error frequency monitored

- [ ] User activity
  - [ ] Login/logout tracked
  - [ ] Failed auth attempts tracked
  - [ ] Suspicious activity alerts

- [ ] Performance monitoring
  - [ ] Response times monitored
  - [ ] Rate limiting triggered alerts
  - [ ] Database query performance checked

---

## 11. Documentation

- [ ] Security documentation
  - [ ] SECURITY_IMPLEMENTATION.md completed
  - [ ] Incident response plan created
  - [ ] Team trained on security practices
  - [ ] Emergency contacts documented

- [ ] Code comments
  - [ ] Security-critical code documented
  - [ ] Known limitations noted
  - [ ] Future improvements listed

---

## 12. Testing

- [ ] Manual testing
  - [ ] Test with invalid inputs
  - [ ] Test XSS payloads (e.g., `<script>alert('xss')</script>`)
  - [ ] Test SQL injection attempts
  - [ ] Test rate limiting

- [ ] Automated testing
  - [ ] Security linter configured
  - [ ] Dependency scanning enabled
  - [ ] CI/CD pipeline includes security checks

---

## 13. Deployment

- [ ] Pre-deployment
  - [ ] Backup database
  - [ ] Test deployment process
  - [ ] Rollback plan prepared
  - [ ] Team notified of deployment

- [ ] Post-deployment
  - [ ] Monitor error logs
  - [ ] Check security headers
  - [ ] Verify RLS policies active
  - [ ] Test critical flows

---

## 14. Ongoing Maintenance

- [ ] Regular updates
  - [ ] npm audit run weekly
  - [ ] Dependencies updated monthly
  - [ ] Security patches applied immediately
  - [ ] Breaking changes tested

- [ ] Regular audits
  - [ ] Security review quarterly
  - [ ] Penetration testing annually
  - [ ] Access control audit quarterly
  - [ ] Dependency audit monthly

---

## 15. Admin Account Security

- [ ] Admin emails
  - [ ] Limited to authorized users only
  - [ ] Current: admin@budgetrent.ph, mendozajakong@gmail.com
  - [ ] Document why each admin is needed
  - [ ] Review quarterly

- [ ] Admin privileges
  - [ ] Only needed admins have access
  - [ ] Can view/delete any property
  - [ ] Can view user information
  - [ ] Cannot bypass RLS directly

---

## 🎯 Quick Verification Commands

```bash
# Check dependencies for vulnerabilities
npm audit

# Check for hardcoded secrets
grep -r "VITE_" .env*

# Check git history for secrets
git log --all --full-history -- .env

# Verify no admin bypass in code
grep -r "admin_bypass" src/

# Check security headers are in config
grep -r "Strict-Transport-Security" vite.config.js

# Verify RLS migration exists
ls -la supabase/migrations/add_rls_policies.sql
```

---

## ✅ Sign-Off Checklist

Before deploying to production, verify:

- [ ] All security items above reviewed
- [ ] Admin confirms no known vulnerabilities
- [ ] Team trained on security practices
- [ ] Incident response plan in place
- [ ] Monitoring configured
- [ ] Backups working
- [ ] Rollback plan documented

**Deployment approved by**: _________________ **Date**: _________

---

## 📞 Security Incident Response

If a security issue is discovered:

1. **Immediately**: Take affected system offline if critical
2. **Within 1 hour**: Notify affected users
3. **Within 4 hours**: Implement fix
4. **Within 24 hours**: Post-mortem analysis
5. **Follow-up**: Implement preventive measures

**Emergency Contact**: [Your security contact info]

---

## 📊 Security Metrics

Track these metrics monthly:

- Number of failed login attempts
- Rate limit violations
- Validation errors
- Audit log entries
- Security patches applied
- Vulnerability scans run

---

## 🔗 Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/security)
- [MDN Security](https://developer.mozilla.org/en-US/docs/Web/Security)
- [npm Audit](https://docs.npmjs.com/cli/v8/commands/npm-audit)
