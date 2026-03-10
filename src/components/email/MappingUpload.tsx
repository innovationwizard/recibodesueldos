"use client";

import { useRef, useState, useEffect } from "react";
import {
  parseEmailMappingWorkbook,
  getMappingSheetNames,
  matchMappingsToReceipts,
} from "@/lib/email-mapping-parser";
import type { MappingResult } from "@/lib/email-mapping-parser";
import type { ReceiptData } from "@/lib/excel-parser";
import { norm, fuzzyMatch } from "@/lib/excel-parser";

interface MappingUploadProps {
  receipts: ReceiptData[];
  companyName: string;
  onMappingReady: (result: MappingResult) => void;
  onCancel: () => void;
}

interface DirectoryEmployee {
  id: string;
  full_name: string;
  email: string;
  company_name: string;
  is_active: boolean;
}

export function MappingUpload({ receipts, companyName, onMappingReady, onCancel }: MappingUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [showSheetPicker, setShowSheetPicker] = useState(false);
  const [fileName, setFileName] = useState("");
  const [loadingDirectory, setLoadingDirectory] = useState(true);
  const [directoryResult, setDirectoryResult] = useState<MappingResult | null>(null);
  const [directoryCount, setDirectoryCount] = useState(0);
  const [useManual, setUseManual] = useState(false);

  // Auto-match from employees table on mount
  useEffect(() => {
    async function loadFromDirectory() {
      try {
        const res = await fetch("/api/employees");
        if (!res.ok) {
          setLoadingDirectory(false);
          return;
        }
        const data = await res.json();
        const employees: DirectoryEmployee[] = data.employees;
        const active = employees.filter((e) => e.is_active);
        setDirectoryCount(active.length);

        if (active.length === 0) {
          setLoadingDirectory(false);
          return;
        }

        // Match by company name first (fuzzy), then match by employee name
        const companyMatched = active.filter((e) => {
          if (norm(e.company_name) === norm(companyName)) return true;
          const result = fuzzyMatch(e.company_name, [companyName], 0.45);
          return result !== null;
        });

        if (companyMatched.length === 0) {
          // No company match — try all active employees
          const mappings = active.map((e) => ({ rawName: e.full_name, email: e.email }));
          const result = matchMappingsToReceipts(mappings, receipts);
          if (result.matched.length > 0) {
            setDirectoryResult(result);
          }
        } else {
          const mappings = companyMatched.map((e) => ({ rawName: e.full_name, email: e.email }));
          const result = matchMappingsToReceipts(mappings, receipts);
          setDirectoryResult(result);
        }
      } catch {
        // Silent fail — fall back to manual upload
      } finally {
        setLoadingDirectory(false);
      }
    }
    loadFromDirectory();
  }, [companyName, receipts]);

  const processMapping = (buf: ArrayBuffer, sheetName?: string) => {
    try {
      const mappings = parseEmailMappingWorkbook(buf, sheetName);
      if (mappings.length === 0) {
        setError(
          "No se encontraron pares nombre-correo en el archivo. " +
          "Asegúrese de que haya una columna con correos electrónicos y otra con nombres."
        );
        return;
      }
      const result = matchMappingsToReceipts(mappings, receipts);
      onMappingReady(result);
    } catch (err) {
      setError(`Error al procesar mapeo: ${(err as Error).message}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result as ArrayBuffer;
      const sheets = getMappingSheetNames(data);

      if (sheets.length > 1) {
        setBuffer(data);
        setSheetNames(sheets);
        setShowSheetPicker(true);
      } else {
        processMapping(data);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSheetSelect = (sheetName: string) => {
    if (buffer) {
      setShowSheetPicker(false);
      processMapping(buffer, sheetName);
    }
  };

  // Loading state
  if (loadingDirectory) {
    return (
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-primary">Buscando correos</h3>
        <div className="flex items-center gap-3 py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-primary" />
          <span className="text-sm text-gray-600">Consultando directorio de empleados...</span>
        </div>
      </div>
    );
  }

  // Directory auto-match found
  if (directoryResult && directoryResult.matched.length > 0 && !useManual) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-primary">Correos encontrados</h3>
          <p className="mt-1 text-[13px] text-gray-600">
            Se encontraron {directoryResult.matched.length} coincidencias en el directorio de empleados
            para &quot;{companyName}&quot;.
          </p>
        </div>

        {directoryResult.warnings.length > 0 && (
          <div className="space-y-1">
            {directoryResult.warnings.map((w, i) => (
              <div key={i} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-700">
                {w}
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onMappingReady(directoryResult)}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-light"
          >
            Usar directorio ({directoryResult.matched.length} coincidencias)
          </button>
          <button
            onClick={() => setUseManual(true)}
            className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100"
          >
            Cargar archivo diferente
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  // Manual upload (no directory match or user chose manual)
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-primary">Cargar mapeo de correos</h3>
        <p className="mt-1 text-[13px] text-gray-600">
          {directoryCount === 0
            ? "No hay empleados en el directorio. Cargue un archivo Excel con nombres y correos."
            : `No se encontraron coincidencias automáticas para "${companyName}". Cargue un archivo Excel con los correos.`}
        </p>
        {directoryCount === 0 && (
          <p className="mt-1 text-[12px] text-gray-400">
            Tip: Importe su directorio en{" "}
            <a href="/empleados" className="text-primary underline">Empleados</a>
            {" "}para que las coincidencias sean automáticas.
          </p>
        )}
      </div>

      {!showSheetPicker ? (
        <>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer rounded-lg border-2 border-dashed border-gray-200 p-8 text-center transition-colors hover:border-primary/40"
          >
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="mx-auto mb-2 text-primary opacity-70"
            >
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            <p className="text-sm font-medium text-gray-800">
              {fileName || "Haga clic para cargar archivo Excel con mapeo nombre → correo"}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Debe contener una columna con nombres y otra con correos electrónicos
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
          />
        </>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="mb-3 text-sm font-medium text-gray-700">
            El archivo tiene múltiples hojas. Seleccione la que contiene el mapeo:
          </p>
          <div className="flex flex-wrap gap-2">
            {sheetNames.map((name) => (
              <button
                key={name}
                onClick={() => handleSheetSelect(name)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-primary hover:text-white"
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={onCancel}
          className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
