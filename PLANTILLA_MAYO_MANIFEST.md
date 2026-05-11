# Manifest: PLANTILLA_MAYO.xlsx vs PLANTILLA PARA BOLETA.xlsx

Comparison produced on 2026-05-11.

---

## 1. Sheet structure

| | Old (PLANTILLA PARA BOLETA.xlsx) | New (PLANTILLA_MAYO.xlsx) |
|---|---|---|
| Sheets | FEBRERO · BOLETAS · BOLETA DE PAGO | ABRIL (only) |
| Active data sheet | FEBRERO | ABRIL |
| Column range | A2:AI451 (35 columns) | A2:U450 (21 columns) |
| Header layout | Multi-row: row 8 (groups), row 9 (names), row 10 (sub-names) | Single header row 9 |

---

## 2. Column-by-column diff

| Col | Old header | New header | Change |
|-----|-----------|-----------|--------|
| A | *(empty)* | **ENCABEZADO** (header row) / **"Planilla BAM"** (data rows) | NEW — marks parser anchor + payroll group |
| B | No. | No. | same |
| C | NOMBRE | NOMBRE | same |
| D | PUESTO | PUESTO | same |
| E | ORDINARIO MENSUAL | ORDINARIO MENSUAL | same |
| F | BONIFICACIÓN DECRETO 78-89 y 37-2001 MENSUAL | **BONIFICACIÓN INCENTIVO** | renamed — different concept |
| G | DIAS LABORADOS | DIAS LABORADOS | same |
| H | TOTAL DEVENGADO | **RETROACTIVO SALARIAL** | renamed — new concept |
| I | BONIFICACIÓN DECRETO 78-89 y 37-2001 MENSUAL | BONIFICACIÓN DECRETO 78-89 y 37-2001 MENSUAL | same name, kept |
| J | ANTICIPO 1RA QUINCENA | ANTICIPO 1RA QUINCENA | same |
| K | Salario Diario | Salario Diario | same |
| L | BONIFICACIÓN DECRETO 78-89 y 37-2001 DIARIA | BONIFICACIÓN 37-01 DIARIA | shortened label |
| M | DIAS LABORADOS | DIAS LABORADOS | same |
| N | *(group header "DESCUENTOS 2DA QUIN")* → sub-header row: **IGSS** | **IGSS** | same data, sub-header row eliminated |
| O | Renta Imponible | **ISR** | Renta Imponible removed; ISR promoted from P→O |
| P | ISR | **OTROS** | OTROS shifted from Q→P |
| Q | OTROS | **LIQUIDO A RECIBIR 2DA QUINCENA** | shifted from R→Q |
| R | LIQUIDO A RECIBIR 2DA QUINCENA | **BONIFICACIÓN DECRETO 78-89 y 37-2001 MENSUAL** | now holds total monthly bono decreto |
| S | BONIFICACIÓN DEVENGADA EN EL MES | **SALARIO BASE DEVENGADO EN EL MES** | shifted from T→S |
| T | SALARIO BASE DEVENGADO EN EL MES | **TOTAL DEVENGADO EN EL MES** | shifted from V→T |
| U | SALARIO DEVENGADO EN EL MES | **TOTAL PAGADO EN EL MES** | concept changed |
| V | TOTAL DEVENGADO EN EL MES | *(removed)* | — |
| W | PROYECTO | *(removed)* | — |
| AA | SALARIO ACTUAL | *(removed)* | — |
| AB | SALARIO NUEVO | *(removed)* | — |
| AG | IGSS Cálculo nuevo | *(removed)* | — |
| AH | IGSS Cálculo anterior | *(removed)* | — |
| AI | Diferencia | *(removed)* | — |

---

## 3. New concepts introduced

| Column | Name | Notes |
|--------|------|-------|
| A (data rows) | Planilla BAM | Payroll group/bank identifier per row. Not present in old template. |
| H | RETROACTIVO SALARIAL | One-time retroactive salary adjustment. Amounts vary per employee (0 in most rows; non-zero when a back-pay applies). |
| U | TOTAL PAGADO EN EL MES | Gross total actually paid, appears to equal TOTAL DEVENGADO + retroactivo adjustments. Different from old col U "SALARIO DEVENGADO". |

---

## 4. Concepts removed

- **Renta Imponible** (old col O) — taxable base for ISR. Removed; ISR value is now surfaced directly.
- **SALARIO DEVENGADO EN EL MES** (old col U) — intermediate figure; replaced by "TOTAL PAGADO EN EL MES".
- **PROYECTO** (old col W) — cost-center tag per employee.
- **SALARIO ACTUAL / SALARIO NUEVO** (old AA/AB) — salary change tracking columns.
- **IGSS Cálculo nuevo / anterior / Diferencia** (old AG/AH/AI) — IGSS reconciliation columns.
- **BOLETAS and BOLETA DE PAGO sheets** — legacy receipt-layout sheets, not present in new file.

---

## 5. Impact on the current parser (`src/lib/excel-parser.ts`)

### What still works
- `ordinal` → col B ✓  
- `nombre` → col C ✓  
- `puesto` → col D ✓  
- `salario` (`SALARIO BASE DEVENGADO EN EL MES`) → now col S (was T); fuzzy match still finds it ✓  
- `igss` → col N (same position and name) ✓  
- `isr` → col O (was P); name match still works ✓  
- `anticipo` → col J (same) ✓  
- `otros` → col P (was Q); name match still works ✓  
- `ENCABEZADO` anchor in col A → now explicitly present; old template lacked it ✓

### Risks / bugs with new template

| # | Field | Problem |
|---|-------|---------|
| 1 | `bonificacionEspecial` | Parser multi-matches **both col I and col R** (both named "BONIFICACIÓN DECRETO 78-89 y 37-2001 MENSUAL"). It sums them, **double-counting the bonificación**. Col I appears to hold the 1ra-quincena partial, col R holds the monthly total. Only col R (250 Q) should be used. |
| 2 | `RETROACTIVO SALARIAL` | Col H is **not in `FIELD_TARGETS`** and is silently ignored. When retroactive pay applies (non-zero H), the receipt will show lower income than was actually paid. |
| 3 | `BONIFICACIÓN INCENTIVO` | Col F is **excluded** by the parser's `exclude` list (`"incentivo"`). If this is a real income component for employees it will not appear on the receipt. Requires clarification on whether it should be captured. |

---

## 6. Summary of changes needed in the parser

1. **Exclude col I from `bonificacionEspecial`**: add a positional rule or rename/exclude heuristic so only the monthly total (col R) is picked up, not both quincena columns.
2. **Add `retroactivo` field** targeting `"retroactivo salarial"` and include it in `totalIngresos`.
3. **Decide on `BONIFICACIÓN INCENTIVO`** (col F): if it is income, add a new field target and include it in `totalIngresos`; if it is genuinely excluded, document why.
