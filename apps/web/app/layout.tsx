import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "../src/providers/app-providers";

export const metadata: Metadata = {
  title: "Wuzzify Brand Studio",
  description:
    "Create, review, and activate AI-assisted brand identities with Wuzzify.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" dir="ltr">
      <body suppressHydrationWarning>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
