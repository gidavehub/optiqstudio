import type { Metadata, Viewport } from "next";
import { Google_Sans, Roboto, Roboto_Mono } from "next/font/google";
import "./globals.css";
import AuthProvider from "../components/AuthProvider";
import NetworkStatus from "../components/NetworkStatus";

// Google's own type system — the ONLY fonts allowed anywhere in the app:
// Google Sans for UI text, Roboto as fallback, Roboto Mono for mono labels.
const googleSans = Google_Sans({
  variable: "--font-google-sans",
  subsets: ["latin"],
});

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://optiq.studio"),
  title: "Optiq Studio — Create Production-Quality Ads and Videos",
  description:
    "Create production-quality ads and videos that tell your brand's story and win attention — democratizing cinematic video production. A product of DaveLabs.",
  keywords: [
    "AI video ad generator",
    "AI ad maker",
    "text to video ads",
    "AI commercial video generator",
    "production quality AI video",
    "AI video ads for brands",
    "cinematic AI ads",
    "vertical video ad generator",
    "AI marketing video generator",
    "AI storyboard generator",
    "AI voiceover generator",
    "text to speech African accents",
    "Nigerian AI voice generator",
    "African accent text to speech",
    "AI music generator for ads",
    "AI image generator for ads",
    "brand video ads AI",
    "high converting video ads",
    "Optiq Studio",
    "DaveLabs",
  ],
  openGraph: {
    title: "Optiq Studio — Create Production-Quality Ads and Videos",
    description:
      "Create production-quality ads and videos that tell your brand's story and win attention. Democratizing cinematic video production. A product of DaveLabs.",
    siteName: "Optiq Studio",
    type: "website",
    images: [
      {
        url: "/media/hero.jpg",
        width: 1200,
        height: 630,
        alt: "A production-quality brand ad made with Optiq Studio",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Optiq Studio — Create Production-Quality Ads and Videos",
    description:
      "Create production-quality ads and videos that tell your brand's story and win attention. A product of DaveLabs.",
    images: ["/media/hero.jpg"],
  },
};

// Native-feeling on phones: fill the real viewport (including under the browser
// chrome), respect the notch, and never let a pinch-zoom fight the layout.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0f1d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${googleSans.variable} ${roboto.variable} ${robotoMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          {children}
          <NetworkStatus />
        </AuthProvider>
      </body>
    </html>
  );
}
