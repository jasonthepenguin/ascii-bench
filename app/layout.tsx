import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ASCII Bench",
  description: "A/B voting platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
