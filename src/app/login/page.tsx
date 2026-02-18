import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="bg-primary px-6 py-6">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight text-white hover:underline"
          >
            Recibos de Sueldos
          </Link>
        </div>
      </header>

      <main className="mx-auto flex flex-1 max-w-3xl flex-col items-center justify-center px-4 py-12">
        <AuthForm />
      </main>
    </div>
  );
}
