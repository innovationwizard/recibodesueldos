"use client";

import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { detectFormat, fuzzyMatch, parseWorkbook, readWorkbookFromArrayBuffer } from "@/lib/excel-parser";
import type { FormatId, ReceiptData } from "@/lib/excel-parser";
import { Receipt } from "./Receipt";
import { getPrintCSS } from "@/lib/print-css";
import { generateSingleReceiptPdf, getReceiptHtml, receiptFileName } from "@/lib/pdf-generator";
import JSZip from "jszip";
import { EmailFlow } from "./email/EmailFlow";

const STEPS = {
  UPLOAD: "upload",
  FORMAT_PICK: "format_pick",
  SHEET_SELECT: "sheet_select",
  SHEET_CONFIRM: "sheet_confirm",
  PROCESSING: "processing",
  DONE: "done",
  ERROR: "error",
} as const;

interface ReceiptGeneratorProps {
  onSuccess?: (
    receipts: ReceiptData[],
    companyName: string,
    dateRange: string,
    file?: File
  ) => void;
  onReset?: () => void;
  batchId?: string | null;
  receiptIds?: string[];
}

export function ReceiptGenerator({ onSuccess, onReset, batchId, receiptIds }: ReceiptGeneratorProps) {
  const [step, setStep] = useState<(typeof STEPS)[keyof typeof STEPS]>(STEPS.UPLOAD);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [sheetInput, setSheetInput] = useState("");
  const [matchedSheet, setMatchedSheet] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [receipts, setReceipts] = useState<ReceiptData[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showEmailFlow, setShowEmailFlow] = useState(false);
  const [detectedFormatId, setDetectedFormatId] = useState<FormatId | null>(null);
  const [detectedFormatLabel, setDetectedFormatLabel] = useState<string | null>(null);
  const [detectedSheet, setDetectedSheet] = useState<string | null>(null);
  const [manualFormatId, setManualFormatId] = useState<FormatId | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev, msg]);
  }, []);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploadedFile(file);
      addLog(`Archivo cargado: ${file.name}`);
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = evt.target?.result as ArrayBuffer;
          const wb = readWorkbookFromArrayBuffer(data);
          setWorkbook(wb);
          setSheetNames(wb.SheetNames);
          addLog(`Hojas encontradas: ${wb.SheetNames.join(", ")}`);

          const det = detectFormat(wb);
          if (det) {
            setDetectedFormatId(det.formatId);
            setDetectedFormatLabel(det.formatLabel);
            setDetectedSheet(det.sheet);
            addLog(`Formato detectado: ${det.formatLabel} (hoja "${det.sheet}")`);
            setStep(STEPS.SHEET_CONFIRM);
          } else {
            addLog(`Formato no reconocido — selección manual`);
            setStep(STEPS.FORMAT_PICK);
          }
        } catch (err) {
          setErrorMsg(`Error al leer archivo: ${(err as Error).message}`);
          setStep(STEPS.ERROR);
        }
      };
      reader.readAsArrayBuffer(file);
    },
    [addLog]
  );

  const handleSheetSearch = useCallback(() => {
    if (!sheetInput.trim()) return;
    addLog(`Buscando hoja: "${sheetInput}"`);
    const result = fuzzyMatch(sheetInput, sheetNames, 0.55);
    if (result) {
      setMatchedSheet(result.match);
      addLog(`Coincidencia encontrada: "${result.match}"`);
      setStep(STEPS.SHEET_CONFIRM);
    } else {
      setErrorMsg(
        `No se encontró hoja similar a "${sheetInput}". Hojas disponibles: ${sheetNames.join(", ")}`
      );
      addLog(`Sin coincidencia para: "${sheetInput}"`);
      setMatchedSheet(null);
    }
  }, [sheetInput, sheetNames, addLog]);

  const handleConfirm = useCallback(() => {
    if (!workbook) return;

    const formatId = manualFormatId ?? detectedFormatId;
    let sheetName: string | undefined;
    if (manualFormatId === "mensual") sheetName = matchedSheet ?? undefined;
    else if (manualFormatId === "catorcenal") sheetName = "MENU";
    else sheetName = detectedSheet ?? undefined;

    if (!formatId) {
      setErrorMsg("No se determinó el formato. Reinicia e intenta de nuevo.");
      setStep(STEPS.ERROR);
      return;
    }

    setStep(STEPS.PROCESSING);
    addLog(`Procesando: formato "${formatId}", hoja "${sheetName ?? "<auto>"}"`);

    try {
      const { receipts: parsedReceipts, companyName, dateRange, warnings } = parseWorkbook(
        workbook,
        { formatId, sheetName }
      );
      for (const w of warnings) addLog(`⚠ ${w}`);
      addLog(`Empleados procesados: ${parsedReceipts.length}`);
      setReceipts(parsedReceipts);
      setStep(STEPS.DONE);
      onSuccess?.(parsedReceipts, companyName, dateRange, uploadedFile ?? undefined);
    } catch (err) {
      setErrorMsg((err as Error).message);
      setStep(STEPS.ERROR);
    }
  }, [
    workbook,
    manualFormatId,
    detectedFormatId,
    detectedSheet,
    matchedSheet,
    addLog,
    onSuccess,
    uploadedFile,
  ]);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Por favor permita ventanas emergentes para imprimir.");
      return;
    }
    printWindow.document.write(
      `<!DOCTYPE html><html><head><title>Boletas de Pago</title><style>${getPrintCSS()}</style></head><body>${printContent.innerHTML}</body></html>`
    );
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  };

  const handleExportSeparate = async () => {
    if (receipts.length === 0) return;
    setExporting(true);

    try {
      const zip = new JSZip();

      for (let i = 0; i < receipts.length; i++) {
        const receipt = receipts[i];
        const html = getReceiptHtml(printRef, i);
        if (!html) continue;

        const { pdfArrayBuffer } = await generateSingleReceiptPdf(html);
        const fileName = receiptFileName(receipt.ordinal, receipt.nombre);
        zip.file(fileName, pdfArrayBuffer);
      }

      // Download zip
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `boletas-${receipts[0]?.companyName?.replace(/\s+/g, "_") ?? "pago"}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Error al exportar: ${(err as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  const reset = () => {
    setStep(STEPS.UPLOAD);
    setWorkbook(null);
    setSheetNames([]);
    setSheetInput("");
    setMatchedSheet(null);
    setErrorMsg("");
    setReceipts([]);
    setLogs([]);
    setUploadedFile(null);
    setShowEmailFlow(false);
    setDetectedFormatId(null);
    setDetectedFormatLabel(null);
    setDetectedSheet(null);
    setManualFormatId(null);
    onReset?.();
  };

  // Multiple internal steps map to the same progress index.
  const STEP_INDEX: Record<string, number> = {
    [STEPS.UPLOAD]: 0,
    [STEPS.FORMAT_PICK]: 1,
    [STEPS.SHEET_SELECT]: 1,
    [STEPS.SHEET_CONFIRM]: 2,
    [STEPS.PROCESSING]: 2,
    [STEPS.DONE]: 3,
  };
  const currentIdx = STEP_INDEX[step] ?? -1;

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex flex-wrap items-center gap-1">
        {["Cargar Archivo", "Detectar Formato", "Confirmar", "Boletas"].map(
          (label, i) => {
            const isActive = i <= currentIdx && step !== STEPS.ERROR;
            const isCurrent = i === currentIdx;
            return (
              <div key={i} className="flex items-center gap-2">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-primary text-white"
                      : "bg-gray-200 text-gray-500"
                  } ${isCurrent ? "ring-2 ring-primary/20" : ""}`}
                >
                  {i + 1}
                </div>
                <span
                  className={`text-[13px] ${
                    isActive ? "text-primary font-medium" : "text-gray-400"
                  } ${isCurrent ? "font-semibold" : ""}`}
                >
                  {label}
                </span>
                {i < 3 && <div className="h-px w-6 bg-gray-200" />}
              </div>
            );
          }
        )}
      </div>

      {/* Step: Upload */}
      {step === STEPS.UPLOAD && (
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer rounded-lg border-2 border-dashed border-gray-200 p-12 text-center transition-colors hover:border-primary/40"
          >
            <div className="mx-auto mb-3 opacity-70">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-primary"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <polyline points="9 15 12 12 15 15" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-800">
              Haga clic para cargar archivo Excel (.xlsx)
            </p>
            <p className="mt-1 text-xs text-gray-500">Planilla de salarios</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      )}

      {/* Step: Sheet Select */}
      {step === STEPS.SHEET_SELECT && (
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="mb-1.5 text-base font-semibold text-primary">
            Seleccione la hoja a procesar
          </h2>
          <p className="mb-4 text-[13px] text-gray-600">
            Hojas disponibles: {sheetNames.join(", ")}
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={sheetInput}
              onChange={(e) => {
                setSheetInput(e.target.value);
                setErrorMsg("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSheetSearch()}
              placeholder="Escriba el nombre de la hoja..."
              className="flex-1 rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/20"
              autoFocus
            />
            <button
              onClick={handleSheetSearch}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-light"
            >
              Buscar
            </button>
          </div>
          {errorMsg && (
            <p className="mt-2.5 text-[13px] text-red-600">{errorMsg}</p>
          )}
        </div>
      )}

      {/* Step: Format Pick (manual fallback) */}
      {step === STEPS.FORMAT_PICK && (
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="mb-1.5 text-base font-semibold text-primary">
            Selecciona el formato de la planilla
          </h2>
          <p className="mb-4 text-[13px] text-gray-600">
            No pudimos detectar el formato automáticamente. ¿Cuál de estos es?
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setManualFormatId("mensual");
                setStep(STEPS.SHEET_SELECT);
                setSheetInput("");
                setErrorMsg("");
                addLog("Formato manual: Mensual");
              }}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-light"
            >
              Mensual
            </button>
            <button
              onClick={() => {
                setManualFormatId("catorcenal");
                setMatchedSheet("MENU");
                setStep(STEPS.SHEET_CONFIRM);
                addLog("Formato manual: Catorcenal (hoja MENU)");
              }}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-light"
            >
              Catorcenal (IGSS)
            </button>
          </div>
          <p className="mt-3 text-[12px] text-gray-500">
            Hojas en el archivo: {sheetNames.join(", ")}
          </p>
        </div>
      )}

      {/* Step: Sheet Confirm */}
      {step === STEPS.SHEET_CONFIRM && (
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          {detectedFormatId && !manualFormatId ? (
            <>
              <h2 className="mb-1.5 text-base font-semibold text-primary">
                Formato detectado
              </h2>
              <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-green-600 shrink-0">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="text-[14px] font-semibold text-green-800">
                  {detectedFormatLabel}
                </span>
                <span className="text-[13px] text-green-700">
                  · Hoja: <span className="font-mono">{detectedSheet}</span>
                </span>
              </div>
            </>
          ) : (
            <>
              <h2 className="mb-1.5 text-base font-semibold text-primary">
                Confirmar selección
              </h2>
              <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-gray-50 px-4 py-3.5">
                <span className="text-[13px] text-gray-600">Formato manual:</span>
                <span className="text-[14px] font-semibold text-primary">
                  {manualFormatId === "catorcenal" ? "Catorcenal (IGSS)" : "Mensual"}
                </span>
                <span className="text-[13px] text-gray-600">
                  · Hoja: <span className="font-mono">&quot;{matchedSheet}&quot;</span>
                </span>
              </div>
            </>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleConfirm}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-light"
            >
              Confirmar y Procesar
            </button>
            <button
              onClick={() => {
                setDetectedFormatId(null);
                setDetectedFormatLabel(null);
                setDetectedSheet(null);
                setManualFormatId(null);
                setMatchedSheet(null);
                setSheetInput("");
                setErrorMsg("");
                setStep(STEPS.FORMAT_PICK);
              }}
              className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100"
            >
              Cambiar formato
            </button>
          </div>
        </div>
      )}

      {/* Step: Processing */}
      {step === STEPS.PROCESSING && (
        <div className="rounded-xl border border-gray-100 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-primary" />
          <p className="mt-4 text-gray-600">Procesando planilla...</p>
        </div>
      )}

      {/* Step: Done */}
      {step === STEPS.DONE && (
        <>
          {showEmailFlow && batchId ? (
            <EmailFlow
              receipts={receipts}
              batchId={batchId}
              receiptIds={receiptIds ?? []}
              printRef={printRef}
              onClose={() => setShowEmailFlow(false)}
            />
          ) : (
            <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span>
                  {receipts.length} boleta{receipts.length > 1 ? "s" : ""}{" "}
                  generada{receipts.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handlePrint}
                  disabled={exporting}
                  className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-light disabled:opacity-50"
                >
                  Exportar juntos
                </button>
                <button
                  onClick={handleExportSeparate}
                  disabled={exporting}
                  className="rounded-lg border border-primary bg-white px-5 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/5 disabled:opacity-50"
                >
                  {exporting ? "Exportando..." : "Exportar separados"}
                </button>
                <button
                  onClick={() => setShowEmailFlow(true)}
                  disabled={exporting || !batchId}
                  className="rounded-lg border border-primary bg-white px-5 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/5 disabled:opacity-50"
                >
                  Enviar por correo
                </button>
                <button
                  onClick={reset}
                  disabled={exporting}
                  className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100 disabled:opacity-50"
                >
                  Procesar otro archivo
                </button>
              </div>
            </div>
          )}

          {!showEmailFlow && (
            <div className="mt-2">
              <h3 className="mb-3 text-sm font-semibold tracking-wide text-gray-600">
                Vista Previa
              </h3>
              <div className="grid gap-3">
                {receipts.map((r, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm"
                  >
                    <Receipt data={r} isSecondOnPage={false} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div ref={printRef} className="hidden">
            {receipts.map((r, i) => (
              <Receipt key={i} data={r} isSecondOnPage={i % 2 === 1} />
            ))}
          </div>
        </>
      )}

      {/* Error */}
      {step === STEPS.ERROR && (
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-600">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={reset}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-light"
          >
            Reiniciar
          </button>
        </div>
      )}

      {/* Activity Log */}
      {logs.length > 0 && (
        <details className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <summary className="cursor-pointer text-xs font-semibold tracking-wide text-gray-500">
            Registro de actividad ({logs.length})
          </summary>
          <div className="mt-2.5 max-h-48 overflow-auto">
            {logs.map((l, i) => (
              <div key={i} className="flex gap-2 py-0.5 font-mono text-[11px] text-gray-600">
                <span className="font-semibold text-gray-300">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{l}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
