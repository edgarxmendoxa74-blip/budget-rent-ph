# Email Verification Setup Guide - Budget Rent PH

## 🚨 Issue Identified

Your email verification is not working because Supabase needs to be configured to send verification emails. This guide fixes it.

---

## ✅ Step 1: Configure Supabase Auth Settings

### Go to Supabase Dashboard

1. Visit: https://app.supabase.com
2. Select your project: **budgetrent-ph**
3. Click: **Authentication** (left sidebar)
4. Click: **Providers**

### Step 2: Configure Email Settings

1. Click on **Email** provider (should be enabled by default)
2. Look for **Email Confirmation** section
3. Enable: **Enable email confirmations** ✅
   - Toggle should be ON (blue)

### Step 3: Set Email Redirect URL

1. Go: **Authentication** → **URL Configuration**
2. Under **Redirect URLs**, add your domain:

**For Local Development:**
```
http://localhost:5173
http://localhost:5173/
```

**For Production:**
```
https://budgetrent.ph
https://www.budgetrent.ph
https://budgetrent.ph/?verified=true
```

3. Click **Save**

### Step 4: Configure Email Templates (Optional but Recommended)

1. Go: **Authentication** → **Email Templates**
2. Click on **Confirm signup** template
3. Customize the email message (optional)
4. Make sure **{{ confirmation_url }}** is in the template
5. Click **Save**

---

## 🔧 Step 5: Update Your Environment Variables

Your `.env` file needs these variables:

```bash
VITE_SUPABASE_URL=https://utdarqyhkiexotouqjkz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

These should already be set. Verify they're correct by checking Supabase dashboard → Settings → API.

---

## 📧 How Email Verification Works Now

### User Flow:

1. **User Registers** (landlord signs up)
   ↓
2. **Supabase Sends Email** (verification link sent)
   ↓
3. **User Clicks Link** (from email)
   ↓
4. **Redirected to App** (with verification token in URL)
   ↓
5. **Email Confirmed** (account now verified)
   ↓
6. **User Can Login** (full access granted)

---

## 🧪 Step 6: Test Email Verification Locally

### Test 1: Sign Up and Check Email

1. Start dev server: `npm run dev`
2. Open: http://localhost:5173
3. Click: **"Enter as Landlord"**
4. Fill form and click: **"Gumawa ng Account"**
5. Check your email (check spam folder too)
6. You should receive an email from **no-reply@mail.supabase.io**

### Test 2: Verify the Email

1. Click the link in the email
2. You should be redirected to: http://localhost:5173/?verified=true
3. Check browser console for success message
4. Try to login with same email/password
5. Should work ✅

### Test 3: Check Supabase Dashboard

1. Go to: https://app.supabase.com
2. Click: **Authentication** → **Users**
3. Find your test user
4. Check: **Email Confirmed** column
5. Should show a ✅ check mark

---

## ❌ Troubleshooting

### Issue 1: Email Not Received

**Problem**: User signs up but doesn't get verification email

**Solution**:
1. Check email is enabled in Auth → Providers → Email
2. Check "Email confirmations" toggle is ON
3. Verify redirect URL is configured
4. Check spam/junk folder
5. Wait 1-2 minutes (emails take time)
6. Check Supabase logs: Auth → Logs

### Issue 2: Link Doesn't Work

**Problem**: Click link in email but doesn't verify

**Solution**:
1. Make sure redirect URL is configured in Auth → URL Configuration
2. Verify redirect URL matches your domain exactly
3. Check URL contains `?verified=true` parameter
4. Check browser console for errors
5. Try again with new email

### Issue 3: Users Can't Login After Verification

**Problem**: Email verified but can't sign in

**Solution**:
1. Check database doesn't have "Only verified users" rule
2. Verify password is correct
3. Check Supabase RLS policies aren't blocking
4. Try logout and login again
5. Check browser console for errors

### Issue 4: "Email already in use"

**Problem**: User tries to register with same email twice

**Solution**:
1. Use different email for testing
2. Delete previous test account in Supabase dashboard
3. Or reset account by deleting and re-creating

---

## 🔐 Security: Unconfirmed Email Handling

### Current Setup (RECOMMENDED)

Users can login immediately after signup, but cannot access restricted features until email is confirmed.

```javascript
// In App.jsx or components that need verified users:
const isEmailVerified = session?.user?.email_confirmed_at !== null;

if (!isEmailVerified) {
  // Show message or restrict features
  alert('Please verify your email to access this feature');
}
```

### Alternative: Force Email Verification Before Login

If you want users to ONLY login after verification:

In Supabase Auth → Policies:
- Enable: "Require email verification before signing in"

**Warning**: This prevents users from signing in until they verify. Users might forget or lose the email.

---

## 📨 Production Email Configuration

### For Production, Use Custom Email Service (Optional)

Current setup uses Supabase's default email provider (free but limited).

**For better reliability**, configure SendGrid or your own email service:

1. Go: **Authentication** → **Providers**
2. Scroll to bottom
3. Look for: **SMTP Configuration** or **Email Service**
4. Click: **Configure SMTP**
5. Add your email service credentials

**Popular Options:**
- SendGrid (reliable, free tier)
- AWS SES (cheap)
- Mailgun (developer-friendly)
- Your own SMTP server

---

## 📝 Code Changes Made

### Updated: `src/components/Auth.jsx`

**Before:**
```javascript
const { error } = await supabase.auth.signUp({...});
alert('Landlord Account Created! Please verify your email.');
```

**After:**
```javascript
const { data, error } = await supabase.auth.signUp({...});

if (data?.user?.email_confirmed_at === null && data?.user?.confirmation_sent_at) {
  alert('✅ Verification email sent! Please check your inbox.');
} else if (data?.user?.email_confirmed_at) {
  alert('✅ Account created and verified!');
} else {
  alert('✅ Account created! Please verify your email.');
}
```

**Improvement**: Better feedback messages about email verification status.

---

## ✅ Complete Checklist

### Supabase Configuration
- [ ] Email provider is enabled
- [ ] "Email confirmations" is ON
- [ ] Redirect URLs configured for your domain
- [ ] Email template has {{confirmation_url}}
- [ ] SMTP configured (optional for production)

### Code Setup
- [ ] Updated `src/components/Auth.jsx` ✅ (DONE)
- [ ] Environment variables are correct ✅
- [ ] Supabase client is initialized correctly ✅

### Testing
- [ ] Test signup locally
- [ ] Check email received
- [ ] Click link in email
- [ ] Verify redirect works
- [ ] Try login with verified email
- [ ] Check Supabase Users table shows email confirmed

### Production
- [ ] Test on staging environment
- [ ] Test with real email domain
- [ ] Monitor email delivery rate
- [ ] Have support email configured
- [ ] Document verification process for users

---

## 🔗 Useful URLs

**Supabase Console**: https://app.supabase.com  
**Your Project**: https://app.supabase.com/project/utdarqyhkiexotouqjkz/auth/users

---

## 📞 Still Having Issues?

### Check These Logs

1. **Supabase Logs**: Auth → Logs (see email sending attempts)
2. **Browser Console**: F12 → Console (see client-side errors)
3. **Email Service**: Check if emails are being sent
4. **Redirect URL**: Verify it's in the allow list

### Common Error Messages

| Error | Solution |
|-------|----------|
| "Invalid redirect URL" | Add URL to Auth → URL Configuration |
| "Email service not configured" | Go to Auth → Providers → Enable Email |
| "Email confirmation required" | Enable in Auth → Providers |
| "No confirmation_url in email" | Check email template has {{confirmation_url}} |

---

## 🚀 Next Steps

1. **Right Now**: Configure Supabase email settings (Steps 1-4 above)
2. **Next**: Test email verification locally
3. **Then**: Deploy to production
4. **Monitor**: Check email delivery rate and user verification rate

---

## 📊 Monitor Email Verification

After deployment, monitor:
- **Signup Rate**: How many users register
- **Email Delivery Rate**: % of emails successfully sent
- **Verification Rate**: % of users who verify email
- **Support Tickets**: Email verification issues

---

**Last Updated**: June 27, 2026  
**Status**: ✅ READY TO IMPLEMENT  
**Estimated Setup Time**: 5-10 minutes
