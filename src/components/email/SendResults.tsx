"use client";

import type { SendStatus } from "./SendProgress";

interface SendResultsProps {
  statuses: SendStatus[];
  onResend: (receiptIndices: number[]) => void;
  onClose: () => void;
  resending: boolean;
}

export function SendResults({ statuses, onResend, onClose, resending }: SendResultsProps) {
  const sent = statuses.filter((s) => s.status === "sent");
  const failed = statuses.filter((s) => s.status === "failed");

  const handleResendFailed = () => {
    onResend(failed.map((s) => s.receiptIndex));
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-primary">Resultado del envío</h3>
      </div>

      {/* Summary */}
      <div className="flex gap-3">
        <div className="flex-1 rounded-lg border border-green-200 bg-green-50 p-3 text-center">
          <div className="text-2xl font-bold text-green-700">{sent.length}</div>
          <div className="text-xs text-green-600">Enviados</div>
        </div>
        {failed.length > 0 && (
          <div className="flex-1 rounded-lg border border-red-200 bg-red-50 p-3 text-center">
            <div className="text-2xl font-bold text-red-700">{failed.length}</div>
            <div className="text-xs text-red-600">Fallidos</div>
          </div>
        )}
      </div>

      {/* Failed details */}
      {failed.length > 0 && (
        <div className="rounded-lg border border-red-200">
          <div className="border-b border-red-200 bg-red-50 px-3 py-2">
            <span className="text-sm font-semibold text-red-700">Correos fallidos</span>
          </div>
          <div className="divide-y divide-red-100">
            {failed.map((s) => (
              <div key={s.receiptIndex} className="px-3 py-2">
                <div className="text-sm font-medium text-gray-900">{s.employeeName}</div>
                <div className="text-xs text-gray-500">{s.email}</div>
                {s.error && <div className="mt-0.5 text-xs text-red-500">{s.error}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sent details */}
      {sent.length > 0 && (
        <details className="rounded-lg border border-gray-200">
          <summary className="cursor-pointer bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700">
            Correos enviados ({sent.length})
          </summary>
          <div className="divide-y divide-gray-100">
            {sent.map((s) => (
              <div key={s.receiptIndex} className="flex justify-between px-3 py-2 text-sm">
                <span className="text-gray-900">{s.employeeName}</span>
                <span className="text-gray-500">{s.email}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Actions */}
      <div className="flex justify-between">
        <button
          onClick={onClose}
          className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100"
        >
          Cerrar
        </button>
        {failed.length > 0 && (
          <button
            onClick={handleResendFailed}
            disabled={resending}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-light disabled:opacity-50"
          >
            {resending ? "Reenviando..." : `Reenviar ${failed.length} fallido${failed.length !== 1 ? "s" : ""}`}
          </button>
        )}
      </div>
    </div>
  );
}
