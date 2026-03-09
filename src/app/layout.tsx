/**
 * @fileoverview Root layout component for the OpenLottie application.
 * Provides the HTML structure with internationalization support.
 * @module app/layout
 */

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getLocale } from 'next-intl/server';
import "./globals.css";

/** Geist Sans font configuration */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

/** Geist Mono font configuration */
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Application metadata for SEO and social sharing */
export const metadata: Metadata = {
  title: "OpenLottie — AI Vector Animation Generator",
  description:
    "Generate professional Lottie vector animations from text, images, or video. Powered by OmniLottie (CVPR 2026).",
};

/**
 * Root layout component that wraps all pages.
 * Provides internationalization context and sets up the HTML structure.
 * 
 * @param props - The component props
 * @param props.children - Child components to render
 * @returns The root layout React component
 * 
 * @example
 * ```tsx
 * // This is used automatically by Next.js for all pages
 * export default RootLayout;
 * ```
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  
  return (
    <html lang={locale} className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased font-sans`}
      >
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
