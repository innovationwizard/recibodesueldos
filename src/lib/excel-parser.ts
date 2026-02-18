import * as XLSX from "xlsx";

// ─── Fuzzy Matching ───────────────────────────────────────────────────────────
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

function normalize(s: unknown): string {
  return String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** For header matching: removes dots so "I.G.S.S." matches "igss" */
function normalizeHeader(s: string): string {
  return normalize(s).replace(/\./g, "");
}

export function fuzzyMatch(
  input: string,
  candidates: string[],
  threshold = 0.45
): { match: string; score: number } | null {
  const norm = normalize(input);
  if (!norm) return null;
  let best: string | null = null;
  let bestScore = Infinity;
  for (const c of candidates) {
    const cn = normalize(c);
    if (cn === norm) return { match: c, score: 0 };
    const dist = levenshtein(norm, cn);
    const maxLen = Math.max(norm.length, cn.length);
    const ratio = dist / maxLen;
    if (ratio < bestScore) {
      bestScore = ratio;
      best = c;
    }
  }
  return bestScore <= threshold && best ? { match: best, score: bestScore } : null;
}

// ─── Date Parsing ─────────────────────────────────────────────────────────────
const MONTHS_ES: Record<string, string> = {
  enero: "enero",
  febrero: "febrero",
  marzo: "marzo",
  abril: "abril",
  mayo: "mayo",
  junio: "junio",
  julio: "julio",
  agosto: "agosto",
  septiembre: "septiembre",
  octubre: "octubre",
  noviembre: "noviembre",
  diciembre: "diciembre",
};

function parseLastDate(rangeStr: string): string {
  if (!rangeStr) return "";
  const s = String(rangeStr).trim();
  const m = s.match(/AL\s+(\d{1,2})\s+DE\s+(\w+)\s+(\d{4})/i);
  if (m) {
    const day = parseInt(m[1], 10);
    const monthRaw = m[2].toLowerCase();
    const year = m[3];
    const month = MONTHS_ES[monthRaw] || monthRaw;
    return `${day} de ${month} de ${year}`;
  }
  return s;
}

// ─── Number Parsing ───────────────────────────────────────────────────────────
export function toNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const parsed = parseFloat(String(v).replace(/,/g, ""));
  return isNaN(parsed) ? 0 : parsed;
}

// ─── Column Discovery ─────────────────────────────────────────────────────────
const FIELD_TARGETS = [
  { key: "ordinal" as const, targets: ["no.", "no", "num", "número"] },
  { key: "nombre" as const, targets: ["nombre"] },
  { key: "puesto" as const, targets: ["puesto"] },
  { key: "salario" as const, targets: ["ordinario mensual"] },
  {
    key: "bonificacion" as const,
    targets: [
      "bonificación decreto 78-89  y  37-2001 mensual",
      "bonificacion decreto",
      "bonificación decreto",
    ],
  },
  { key: "igss" as const, targets: ["igss"] },
  { key: "isr" as const, targets: ["isr"] },
  {
    key: "anticipo" as const,
    targets: ["anticipo 1ra quincena", "anticipo"],
  },
  { key: "otros" as const, targets: ["otros"] },
];

function discoverColumns(
  sheet: XLSX.WorkSheet,
  headerRows: number[]
): Record<string, number> {
  const colMap: Record<string, number> = {};
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");

  for (const { key, targets } of FIELD_TARGETS) {
    for (const r of headerRows) {
      const rowIdx = r - 1;
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r: rowIdx, c });
        const cell = sheet[addr];
        if (!cell) continue;
        const val = normalize(String(cell.v ?? ""));
        const valNoDots = normalizeHeader(String(cell.v ?? ""));
        for (const t of targets) {
          const tNorm = normalize(t);
          const tNoDots = normalizeHeader(t);
          if (
            val.includes(tNorm) ||
            valNoDots.includes(tNoDots) ||
            fuzzyMatch(val, [t], 0.4)
          ) {
            if (colMap[key] === undefined) {
              colMap[key] = c;
              break;
            }
          }
        }
        if (colMap[key] !== undefined) break;
      }
      if (colMap[key] !== undefined) break;
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
}

// ─── Main Parser ─────────────────────────────────────────────────────────────
export function parseWorkbook(
  workbook: XLSX.WorkBook,
  sheetName: string
): ParseResult {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Hoja "${sheetName}" no encontrada`);

  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");

  const companyName = String(sheet["B2"]?.v ?? "").trim();
  const dateRangeRaw = String(sheet["B4"]?.v ?? "").trim();

  // Headers span 3 rows: scan all rows that contain any header keyword
  const requiredHeaders = [
    "no.",
    "nombre",
    "puesto",
    "ordinario mensual",
    "igss",
    "isr",
    "anticipo",
  ];
  const matchingRows: number[] = [];

  for (let r = range.s.r; r <= Math.min(range.e.r, 25); r++) {
    const rowVals: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (sheet[addr]?.v != null)
        rowVals.push(normalizeHeader(String(sheet[addr].v)));
    }
    const isHeader = requiredHeaders.some(
      (h) =>
        rowVals.some(
          (v) =>
            v.includes(normalizeHeader(h)) || fuzzyMatch(v, [h], 0.4)
        )
    );
    if (isHeader) matchingRows.push(r + 1);
  }

  // Include all rows in the header block (fill gaps between first and last match)
  const headerRows: number[] = [];
  if (matchingRows.length > 0) {
    const minR = Math.min(...matchingRows);
    const maxR = Math.max(...matchingRows);
    for (let r = minR; r <= maxR; r++) {
      headerRows.push(r);
    }
  }

  if (headerRows.length === 0) {
    throw new Error(
      "No se encontraron filas de encabezado con 'No.', 'NOMBRE', 'PUESTO', 'ORDINARIO MENSUAL'"
    );
  }

  const mainHeaderRow = headerRows.find((r) => {
    const rowIdx = r - 1;
    const vals: string[] = [];
    for (let c = 0; c < 10; c++) {
      const addr = XLSX.utils.encode_cell({ r: rowIdx, c });
      if (sheet[addr]?.v != null)
        vals.push(normalizeHeader(String(sheet[addr].v)));
    }
    return (
      vals.some((v) => v.includes("no") || v === "no") &&
      vals.some((v) => v.includes("nombre")) &&
      vals.some((v) => v.includes("puesto")) &&
      vals.some((v) => v.includes("ordinario"))
    );
  });

  if (!mainHeaderRow) {
    throw new Error(
      "Encabezados no válidos. Se esperaba: No., NOMBRE, PUESTO, ORDINARIO MENSUAL"
    );
  }

  const colMap = discoverColumns(sheet, headerRows.map(Number));
  const requiredCols = ["ordinal", "nombre", "puesto", "salario"];
  const missing = requiredCols.filter((k) => colMap[k] === undefined);
  if (missing.length > 0) {
    throw new Error(`Columnas requeridas no encontradas: ${missing.join(", ")}`);
  }

  let firstDataRow = Math.max(...headerRows) + 1;

  const testAddr = XLSX.utils.encode_cell({
    r: firstDataRow - 1,
    c: colMap.ordinal,
  });
  const testVal = sheet[testAddr]?.v;
  if (
    testVal == null ||
    (typeof testVal !== "number" && isNaN(parseFloat(String(testVal))))
  ) {
    let found = false;
    for (let r = firstDataRow; r <= firstDataRow + 5; r++) {
      const addr = XLSX.utils.encode_cell({ r: r - 1, c: colMap.ordinal });
      const v = sheet[addr]?.v;
      if (
        v != null &&
        (typeof v === "number" || !isNaN(parseFloat(String(v))))
      ) {
        firstDataRow = r;
        found = true;
        break;
      }
    }
    if (!found) throw new Error("No se encontró la primera fila de datos");
  }

  const receipts: ReceiptData[] = [];

  for (let r = firstDataRow - 1; r <= range.e.r; r++) {
    const ordAddr = XLSX.utils.encode_cell({ r, c: colMap.ordinal });
    const ordVal = sheet[ordAddr]?.v;
    if (ordVal == null) continue;
    const ordNum =
      typeof ordVal === "number" ? ordVal : parseFloat(String(ordVal));
    if (isNaN(ordNum)) continue;

    const nameAddr = XLSX.utils.encode_cell({ r, c: colMap.nombre });
    const nameVal = sheet[nameAddr]?.v;
    if (!nameVal || normalize(String(nameVal)).length < 2) continue;

    const getCellVal = (key: string): unknown => {
      if (colMap[key] === undefined) return 0;
      const addr = XLSX.utils.encode_cell({ r, c: colMap[key] });
      return sheet[addr]?.v ?? 0;
    };

    const salario = toNum(getCellVal("salario"));
    const bonificacion = toNum(getCellVal("bonificacion"));
    const igss = toNum(getCellVal("igss"));
    const isr = toNum(getCellVal("isr"));
    const anticipo = toNum(getCellVal("anticipo"));
    const otros = toNum(getCellVal("otros"));

    const totalIngresos = salario + bonificacion;
    const totalDescuentos = igss + isr + anticipo + otros;
    const liquido = totalIngresos - totalDescuentos;

    receipts.push({
      ordinal: ordNum,
      companyName,
      dateRange: dateRangeRaw.trim(),
      receiptDate: parseLastDate(dateRangeRaw),
      nombre: String(nameVal).trim(),
      puesto: String(getCellVal("puesto") || "").trim(),
      salario,
      bonificacion,
      igss,
      isr,
      anticipo,
      otros,
      totalIngresos,
      totalDescuentos,
      liquido,
    });
  }

  if (receipts.length === 0) {
    throw new Error("No se encontraron filas de datos válidas");
  }

  return {
    receipts,
    companyName,
    dateRange: dateRangeRaw.trim(),
  };
}

export function readWorkbookFromArrayBuffer(buffer: ArrayBuffer): XLSX.WorkBook {
  return XLSX.read(new Uint8Array(buffer), { type: "array" });
}
