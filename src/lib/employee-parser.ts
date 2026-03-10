import * as XLSX from "xlsx";
import { readWorkbookFromArrayBuffer, norm } from "./excel-parser";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface EmployeeRow {
  fullName: string;
  email: string;
  companyName: string;
  emailValid: boolean;
}

export interface EmployeeParseResult {
  employees: EmployeeRow[];
  warnings: string[];
}

/**
 * Parse an employee directory Excel file.
 * Auto-detects columns for name, email, and company.
 */
export function parseEmployeeDirectory(
  buffer: ArrayBuffer,
  sheetName?: string
): EmployeeParseResult {
  const wb = readWorkbookFromArrayBuffer(buffer);
  const sn = sheetName ?? wb.SheetNames[0];
  const sheet = wb.Sheets[sn];
  if (!sheet || !sheet["!ref"]) {
    throw new Error(`Hoja "${sn}" no encontrada o vacía`);
  }

  const range = XLSX.utils.decode_range(sheet["!ref"]);
  const warnings: string[] = [];

  // Detect columns from header row (row 0)
  let nameCol = -1;
  let emailCol = -1;
  let companyCol = -1;

  const nameTargets = ["nombre", "nombre del empleado", "colaborador", "empleado"];
  const emailTargets = ["correo", "email", "correo electronico", "e-mail"];
  const companyTargets = ["empresa", "company", "compañia", "compania"];

  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: 0, c })];
    if (!cell) continue;
    const val = norm(cell.v);

    if (nameCol === -1 && nameTargets.some((t) => val.includes(t))) nameCol = c;
    if (emailCol === -1 && emailTargets.some((t) => val.includes(t))) emailCol = c;
    if (companyCol === -1 && companyTargets.some((t) => val.includes(t))) companyCol = c;
  }

  // Fallback: if no header match, scan for email column by content
  if (emailCol === -1) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      for (let r = 1; r <= Math.min(range.e.r, 10); r++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })];
        if (cell && typeof cell.v === "string" && EMAIL_RE.test(cell.v.trim())) {
          emailCol = c;
          break;
        }
      }
      if (emailCol !== -1) break;
    }
  }

  if (emailCol === -1) {
    throw new Error("No se encontró una columna de correo electrónico");
  }

  // If name column not found, try the column to the left of email
  if (nameCol === -1 && emailCol > range.s.c) {
    nameCol = emailCol - 1;
    warnings.push("Columna de nombre detectada por posición (izquierda del correo)");
  }

  if (nameCol === -1) {
    throw new Error("No se encontró una columna de nombre");
  }

  const employees: EmployeeRow[] = [];

  for (let r = 1; r <= range.e.r; r++) {
    const nameCell = sheet[XLSX.utils.encode_cell({ r, c: nameCol })];
    const emailCell = sheet[XLSX.utils.encode_cell({ r, c: emailCol })];

    if (!nameCell && !emailCell) continue;

    const fullName = String(nameCell?.v ?? "").trim();
    const email = String(emailCell?.v ?? "").trim();
    if (!fullName || fullName.length < 2) continue;

    let companyName = "";
    if (companyCol !== -1) {
      const companyCell = sheet[XLSX.utils.encode_cell({ r, c: companyCol })];
      companyName = String(companyCell?.v ?? "").trim();
    }

    const emailValid = EMAIL_RE.test(email);
    if (!emailValid && email.length > 0) {
      warnings.push(`Correo inválido en fila ${r + 1}: "${email}" (${fullName})`);
    }

    employees.push({ fullName, email, companyName, emailValid });
  }

  if (employees.length === 0) {
    throw new Error("No se encontraron empleados en el archivo");
  }

  return { employees, warnings };
}

/**
 * Get sheet names from a workbook buffer.
 */
export function getEmployeeSheetNames(buffer: ArrayBuffer): string[] {
  const wb = readWorkbookFromArrayBuffer(buffer);
  return wb.SheetNames;
}
