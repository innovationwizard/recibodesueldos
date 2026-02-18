"use client";

import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { fuzzyMatch, parseWorkbook, readWorkbookFromArrayBuffer } from "@/lib/excel-parser";
import type { ReceiptData } from "@/lib/excel-parser";
import { Receipt } from "./Receipt";

const STEPS = {
  UPLOAD: "upload",
  SHEET_SELECT: "sheet_select",
  SHEET_CONFIRM: "sheet_confirm",
  PROCESSING: "processing",
  DONE: "done",
  ERROR: "error",
} as const;

function getPrintCSS(): string {
  return `
    @page { size: letter; margin: 0.4in 0.5in; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1a1a2e; }
    .receipt { width: 100%; height: 4.6in; page-break-inside: avoid; display: flex; flex-direction: column; }
    .receipt-top { padding-bottom: 0.15in; border-bottom: 1px dashed #ccc; }
    .receipt-bottom { padding-top: 0.15in; }
    .receipt-inner { flex: 1; display: flex; flex-direction: column; }
    .receipt-header { text-align: center; margin-bottom: 6px; }
    .company-name { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
    .receipt-title { font-size: 11px; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase; color: #444; margin-top: 2px; }
    .receipt-date { text-align: right; font-size: 10px; color: #555; margin-bottom: 8px; }
    .receipt-info-grid { margin-bottom: 8px; }
    .info-row { display: flex; font-size: 10.5px; line-height: 1.7; }
    .info-label { width: 90px; font-weight: 600; flex-shrink: 0; }
    .info-value { flex: 1; border-bottom: 1px solid #ddd; padding-left: 4px; }
    .receipt-body { flex: 1; }
    .columns-container { display: flex; gap: 16px; margin-bottom: 8px; }
    .column-ingresos, .column-egresos { flex: 1; }
    .column-header { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1.5px solid #1a1a2e; padding-bottom: 3px; margin-bottom: 4px; }
    .line-item { display: flex; justify-content: space-between; font-size: 10px; line-height: 1.8; padding: 0 2px; }
    .line-item .amount { font-variant-numeric: tabular-nums; text-align: right; min-width: 80px; }
    .total-line { font-weight: 700; border-top: 1px solid #999; margin-top: 3px; padding-top: 3px; }
    .liquido-section { display: flex; justify-content: space-between; align-items: center; background: #1a1a2e; color: #fff; padding: 6px 12px; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; margin-top: 4px; }
    .liquido-amount { font-size: 13px; font-variant-numeric: tabular-nums; }
    .signature-section { margin-top: auto; padding-top: 16px; display: flex; justify-content: center; }
    .signature-block { text-align: center; width: 220px; }
    .signature-line { border-bottom: 1px solid #333; height: 28px; }
    .signature-label { font-size: 9px; color: #555; margin-top: 3px; letter-spacing: 0.03em; }
  `;
}

interface ReceiptGeneratorProps {
  onSuccess?: (
    receipts: ReceiptData[],
    companyName: string,
    dateRange: string,
    file?: File
  ) => void;
}

export function ReceiptGenerator({ onSuccess }: ReceiptGeneratorProps) {
  const [step, setStep] = useState<(typeof STEPS)[keyof typeof STEPS]>(STEPS.UPLOAD);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [sheetInput, setSheetInput] = useState("");
  const [matchedSheet, setMatchedSheet] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [receipts, setReceipts] = useState<ReceiptData[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
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
          setStep(STEPS.SHEET_SELECT);
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
    if (!matchedSheet || !workbook) return;
    setStep(STEPS.PROCESSING);
    addLog(`Procesando hoja: "${matchedSheet}"`);

    try {
      const { receipts: parsedReceipts, companyName, dateRange } = parseWorkbook(
        workbook,
        matchedSheet
      );
      addLog(`Empleados procesados: ${parsedReceipts.length}`);
      setReceipts(parsedReceipts);
      setStep(STEPS.DONE);
      onSuccess?.(parsedReceipts, companyName, dateRange, uploadedFile ?? undefined);
    } catch (err) {
      setErrorMsg((err as Error).message);
      setStep(STEPS.ERROR);
    }
  }, [matchedSheet, workbook, addLog, onSuccess, uploadedFile]);

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
  };

  const stepOrder = [STEPS.UPLOAD, STEPS.SHEET_SELECT, STEPS.SHEET_CONFIRM, STEPS.DONE];
  const currentIdx = stepOrder.indexOf(step as (typeof stepOrder)[number]);

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex flex-wrap items-center gap-1">
        {["Cargar Archivo", "Seleccionar Hoja", "Confirmar", "Boletas"].map(
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

      {/* Step: Sheet Confirm */}
      {step === STEPS.SHEET_CONFIRM && (
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="mb-1.5 text-base font-semibold text-primary">
            Confirmar hoja seleccionada
          </h2>
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-gray-50 px-4 py-3.5">
            <span className="text-[13px] text-gray-600">Hoja encontrada:</span>
            <span className="text-[15px] font-semibold text-primary">
              &quot;{matchedSheet}&quot;
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleConfirm}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-light"
            >
              Confirmar y Procesar
            </button>
            <button
              onClick={() => {
                setStep(STEPS.SHEET_SELECT);
                setSheetInput("");
                setErrorMsg("");
              }}
              className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100"
            >
              Buscar otra hoja
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
                className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-light"
              >
                Imprimir / Guardar PDF
              </button>
              <button
                onClick={reset}
                className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100"
              >
                Procesar otro archivo
              </button>
            </div>
          </div>

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
