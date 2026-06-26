// IDEXX VetConnect PLUS integration — types, constants, API helpers.
// Uses only btoa + fetch (universal) — safe to import in client components.

export const IDEXX_SANDBOX_BASE = "https://api-sandbox.idexx.com/vetconnect/v1";
export const IDEXX_PROD_BASE    = "https://api.idexx.com/vetconnect/v1";

export interface IdexxConfig {
  agent_username:       string;
  agent_password:       string;
  vetconnect_username:  string;
  vetconnect_password:  string;
  account_number:       string;
  auto_sync:            boolean;
  use_sandbox:          boolean;
  webhook_secret:       string;
  // Legacy fields kept for backward compat with existing saved configs
  practice_id?:         string;
  api_key?:             string;
  api_secret?:          string;
}

// ShelterTrace test type → IDEXX SNAP test code
export const IDEXX_TEST_CODES: Record<string, string> = {
  "Heartworm Test":      "4DX",
  "FIV/FeLV Combo Test": "FELV",
  "Parvo Test":          "PARVO",
  "FIV Test":            "FIV",
  "FeLV Test":           "FELV_ONLY",
};

export function getIdexxTestCode(testType: string): string | null {
  return IDEXX_TEST_CODES[testType] ?? null;
}

export function idexxBaseUrl(config: Pick<IdexxConfig, "use_sandbox">): string {
  return config.use_sandbox ? IDEXX_SANDBOX_BASE : IDEXX_PROD_BASE;
}

function idexxHeaders(config: IdexxConfig): Record<string, string> {
  const creds = btoa(`${config.vetconnect_username}:${config.vetconnect_password}`);
  return {
    Authorization:         `Basic ${creds}`,
    "Content-Type":        "application/json",
    "X-IDEXX-Account":     config.account_number || "",
  };
}

export interface IdexxOrderPayload {
  practice_id:      string;
  account_number:   string;
  external_id:      string;
  test_code:        string;
  requesting_staff: string;
  patient: {
    name:       string;
    species:    string;
    breed:      string;
    age_years:  number;
    sex:        string;
    weight_lbs?: number;
  };
}

export interface IdexxOrderResult {
  order_id:         string;
  accession_number: string;
  status:           string;
}

export interface IdexxResultPayload {
  order_id:         string;
  accession_number: string;
  status:           string;
  result:           "POSITIVE" | "NEGATIVE" | "INCONCLUSIVE" | "PENDING";
  result_data:      Record<string, unknown>;
  resulted_at:      string;
  report_url?:      string;
}

export function mapIdexxResult(result: string): "Positive" | "Negative" | "Inconclusive" | "Pending" {
  switch ((result ?? "").toUpperCase()) {
    case "POSITIVE":     return "Positive";
    case "NEGATIVE":     return "Negative";
    case "INCONCLUSIVE": return "Inconclusive";
    default:             return "Pending";
  }
}

export async function idexxTestConnection(
  config: IdexxConfig,
): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${idexxBaseUrl(config)}/health`, {
      method:  "GET",
      headers: idexxHeaders(config),
      signal:  AbortSignal.timeout(8_000),
    });
    if (res.ok) return { ok: true, message: "Connected successfully to IDEXX VetConnect PLUS" };
    const body = await res.text();
    return { ok: false, message: `IDEXX returned ${res.status}: ${body.slice(0, 200)}` };
  } catch (err: unknown) {
    const e = err as Error;
    return { ok: false, message: e.message || "Connection failed" };
  }
}

export async function idexxCreateOrder(
  config: IdexxConfig,
  payload: IdexxOrderPayload,
): Promise<IdexxOrderResult> {
  const res = await fetch(`${idexxBaseUrl(config)}/orders`, {
    method:  "POST",
    headers: idexxHeaders(config),
    body:    JSON.stringify(payload),
    signal:  AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`IDEXX order failed (${res.status}): ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<IdexxOrderResult>;
}

export async function idexxGetResult(
  config: IdexxConfig,
  accessionNumber: string,
): Promise<IdexxResultPayload> {
  const res = await fetch(`${idexxBaseUrl(config)}/results/${accessionNumber}`, {
    headers: idexxHeaders(config),
    signal:  AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`IDEXX get result failed (${res.status})`);
  return res.json() as Promise<IdexxResultPayload>;
}

export async function idexxGetOrder(
  config: IdexxConfig,
  orderId: string,
): Promise<IdexxOrderResult> {
  const res = await fetch(`${idexxBaseUrl(config)}/orders/${orderId}`, {
    headers: idexxHeaders(config),
    signal:  AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`IDEXX get order failed (${res.status})`);
  return res.json() as Promise<IdexxOrderResult>;
}

// ── Demo simulation ────────────────────────────────────────────────────────────

export function demoSimulateOrder(medicalRecordId: string): IdexxOrderResult {
  return {
    order_id:         `DEMO-ORD-${Date.now()}`,
    accession_number: `DEMO-${medicalRecordId.slice(-6).toUpperCase()}`,
    status:           "PENDING",
  };
}

export function demoSimulateResult(accessionNumber: string): IdexxResultPayload {
  const outcomes = ["POSITIVE", "NEGATIVE", "NEGATIVE", "NEGATIVE", "INCONCLUSIVE"] as const;
  const result   = outcomes[Math.floor(Math.random() * outcomes.length)];
  return {
    order_id:         `DEMO-ORD-${Date.now()}`,
    accession_number: accessionNumber,
    status:           "RESULTED",
    result,
    result_data: {
      panels:       [{ name: "SNAP Test Panel", result, note: "Demo simulated — not a real IDEXX result" }],
      performed_by: "IDEXX Reference Labs (Demo Mode)",
      analyzer:     "IDEXX SNAP Analyzer (Simulated)",
    },
    resulted_at: new Date().toISOString(),
  };
}
