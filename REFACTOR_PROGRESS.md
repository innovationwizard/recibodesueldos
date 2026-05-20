# Dual-Format Refactor — Implementation Progress

Companion to [REFACTOR_DUAL_FORMAT.md](REFACTOR_DUAL_FORMAT.md) (the plan).

Started: 2026-05-20

---

## Status

- **Current batch**: B complete — awaiting go-ahead for C
- **Last completed**: B1
- **Blockers**: none

---

## Batches

Each batch is small enough that progress survives context compaction — pick up from the next unchecked box.

### Batch A — Parser refactor (library only, no UI changes)

Touches only [`src/lib/excel-parser.ts`](src/lib/excel-parser.ts). After this batch, `parseWorkbook` still produces `ReceiptData[]`; nothing downstream should change behavior.

- [x] **A1.** Add `FormatAdapter` interface near top of `excel-parser.ts`; extend `ParseResult` with `formatId: 'mensual' | 'catorcenal'`, `formatLabel: string`, `dataSheetName: string`.
- [x] **A2.** Extract existing parsing logic into `mensualAdapter` object (`detect` scans for `ENCABEZADO`; `parse` is the current `parseWorkbook` body).
- [x] **A3.** Add `catorcenalAdapter`: detect via `MENU` sheet + `MENU!B4` startsWith "planilla igss"; parse with hardcoded `CATORCENAL_COLS` (B,C,D,J,K+L,N,O,P from row 10).
- [x] **A4.** Add `detectFormat(wb)` export; rewrite `parseWorkbook(wb, opts?)` as dispatcher over `[catorcenalAdapter, mensualAdapter]`. New signature: `parseWorkbook(wb, { formatId?, sheetName? })` — bare `parseWorkbook(wb)` auto-detects.
- [x] **A5.** `npx tsc --noEmit` clean. Adjustment from plan: had to also update [`ReceiptGenerator.tsx:101-104`](src/components/ReceiptGenerator.tsx#L101-L104) to use new signature (`parseWorkbook(workbook)`, dropping `matchedSheet` arg). Side effect for this batch only: the manual sheet picker step still appears in UI but its selection is ignored (auto-detect always wins). Batch C will replace the picker with the auto-detect banner.

### Batch B — Receipt component (1-line UI tweak)

- [x] **B1.** In [`src/components/Receipt.tsx`](src/components/Receipt.tsx), wrap the Anticipo line with `{data.anticipo > 0 && (...)}`, mirroring the existing `retroactivo` pattern.

### Batch C — ReceiptGenerator flow (auto-detect + banner)

Touches only [`src/components/ReceiptGenerator.tsx`](src/components/ReceiptGenerator.tsx).

- [ ] **C1.** Add `DETECTING` to `STEPS` enum. Add state: `detectedFormatLabel: string | null`, `detectedSheet: string | null`.
- [ ] **C2.** In `handleFileUpload`, after `readWorkbookFromArrayBuffer`, call `detectFormat(wb)`. On match → set state, jump to `SHEET_CONFIRM`. On miss → jump to `SHEET_SELECT` with friendly message.
- [ ] **C3.** In `SHEET_CONFIRM` view, when `detectedFormatLabel` set, render banner above existing confirm card: `✓ Formato detectado: <label> — Hoja: <sheet>`. "Buscar otra hoja" button still drops to manual `SHEET_SELECT`.
- [ ] **C4.** In `handleConfirm`, call `parseWorkbook(workbook)` (auto-detect path) when banner is shown, or `mensualAdapter.parse(workbook, matchedSheet)` (manual override path). Show parse error if either throws.

### Batch D — Manual smoke tests (user-driven)

Run `npm run dev` and verify each in the browser.

- [ ] **D1.** Old format regression: upload [`PLANTILLA PARA BOLETA.xlsx`](PLANTILLA%20PARA%20BOLETA.xlsx). Banner shows mensual + the FEBRERO sheet. Receipts match pre-refactor output (spot-check 2–3 employees).
- [ ] **D2.** Mayo template regression: upload [`PLANTILLA_MAYO.xlsx`](PLANTILLA_MAYO.xlsx). Banner shows mensual + ABRIL. Retroactivo line visible where applicable.
- [ ] **D3.** New format: upload [`2ndformat/PLANILLA-Y-RECIBOS-DE-PAGO-DEL-25-04-2026-AL-08-05-2026.xlsx`](2ndformat/PLANILLA-Y-RECIBOS-DE-PAGO-DEL-25-04-2026-AL-08-05-2026.xlsx). Banner shows catorcenal + MENU. 20 receipts. No Anticipo or Retroactivo lines. Computed liquido per row within Q 0.01 of `MENU!R{row}`.
- [ ] **D4.** Unknown format: upload any unrelated xlsx (`LISTADO DE PERSONAL Y CORREO.xlsx` is handy). Verify "Formato no reconocido" message + manual sheet picker reachable.
- [ ] **D5.** Downstream smoke: for one mensual and one catorcenal batch, verify PDF export ("Exportar juntos" + "Exportar separados"), email send flow opens, and rows land in `receipts` table with correct values.

### Batch E — Changelog & doc finalization

- [ ] **E1.** Add `changelog/007-dual-format-catorcenal.md` documenting the user-visible changes (auto-detect, banner, hidden zero lines, new format support).
- [ ] **E2.** At the top of [`REFACTOR_DUAL_FORMAT.md`](REFACTOR_DUAL_FORMAT.md), note completion date and link to changelog 007.

---

## Decisions log (from REFACTOR_DUAL_FORMAT.md §6)

| Topic | Decision |
|---|---|
| Anticipo line when value is 0/absent | Hide |
| Source-provided totals (catorcenal cols Q, R) | Ignore — always compute |
| Format selection UX | Auto-detect with confirmation banner |

---

## Open questions

| # | Question | Answer |
|---|---|---|
| 1 | Manual-fallback path when auto-detect fails | **Ask the user which format it is** (mensual / catorcenal), then route to that adapter. See "Manual-fallback flow" below for the concrete UX. |
| 2 | Implementation pacing | **Pause after each code batch** (A, B, C report-and-wait; D is user-driven; E after D). |
| 3 | Commit cadence | **No commits by Claude.** Propose commit message text at the end of each batch; user commits manually. |

### Manual-fallback flow (interpretation of Q1)

When `detectFormat(wb)` returns `null`:

1. Show a new step `FORMAT_PICK`: two buttons `Mensual` / `Catorcenal`, with a short explainer.
2. If **Mensual** chosen → drop into the existing `SHEET_SELECT` flow; final parse via `mensualAdapter.parse(wb, pickedSheet)`. If that sheet has no `ENCABEZADO`, surface the parse error as today.
3. If **Catorcenal** chosen → check for `MENU` sheet; if present, parse via `catorcenalAdapter.parse(wb, "MENU")`; if absent, error: `"Esperaba hoja 'MENU' para formato catorcenal. Hojas: <names>"`.

This interpretation will be re-confirmed at the start of Batch C.

---

## File touchpoints (from plan §5)

| File | Status | Batch |
|---|---|---|
| [`src/lib/excel-parser.ts`](src/lib/excel-parser.ts) | not started | A |
| [`src/components/Receipt.tsx`](src/components/Receipt.tsx) | not started | B |
| [`src/components/ReceiptGenerator.tsx`](src/components/ReceiptGenerator.tsx) | not started | C |
| `changelog/007-dual-format-catorcenal.md` (new) | not started | E |

No changes expected to `DashboardClient.tsx`, `pdf-generator.ts`, `print-css.ts`, `email/`, or any migration file.

---

## Notes

- The new format's sample file has all `MENU!C` names redacted to "Dina Paola Morales". Real production files presumably have distinct names. Receipts will all show the same name on this specific sample — not a bug.
- Sheet `"1"` in the new format is ignored; we generate receipts from `MENU` tabular data.
- `comprobante` number, DPI, `EMPRESA DE ORIGEN`, `DIAS LABORADOS`, `FALTAS` are not captured. Out of scope per plan §7.
