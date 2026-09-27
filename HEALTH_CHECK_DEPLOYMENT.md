# Supabase Health Check Deployment Guide

## Overview
This health check system uses a Supabase Edge Function with a cron job trigger to keep your Free Tier database active by running a lightweight query every 5 minutes.

## Files Created
- `supabase/functions/health-check/index.ts` - The Edge Function code
- `supabase/functions/health-check/config.toml` - Cron configuration
- `supabase/config.toml` - Main Supabase configuration

## Deployment Steps

### 1. Install Supabase CLI
```bash
npm install -g supabase
```

### 2. Login to Supabase
```bash
supabase login
```

### 3. Link Your Project
```bash
supabase link --project-id your-project-id
```
Replace `your-project-id` with your Supabase project ID (found in your dashboard URL).

### 4. Deploy the Edge Function
```bash
supabase functions deploy health-check
```

### 5. Verify Deployment
```bash
supabase functions list
```

## Cron Schedule Explained

Current schedule in `config.toml`:
```
cron = "*/5 * * * *"
```

This means:
- **Every 5 minutes** throughout the day
- **All hours** (24/7)
- **Every day of the month**
- **Every month**
- **Every day of the week**

### Alternative Schedules

**Every 10 minutes:**
```
cron = "*/10 * * * *"
```

**Every hour:**
```
cron = "0 * * * *"
```

**Every 30 minutes:**
```
cron = "*/30 * * * *"
```

**Every day at 2 AM:**
```
cron = "0 2 * * *"
```

## How It Works

1. **Cron trigger**: At the scheduled time, Supabase automatically invokes the Edge Function
2. **Database query**: The function runs a lightweight SELECT query on the `properties` table
3. **Keep-alive**: This activity keeps your Free Tier database from becoming inactive
4. **No external service needed**: No UptimeRobot or external monitoring required
5. **Automatic**: Runs without manual intervention

## Testing

### Test Locally
```bash
supabase functions serve health-check
```

Then in another terminal:
```bash
curl http://localhost:54321/functions/v1/health-check
```

### Expected Response
```json
{
  "status": "ok",
  "timestamp": "2026-06-16T10:30:45.123Z",
  "message": "Database connection verified"
}
```

### View Logs
```bash
supabase functions logs health-check
```

## Monitoring

### Check Function Status in Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to **Edge Functions**
3. Click on **health-check**
4. View execution logs and metrics

### Monitor Execution
The logs will show:
- Successful executions: `"status": "ok"`
- Failed executions: `"status": "error"` with error message
- Timestamp of each run

## Cost Implications

**Free Tier:**
- Edge Functions: 500,000 invocations/month (included)
- 1 execution every 5 minutes = 288 per day = ~8,640 per month ✅ **Within free limit**

## Troubleshooting

### Function Not Triggering
1. Verify cron configuration in `config.toml`
2. Check that function was deployed successfully: `supabase functions list`
3. View logs: `supabase functions logs health-check`

### Database Connection Error
1. Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set correctly
2. Ensure the `properties` table exists
3. Check database permissions

### Permission Denied
1. Ensure you're using the Service Role Key (not the Anon Key)
2. Verify the key has database access

## Updating the Schedule

To change the cron schedule:

1. Edit `supabase/functions/health-check/config.toml`
2. Update the `cron` value
3. Redeploy:
```bash
supabase functions deploy health-check
```

## No UptimeRobot Needed ✅

With this cron job approach:
- ✅ No external service required
- ✅ Completely automated
- ✅ Runs within Supabase infrastructure
- ✅ No additional cost
- ✅ Reliable scheduling
- ✅ Integrated logging

## Next Steps

1. Deploy the function using the steps above
2. Wait 5-10 minutes for the first execution
3. Check the logs to confirm it's working
4. Monitor periodically to ensure the database stays active

## Support

If you encounter issues:
1. Check Supabase Edge Functions documentation
2. View detailed logs in Supabase dashboard
3. Verify your project credentials