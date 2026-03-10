"use client";

export interface SendStatus {
  receiptIndex: number;
  employeeName: string;
  email: string;
  status: "pending" | "sending" | "sent" | "failed";
  error?: string;
}

interface SendProgressProps {
  statuses: SendStatus[];
  currentIndex: number;
  total: number;
  onCancel: () => void;
  cancelled: boolean;
}

export function SendProgress({ statuses, currentIndex, total, onCancel, cancelled }: SendProgressProps) {
  const sent = statuses.filter((s) => s.status === "sent").length;
  const failed = statuses.filter((s) => s.status === "failed").length;
  const progress = total > 0 ? ((sent + failed) / total) * 100 : 0;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-primary">Enviando correos</h3>
        <p className="mt-1 text-[13px] text-gray-600">
          {cancelled
            ? "Envío cancelado. Los correos ya enviados no se pueden deshacer."
            : `Enviando ${currentIndex + 1} de ${total}...`}
        </p>
      </div>

      {/* Progress bar */}
      <div className="h-2 overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex gap-4 text-sm text-gray-600">
        <span className="text-green-600">{sent} enviados</span>
        {failed > 0 && <span className="text-red-600">{failed} fallidos</span>}
        <span>{total - sent - failed} pendientes</span>
      </div>

      {/* Status list */}
      <div className="max-h-64 overflow-auto rounded-lg border border-gray-200">
        <div className="divide-y divide-gray-100">
          {statuses.map((s) => (
            <div
              key={s.receiptIndex}
              className={`flex items-center gap-3 px-3 py-2 text-sm ${
                s.status === "sending" ? "bg-blue-50" : ""
              }`}
            >
              {/* Status icon */}
              <div className="flex-shrink-0">
                {s.status === "pending" && (
                  <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                )}
                {s.status === "sending" && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-primary" />
                )}
                {s.status === "sent" && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {s.status === "failed" && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <span className="font-medium text-gray-900">{s.employeeName}</span>
                <span className="ml-2 text-gray-400">{s.email}</span>
              </div>

              {s.error && (
                <span className="flex-shrink-0 text-xs text-red-500">{s.error}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {!cancelled && (
        <div className="flex justify-end">
          <button
            onClick={onCancel}
            className="rounded-lg border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
          >
            Cancelar envío
          </button>
        </div>
      )}
    </div>
  );
}
