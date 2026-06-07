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
