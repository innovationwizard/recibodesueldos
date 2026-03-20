"use client";

import { useState } from "react";
import type { MatchedRecipient, UnmatchedEntry } from "@/lib/email-mapping-parser";

interface RecipientPreviewProps {
  matched: MatchedRecipient[];
  unmatched: UnmatchedEntry[];
  warnings: string[];
  onToggle: (receiptIndex: number) => void;
  onToggleAll: (selected: boolean) => void;
  onUpdateEmail: (receiptIndex: number, email: string) => void;
  onConfirm: () => void;
  onBack: () => void;
}

export function RecipientPreview({
  matched,
  unmatched,
  warnings,
  onToggle,
  onToggleAll,
  onUpdateEmail,
  onConfirm,
  onBack,
}: RecipientPreviewProps) {
  const selectedCount = matched.filter((m) => m.selected).length;
  const allSelected = selectedCount === matched.length;
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-primary">Confirmar destinatarios</h3>
        <p className="mt-1 text-[13px] text-gray-600">
          Revise las coincidencias y desmarque quienes no deban recibir correo.
        </p>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-1.5">
          {warnings.map((w, i) => (
            <div
              key={i}
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-700"
            >
              {w}
            </div>
          ))}
        </div>
      )}

      {/* Summary + toggle all */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">
          {selectedCount} de {matched.length} seleccionados
        </span>
        <button
          onClick={() => onToggleAll(!allSelected)}
          className="text-sm font-medium text-primary hover:underline"
        >
          {allSelected ? "Deseleccionar todos" : "Seleccionar todos"}
        </button>
      </div>

      {/* Matched table */}
      <div className="max-h-80 overflow-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50">
            <tr className="text-left text-xs text-gray-500">
              <th className="px-3 py-2 font-medium"></th>
              <th className="px-3 py-2 font-medium">Colaborador</th>
              <th className="px-3 py-2 font-medium">Correo</th>
              <th className="px-3 py-2 font-medium text-center">Coincidencia</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {matched.map((m) => (
              <tr
                key={m.receiptIndex}
                className={`transition-colors ${m.selected ? "bg-white" : "bg-gray-50 opacity-60"}`}
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={m.selected}
                    onChange={() => onToggle(m.receiptIndex)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium text-gray-900">{m.employeeName}</div>
                  {m.mappingName !== m.employeeName && (
                    <div className="text-[11px] text-gray-400">Mapeo: {m.mappingName}</div>
                  )}
                </td>
                <td className="px-3 py-2">
                  {editingIndex === m.receiptIndex ? (
                    <div className="flex gap-1">
                      <input
                        type="email"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && EMAIL_RE.test(editValue.trim())) {
                            onUpdateEmail(m.receiptIndex, editValue.trim());
                            setEditingIndex(null);
                          } else if (e.key === "Escape") {
                            setEditingIndex(null);
                          }
                        }}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-primary"
                        autoFocus
                      />
                      <button
                        onClick={() => {
                          if (EMAIL_RE.test(editValue.trim())) {
                            onUpdateEmail(m.receiptIndex, editValue.trim());
                            setEditingIndex(null);
                          }
                        }}
                        className="rounded bg-primary px-2 py-1 text-xs font-medium text-white"
                      >
                        OK
                      </button>
                      <button
                        onClick={() => setEditingIndex(null)}
                        className="rounded bg-gray-200 px-2 py-1 text-xs font-medium text-gray-700"
                      >
                        X
                      </button>
                    </div>
                  ) : (
                    <span
                      className="cursor-pointer text-gray-600 hover:text-primary hover:underline"
                      onClick={() => { setEditingIndex(m.receiptIndex); setEditValue(m.email); }}
                      title="Clic para editar correo"
                    >
                      {m.email}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  {m.matchScore === 0 ? (
                    <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
                      Exacta
                    </span>
                  ) : (
                    <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                      Parcial
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Unmatched */}
      {unmatched.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="mb-1 text-xs font-semibold text-red-700">
            Sin coincidencia ({unmatched.length}):
          </p>
          <div className="space-y-0.5">
            {unmatched.map((u, i) => (
              <div key={i} className="text-[12px] text-red-600">
                {u.name} → {u.email}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100"
        >
          Atrás
        </button>
        <button
          onClick={onConfirm}
          disabled={selectedCount === 0}
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-light disabled:opacity-50"
        >
          Enviar {selectedCount} correo{selectedCount !== 1 ? "s" : ""}
        </button>
      </div>
    </div>
  );
}
