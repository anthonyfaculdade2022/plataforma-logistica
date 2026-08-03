import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FROTAS_FIXAS } from "@/features/pranchas/frotas-config";
import { isPranchasState, PranchasState } from "@/features/pranchas/persistence";
import {
  readLocalPranchasState,
  writeLocalPranchasState,
} from "@/lib/persistence/local-pranchas-state";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const STATE_KEY = "pranchas";

function authenticated(request: NextRequest) {
  return request.cookies.get("plataforma_session")?.value === "authenticated";
}

const emptyState = (): PranchasState => ({
  fretes: [],
  manutencoes: [],
  equipamentos: [],
  frotas: FROTAS_FIXAS.map((frota) => ({
    ...frota,
    status: "Disponível" as const,
  })),
});

const supabaseConfigured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY),
  );

function persistenceErrorMessage(error: unknown) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL)
    return "Configuração incompleta: NEXT_PUBLIC_SUPABASE_URL não encontrada.";
  if (!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY))
    return "Configuração incompleta: chave secreta do Supabase não encontrada.";
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code || "")
      : "";
  if (code === "PGRST205" || code === "42P01")
    return "A tabela plataforma_estado não foi encontrada no Supabase.";
  const status =
    typeof error === "object" && error && "status" in error
      ? Number((error as { status?: unknown }).status)
      : 0;
  if (status === 401 || status === 403)
    return "A chave secreta do Supabase foi recusada. Confira SUPABASE_SERVICE_ROLE_KEY.";
  return code
    ? `Falha ao acessar o Supabase (código ${code}).`
    : "Não foi possível conectar ao Supabase. Confira a URL e a chave secreta.";
}

async function loadState() {
  if (!supabaseConfigured()) {
    if (process.env.VERCEL)
      throw new Error("Supabase must be configured in Vercel");
    return readLocalPranchasState(emptyState);
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("plataforma_estado")
    .select("dados")
    .eq("chave", STATE_KEY)
    .maybeSingle();
  if (error) throw error;
  if (data?.dados && isPranchasState(data.dados)) return data.dados;
  const initial = emptyState();
  const { error: insertError } = await supabase
    .from("plataforma_estado")
    .upsert({ chave: STATE_KEY, dados: initial, updated_at: new Date().toISOString() });
  if (insertError) throw insertError;
  return initial;
}

async function saveState(state: PranchasState) {
  if (!supabaseConfigured()) {
    if (process.env.VERCEL)
      throw new Error("Supabase must be configured in Vercel");
    await writeLocalPranchasState(state);
    return;
  }
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("plataforma_estado")
    .upsert({ chave: STATE_KEY, dados: state, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function GET(request: NextRequest) {
  if (!authenticated(request)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  try {
    const state = await loadState();
    return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to load pranchas state", error);
    return NextResponse.json(
      { error: persistenceErrorMessage(error) },
      { status: 503 },
    );
  }
}

export async function PUT(request: NextRequest) {
  if (!authenticated(request)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  try {
    const payload: unknown = await request.json();
    if (!isPranchasState(payload)) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    await saveState(payload);
    return NextResponse.json({ saved: true, updatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Failed to save pranchas state", error);
    return NextResponse.json({ error: persistenceErrorMessage(error) }, { status: 503 });
  }
}
