import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "25 Bingo - Family Game Night",
    template: "%s | 25 Bingo"
  },
  description: "Bring the family together for bingo night! Create a room, share the link with loved ones, and enjoy classic bingo fun from anywhere.",
  keywords: ["bingo", "family game", "online bingo", "game night", "family fun", "virtual game night"],
  authors: [{ name: "25 Bingo Team" }],
  creator: "25 Bingo",
  publisher: "25 Bingo",
  openGraph: {
    title: "25 Bingo - Family Game Night",
    description: "Bring the family together for bingo night! Create a room, share the link with loved ones, and enjoy classic bingo fun from anywhere.",
    type: "website",
    locale: "en_US",
    siteName: "25 Bingo",
  },
  twitter: {
    card: "summary_large_image",
    title: "25 Bingo - Family Game Night",
    description: "Bring the family together for bingo night! Enjoy classic bingo fun with loved ones from anywhere.",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
