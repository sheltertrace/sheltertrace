-- Full demo environment reset.
-- Called on every sign-out and idle timeout to restore a pristine demo state.
-- Truncates all user-data tables and re-inserts the seed data.
-- staff_accounts and shelter_config are NOT touched.

CREATE OR REPLACE FUNCTION full_demo_reset()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Clear all changeable data (CASCADE handles FK dependencies)
  DELETE FROM medical_records;
  DELETE FROM animal_notes;
  DELETE FROM animal_people;
  DELETE FROM adoption_records;
  DELETE FROM departure_receipts;
  DELETE FROM dispatch_calls;
  DELETE FROM citations;
  DELETE FROM foster_placements;
  DELETE FROM volunteer_logs;
  DELETE FROM receipts;
  DELETE FROM people WHERE pid NOT LIKE 'SEED-%';  -- keep any seeded contacts
  DELETE FROM animals;

  -- ── Re-seed animals ───────────────────────────────────────────────────────

  INSERT INTO animals (id, name, species, breed, color, sex, age, weight, status, intake_type, intake_date, kennel, photo_url, fixed, intake_condition, circumstance) VALUES
  ('26-04-001','Buddy','Dog','Lab Mix','Yellow','Male','2 Years','65 lbs','Available','Stray','2026-04-15','D-1','https://placedog.net/400/400?id=1',false,'Good','Stray'),
  ('26-04-002','Luna','Cat','Domestic Shorthair','Gray Tabby','Female','3 Years','8 lbs','Available','Owner Surrender','2026-04-18','C-1','https://placekitten.com/400/400',true,'Good','Owner Surrender'),
  ('26-04-003','Max','Dog','German Shepherd Mix','Black/Tan','Male','4 Years','75 lbs','Medical Hold','Stray','2026-04-20','D-2','https://placedog.net/400/400?id=2',false,'Medical Attention Needed','Stray'),
  ('26-04-004','Daisy','Cat','Calico','Calico','Female','1 Year','7 lbs','Available','Stray','2026-04-22','C-2','https://placekitten.com/400/402',false,'Good','Stray'),
  ('26-04-005','Rex','Dog','Pit Bull Mix','Brindle','Male','3 Years','60 lbs','Quarantine','Stray','2026-04-25','ISO-1','https://placedog.net/400/400?id=3',false,'Good','Stray'),
  ('26-04-006','Coco','Cat','Domestic Shorthair','Black','Female','2 Years','9 lbs','Available','Owner Surrender','2026-04-28','C-3','https://placekitten.com/400/404',true,'Good','Owner Surrender'),
  ('26-05-001','Charlie','Dog','Beagle Mix','Tan/White','Male','5 Years','28 lbs','Available','Stray','2026-05-01','D-3','https://placedog.net/400/400?id=4',true,'Good','Stray'),
  ('26-05-002','Molly','Dog','Labrador Mix','Chocolate','Female','2 Years','55 lbs','Foster','Owner Surrender','2026-05-03',NULL,'https://placedog.net/400/400?id=5',false,'Good','Owner Surrender'),
  ('26-05-003','Rocky','Dog','Boxer Mix','Fawn','Male','6 Years','65 lbs','Available','Stray','2026-05-05','D-4','https://placedog.net/400/400?id=6',true,'Good','Stray'),
  ('26-05-004','Stella','Cat','Domestic Longhair','Orange Tabby','Female','4 Years','10 lbs','Available','Stray','2026-05-07','C-4','https://placekitten.com/401/400',true,'Good','Stray'),
  ('26-05-005','Duke','Dog','Rottweiler Mix','Black/Tan','Male','1 Year','70 lbs','Medical Hold','Confiscation','2026-05-08','D-5','https://placedog.net/400/400?id=7',false,'Injured','Confiscation'),
  ('26-05-006','Bella','Cat','Domestic Shorthair','Black/White','Female','3 Years','9 lbs','Available','Owner Surrender','2026-05-09','C-5','https://placekitten.com/402/400',true,'Good','Owner Surrender'),
  ('26-05-007','Cooper','Dog','Golden Retriever Mix','Golden','Male','3 Years','70 lbs','Pending','Stray','2026-05-10','D-6','https://placedog.net/400/400?id=8',true,'Good','Stray'),
  ('26-05-008','Lily','Cat','Siamese Mix','Seal Point','Female','2 Years','8 lbs','Available','Stray','2026-05-11','C-6','https://placekitten.com/403/400',false,'Good','Stray'),
  ('26-05-009','Zeus','Dog','Great Dane Mix','Blue','Male','2 Years','120 lbs','Available','Owner Surrender','2026-05-12','D-7','https://placedog.net/400/400?id=9',true,'Good','Owner Surrender'),
  ('26-05-010','Nala','Dog','Husky Mix','Gray/White','Female','1 Year','45 lbs','Available','Stray','2026-05-13','D-8','https://placedog.net/400/400?id=10',false,'Good','Stray'),
  ('26-05-011','Milo','Cat','Domestic Shorthair','Orange','Male','1 Year','9 lbs','Available','Stray','2026-05-14','C-7','https://placekitten.com/404/400',false,'Good','Stray'),
  ('26-05-012','Sadie','Dog','Border Collie Mix','Black/White','Female','4 Years','42 lbs','Available','Stray','2026-05-15','D-9','https://placedog.net/400/400?id=11',true,'Good','Stray'),
  ('26-05-013','Bear','Dog','Chow Mix','Brown','Male','5 Years','55 lbs','Available','Stray','2026-05-16','D-10','https://placedog.net/400/400?id=12',false,'Good','Stray'),
  ('26-05-014','Penny','Cat','Domestic Shorthair','Tortoiseshell','Female','2 Years','8 lbs','Available','Owner Surrender','2026-05-17','C-8','https://placekitten.com/405/400',true,'Good','Owner Surrender');

  -- ── Re-seed medical records ───────────────────────────────────────────────

  INSERT INTO medical_records (id, animal_id, animal_name, type, description, date, vet, status, next_due, test_result) VALUES
  ('M-SEED-001','26-04-001','Buddy','Vaccination','DHPP (Distemper/Parvo)','2026-04-15','Dr. Smith','Administered','2027-04-15',NULL),
  ('M-SEED-002','26-04-001','Buddy','Vaccination','Bordetella','2026-04-15','Dr. Smith','Administered','2027-04-15',NULL),
  ('M-SEED-003','26-04-001','Buddy','Heartworm Test','Heartworm Antigen Test','2026-04-15','Dr. Smith','Administered',NULL,'Negative'),
  ('M-SEED-004','26-04-002','Luna','Vaccination','FVRCP','2026-04-18','Dr. Garcia','Administered','2027-04-18',NULL),
  ('M-SEED-005','26-04-002','Luna','FIV/FeLV Combo Test','FIV/FeLV Combo (SNAP)','2026-04-18','Dr. Garcia','Administered',NULL,'Negative'),
  ('M-SEED-006','26-04-003','Max','Vaccination','DHPP (Distemper/Parvo)','2026-04-20','Dr. Smith','Scheduled','2027-04-20',NULL),
  ('M-SEED-007','26-04-003','Max','Heartworm Test','Heartworm Antigen Test','2026-04-20','Dr. Smith','Administered',NULL,'Positive'),
  ('M-SEED-008','26-04-004','Daisy','Vaccination','FVRCP','2026-04-22','Dr. Garcia','Administered','2027-04-22',NULL),
  ('M-SEED-009','26-04-004','Daisy','FIV/FeLV Combo Test','FIV/FeLV Combo (SNAP)','2026-04-22','Dr. Garcia','Administered',NULL,'Negative'),
  ('M-SEED-010','26-04-005','Rex','Vaccination','DHPP (Distemper/Parvo)','2026-04-25','Dr. Smith','Scheduled','2027-04-25',NULL),
  ('M-SEED-011','26-04-005','Rex','Heartworm Test','Heartworm Antigen Test','2026-04-25','Dr. Smith','Scheduled',NULL,'Pending'),
  ('M-SEED-012','26-05-001','Charlie','Vaccination','DHPP (Distemper/Parvo)','2026-05-01','Dr. Smith','Administered','2027-05-01',NULL),
  ('M-SEED-013','26-05-007','Cooper','Vaccination','DHPP (Distemper/Parvo)','2026-05-10','Dr. Garcia','Scheduled','2027-05-10',NULL);

  -- ── Re-seed dispatch calls ────────────────────────────────────────────────

  INSERT INTO dispatch_calls (id, type, priority, status, caller, caller_phone, address, city, description, date_reported) VALUES
  ('DC-DEMO-001','Stray Animal','Medium','Open','Sarah Johnson','(555) 000-0121','142 Oak Street','Maplewood','Large stray dog, brown Lab mix, no collar, friendly. Has been in yard for 2 days.','2026-05-20'),
  ('DC-DEMO-002','Animal Bite','High','Closed','Mike Thompson','(555) 000-0188','88 Pine Avenue','Maplewood','Neighbor dog bit visitor. Dog is up to date on vaccines. Owner cooperative.','2026-05-18'),
  ('DC-DEMO-003','Welfare Check','Low','Open','Anonymous',NULL,'305 Elm Drive','Maplewood','Caller reports dog left outside without water for several days.','2026-05-21'),
  ('DC-DEMO-004','Cruelty/Neglect','High','In Progress','Linda Garcia','(555) 000-0244','17 Maple Court','Maplewood','Multiple cats in poor condition, appearing malnourished.','2026-05-19'),
  ('DC-DEMO-005','Noise Complaint','Low','Closed','Robert Davis','(555) 000-0312','220 Cherry Lane','Maplewood','Dog barking all night for three nights. Owner has been notified.','2026-05-15'),
  ('DC-DEMO-006','Stray Animal','Medium','Open','Jennifer Wilson','(555) 000-0456','77 Birch Street','Maplewood','Small orange cat, appears lost. Has collar but no tags.','2026-05-22'),
  ('DC-DEMO-007','Dangerous Animal','High','Open','Carl Martinez','(555) 000-0589','441 Walnut Road','Maplewood','Aggressive Pit Bull mix running loose. Has chased joggers.','2026-05-22');

  -- ── Re-seed citations ─────────────────────────────────────────────────────

  INSERT INTO citations (id, citation_number, violator_name, violator_address, violation_type, fine_amount, date, status, issuing_officer) VALUES
  ('cit-demo-001','CIT-2026-1001','Thomas Brown','142 Oak Street, Maplewood GA','Animal at Large',150.00,'2026-05-10','Issued','Demo Officer'),
  ('cit-demo-002','CIT-2026-1002','Patricia Lee','55 Elm Way, Maplewood GA','Failure to Vaccinate',75.00,'2026-05-08','Paid','Demo Officer'),
  ('cit-demo-003','CIT-2026-1003','James Wilson','891 Maple Drive, Maplewood GA','Nuisance Animal',100.00,'2026-04-28','Pending Court','Demo Officer'),
  ('cit-demo-004','CIT-2026-1004','Karen Davis','34 Pine Circle, Maplewood GA','Tethering Violation',125.00,'2026-05-15','Issued','Demo Officer');

  -- ── Re-seed drug inventory ────────────────────────────────────────────────

  INSERT INTO drug_inventory (drug_name, dea_schedule, ndc_number, manufacturer, lot_number, bottle_number, concentration, bottle_size_ml, quantity_remaining_ml, date_received, received_from, dea_form_222_number, received_by, expiration_date, bottle_status)
  VALUES
  ('Fatal-Plus (Sodium Pentobarbital)','Schedule II','11169-0111-1','Vortech Pharmaceuticals','DEMO-LOT-001','FP-001','390 mg/mL',250,220,'2026-01-15','Demo Distributor Inc.','DEMO-222-001','Demo Administrator','2028-01-15','Active'),
  ('Telazol','Schedule III','0856-4025-01','Zoetis','DEMO-LOT-002','T-001','500 mg/vial',5,4.5,'2026-02-01','Demo Distributor Inc.',NULL,'Demo Administrator','2027-06-30','Active');

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION full_demo_reset() TO anon;
GRANT EXECUTE ON FUNCTION full_demo_reset() TO authenticated;
