import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Waldwirtschaft Heidekönig",
    template: "%s | Waldwirtschaft Heidekönig",
  },
  description: "Reservierungsanfragen für die Außengastronomie Waldwirtschaft Heidekönig.",
  applicationName: "Waldwirtschaft Heidekönig Reservierungen",
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f4ef" },
    { media: "(prefers-color-scheme: dark)", color: "#10120f" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <head>
        <link href="/branding/favicon" rel="icon" />
        <link href="/branding/favicon" rel="apple-touch-icon" />
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          Zum Inhalt springen
        </a>
        {children}
      </body>
    </html>
  );
}
