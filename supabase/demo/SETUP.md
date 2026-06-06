# ShelterTrace Demo Environment Setup

## Infrastructure Steps (manual)

### 1. Create Demo Supabase Project
- Go to supabase.com → New project
- Name: sheltertrace-demo
- Region: same as production
- Note the URL and anon key

### 2. Run the schema
- In the demo project SQL editor, run: supabase/schema.sql
- Then run all migration files in order: supabase/migrations/

### 3. Seed demo data
- Run: supabase/demo/seed.sql
- Update the password_hash values using the app's bcrypt helper or:
  node -e "const bcrypt=require('bcryptjs'); console.log(bcrypt.hashSync('Demo@Admin2026', 10))"
  (run for each demo password and replace PLACEHOLDER values in seed.sql)

### 4. Add session columns
- Run: supabase/demo/add_session_columns.sql
- This adds demo_session_id TEXT to key tables so user-created data can be scoped and cleaned up per session

### 5. Create session-scoped reset function
- Run: supabase/demo/reset_session_function.sql
- This creates the reset_demo_session(p_session_id) RPC called by the frontend on sign out and idle timeout
- Seed data (demo_session_id IS NULL) is preserved; only session-tagged records are deleted

### 5. Create Vercel Deployment
- In Vercel: Add New Project → Import from same GitHub repo
- Environment Variables:
  NEXT_PUBLIC_IS_DEMO=true
  NEXT_PUBLIC_SUPABASE_URL=[demo project URL]
  NEXT_PUBLIC_SUPABASE_ANON_KEY=[demo project anon key]
  (copy all other env vars from production)

### 6. Configure Domain
- In Vercel: Project Settings → Domains → Add demo.sheltertrace.com
- In your DNS (Squarespace/Cloudflare):
  Type: CNAME
  Host: demo
  Value: cname.vercel-dns.com

### 7. Verify
- Visit demo.sheltertrace.com
- Confirm amber demo banner appears
- Test each role login button
- Test data reset on sign out

## Concurrent Sessions Note
Full per-session data isolation (item 7 in the original spec) is not implemented
in this version. All demo visitors share the same data state. This is acceptable
for a demo environment where reset happens on sign-out. Per-session isolation
would require adding a session_id column to every data table, which is a
significant schema change planned for a future version.
