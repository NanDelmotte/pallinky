/**
 * Path: apps/web/app/layout.tsx
 * Description: Root layout for the web app.
 */

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pallinky',
  description: 'Good times, made easy',
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