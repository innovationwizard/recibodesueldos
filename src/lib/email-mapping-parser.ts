import * as XLSX from "xlsx";
import { readWorkbookFromArrayBuffer, norm, fuzzyMatch } from "./excel-parser";
import type { ReceiptData } from "./excel-parser";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EmailMapping {
  rawName: string;
  email: string;
}

export interface MatchedRecipient {
  receiptIndex: number;
  employeeName: string;
  email: string;
  mappingName: string;
  matchScore: number;
  selected: boolean;
}

export interface UnmatchedEntry {
  name: string;
  email: string;
  reason: "no_match";
}

export interface MappingResult {
  matched: MatchedRecipient[];
  unmatched: UnmatchedEntry[];
  warnings: string[];
}

// ─── Email Validation ───────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(s: string): boolean {
  return EMAIL_RE.test(s.trim());
}

// ─── Parser ─────────────────────────────────────────────────────────────────

/**
 * Parse an Excel workbook to extract name→email pairs.
 * Auto-detects the email column (contains @) and takes the adjacent text column as the name.
 * Supports both same-workbook sheets and separate files.
 */
export function parseEmailMappingWorkbook(
  buffer: ArrayBuffer,
  sheetName?: string
): EmailMapping[] {
  const wb = readWorkbookFromArrayBuffer(buffer);
  const sheetsToScan = sheetName ? [sheetName] : wb.SheetNames;
  const mappings: EmailMapping[] = [];

  for (const sn of sheetsToScan) {
    const sheet = wb.Sheets[sn];
    if (!sheet || !sheet["!ref"]) continue;
    const range = XLSX.utils.decode_range(sheet["!ref"]);

    // Find the email column by scanning first 15 rows
    let emailCol = -1;
    const scanRows = Math.min(range.e.r, 14);
    for (let c = range.s.c; c <= range.e.c && emailCol === -1; c++) {
      for (let r = range.s.r; r <= scanRows; r++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })];
        if (cell && typeof cell.v === "string" && isValidEmail(cell.v)) {
          emailCol = c;
          break;
        }
      }
    }
    if (emailCol === -1) continue;

    // Find the name column: the nearest text column (prefer left, then right)
    let nameCol = -1;
    for (let offset = 1; offset <= 5; offset++) {
      for (const dir of [-1, 1]) {
        const candidate = emailCol + dir * offset;
        if (candidate < range.s.c || candidate > range.e.c) continue;
        // Check if this column has text values (not emails)
        let textCount = 0;
        for (let r = range.s.r; r <= scanRows; r++) {
          const cell = sheet[XLSX.utils.encode_cell({ r, c: candidate })];
          if (cell && typeof cell.v === "string" && cell.v.trim().length > 1 && !isValidEmail(cell.v)) {
            textCount++;
          }
        }
        if (textCount >= 1) {
          nameCol = candidate;
          break;
        }
      }
      if (nameCol !== -1) break;
    }
    if (nameCol === -1) continue;

    // Extract all rows with both name and valid email
    for (let r = range.s.r; r <= range.e.r; r++) {
      const nameCell = sheet[XLSX.utils.encode_cell({ r, c: nameCol })];
      const emailCell = sheet[XLSX.utils.encode_cell({ r, c: emailCol })];
      if (!nameCell || !emailCell) continue;

      const name = String(nameCell.v ?? "").trim();
      const email = String(emailCell.v ?? "").trim();

      if (name.length >= 2 && isValidEmail(email)) {
        // Skip header-like rows
        const nameLower = norm(name);
        if (nameLower === "nombre" || nameLower === "name" || nameLower === "colaborador" || nameLower === "empleado") {
          continue;
        }
        mappings.push({ rawName: name, email: email.toLowerCase() });
      }
    }

    // If we found mappings in this sheet, stop scanning other sheets
    if (mappings.length > 0) break;
  }

  return mappings;
}

/**
 * Get available sheet names from a workbook buffer.
 */
export function getMappingSheetNames(buffer: ArrayBuffer): string[] {
  const wb = readWorkbookFromArrayBuffer(buffer);
  return wb.SheetNames;
}

// ─── Matcher ────────────────────────────────────────────────────────────────

/**
 * Match email mappings against receipt employee names using fuzzy matching.
 */
export function matchMappingsToReceipts(
  mappings: EmailMapping[],
  receipts: ReceiptData[],
  threshold = 0.45
): MappingResult {
  const matched: MatchedRecipient[] = [];
  const unmatched: UnmatchedEntry[] = [];
  const warnings: string[] = [];
  const usedReceipts = new Set<number>();

  // For each mapping, find the best matching receipt
  for (const mapping of mappings) {
    const receiptNames = receipts.map((r) => r.nombre);
    const result = fuzzyMatch(mapping.rawName, receiptNames, threshold);

    if (!result) {
      unmatched.push({ name: mapping.rawName, email: mapping.email, reason: "no_match" });
      continue;
    }

    const receiptIndex = receipts.findIndex((r) => r.nombre === result.match);
    if (receiptIndex === -1) {
      unmatched.push({ name: mapping.rawName, email: mapping.email, reason: "no_match" });
      continue;
    }

    // Check for duplicate match
    if (usedReceipts.has(receiptIndex)) {
      const existing = matched.find((m) => m.receiptIndex === receiptIndex);
      if (existing && result.score < existing.matchScore) {
        // This is a better match — swap
        warnings.push(
          `"${mapping.rawName}" es mejor coincidencia para "${receipts[receiptIndex].nombre}" que "${existing.mappingName}". Se reemplazó.`
        );
        unmatched.push({ name: existing.mappingName, email: existing.email, reason: "no_match" });
        existing.email = mapping.email;
        existing.mappingName = mapping.rawName;
        existing.matchScore = result.score;
      } else {
        warnings.push(
          `"${mapping.rawName}" también coincide con "${receipts[receiptIndex].nombre}" pero se usó "${existing?.mappingName}".`
        );
        unmatched.push({ name: mapping.rawName, email: mapping.email, reason: "no_match" });
      }
      continue;
    }

    usedReceipts.add(receiptIndex);
    matched.push({
      receiptIndex,
      employeeName: receipts[receiptIndex].nombre,
      email: mapping.email,
      mappingName: mapping.rawName,
      matchScore: result.score,
      selected: true,
    });
  }

  // Warn about receipts with no email match
  const unmatchedReceipts = receipts
    .map((r, i) => ({ name: r.nombre, index: i }))
    .filter((r) => !usedReceipts.has(r.index));
  if (unmatchedReceipts.length > 0) {
    warnings.push(
      `${unmatchedReceipts.length} boleta(s) sin correo asignado: ${unmatchedReceipts.map((r) => r.name).join(", ")}`
    );
  }

  // Sort matched by receipt index for consistent ordering
  matched.sort((a, b) => a.receiptIndex - b.receiptIndex);

  return { matched, unmatched, warnings };
}
