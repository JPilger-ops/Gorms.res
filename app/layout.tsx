import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Waldwirtschaft Heidekönig",
    template: "%s | Waldwirtschaft Heidekönig",
  },
  description: "Reservierungsanfragen für die Waldwirtschaft Heidekönig.",
  applicationName: "Waldwirtschaft Heidekönig Reservierungen",
  icons: {
    apple: [{ url: "/branding/favicon" }],
    icon: [{ url: "/branding/favicon" }],
  },
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fbf8f0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body>
        <a className="skip-link" href="#main-content">
          Zum Inhalt springen
        </a>
        {children}
      </body>
    </html>
  );
}
