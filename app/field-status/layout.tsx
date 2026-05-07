import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Field Status — ShelterTrace",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function FieldStatusLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100dvh", background: "#f0f4f8" }}>
      {children}
    </div>
  );
}
