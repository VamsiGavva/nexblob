import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NexBlob — Professional JSON Storage & Explorer",
  description:
    "Store, explore, query, and share JSON data five ways: tree, raw, table, SQL, and charts. The professional upgrade to jsonblob.com with AI, collaboration, and Cloudflare-edge speed.",
  keywords: ["JSON", "JSON storage", "JSON explorer", "JSON workbench", "JSON editor", "NexBlob"],
  openGraph: {
    title: "NexBlob",
    description: "The same JSON, explorable five different ways.",
    type: "website",
  },
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
