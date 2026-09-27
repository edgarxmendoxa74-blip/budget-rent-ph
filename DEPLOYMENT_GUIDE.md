# Deployment Guide - Security Implementation

## 📋 Pre-Deployment Steps

### Step 1: Fix Security Vulnerabilities

You have 22 identified vulnerabilities in dependencies. Fix them:

```bash
cd "c:\Users\Administrator\budget rent app"

# Fix automatic vulnerabilities
npm audit fix

# For remaining issues, update specific packages
npm update @babel/core
npm update vite
npm update ws
npm update postcss
```

### Step 2: Verify Security Implementation

```bash
# Verify admin bypass is removed
findstr "admin=true" src\App.jsx  # Should return nothing
findstr "budgetrent_admin_bypass.*false.*true" src\App.jsx  # Should return nothing

# Check that new security files exist
dir src\lib\validation.js
dir src\lib\rateLimiter.js
dir src\lib\dataProtection.js
dir src\lib\secureApi.js

# Verify security headers in config
findstr "Strict-Transport-Security" vite.config.js
```

### Step 3: Test Locally

```bash
npm install
npm run dev
```

Test in browser:
- [ ] Login works
- [ ] Can see properties
- [ ] Non-admin cannot access admin page
- [ ] Try XSS in property title: `<script>alert('xss')</script>`
  - Should be sanitized (no alert)
- [ ] Check security headers:
  ```
  Open DevTools → Network → Response Headers
  Should see: Content-Security-Policy, X-Frame-Options, etc.
  ```

### Step 4: Deploy RLS Policies to Supabase

**Method 1: Using Supabase Dashboard**

1. Go to: https://app.supabase.com
2. Select your project
3. Go to: SQL Editor
4. Click: New Query
5. Copy entire contents of: `supabase/migrations/add_rls_policies.sql`
6. Paste into SQL Editor
7. Click: Run
8. Verify: Success message

**Method 2: Using Supabase CLI**

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login
supabase login

# Link your project
supabase link --project-id your-project-id

# Push migrations
supabase db push
```

**Verify RLS is Active:**

1. Go to Supabase Dashboard → Authentication → Users
2. Create test accounts (if needed)
3. Go to Table Editor → properties
4. Switch to different user accounts
5. Verify:
   - [ ] Users can only see verified properties or their own
   - [ ] Users cannot see other users' unverified properties

---

## 🚀 Production Deployment

### Using GitHub Actions (Recommended)

1. **Update `.github/workflows/build-apk.yml`**:

```yaml
- name: Install dependencies
  run: npm ci --legacy-peer-deps

- name: Audit dependencies
  run: npm audit --audit-level=moderate
```

2. **Push to production**:

```bash
git add -A
git commit -m "Security: Implement security hardening and RLS policies

- Fix critical admin bypass vulnerability
- Add input validation and sanitization
- Implement rate limiting
- Add secure data protection
- Enable Row Level Security (RLS)
- Add Content Security Policy headers
- Add HTTP security headers
- Create audit logging system"

git push origin main
```

### Manual Deployment

1. **Build the app**:
```bash
npm run build
```

2. **Test build**:
```bash
npm run preview
```

3. **Deploy to your hosting**:
   - Vercel: `vercel deploy --prod`
   - Netlify: `netlify deploy --prod`
   - Your server: Copy `dist/` contents

---

## 🔒 Post-Deployment Verification

### 1. Verify Security Headers

```bash
# Check each header is present
curl -I https://budgetrent.ph | findstr "Strict-Transport-Security"
curl -I https://budgetrent.ph | findstr "X-Content-Type-Options"
curl -I https://budgetrent.ph | findstr "X-Frame-Options"
curl -I https://budgetrent.ph | findstr "Content-Security-Policy"
```

### 2. Test Admin Access

1. Create test account (non-admin email)
2. Login with test account
3. Try to access: `https://budgetrent.ph/admin`
4. Should get login prompt or redirect ✅
5. Login as admin
6. Should access admin panel ✅

### 3. Test Input Validation

Create a property with malicious input:
- Title: `<script>alert('xss')</script>`
- Expected: Script tags removed
- Verify in database: Title should be clean

### 4. Verify RLS Policies

```sql
-- In Supabase SQL Editor, run:
SELECT * FROM properties;  
-- Should show only verified OR own properties ✅
```

### 5. Check Audit Logs

```sql
-- In Supabase SQL Editor, run:
SELECT * FROM property_audit_log 
ORDER BY created_at DESC LIMIT 10;
-- Should show recent property changes ✅
```

---

## 🆘 Troubleshooting Deployment

### Issue: RLS Policies Causing 403 Errors

**Solution**:
1. Verify policy syntax in SQL
2. Check user is authenticated
3. Verify policy includes correct conditions
4. Test with Supabase SQL Editor

### Issue: Admin Cannot Login

**Solution**:
1. Verify email is in isOwner check (src/App.jsx)
2. Verify admin account exists in Supabase
3. Verify email is exact match (case-sensitive check)

### Issue: CSP Blocking Resources

**Solution**:
1. Check browser console for CSP violations
2. Add allowed source to CSP policy
3. Update in `index.html` or `vite.config.js`

### Issue: Rate Limiting Too Strict

**Solution**:
1. Increase limits in `src/lib/rateLimiter.js`
2. Redeploy application

### Issue: Validation Too Strict

**Solution**:
1. Adjust validation rules in `src/lib/validation.js`
2. Allow more characters/formats as needed
3. Redeploy application

---

## 📊 Deployment Rollout Plan

### Phase 1: Staging (Day 1)
- [ ] Deploy to staging environment
- [ ] Run all security tests
- [ ] Get team approval

### Phase 2: Canary Deployment (Day 2)
- [ ] Deploy to 10% of users
- [ ] Monitor errors
- [ ] Check performance
- [ ] Verify no security issues

### Phase 3: Full Deployment (Day 3)
- [ ] Deploy to 100% of users
- [ ] Monitor closely
- [ ] Have rollback ready

### Phase 4: Monitoring (Day 4+)
- [ ] Monitor error logs
- [ ] Check rate limiting metrics
- [ ] Verify audit logs active
- [ ] Check user feedback

---

## 🔄 Rollback Plan

If issues occur during deployment:

```bash
# View deployment history
git log --oneline -10

# Rollback to previous version
git revert HEAD
git push origin main

# Or reset to specific commit
git reset --hard <commit-hash>
git push -f origin main
```

**Important**: Only force-push to production in emergencies. Normal rollback uses `git revert`.

---

## 📈 Post-Deployment Monitoring

### Monitor These Metrics (First 7 Days)

1. **Error Rate**: Should be <1%
2. **Page Load Time**: Should be <3s
3. **Auth Success Rate**: Should be >99%
4. **RLS Violations**: Watch for patterns
5. **Rate Limit Hits**: Should be <5% of requests
6. **Validation Errors**: Monitor for patterns

### Set Up Alerts

Configure alerts for:
- [ ] High error rate (>5%)
- [ ] Many RLS violations (>1% of queries)
- [ ] Performance degradation
- [ ] Unusual rate limiting

### Daily Checks (First Week)

- [ ] Check error logs
- [ ] Review audit logs
- [ ] Verify CSP headers active
- [ ] Check security metrics
- [ ] Monitor user complaints

---

## 📚 Documentation

Update your documentation with:

1. **Security Policy**
   - Create: `docs/SECURITY_POLICY.md`
   - Include: Reporting procedures, response times

2. **Admin Guide**
   - Create: `docs/ADMIN_GUIDE.md`
   - Include: How to access admin panel, what they can do

3. **User Guide Updates**
   - Update: Include 2FA info if enabled
   - Update: Include password requirements

---

## ✅ Final Pre-Launch Checklist

Before going live, verify:

- [ ] All vulnerabilities fixed (`npm audit` passes)
- [ ] Security tests pass locally
- [ ] RLS policies deployed to production
- [ ] Admin bypass closed
- [ ] CSP headers configured
- [ ] HTTPS enabled
- [ ] Backup strategy in place
- [ ] Monitoring configured
- [ ] Team trained on security
- [ ] Incident response plan ready

---

## 📞 Support During Deployment

**During deployment, have these ready:**

1. **Database backups** - Recent backup available
2. **Rollback plan** - Quick rollback procedure
3. **Support team** - Available to monitor
4. **Communication** - User notification ready
5. **Escalation contacts** - Emergency numbers

---

## 🎉 Launch Success Criteria

Deployment successful if:

- ✅ No critical errors in logs
- ✅ Admin bypass closed
- ✅ All users can login
- ✅ Properties display correctly
- ✅ Input validation working
- ✅ RLS policies active
- ✅ Security headers present
- ✅ Performance acceptable
- ✅ No user complaints

---

## 📋 Post-Launch Maintenance

### Day 1-7 After Launch
- Daily security reviews
- Monitor metrics closely
- Quick response to issues
- User feedback collection

### Week 2-4 After Launch
- Weekly security reviews
- Monitoring continues
- Team training on new features
- Documentation updates

### Monthly Ongoing
- Monthly security audit
- Dependency updates
- Performance reviews
- Feature planning

---

## 🎯 Success Metrics

After deployment, measure:

| Metric | Target | Current |
|--------|--------|---------|
| Error Rate | <1% | - |
| Page Load Time | <3s | - |
| Auth Success | >99% | - |
| Security Headers | 100% | - |
| RLS Active | 100% | - |
| Admin Bypass | 0 exploits | - |
| Input Validation | 100% | - |

---

## 📞 Post-Deployment Support

If issues arise after deployment:

1. **Immediate** (within 1 hour):
   - Identify the issue
   - Notify users if needed
   - Start fix/rollback

2. **Short-term** (within 24 hours):
   - Deploy fix or rollback
   - Verify resolution
   - Post-mortem analysis

3. **Follow-up** (within 1 week):
   - Full investigation
   - Preventive measures
   - Documentation

---

**Deployment Status**: ⏳ READY FOR LAUNCH  
**Last Updated**: June 27, 2026  
**Version**: 1.0.0
