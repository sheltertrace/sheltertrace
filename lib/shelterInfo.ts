// Central shelter identity constants used by all print/PDF modules.
// When NEXT_PUBLIC_IS_DEMO=true, swap to the demo shelter identity so
// printed documents don't show "Morgan County Animal Services" on the demo.

import { IS_DEMO } from "./demo";
import { MCAS_SEAL_LOGO } from "./mcasLogo";

export const AGENCY_NAME    = IS_DEMO ? "Maplewood Animal Services"              : "Morgan County Animal Services";
export const AGENCY_ADDRESS = IS_DEMO ? "123 Demo Street, Maplewood, GA 30650"   : "2392 Athens Hwy, Madison, GA 30650";
export const AGENCY_PHONE   = IS_DEMO ? "(555) 000-9999"                         : "(706) 752-1195";
export const AGENCY_EMAIL   = IS_DEMO ? "info@demo.sheltertrace.com"             : "info@morgancountyga.gov";
export const AGENCY_SHORT   = IS_DEMO ? "Maplewood AS"                           : "MCAS";
// Full one-line identifier used in footers
export const AGENCY_FULL = `${AGENCY_NAME} · ${AGENCY_ADDRESS} · ${AGENCY_PHONE}`;

// Seal / logo src used in print documents.
// Demo: ShelterTrace logo (no MCAS branding). Production: MCAS shield base64.
export const AGENCY_SEAL_LOGO: string = IS_DEMO ? "/logo.jpg" : MCAS_SEAL_LOGO;

// Court names
export const COURT_MAGISTRATE = IS_DEMO ? "Demo County Magistrate Court" : "Morgan County Magistrate Court";
export const COURT_STATE      = IS_DEMO ? "Demo County State Court"      : "Morgan County State Court";
export const COUNTY_NAME      = IS_DEMO ? "Demo County"                  : "Morgan County";

// ── Demo ordinances ────────────────────────────────────────────────────────────
// Generic animal control ordinances used on the demo deployment.
// Same interface as MorganCountyOrdinance so they're drop-in compatible.

import type { MorganCountyOrdinance } from "./constants";

const DEMO_ORDINANCES_DATA: MorganCountyOrdinance[] = [
  { code:"10-1", title:"Animal at Large", article:"Article I — General Provisions", section:"§ 10-1",
    description:"Failure to keep animal under restraint or within a proper enclosure",
    fullText:"It shall be unlawful for any owner or custodian of an animal to allow or permit the animal to run at large within the county. Animals must be kept on a leash, within a fenced enclosure, or otherwise properly restrained at all times.", citable:true },
  { code:"10-2", title:"Failure to License", article:"Article II — Licensing", section:"§ 10-2",
    description:"Failure to obtain required animal license or registration",
    fullText:"All dogs and cats over six (6) months of age must be licensed with the County Animal Services office annually. Proof of current rabies vaccination is required at time of licensing. Failure to obtain or renew a required license is a misdemeanor.", citable:true },
  { code:"10-3", title:"Cruelty/Neglect", article:"Article III — Animal Welfare", section:"§ 10-3",
    description:"Cruelty, neglect, or failure to provide adequate food, water, and shelter",
    fullText:"It shall be unlawful for any person to engage in cruelty to any animal or to fail to provide an animal under their care with adequate food, clean water, shelter appropriate to the weather, necessary veterinary care, and sanitary conditions sufficient to maintain the animal's health.", citable:true },
  { code:"10-4", title:"Nuisance Animal", article:"Article III — Animal Welfare", section:"§ 10-4",
    description:"Permitting an animal to constitute a public nuisance — excessive noise, odor, waste",
    fullText:"It shall be unlawful for any owner or custodian of an animal to permit the animal to become a public nuisance, including but not limited to excessive barking, howling, offensive odors, or accumulation of animal waste that disturbs the peace and quiet of a neighborhood.", citable:true },
  { code:"10-5", title:"Dangerous Animal", article:"Article IV — Dangerous and Vicious Animals", section:"§ 10-5",
    description:"Failure to properly confine or register a dangerous or vicious animal",
    fullText:"Any animal classified as dangerous or vicious must be registered with the County Animal Services, kept in a proper enclosure at all times, and must not be outside the enclosure unless muzzled and on a secure leash. Failure to comply is a misdemeanor.", citable:true },
  { code:"10-6", title:"Rabies Violation", article:"Article V — Rabies Control", section:"§ 10-6",
    description:"Failure to vaccinate animal against rabies or to produce proof of vaccination",
    fullText:"All dogs, cats, and ferrets over four (4) months of age must be inoculated against rabies by a licensed veterinarian. Owners must retain proof of vaccination. It shall be unlawful to own, harbor, or keep any animal that has not been so vaccinated.", citable:true },
  { code:"10-7", title:"Bite Report Failure", article:"Article V — Rabies Control", section:"§ 10-7",
    description:"Failure to report an animal bite to Animal Services within 24 hours",
    fullText:"Any person who owns or is in custody of an animal that bites or otherwise causes an injury to a person or another animal must report the incident to County Animal Services within twenty-four (24) hours. Failure to report is a misdemeanor.", citable:true },
  { code:"10-8", title:"Tethering Violation", article:"Article VI — Tethering", section:"§ 10-8",
    description:"Use of tethering as the primary or sole method of animal confinement",
    fullText:"It is unlawful to use tethering as the primary or permanent method of confinement for any animal. Animals must have access to adequate shelter, clean water, and the ability to exercise. Tethering that causes injury, restricts normal posture, or results in entanglement is prohibited.", citable:true },
];

import { MORGAN_COUNTY_ORDINANCES, CITABLE_ORDINANCES as MCAS_CITABLE } from "./constants";

export function getOrdinances(): MorganCountyOrdinance[] {
  return IS_DEMO ? DEMO_ORDINANCES_DATA : MORGAN_COUNTY_ORDINANCES;
}

export function getCitableOrdinances(): MorganCountyOrdinance[] {
  return IS_DEMO ? DEMO_ORDINANCES_DATA.filter(o => o.citable) : MCAS_CITABLE;
}
