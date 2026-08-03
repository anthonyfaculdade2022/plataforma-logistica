"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, LockKeyhole, Mail, Truck } from "lucide-react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/theme-toggle";

const schema = z.object({
  email: z.string().email("Informe um email válido."),
  password: z.string().min(6, "A senha deve possuir pelo menos 6 caracteres."),
  remember: z.boolean(),
});
type LoginData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter(),
    [loading, setLoading] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", remember: true },
  });
  const login = async (data: LoginData) => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, password: data.password }),
      });
      if (!response.ok) {
        setError("Email ou senha inválidos.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Não foi possível entrar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };
  const recover = () => {
    setError("");
    setMessage("Solicite ao administrador a alteração da sua senha.");
  };
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#f3f5f3] px-4 py-10">
      <div className="absolute right-5 top-5 z-10">
        <ThemeToggle compact />
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-white to-transparent" />
      <section className="relative w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#173d2e] text-[#d6f269] shadow-sm">
            <Truck size={23} />
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-[-.03em] text-[#202622]">
            Plataforma Logística
          </h1>
          <p className="mt-2 text-sm text-[#77817a]">
            Sistema Integrado de Operações
          </p>
        </div>
        <div className="rounded-2xl border border-[#e1e5e2] bg-white p-6 shadow-[0_18px_55px_rgba(22,32,26,.07)] sm:p-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold tracking-[-.02em] text-[#242a26]">
              Acesse sua conta
            </h2>
            <p className="mt-1.5 text-xs leading-5 text-[#7a847e]">
              Entre com seu email corporativo para continuar.
            </p>
          </div>
          <form onSubmit={handleSubmit(login)} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[#4f5a53]">
                Email
              </span>
              <span className="relative block">
                <Mail
                  size={15}
                  className="absolute left-3 top-3.5 text-[#8a948e]"
                />
                <input
                  autoComplete="email"
                  type="email"
                  placeholder="nome@empresa.com"
                  className="h-11 w-full rounded-xl border border-[#dfe4e1] bg-white pl-9 pr-3 text-sm outline-none transition duration-200 focus:border-[#5d806e] focus:ring-4 focus:ring-[#174e37]/[.07]"
                  {...register("email")}
                />
              </span>
              {errors.email && (
                <small className="mt-1 block text-xs text-red-600">
                  {errors.email.message}
                </small>
              )}
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[#4f5a53]">
                Senha
              </span>
              <span className="relative block">
                <LockKeyhole
                  size={15}
                  className="absolute left-3 top-3.5 text-[#8a948e]"
                />
                <input
                  autoComplete="current-password"
                  type="password"
                  placeholder="Digite sua senha"
                  className="h-11 w-full rounded-xl border border-[#dfe4e1] bg-white pl-9 pr-3 text-sm outline-none transition duration-200 focus:border-[#5d806e] focus:ring-4 focus:ring-[#174e37]/[.07]"
                  {...register("password")}
                />
              </span>
              {errors.password && (
                <small className="mt-1 block text-xs text-red-600">
                  {errors.password.message}
                </small>
              )}
            </label>
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-[#647068]">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-[#ccd3ce] accent-[#174e37]"
                  {...register("remember")}
                />
                Manter conectado
              </label>
              <button
                disabled={loading}
                type="button"
                onClick={recover}
                className="text-xs font-medium text-[#285b45] hover:text-[#174e37] hover:underline"
              >
                Esqueci minha senha
              </button>
            </div>
            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs text-red-700"
              >
                {error}
              </p>
            )}
            {message && (
              <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700">
                {message}
              </p>
            )}
            <button
              disabled={loading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#174e37] text-sm font-semibold text-white shadow-sm transition duration-200 hover:bg-[#123f2d] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && <LoaderCircle size={16} className="animate-spin" />}
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
        <p className="mt-5 text-center text-[11px] text-[#929a95]">
          Acesso restrito a usuários autorizados
        </p>
      </section>
    </main>
  );
}
