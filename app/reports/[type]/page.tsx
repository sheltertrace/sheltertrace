"use client";
import { use } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import AppShell from "@/components/layout/AppShell";
import ReportBuilder from "@/components/reports/ReportBuilder";
import { REPORT_CONFIG_MAP } from "@/lib/reportBuilderConfigs";
import Link from "next/link";

export default function ReportPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = use(params);
  const config = REPORT_CONFIG_MAP[type];
  const router = useRouter();

  useEffect(() => {
    if (!config) router.replace("/reports");
  }, [config, router]);

  if (!config) return null;

  return (
    <AppShell title={config.title} action={<Link href="/reports" className="btn btn-secondary btn-sm">← All Reports</Link>}>
      <ReportBuilder config={config} />
    </AppShell>
  );
}
