import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Field Status — ShelterTrace",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function FieldStatusLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100dvh", background: "#f0f4f8" }}>
      {children}
    </div>
  );
}
