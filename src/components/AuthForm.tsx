"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function AuthForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);

  const supabase = createClient();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/set-password`,
      });
      if (error) throw error;
      setMessage({
        type: "success",
        text: "Revisa tu correo para restablecer tu contraseña.",
      });
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // if (mode === "signup") {
      //   const { error } = await supabase.auth.signUp({
      //     email,
      //     password,
      //     options: { data: { full_name: fullName } },
      //   });
      //   if (error) throw error;
      //   setMessage({
      //     type: "success",
      //     text: "¡Cuenta creada! Revisa tu correo para confirmar.",
      //   });
      // } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.href = "/dashboard";
      // }
    } catch (err) {
      setMessage({
        type: "error",
        text: (err as Error).message,
      });
    } finally {
      setLoading(false);
    }
  };

  if (recoveryMode) {
    return (
      <div className="w-full max-w-md">
        <form
          onSubmit={handleResetPassword}
          className="rounded-xl border border-gray-100 bg-white p-8 shadow-sm"
        >
          <h1 className="mb-2 text-xl font-bold text-primary">
            Restablecer contraseña
          </h1>
          <p className="mb-6 text-sm text-gray-600">
            Ingresa tu correo y te enviaremos un enlace para crear una nueva contraseña
          </p>

          <div className="mb-6">
            <label htmlFor="recovery-email" className="mb-1.5 block text-sm font-medium text-gray-700">
              Correo electrónico
            </label>
            <input
              id="recovery-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@empresa.com"
              className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              required
            />
          </div>

          {message && (
            <div
              className={`mb-4 rounded-lg px-4 py-3 text-sm ${
                message.type === "success"
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-600"
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-light disabled:opacity-50"
          >
            {loading ? "Enviando..." : "Enviar enlace"}
          </button>

          <p className="mt-4 text-center text-sm text-gray-600">
            <button
              type="button"
              onClick={() => { setRecoveryMode(false); setMessage(null); }}
              className="font-medium text-primary hover:underline"
            >
              Volver a iniciar sesión
            </button>
          </p>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-gray-100 bg-white p-8 shadow-sm"
      >
        <h1 className="mb-2 text-xl font-bold text-primary">
          Iniciar sesión
        </h1>
        <p className="mb-6 text-sm text-gray-600">
          Ingresa tus credenciales para acceder
        </p>

        <div className="mb-4">
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">
            Correo electrónico
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@empresa.com"
            className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
            required
          />
        </div>

        <div className="mb-2">
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            minLength={6}
            className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
            required
          />
        </div>
        <div className="mb-6 text-right">
          <button
            type="button"
            onClick={() => setRecoveryMode(true)}
            className="text-sm font-medium text-primary hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>

        {message && (
          <div
            className={`mb-4 rounded-lg px-4 py-3 text-sm ${
              message.type === "success"
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-600"
            }`}
          >
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-light disabled:opacity-50"
        >
          {loading ? "Cargando..." : "Iniciar sesión"}
        </button>
      </form>
    </div>
  );
}
