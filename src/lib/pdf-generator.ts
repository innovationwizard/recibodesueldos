import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { getPrintCSS } from "./print-css";

/**
 * Generate a single-receipt PDF from an off-screen DOM element.
 * Requires the receipt's rendered HTML (from printRef children).
 */
export async function generateSingleReceiptPdf(
  receiptHtml: string
): Promise<{ pdfArrayBuffer: ArrayBuffer; pdfBase64: string; fileName: string }> {
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "7.5in";
  container.innerHTML = `<style>${getPrintCSS()}</style>`;

  const receiptDiv = document.createElement("div");
  receiptDiv.innerHTML = receiptHtml;
  container.appendChild(receiptDiv);
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
    });

    const pdf = new jsPDF({ orientation: "portrait", unit: "in", format: "letter" });
    const imgData = canvas.toDataURL("image/png");
    const pdfWidth = 7.5;
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 0.5, 0.4, pdfWidth, pdfHeight);

    const arrayBuffer = pdf.output("arraybuffer");
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    return { pdfArrayBuffer: arrayBuffer, pdfBase64: base64, fileName: "" };
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Extract the HTML for a single receipt from the printRef container.
 * Ensures it uses receipt-top styling (no top padding variant).
 */
export function getReceiptHtml(
  printRef: React.RefObject<HTMLDivElement>,
  index: number
): string {
  if (!printRef.current) return "";
  const el = printRef.current.children[index];
  if (!el) return "";
  const temp = document.createElement("div");
  temp.innerHTML = el.outerHTML;
  const inner = temp.firstElementChild as HTMLElement;
  if (inner) {
    inner.className = inner.className.replace("receipt-bottom", "receipt-top");
  }
  return temp.innerHTML;
}

/**
 * Build a sanitized PDF filename for a receipt.
 */
export function receiptFileName(ordinal: number, nombre: string): string {
  const name = nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  return `${String(ordinal).padStart(2, "0")}-${name}.pdf`;
}
