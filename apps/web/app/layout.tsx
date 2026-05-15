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
      <body
        style={{
          margin: 0,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        {children}
      </body>
    </html>
  );
}
