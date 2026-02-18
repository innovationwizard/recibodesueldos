import { ImageResponse } from "next/og";

// WhatsApp strict requirements: 1200×630, PNG/JPG/WebP, max 600KB, absolute HTTPS URL
export const runtime = "edge";
export const alt = "Recibos de Sueldos - Generador de Boletas de Pago";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1a1a2e",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Lucide Receipt icon */}
        <svg
          width="120"
          height="120"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ marginBottom: 24 }}
        >
          <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
          <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
          <path d="M12 17.5V11" />
        </svg>
        <div style={{ color: "white", fontSize: 48, fontWeight: 700, marginBottom: 8 }}>
          Recibos de Sueldos
        </div>
        <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 24 }}>
          Generador de Boletas de Pago
        </div>
      </div>
    ),
    {
      ...size,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    }
  );
}
