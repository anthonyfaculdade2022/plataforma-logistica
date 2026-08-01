"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {useEffect,useState} from "react";
import {X} from "lucide-react";
import {Frete} from "@/features/pranchas/types";

export function CancelFreteModal({frete,close,confirm}:{frete:Frete|null;close:()=>void;confirm:(solicitadoPor:string,motivo:string)=>void}){
 const [solicitadoPor,setSolicitadoPor]=useState(""),[motivo,setMotivo]=useState("");
 useEffect(()=>{setSolicitadoPor("");setMotivo("")},[frete]);
 if(!frete)return null;
 const valid=solicitadoPor.trim().length>=2&&motivo.trim().length>=3;
 return <Dialog.Root open onOpenChange={v=>!v&&close()}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[70] bg-black/35"/><Dialog.Content className="fixed left-1/2 top-1/2 z-[70] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-2xl"><header className="flex items-start justify-between border-b p-5"><div><Dialog.Title className="font-semibold">Cancelar Frete</Dialog.Title><Dialog.Description className="mt-1 text-xs text-[#748078]">O frete permanecerá disponível no histórico</Dialog.Description></div><button onClick={close}><X size={19}/></button></header><div className="space-y-4 p-5"><label><span className="label">Solicitado por</span><input className="field" value={solicitadoPor} onChange={e=>setSolicitadoPor(e.target.value)}/></label><label><span className="label">Motivo do cancelamento</span><textarea className="field" rows={4} value={motivo} onChange={e=>setMotivo(e.target.value)}/></label><div className="flex gap-3 pt-2"><button onClick={close} className="flex-1 rounded-xl border py-3 text-sm font-semibold">Cancelar</button><button disabled={!valid} onClick={()=>confirm(solicitadoPor.trim(),motivo.trim())} className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white disabled:opacity-40">Confirmar Cancelamento</button></div></div></Dialog.Content></Dialog.Portal></Dialog.Root>
}
