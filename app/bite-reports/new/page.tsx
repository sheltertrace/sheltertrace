"use client";
import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import BiteReportForm from "@/components/forms/BiteReportForm";
import type { BiteReport } from "@/lib/biteReportTypes";
import { blankBiteReport } from "@/lib/biteReportTypes";

function NewBiteReportContent() {
  const params = useSearchParams();
  const router = useRouter();
  const type = (params.get("type") || "animal_human") as "animal_human" | "animal_animal";

  // Pre-fill from animal record or dispatch call query params
  const prefill = blankBiteReport(type);
  const animalId = params.get("animalId");
  if (animalId) {
    prefill.biting_animal_id = animalId;
    prefill.biting_animal_data = {
      ...prefill.biting_animal_data,
      linked_animal_id: animalId,
      name: params.get("animalName") || "",
      species: params.get("species") || "",
      breed: params.get("breed") || "",
      color: params.get("color") || "",
      microchip: params.get("microchip") || "",
    };
  }
  const callAddr = params.get("address");
  if (callAddr) {
    prefill.incident_address = callAddr;
    prefill.incident_city = params.get("city") || prefill.incident_city;
    prefill.incident_date = params.get("date") || prefill.incident_date;
    prefill.investigating_officer = params.get("officer") || prefill.investigating_officer;
  }
  const callId = params.get("callId");
  if (callId) prefill.dispatch_call_id = callId;

  const title = type === "animal_human" ? "Animal to Human Bite Report" : "Animal to Animal Bite Report";

  return (
    <AppShell title={`New ${title}`}>
      <BiteReportForm
        reportType={type}
        initialData={prefill}
        onSave={(report: BiteReport) => { if (report.id) router.replace(`/bite-reports/${report.id}`); }}
        onCancel={() => router.push("/bite-reports")}
      />
    </AppShell>
  );
}

export default function NewBiteReportPage() {
  return <Suspense><NewBiteReportContent /></Suspense>;
}
