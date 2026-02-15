import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'skim',
  description: 'Research, distilled.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
