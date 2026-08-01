import type { Metadata } from 'next';
import './globals.css';
import { AppProviders } from '../src/providers/app-providers';

export const metadata: Metadata = {
  title: 'Brand Identity Creator',
  description: 'AI assisted brand identity creation workspace.',
  icons: {
    icon: '/favicon.svg'
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" dir="ltr">
      <body suppressHydrationWarning>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
