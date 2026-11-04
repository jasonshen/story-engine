import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Literata } from 'next/font/google';
import './globals.css';

// Prose face for the writing pad and generated narratives. UI stays in Geist.
const literata = Literata({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-literata',
});

export const metadata: Metadata = {
  title: 'Story Engine',
  description: 'A creative writing tool that randomly assembles story concepts',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3f4f6' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1013' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${literata.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
