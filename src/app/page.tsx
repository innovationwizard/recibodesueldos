import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-primary px-6 py-6">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-xl font-bold tracking-tight text-white">
            Recibos de Sueldos
          </h1>
          <p className="mt-1 text-[13px] text-white/70">
            Generador de boletas de pago desde Excel
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-8 text-center">
          <h2 className="text-lg font-semibold text-gray-800">
            Inicia sesión para continuar
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Carga tu planilla Excel y genera constancias de pago
          </p>
        </div>

        <div className="flex justify-center">
          <AuthForm />
        </div>

        <p className="mt-8 text-center text-xs text-gray-500">
          Formato diseñado a la medida.
        </p>
      </main>
    </div>
  );
}
