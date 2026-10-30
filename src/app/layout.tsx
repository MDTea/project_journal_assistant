import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CIS 591 Journal Assistant",
  description: "Private, human-controlled project journaling.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
