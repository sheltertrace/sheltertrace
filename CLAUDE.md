# ShelterTrace — Deployment Brief

## What This Project Is
ShelterTrace is a comprehensive animal shelter management system for Morgan County Georgia Animal Services. It is currently a single-file React prototype (`shelter-manager.jsx`, ~9,500 lines) that needs to be converted into a production-ready Next.js application with a Supabase backend.

## Supabase Credentials
- **Project URL:** https://jaksulyiodzswlbrqyev.supabase.co
- **Anon Public Key:** sb_publishable_2OBJQiSpFJVeXd3zJYi_0Q_8XKRtvGY

## Tech Stack
- **Frontend:** Next.js 14+ (App Router), React, Tailwind CSS
- **Backend:** Supabase (PostgreSQL database, Auth, Storage)
- **Hosting:** Vercel
- **Language:** TypeScript preferred, JavaScript acceptable

## What Needs to Happen

### Phase 1: Project Setup
1. Initialize a Next.js project in this directory
2. Install dependencies: `@supabase/supabase-js`, `@supabase/auth-helpers-nextjs`
3. Configure Supabase client with the credentials above
4. Set up environment variables in `.env.local`

### Phase 2: Database Schema
Create all tables in Supabase by running SQL. The schema must include:

**Core Tables:**
- `animals` — id, name, species, breed, color, secondary_color, sex, age, dob, weight, size, coat_type, ear_type, eye_color, fixed, status, intake_type, intake_date, circumstance, kennel, microchip, microchip_brand, microchip_date, rabies_tag, rabies_expiry, shelter_tag, bar_code, aco_record, case_number, photo_url, markings, behavior_flags (jsonb), intake_condition, intake_behavior, injuries, is_cruelty_case, is_dangerous, available_date, due_out_days, transfer_due, spay_neuter_due, found_address, found_city, euthanasia (jsonb), created_at, updated_at
- `people` — id, pid (unique sequential like PID-01001), first_name, last_name, role, phone, email, address, city, state, zip, id_type, id_number, id_state, id_expiration, date_added, created_at, updated_at
- `people_notes` — id, person_id (FK), text, type, date, time, created_at
- `animal_notes` — id, animal_id (FK), text, type, date, time, created_at
- `animal_people` — animal_id, person_id (junction table)
- `medical_records` — id, animal_id (FK), animal_name, type, description, date, vet, next_due, created_at
- `adoption_records` — id, animal_id (FK), animal_name, adopter_id (FK), adopter_name, adoption_date, notes, receipt_id, created_at
- `dispatch_calls` — id, type, priority, status, caller, caller_phone, address, city, description, animal_involved, animal_description, assigned_officers (jsonb), narrative (jsonb), evidence (jsonb), involved_parties (jsonb), created_at, updated_at
- `citations` — id, citation_number, call_id (FK nullable), animal_impound, violation_type, violation_desc, violations (jsonb), violator_name, violator_address, violator_city, violator_state, violator_zip, violator_phone, violator_email, violator_dl, violator_sex, violator_dob, desc_hair, desc_eyes, desc_weight, desc_height, animal_desc, remarks, issuing_officer, badge_number, served_by, date, time, location, court_type, court_date, court_time, court_am_pm, fine_amount, due_date, status, citation_type, physical_cit_number, violator_signature, officer_signature, signed_at, notes, created_at
- `receipts` — id, date, category, line_items (jsonb), total, payment_method, check_number, anonymous, person_id (FK nullable), person_name, notes, created_at
- `staff_accounts` — id, username, password_hash, first_name, last_name, role, email, phone, badge, permissions (jsonb), active, created_at
- `shelter_config` — id, config_data (jsonb), updated_at
- `officers` — id, name, badge, status, vehicle, zone, radio, phone, shift

**Auth:**
- Use Supabase Auth for login
- Seed initial staff accounts matching the prototype's STAFF_ACCOUNTS array
- Roles: Admin, Officer, Dispatcher, Vet Tech, Front Desk, Court Clerk, Judge, Volunteer

### Phase 3: Code Restructuring
Convert the single `shelter-manager.jsx` into proper Next.js structure:

```
/app
  /layout.tsx          — root layout with sidebar
  /page.tsx            — dashboard (redirects to login if not auth'd)
  /login/page.tsx      — login screen
  /animals/page.tsx    — animals list + intake wizard
  /animals/[id]/page.tsx — animal detail (full page, ShelterBuddy-style)
  /adoptions/page.tsx
  /foster/page.tsx
  /medical/page.tsx
  /dispatch/page.tsx
  /kennels/page.tsx
  /people/page.tsx
  /people/[id]/page.tsx
  /receipts/page.tsx
  /reports/page.tsx
  /citations/page.tsx
  /court/page.tsx
  /volunteers/page.tsx
  /admin/page.tsx
  /profile/page.tsx
/components
  /ui/               — shared UI components (Button, Card, Badge, Icon, etc.)
  /animals/           — AnimalDetail, IntakeWizard, KennelCard
  /dispatch/          — CallDetail, NewCallModal, CitationForm
  /layout/            — Sidebar, TopBar, Pagination
  /medical/           — MedicalForm, MedicalTable
  /people/            — PersonDetail, PersonForm, MergeDuplicate
  /kennels/           — KennelFloorplan, ShelterDesigner
  /receipts/          — ReceiptForm, ReceiptReport
  /court/             — CourtPortal, CasePacket
  /volunteers/        — VolunteerPortal
/lib
  /supabase.ts        — Supabase client
  /auth.ts            — Auth helpers
  /types.ts           — TypeScript interfaces
  /utils.ts           — genId, formatDate, etc.
  /constants.ts       — All constants (STATUSES, BREEDS, COLORS, MEDICAL_TYPES, etc.)
```

### Phase 4: Key Features to Preserve
Every feature from the prototype must work in production:

1. **Dashboard** — customizable widgets, monthly adoption chart, kennel occupancy
2. **Animal Records** — full-page ShelterBuddy-style detail, collapsible sections, photo upload, behavior flags (14 flags), DOB auto-calculates age (Y/M/D locked), breed/color dropdowns, medical description dropdown based on type, vet/staff dropdown, microchip implant date
3. **Animal Intake Wizard** — 6-step wizard (Intake Info → Animal Info → Identification → Condition/Behavior → Source/Brought By → Kennel/Review)
4. **Virtual Shelter** — pixel-positioned floorplan, color-coded occupancy, multi-animal kennels, manual placement only, move with destination picker, visual shelter designer (admin)
5. **Officer Dispatch** — multi-officer assignment, involved parties auto-create contacts, narrative, evidence
6. **Citations** — matches MCAS physical citation form exactly (Animal Impound #, Citation Number, physical description Hair/Eyes/Weight/Height, Code Section per violation, Count column, Animal Description, Remarks, Court date/time with AM/PM, Magistrate at 149 E Jefferson St / Municipal at 118 N Main St, Badge Number, Served By). Digital and Physical modes. Printed citation mirrors paper form.
7. **Court Portal** — court-only accounts, case detail, print citation + case packet
8. **Adoptions** — 4-step wizard, adopted animals hidden from "All" filter, clickable animals open detail
9. **Foster Care** — fostered animals removed from kennel floorplan
10. **Medical Records** — customizable types, description dropdown based on type (MEDICAL_DESC_MAP), vet/staff dropdown (VET_STAFF_LIST), cost removed
11. **People & Contacts** — search-first design, unique sequential PID, 13 roles + custom, merge duplicate
12. **Receipts & Payments** — Services/Donations/Merchandise categories, anonymous or attached to person, inline new person creation, payment methods (Cash/Check/Credit/Debit/Money Order/Online), print receipt, revenue reports by category and payment method, monthly summary, print full report
13. **Volunteer Portal** — clock in/out, limited access
14. **Reports & Analytics** — key metrics, report cards
15. **Staff Admin** — permission-aware sidebar, user profiles

### Phase 5: Branding
- **Logo:** The prototype has a base64-embedded JPEG logo (SHELTERTRACE_LOGO constant). Extract it and save as `/public/logo.jpg`. Use this in sidebar and login.
- **Colors:** Navy sidebar `#0f2942`, teal accent `#1a8a8a`, logo background `#ececec`
- **Name:** "ShelterTrace" everywhere, subtitle "Shelter Data Systems"
- **Footer:** "ShelterTrace v1.0 · Shelter Data Systems · © 2026"

### Phase 6: Photo/File Storage
- Use Supabase Storage for animal photos, evidence uploads
- Create buckets: `animal-photos`, `evidence`, `signatures`

### Phase 7: Deploy Preparation
- Create proper `.gitignore` (node_modules, .env.local, .next)
- Ensure the app builds with `npm run build` without errors
- Environment variables should be configured for Vercel deployment

## Important Constants to Preserve
- STATUSES: Available, Adopted, Foster, Medical Hold, Quarantine, Pending, Euthanized
- VET_STAFF_LIST: Dr. Smith, Dr. Johnson, Dr. Williams, Dr. Garcia, Dr. Martinez, Dr. Brown, Dr. Davis, Tech - Casey, Tech - Morgan, Tech - Taylor, Director Stevenson
- BEHAVIOR_FLAGS: 14 flags with id, label, icon, color
- KENNEL_LABELS: A-1 through A-15, B-1 through B-12, C-1 through C-12, D-1 through D-6, Q-1 through Q-7, R-1 through R-6, M-1 through M-4
- ALL_BREEDS_DOG: 50+ breeds, ALL_BREEDS_CAT: 17+ breeds, ALL_COLORS: 27 colors
- MEDICAL_DESC_MAP: type→description mapping for medical records
- EUTH_DRUGS, EUTH_REASONS, CIRCUMSTANCE_TYPES, COAT_TYPES, EAR_TYPES, EYE_COLORS, SIZE_OPTIONS
- RECEIPT_CATEGORIES, SERVICE_ITEMS, DONATION_ITEMS, MERCH_ITEMS, PAYMENT_METHODS
- DEFAULT_SHELTER_CONFIG: pixel-positioned kennel floorplan layout

## Staff Accounts (for seeding)
- admin/admin123 (full access, Admin)
- jsmith/pass123 (Officer)
- mgarcia/pass123 (Dispatcher)
- court/court123 (Court Clerk)
- judge/court123 (Judge)
- volunteer/vol123 (Volunteer)
- Plus additional staff from prototype

## Notes
- The prototype file `shelter-manager.jsx` is the source of truth for ALL features, UI layout, and behavior
- Read it thoroughly before restructuring — every component, every constant, every interaction
- Do NOT skip or simplify any features — this is going into production for a real county agency
- The kennel floorplan must maintain pixel positioning and the visual designer
- Age is always derived from DOB (Y/M/D format, field is read-only)
- Adopted animals must be hidden from "All" filter on Animals page
- Animal detail is a full page (not modal) with "← Back to Animals" button
- Kennel removal requires destination selection — no auto-dump to Unassigned
