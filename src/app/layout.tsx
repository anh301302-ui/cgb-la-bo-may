import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BOOST — Server Amplification System",
  description: "Automated server boost management",
  robots: "noindex, nofollow",
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink-bg vignette">
        <div className="grain" />
        <main className="relative z-10">
          {children}
        </main>
      </body>
    </html>
  );
}
