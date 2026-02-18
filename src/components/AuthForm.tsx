"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// type Mode = "login" | "signup";

export function AuthForm() {
  // const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const supabase = createClient();

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

  return (
    <div className="w-full max-w-md">
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-gray-100 bg-white p-8 shadow-sm"
      >
        <h1 className="mb-2 text-xl font-bold text-primary">
          Iniciar sesión
          {/* {mode === "login" ? "Iniciar sesión" : "Crear cuenta"} */}
        </h1>
        <p className="mb-6 text-sm text-gray-600">
          Ingresa tus credenciales para acceder
          {/* {mode === "login"
            ? "Ingresa tus credenciales para acceder"
            : "Regístrate para usar el generador de boletas"} */}
        </p>

        {/* {mode === "signup" && (
          <div className="mb-4">
            <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium text-gray-700">
              Nombre completo
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Juan Pérez"
              className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              required
            />
          </div>
        )} */}

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

        <div className="mb-6">
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
          {/* {loading ? "Cargando..." : mode === "login" ? "Iniciar sesión" : "Crear cuenta"} */}
        </button>

        {/* <p className="mt-4 text-center text-sm text-gray-600">
          {mode === "login" ? (
            <>
              ¿No tienes cuenta?{" "}
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="font-medium text-primary hover:underline"
              >
                Regístrate
              </button>
            </>
          ) : (
            <>
              ¿Ya tienes cuenta?{" "}
              <button
                type="button"
                onClick={() => setMode("login")}
                className="font-medium text-primary hover:underline"
              >
                Inicia sesión
              </button>
            </>
          )}
        </p> */}
      </form>
    </div>
  );
}
