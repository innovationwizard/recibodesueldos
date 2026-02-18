import { SetPasswordForm } from "./SetPasswordForm";

export const dynamic = "force-dynamic";

export default function SetPasswordPage() {
  // No server-side auth check: invite flow lands with hash (client-only).
  // SetPasswordForm handles auth + hash on client.
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="bg-primary px-6 py-6">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-xl font-bold tracking-tight text-white">
            Establecer contraseña
          </h1>
          <p className="mt-1 text-[13px] text-white/70">
            Crea o restablece tu contraseña para acceder a Recibos de Sueldos
          </p>
        </div>
      </header>

      <main className="mx-auto flex flex-1 w-full max-w-md flex-col justify-center px-4 py-12">
        <SetPasswordForm />
      </main>
    </div>
  );
}
