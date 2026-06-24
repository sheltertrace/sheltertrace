import ClinicShell from "@/components/clinic/ClinicShell";

export default function ClinicLayout({ children }: { children: React.ReactNode }) {
  return <ClinicShell>{children}</ClinicShell>;
}
