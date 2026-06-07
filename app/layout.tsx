import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "./providers";

export const metadata: Metadata = {
  title: "ShelterTrace",
  description: "Modern Shelter Management Software — built for animal shelters and humane societies.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon.jpg", type: "image/jpeg" },
    ],
    apple: [
      { url: "/apple-icon.jpg", type: "image/jpeg" },
    ],
  },
  openGraph: {
    title: "ShelterTrace",
    description: "Modern Shelter Management Software — built for animal shelters and humane societies.",
    siteName: "ShelterTrace",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "ShelterTrace — Modern Shelter Management Software",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ShelterTrace",
    description: "Modern Shelter Management Software",
    images: ["/og-image.jpg"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ShelterTrace",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f2942",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        {/* apple-icon is declared via metadata.icons above */}
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
