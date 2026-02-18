import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

// WhatsApp requires absolute HTTPS URLs for og:image
const baseUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: "Recibos de Sueldos | Generador de Boletas de Pago",
  description:
    "Genera constancias de pago desde tu Excel. Sube tu archivo, selecciona la hoja y descarga las boletas en PDF.",
  openGraph: {
    type: "website",
    title: "Recibos de Sueldos | Generador de Boletas de Pago",
    description:
      "Genera constancias de pago desde tu Excel. Sube tu archivo, selecciona la hoja y descarga las boletas en PDF.",
    url: "/",
    siteName: "Recibos de Sueldos",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Recibos de Sueldos - Generador de Boletas de Pago",
      },
    ],
    locale: "es",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  );
}
