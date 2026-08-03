"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, Trash2, X } from "lucide-react";
import {
  Equipamento,
  EquipeTransporte,
  EtapaFrete,
  Frete,
  Frota,
  getEquipeTransporte,
} from "@/features/pranchas/types";

type EditableFrete = Pick<
  Frete,
  | "equipamentoTipo"
  | "origem"
  | "destino"
  | "solicitante"
  | "responsavel"
  | "setor"
  | "observacao"
  | "etapas"
  | "equipeTransporte"
>;

const emptyData: EditableFrete = {
  origem: "",
  destino: "",
  solicitante: "",
  responsavel: "",
  setor: "",
  observacao: "",
  etapas: [],
  equipeTransporte: [],
};

export function EditFreteModal({
  frete,
  frotas,
  equipamentos,
  close,
  save,
}: {
  frete: Frete | null;
  frotas: Frota[];
  equipamentos: Equipamento[];
  close: () => void;
  save: (data: EditableFrete) => void;
}) {
  const [data, setData] = useState<EditableFrete>(emptyData);
  useEffect(() => {
    if (!frete) return;
    setData({
      equipamentoTipo: [frete.equipamentoTipo, frete.equipamentoCodigo]
        .filter(Boolean)
        .join(" "),
      origem: frete.origem,
      destino: frete.destino,
      solicitante: frete.solicitante,
      responsavel: frete.responsavel,
      setor: frete.setor,
      observacao: frete.observacao,
      etapas: frete.etapas?.map((etapa, index) => ({
        ...etapa,
        equipamento:
          etapa.equipamento ||
          (index === 0
            ? [frete.equipamentoTipo, frete.equipamentoCodigo]
                .filter(Boolean)
                .join(" ")
            : ""),
      })),
      equipeTransporte: getEquipeTransporte(frete),
    });
  }, [frete]);
  if (!frete) return null;

  const set = (field: keyof EditableFrete, value: string) =>
    setData((current) => ({ ...current, [field]: value }));
  const updateMember = (
    index: number,
    field: keyof EquipeTransporte,
    value: string,
  ) =>
    setData((current) => ({
      ...current,
      equipeTransporte: (current.equipeTransporte || []).map((member, i) =>
        i === index ? { ...member, [field]: value } : member,
      ),
    }));
  const updateStage = (
    index: number,
    field: keyof Pick<EtapaFrete, "equipamento" | "origem" | "destino" | "observacao">,
    value: string,
  ) =>
    setData((current) => ({
      ...current,
      etapas: (current.etapas || []).map((stage, stageIndex) =>
        stageIndex === index ? { ...stage, [field]: value } : stage,
      ),
    }));
  const team = data.equipeTransporte || [];
  const teamValid =
    (frete.status === "Pendente" || team.length > 0) &&
    team.every(
      (member) => member.frota && member.motorista.trim().length >= 2,
    ) &&
    new Set(team.map((member) => member.frota)).size === team.length;
  const valid =
    data.origem.trim() &&
    data.destino.trim() &&
    data.solicitante.trim() &&
    data.responsavel.trim() &&
    data.setor.trim() &&
    (frete.fluxoOperacao !== "sequencia" ||
      (data.etapas || []).every(
        (stage) => stage.equipamento?.trim() && stage.origem.trim() && stage.destino.trim(),
      )) &&
    teamValid;

  const equipmentOptions = Array.from(
    new Set([
      ...equipamentos.map((item) => `${item.tipo} ${item.codigo}`.trim()),
      "Colhedora 61065",
      "Pá Carregadeira 41002",
      "Trator 52015",
      "Escavadeira 31001",
      "Transbordo 42015",
    ]),
  );

  return (
    <Dialog.Root open onOpenChange={(value) => !value && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/35" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[60] max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white shadow-2xl">
          <header className="sticky top-0 z-10 flex items-start justify-between border-b bg-white p-5">
            <div>
              <Dialog.Title className="font-semibold">
                Editar Frete
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-[#748078]">
                Atualize os dados e a equipe do frete {frete.id}
              </Dialog.Description>
            </div>
            <button onClick={close} aria-label="Fechar">
              <X size={19} />
            </button>
          </header>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <datalist id="equipamentos-edicao-etapa">
              {equipmentOptions.map((equipment) => <option value={equipment} key={equipment} />)}
            </datalist>
            {frete.fluxoOperacao !== "sequencia" && <label className="sm:col-span-2">
              <span className="label">Equipamento</span>
              <input
                className="field"
                placeholder="Ex.: Pá Carregadeira 41002"
                value={data.equipamentoTipo || ""}
                onChange={(event) => set("equipamentoTipo", event.target.value)}
              />
            </label>}
            <label>
              <span className="label">Origem</span>
              <input
                className="field"
                value={data.origem}
                onChange={(event) => set("origem", event.target.value)}
              />
            </label>
            <label>
              <span className="label">Destino</span>
              <input
                className="field"
                value={data.destino}
                onChange={(event) => set("destino", event.target.value)}
              />
            </label>

            {frete.fluxoOperacao === "sequencia" && Boolean(data.etapas?.length) && (
              <section className="space-y-3 rounded-xl border border-[#e4e9e5] bg-[#fafbfa] p-4 sm:col-span-2">
                <div>
                  <h3 className="text-sm font-semibold">Sequência de Fretes</h3>
                  <p className="mt-1 text-xs text-[#78837c]">Edite o equipamento e a rota de cada etapa individualmente.</p>
                </div>
                {(data.etapas || []).map((stage, index) => (
                  <div key={stage.id} className="grid gap-3 rounded-lg border bg-white p-3 sm:grid-cols-2">
                    <p className="text-xs font-semibold text-[#414943] sm:col-span-2">Etapa {index + 1}</p>
                    <label className="sm:col-span-2">
                      <span className="label">Equipamento</span>
                      <input
                        list="equipamentos-edicao-etapa"
                        className="field"
                        value={stage.equipamento || ""}
                        onChange={(event) => updateStage(index, "equipamento", event.target.value)}
                        placeholder="Pesquisar por nome ou número..."
                      />
                    </label>
                    <label>
                      <span className="label">Origem</span>
                      <input className="field" value={stage.origem} onChange={(event) => updateStage(index, "origem", event.target.value)} />
                    </label>
                    <label>
                      <span className="label">Destino</span>
                      <input className="field" value={stage.destino} onChange={(event) => updateStage(index, "destino", event.target.value)} />
                    </label>
                    <label className="sm:col-span-2">
                      <span className="label">Observação</span>
                      <input className="field" value={stage.observacao || ""} onChange={(event) => updateStage(index, "observacao", event.target.value)} />
                    </label>
                  </div>
                ))}
              </section>
            )}

            <section className="rounded-xl border border-[#e4e9e5] bg-[#fafbfa] p-4 sm:col-span-2">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">
                    Equipe de Transporte
                  </h3>
                  <p className="mt-1 text-xs text-[#78837c]">
                    Frota e motorista são sempre registrados juntos.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setData((current) => ({
                      ...current,
                      equipeTransporte: [
                        ...(current.equipeTransporte || []),
                        { frota: "", motorista: "" },
                      ],
                    }))
                  }
                  className="inline-flex items-center gap-1 rounded-lg border bg-white px-3 py-2 text-xs font-medium"
                >
                  <Plus size={13} /> Adicionar Prancha
                </button>
              </div>
              <div className="space-y-3">
                {team.map((member, index) => (
                  <div
                    key={index}
                    className="grid gap-3 rounded-lg border bg-white p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                  >
                    <label>
                      <span className="label">Frota · Prancha {index + 1}</span>
                      <select
                        className="field"
                        value={member.frota}
                        onChange={(event) =>
                          updateMember(index, "frota", event.target.value)
                        }
                      >
                        <option value="">Selecione</option>
                        {frotas
                          .filter(
                            (fleet) =>
                              fleet.status !== "Manutenção" &&
                              (fleet.status === "Disponível" ||
                                team.some(
                                  (current) => current.frota === fleet.numero,
                                )) &&
                              !team.some(
                                (current, currentIndex) =>
                                  currentIndex !== index &&
                                  current.frota === fleet.numero,
                              ),
                          )
                          .map((fleet) => (
                            <option key={fleet.numero} value={fleet.numero}>
                              Frota {fleet.numero} · Prancha {fleet.prancha}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      <span className="label">Motorista</span>
                      <input
                        className="field"
                        value={member.motorista}
                        onChange={(event) =>
                          updateMember(index, "motorista", event.target.value)
                        }
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setData((current) => ({
                          ...current,
                          equipeTransporte: (
                            current.equipeTransporte || []
                          ).filter((_, i) => i !== index),
                        }))
                      }
                      aria-label={`Remover prancha ${index + 1}`}
                      className="grid h-10 w-10 place-items-center rounded-lg text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                {!team.length && (
                  <p className="py-3 text-center text-xs text-[#87918b]">
                    Nenhuma prancha vinculada.
                  </p>
                )}
              </div>
            </section>

            <label>
              <span className="label">Solicitante</span>
              <input
                className="field"
                value={data.solicitante}
                onChange={(event) => set("solicitante", event.target.value)}
              />
            </label>
            <label>
              <span className="label">Responsável da Logística</span>
              <input
                className="field"
                value={data.responsavel}
                onChange={(event) => set("responsavel", event.target.value)}
              />
            </label>
            <label className="sm:col-span-2">
              <span className="label">Setor</span>
              <input
                className="field"
                value={data.setor}
                onChange={(event) => set("setor", event.target.value)}
              />
            </label>
            <label className="sm:col-span-2">
              <span className="label">Observação</span>
              <textarea
                className="field"
                rows={3}
                value={data.observacao}
                onChange={(event) => set("observacao", event.target.value)}
              />
            </label>
            <div className="flex gap-3 pt-2 sm:col-span-2">
              <button
                type="button"
                onClick={close}
                className="flex-1 rounded-xl border py-3 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                disabled={!valid}
                onClick={() => save(data)}
                className="flex-1 rounded-xl bg-[#174e37] py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
