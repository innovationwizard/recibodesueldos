# Refactor: Dual-Format XLSX Support

> **Status: implemented.** Plan produced 2026-05-20, code landed 2026-05-20 across three commits on `main`.
> User-facing summary: [`changelog/007-dual-format-catorcenal.md`](changelog/007-dual-format-catorcenal.md).
> Implementation log: [`REFACTOR_PROGRESS.md`](REFACTOR_PROGRESS.md).

Findings and design plan for adding a second xlsx format (catorcenal IGSS) alongside the existing mensual+quincenal format. Produced 2026-05-20.

Sample files referenced:
- **Old / mensual**: [`PLANTILLA PARA BOLETA.xlsx`](PLANTILLA PARA BOLETA.xlsx), [`PLANTILLA_MAYO.xlsx`](PLANTILLA_MAYO.xlsx)
- **New / catorcenal**: [`2ndformat/PLANILLA-Y-RECIBOS-DE-PAGO-DEL-25-04-2026-AL-08-05-2026.xlsx`](2ndformat/PLANILLA-Y-RECIBOS-DE-PAGO-DEL-25-04-2026-AL-08-05-2026.xlsx)

Related prior work: [`PLANTILLA_MAYO_MANIFEST.md`](PLANTILLA_MAYO_MANIFEST.md), [`changelog/006-plantilla-mayo-retroactivo.md`](changelog/006-plantilla-mayo-retroactivo.md).

---

## 1. New format structure (sheets, headers, data layout)

### Workbook overview

The new file contains 4 sheets:

| Sheet | Range | Role |
|---|---|---|
| `FECHA` | F4:K10 | Tiny metadata sheet (company, period dates as serials, comprobante #) |
| `MENU` | B1:S43 | **Master tabular planilla — primary data source** |
| `1` | A1:H938 | Pre-rendered printable receipts, two copies per employee |
| `Resumen` | F1:M43 | Liquid-to-pay summary list (No., Nombre, Liquido) |

The app should treat `MENU` as the data source. Sheet `"1"` is the printable artifact the company would otherwise hand-print; we ignore it because the app generates its own receipts from tabular data so they render consistently for screen / PDF / email.

### `FECHA` sheet contents

```
G4  "CICOGUA, S.A."                                  -- company
G7  "DE"            I7  "AL"                         -- labels
G8  46137           I8  46150                        -- excel serial dates
G9  "COMPROBANTE"   I9  27                           -- comprobante number
F10 "PLANILLA IGSS SERIE \"B\" CATORCENAL DEL PERIODO 25/04/2026 AL 22/05/2026"
```

### `MENU` sheet header layout

Single header row at row 9 (the old format used multi-row headers at rows 8/9/10):

| Col | Row 9 header |
|---|---|
| B | `No.` |
| C | `NOMBRE` |
| D | `PUESTO` |
| E | `CODIGO INTERNO` |
| F | `NO. CTA` |
| G | `ORDINARIO MENSUAL` |
| H | `BONIFICACIÓN MENSUAL` |
| I | `DIAS LABORADOS` |
| J | `SALARIO DEVENGADO` |
| K | `BONIFICACIÓN DECRETO 78-89 y 37-2001 MENSUAL` |
| L | `BONIFICACIÓN DECRETO 78-89 y 37-2001 MENSUAL` *(duplicate name; this column holds the diaria portion)* |
| M | `TOTAL DEVENGADO` |
| N | `IGSS` |
| O | `ISR` |
| P | `OTROS` |
| Q | `TOTAL DESCUENTOS` |
| R | `LIQUIDO A RECIBIR` |
| S | `EMPRESA DE ORIGEN` |

### `MENU` sheet meta-cells

```
B2   company name        ("CONCEPTOS INNOVADORES CONSTRUCTIVOS DE GUATEMALA, S. A. (CICOGUA)")
B3   "PLANILLA DE SALARIOS "
B4   period description  ("PLANILLA IGSS SERIE \"B\" CATORCENAL DEL PERIODO 25/04/2026 AL 22/05/2026")
B5   "CIFRAS EXPRESADAS EN QUETZALES"
B6/C6  NIT label + value
C8   comprobante number  (27)
M7   human-readable date range  ("25 DE ABRIL DEL 2026 AL 8 DE MAYO DEL 2026")
```

### `MENU` data rows

Rows 10 through 29 in the sample (20 employees). Row 30 is a totals row with no ordinal in col B — naturally excluded by an "ordinal must be numeric" filter.

Example row (employee 1, after sample's name anonymization):

```
B10 1                       (No.)
C10 "Dina Paola Morales"    (NOMBRE — note: all rows share this name in the sample;
                             real files presumably have distinct names. Sheet "1"
                             confirms by carrying real per-employee names.)
D10 "Supervisora de Proyecto" (PUESTO)
G10 9750                    (ORDINARIO MENSUAL — gross monthly base)
H10 250                     (BONIFICACIÓN MENSUAL — typically Q 250)
I10 13                      (DIAS LABORADOS)
J10 4526.79                 (SALARIO DEVENGADO — earned for this 14-day period)
L10 116.07                  (Bonif. decreto, diaria portion)
M10 4642.86                 (TOTAL DEVENGADO = J + K + L)
N10 218.64                  (IGSS)
O10 158.79                  (ISR)
Q10 377.43                  (TOTAL DESCUENTOS = N + O + P)
R10 4265.42                 (LIQUIDO = M − Q)
S10 "CICOGUA, S.A."         (EMPRESA DE ORIGEN — payroll group; sometimes blank)
```

### Sheet `"1"` (pre-rendered receipts, informational only)

28 receipt blocks (14 unique employees × 2 copies — employee copy + company copy). Block size ~35 rows. Each block contains:

- Header lines (company, period, comprobante #, days worked, faltas, periodo from/al)
- Employee block (NO. TRABAJADOR, NOMBRE, PUESTO, DEPARTAMENTO, DPI)
- INGRESOS / DEDUCCIONES two-column layout
- TOTAL INGRESOS, TOTAL DESCUENTOS, LIQUIDO A RECIBIR, EN LETRAS
- Signature line, DPI under signature
- Legal paragraph about electronic transfer

This sheet has DPI per employee — which `MENU` does not. Data points unique to sheet `"1"`:
- `DPI` (e.g., `2085145380101`)
- `DEPARTAMENTO` (e.g., `OPERACIONES`)
- `FALTAS`
- `EN LETRAS` (amount spelled out)

These are **not consumed by this refactor** because the app's receipt template has no slot for them.

---

## 2. Field mapping (new format → `ReceiptData`)

`ReceiptData` interface lives at [`src/lib/excel-parser.ts:164-182`](src/lib/excel-parser.ts#L164-L182). Mapping:

| `ReceiptData` field | Catorcenal source | Notes |
|---|---|---|
| `ordinal` | `MENU!B{row}` | numeric only; non-numeric terminates the data loop |
| `companyName` | `MENU!B2` | same cell as old format |
| `dateRange` | `MENU!M7` (preferred), fallback `MENU!B4` | M7 is the human-readable form |
| `receiptDate` | `parseLastDate(dateRange)` | reuse existing Spanish-date parser at [`src/lib/excel-parser.ts:71`](src/lib/excel-parser.ts#L71) |
| `nombre` | `MENU!C{row}` | |
| `puesto` | `MENU!D{row}` | |
| `salario` | `MENU!J{row}` — `SALARIO DEVENGADO` | **load-bearing decision**: J (devengado for the catorcena), not M (total) |
| `bonificacion` | `0` | legacy field, always 0 (same as old format today) |
| `bonificacionEspecial` | `MENU!K{row} + MENU!L{row}` | both columns share the header `BONIFICACIÓN DECRETO 78-89 y 37-2001 MENSUAL` |
| `retroactivo` | `0` | concept doesn't exist in catorcenal format |
| `igss` | `MENU!N{row}` | |
| `isr` | `MENU!O{row}` | |
| `anticipo` | `0` | catorcenal has no quincena advance |
| `otros` | `MENU!P{row}` | |
| `totalIngresos` | computed: `salario + bonificacionEspecial` | per user decision, ignore source-provided M |
| `totalDescuentos` | computed: `igss + isr + otros` | per user decision, ignore source-provided Q |
| `liquido` | computed: `totalIngresos − totalDescuentos` | per user decision, ignore source-provided R |

### Field comparison (old vs new)

| `ReceiptData` field | Mensual source | Catorcenal source |
|---|---|---|
| `companyName` | `B2` | `B2` ✓ same |
| `dateRange` | `B4` | `M7` (or `B4`) |
| `salario` | col S — `SALARIO BASE DEVENGADO EN EL MES` | col J — `SALARIO DEVENGADO` |
| `bonificacionEspecial` | col R — `BONIFICACIÓN DECRETO MENSUAL` | col K + col L — both with same header |
| `retroactivo` | col H — `RETROACTIVO SALARIAL` | not present (0) |
| `igss` | col N | col N ✓ coincidence |
| `isr` | col O | col O ✓ coincidence |
| `anticipo` | col J — `ANTICIPO 1RA QUINCENA` | not present (0) |
| `otros` | col P | col P ✓ coincidence |
| Pay periodicity | monthly with quincena advance | every 14 days (catorcenal) |

---

## 3. Format-detection heuristics

Adapters run in priority order; first to match wins.

### Priority 1 — `catorcenal`

```
wb.SheetNames includes "MENU"
AND norm(wb.Sheets["MENU"]!B4) startsWith "planilla igss"
```

Returns `{ matched: true, sheet: "MENU" }`.

### Priority 2 — `mensual` (current logic, generalized)

```
∃ sheet such that, within the first 30 rows of column A,
  some cell value matches "encabezado" (fuzzy, ratio ≤ 0.4)
```

Returns `{ matched: true, sheet: <that sheet name> }`. This is exactly what [`findHeaderRows`](src/lib/excel-parser.ts#L110) does today, lifted into the detector.

### No match

Throw `"Formato no reconocido. Hojas: <sheetNames>"`. The UI catches and drops back to manual sheet picker (the existing flow) as a safety net for unforeseen formats.

### Why these specific signals

- **`MENU` sheet name** — distinctive: old format names its data sheet by month (`FEBRERO`, `ABRIL`). Unlikely collision.
- **`B4` starts with `"planilla igss"`** — guards against the unlikely case that some future old-format file also names a sheet `MENU`. The header string is structural to the catorcenal format.
- **`ENCABEZADO` marker** — already the structural anchor the old parser relies on; using the same signal for detection keeps semantics aligned.

### Rejected alternatives

- *Detect by filename* — fragile; users rename files.
- *Detect by sheet count* — too coincidental.
- *Manual user toggle before upload* — extra clicks per use; auto-detect with banner gives the user the same visibility for free.

---

## 4. Downstream consumers — impact analysis

### 4.1 [`src/lib/excel-parser.ts`](src/lib/excel-parser.ts)

The parser becomes a thin dispatcher. New shape:

```ts
parseWorkbook(wb)                          // PUBLIC API
  ├── detectFormat(wb) → FormatAdapter      // tries each adapter
  └── adapter.parse(wb) → ParseResult       // adapter handles the rest
```

`ParseResult` gains three fields (`ReceiptData` unchanged):

```ts
interface ParseResult {
  receipts: ReceiptData[]
  companyName: string
  dateRange: string
  formatId: 'mensual' | 'catorcenal'        // NEW
  formatLabel: string                       // NEW — for UI banner
  dataSheetName: string                     // NEW — for UI banner
  warnings: string[]
}
```

### 4.2 [`src/components/Receipt.tsx`](src/components/Receipt.tsx)

**One change**: wrap the `Anticipo 1ra Quincena` line at [`Receipt.tsx:109-114`](src/components/Receipt.tsx#L109-L114) with a `data.anticipo > 0 &&` guard, mirroring the existing pattern for `retroactivo` at [`Receipt.tsx:77-84`](src/components/Receipt.tsx#L77-L84).

Receipt doesn't need to know which format produced the data; the `ReceiptData` contract is unchanged. The catorcenal adapter simply leaves `anticipo` and `retroactivo` at 0.

**Side effect**: in the old format too, the Anticipo line will disappear when its value happens to be zero. This is consistent with how Retroactivo already behaves. Confirmed acceptable by user.

### 4.3 [`src/components/ReceiptGenerator.tsx`](src/components/ReceiptGenerator.tsx)

Step machine changes. Today:
```
UPLOAD → SHEET_SELECT → SHEET_CONFIRM → PROCESSING → DONE | ERROR
```

New flow (per user decision: "auto-detect, show banner"):
```
UPLOAD → DETECTING → SHEET_CONFIRM(with banner) → PROCESSING → DONE | ERROR
                  ↘ (detection fails) → SHEET_SELECT (existing manual path)
```

- After upload, immediately call `detectFormat(wb)`.
- On success: skip `SHEET_SELECT`, jump to `SHEET_CONFIRM` with a banner:
  ```
  ✓ Formato detectado: Planilla IGSS catorcenal — Hoja: MENU
  ```
  The existing "Buscar otra hoja" button stays as an escape hatch back to manual `SHEET_SELECT`.
- On failure: jump to `SHEET_SELECT` with message `"Formato no reconocido — selecciona la hoja manualmente"`.

### 4.4 [`src/app/dashboard/DashboardClient.tsx`](src/app/dashboard/DashboardClient.tsx)

**No changes.** It consumes `ReceiptData` (interface unchanged) and writes to the `receipts` table with fields that all map cleanly:

| DB column | Catorcenal value |
|---|---|
| `salary` | `r.salario` (catorcena devengado) |
| `bonus` | `0` |
| `special_bonus` | `r.bonificacionEspecial` (K + L) |
| `retroactivo` | `0` |
| `advance` | `0` |
| `other` | `r.otros` |
| `total_income`, `total_deductions`, `net_pay` | computed |

### 4.5 Database schema

**No migration needed.** The `receipts` table columns at [`supabase/migrations/20240218000001_initial_schema.sql`](supabase/migrations/20240218000001_initial_schema.sql) all accept zero values for the unused fields (`advance`, `retroactivo`).

Pre-existing housekeeping note (out of scope for this refactor): `retroactivo` column is referenced by `DashboardClient` insert at [`DashboardClient.tsx:71`](src/app/dashboard/DashboardClient.tsx#L71) and documented in [`changelog/006-plantilla-mayo-retroactivo.md`](changelog/006-plantilla-mayo-retroactivo.md) but I could not find a SQL migration adding the column to `supabase/migrations/`. Either the column was added manually in production or the migration file is missing. Worth verifying before deploy — but unrelated to this refactor.

### 4.6 Other consumers — verified unchanged

- [`src/lib/pdf-generator.ts`](src/lib/pdf-generator.ts) — operates on rendered HTML, not `ReceiptData` directly.
- [`src/lib/print-css.ts`](src/lib/print-css.ts) — CSS only.
- [`src/components/email/`](src/components/email/) — consumes `ReceiptData`, interface unchanged.

---

## 5. Refactor plan — format-adapter pattern

### Adapter contract

```ts
interface FormatAdapter {
  id: 'mensual' | 'catorcenal'
  label: string                                      // human, for UI banner
  detect(wb: XLSX.WorkBook):
    | { matched: true; sheet: string }
    | { matched: false }
  parse(wb: XLSX.WorkBook, sheet: string): ParseResult
}
```

Two adapters registered in an ordered array. `parseWorkbook(wb)` walks the array, returns the first match's `parse()` output.

### Dispatcher

```ts
const ADAPTERS: FormatAdapter[] = [catorcenalAdapter, mensualAdapter]

export function parseWorkbook(wb: XLSX.WorkBook): ParseResult {
  for (const adapter of ADAPTERS) {
    const det = adapter.detect(wb)
    if (det.matched) return adapter.parse(wb, det.sheet)
  }
  throw new Error(`Formato no reconocido. Hojas: ${wb.SheetNames.join(', ')}`)
}

export function detectFormat(wb: XLSX.WorkBook):
  | { adapter: FormatAdapter; sheet: string }
  | null {
  for (const adapter of ADAPTERS) {
    const det = adapter.detect(wb)
    if (det.matched) return { adapter, sheet: det.sheet }
  }
  return null
}
```

`detectFormat` is exported separately so `ReceiptGenerator` can show the banner *before* committing to processing.

### `mensualAdapter`

Lift today's [`parseWorkbook`](src/lib/excel-parser.ts#L193) body verbatim, plus its helpers (`findHeaderRows`, `discoverColumns`, `FIELD_TARGETS`). Wrap in:

```ts
const mensualAdapter: FormatAdapter = {
  id: 'mensual',
  label: 'Planilla mensual',
  detect(wb) {
    for (const name of wb.SheetNames) {
      if (findHeaderRows(wb.Sheets[name]).length > 0) {
        return { matched: true, sheet: name }
      }
    }
    return { matched: false }
  },
  parse(wb, sheet) { /* existing parseWorkbook body */ }
}
```

### `catorcenalAdapter`

Hardcoded column positions — no fuzzy header discovery needed, since the layout is fixed.

```ts
const CATORCENAL_COLS = {
  ordinal: 1, nombre: 2, puesto: 3,       // B, C, D
  salario: 9,                              // J — SALARIO DEVENGADO
  bonifDecretoTotal: 10,                   // K
  bonifDecretoDiaria: 11,                  // L
  igss: 13, isr: 14, otros: 15,            // N, O, P
} as const

const catorcenalAdapter: FormatAdapter = {
  id: 'catorcenal',
  label: 'Planilla IGSS catorcenal',
  detect(wb) {
    if (!wb.SheetNames.includes('MENU')) return { matched: false }
    const b4 = wb.Sheets['MENU']?.['B4']?.v
    if (norm(b4).startsWith('planilla igss')) {
      return { matched: true, sheet: 'MENU' }
    }
    return { matched: false }
  },
  parse(wb, sheet) {
    const s = wb.Sheets[sheet]
    const range = XLSX.utils.decode_range(s['!ref'] || 'A1')
    const companyName = String(s['B2']?.v ?? '').trim()
    const m7 = String(s['M7']?.v ?? '').trim()
    const b4 = String(s['B4']?.v ?? '').trim()
    const dateRange = m7 || b4
    const receipts: ReceiptData[] = []

    for (let r = 9; r <= range.e.r; r++) {        // row 10 in 1-based
      const ord = s[XLSX.utils.encode_cell({ r, c: CATORCENAL_COLS.ordinal })]?.v
      const ordNum = typeof ord === 'number' ? ord : parseFloat(String(ord))
      if (isNaN(ordNum)) continue                 // skips totals row 30

      const cell = (c: number) =>
        s[XLSX.utils.encode_cell({ r, c })]?.v
      const nombre = String(cell(CATORCENAL_COLS.nombre) ?? '').trim()
      if (!nombre) continue

      const salario = toNum(cell(CATORCENAL_COLS.salario))
      const bonificacionEspecial =
        toNum(cell(CATORCENAL_COLS.bonifDecretoTotal)) +
        toNum(cell(CATORCENAL_COLS.bonifDecretoDiaria))
      const igss = toNum(cell(CATORCENAL_COLS.igss))
      const isr = toNum(cell(CATORCENAL_COLS.isr))
      const otros = toNum(cell(CATORCENAL_COLS.otros))
      const totalIngresos = salario + bonificacionEspecial
      const totalDescuentos = igss + isr + otros

      receipts.push({
        ordinal: ordNum, companyName, dateRange,
        receiptDate: parseLastDate(dateRange),
        nombre, puesto: String(cell(CATORCENAL_COLS.puesto) ?? '').trim(),
        salario, bonificacion: 0, bonificacionEspecial, retroactivo: 0,
        igss, isr, anticipo: 0, otros,
        totalIngresos, totalDescuentos,
        liquido: totalIngresos - totalDescuentos,
      })
    }

    if (receipts.length === 0) {
      throw new Error('No se encontraron filas de datos válidas en MENU')
    }

    return {
      receipts, companyName, dateRange,
      formatId: 'catorcenal',
      formatLabel: 'Planilla IGSS catorcenal',
      dataSheetName: sheet,
      warnings: [],
    }
  }
}
```

### `Receipt.tsx` change

```tsx
{data.anticipo > 0 && (
  <div className="line-item flex justify-between px-0.5 text-[9.5px] leading-[1.8]">
    <span>Anticipo 1ra Quincena</span>
    <span className="amount min-w-[70px] text-right tabular-nums">
      Q {fmt(data.anticipo)}
    </span>
  </div>
)}
```

### `ReceiptGenerator.tsx` changes

- Add `DETECTING` to the `STEPS` enum.
- After workbook is read in `handleFileUpload`, immediately call `detectFormat(wb)`. On match, set state (`detectedFormatLabel`, `detectedSheet`) and jump to `SHEET_CONFIRM`. On miss, jump to `SHEET_SELECT`.
- In the `SHEET_CONFIRM` view, when `detectedFormatLabel` is set, render the banner above the existing card. When not (manual path), render only the existing card.
- `handleConfirm` continues to call `parseWorkbook(workbook, matchedSheet)` — but `parseWorkbook` ignores the sheet name and re-detects, since both adapters self-discover their data sheet. (Alternative: change signature to `parseWorkbook(wb)` and drop `matchedSheet` entirely. Cleaner. Will do this.)

### File touchpoints summary

| File | Change | Estimated LOC |
|---|---|---|
| [`src/lib/excel-parser.ts`](src/lib/excel-parser.ts) | Add `FormatAdapter`, two adapters, `detectFormat`, rewrite `parseWorkbook` as dispatcher, add 3 fields to `ParseResult` | +120 / ~30 reorganized |
| [`src/components/Receipt.tsx`](src/components/Receipt.tsx) | Wrap Anticipo line in `data.anticipo > 0 &&` | +3 |
| [`src/components/ReceiptGenerator.tsx`](src/components/ReceiptGenerator.tsx) | Add `DETECTING` step, banner in `SHEET_CONFIRM`, drop-through to `SHEET_SELECT` on miss | ~40 changed |
| [`src/app/dashboard/DashboardClient.tsx`](src/app/dashboard/DashboardClient.tsx) | None | 0 |
| `supabase/migrations/` | None | 0 |

---

## 6. User-confirmed decisions

| Question | Decision |
|---|---|
| Receipt's Anticipo line when value is 0/absent | **Hide line when 0/absent** (mirror existing retroactivo pattern) |
| Trust source totals (Q, R) or always compute | **Always compute** (current behavior; ignore source-provided totals) |
| How to pick between formats | **Auto-detect, show banner** to confirm |

---

## 7. Explicit non-goals / known limitations

- **`comprobante` number** (`MENU!C8`) not captured. No slot in receipt template.
- **DPI per employee** exists in sheet `"1"` (not `MENU`). Not captured.
- **`EMPRESA DE ORIGEN`** (`MENU` col S, payroll group) not captured.
- **`DIAS LABORADOS` / `FALTAS`** not surfaced on the generated receipt (sheet `"1"` shows them in its pre-rendered receipts).
- **Sheet `"1"` ignored** — the app generates its own receipts from `MENU` tabular data so screen / PDF / email render consistently.
- **Totals-row exclusion** in catorcenal relies on row 30 having no numeric ordinal. If a future file inserts a totals row mid-table with an ordinal, it will be parsed as an employee. Same loose contract the old parser already has.
- **Sample-file name redaction**: the sample's `MENU!C` column repeats `"Dina Paola Morales"` for all 20 rows. Sheet `"1"` has distinct real names. We assume real production files have distinct per-row names in `MENU!C`; if not, the receipts will all show the same name.

---

## 8. Test plan

Manual via `npm run dev`:

1. **Regression — old mensual**: upload [`PLANTILLA PARA BOLETA.xlsx`](PLANTILLA PARA BOLETA.xlsx). Banner: `Planilla mensual · FEBRERO`. Receipts identical to current behavior.
2. **Regression — mayo template**: upload [`PLANTILLA_MAYO.xlsx`](PLANTILLA_MAYO.xlsx). Banner: `Planilla mensual · ABRIL`. Retroactivo line appears for affected employees.
3. **New format**: upload [`2ndformat/PLANILLA-Y-RECIBOS-DE-PAGO-DEL-25-04-2026-AL-08-05-2026.xlsx`](2ndformat/PLANILLA-Y-RECIBOS-DE-PAGO-DEL-25-04-2026-AL-08-05-2026.xlsx). Banner: `Planilla IGSS catorcenal · MENU`. 20 receipts. No Anticipo line. No Retroactivo line. Computed `liquido` matches `MENU` col R within Q 0.01.
4. **Unknown format**: upload any unrelated xlsx. UI shows `"Formato no reconocido"` and falls back to manual sheet picker.
5. **Downstream**: PDF export (both "juntos" and "separados") and email send work for both formats.
