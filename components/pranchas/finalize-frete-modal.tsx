"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { CheckCircle2, MapPin, X } from "lucide-react";
import { Frete, getEquipeTransporte } from "@/features/pranchas/types";

export function FinalizeFreteModal({
  frete,
  close,
  confirm,
}: {
  frete: Frete | null;
  close: () => void;
  confirm: (frete: Frete, location: string) => void;
}) {
  const [location, setLocation] = useState("");
  useEffect(() => {
    if (frete) setLocation("");
  }, [frete]);

  const submit = () => {
    const normalizedLocation = location.trim();
    if (frete && normalizedLocation) confirm(frete, normalizedLocation);
  };

  return (
    <Dialog.Root open={!!frete} onOpenChange={(open) => !open && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#101914]/40" />
        <Dialog.Content className="fadein fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-2xl outline-none">
          <div className="flex items-start justify-between border-b p-5">
            <div>
              <Dialog.Title className="font-semibold">
                Finalizar Frete
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-[#78847d]">
                Informe onde a prancha ficará disponível.
              </Dialog.Description>
            </div>
            <Dialog.Close aria-label="Fechar">
              <X size={18} />
            </Dialog.Close>
          </div>
          {frete && (
            <div className="p-5">
              <div className="rounded-xl border border-[#e8ebe9] bg-[#fafbfa] p-4">
                <p className="text-xs text-[#7b847f]">Frete {frete.id}</p>
                <p className="mt-1.5 text-sm font-medium">
                  {getEquipeTransporte(frete).length > 1
                    ? `${getEquipeTransporte(frete).length} pranchas`
                    : `Frota ${getEquipeTransporte(frete)[0]?.frota || "—"}`}{" "}
                  · {frete.origem} → {frete.destino}
                </p>
              </div>
              <label className="mt-5 block">
                <span className="label">Localização da Prancha *</span>
                <div className="relative">
                  <MapPin
                    size={15}
                    className="pointer-events-none absolute left-3 top-3.5 text-[#7c8580]"
                  />
                  <input
                    autoFocus
                    required
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") submit();
                    }}
                    className="field pl-9"
                    placeholder="Ex.: Aralco, Oficina, Frente 87 ou Pátio"
                  />
                </div>
              </label>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={close}
                  className="flex-1 rounded-xl border border-[#e0e4e2] py-2.5 text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!location.trim()}
                  onClick={submit}
                  className="flex-1 rounded-xl bg-[#174e37] py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <CheckCircle2 size={16} className="mr-1.5 inline" />
                  Finalizar Frete
                </button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
