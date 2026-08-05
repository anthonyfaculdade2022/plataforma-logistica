"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useEffect } from "react";
import { Check, Clock3, X } from "lucide-react";
import { manutencaoSchema, ManutencaoInput } from "@/features/pranchas/schemas";
import { Frete, Frota, getEquipeTransporte } from "@/features/pranchas/types";
import { obterMotoristasDisponiveis } from "@/features/pranchas/motoristas-config";

const choiceClass = (active: boolean) =>
  `flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border px-3.5 text-sm transition-all duration-200 ${
    active
      ? "border-[#819b8c] bg-[#f0f5f2] font-medium text-[#174e37] shadow-[0_1px_2px_rgba(18,24,21,.04)]"
      : "border-[#e2e7e4] bg-white text-[#606a64] hover:border-[#cdd5d0] hover:bg-[#fafbfa]"
  }`;

function growTextarea(element: HTMLTextAreaElement) {
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
}

export function MaintenanceTrackingModal({
  open,
  close,
  frotas,
  fretes,
  initialFrota,
  save,
}: {
  open: boolean;
  close: () => void;
  frotas: Frota[];
  fretes: Frete[];
  initialFrota?: string | null;
  save: (data: ManutencaoInput) => void;
}) {
  const now = new Date();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ManutencaoInput>({
    resolver: zodResolver(manutencaoSchema),
    defaultValues: {
      entradaData: now.toLocaleDateString("en-CA"),
      entradaHora: now.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      tipo: "Preventiva",
      componente: "Cavalo",
      mesmaOs: true,
      previsao: "nao",
      transferir: "nao",
      usarPreOs: "nao",
      observacoes: "",
    },
  });

  const frota = watch("frota");
  const tipo = watch("tipo");
  const componente = watch("componente");
  const mesmaOs = watch("mesmaOs");
  const previsao = watch("previsao");
  const transferir = watch("transferir");
  const usarPreOs = watch("usarPreOs");
  const selectedFleet = frotas.find((item) => item.numero === frota);
  const driverOptions = obterMotoristasDisponiveis(
    fretes.flatMap((item) =>
      getEquipeTransporte(item).map((member) => member.motorista),
    ),
  );

  useEffect(() => {
    if (open) setValue("frota", initialFrota || "");
  }, [open, initialFrota, setValue]);

  useEffect(() => {
    if (usarPreOs === "sim" && selectedFleet?.possuiPreOs) {
      setValue("numeroOs", selectedFleet.numeroPreOs || "");
      if (componente === "Prancha") setValue("servicoPrancha", selectedFleet.servicoPreOs || "");
      else setValue("servicoCavalo", selectedFleet.servicoPreOs || "");
    }
  }, [usarPreOs, selectedFleet, componente, setValue]);

  const interrupted = fretes.find(
    (item) =>
      item.status === "Em Frete" &&
      getEquipeTransporte(item).some((team) => team.frota === frota),
  );

  const fillNow = () => {
    const current = new Date();
    setValue("entradaData", current.toLocaleDateString("en-CA"), {
      shouldValidate: true,
    });
    setValue(
      "entradaHora",
      current.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      { shouldValidate: true },
    );
  };

  const submit = (data: ManutencaoInput) => {
    save(data);
    reset();
  };

  return (
    <Dialog.Root open={open} onOpenChange={(value) => !value && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[1px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[#e4e8e5] bg-white shadow-[0_24px_70px_rgba(18,24,21,.22)]">
          <header className="flex shrink-0 items-start justify-between border-b border-[#edf0ee] px-6 py-5">
            <div>
              <Dialog.Title className="text-base font-semibold text-[#252b27]">
                Colocar em Manutenção
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-[#748078]">
                Registre a parada e preserve o vínculo operacional
              </Dialog.Description>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Fechar"
              className="grid h-8 w-8 place-items-center rounded-lg text-[#758078] transition-colors hover:bg-[#f1f3f2] hover:text-[#303732]"
            >
              <X size={18} />
            </button>
          </header>

          <form
            onSubmit={handleSubmit(submit)}
            className="min-h-0 flex-1 overflow-y-auto px-6 py-5"
          >
            <datalist id="motoristas-transferencia">
              {driverOptions.map((motorista) => (
                <option value={motorista} key={motorista} />
              ))}
            </datalist>
            <div className="space-y-6">
              <section>
                <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[.12em] text-[#77827b]">
                  Dados da Manutenção
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="sm:col-span-2">
                    <span className="label">Frota</span>
                    <select className="field" {...register("frota")}>
                      <option value="">Selecione uma frota</option>
                      {frotas
                        .filter((item) => item.status !== "Manutenção")
                        .map((item) => (
                          <option key={item.numero} value={item.numero}>
                            Frota {item.numero}
                          </option>
                        ))}
                    </select>
                    {errors.frota && (
                      <small className="mt-1 block text-red-600">
                        {errors.frota.message}
                      </small>
                    )}
                  </label>

                  {selectedFleet && (
                    <div className="flex items-center gap-5 rounded-xl border border-[#e6eae7] bg-[#fafbfa] px-4 py-3 text-xs sm:col-span-2">
                      <span>
                        <span className="block text-[10px] uppercase tracking-wide text-[#8a938e]">
                          Prancha
                        </span>
                        <b className="mt-0.5 block font-medium text-[#3c443f]">
                          {selectedFleet.prancha}
                        </b>
                      </span>
                      <span className="h-7 w-px bg-[#e1e6e3]" />
                      <span>
                        <span className="block text-[10px] uppercase tracking-wide text-[#8a938e]">
                          Status atual
                        </span>
                        <b className="mt-0.5 flex items-center gap-1.5 font-medium text-[#3c443f]">
                          <i className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          {selectedFleet.status}
                        </b>
                      </span>
                    </div>
                  )}

                  <label className="sm:col-span-2">
                    <span className="label">Localização</span>
                    <input
                      className="field"
                      placeholder="Ex.: Frente 97, Oficina, Aralco..."
                      {...register("localizacao")}
                    />
                    {errors.localizacao && (
                      <small className="mt-1 block text-red-600">
                        {errors.localizacao.message}
                      </small>
                    )}
                  </label>

                  <fieldset className="sm:col-span-2">
                    <legend className="label">Tipo</legend>
                    <div className="grid grid-cols-2 gap-2">
                      {(["Preventiva", "Corretiva"] as const).map((option) => (
                        <label key={option} className={choiceClass(tipo === option)}>
                          <input
                            type="radio"
                            value={option}
                            className="sr-only"
                            {...register("tipo")}
                          />
                          <span className={`grid h-4 w-4 place-items-center rounded-full border ${tipo === option ? "border-[#48745f] bg-[#48745f]" : "border-[#b7c0bb]"}`}>
                            {tipo === option && <Check size={11} className="text-white" />}
                          </span>
                          {option}
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset className="sm:col-span-2">
                    <legend className="label">Componente em Manutenção</legend>
                    <div className="grid grid-cols-3 gap-2">
                      {(["Cavalo", "Prancha", "Ambos"] as const).map((option) => (
                        <label
                          key={option}
                          className={choiceClass(componente === option)}
                        >
                          <input
                            type="radio"
                            value={option}
                            className="sr-only"
                            {...register("componente")}
                          />
                          <span
                            className={`grid h-4 w-4 place-items-center rounded-full border ${
                              componente === option
                                ? "border-[#48745f] bg-[#48745f]"
                                : "border-[#b7c0bb]"
                            }`}
                          >
                            {componente === option && (
                              <Check size={11} className="text-white" />
                            )}
                          </span>
                          {option}
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  {componente === "Ambos" && (
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#e2e7e4] bg-[#fafbfa] px-3.5 py-3 text-sm text-[#535e57] sm:col-span-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-[#b7c0bb] accent-[#48745f]"
                        {...register("mesmaOs")}
                      />
                      Utilizar a mesma OS para Cavalo e Prancha
                    </label>
                  )}

                  {componente === "Ambos" && !mesmaOs ? (
                    <>
                      <label>
                        <span className="label">OS Cavalo</span>
                        <input className="field" {...register("numeroOsCavalo")} />
                        {errors.numeroOsCavalo && (
                          <small className="mt-1 block text-red-600">
                            {errors.numeroOsCavalo.message}
                          </small>
                        )}
                      </label>
                      <label>
                        <span className="label">OS Prancha</span>
                        <input className="field" {...register("numeroOsPrancha")} />
                        {errors.numeroOsPrancha && (
                          <small className="mt-1 block text-red-600">
                            {errors.numeroOsPrancha.message}
                          </small>
                        )}
                      </label>
                    </>
                  ) : (
                    <label className="sm:col-span-2">
                      <span className="label">{componente === "Cavalo" ? "OS Cavalo" : componente === "Prancha" ? "OS Prancha" : "Número da OS"}</span>
                      <input className="field" {...register("numeroOs")} />
                      {errors.numeroOs && (
                        <small className="mt-1 block text-red-600">
                          {errors.numeroOs.message}
                        </small>
                      )}
                    </label>
                  )}
                </div>
              </section>

              <section className="border-t border-[#edf0ee] pt-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#77827b]">
                    Parada
                  </h3>
                  <button
                    type="button"
                    onClick={fillNow}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#dfe5e1] bg-white px-3 text-xs font-medium text-[#59635d] transition-colors hover:bg-[#f5f7f5]"
                  >
                    <Clock3 size={13} /> Agora
                  </button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label>
                    <span className="label">Data de entrada</span>
                    <input type="date" className="field" {...register("entradaData")} />
                  </label>
                  <label>
                    <span className="label">Hora de entrada</span>
                    <input type="time" className="field" {...register("entradaHora")} />
                  </label>

                  <fieldset className="sm:col-span-2">
                    <legend className="label">Previsão de retorno</legend>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        ["nao", "Sem previsão"],
                        ["sim", "Informar previsão"],
                      ].map(([value, label]) => (
                        <label key={value} className={choiceClass(previsao === value)}>
                          <input
                            type="radio"
                            value={value}
                            className="sr-only"
                            {...register("previsao")}
                          />
                          <span className={`h-3.5 w-3.5 rounded-full border ${previsao === value ? "border-[4px] border-[#48745f]" : "border-[#b7c0bb]"}`} />
                          {label}
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  {previsao === "sim" && (
                    <>
                      <label>
                        <span className="label">Data prevista</span>
                        <input type="date" className="field" {...register("previsaoData")} />
                      </label>
                      <label>
                        <span className="label">Hora prevista</span>
                        <input type="time" className="field" {...register("previsaoHora")} />
                      </label>
                    </>
                  )}
                </div>
              </section>

              <section className="border-t border-[#edf0ee] pt-5">
                <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[.12em] text-[#77827b]">
                  Serviço
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {selectedFleet?.possuiPreOs && (
                    <fieldset className="rounded-xl border border-amber-200 bg-amber-50 p-3 sm:col-span-2">
                      <legend className="px-2 text-xs font-medium text-amber-800">
                        Utilizar a Pré-OS cadastrada?
                      </legend>
                      <p className="mb-2 text-xs text-amber-800">
                        Pré-OS {selectedFleet.numeroPreOs} · {selectedFleet.servicoPreOs}
                      </p>
                      <div className="flex gap-5 text-sm">
                        <label><input type="radio" value="sim" {...register("usarPreOs")} /> Sim</label>
                        <label><input type="radio" value="nao" {...register("usarPreOs")} /> Não</label>
                      </div>
                    </fieldset>
                  )}

                  {interrupted && (
                    <div className="rounded-xl bg-orange-50 p-3 text-xs text-orange-800 sm:col-span-2">
                      Frete interrompido: <b>{interrupted.id}</b> · {interrupted.equipamentoTipo} {interrupted.equipamentoCodigo} · {interrupted.origem} → {interrupted.destino}
                    </div>
                  )}

                  {(componente === "Cavalo" || componente === "Ambos") && <label className={componente === "Cavalo" ? "sm:col-span-2" : ""}>
                    <span className="label">Serviço Cavalo</span>
                    <textarea className="field min-h-[72px] resize-none overflow-hidden" rows={2} onInput={(event) => growTextarea(event.currentTarget)} {...register("servicoCavalo")} />
                    {errors.servicoCavalo && <small className="mt-1 block text-red-600">{errors.servicoCavalo.message}</small>}
                  </label>}
                  {(componente === "Prancha" || componente === "Ambos") && <label className={componente === "Prancha" ? "sm:col-span-2" : ""}>
                    <span className="label">Serviço Prancha</span>
                    <textarea className="field min-h-[72px] resize-none overflow-hidden" rows={2} onInput={(event) => growTextarea(event.currentTarget)} {...register("servicoPrancha")} />
                    {errors.servicoPrancha && <small className="mt-1 block text-red-600">{errors.servicoPrancha.message}</small>}
                  </label>}

                  {interrupted && (
                    <fieldset className="rounded-xl border border-[#e3e8e5] p-4 sm:col-span-2">
                      <legend className="px-2 text-sm font-medium">
                        O frete será assumido por outra prancha?
                      </legend>
                      <div className="flex gap-5 text-sm">
                        <label><input type="radio" value="sim" {...register("transferir")} /> Sim</label>
                        <label><input type="radio" value="nao" {...register("transferir")} /> Não</label>
                      </div>
                      {transferir === "sim" && (
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                          <label>
                            <span className="label">Nova Frota</span>
                            <select className="field" {...register("novaFrota")}>
                              <option value="">Selecione</option>
                              {frotas
                                .filter((item) => item.status === "Disponível" && item.numero !== frota)
                                .map((item) => (
                                  <option key={item.numero} value={item.numero}>
                                    Frota {item.numero} · Prancha {item.prancha}
                                  </option>
                                ))}
                            </select>
                            {errors.novaFrota && <small className="mt-1 block text-red-600">{errors.novaFrota.message}</small>}
                          </label>
                          <label>
                            <span className="label">Novo Motorista</span>
                            <input list="motoristas-transferencia" className="field" {...register("novoMotorista")} />
                            {errors.novoMotorista && <small className="mt-1 block text-red-600">{errors.novoMotorista.message}</small>}
                          </label>
                        </div>
                      )}
                    </fieldset>
                  )}

                  <label className="sm:col-span-2">
                    <span className="label">Observações</span>
                    <textarea
                      className="field min-h-[56px] resize-none overflow-hidden"
                      rows={1}
                      onInput={(event) => growTextarea(event.currentTarget)}
                      {...register("observacoes")}
                    />
                  </label>
                </div>
              </section>
            </div>

            <div className="sticky bottom-0 -mx-6 -mb-5 mt-6 flex gap-3 border-t border-[#edf0ee] bg-white px-6 py-4">
              <button
                type="button"
                onClick={close}
                className="flex-1 rounded-xl border border-[#dfe4e1] py-2.5 text-sm font-medium text-[#59625d] transition-colors hover:bg-[#f5f7f5]"
              >
                Cancelar
              </button>
              <button className="primary-action flex-1 rounded-xl py-2.5 text-sm font-semibold text-white">
                Salvar manutenção
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
