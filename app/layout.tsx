import type { Metadata, Viewport } from 'next';
import { EB_Garamond, Hanken_Grotesk } from 'next/font/google';
import './globals.css';

// Book face for the prompt and the page; a quiet grotesk for the chrome.
const serif = EB_Garamond({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
});

const sans = Hanken_Grotesk({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Story Engine',
  description: 'A creative writing tool that randomly assembles story concepts',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f2f3f5' },
    { media: '(prefers-color-scheme: dark)', color: '#111318' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
