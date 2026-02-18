export function fmt(n: unknown): string {
  const val = typeof n === "string" ? parseFloat(n) : (n ?? 0);
  if (typeof val !== "number" || isNaN(val)) return "0.00";
  return val.toLocaleString("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
