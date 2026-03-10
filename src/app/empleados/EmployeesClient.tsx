"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { Logo } from "@/components/Logo";
import { createClient } from "@/lib/supabase/client";
import { parseEmployeeDirectory, getEmployeeSheetNames } from "@/lib/employee-parser";
import type { EmployeeRow } from "@/lib/employee-parser";

interface Employee {
  id: string;
  full_name: string;
  email: string;
  company_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface EmployeesClientProps {
  user: User;
}

export function EmployeesClient({ user }: EmployeesClientProps) {
  const supabase = createClient();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ inserted: number; updated: number; unchanged: number; errors: string[] } | null>(null);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [parsedPreview, setParsedPreview] = useState<EmployeeRow[] | null>(null);
  const [sheetPicker, setSheetPicker] = useState<{ buffer: ArrayBuffer; sheets: string[] } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/employees");
    if (res.ok) {
      const data = await res.json();
      setEmployees(data.employees);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setUploadResult(null);
    setParseWarnings([]);
    setParsedPreview(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const buf = evt.target?.result as ArrayBuffer;
      const sheets = getEmployeeSheetNames(buf);
      if (sheets.length > 1) {
        setSheetPicker({ buffer: buf, sheets });
      } else {
        processFile(buf);
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const processFile = (buffer: ArrayBuffer, sheetName?: string) => {
    try {
      const { employees: parsed, warnings } = parseEmployeeDirectory(buffer, sheetName);
      setParseWarnings(warnings);
      setParsedPreview(parsed);
      setSheetPicker(null);
    } catch (err) {
      setError((err as Error).message);
      setSheetPicker(null);
    }
  };

  const handleConfirmImport = async () => {
    if (!parsedPreview) return;
    setUploading(true);
    setError("");

    try {
      const validEmployees = parsedPreview.filter((e) => e.emailValid && e.companyName);
      if (validEmployees.length === 0) {
        setError("No hay empleados con datos válidos para importar");
        setUploading(false);
        return;
      }

      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employees: validEmployees.map((e) => ({
            fullName: e.fullName,
            email: e.email,
            companyName: e.companyName,
          })),
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        setError(result.error + (result.details ? ": " + result.details.join(", ") : ""));
      } else {
        setUploadResult(result);
        setParsedPreview(null);
        fetchEmployees();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleToggleActive = async (emp: Employee) => {
    const res = await fetch("/api/employees", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: emp.id, is_active: !emp.is_active }),
    });
    if (res.ok) fetchEmployees();
  };

  const handleSaveEmail = async (id: string) => {
    const res = await fetch("/api/employees", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, email: editEmail }),
    });
    if (res.ok) {
      setEditingId(null);
      fetchEmployees();
    } else {
      const data = await res.json();
      setError(data.error);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar a ${name} del directorio?`)) return;
    const res = await fetch(`/api/employees?id=${id}`, { method: "DELETE" });
    if (res.ok) fetchEmployees();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  // Get unique companies for filter
  const companies = Array.from(new Set(employees.map((e) => e.company_name))).sort();
  const filtered = filter
    ? employees.filter((e) => e.company_name === filter)
    : employees;
  const activeCount = filtered.filter((e) => e.is_active).length;

  return (
    <>
      <header className="bg-primary px-6 py-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <Link href="/dashboard" className="block text-white hover:opacity-90 transition-opacity w-fit">
              <Logo className="text-white" iconSize={24} />
            </Link>
            <p className="mt-1 text-[13px] text-white/70">
              Directorio de empleados
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
            >
              Boletas
            </Link>
            <span className="text-sm text-white/80">{user.email}</span>
            <button
              onClick={handleSignOut}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        {/* Import section */}
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-primary">Importar directorio</h2>
              <p className="mt-0.5 text-[13px] text-gray-500">
                Excel con columnas: Nombre, Correo, Empresa
              </p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-light"
            >
              Cargar Excel
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* Sheet picker */}
          {sheetPicker && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="mb-2 text-sm font-medium text-gray-700">Seleccione la hoja:</p>
              <div className="flex flex-wrap gap-2">
                {sheetPicker.sheets.map((name) => (
                  <button
                    key={name}
                    onClick={() => processFile(sheetPicker.buffer, name)}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-primary hover:text-white"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Parse preview */}
          {parsedPreview && (
            <div className="space-y-3">
              {parseWarnings.length > 0 && (
                <div className="space-y-1">
                  {parseWarnings.map((w, i) => (
                    <div key={i} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-700">
                      {w}
                    </div>
                  ))}
                </div>
              )}

              <div className="max-h-60 overflow-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr className="text-left text-xs text-gray-500">
                      <th className="px-3 py-2">Nombre</th>
                      <th className="px-3 py-2">Correo</th>
                      <th className="px-3 py-2">Empresa</th>
                      <th className="px-3 py-2 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parsedPreview.map((emp, i) => (
                      <tr key={i} className={emp.emailValid ? "" : "bg-red-50"}>
                        <td className="px-3 py-1.5 text-gray-900">{emp.fullName}</td>
                        <td className="px-3 py-1.5 text-gray-600">{emp.email}</td>
                        <td className="px-3 py-1.5 text-gray-600">{emp.companyName || "—"}</td>
                        <td className="px-3 py-1.5 text-center">
                          {emp.emailValid ? (
                            <span className="text-[10px] font-medium text-green-600">OK</span>
                          ) : (
                            <span className="text-[10px] font-medium text-red-600">Inválido</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  {parsedPreview.filter((e) => e.emailValid && e.companyName).length} de{" "}
                  {parsedPreview.length} listos para importar
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setParsedPreview(null)}
                    className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmImport}
                    disabled={uploading}
                    className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-light disabled:opacity-50"
                  >
                    {uploading ? "Importando..." : "Confirmar importación"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Upload result */}
          {uploadResult && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              Importación completada: {uploadResult.inserted} nuevos, {uploadResult.updated} actualizados, {uploadResult.unchanged} sin cambios
              {uploadResult.errors.length > 0 && (
                <div className="mt-1 text-xs text-red-600">
                  Errores: {uploadResult.errors.join("; ")}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
            {error}
            <button onClick={() => setError("")} className="ml-2 font-medium underline">cerrar</button>
          </div>
        )}

        {/* Employee list */}
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-primary">
              Directorio ({activeCount} activos de {filtered.length})
            </h2>
            {companies.length > 1 && (
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-primary"
              >
                <option value="">Todas las empresas</option>
                {companies.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
          </div>

          {loading ? (
            <div className="py-12 text-center">
              <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              No hay empleados registrados. Importe un directorio Excel.
            </p>
          ) : (
            <div className="max-h-[500px] overflow-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="text-left text-xs text-gray-500">
                    <th className="px-3 py-2 font-medium">Nombre</th>
                    <th className="px-3 py-2 font-medium">Correo</th>
                    <th className="px-3 py-2 font-medium">Empresa</th>
                    <th className="px-3 py-2 font-medium text-center">Estado</th>
                    <th className="px-3 py-2 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((emp) => (
                    <tr
                      key={emp.id}
                      className={emp.is_active ? "bg-white" : "bg-gray-50 opacity-60"}
                    >
                      <td className="px-3 py-2 font-medium text-gray-900">{emp.full_name}</td>
                      <td className="px-3 py-2">
                        {editingId === emp.id ? (
                          <div className="flex gap-1">
                            <input
                              type="email"
                              value={editEmail}
                              onChange={(e) => setEditEmail(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handleSaveEmail(emp.id)}
                              className="w-full rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-primary"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveEmail(emp.id)}
                              className="rounded bg-primary px-2 py-1 text-xs font-medium text-white"
                            >
                              OK
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="rounded bg-gray-200 px-2 py-1 text-xs font-medium text-gray-700"
                            >
                              X
                            </button>
                          </div>
                        ) : (
                          <span
                            className="cursor-pointer text-gray-600 hover:text-primary hover:underline"
                            onClick={() => { setEditingId(emp.id); setEditEmail(emp.email); }}
                            title="Clic para editar"
                          >
                            {emp.email}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{emp.company_name}</td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => handleToggleActive(emp)}
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            emp.is_active
                              ? "bg-green-100 text-green-700 hover:bg-green-200"
                              : "bg-gray-200 text-gray-500 hover:bg-gray-300"
                          }`}
                        >
                          {emp.is_active ? "Activo" : "Inactivo"}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => handleDelete(emp.id, emp.full_name)}
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
