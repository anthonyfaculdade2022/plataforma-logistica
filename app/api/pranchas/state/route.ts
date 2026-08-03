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
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

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
      { error: "A base persistente não está disponível." },
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
    return NextResponse.json({ error: "Não foi possível salvar os dados." }, { status: 503 });
  }
}
