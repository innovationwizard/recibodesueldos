"use client";

import type { ReceiptData } from "@/lib/excel-parser";
import { fmt } from "@/lib/format";

interface ReceiptProps {
  data: ReceiptData;
  isSecondOnPage?: boolean;
}

export function Receipt({ data, isSecondOnPage = false }: ReceiptProps) {
  return (
    <div
      className={`receipt font-sans text-primary ${
        isSecondOnPage ? "receipt-bottom" : "receipt-top"
      }`}
    >
      <div className="receipt-inner flex flex-1 flex-col">
        <div className="receipt-header mb-2 text-center">
          <div className="company-name text-xs font-bold uppercase tracking-wider">
            {data.companyName}
          </div>
          <div className="receipt-title mt-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-500">
            CONSTANCIA DE PAGO
          </div>
        </div>

        <div className="receipt-date mb-2 text-right text-[9.5px] text-gray-600">
          Guatemala, {data.receiptDate}
        </div>

        <div className="receipt-info-grid mb-2">
          <div className="info-row flex text-[10px] leading-[1.8]">
            <span className="info-label w-20 shrink-0 font-semibold">
              Colaborador:
            </span>
            <span className="info-value flex-1 border-b border-gray-200 pl-1">
              {data.nombre}
            </span>
          </div>
          <div className="info-row flex text-[10px] leading-[1.8]">
            <span className="info-label w-20 shrink-0 font-semibold">
              Puesto:
            </span>
            <span className="info-value flex-1 border-b border-gray-200 pl-1">
              {data.puesto}
            </span>
          </div>
          <div className="info-row flex text-[10px] leading-[1.8]">
            <span className="info-label w-20 shrink-0 font-semibold">
              Período:
            </span>
            <span className="info-value flex-1 border-b border-gray-200 pl-1">
              {data.dateRange}
            </span>
          </div>
        </div>

        <div className="receipt-body flex-1">
          <div className="columns-container mb-2 flex gap-3">
            <div className="column-ingresos flex-1">
              <div className="column-header mb-1 border-b-2 border-primary pb-0.5 text-[9px] font-bold uppercase tracking-wider">
                INGRESOS
              </div>
              <div className="line-item flex justify-between px-0.5 text-[9.5px] leading-[1.8]">
                <span>Sueldo Ordinario</span>
                <span className="amount min-w-[70px] text-right tabular-nums">
                  Q {fmt(data.salario)}
                </span>
              </div>
              <div className="line-item flex justify-between px-0.5 text-[9.5px] leading-[1.8]">
                <span>Bonificación Decreto</span>
                <span className="amount min-w-[70px] text-right tabular-nums">
                  Q {fmt(data.bonificacion)}
                </span>
              </div>
              <div className="line-item flex justify-between px-0.5 text-[9.5px] leading-[1.8]">
                <span>Bonificación Especial</span>
                <span className="amount min-w-[70px] text-right tabular-nums">
                  Q {fmt(data.bonificacionEspecial)}
                </span>
              </div>
              <div className="total-line line-item mt-0.5 flex justify-between border-t border-gray-500 px-0.5 pt-0.5 text-[9.5px] font-bold leading-[1.8]">
                <span>TOTAL INGRESOS</span>
                <span className="amount min-w-[70px] text-right tabular-nums">
                  Q {fmt(data.totalIngresos)}
                </span>
              </div>
            </div>

            <div className="column-egresos flex-1">
              <div className="column-header mb-1 border-b-2 border-primary pb-0.5 text-[9px] font-bold uppercase tracking-wider">
                DESCUENTOS
              </div>
              <div className="line-item flex justify-between px-0.5 text-[9.5px] leading-[1.8]">
                <span>IGSS</span>
                <span className="amount min-w-[70px] text-right tabular-nums">
                  Q {fmt(data.igss)}
                </span>
              </div>
              <div className="line-item flex justify-between px-0.5 text-[9.5px] leading-[1.8]">
                <span>ISR</span>
                <span className="amount min-w-[70px] text-right tabular-nums">
                  Q {fmt(data.isr)}
                </span>
              </div>
              <div className="line-item flex justify-between px-0.5 text-[9.5px] leading-[1.8]">
                <span>Anticipo 1ra Quincena</span>
                <span className="amount min-w-[70px] text-right tabular-nums">
                  Q {fmt(data.anticipo)}
                </span>
              </div>
              <div className="line-item flex justify-between px-0.5 text-[9.5px] leading-[1.8]">
                <span>Otros</span>
                <span className="amount min-w-[70px] text-right tabular-nums">
                  Q {fmt(data.otros)}
                </span>
              </div>
              <div className="total-line line-item mt-0.5 flex justify-between border-t border-gray-500 px-0.5 pt-0.5 text-[9.5px] font-bold leading-[1.8]">
                <span>TOTAL DESCUENTOS</span>
                <span className="amount min-w-[70px] text-right tabular-nums">
                  Q {fmt(data.totalDescuentos)}
                </span>
              </div>
            </div>
          </div>

          <div className="liquido-section mt-1 flex items-center justify-between bg-primary px-3 py-1.5 text-[10px] font-bold tracking-wide text-white">
            <span>LÍQUIDO A RECIBIR</span>
            <span className="liquido-amount text-xs tabular-nums">
              Q {fmt(data.liquido)}
            </span>
          </div>
        </div>

        <div className="signature-section mt-4 flex justify-center pt-4">
          <div className="signature-block w-[180px] text-center">
            <div className="signature-line h-6 border-b border-gray-700" />
            <div className="signature-label mt-0.5 text-[8px] tracking-wide text-gray-600">
              Firma del Colaborador
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
