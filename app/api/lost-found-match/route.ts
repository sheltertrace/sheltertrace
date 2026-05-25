import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { LostFoundReport } from "@/lib/types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── Scoring helpers ──────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fuzzyMatch(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();
  return la === lb || la.includes(lb) || lb.includes(la);
}

function scoreReportPair(a: LostFoundReport, b: LostFoundReport): number {
  if (!a.species || !b.species) return 0;
  if (a.species.toLowerCase() !== b.species.toLowerCase()) return 0; // species must match

  let score = 30; // species match

  if (fuzzyMatch(a.breed, b.breed)) score += 20;
  if (fuzzyMatch(a.color, b.color)) score += 15;
  if (a.size && b.size && a.size === b.size) score += 10;
  if (a.sex && b.sex && a.sex !== "Unknown" && b.sex !== "Unknown" && a.sex === b.sex) score += 10;

  // Location
  if (a.location_lat && a.location_lng && b.location_lat && b.location_lng) {
    const miles = haversineKm(+a.location_lat, +a.location_lng, +b.location_lat, +b.location_lng) * 0.621371;
    if (miles <= 2) score += 15;
    else if (miles <= 5) score += 10;
  } else if (fuzzyMatch(a.location_city, b.location_city)) {
    score += 5; // same city as weak signal
  }

  // Date proximity
  if (a.date_lost_found && b.date_lost_found) {
    const days = Math.abs(new Date(a.date_lost_found).getTime() - new Date(b.date_lost_found).getTime()) / 86400000;
    if (days <= 3) score += 10;
  }

  // Microchip exact match — definitive
  if (a.microchip && b.microchip && a.microchip.trim() === b.microchip.trim()) score += 100;

  return score;
}

function matchLabel(score: number): string {
  if (score >= 90) return "Likely Match";
  if (score >= 70) return "Strong Match";
  if (score >= 40) return "Potential Match";
  return "Low";
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    // Fetch the submitted report
    const { data: reportData, error: reportErr } = await supabase
      .from("lost_found_reports")
      .select("*")
      .eq("id", id)
      .single();
    if (reportErr || !reportData) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }
    const report = reportData as LostFoundReport;

    const oppositeType = report.type === "lost" ? "found" : "lost";
    const matchType    = report.type === "lost" ? "lost_to_found" : "found_to_lost";

    // Fetch active opposite-type reports from the last 60 days
    const since = new Date(); since.setDate(since.getDate() - 60);
    const { data: candidates } = await supabase
      .from("lost_found_reports")
      .select("*")
      .eq("type", oppositeType)
      .eq("status", "active")
      .gte("created_at", since.toISOString());

    const matches: { reportId: string; score: number; label: string }[] = [];

    for (const c of (candidates as LostFoundReport[]) ?? []) {
      if (c.id === id) continue;
      const score = scoreReportPair(report, c);
      if (score >= 40) {
        matches.push({ reportId: c.id!, score, label: matchLabel(score) });
      }
    }

    // Also check shelter animals if this is a lost report
    if (report.type === "lost" && report.species) {
      const { data: shelterAnimals } = await supabase
        .from("animals")
        .select("id, name, species, breed, color, size, sex, microchip, status")
        .in("status", ["Available", "Foster", "Medical Hold", "Quarantine"])
        .eq("species", report.species);

      for (const animal of (shelterAnimals ?? []) as { id: string; name?: string; species?: string; breed?: string; color?: string; size?: string; sex?: string; microchip?: string }[]) {
        // Score against animal (treat animal as a pseudo-report)
        const pseudo: Partial<LostFoundReport> = {
          species: animal.species,
          breed: animal.breed,
          color: animal.color,
          size: animal.size,
          sex: animal.sex,
          microchip: animal.microchip,
        };
        const score = scoreReportPair(report, pseudo as LostFoundReport);
        if (score >= 40) {
          // Store shelter match
          await supabase.from("lost_found_matches").insert({
            lost_report_id: id,
            animal_id: animal.id,
            match_score: score,
            match_type: "lost_to_shelter",
            status: "pending",
          });
        }
      }
    }

    // Upsert report-to-report matches (skip duplicates by checking existing)
    const inserted: string[] = [];
    for (const m of matches.sort((a, b) => b.score - a.score).slice(0, 10)) {
      const lostId  = report.type === "lost" ? id : m.reportId;
      const foundId = report.type === "lost" ? m.reportId : id;

      // Avoid duplicate matches
      const { data: existing } = await supabase
        .from("lost_found_matches")
        .select("id")
        .eq("lost_report_id", lostId)
        .eq("found_report_id", foundId)
        .limit(1);

      if (!existing?.length) {
        await supabase.from("lost_found_matches").insert({
          lost_report_id: lostId,
          found_report_id: foundId,
          match_score: m.score,
          match_type: matchType,
          status: "pending",
        });
        inserted.push(m.reportId);
      }
    }

    return NextResponse.json({
      reportId: id,
      matchesFound: matches.length,
      strongMatches: matches.filter((m) => m.score >= 70).length,
      matches: matches.slice(0, 5),
    });
  } catch (err) {
    console.error("[lost-found-match]", err);
    return NextResponse.json({ error: "Match engine error" }, { status: 500 });
  }
}
