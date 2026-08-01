"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {useEffect,useState} from "react";
import {X} from "lucide-react";
import {Frota} from "@/features/pranchas/types";

export function PreOsModal({frota,close,save}:{frota:Frota|null;close:()=>void;save:(numero:string,servico:string)=>void}){
 const [numero,setNumero]=useState(""),[servico,setServico]=useState("");
 useEffect(()=>{setNumero(frota?.numeroPreOs||"");setServico(frota?.servicoPreOs||"")},[frota]);
 if(!frota)return null;
 const valid=numero.trim()&&servico.trim();
 return <Dialog.Root open onOpenChange={v=>!v&&close()}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-black/35"/><Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-2xl"><header className="flex items-start justify-between border-b p-5"><div><Dialog.Title className="font-semibold">Pré-OS da Frota {frota.numero}</Dialog.Title><Dialog.Description className="mt-1 text-xs text-[#748078]">Pendência programada sem alteração do status</Dialog.Description></div><button onClick={close}><X size={19}/></button></header><div className="space-y-4 p-5"><label><span className="label">Número da Pré-OS</span><input className="field" value={numero} onChange={e=>setNumero(e.target.value)}/></label><label><span className="label">Descrição do serviço</span><textarea className="field" rows={3} value={servico} onChange={e=>setServico(e.target.value)}/></label><div className="flex gap-3"><button onClick={close} className="flex-1 rounded-xl border py-3 text-sm font-semibold">Cancelar</button><button disabled={!valid} onClick={()=>save(numero.trim(),servico.trim())} className="flex-1 rounded-xl bg-[#174e37] py-3 text-sm font-semibold text-white disabled:opacity-40">Salvar Pré-OS</button></div></div></Dialog.Content></Dialog.Portal></Dialog.Root>
}
