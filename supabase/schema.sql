-- ============================================================
-- ShelterTrace — Complete Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Drop existing tables (safe re-run) ───────────────────────────────────────
drop table if exists animal_people cascade;
drop table if exists animal_notes cascade;
drop table if exists people_notes cascade;
drop table if exists medical_records cascade;
drop table if exists adoption_records cascade;
drop table if exists dispatch_calls cascade;
drop table if exists citations cascade;
drop table if exists receipts cascade;
drop table if exists officers cascade;
drop table if exists staff_accounts cascade;
drop table if exists shelter_config cascade;
drop table if exists people cascade;
drop table if exists animals cascade;

-- ── animals ───────────────────────────────────────────────────────────────────
create table animals (
  id                text primary key,
  name              text,
  species           text,
  breed             text,
  color             text,
  secondary_color   text,
  sex               text,
  age               text,
  dob               text,
  weight            text,
  size              text,
  coat_type         text,
  ear_type          text,
  eye_color         text,
  fixed             boolean default false,
  status            text default 'Available',
  intake_type       text,
  intake_date       text,
  circumstance      text,
  kennel            text,
  microchip         text,
  microchip_brand   text,
  microchip_date    text,
  rabies_tag        text,
  rabies_expiry     text,
  shelter_tag       text,
  bar_code          text,
  aco_record        text,
  case_number       text,
  photo_url         text,
  markings          text,
  behavior_flags    jsonb default '{}',
  intake_condition  text,
  intake_behavior   text,
  injuries          text,
  is_cruelty_case   boolean default false,
  is_dangerous      boolean default false,
  available_date    text,
  due_out_days      integer,
  transfer_due      text,
  spay_neuter_due   text,
  found_address     text,
  found_city        text,
  sub_status        text,
  euthanasia        jsonb,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ── people ────────────────────────────────────────────────────────────────────
create table people (
  id            text primary key,
  pid           text unique,
  first_name    text,
  last_name     text,
  role          text,
  phone         text,
  email         text,
  address       text,
  city          text,
  state         text,
  zip           text,
  id_type       text,
  id_number     text,
  id_state      text,
  id_expiration text,
  date_added    text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Auto-generate sequential PID on insert
create or replace function generate_pid()
returns trigger language plpgsql as $$
declare
  next_num integer;
begin
  if new.pid is null or new.pid = '' then
    select coalesce(max(cast(substring(pid from 5) as integer)), 1000) + 1
      into next_num
      from people
      where pid ~ '^PID-\d+$';
    new.pid := 'PID-' || lpad(next_num::text, 5, '0');
  end if;
  return new;
end;
$$;

create trigger set_pid
  before insert on people
  for each row execute function generate_pid();

-- ── animal_notes ──────────────────────────────────────────────────────────────
create table animal_notes (
  id         text primary key default 'N-' || replace(gen_random_uuid()::text, '-', ''),
  animal_id  text references animals(id) on delete cascade,
  text       text,
  type       text default 'General',
  date       text,
  time       text,
  created_at timestamptz default now()
);

-- ── people_notes ──────────────────────────────────────────────────────────────
create table people_notes (
  id         text primary key default 'PN-' || replace(gen_random_uuid()::text, '-', ''),
  person_id  text references people(id) on delete cascade,
  text       text,
  type       text default 'General',
  date       text,
  time       text,
  created_at timestamptz default now()
);

-- ── animal_people (junction) ──────────────────────────────────────────────────
create table animal_people (
  animal_id  text references animals(id) on delete cascade,
  person_id  text references people(id) on delete cascade,
  role       text,
  primary key (animal_id, person_id)
);

-- ── medical_records ───────────────────────────────────────────────────────────
create table medical_records (
  id          text primary key,
  animal_id   text references animals(id) on delete cascade,
  animal_name text,
  type        text,
  description text,
  date        text,
  vet         text,
  next_due    text,
  created_at  timestamptz default now()
);

-- ── adoption_records ──────────────────────────────────────────────────────────
create table adoption_records (
  id            text primary key,
  animal_id     text references animals(id) on delete set null,
  animal_name   text,
  adopter_id    text references people(id) on delete set null,
  adopter_name  text,
  adoption_date text,
  notes         text,
  receipt_id    text,
  created_at    timestamptz default now()
);

-- ── dispatch_calls ────────────────────────────────────────────────────────────
create table dispatch_calls (
  id                 text primary key,
  type               text,
  priority           text default 'Normal',
  status             text default 'Pending',
  caller             text,
  caller_phone       text,
  address            text,
  city               text,
  description        text,
  animal_involved    boolean default false,
  animal_description text,
  assigned_officers  jsonb default '[]',
  narrative          jsonb default '[]',
  evidence           jsonb default '[]',
  involved_parties   jsonb default '[]',
  linked_citations   jsonb default '[]',
  date_reported      text,
  time_reported      text,
  response_notes     text,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

-- ── citations ─────────────────────────────────────────────────────────────────
create table citations (
  id                   text primary key default 'CIT-' || replace(gen_random_uuid()::text, '-', ''),
  citation_number      text,
  physical_cit_number  text,
  citation_type        text default 'Digital',
  call_id              text references dispatch_calls(id) on delete set null,
  animal_impound       text,
  violation_type       text,
  violation_desc       text,
  violations           jsonb default '[]',
  violator_name        text,
  violator_address     text,
  violator_city        text,
  violator_state       text,
  violator_zip         text,
  violator_phone       text,
  violator_email       text,
  violator_dl          text,
  violator_sex         text,
  violator_dob         text,
  desc_hair            text,
  desc_eyes            text,
  desc_weight          text,
  desc_height          text,
  animal_desc          text,
  remarks              text,
  issuing_officer      text,
  badge_number         text,
  served_by            text,
  date                 text,
  time                 text,
  location             text,
  court_type           text,
  court_date           text,
  court_time           text,
  court_am_pm          text,
  fine_amount          numeric(10,2),
  due_date             text,
  status               text default 'Issued',
  violator_signature   text,
  officer_signature    text,
  signed_at            text,
  notes                text,
  created_at           timestamptz default now()
);

-- ── receipts ──────────────────────────────────────────────────────────────────
create table receipts (
  id             text primary key,
  date           text,
  category       text,
  line_items     jsonb default '[]',
  total          numeric(10,2) default 0,
  payment_method text,
  check_number   text,
  anonymous      boolean default false,
  person_id      text references people(id) on delete set null,
  person_name    text,
  notes          text,
  created_at     timestamptz default now()
);

-- ── animal_documents ─────────────────────────────────────────────────────────
create table animal_documents (
  id          text primary key default 'DOC-' || replace(gen_random_uuid()::text, '-', ''),
  animal_id   text references animals(id) on delete cascade,
  animal_name text,
  file_name   text not null,
  file_url    text not null,
  file_type   text,
  file_size   integer,
  category    text default 'General',
  notes       text,
  uploaded_by text,
  created_at  timestamptz default now()
);
create index on animal_documents(animal_id);

-- ── officers ──────────────────────────────────────────────────────────────────
create table officers (
  id      text primary key default 'OFF-' || replace(gen_random_uuid()::text, '-', ''),
  name    text not null,
  badge   text,
  status  text default 'Off Duty',
  vehicle text,
  zone    text,
  radio   text,
  phone   text,
  shift   text
);

-- ── staff_accounts ────────────────────────────────────────────────────────────
create table staff_accounts (
  id            text primary key default replace(gen_random_uuid()::text, '-', ''),
  username      text unique not null,
  password_hash text not null,
  first_name    text,
  last_name     text,
  role          text,
  email         text,
  phone         text,
  badge         text,
  permissions   jsonb default '[]',
  active        boolean default true,
  created_at    timestamptz default now()
);

-- ── shelter_config ────────────────────────────────────────────────────────────
create table shelter_config (
  id          integer primary key default 1,
  config_data jsonb,
  updated_at  timestamptz default now()
);

-- ── updated_at triggers ───────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger animals_updated_at
  before update on animals
  for each row execute function set_updated_at();

create trigger dispatch_calls_updated_at
  before update on dispatch_calls
  for each row execute function set_updated_at();

create trigger people_updated_at
  before update on people
  for each row execute function set_updated_at();

-- ── Indexes ───────────────────────────────────────────────────────────────────
create index on animals(status);
create index on animals(species);
create index on animals(kennel);
create index on animals(created_at desc);
create index on people(last_name);
create index on people(role);
create index on medical_records(animal_id);
create index on medical_records(next_due);
create index on dispatch_calls(status);
create index on dispatch_calls(created_at desc);
create index on adoption_records(adoption_date);
create index on citations(status);
create index on citations(created_at desc);

-- ── Row Level Security (allow all via anon key) ───────────────────────────────
alter table animals          enable row level security;
alter table people           enable row level security;
alter table animal_notes     enable row level security;
alter table people_notes     enable row level security;
alter table animal_people    enable row level security;
alter table medical_records  enable row level security;
alter table adoption_records enable row level security;
alter table dispatch_calls   enable row level security;
alter table citations        enable row level security;
alter table receipts         enable row level security;
alter table officers         enable row level security;
alter table staff_accounts   enable row level security;
alter table shelter_config   enable row level security;

-- Open policies (app handles auth in the client layer)
create policy "allow_all" on animals          for all using (true) with check (true);
create policy "allow_all" on people           for all using (true) with check (true);
create policy "allow_all" on animal_notes     for all using (true) with check (true);
create policy "allow_all" on people_notes     for all using (true) with check (true);
create policy "allow_all" on animal_people    for all using (true) with check (true);
create policy "allow_all" on medical_records  for all using (true) with check (true);
create policy "allow_all" on adoption_records for all using (true) with check (true);
create policy "allow_all" on dispatch_calls   for all using (true) with check (true);
create policy "allow_all" on citations        for all using (true) with check (true);
create policy "allow_all" on receipts         for all using (true) with check (true);
create policy "allow_all" on officers              for all using (true) with check (true);
create policy "allow_all" on animal_documents      for all using (true) with check (true);
create policy "allow_all" on staff_accounts   for all using (true) with check (true);
create policy "allow_all" on shelter_config   for all using (true) with check (true);

-- ── Seed: Staff Accounts ──────────────────────────────────────────────────────
insert into staff_accounts (username, password_hash, first_name, last_name, role, permissions) values
  ('admin',     'admin123', 'Alex',   'Rivera',  'Administrator',   '["all"]'),
  ('jsmith',    'pass123',  'Jamie',  'Smith',   'Shelter Manager', '["animals","adoptions","foster","medical","kennels","people","reports","dispatch"]'),
  ('mgarcia',   'pass123',  'Maria',  'Garcia',  'Veterinarian',    '["animals","medical","kennels"]'),
  ('dwilson',   'pass123',  'David',  'Wilson',  'Officer',         '["animals","dispatch","citations","kennels"]'),
  ('tbrown',    'pass123',  'Taylor', 'Brown',   'Dispatcher',      '["dispatch","citations","people"]'),
  ('klee',      'pass123',  'Kim',    'Lee',     'Front Desk',      '["animals","people","adoptions","receipts","foster"]'),
  ('njones',    'pass123',  'Nick',   'Jones',   'Vet Tech',        '["animals","medical","kennels"]'),
  ('rmartin',   'pass123',  'Rachel', 'Martin',  'Officer',         '["animals","dispatch","citations","kennels"]'),
  ('court',     'court123', 'Court',  'Clerk',   'Court Clerk',     '["court","citations","people"]'),
  ('judge',     'court123', 'The',    'Judge',   'Judge',           '["court","citations"]'),
  ('volunteer', 'vol123',   'Vol',    'User',    'Volunteer',       '["volunteers"]')
on conflict (username) do nothing;

-- ── Seed: Default Shelter Config ─────────────────────────────────────────────
insert into shelter_config (id, config_data) values (1, '{
  "rooms": [
    {"id":"room-A","name":"A Wing","type":"kennels","x":20,"y":20,"w":340,"h":200,"labels":["A-1","A-2","A-3","A-4","A-5","A-6","A-7","A-8","A-9","A-10","A-11","A-12","A-13","A-14","A-15"]},
    {"id":"room-B","name":"B Wing","type":"kennels","x":380,"y":20,"w":290,"h":200,"labels":["B-1","B-2","B-3","B-4","B-5","B-6","B-7","B-8","B-9","B-10","B-11","B-12"]},
    {"id":"room-C","name":"Cat Room","type":"kennels","x":20,"y":240,"w":290,"h":200,"labels":["C-1","C-2","C-3","C-4","C-5","C-6","C-7","C-8","C-9","C-10","C-11","C-12"]},
    {"id":"room-D","name":"Isolation","type":"kennels","x":330,"y":240,"w":160,"h":200,"labels":["D-1","D-2","D-3","D-4","D-5","D-6"]},
    {"id":"room-Q","name":"Quarantine","type":"kennels","x":510,"y":240,"w":160,"h":200,"labels":["Q-1","Q-2","Q-3","Q-4","Q-5","Q-6","Q-7"]},
    {"id":"room-M","name":"Medical","type":"kennels","x":20,"y":460,"w":200,"h":120,"labels":["M-1","M-2","M-3","M-4"]},
    {"id":"room-R","name":"Receiving","type":"kennels","x":240,"y":460,"w":200,"h":120,"labels":["R-1","R-2","R-3","R-4","R-5","R-6"]},
    {"id":"lbl-lobby","name":"Lobby","type":"label","x":460,"y":460,"w":210,"h":55,"bg":"#dbeafe"},
    {"id":"lbl-office","name":"Office","type":"label","x":460,"y":525,"w":100,"h":55,"bg":"#fef9c3"},
    {"id":"lbl-storage","name":"Storage Room","type":"label","x":550,"y":500,"w":155,"h":45,"bg":"#e5e7eb"}
  ]
}')
on conflict (id) do nothing;

-- ── Seed: Officers ────────────────────────────────────────────────────────────
insert into officers (name, badge, status, vehicle, zone, shift) values
  ('Officer D. Wilson', '401', 'Available', 'Unit 1', 'North', 'Day'),
  ('Officer R. Martin', '402', 'Available', 'Unit 2', 'South', 'Day'),
  ('Officer T. Brown',  '403', 'Off Duty',  'Unit 3', 'East',  'Night')
on conflict do nothing;
