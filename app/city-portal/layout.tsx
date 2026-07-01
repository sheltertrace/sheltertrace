import CityShell from "@/components/city/CityShell";

export default function CityPortalLayout({ children }: { children: React.ReactNode }) {
  return <CityShell>{children}</CityShell>;
}
