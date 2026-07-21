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
  title: "Optiq Studio | Advanced AI for Video, Image and Audio",
  description:
    "Optiq Studio is an applied AI research company building next-generation video, image and audio generation tools for creators.",
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
