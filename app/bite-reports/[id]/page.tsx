"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import BiteReportForm from "@/components/forms/BiteReportForm";
import { fetchBiteReport } from "@/lib/biteReportData";
import type { BiteReport } from "@/lib/biteReportTypes";

export default function BiteReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [report, setReport] = useState<BiteReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBiteReport(id).then((r) => {
      if (!r) { router.replace("/bite-reports"); return; }
      setReport(r);
    }).finally(() => setLoading(false));
  }, [id, router]);

  if (loading) return <AppShell title="Bite Report"><div style={{ padding: 40, color: "var(--text-muted)" }}>Loading…</div></AppShell>;
  if (!report) return null;

  return (
    <AppShell title={report.report_number || "Bite Report"}>
      <BiteReportForm
        reportType={report.report_type}
        initialData={report}
        onSave={(updated) => setReport(updated)}
        onCancel={() => router.push("/bite-reports")}
      />
    </AppShell>
  );
}
