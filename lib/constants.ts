export const STATUSES = ["Available", "Adopted", "Foster", "Hold", "Medical Hold", "Quarantine", "Pending", "Euthanized", "Died in Care", "Imported", "Transferred", "Redeemed", "Clinic Visit"] as const;
export type AnimalStatus = typeof STATUSES[number];

export const SUB_STATUSES: Record<string, string[]> = {
  Available: ["Ready for Adoption", "Awaiting Spay/Neuter", "Awaiting Medical Clearance", "Hold - Owner Looking", "Stray Hold", "Behavior Evaluation", "Photo Needed"],
  Hold: ["Adoption Hold", "Stray Hold", "Legal Hold", "Medical Hold", "Rescue Hold", "Owner Hold", "Behavioral Hold", "Other"],
  "Medical Hold": ["Treatment in Progress", "Post-Surgery Recovery", "Awaiting Test Results", "Isolation - Illness"],
  Quarantine: ["Bite Quarantine", "Disease Exposure", "Rabies Observation", "New Intake Hold"],
  Pending: ["Pending Adoption", "Pending Transfer", "Pending Surrender", "Pending Owner Claim"],
  Foster: ["Active Foster", "Foster-to-Adopt", "Medical Foster", "Behavioral Foster"],
  "Clinic Visit": ["Waiting", "In Progress", "Checked Out"],
};

export const STATUS_COLORS: Record<string, string> = {
  Available: "#22c55e",
  Adopted: "#6366f1",
  Foster: "#f59e0b",
  "Medical Hold": "#ef4444",
  Quarantine: "#dc2626",
  Pending: "#a855f7",
  Euthanized: "#374151",
  Hold: "#0369a1",
  "Died in Care": "#1f2937",
  Imported: "#0ea5e9",
  Transferred: "#7c3aed",
  Redeemed: "#0891b2",
  "Clinic Visit": "#0d9488",
};

export const INTAKE_TYPES = ["Surrender", "Stray", "Transfer", "Return", "Confiscation", "Born in Shelter", "Clinic"] as const;

export const MICROCHIP_MANUFACTURERS = [
  "HomeAgain", "AVID", "24PetWatch", "Datamars", "Trovan", "AKC Reunite", "Found Animals", "PetLink", "Other",
] as const;

export const MICROCHIP_STATUS = ["Active", "Transferred", "Deceased"] as const;

// ── Clinic services menu ──────────────────────────────────────────────────────
export interface ClinicService {
  id: string;
  category: string;
  label: string;
  species?: "Dog" | "Cat"; // undefined = shown for all species
  medical: { type: string; description: string };
  defaultFee?: number;
}

export const CLINIC_SERVICES: ClinicService[] = [
  // Vaccines
  { id: "v_rabies",    category: "Vaccine", label: "Rabies",           medical: { type: "Vaccination", description: "Rabies" },           defaultFee: 10 },
  { id: "v_dhpp",      category: "Vaccine", label: "DHPP / DAPP",      medical: { type: "Vaccination", description: "DHPP" },    species: "Dog", defaultFee: 15 },
  { id: "v_bordetella",category: "Vaccine", label: "Bordetella",       medical: { type: "Vaccination", description: "Bordetella" }, species: "Dog", defaultFee: 12 },
  { id: "v_fvrcp",     category: "Vaccine", label: "FVRCP",            medical: { type: "Vaccination", description: "FVRCP" },  species: "Cat", defaultFee: 15 },
  { id: "v_felv",      category: "Vaccine", label: "FeLV",             medical: { type: "Vaccination", description: "FeLV" },   species: "Cat", defaultFee: 18 },
  { id: "v_canine_flu",category: "Vaccine", label: "Canine Influenza",  medical: { type: "Vaccination", description: "Canine Influenza" }, species: "Dog", defaultFee: 20 },
  // Microchip
  { id: "chip_implant",category: "Microchip", label: "Microchip Implant",     medical: { type: "Microchip", description: "Microchip Implant" }, defaultFee: 25 },
  { id: "chip_scan",   category: "Microchip", label: "Microchip Scan / Verify", medical: { type: "Microchip", description: "Microchip Scan" },   defaultFee: 0 },
  // Parasite control
  { id: "dewormer",    category: "Parasite Control", label: "Deworming (Strongid)",  medical: { type: "Treatment", description: "Strongid / Dewormer" }, defaultFee: 8 },
  { id: "flea_tick",   category: "Parasite Control", label: "Flea / Tick Treatment", medical: { type: "Treatment", description: "Flea/Tick Treatment" },  defaultFee: 12 },
  // Tests & checkup
  { id: "heartworm",   category: "Tests & Checkup", label: "Heartworm Test",  medical: { type: "Treatment", description: "Heartworm Treatment" }, defaultFee: 20, species: "Dog" },
  { id: "wellness",    category: "Tests & Checkup", label: "Wellness Exam",   medical: { type: "Checkup",   description: "Wellness Exam" },       defaultFee: 25 },
];


export const MEDICAL_TYPES = [
  "Vaccination","Spay/Neuter","Dental","Checkup","Surgery","Treatment","Microchip",
  // Diagnostic Tests
  "Heartworm Test","Parvo Test","FIV Test","FeLV Test","FIV/FeLV Combo Test","Fecal Test","Urinalysis",
];

export const DIAGNOSTIC_TEST_TYPES = new Set([
  "Heartworm Test","Parvo Test","FIV Test","FeLV Test","FIV/FeLV Combo Test","Fecal Test","Urinalysis",
]);

export function isDiagnosticTest(type: string): boolean {
  return DIAGNOSTIC_TEST_TYPES.has(type);
}

export const TEST_RESULT_OPTIONS = ["Pending","Negative","Positive","Inconclusive"] as const;

export const MEDICAL_DESC_MAP: Record<string, string[]> = {
  Vaccination: ["Rabies","DHPP","Bordetella","FVRCP","FeLV","Canine Influenza","Leptospirosis","Lyme","DAPP","Distemper"],
  "Spay/Neuter": ["Spay","Neuter","Pre-surgical Exam"],
  Dental: ["Dental Cleaning","Tooth Extraction","Dental Exam","Oral Surgery"],
  Checkup: ["Wellness Exam","Follow-up Exam","Intake Exam","Pre-adoption Exam","Behavioral Assessment"],
  Surgery: ["Mass Removal","Orthopedic","Laceration Repair","Enucleation","Amputation","Exploratory","Other Surgery"],
  Treatment: ["Antibiotics","Anti-inflammatory","Wound Care","Ear Treatment","Eye Treatment","Skin Treatment","Fluid Therapy","Strongid / Dewormer","Flea/Tick Treatment","Heartworm Treatment","Pain Management"],
  Microchip: ["Microchip Implant","Microchip Scan","Microchip Registration"],
  "Heartworm Test": ["Heartworm Antigen Test (4Dx)","Heartworm Antigen Test (SNAP)","Heartworm Test"],
  "Parvo Test": ["Parvovirus Antigen Test","Parvo SNAP Test"],
  "FIV Test": ["FIV Antibody Test","FIV SNAP Test"],
  "FeLV Test": ["FeLV Antigen Test","FeLV SNAP Test"],
  "FIV/FeLV Combo Test": ["FIV/FeLV Combo (SNAP)","FIV/FeLV Combo (4Dx Plus)"],
  "Fecal Test": ["Fecal Float","Fecal Direct Smear","Fecal Culture","Giardia Snap Test"],
  "Urinalysis": ["Urinalysis","Urine Culture","Urine Specific Gravity"],
};


export const ALL_BREEDS_DOG = [
  "","Labrador Retriever","German Shepherd","Golden Retriever","Pit Bull Mix","Pit Bull",
  "American Staffordshire Terrier","Beagle","Chihuahua","Husky","Siberian Husky","Poodle",
  "Border Collie","Boxer","Rottweiler","Dachshund","Australian Shepherd","Australian Terrier",
  "Great Dane","Doberman","Shih Tzu","Yorkshire Terrier","Bulldog","French Bulldog",
  "English Bulldog","Miniature Pinscher","Coonhound","Bluetick Coonhound",
  "Treeing Walker Coonhound","Basset Hound","Bloodhound","Jack Russell Terrier",
  "Catahoula","Cur","Mountain Cur","Feist","Rat Terrier","Cocker Spaniel",
  "Springer Spaniel","Corgi","Maltese","Great Pyrenees","Mastiff","Weimaraner",
  "Vizsla","Pointer","Rhodesian Ridgeback","Chow Chow","Akita","Shar Pei",
  "Mixed Breed","Unknown",
];

export const ALL_BREEDS_CAT = [
  "","Domestic Shorthair","Domestic Longhair","Domestic Medium Hair","Siamese","Maine Coon",
  "Persian","Tabby Mix","Ragdoll","Bengal","Abyssinian","Russian Blue","Sphynx",
  "Calico","Tortoiseshell","Tuxedo","Orange Tabby","Mixed Breed","Unknown",
];

export const ALL_COLORS = [
  "","Black","White","Brown","Tan","Golden","Cream","Gray","Blue","Red","Orange","Fawn",
  "Brindle","Merle","Sable","Calico","Tortoiseshell","Tuxedo","Tabby","Spotted",
  "Tricolor","Bicolor","Chocolate","Liver","Buff","Yellow","Apricot",
];

export const EUTH_DRUGS = [
  "Euthasol (Pentobarbital Sodium)","Fatal-Plus","SomnaSol","Tributame","Beuthanasia-D",
];

export const EUTH_REASONS = [
  "Owner Request",
  "Medical — Suffering / Quality of Life",
  "Medical — Untreatable Condition",
  "Medical — Infectious Disease",
  "Kennel Decline",
  "Behavioral — Aggression (Dog to Dog)",
  "Behavioral — Aggression (Dog to Human)",
  "Behavioral — Aggression (Cat)",
  "Behavioral — Feral / Unsocialized",
  "Behavioral — Severe Anxiety / Fear",
  "Court Ordered",
  "Bite Case — Rabies Testing Required",
  "Space / Capacity",
  "Dangerous Animal Declaration",
  "Neonatal — Too Young to Survive",
  "Injured — Beyond Treatment",
  "Other",
];

export const CIRCUMSTANCE_TYPES = [
  "Stray (No ID)","Owner Surrender","Transfer In","Confiscation","Born in Shelter",
  "Return","Abandoned","Other",
];

export const COAT_TYPES = ["","Smooth","Wire","Long","Short","Medium","Curly","Double","Hairless"];
export const EAR_TYPES = ["","Erect","Floppy","Semi-erect","Rose","Button","Cropped"];
export const EYE_COLORS = ["","Brown","Blue","Green","Hazel","Amber","Heterochromia"];
export const SIZE_OPTIONS = ["","Small","Medium","Large","Extra Large"];

export const BEHAVIOR_FLAGS = [
  { id: "biter", label: "Biter", icon: "⚠️", color: "#dc2626" },
  { id: "house_trained", label: "House Trained", icon: "🏠", color: "#16a34a" },
  { id: "longterm", label: "Longterm Resident", icon: "📅", color: "#7c3aed" },
  { id: "no_cats", label: "No Cats", icon: "🚫🐈", color: "#dc2626" },
  { id: "no_children", label: "No Children", icon: "🚫👶", color: "#dc2626" },
  { id: "no_dogs", label: "No Dogs", icon: "🚫🐕", color: "#dc2626" },
  { id: "ok_cats", label: "OK with Cats", icon: "✅🐈", color: "#16a34a" },
  { id: "ok_dogs", label: "OK with Dogs", icon: "✅🐕", color: "#16a34a" },
  { id: "ok_kids", label: "OK with Children", icon: "✅👶", color: "#16a34a" },
  { id: "special_needs", label: "Special Needs", icon: "❤️", color: "#e11d48" },
  { id: "special_fee", label: "Special Fee", icon: "💲", color: "#ca8a04" },
  { id: "blood_donor", label: "Blood Donor", icon: "🩸", color: "#dc2626" },
  { id: "feral", label: "Feral", icon: "🐾", color: "#92400e" },
  { id: "declawed", label: "Declawed", icon: "✂️", color: "#6b7280" },
] as const;

export const MORGAN_COUNTY_JURISDICTIONS = [
  "Morgan County",
  "Madison (city limits)",
  "Rutledge (city limits)",
  "Buckhead (city limits)",
  "Bostwick (city limits)",
  "Out of Jurisdiction",
];

// ── Morgan County Chapter 10 — Animal Ordinances ─────────────────────────────
export interface MorganCountyOrdinance {
  code: string;
  title: string;
  article: string;
  section: string;
  description: string;
  fullText: string;
  citable: boolean;
}

export const MORGAN_COUNTY_ORDINANCES: MorganCountyOrdinance[] = [
  // ── Article I ──────────────────────────────────────────────────────────────
  {
    code: "10-1", title: "Purpose", article: "Article I — General Provisions", section: "§ 10-1",
    description: "General purpose of Chapter 10 Animal Ordinances",
    fullText: "The purpose of this chapter is to establish regulations governing animals within Morgan County to protect public health, safety, and welfare, and to ensure the humane treatment of animals.",
    citable: false,
  },
  // ── Article II ─────────────────────────────────────────────────────────────
  {
    code: "10-2", title: "Definitions", article: "Article II — Definitions", section: "§ 10-2",
    description: "Definitions of terms used in Chapter 10",
    fullText: "Definitions applicable throughout Chapter 10, including definitions for 'animal,' 'owner,' 'at large,' 'dangerous dog,' 'vicious dog,' 'feral animal,' 'proper enclosure,' and other relevant terms.",
    citable: false,
  },
  // ── Article III ────────────────────────────────────────────────────────────
  {
    code: "10-3", title: "Jurisdiction and Exceptions", article: "Article III — Jurisdictions, Exceptions, Hearings, ASO Appointment", section: "§ 10-3",
    description: "Jurisdiction and exceptions to definitions for Chapter 10",
    fullText: "Establishes the jurisdiction of Morgan County Animal Services and provides exceptions to the definitions set forth in § 10-2.",
    citable: false,
  },
  {
    code: "10-4", title: "Hearings", article: "Article III — Jurisdictions, Exceptions, Hearings, ASO Appointment", section: "§ 10-4",
    description: "Hearing procedures for animal ordinance enforcement matters",
    fullText: "Establishes procedures for hearings related to enforcement of Chapter 10 animal ordinances, including dangerous dog classifications and appeals.",
    citable: false,
  },
  {
    code: "10-5", title: "Animal Services Officer Appointment", article: "Article III — Jurisdictions, Exceptions, Hearings, ASO Appointment", section: "§ 10-5",
    description: "Appointment of Animal Services Officers authorized to enforce Chapter 10",
    fullText: "Provides for the appointment of Animal Services Officers (ASOs) authorized to enforce the provisions of Chapter 10 within Morgan County.",
    citable: false,
  },
  // ── Article IV ─────────────────────────────────────────────────────────────
  {
    code: "10-6(a)", title: "Rabies Vaccination Required", article: "Article IV — Rabies Vaccination and Identification", section: "§ 10-6",
    description: "Failure to inoculate animal against rabies — all animals over 4 months must be vaccinated by a licensed veterinarian",
    fullText: "(a) All animals over four (4) months of age must be inoculated against rabies by a licensed veterinarian. It shall be unlawful to own or harbor any animal that has not been so inoculated. Violation is a misdemeanor.",
    citable: true,
  },
  {
    code: "10-6(b)", title: "Certificate of Inoculation Required", article: "Article IV — Rabies Vaccination and Identification", section: "§ 10-6",
    description: "Failure to maintain certificate of rabies inoculation issued by veterinarian",
    fullText: "(b) A certificate of inoculation shall be issued by the veterinarian at the time of vaccination and shall be retained by the owner as proof of compliance.",
    citable: true,
  },
  {
    code: "10-6(c)", title: "Rabies Tag Required on Collar", article: "Article IV — Rabies Vaccination and Identification", section: "§ 10-6",
    description: "Failure to secure rabies tag to animal's collar — tag must be worn at all times",
    fullText: "(c) A rabies vaccination tag shall be secured to the collar of the animal at all times, both on and off the owner's premises.",
    citable: true,
  },
  // ── Article V ──────────────────────────────────────────────────────────────
  {
    code: "10-7(a)", title: "Animal Fighting Prohibited", article: "Article V — Enforcement", section: "§ 10-7",
    description: "Organizing, promoting, or participating in dogfighting, cockfighting, bullfighting, or combat between animals or between animals and humans",
    fullText: "(a) No person shall organize, promote, participate in, or be present at any fight between animals or between animals and humans, including but not limited to dogfighting, cockfighting, and bullfighting.",
    citable: true,
  },
  {
    code: "10-7(b)", title: "Abandonment of Animal", article: "Article V — Enforcement", section: "§ 10-7",
    description: "Abandoning any animal — placing animal on public/private property unattended without permission of property owner",
    fullText: "(b) No person shall abandon any animal. 'Abandon' means placing an animal on public property or within a public building unattended or uncared for, or on or within the private property of another without the express permission of the owner or occupant of such property.",
    citable: true,
  },
  {
    code: "10-7(d)", title: "Excessive Animal Noise — Nuisance", article: "Article V — Enforcement", section: "§ 10-7",
    description: "Animal emitting excessively loud and disturbing noise — barking, howling, yelping, or crowing that unreasonably disturbs the neighborhood",
    fullText: "(d) No dog or other animal shall be allowed to emit excessively loud and disturbing noise, including excessive barking, howling, yelping, crowing, or other sounds that unreasonably disturb the peace and quiet of a neighborhood.",
    citable: true,
  },
  {
    code: "10-7(f)", title: "Animal Nuisance", article: "Article V — Enforcement", section: "§ 10-7",
    description: "Allowing animal to be a nuisance — damaging property, chasing vehicles, attacking other animals, trespassing on school grounds",
    fullText: "(f) No animal may be allowed to become a nuisance. A nuisance animal includes any animal that: (1) damages property of anyone other than its owner; (2) chases vehicles; (3) attacks other domestic animals; (4) trespasses on school grounds; or (5) otherwise disturbs the peace and quiet of the neighborhood.",
    citable: true,
  },
  {
    code: "10-7(g)", title: "Animal Cruelty — Abuse / Deprivation", article: "Article V — Enforcement", section: "§ 10-7",
    description: "Cruelty to animal: overloading, whipping, beating, maiming, bruising, depriving of food/water/shelter, torturing, mutilating, or confining in a cruel manner",
    fullText: "(g) It shall be unlawful to overload, whip, beat, maim, bruise, deprive of necessary food, water, or shelter, torture, needlessly mutilate or kill, carry or confine in a cruel manner, or otherwise abuse any animal.",
    citable: true,
  },
  {
    code: "10-7(h)", title: "Animal Cruelty — Pain / Suffering / Death", article: "Article V — Enforcement", section: "§ 10-7",
    description: "Causing unnecessary pain, suffering, or death of any animal by any act or omission",
    fullText: "(h) It shall be unlawful to cause unnecessary pain, suffering, or death of any animal by any means, including by any act or omission.",
    citable: true,
  },
  {
    code: "10-7(i)", title: "Failure to Provide Humane Care", article: "Article V — Enforcement", section: "§ 10-7",
    description: "Failure to provide humane care: adequate food, clean water, appropriate shelter, necessary veterinary care, and sanitary conditions",
    fullText: "(i) It shall be unlawful to fail to provide humane care to any animal, including adequate food, clean water, shelter appropriate to the weather, necessary veterinary care, and sanitary conditions sufficient to maintain the animal's health.",
    citable: true,
  },
  {
    code: "10-7(j)", title: "Abandonment of Dead Animal", article: "Article V — Enforcement", section: "§ 10-7",
    description: "Abandoning a dead animal on public or private property, roads, ditches, or waterways",
    fullText: "(j) It shall be unlawful to abandon a dead animal on any public or private property, including roads, ditches, or waterways.",
    citable: true,
  },
  {
    code: "10-7(k)", title: "Improper Dead Animal Disposal", article: "Article V — Enforcement", section: "§ 10-7",
    description: "Failure to properly dispose of dead animal — must be buried at least 3 feet deep within 12 hours of death",
    fullText: "(k) Dead animal disposal requirements: any dead animal must be buried at least three (3) feet deep within twelve (12) hours of death, or disposed of by another method approved by the county.",
    citable: true,
  },
  {
    code: "10-7(l)", title: "Animal at Large", article: "Article V — Enforcement", section: "§ 10-7",
    description: "Animal at large — animal off owner's property and not under immediate physical control (no leash or confinement)",
    fullText: "(l) No animal shall be allowed to run at large. All animals shall remain under the immediate control of the owner or keeper at all times when off the owner's property. 'At large' means off the property of the owner and not under direct physical control by leash, crate, or vehicle.",
    citable: true,
  },
  // ── Article VI ─────────────────────────────────────────────────────────────
  {
    code: "10-8", title: "Defense of Person or Property", article: "Article VI — Defense of Property; Impounds by Public", section: "§ 10-8",
    description: "Defense of person or property from attacking animal — reasonable actions permitted to repel attack",
    fullText: "Any person may take such reasonable actions as may be necessary to defend themselves, another person, or their property from an attacking or biting animal, provided such actions are no more than necessary to repel the attack.",
    citable: false,
  },
  {
    code: "10-9", title: "Private Party Impounds", article: "Article VI — Defense of Property; Impounds by Public", section: "§ 10-9",
    description: "Procedures for private party impoundment of at-large animals",
    fullText: "Any person may impound an at-large animal by delivering it to the county animal shelter or notifying an Animal Services Officer. The person impounding shall provide their name and address to the shelter.",
    citable: false,
  },
  // ── Article VII ────────────────────────────────────────────────────────────
  {
    code: "10-10(a)", title: "Tethering as Permanent Confinement — Prohibited", article: "Article VII — Tethering", section: "§ 10-10",
    description: "Unlawful to use tethering as the primary or permanent method of confinement — animal must have access to adequate shelter, water, and exercise",
    fullText: "It is unlawful to use tethering as the primary or permanent method of confinement for any animal. Animals must have access to an adequate shelter, clean water, and the ability to exercise.",
    citable: true,
  },
  {
    code: "10-10(b)", title: "Improper Tether Attachment", article: "Article VII — Tethering", section: "§ 10-10",
    description: "Tether attached directly around neck — must be attached to a properly fitted collar or harness, not directly to the animal's neck",
    fullText: "All tethers shall be attached to a well-fitted collar or harness and shall not be attached directly around the neck of the animal. Choke chains or prong collars shall not be used as the sole attachment point for a tether.",
    citable: true,
  },
  {
    code: "10-10(c)", title: "Excessive Tether Weight", article: "Article VII — Tethering", section: "§ 10-10",
    description: "Tether excessively heavy for animal's size — tether weight must not cause injury or distress",
    fullText: "No tether shall be of such weight as to be injurious to the health of the animal or to cause distress. Tethers shall be of appropriate weight and length to allow the animal to move freely within a reasonable area.",
    citable: true,
  },
  // ── Article VIII ───────────────────────────────────────────────────────────
  {
    code: "10-11", title: "Owner Liable for Impound Costs", article: "Article VIII — Owner Liability; Impound Procedures", section: "§ 10-11",
    description: "Owner responsible for all costs of impoundment — daily care fees, veterinary treatment, and disposition costs",
    fullText: "The owner of any impounded animal shall be liable for all costs of impoundment, including daily care fees, veterinary treatment, and other costs associated with the care and disposition of the animal.",
    citable: true,
  },
  {
    code: "10-12(a)", title: "Failure to Retrieve Impounded Animal", article: "Article VIII — Owner Liability; Impound Procedures", section: "§ 10-12",
    description: "Failure to retrieve impounded animal within 3 business days after notification — animal may be disposed of per county policies",
    fullText: "(a) Upon impoundment, the owner (if known) shall be notified. The owner has three (3) business days from the date of notification to retrieve the animal. Failure to do so may result in disposition of the animal per county policies.",
    citable: true,
  },
  {
    code: "10-12(c)", title: "Failure to Spay/Neuter Adopted Animal", article: "Article VIII — Owner Liability; Impound Procedures", section: "§ 10-12",
    description: "Failure to spay/neuter animal adopted from county shelter within the required timeframe",
    fullText: "(c) All animals adopted from the county animal shelter must be spayed or neutered. Animals adopted before reaching appropriate age must be sterilized within the timeframe specified at adoption.",
    citable: true,
  },
  // ── Article IX ─────────────────────────────────────────────────────────────
  {
    code: "10-14(a)", title: "Failure to Register Dangerous/Vicious Dog", article: "Article IX — Dangerous and Vicious Dogs", section: "§ 10-14",
    description: "Possessing a classified dangerous or vicious dog without a valid certificate of registration from the county",
    fullText: "No person shall possess a dangerous or vicious dog without a current certificate of registration. Registration requires: proper enclosure, sterilization, rabies vaccination, microchipping, warning signs at all entrances, and (for vicious dogs) $50,000 liability insurance. Annual fee required.",
    citable: true,
  },
  {
    code: "10-14(b)", title: "Failure to Maintain Proper Enclosure — Dangerous Dog", article: "Article IX — Dangerous and Vicious Dogs", section: "§ 10-14",
    description: "Dangerous or vicious dog not maintained in a proper enclosure as required — enclosure must prevent escape and entry by unauthorized persons",
    fullText: "All classified dangerous and vicious dogs must be maintained in a proper enclosure designed to prevent the animal from escaping and to prevent entry by unauthorized persons, particularly children.",
    citable: true,
  },
  {
    code: "10-14(c)", title: "Missing Warning Signs — Dangerous Dog", article: "Article IX — Dangerous and Vicious Dogs", section: "§ 10-14",
    description: "Failure to post required warning signs at all entrances to property where a classified dangerous or vicious dog is kept",
    fullText: "Warning signs clearly indicating the presence of a dangerous or vicious dog must be posted at all entrances to the premises where such a dog is kept.",
    citable: true,
  },
  {
    code: "10-15(a)", title: "Dangerous Dog — Improper Restraint Outside Enclosure", article: "Article IX — Dangerous and Vicious Dogs", section: "§ 10-15",
    description: "Dangerous dog outside proper enclosure without a substantial chain or leash (max 6 ft) and direct control of a responsible person",
    fullText: "(a) A dangerous dog may only be outside its proper enclosure when restrained by a substantial chain or leash not exceeding six (6) feet in length and under the direct control of a responsible person. The dog shall not be chained to a fixed point as a substitute for direct supervision.",
    citable: true,
  },
  {
    code: "10-15(b)", title: "Vicious Dog — Improper Restraint Outside Enclosure", article: "Article IX — Dangerous and Vicious Dogs", section: "§ 10-15",
    description: "Vicious dog outside proper enclosure without muzzle AND leash (max 6 ft) under direct control of a responsible person — all three conditions required",
    fullText: "(b) A vicious dog may only be outside its proper enclosure when: (1) muzzled in a manner that prevents biting but does not cause injury; (2) restrained by a leash not exceeding six (6) feet; and (3) under the direct control of a responsible person.",
    citable: true,
  },
  {
    code: "10-16", title: "Confiscation of Dangerous/Vicious Dog", article: "Article IX — Dangerous and Vicious Dogs", section: "§ 10-16",
    description: "Grounds for confiscation of classified dangerous or vicious dog — not properly confined, registration lapsed, or imminent threat to public safety",
    fullText: "An Animal Services Officer is authorized to confiscate a classified dangerous or vicious dog when: the dog is not properly confined; the owner fails to maintain required registration; or the dog poses an imminent threat to public safety.",
    citable: false,
  },
  // ── Article X ──────────────────────────────────────────────────────────────
  {
    code: "10-17(a)", title: "Failure to Register Exotic Animal", article: "Article X — Wild and Exotic Animals", section: "§ 10-17",
    description: "Possessing a wild or exotic animal without a county certificate of registration and required state/federal licensing",
    fullText: "(a) No person shall possess a wild or exotic animal within Morgan County without: (1) a valid certificate of registration issued by the county; and (2) all applicable state and federal licenses and permits required for such possession.",
    citable: true,
  },
  {
    code: "10-17(b)", title: "Failure to Report Exotic Animal Escape", article: "Article X — Wild and Exotic Animals", section: "§ 10-17",
    description: "Failure to immediately notify Animal Services Officer upon escape or release of a registered exotic animal",
    fullText: "(b) The owner of any registered exotic animal must immediately notify the Animal Services Officer upon escape or release of the animal. Failure to provide immediate notification is a violation of this section.",
    citable: true,
  },
  // ── Article XI ─────────────────────────────────────────────────────────────
  {
    code: "10-18", title: "Violations and Penalties", article: "Article XI — Penalties; Liability; Pursuit; Interference", section: "§ 10-18",
    description: "Violation of Chapter 10 — misdemeanor per § 1-9; each day a continuing violation constitutes a separate offense",
    fullText: "Any violation of the provisions of this chapter shall constitute a misdemeanor as provided in § 1-9 of the Morgan County Code. Each day any violation continues shall constitute a separate and distinct offense.",
    citable: true,
  },
  {
    code: "10-19", title: "Owner Liability for Damages", article: "Article XI — Penalties; Liability; Pursuit; Interference", section: "§ 10-19",
    description: "Owner solely liable for all damages and injuries caused by their animal — civil liability in addition to criminal penalties",
    fullText: "The owner of any animal shall be solely liable for all damages and injuries caused by such animal to any person, property, or other animal. This liability is in addition to any criminal penalties that may be imposed.",
    citable: false,
  },
  {
    code: "10-20(a)", title: "ASO Authority to Enter Premises in Pursuit", article: "Article XI — Penalties; Liability; Pursuit; Interference", section: "§ 10-20",
    description: "Animal Services Officer authorized to enter premises when in pursuit of an animal to be seized",
    fullText: "(a) An Animal Services Officer is authorized to go upon any premises to seize or attempt to seize any animal when such animal is being pursued for seizure or when the officer has reasonable cause to believe the animal is on the premises.",
    citable: false,
  },
  {
    code: "10-20(b)", title: "Interference with Animal Services Officer", article: "Article XI — Penalties; Liability; Pursuit; Interference", section: "§ 10-20",
    description: "Interfering with, hindering, resisting, or obstructing an Animal Services Officer in the performance of official duties",
    fullText: "(b) It is unlawful for any person to interfere with, hinder, resist, or obstruct any Animal Services Officer while in the performance of official duties under this chapter. Violation is a misdemeanor.",
    citable: true,
  },
  // ── Article XII ────────────────────────────────────────────────────────────
  {
    code: "10-21", title: "Livestock and Fowl Regulations", article: "Article XII — Livestock and Fowl", section: "§ 10-21",
    description: "Violation of livestock/fowl regulations based on zoning district — AG/AR, residential, or common development requirements",
    fullText: "Regulates the keeping of livestock and fowl based on zoning district. Requirements vary for agricultural/rural (AG/AR) districts, common residential developments, and standard residential areas. Minimum lot size, setback, and care requirements apply.",
    citable: true,
  },
  {
    code: "10-22", title: "FFA and 4-H Project Exemption", article: "Article XII — Livestock and Fowl", section: "§ 10-22",
    description: "Exemption for FFA and 4-H project animals from certain livestock regulations subject to county approval",
    fullText: "Animals kept as part of FFA (Future Farmers of America) or 4-H projects may be exempt from certain livestock and fowl regulations, subject to county approval and compliance with applicable state and federal agricultural guidelines.",
    citable: false,
  },
];

export const CITABLE_ORDINANCES = MORGAN_COUNTY_ORDINANCES.filter((o) => o.citable);

export const CALL_TYPES = [
  "Stray Animal","Animal Cruelty","Welfare Check","Noise Complaint","Bite Report",
  "Loose Livestock","Injured Animal","Abandoned Animal","Wildlife Concern","Hoarding Report",
];
export const CALL_PRIORITIES = ["Critical","High","Medium","Low"];
export const PRIORITY_COLORS: Record<string, string> = {
  Critical: "#dc2626", High: "#f59e0b", Medium: "#0ea5e9", Low: "#6b7280",
};
export const CALL_STATUSES = ["Pending","Dispatched","En Route","On Scene","Resolved","Cancelled"];
export const CALL_STATUS_COLORS: Record<string, string> = {
  Pending: "#f59e0b", Dispatched: "#6366f1", "En Route": "#0ea5e9",
  "On Scene": "#e8590c", Resolved: "#16a34a", Cancelled: "#9ca3af",
};
export const OFFICER_STATUSES = ["Available","On Call","En Route","Busy","Off Duty"];
export const OFFICER_STATUS_COLORS: Record<string, string> = {
  Available: "#16a34a", "On Call": "#0ea5e9", "En Route": "#f59e0b",
  Busy: "#e8590c", "Off Duty": "#9ca3af",
};

export const RECEIPT_CATEGORIES = ["Services","Donations","Merchandise"] as const;
export const SERVICE_ITEMS = [
  "Adoption Fee","Reclaim Fee","Surrender Fee","Boarding Fee","Microchip",
  "Rabies Vaccination","Spay/Neuter","Licensing","Euthanasia Fee","Cremation",
  "Bite Quarantine","Impound Fee","Other Service",
];
export const DONATION_ITEMS = [
  "General Donation","Medical Fund","Building Fund","Memorial Donation","Sponsorship",
  "Event Donation","In-Kind Donation","Other Donation",
];
export const MERCH_ITEMS = [
  "T-Shirt","Hat","Dog Leash","Dog Collar","Cat Carrier","Pet Food","Pet Toy",
  "Treat Bag","Water Bowl","Sticker/Magnet","Calendar","Other Merchandise",
];
export const PAYMENT_METHODS = [
  "Cash","Check","Credit Card","Debit Card","Money Order","Online/Venmo","Other",
];

export const PERSON_ROLES = [
  "Adopter","Previous Owner","Foster Parent","Volunteer","Witness","Complainant",
  "Veterinarian","Donor","Attorney","Animal Control Officer","Court Contact",
  "Media","Other",
];

export const DEFAULT_SHELTER_CONFIG = [
  { id: "cat-room", name: "Cat Room", type: "label", x: 40, y: 30, w: 220, h: 160, bg: "#b8c6f0" },
  { id: "cat-kennels", name: "Cat Kennels", type: "kennels", layout: "grid-2", labels: ["A-1","A-2","A-3","A-4","B-1","B-2","B-3","B-4","C-1","C-2","C-3","C-4"], x: 30, y: 220, w: 130, h: 380 },
  { id: "quarantine", name: "Quarantine", type: "kennels", layout: "col-1", labels: ["Q-1","Q-2","Q-3","Q-4","Q-5","Q-6","Q-7"], x: 320, y: 30, w: 65, h: 270 },
  { id: "d-kennels", name: "D-Kennels", type: "kennels", layout: "col-1", labels: ["D-1","D-2","D-3","D-4","D-5","D-6"], x: 395, y: 30, w: 65, h: 240 },
  { id: "rainbow", name: "Rainbow Room", type: "kennels", layout: "grid-2", labels: ["R-1","R-2","R-3","R-4","R-5","R-6"], x: 200, y: 350, w: 120, h: 140 },
  { id: "bc-kennels", name: "B/C Kennels", type: "kennels", layout: "grid-2", labels: ["C-1","C-2","C-3","C-4","C-5","C-6","C-7","C-8","C-9","C-10","C-11","C-12","B-1","B-2","B-3","B-4","B-5","B-6","B-7","B-8","B-9","B-10","B-11","B-12"], x: 480, y: 50, w: 140, h: 430 },
  { id: "a-kennels", name: "A-Kennels", type: "kennels", layout: "col-1", labels: ["A-1","A-2","A-3","A-4","A-5","A-6","A-7","A-8","A-9","A-10","A-11","A-12","A-13","A-14","A-15"], x: 640, y: 30, w: 65, h: 480 },
  { id: "medical", name: "Medical Room", type: "kennels", layout: "grid-2", labels: ["M-1","M-2","M-3","M-4"], x: 320, y: 380, w: 100, h: 80 },
  { id: "front-office", name: "Front Office", type: "label", x: 350, y: 500, w: 180, h: 45, bg: "#e5e7eb" },
  { id: "storage", name: "Storage Room", type: "label", x: 550, y: 500, w: 155, h: 45, bg: "#e5e7eb" },
];

export const STAFF_ACCOUNTS = [
  { id: "S-001", username: "admin", password: "admin123", firstName: "Alex", lastName: "Rivera", role: "Administrator", avatar: "AR", department: "Management", permissions: ["all"] },
  { id: "S-002", username: "jsmith", password: "pass123", firstName: "Jamie", lastName: "Smith", role: "Shelter Manager", avatar: "JS", department: "Operations", permissions: ["animals","adoptions","foster","medical","kennels","people","reports","dispatch"] },
  { id: "S-003", username: "mgarcia", password: "pass123", firstName: "Maria", lastName: "Garcia", role: "Veterinarian", avatar: "MG", department: "Medical", permissions: ["animals","medical","kennels"] },
  { id: "S-004", username: "dwilson", password: "pass123", firstName: "David", lastName: "Wilson", role: "Adoption Counselor", avatar: "DW", department: "Adoptions", permissions: ["animals","adoptions","people"] },
  { id: "S-005", username: "tbrown", password: "pass123", firstName: "Taylor", lastName: "Brown", role: "Animal Care Tech", avatar: "TB", department: "Animal Care", permissions: ["animals","medical","kennels","foster"] },
  { id: "S-006", username: "klee", password: "pass123", firstName: "Kevin", lastName: "Lee", role: "Field Officer", avatar: "KL", department: "Dispatch", permissions: ["animals","dispatch"] },
  { id: "S-007", username: "njones", password: "pass123", firstName: "Nicole", lastName: "Jones", role: "Volunteer Coordinator", avatar: "NJ", department: "Community", permissions: ["people","foster","reports"] },
  { id: "S-008", username: "rmartin", password: "pass123", firstName: "Rachel", lastName: "Martin", role: "Front Desk", avatar: "RM", department: "Reception", permissions: ["animals","people","adoptions"] },
  { id: "S-009", username: "court", password: "court123", firstName: "Morgan County", lastName: "Court", role: "Court Clerk", avatar: "MC", department: "Court", permissions: ["court"] },
  { id: "S-010", username: "judge", password: "court123", firstName: "Judge", lastName: "Harrison", role: "Judge", avatar: "JH", department: "Court", permissions: ["court"] },
  { id: "S-011", username: "volunteer", password: "vol123", firstName: "Volunteer", lastName: "Portal", role: "Volunteer", avatar: "VP", department: "Community", permissions: ["dashboard","volunteers","animals","adoptions","medical"] },
];

export const NAV_ITEMS = [
  { id: "dashboard", icon: "dashboard", label: "Dashboard" },
  { id: "animals", icon: "paw", label: "Animals" },
  { id: "adoptions", icon: "adoption", label: "Adoptions" },
  { id: "foster", icon: "foster", label: "Foster Care" },
  { id: "medical", icon: "medical", label: "Medical" },
  { id: "dispatch", icon: "dispatch", label: "Dispatch" },
  { id: "kennels", icon: "kennel", label: "Kennels" },
  { id: "people", icon: "people", label: "People" },
  { id: "receipts", icon: "report", label: "Receipts" },
  { id: "reports", icon: "report", label: "Reports" },
  { id: "citations", icon: "dispatch", label: "Citations" },
  { id: "court", icon: "dispatch", label: "Court Portal" },
  { id: "volunteers", icon: "people", label: "Volunteers" },
  { id: "admin", icon: "admin", label: "Admin" },
];
