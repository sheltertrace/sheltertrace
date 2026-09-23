import { NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";
import { MCAS_SEAL_LOGO } from "@/lib/mcasLogo";
import { LOGO_TOKEN, stripPageRules } from "@/lib/courtPacket/htmlUtil";
import { isActiveStaff } from "@/lib/courtPacket/serverAuth";

// Renders ONE packet section (an HTML document) to a PDF with headless
// Chromium. The client calls this once per section/document so no single
// request has to hold a whole packet (photos and all) inside a serverless
// timeout, and can show real progress between calls.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_HTML_BYTES = 4_000_000;

function localBrowserPath(): string | undefined {
  if (process.env.CHROME_EXECUTABLE_PATH) return process.env.CHROME_EXECUTABLE_PATH;
  const candidates = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  return candidates.find((p) => existsSync(p));
}

async function launchBrowser() {
  const serverless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (serverless) {
    return puppeteer.launch({
      args: await puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
      executablePath: await chromium.executablePath(),
      headless: "shell",
    });
  }
  const executablePath = localBrowserPath();
  if (!executablePath) throw new Error("No local Chrome/Edge found — set CHROME_EXECUTABLE_PATH");
  return puppeteer.launch({ executablePath, headless: /headless-shell/i.test(executablePath) ? "shell" : true });
}

export async function POST(req: Request) {
  if (!(await isActiveStaff(req.headers.get("x-staff-id")))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_HTML_BYTES) return NextResponse.json({ error: "Section too large" }, { status: 413 });

  let body: { html?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body.html || typeof body.html !== "string") return NextResponse.json({ error: "html required" }, { status: 400 });

  // Defence in depth: the client already strips these, but the render step
  // owns page geometry so re-strip anything that slipped through.
  const html = stripPageRules(body.html).split(LOGO_TOKEN).join(MCAS_SEAL_LOGO);

  const supabaseHost = (() => { try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").host; } catch { return ""; } })();

  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    // Rendering user-authored record text: no scripts, and the network is
    // limited to inline data and the Supabase storage host (evidence photos).
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on("request", (r) => {
      const u = r.url();
      if (u.startsWith("data:") || u === "about:blank") return void r.continue();
      try {
        const parsed = new URL(u);
        if (parsed.protocol === "https:" && supabaseHost && parsed.host === supabaseHost) return void r.continue();
      } catch { /* fall through to abort */ }
      void r.abort();
    });
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    const pdf = await page.pdf({
      format: "letter",
      printBackground: true,
      margin: { top: "0.6in", right: "0.6in", bottom: "0.85in", left: "0.6in" },
    });
    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error("[court-packet/render]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Render failed" }, { status: 500 });
  } finally {
    await browser?.close().catch(() => {});
  }
}
