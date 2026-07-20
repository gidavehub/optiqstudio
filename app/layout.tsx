import type { Metadata } from "next";
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
