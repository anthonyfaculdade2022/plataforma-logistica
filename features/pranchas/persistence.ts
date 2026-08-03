import type { Equipamento, Frete, Frota, Manutencao } from "./types";

export type PranchasState = {
  fretes: Frete[];
  frotas: Frota[];
  manutencoes: Manutencao[];
  equipamentos: Equipamento[];
};

export const isPranchasState = (value: unknown): value is PranchasState => {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<PranchasState>;
  return (
    Array.isArray(state.fretes) &&
    Array.isArray(state.frotas) &&
    Array.isArray(state.manutencoes) &&
    Array.isArray(state.equipamentos)
  );
};
