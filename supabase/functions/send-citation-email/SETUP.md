# send-citation-email — Setup Instructions

## What it does
Sends an HTML email to a citation violator via the Resend API.

## Deploy the function

```bash
# From the sheltertrace project root:
npx supabase functions deploy send-citation-email --no-verify-jwt
```

## Set the Resend API key

1. Sign up at https://resend.com (free tier: 3,000 emails/month)
2. Create an API key in the Resend dashboard
3. Add it as a Supabase secret:

```bash
npx supabase secrets set RESEND_API_KEY=re_your_api_key_here
```

## Configure the sender domain (required for production)

In the Resend dashboard, verify your domain (morgancountyanimalservices.gov or similar).
Until then, use Resend's test sender: `onboarding@resend.dev`

Update the FROM_EMAIL constant in index.ts:
```typescript
const FROM_EMAIL = "onboarding@resend.dev";  // testing
// const FROM_EMAIL = "citations@morgancountyanimalservices.gov";  // production
```

## What happens without RESEND_API_KEY

The function returns `{ success: false, error: "RESEND_API_KEY not configured" }`.
The UI catches this and shows: "Email service not configured. Use Print instead."
No crashes, no errors thrown — graceful fallback.

## Test the function

```bash
npx supabase functions serve send-citation-email --env-file .env.local
```

Then POST to http://localhost:54321/functions/v1/send-citation-email:
```json
{ "citation_id": "your-citation-uuid-here" }
```
