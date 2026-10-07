import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

// Local @font-face declarations — fonts are served from /public/vendor/fonts/
// so the site is fully offline-capable (no Google Fonts CDN at runtime).
// Preloaded in <head> via link tags for fast first paint.

export const metadata: Metadata = {
  title: "MUSE GESTURES — hand-controlled sound installation",
  description: "Real-time hand-controlled sound installation. MediaPipe Hands + Web Audio API + evolving pad + sample-based laser harp.",
  keywords: ["MediaPipe", "Web Audio", "Laser Harp", "Muse Gestures", "Gestures", "Pentatonic", "Sound Installation"],
  authors: [{ name: "MUSE GESTURES" }],
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preload ALL Montserrat weights × both subsets (latin + cyrillic)
            so that switching language doesn't trigger a font swap / layout
            shift. Each file is ~11-19 KB; preloading 10 files costs ~150 KB
            but eliminates the FOUT/FOIT when the user toggles EN↔RU. */}
        <link rel="preload" href="/vendor/fonts/montserrat-latin-300-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/vendor/fonts/montserrat-latin-400-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/vendor/fonts/montserrat-latin-500-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/vendor/fonts/montserrat-latin-700-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/vendor/fonts/montserrat-latin-800-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/vendor/fonts/montserrat-cyrillic-300-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/vendor/fonts/montserrat-cyrillic-400-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/vendor/fonts/montserrat-cyrillic-500-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/vendor/fonts/montserrat-cyrillic-700-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/vendor/fonts/montserrat-cyrillic-800-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        {/* Preload both gestures guide images so switching language is seamless. */}
        <link rel="preload" href="/gestures-guide/page-en-1.png" as="image" />
        <link rel="preload" href="/gestures-guide/page-ru-1.png" as="image" />
      </head>
      <body
        className="antialiased bg-black text-white"
        style={{
          fontFamily: "'Montserrat', system-ui, sans-serif",
          // 'antialiased' (grayscale AA) keeps thin weights crisp and thin.
          // 'subpixel-antialiased' was making the text look thicker —
          // wrong choice for Montserrat 100/300 on a dark background.
          // geometricPrecision gives smooth glyph shapes without bloating.
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          textRendering: 'geometricPrecision',
          fontSmooth: 'always',
        }}
      >
        {children}
        <Toaster />
        <SonnerToaster />
      </body>
    </html>
  );
}
