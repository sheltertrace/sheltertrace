// Fails the build if a server-only secret could reach the browser bundle.
// A file is "client" if it starts with "use client", lives under components/, or is
// a page/layout/template; everything it imports (transitively, via relative or "@/")
// is treated as client code too.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const SCAN_DIRS = ["app", "components", "lib"];
const FORBIDDEN = [
  /SUPABASE_SERVICE_ROLE_KEY/,
  /process\.env\.IDEXX_/,
  /process\.env\.CRON_SECRET/,
  /process\.env\.SUPABASE_JWT_SECRET/,
  /process\.env\.STAFF_SESSION_SECRET/,
  /NEXT_PUBLIC_[A-Z_]*(SERVICE_ROLE|JWT_SECRET|SECRET_KEY|IDEXX)/,   // a secret must never be given a public name
  /from ["']@\/lib\/idexxServer["']/,                                 // server-only modules
  /from ["'](\.\.?\/)+idexxServer["']/,
];
const SERVER_ENTRY = /(^|\/)app\/.*\/route\.ts$/;   // API routes are server code

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) { if (f !== "node_modules" && f !== ".next") walk(p, out); }
    else if (/\.(ts|tsx)$/.test(f)) out.push(p);
  }
  return out;
}

function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join(ROOT, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const c of [base + ".ts", base + ".tsx", path.join(base, "index.ts"), path.join(base, "index.tsx")]) if (existsSync(c)) return c;
  return null;
}

const files = SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d)));
const rel = (f: string) => path.relative(ROOT, f).replace(/\\/g, "/");
const src = new Map(files.map((f) => [f, readFileSync(f, "utf8")]));

function importsOf(f: string): string[] {
  const out: string[] = [];
  const re = /(?:import|export)\s[^"';]*?from\s+["']([^"']+)["']|import\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
  for (const m of src.get(f)!.matchAll(re)) {
    const r = resolveImport(f, m[1] || m[2] || m[3]);
    if (r && src.has(r)) out.push(r);
  }
  return out;
}

describe("server-only secrets stay out of client code", () => {
  const clientRoots = files.filter((f) => {
    const r = rel(f);
    if (SERVER_ENTRY.test(r)) return false;
    return /^\s*["']use client["']/.test(src.get(f)!) || r.startsWith("components/") || /(^|\/)(page|layout|template)\.tsx$/.test(r);
  });

  const reachable = new Set<string>();
  const stack = [...clientRoots];
  while (stack.length) {
    const f = stack.pop()!;
    if (reachable.has(f)) continue;
    reachable.add(f);
    for (const i of importsOf(f)) if (!SERVER_ENTRY.test(rel(i))) stack.push(i);
  }

  it("scans a meaningful number of client files", () => {
    expect(reachable.size).toBeGreaterThan(50);
  });

  it("no client-reachable file references a server-only secret or module", () => {
    const offenders: string[] = [];
    for (const f of reachable) {
      const text = src.get(f)!.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      for (const re of FORBIDDEN) if (re.test(text)) offenders.push(`${rel(f)}  ~  ${re}`);
    }
    expect(offenders).toEqual([]);
  });

  it("server-only helpers exist and are only used by API routes", () => {
    expect(existsSync(path.join(ROOT, "lib/idexxServer.ts"))).toBe(true);
    const users = files.filter((f) => f !== path.join(ROOT, "lib/idexxServer.ts") && /from\s+["'][^"']*idexxServer["']/.test(src.get(f)!)).map(rel);
    expect(users.every((u) => SERVER_ENTRY.test(u))).toBe(true);
  });
});

describe("the guard itself", () => {
  it("would catch a leak (self-test of the patterns)", () => {
    const sample = `const k = process.env.SUPABASE_SERVICE_ROLE_KEY; import { x } from "@/lib/idexxServer";`;
    expect(FORBIDDEN.filter((re) => re.test(sample)).length).toBeGreaterThanOrEqual(2);
    expect(FORBIDDEN.some((re) => re.test(`const u = process.env.NEXT_PUBLIC_SUPABASE_URL;`))).toBe(false);
  });
});
