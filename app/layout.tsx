import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Napkin Clone",
  description: "Paste text, get a clean editable diagram.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
