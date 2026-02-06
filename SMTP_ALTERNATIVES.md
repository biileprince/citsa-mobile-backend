# Alternative SMTP Providers for CITSA Backend

The current SMTP server (`smtp.citsaucc.org`) is experiencing timeout issues on Render. Here are reliable alternatives:

## Option 1: Gmail (Recommended - Free & Reliable)

### Setup Steps:
1. Go to your Google Account: https://myaccount.google.com/
2. Enable 2-Step Verification
3. Go to App Passwords: https://myaccount.google.com/apppasswords
4. Generate app password for "Mail"
5. Use the 16-character password in your Render environment variables

### Environment Variables:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-gmail@gmail.com
SMTP_PASSWORD=your-16-char-app-password
SMTP_FROM_NAME=CITSA UCC
SMTP_FROM_EMAIL=your-gmail@gmail.com
```

**Limits:** 500 emails/day (more than enough for student app)

## Option 2: Brevo (formerly Sendinblue) - Free Tier

### Setup Steps:
1. Sign up: https://app.brevo.com/
2. Go to SMTP & API
3. Create SMTP key
4. Use provided credentials

### Environment Variables:
```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-smtp-key
SMTP_FROM_NAME=CITSA UCC
SMTP_FROM_EMAIL=verified-email@citsaucc.org
```

**Limits:** 300 emails/day (free tier)

## Option 3: Resend (Modern, Developer-Friendly)

### Setup Steps:
1. Sign up: https://resend.com/
2. Verify your domain or use onboarding domain
3. Create API key
4. Use their Node.js SDK or SMTP

### Environment Variables:
```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=resend
SMTP_PASSWORD=re_your_api_key_here
SMTP_FROM_NAME=CITSA UCC
SMTP_FROM_EMAIL=onboarding@resend.dev
```

**Limits:** 100 emails/day (free tier), 3,000/month

## Option 4: Mailtrap (Testing) + SMTP2GO (Production)

### For Development/Testing (Mailtrap):
Catches all emails without sending them.

```env
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_SECURE=false
SMTP_USER=your-mailtrap-username
SMTP_PASSWORD=your-mailtrap-password
```

### For Production (SMTP2GO):
1. Sign up: https://www.smtp2go.com/
2. Verify sending domain
3. Create SMTP user

```env
SMTP_HOST=mail.smtp2go.com
SMTP_PORT=2525
SMTP_SECURE=false
SMTP_USER=your-smtp2go-username
SMTP_PASSWORD=your-smtp2go-password
```

**Limits:** 1,000 emails/month (free tier)

## How to Update SMTP Settings on Render

1. Go to your Render dashboard: https://dashboard.render.com/
2. Select your `citsa-mobile-backend` service
3. Go to "Environment" tab
4. Update these variables:
   - `SMTP_HOST`
   - `SMTP_PORT`
   - `SMTP_SECURE`
   - `SMTP_USER`
   - `SMTP_PASSWORD`
   - `SMTP_FROM_EMAIL` (if changing)
5. Click "Save Changes"
6. Render will automatically redeploy with new settings

## Testing After Update

```bash
# Test sending OTP
curl -X POST https://citsa-mobile-backend.onrender.com/api/v1/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"studentId":"PS/ITC/22/0001"}'

# Check your email inbox for OTP
```

## Recommendation for CITSA

**Best option:** Gmail SMTP
- ✅ Free forever
- ✅ 500 emails/day (plenty for student app)
- ✅ Extremely reliable
- ✅ No domain verification needed
- ✅ Setup in 5 minutes

**If you want branded emails (@citsaucc.org):**
Use Brevo or Resend and verify your domain. This requires:
- Adding DNS TXT records
- Verifying domain ownership
- Takes 1-2 hours to set up

## Current Issue with smtp.citsaucc.org

The server at `smtp.citsaucc.org:465` is:
- Timing out after 60 seconds
- Possibly behind a firewall blocking Render's IP ranges
- May require VPN or specific IP whitelisting

To continue using it, you'd need to:
1. Contact citsaucc.org IT support
2. Whitelist Render's IP ranges
3. Or use port 587 with STARTTLS instead of 465
