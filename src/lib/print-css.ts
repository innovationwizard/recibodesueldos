export function getPrintCSS(): string {
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
