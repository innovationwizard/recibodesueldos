import * as XLSX from "xlsx";

// ─── Utilities ───────────────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/** lowercase → strip accents → strip dots → collapse whitespace */
function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function fuzzyMatch(
  input: string,
  candidates: string[],
  threshold = 0.45
): { match: string; score: number } | null {
  const ni = norm(input);
  if (!ni) return null;
  let best: string | null = null;
  let bestScore = Infinity;
  for (const c of candidates) {
    const cn = norm(c);
    if (cn === ni) return { match: c, score: 0 };
    const dist = levenshtein(ni, cn);
    const maxLen = Math.max(ni.length, cn.length);
    const ratio = dist / maxLen;
    if (ratio < bestScore) {
      bestScore = ratio;
      best = c;
    }
  }
  return bestScore <= threshold && best ? { match: best, score: bestScore } : null;
}

export function toNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const parsed = parseFloat(String(v).replace(/,/g, ""));
  return isNaN(parsed) ? 0 : parsed;
}

// ─── Date Parsing ────────────────────────────────────────────────────────────

const MONTHS_ES: Record<string, string> = {
  enero: "enero", febrero: "febrero", marzo: "marzo", abril: "abril",
  mayo: "mayo", junio: "junio", julio: "julio", agosto: "agosto",
  septiembre: "septiembre", octubre: "octubre", noviembre: "noviembre",
  diciembre: "diciembre",
};

function parseLastDate(rangeStr: string): string {
  if (!rangeStr) return "";
  const s = String(rangeStr).trim();
  const m = s.match(/AL\s+(\d{1,2})\s+(?:DE\s+)?(\w+)\s+(\d{4})/i);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = MONTHS_ES[m[2].toLowerCase()] || m[2].toLowerCase();
    return `${day} de ${month} de ${m[3]}`;
  }
  return s;
}

// ─── Column Discovery ────────────────────────────────────────────────────────

const FIELD_TARGETS: { key: string; targets: string[]; multi?: boolean; exclude?: string[] }[] = [
  { key: "ordinal", targets: ["no.", "no", "num", "número"] },
  { key: "nombre", targets: ["nombre"] },
  { key: "puesto", targets: ["puesto"] },
  { key: "salario", targets: ["liquido a recibir 2da quincena"] },
  { key: "bonificacionEspecial", targets: ["bonificacion devengada en el mes"] },
  { key: "igss", targets: ["igss"] },
  { key: "isr", targets: ["isr"] },
  { key: "anticipo", targets: ["anticipo 1ra quincena", "anticipo"] },
  { key: "otros", targets: ["otros"] },
];

/** Match a cell value against a target. Short targets use word-boundary matching. */
function cellMatches(cellVal: string, target: string): boolean {
  const cn = norm(cellVal);
  const tn = norm(target);
  if (!cn || !tn) return false;
  if (tn.length <= 4) {
    return new RegExp(`(?:^|\\b)${tn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\b|$)`).test(cn);
  }
  return cn.includes(tn) || fuzzyMatch(cn, [target], 0.35) !== null;
}

/** Scan column A for rows marked with "ENCABEZADO" */
function findHeaderRows(sheet: XLSX.WorkSheet): number[] {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const rows: number[] = [];
  for (let r = range.s.r; r <= Math.min(range.e.r, 30); r++) {
    const cell = sheet[XLSX.utils.encode_cell({ r, c: 0 })];
    if (cell && fuzzyMatch(norm(cell.v), ["encabezado"], 0.4)) {
      rows.push(r);
    }
  }
  return rows;
}

/** Map field keys to column indices by scanning header rows */
function discoverColumns(sheet: XLSX.WorkSheet, headerRows: number[]): Record<string, number | number[]> {
  const colMap: Record<string, number | number[]> = {};
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");

  for (const { key, targets, multi, exclude } of FIELD_TARGETS) {
    if (multi) {
      const cols = new Set<number>();
      for (const r of headerRows) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cell = sheet[XLSX.utils.encode_cell({ r, c })];
          if (!cell) continue;
          const cv = norm(cell.v);
          const excluded = exclude?.some((e) => cv.includes(norm(e)));
          if (!excluded && targets.some((t) => cellMatches(String(cell.v ?? ""), t))) {
            cols.add(c);
          }
        }
      }
      if (cols.size > 0) colMap[key] = Array.from(cols).sort((a, b) => a - b);
      continue;
    }

    for (const t of targets) {
      if (colMap[key] !== undefined) break;
      for (const r of headerRows) {
        if (colMap[key] !== undefined) break;
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cell = sheet[XLSX.utils.encode_cell({ r, c })];
          if (cell && cellMatches(String(cell.v ?? ""), t)) {
            colMap[key] = c;
            break;
          }
        }
      }
    }
  }
  return colMap;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ReceiptData {
  ordinal: number;
  companyName: string;
  dateRange: string;
  receiptDate: string;
  nombre: string;
  puesto: string;
  salario: number;
  bonificacion: number;
  bonificacionEspecial: number;
  igss: number;
  isr: number;
  anticipo: number;
  otros: number;
  totalIngresos: number;
  totalDescuentos: number;
  liquido: number;
}

export interface ParseResult {
  receipts: ReceiptData[];
  companyName: string;
  dateRange: string;
  warnings: string[];
}

// ─── Main Parser ─────────────────────────────────────────────────────────────

export function parseWorkbook(workbook: XLSX.WorkBook, sheetName: string): ParseResult {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Hoja "${sheetName}" no encontrada`);

  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const companyName = String(sheet["B2"]?.v ?? "").trim();
  const dateRangeRaw = String(sheet["B4"]?.v ?? "").trim();

  const headerRows = findHeaderRows(sheet);
  if (headerRows.length === 0) {
    throw new Error('No se encontraron filas marcadas con "ENCABEZADO" en la columna A');
  }

  const colMap = discoverColumns(sheet, headerRows);
  const warnings: string[] = [];

  // Warn on duplicate column assignments
  const colToFields: Record<number, string[]> = {};
  for (const [field, col] of Object.entries(colMap)) {
    for (const c of Array.isArray(col) ? col : [col]) {
      (colToFields[c] ??= []).push(field);
    }
  }
  for (const [col, fields] of Object.entries(colToFields)) {
    if (fields.length > 1) {
      warnings.push(`Columna ${XLSX.utils.encode_col(Number(col))} asignada a múltiples campos: ${fields.join(", ")}`);
    }
  }

  const required = ["ordinal", "nombre", "puesto", "salario"];
  const missing = required.filter((k) => colMap[k] === undefined);
  if (missing.length > 0) {
    throw new Error(`Columnas requeridas no encontradas: ${missing.join(", ")}`);
  }

  // First data row: right after last header, skip blanks in ordinal column
  const ordCol = colMap.ordinal as number;
  let firstDataRow = Math.max(...headerRows) + 1;
  for (let r = firstDataRow; r <= firstDataRow + 5; r++) {
    const v = sheet[XLSX.utils.encode_cell({ r, c: ordCol })]?.v;
    if (v != null && (typeof v === "number" || !isNaN(parseFloat(String(v))))) {
      firstDataRow = r;
      break;
    }
  }

  const receipts: ReceiptData[] = [];

  for (let r = firstDataRow; r <= range.e.r; r++) {
    const ordVal = sheet[XLSX.utils.encode_cell({ r, c: ordCol })]?.v;
    if (ordVal == null) continue;
    const ordNum = typeof ordVal === "number" ? ordVal : parseFloat(String(ordVal));
    if (isNaN(ordNum)) continue;

    const nameCol = colMap.nombre as number;
    const nameVal = sheet[XLSX.utils.encode_cell({ r, c: nameCol })]?.v;
    if (!nameVal || norm(nameVal).length < 2) continue;

    const val = (key: string): unknown => {
      const col = colMap[key];
      if (col === undefined) return 0;
      if (Array.isArray(col)) {
        return col.reduce((sum, c) => sum + toNum(sheet[XLSX.utils.encode_cell({ r, c })]?.v ?? 0), 0);
      }
      return sheet[XLSX.utils.encode_cell({ r, c: col })]?.v ?? 0;
    };

    const salario = toNum(val("salario"));
    const bonificacionEspecial = toNum(val("bonificacionEspecial"));
    const igss = toNum(val("igss"));
    const isr = toNum(val("isr"));
    const anticipo = toNum(val("anticipo"));
    const otros = toNum(val("otros"));
    const totalIngresos = salario + bonificacionEspecial;
    const totalDescuentos = igss + isr + anticipo + otros;

    receipts.push({
      ordinal: ordNum,
      companyName,
      dateRange: dateRangeRaw.trim(),
      receiptDate: parseLastDate(dateRangeRaw),
      nombre: String(nameVal).trim(),
      puesto: String(val("puesto") || "").trim(),
      salario,
      bonificacion: 0,
      bonificacionEspecial,
      igss,
      isr,
      anticipo,
      otros,
      totalIngresos,
      totalDescuentos,
      liquido: totalIngresos - totalDescuentos,
    });
  }

  if (receipts.length === 0) {
    throw new Error("No se encontraron filas de datos válidas");
  }

  return { receipts, companyName, dateRange: dateRangeRaw.trim(), warnings };
}

export function readWorkbookFromArrayBuffer(buffer: ArrayBuffer): XLSX.WorkBook {
  return XLSX.read(new Uint8Array(buffer), { type: "array" });
}
