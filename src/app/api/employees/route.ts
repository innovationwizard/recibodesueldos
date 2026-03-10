import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /api/employees?company=... — list employees, optionally filtered by company
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const company = request.nextUrl.searchParams.get("company");

  let query = supabase
    .from("employees")
    .select("*")
    .eq("user_id", user.id)
    .order("company_name")
    .order("full_name");

  if (company) {
    query = query.eq("company_name", company);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ employees: data });
}

// POST /api/employees — bulk upsert from parsed Excel
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: {
    employees: { fullName: string; email: string; companyName: string }[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  if (!body.employees || !Array.isArray(body.employees) || body.employees.length === 0) {
    return NextResponse.json({ error: "Lista de empleados vacía" }, { status: 400 });
  }

  // Validate
  const errors: string[] = [];
  for (const emp of body.employees) {
    if (!emp.fullName || emp.fullName.trim().length < 2) {
      errors.push(`Nombre inválido: "${emp.fullName}"`);
    }
    if (!EMAIL_RE.test(emp.email)) {
      errors.push(`Correo inválido: "${emp.email}" (${emp.fullName})`);
    }
    if (!emp.companyName || emp.companyName.trim().length < 1) {
      errors.push(`Empresa vacía para: "${emp.fullName}"`);
    }
  }
  if (errors.length > 0) {
    return NextResponse.json({ error: "Errores de validación", details: errors }, { status: 400 });
  }

  // Upsert: for each employee, insert or update by (user_id, company_name, full_name)
  let inserted = 0;
  let updated = 0;
  const upsertErrors: string[] = [];

  for (const emp of body.employees) {
    const fullName = emp.fullName.trim();
    const email = emp.email.trim().toLowerCase();
    const companyName = emp.companyName.trim();

    // Check if exists
    const { data: existing } = await supabase
      .from("employees")
      .select("id, email")
      .eq("user_id", user.id)
      .eq("company_name", companyName)
      .eq("full_name", fullName)
      .eq("is_active", true)
      .maybeSingle();

    if (existing) {
      if (existing.email !== email) {
        const { error } = await supabase
          .from("employees")
          .update({ email, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) {
          upsertErrors.push(`Error actualizando ${fullName}: ${error.message}`);
        } else {
          updated++;
        }
      }
    } else {
      const { error } = await supabase.from("employees").insert({
        user_id: user.id,
        full_name: fullName,
        email,
        company_name: companyName,
        is_active: true,
      });
      if (error) {
        upsertErrors.push(`Error insertando ${fullName}: ${error.message}`);
      } else {
        inserted++;
      }
    }
  }

  return NextResponse.json({
    inserted,
    updated,
    unchanged: body.employees.length - inserted - updated - upsertErrors.length,
    errors: upsertErrors,
  });
}

// PATCH /api/employees — update a single employee
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: { id: string; email?: string; is_active?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.email !== undefined) {
    if (!EMAIL_RE.test(body.email)) {
      return NextResponse.json({ error: "Correo inválido" }, { status: 400 });
    }
    updates.email = body.email.trim().toLowerCase();
  }
  if (body.is_active !== undefined) {
    updates.is_active = body.is_active;
  }

  const { error } = await supabase
    .from("employees")
    .update(updates)
    .eq("id", body.id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/employees?id=... — hard delete
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  const { error } = await supabase
    .from("employees")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
