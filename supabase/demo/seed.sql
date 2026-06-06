-- ShelterTrace Demo Seed Data
-- Run this in the demo Supabase project SQL editor
-- Passwords are stored as bcrypt hashes. Use the ShelterTrace admin UI
-- or a bcrypt tool to generate hashes for:
--   demo-admin:     Demo@Admin2026
--   demo-officer:   Demo@Officer2026
--   demo-frontdesk: Demo@FrontDesk2026
--
-- Example (Node.js):
--   node -e "const bcrypt=require('bcryptjs'); console.log(bcrypt.hashSync('Demo@Admin2026', 10))"
-- Run for each password and replace the PLACEHOLDER values below.

-- ── Staff Accounts ─────────────────────────────────────────────────────────────

TRUNCATE staff_accounts CASCADE;

INSERT INTO staff_accounts (id, username, password_hash, first_name, last_name, role, email, active, permissions) VALUES
  ('demo-admin-001',    'demo-admin',     '$2b$10$PLACEHOLDER_ADMIN_HASH',     'Demo',  'Administrator', 'Admin',      'admin@demo.sheltertrace.com',      true, '["all"]'),
  ('demo-officer-001',  'demo-officer',   '$2b$10$PLACEHOLDER_OFFICER_HASH',   'Demo',  'Officer',       'Officer',    'officer@demo.sheltertrace.com',    true, '["dispatch","animals","citations","reports","dashboard"]'),
  ('demo-frontdesk-001','demo-frontdesk', '$2b$10$PLACEHOLDER_FRONTDESK_HASH', 'Front', 'Desk',          'Front Desk', 'frontdesk@demo.sheltertrace.com',  true, '["animals","adoptions","receipts","people","medical","reports","dashboard"]');

-- ── Shelter Config ─────────────────────────────────────────────────────────────

INSERT INTO shelter_config (id, config_data) VALUES (1, '[
  {"id":"room-dogs","name":"Dog Wing","type":"kennels","x":20,"y":20,"w":200,"h":320,"labels":["D-1","D-2","D-3","D-4","D-5","D-6","D-7","D-8","D-9","D-10","D-11","D-12"]},
  {"id":"room-cats","name":"Cat Room","type":"kennels","x":240,"y":20,"w":160,"h":240,"labels":["C-1","C-2","C-3","C-4","C-5","C-6","C-7","C-8"]},
  {"id":"room-iso","name":"Isolation","type":"kennels","x":420,"y":20,"w":140,"h":180,"labels":["ISO-1","ISO-2","ISO-3"]},
  {"id":"room-intake","name":"Intake / Holding","type":"kennels","x":240,"y":280,"w":160,"h":80,"labels":["HLD-1","HLD-2"]},
  {"id":"lbl-dogs","name":"🐕 Dog Wing","type":"label","x":20,"y":10,"w":200,"h":15,"bg":"#dbeafe"},
  {"id":"lbl-cats","name":"🐈 Cat Room","type":"label","x":240,"y":10,"w":160,"h":15,"bg":"#fce7f3"},
  {"id":"lbl-iso","name":"⚠️ Isolation","type":"label","x":420,"y":10,"w":140,"h":15,"bg":"#fee2e2"}
]') ON CONFLICT (id) DO UPDATE SET config_data = EXCLUDED.config_data;

-- ── Animals (20 total: 12 dogs, 8 cats) ──────────────────────────────────────

INSERT INTO animals (id, name, species, breed, color, sex, age, weight, status, intake_type, intake_date, kennel, photo_url, fixed) VALUES
-- Dogs
('26-04-001', 'Buddy',   'Dog', 'Lab Mix',        'Yellow',        'Male',   '2 Years',  '65 lbs', 'Available',     'Stray',     '2026-04-15', 'D-1',  'https://placedog.net/400/400?id=1',  false),
('26-04-002', 'Max',     'Dog', 'Pit Mix',         'Brown',         'Male',   '3 Years',  '58 lbs', 'Available',     'Stray',     '2026-04-18', 'D-2',  'https://placedog.net/400/400?id=2',  false),
('26-04-003', 'Rex',     'Dog', 'GSD Mix',         'Black/Tan',     'Male',   '4 Years',  '72 lbs', 'Medical Hold',  'Stray',     '2026-04-20', 'ISO-1','https://placedog.net/400/400?id=3',  false),
('26-04-004', 'Charlie', 'Dog', 'Beagle Mix',      'Tri-Color',     'Male',   '1 Year',   '28 lbs', 'Available',     'Surrender', '2026-04-22', 'D-3',  'https://placedog.net/400/400?id=4',  false),
('26-04-005', 'Rocky',   'Dog', 'Boxer Mix',       'Brindle',       'Male',   '2 Years',  '55 lbs', 'Foster',        'Stray',     '2026-04-25', NULL,   'https://placedog.net/400/400?id=5',  false),
('26-04-006', 'Duke',    'Dog', 'Husky Mix',       'Gray/White',    'Male',   '3 Years',  '60 lbs', 'Available',     'Stray',     '2026-04-28', 'D-4',  'https://placedog.net/400/400?id=6',  false),
('26-04-007', 'Cooper',  'Dog', 'Golden Mix',      'Golden',        'Male',   '6 Months', '35 lbs', 'Available',     'Surrender', '2026-05-01', 'D-5',  'https://placedog.net/400/400?id=7',  false),
('26-04-008', 'Zeus',    'Dog', 'Rottweiler Mix',  'Black/Tan',     'Male',   '5 Years',  '85 lbs', 'Quarantine',    'Stray',     '2026-05-03', 'ISO-2','https://placedog.net/400/400?id=8',  false),
('26-04-009', 'Milo',    'Dog', 'Dachshund Mix',   'Brown',         'Male',   '4 Years',  '18 lbs', 'Available',     'Surrender', '2026-05-05', 'D-6',  'https://placedog.net/400/400?id=9',  false),
('26-04-010', 'Bear',    'Dog', 'Lab/Chow Mix',    'Black',         'Male',   '3 Years',  '68 lbs', 'Foster',        'Stray',     '2026-05-07', NULL,   'https://placedog.net/400/400?id=10', false),
('26-05-001', 'Daisy',   'Dog', 'Border Collie Mix','Black/White',  'Female', '2 Years',  '42 lbs', 'Available',     'Surrender', '2026-05-10', 'D-7',  'https://placedog.net/400/400?id=11', true),
('26-05-002', 'Sadie',   'Dog', 'Lab Mix',         'Chocolate',     'Female', '1 Year',   '52 lbs', 'Medical Hold',  'Stray',     '2026-05-12', 'D-8',  'https://placedog.net/400/400?id=12', false),
-- Cats
('26-04-011', 'Luna',    'Cat', 'Domestic Shorthair','Gray',        'Female', '2 Years',  '8 lbs',  'Available',     'Stray',     '2026-04-16', 'C-1',  'https://placekitten.com/400/401',    true),
('26-04-012', 'Coco',    'Cat', 'Domestic Longhair', 'Orange',      'Female', '3 Years',  '9 lbs',  'Available',     'Surrender', '2026-04-19', 'C-2',  'https://placekitten.com/400/402',    true),
('26-04-013', 'Molly',   'Cat', 'Domestic Shorthair','Calico',      'Female', '1 Year',   '7 lbs',  'Available',     'Stray',     '2026-04-23', 'C-3',  'https://placekitten.com/400/403',    false),
('26-04-014', 'Stella',  'Cat', 'Domestic Shorthair','Black',       'Female', '6 Months', '5 lbs',  'Medical Hold',  'Stray',     '2026-04-26', 'C-4',  'https://placekitten.com/400/404',    false),
('26-04-015', 'Bella',   'Cat', 'Domestic Longhair', 'White',       'Female', '4 Years',  '10 lbs', 'Available',     'Surrender', '2026-04-29', 'C-5',  'https://placekitten.com/400/405',    true),
('26-04-016', 'Lily',    'Cat', 'Siamese Mix',       'Cream/Brown', 'Female', '2 Years',  '8 lbs',  'Foster',        'Stray',     '2026-05-02', NULL,   'https://placekitten.com/400/406',    true),
('26-04-017', 'Nala',    'Cat', 'Domestic Shorthair','Orange/White','Female', '3 Years',  '9 lbs',  'Quarantine',    'Stray',     '2026-05-06', 'ISO-3','https://placekitten.com/400/407',    false),
('26-05-003', 'Penny',   'Cat', 'Domestic Shorthair','Tortoiseshell','Female','8 Months', '6 lbs',  'Adopted',       'Surrender', '2026-05-08', NULL,   'https://placekitten.com/400/408',    false);

-- ── Medical Records ───────────────────────────────────────────────────────────

INSERT INTO medical_records (id, animal_id, animal_name, type, description, date, vet, next_due, created_at) VALUES
-- Buddy (Dog - D-1)
('med-001', '26-04-001', 'Buddy',   'Vaccination',     'DHPP',               '2026-04-15', 'Dr. Smith',   '2027-04-15', NOW()),
('med-002', '26-04-001', 'Buddy',   'Treatment',       'Strongid Dewormer',  '2026-04-15', NULL,          '2026-05-15', NOW()),
('med-003', '26-04-001', 'Buddy',   'Heartworm Test',  '4Dx Test - Negative','2026-04-15', 'Dr. Smith',   '2027-04-15', NOW()),

-- Max (Dog - D-2)
('med-004', '26-04-002', 'Max',     'Vaccination',     'DHPP',               '2026-04-18', 'Dr. Garcia',  '2027-04-18', NOW()),
('med-005', '26-04-002', 'Max',     'Treatment',       'Strongid Dewormer',  '2026-04-18', NULL,          '2026-05-18', NOW()),
('med-006', '26-04-002', 'Max',     'Heartworm Test',  '4Dx Test - Negative','2026-04-18', 'Dr. Garcia',  '2027-04-18', NOW()),

-- Rex (Dog - ISO-1, Medical Hold, Positive Heartworm)
('med-007', '26-04-003', 'Rex',     'Vaccination',     'DHPP',               '2026-04-20', 'Dr. Smith',   '2027-04-20', NOW()),
('med-008', '26-04-003', 'Rex',     'Treatment',       'Strongid Dewormer',  '2026-04-20', NULL,          '2026-05-20', NOW()),
('med-009', '26-04-003', 'Rex',     'Heartworm Test',  '4Dx Test - Positive','2026-04-20', 'Dr. Smith',   NULL,         NOW()),
('med-010', '26-04-003', 'Rex',     'Treatment',       'Heartworm Treatment - Immiticide Protocol', '2026-04-25', 'Dr. Smith', '2026-06-25', NOW()),

-- Charlie (Dog - D-3)
('med-011', '26-04-004', 'Charlie', 'Vaccination',     'DHPP',               '2026-04-22', 'Dr. Williams','2027-04-22', NOW()),
('med-012', '26-04-004', 'Charlie', 'Treatment',       'Strongid Dewormer',  '2026-04-22', NULL,          '2026-05-22', NOW()),
('med-013', '26-04-004', 'Charlie', 'Heartworm Test',  '4Dx Test - Negative','2026-04-22', 'Dr. Williams','2027-04-22', NOW()),

-- Rocky (Dog - Foster)
('med-014', '26-04-005', 'Rocky',   'Vaccination',     'DHPP',               '2026-04-25', 'Dr. Garcia',  '2027-04-25', NOW()),
('med-015', '26-04-005', 'Rocky',   'Treatment',       'Strongid Dewormer',  '2026-04-25', NULL,          '2026-05-25', NOW()),
('med-016', '26-04-005', 'Rocky',   'Heartworm Test',  '4Dx Test - Negative','2026-04-25', 'Dr. Garcia',  '2027-04-25', NOW()),

-- Duke (Dog - D-4)
('med-017', '26-04-006', 'Duke',    'Vaccination',     'DHPP',               '2026-04-28', 'Dr. Smith',   '2027-04-28', NOW()),
('med-018', '26-04-006', 'Duke',    'Treatment',       'Strongid Dewormer',  '2026-04-28', NULL,          '2026-05-28', NOW()),
('med-019', '26-04-006', 'Duke',    'Heartworm Test',  '4Dx Test - Negative','2026-04-28', 'Dr. Smith',   '2027-04-28', NOW()),

-- Cooper (Dog - D-5)
('med-020', '26-04-007', 'Cooper',  'Vaccination',     'DHPP',               '2026-05-01', 'Dr. Williams','2027-05-01', NOW()),
('med-021', '26-04-007', 'Cooper',  'Treatment',       'Strongid Dewormer',  '2026-05-01', NULL,          '2026-06-01', NOW()),

-- Zeus (Dog - ISO-2, Quarantine)
('med-022', '26-04-008', 'Zeus',    'Vaccination',     'DHPP',               '2026-05-03', 'Dr. Smith',   '2027-05-03', NOW()),
('med-023', '26-04-008', 'Zeus',    'Treatment',       'Strongid Dewormer',  '2026-05-03', NULL,          '2026-06-03', NOW()),
('med-024', '26-04-008', 'Zeus',    'Heartworm Test',  '4Dx Test - Negative','2026-05-03', 'Dr. Smith',   '2027-05-03', NOW()),

-- Milo (Dog - D-6)
('med-025', '26-04-009', 'Milo',    'Vaccination',     'DHPP',               '2026-05-05', 'Dr. Garcia',  '2027-05-05', NOW()),
('med-026', '26-04-009', 'Milo',    'Treatment',       'Strongid Dewormer',  '2026-05-05', NULL,          '2026-06-05', NOW()),

-- Bear (Dog - Foster)
('med-027', '26-04-010', 'Bear',    'Vaccination',     'DHPP',               '2026-05-07', 'Dr. Williams','2027-05-07', NOW()),
('med-028', '26-04-010', 'Bear',    'Treatment',       'Strongid Dewormer',  '2026-05-07', NULL,          '2026-06-07', NOW()),

-- Daisy (Dog - D-7)
('med-029', '26-05-001', 'Daisy',   'Vaccination',     'DHPP',               '2026-05-10', 'Dr. Smith',   '2027-05-10', NOW()),
('med-030', '26-05-001', 'Daisy',   'Treatment',       'Strongid Dewormer',  '2026-05-10', NULL,          '2026-06-10', NOW()),
('med-031', '26-05-001', 'Daisy',   'Heartworm Test',  '4Dx Test - Negative','2026-05-10', 'Dr. Smith',   '2027-05-10', NOW()),

-- Sadie (Dog - D-8, Medical Hold)
('med-032', '26-05-002', 'Sadie',   'Vaccination',     'DHPP',               '2026-05-12', 'Dr. Garcia',  '2027-05-12', NOW()),
('med-033', '26-05-002', 'Sadie',   'Treatment',       'Strongid Dewormer',  '2026-05-12', NULL,          '2026-06-12', NOW()),
('med-034', '26-05-002', 'Sadie',   'Diagnostic',      'URI - Upper Respiratory Infection', '2026-05-12', 'Dr. Garcia', '2026-05-26', NOW()),

-- Luna (Cat - C-1)
('med-035', '26-04-011', 'Luna',    'Vaccination',     'FVRCP',              '2026-04-16', 'Dr. Smith',   '2027-04-16', NOW()),
('med-036', '26-04-011', 'Luna',    'Treatment',       'Pyrantel Dewormer',  '2026-04-16', NULL,          '2026-05-16', NOW()),
('med-037', '26-04-011', 'Luna',    'FIV/FeLV Test',   'Combo Test - Negative','2026-04-16','Dr. Smith',  '2027-04-16', NOW()),

-- Coco (Cat - C-2)
('med-038', '26-04-012', 'Coco',    'Vaccination',     'FVRCP',              '2026-04-19', 'Dr. Garcia',  '2027-04-19', NOW()),
('med-039', '26-04-012', 'Coco',    'Treatment',       'Pyrantel Dewormer',  '2026-04-19', NULL,          '2026-05-19', NOW()),
('med-040', '26-04-012', 'Coco',    'FIV/FeLV Test',   'Combo Test - Negative','2026-04-19','Dr. Garcia', '2027-04-19', NOW()),

-- Molly (Cat - C-3)
('med-041', '26-04-013', 'Molly',   'Vaccination',     'FVRCP',              '2026-04-23', 'Dr. Williams','2027-04-23', NOW()),
('med-042', '26-04-013', 'Molly',   'Treatment',       'Pyrantel Dewormer',  '2026-04-23', NULL,          '2026-05-23', NOW()),
('med-043', '26-04-013', 'Molly',   'FIV/FeLV Test',   'Combo Test - Negative','2026-04-23','Dr. Williams','2027-04-23',NOW()),

-- Stella (Cat - C-4, Medical Hold)
('med-044', '26-04-014', 'Stella',  'Vaccination',     'FVRCP',              '2026-04-26', 'Dr. Smith',   '2027-04-26', NOW()),
('med-045', '26-04-014', 'Stella',  'Treatment',       'Pyrantel Dewormer',  '2026-04-26', NULL,          '2026-05-26', NOW()),
('med-046', '26-04-014', 'Stella',  'FIV/FeLV Test',   'Combo Test - Positive','2026-04-26','Dr. Smith',  NULL,         NOW()),

-- Bella (Cat - C-5)
('med-047', '26-04-015', 'Bella',   'Vaccination',     'FVRCP',              '2026-04-29', 'Dr. Garcia',  '2027-04-29', NOW()),
('med-048', '26-04-015', 'Bella',   'Treatment',       'Pyrantel Dewormer',  '2026-04-29', NULL,          '2026-05-29', NOW()),
('med-049', '26-04-015', 'Bella',   'FIV/FeLV Test',   'Combo Test - Negative','2026-04-29','Dr. Garcia', '2027-04-29', NOW()),

-- Lily (Cat - Foster)
('med-050', '26-04-016', 'Lily',    'Vaccination',     'FVRCP',              '2026-05-02', 'Dr. Williams','2027-05-02', NOW()),
('med-051', '26-04-016', 'Lily',    'Treatment',       'Pyrantel Dewormer',  '2026-05-02', NULL,          '2026-06-02', NOW()),

-- Nala (Cat - ISO-3, Quarantine)
('med-052', '26-04-017', 'Nala',    'Vaccination',     'FVRCP',              '2026-05-06', 'Dr. Smith',   '2027-05-06', NOW()),
('med-053', '26-04-017', 'Nala',    'Treatment',       'Pyrantel Dewormer',  '2026-05-06', NULL,          '2026-06-06', NOW()),

-- Penny (Cat - Adopted)
('med-054', '26-05-003', 'Penny',   'Vaccination',     'FVRCP',              '2026-05-08', 'Dr. Garcia',  '2027-05-08', NOW()),
('med-055', '26-05-003', 'Penny',   'Treatment',       'Pyrantel Dewormer',  '2026-05-08', NULL,          '2026-06-08', NOW());

-- ── Dispatch Calls ────────────────────────────────────────────────────────────

INSERT INTO dispatch_calls (id, type, priority, status, caller, caller_phone, address, city, description, date_reported) VALUES
('DC-DEMO-001', 'Stray Animal',     'Medium', 'Open',        'Sarah Johnson',  '(706) 555-0121', '142 Oak Street',    'Madison',  'Large stray dog, brown Lab mix, no collar, friendly. Has been in yard for 2 days.',                                         '2026-05-20'),
('DC-DEMO-002', 'Animal Bite',      'High',   'Closed',      'Mike Thompson',  '(706) 555-0188', '88 Pine Avenue',    'Madison',  'Neighbor''s dog bit visitor. Dog is up to date on vaccines. Owner cooperative.',                                            '2026-05-18'),
('DC-DEMO-003', 'Welfare Check',    'Low',    'Open',        'Anonymous',      NULL,             '305 Elm Drive',     'Madison',  'Caller reports dog left outside without water for several days in the heat.',                                               '2026-05-21'),
('DC-DEMO-004', 'Cruelty/Neglect',  'High',   'In Progress', 'Linda Garcia',   '(706) 555-0244', '17 Maple Court',    'Rutledge', 'Multiple cats in poor condition, appearing malnourished. 8-10 cats visible through window.',                                '2026-05-19'),
('DC-DEMO-005', 'Noise Complaint',  'Low',    'Closed',      'Robert Davis',   '(706) 555-0312', '220 Cherry Lane',   'Madison',  'Dog barking all night for three nights. Owner has been notified.',                                                          '2026-05-15'),
('DC-DEMO-006', 'Stray Animal',     'Medium', 'Open',        'Jennifer Wilson','(706) 555-0456', '77 Birch Street',   'Bostwick', 'Small orange cat, appears lost. Has collar but no tags.',                                                                   '2026-05-22'),
('DC-DEMO-007', 'Dangerous Animal', 'High',   'Open',        'Carl Martinez',  '(706) 555-0589', '441 Walnut Road',   'Madison',  'Aggressive Pit Bull mix running loose. Has chased two joggers this morning.',                                               '2026-05-22');

-- ── Citations ─────────────────────────────────────────────────────────────────

INSERT INTO citations (id, citation_number, violator_name, violator_address, violation_type, fine_amount, date, status, issuing_officer) VALUES
('cit-demo-001', 'CIT-2026-1001', 'Thomas Brown',    '142 Oak Street, Madison GA',    'Animal at Large',       150.00, '2026-05-10', 'Issued',        'Demo Officer'),
('cit-demo-002', 'CIT-2026-1002', 'Patricia Lee',    '55 Elm Way, Madison GA',        'Failure to Vaccinate',   75.00, '2026-05-08', 'Paid',          'Demo Officer'),
('cit-demo-003', 'CIT-2026-1003', 'James Wilson',    '891 Maple Drive, Rutledge GA',  'Nuisance Animal',        100.00, '2026-04-28', 'Pending Court', 'Demo Officer'),
('cit-demo-004', 'CIT-2026-1004', 'Karen Davis',     '34 Pine Circle, Madison GA',    'Tethering Violation',   125.00, '2026-05-15', 'Issued',        'Demo Officer');

-- RLS: All tables use allow_all policies (same as production). Access is controlled at the application layer.
