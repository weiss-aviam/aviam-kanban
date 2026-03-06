import type { Metadata } from "next";
import { Barlow } from "next/font/google";
import { de } from "@/lib/locales/de";
import "./globals.css";

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    template: de.metadata.titleTemplate,
    default: de.metadata.title,
  },
  description: de.metadata.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={de.metadata_html.lang}>
      <body className={`${barlow.variable} antialiased`}>{children}</body>
    </html>
  );
}
