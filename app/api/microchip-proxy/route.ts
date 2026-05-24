import { NextRequest, NextResponse } from "next/server";

// Known registry names to look for in HTML
const REGISTRY_NAMES = [
  "HomeAgain", "24PetWatch", "AKC Reunite", "PetLink",
  "AVID", "Datamars", "Nanochip", "Trovan",
];

// Strings that indicate no records were found
const NOT_FOUND_SIGNALS = [
  "no records", "not found", "no chip", "no match", "no results",
  "0 results", "unable to locate",
];

export async function GET(req: NextRequest) {
  const chip = req.nextUrl.searchParams.get("chip")?.trim();
  if (!chip) {
    return NextResponse.json({ error: "chip parameter required" }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    // Best-effort fetch of the AAHA lookup tool.
    //
    // KNOWN LIMITATION: petmicrochiplookup.org renders search results via
    // JavaScript after a form submission. A server-side HTML fetch only gets
    // the initial page shell — the actual registry results won't be in the HTML.
    // This route returns { registered: false, error: "js_rendered" } in that case,
    // and the UI falls back to the direct-link panel automatically.
    const res = await fetch(
      `https://www.petmicrochiplookup.org/?q=${encodeURIComponent(chip)}`,
      {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Cache-Control": "no-cache",
        },
        // Disable Next.js response caching — results change per chip
        cache: "no-store",
      }
    );

    clearTimeout(timer);

    if (!res.ok) {
      return NextResponse.json(
        { registered: false, error: `upstream_${res.status}` },
        { status: 200 }
      );
    }

    const html = (await res.text()).toLowerCase();

    // Did we get a real results page or just the initial form?
    // A JS-rendered site sends the same shell regardless of the chip number.
    const hasResultSection =
      html.includes("result") || html.includes("registry") || html.includes("registered");

    if (!hasResultSection) {
      // Proxy only got the page shell — JS rendering required
      return NextResponse.json(
        { registered: false, error: "js_rendered" },
        { status: 200 }
      );
    }

    // Check for not-found signals
    const notFound = NOT_FOUND_SIGNALS.some((s) => html.includes(s));
    if (notFound) {
      return NextResponse.json({ registered: false, message: "No registry records found" });
    }

    // Try to identify which registry holds the record
    const registry = REGISTRY_NAMES.find((r) => html.includes(r.toLowerCase()));
    return NextResponse.json({ registered: true, registry });
  } catch (err: unknown) {
    clearTimeout(timer);
    const isTimeout = (err as Error)?.name === "AbortError";
    return NextResponse.json(
      {
        registered: false,
        error: isTimeout ? "timeout" : "unreachable",
      },
      { status: 200 }
    );
  }
}
