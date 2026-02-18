"use client";

import { useCallback } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { Logo } from "@/components/Logo";
import { createClient } from "@/lib/supabase/client";
import { ReceiptGenerator } from "@/components/ReceiptGenerator";
import type { ReceiptData } from "@/lib/excel-parser";

interface DashboardClientProps {
  user: User;
}

export function DashboardClient({ user }: DashboardClientProps) {
  const supabase = createClient();

  const handleSuccess = useCallback(
    async (
      receipts: ReceiptData[],
      companyName: string,
      dateRange: string,
      file?: File
    ) => {
      try {
        const periodDate = receipts[0]?.receiptDate ?? dateRange;
        let filePath: string | null = null;

        if (file) {
          const path = `${user.id}/${Date.now()}-${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from("planillas")
            .upload(path, file, {
              contentType: file.type,
              upsert: false,
            });
          if (!uploadError) filePath = path;
        }

        const { data: batch, error: batchError } = await supabase
          .from("batches")
          .insert({
            user_id: user.id,
            company_name: companyName,
            period_range: dateRange,
            period_date: periodDate,
            receipt_count: receipts.length,
            file_name: file?.name ?? null,
            file_path: filePath,
          })
          .select("id")
          .single();

        if (batchError) {
          console.error("Error al guardar lote:", batchError);
          return;
        }

        const receiptRows = receipts.map((r) => ({
          batch_id: batch.id,
          ordinal: r.ordinal,
          employee_name: r.nombre,
          position: r.puesto,
          salary: r.salario,
          bonus: 0,
          special_bonus: r.bonificacionEspecial,
          igss: r.igss,
          isr: r.isr,
          advance: r.anticipo,
          other: r.otros,
          total_income: r.totalIngresos,
          total_deductions: r.totalDescuentos,
          net_pay: r.liquido,
        }));

        await supabase.from("receipts").insert(receiptRows);
      } catch (err) {
        console.error("Error al guardar en base de datos:", err);
      }
    },
    [user.id, supabase]
  );

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <>
      <header className="bg-primary px-6 py-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <Link href="/" className="block text-white hover:opacity-90 transition-opacity w-fit">
              <Logo className="text-white" iconSize={24} />
            </Link>
            <p className="mt-1 text-[13px] text-white/70">
              Cargue planilla Excel → Genere boletas → Imprima PDF
            </p>
          </div>
          <div className="flex items-center gap-4">
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

      <main className="mx-auto max-w-3xl px-4 py-8">
        <ReceiptGenerator onSuccess={handleSuccess} />
      </main>
    </>
  );
}
