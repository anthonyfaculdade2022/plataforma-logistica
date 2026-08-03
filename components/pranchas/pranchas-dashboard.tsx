"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { toPng } from "html-to-image";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Bell,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleGauge,
  Clock3,
  Copy,
  Download,
  FileText,
  Filter,
  GripVertical,
  LayoutDashboard,
  MapPin,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Route,
  Search,
  Send,
  Tractor,
  Truck,
  Trash2,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import {
  agendamentoSchema,
  AgendamentoInput,
  deslocamentoSchema,
  DeslocamentoInput,
  equipamentoSchema,
  EquipamentoInput,
  manutencaoSchema,
  ManutencaoInput,
} from "@/features/pranchas/schemas";
import {
  Equipamento,
  EquipeTransporte,
  EtapaFrete,
  Frete,
  Frota,
  getEquipeTransporte,
  Manutencao,
  Status,
} from "@/features/pranchas/types";
import {
  FROTAS_FIXAS,
  getFrotaConfig,
} from "@/features/pranchas/frotas-config";
import { FinalizeFreteModal } from "./finalize-frete-modal";
import { MaintenanceTrackingModal } from "./maintenance-tracking-modal";
import { PreOsModal } from "./pre-os-modal";
import { EditFreteModal } from "./edit-frete-modal";
import { CancelFreteModal } from "./cancel-frete-modal";
import { FreightHistoryTable, MaintenanceHistoryTable } from "./history-tables";
import { AccountMenu, AuthUser } from "@/components/auth/account-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import type { PranchasState } from "@/features/pranchas/persistence";

const statuses: Status[] = ["Pendente", "Em Frete", "Concluído", "Cancelado"];
const priorityStyle = {
  Alta: "bg-red-50 text-red-700",
  Média: "bg-amber-50 text-amber-700",
  Baixa: "bg-slate-100 text-slate-600",
};
const statusStyle: Record<Status, string> = {
  Pendente: "bg-amber-50 text-amber-700 border-amber-200",
  "Em Frete": "bg-blue-50 text-blue-700 border-blue-200",
  Concluído: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Cancelado: "bg-red-50 text-red-700 border-red-200",
};
const nowParts = () => {
  const n = new Date();
  return {
    date: n.toLocaleDateString("pt-BR"),
    time: n.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    iso: n.toISOString().slice(0, 10),
  };
};
const operationKey = (value = new Date()) => {
  const d = new Date(value);
  if (d.getHours() < 7) d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
};
const operationLabel = (key: string) =>
  `Operação ${key.slice(6, 8)}/${key.slice(4, 6)}/${key.slice(0, 4)}`;
const equipmentText = (f: Frete) =>
  [f.equipamentoTipo, f.equipamentoCodigo].filter(Boolean).join(" ").trim();
const freightText = (f: Frete) => {
  const equipment = equipmentText(f);
  if (!equipment) return `Frete de ${f.origem} para ${f.destino}.`;
  const feminine =
    /^(Pá Carregadeira|Colhedora|Escavadeira|Motoniveladora|Plantadora)/i.test(
      equipment,
    );
  return `Frete ${feminine ? "da" : "do"} ${equipment} da ${f.origem} para ${f.destino}.`;
};
const withObservation = (f: Frete) =>
  `${freightText(f)}${f.observacao.trim() ? ` | ${f.observacao.trim()}` : ""}`;
type HistoryPeriod =
  | "Todos"
  | "Hoje"
  | "Ontem"
  | "Últimos 7 dias"
  | "Últimos 30 dias"
  | "Personalizado";
const ptDate = (value: string) => {
  const [d, m, y] = value.split("/").map(Number);
  return new Date(y, m - 1, d);
};
const inPeriod = (
  value: string,
  period: HistoryPeriod,
  start: string,
  end: string,
) => {
  if (period === "Todos") return true;
  const date = ptDate(value),
    today = new Date();
  today.setHours(0, 0, 0, 0);
  if (period === "Hoje") return date.getTime() === today.getTime();
  if (period === "Ontem") {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return date.getTime() === yesterday.getTime();
  }
  if (period === "Personalizado") {
    const from = start ? new Date(start + "T00:00:00") : null,
      to = end ? new Date(end + "T23:59:59") : null;
    return (!from || date >= from) && (!to || date <= to);
  }
  const days = period === "Últimos 7 dias" ? 7 : 30,
    from = new Date(today);
  from.setDate(from.getDate() - (days - 1));
  return date >= from && date <= today;
};

export function PranchasDashboard({ user }: { user: AuthUser }) {
  const [fretes, setFretes] = useState<Frete[]>([]),
    [frotas, setFrotas] = useState<Frota[]>([]),
    [manutencoes, setManutencoes] = useState<Manutencao[]>([]),
    [equipamentos, setEquipamentos] = useState<Equipamento[]>([]),
    [dataReady, setDataReady] = useState(false),
    [persistenceError, setPersistenceError] = useState(""),
    [loadAttempt, setLoadAttempt] = useState(0);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    const controller = new AbortController();
    setDataReady(false);
    setPersistenceError("");
    fetch("/api/pranchas/state", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Falha ao carregar dados");
        return body as PranchasState;
      })
      .then((state) => {
        setFretes(state.fretes);
        setFrotas(state.frotas);
        setManutencoes(state.manutencoes);
        setEquipamentos(state.equipamentos);
        setDataReady(true);
      })
      .catch((error) => {
        if (error.name !== "AbortError")
          setPersistenceError(error.message || "Não foi possível carregar os dados persistidos.");
      });
    return () => controller.abort();
  }, [loadAttempt]);

  useEffect(() => {
    if (!dataReady) return;
    const snapshot: PranchasState = { fretes, frotas, manutencoes, equipamentos };
    const timer = window.setTimeout(() => {
      saveQueueRef.current = saveQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          const response = await fetch("/api/pranchas/state", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(snapshot),
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body.error || "Falha ao salvar dados");
          setPersistenceError("");
        })
        .catch((error) => {
          setPersistenceError(error.message || "Não foi possível salvar as alterações.");
        });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [dataReady, fretes, frotas, manutencoes, equipamentos]);
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState<Status | "Todos">("Todos"),
    [selected, setSelected] = useState<Frete | null>(null),
    [newOpen, setNewOpen] = useState(false),
    [equipmentOpen, setEquipmentOpen] = useState(false),
    [startFrete, setStartFrete] = useState<Frete | null>(null),
    [editFrete, setEditFrete] = useState<Frete | null>(null),
    [cancelFrete, setCancelFrete] = useState<Frete | null>(null),
    [completeFrete, setCompleteFrete] = useState<Frete | null>(null),
    [maintenanceOpen, setMaintenanceOpen] = useState(false),
    [maintenanceFrota, setMaintenanceFrota] = useState<string | null>(null),
    [preOsFrota, setPreOsFrota] = useState<Frota | null>(null),
    [flow, setFlow] = useState(""),
    [copied, setCopied] = useState(false),
    [mobile, setMobile] = useState(false),
    [whatsappOpen, setWhatsappOpen] = useState(false),
    [fleetOpen, setFleetOpen] = useState(false),
    [historyExpanded, setHistoryExpanded] = useState(false),
    [historyTab, setHistoryTab] = useState<"fretes" | "manutencao">("fretes");
  const flowRef = useRef<HTMLDivElement>(null);
  const filtered = useMemo(
    () =>
      fretes.filter(
        (f) =>
          (filter === "Todos" || f.status === filter) &&
          [
            f.frota,
            f.motorista,
            ...getEquipeTransporte(f).flatMap((item) => [
              item.frota,
              item.motorista,
            ]),
            f.origem,
            f.destino,
            f.setor,
            f.solicitante,
            f.equipamentoTipo,
            f.equipamentoCodigo,
          ]
            .join(" ")
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [fretes, filter, search],
  );
  const updateFrete = (id: string, patch: Partial<Frete>) =>
    setFretes((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const saveEdit = (data: Partial<Frete>) => {
    if (!editFrete) return;
    if (editFrete.status === "Concluído") {
      window.alert("Fretes concluídos não podem ser alterados.");
      setEditFrete(null);
      return;
    }
    const normalized = {
        ...data,
        frota: data.equipeTransporte?.[0]?.frota,
        motorista: data.equipeTransporte?.[0]?.motorista,
        equipamentoId: undefined,
        equipamentoCodigo: undefined,
      },
      n = nowParts(),
      fields = [
        "equipamentoTipo",
        "origem",
        "destino",
        "equipeTransporte",
        "solicitante",
        "responsavel",
        "setor",
        "observacao",
      ] as const,
      changes = fields
        .filter(
          (k) =>
            JSON.stringify(editFrete[k] || "") !==
            JSON.stringify(normalized[k] || ""),
        )
        .map((k) => ({
          alteradoEm: `${n.date} ${n.time}`,
          campo: k,
          valorAnterior: JSON.stringify(editFrete[k] || ""),
          novoValor: JSON.stringify(normalized[k] || ""),
        }));
    if (editFrete.status === "Em Frete") {
      const anteriores = new Set(
        getEquipeTransporte(editFrete).map((item) => item.frota),
      );
      const atuais = new Set(
        (normalized.equipeTransporte || []).map((item) => item.frota),
      );
      setFrotas((fs) =>
        fs.map((f) => {
          if (anteriores.has(f.numero) && !atuais.has(f.numero))
            return { ...f, status: "Disponível" };
          if (atuais.has(f.numero))
            return { ...f, status: "Em Frete", semMotorista: false };
          return f;
        }),
      );
    }
    updateFrete(editFrete.id, {
      ...normalized,
      historicoAlteracoes: [
        ...(editFrete.historicoAlteracoes || []),
        ...changes,
      ],
    });
    setEditFrete(null);
  };
  const confirmCancellation = (solicitadoPor: string, motivo: string) => {
    if (!cancelFrete) return;
    if (
      cancelFrete.status === "Concluído" ||
      cancelFrete.status === "Cancelado"
    ) {
      window.alert("Fretes concluídos não podem ser cancelados.");
      setCancelFrete(null);
      return;
    }
    const n = nowParts();
    updateFrete(cancelFrete.id, {
      status: "Cancelado",
      cancelamentoSolicitadoPor: solicitadoPor,
      motivoCancelamento: motivo,
      canceladoEm: `${n.date} ${n.time}`,
    });
    if (cancelFrete.status === "Em Frete") {
      const equipes = new Set(
        getEquipeTransporte(cancelFrete).map((item) => item.frota),
      );
      setFrotas((fs) =>
        fs.map((f) =>
          equipes.has(f.numero) ? { ...f, status: "Disponível" } : f,
        ),
      );
    }
    setSelected(null);
    setCancelFrete(null);
  };
  const start = (frete: Frete, d: DeslocamentoInput) => {
    const n = nowParts();
    updateFrete(frete.id, {
      equipeTransporte: d.equipeTransporte,
      frota: d.equipeTransporte[0].frota,
      motorista: d.equipeTransporte[0].motorista,
      status: "Em Frete",
      operacao: operationKey(),
      inicioDeslocamento: `${n.date} ${n.time}`,
      etapas: frete.etapas?.map((etapa, index) =>
        index === (frete.etapaAtual || 0)
          ? { ...etapa, inicio: `${n.date} ${n.time}` }
          : etapa,
      ),
    });
    const selecionadas = new Set(d.equipeTransporte.map((item) => item.frota));
    setFrotas((fs) =>
      fs.map((f) =>
        selecionadas.has(f.numero)
          ? { ...f, status: "Em Frete", semMotorista: false }
          : f,
      ),
    );
    setStartFrete(null);
    setSelected(null);
  };
  const advanceSequence = (frete: Frete) => {
    const current = frete.etapaAtual || 0;
    const next = frete.etapas?.[current + 1];
    if (!next) return false;
    const n = nowParts();
    updateFrete(frete.id, {
      origem: next.origem,
      destino: next.destino,
      observacao: next.observacao || "",
      etapaAtual: current + 1,
      inicioDeslocamento: `${n.date} ${n.time}`,
      etapas: frete.etapas?.map((etapa, index) =>
        index === current
          ? { ...etapa, conclusao: `${n.date} ${n.time}` }
          : index === current + 1
            ? { ...etapa, inicio: `${n.date} ${n.time}` }
            : etapa,
      ),
    });
    return true;
  };
  const complete = (frete: Frete, localDisponivel: string) => {
    const n = nowParts();
    updateFrete(frete.id, {
      status: "Concluído",
      operacao: operationKey(),
      conclusao: `${n.date} ${n.time}`,
      etapas: frete.etapas?.map((etapa, index) =>
        index === (frete.etapaAtual || 0)
          ? { ...etapa, conclusao: `${n.date} ${n.time}` }
          : etapa,
      ),
    });
    const equipes = new Set(
      getEquipeTransporte(frete).map((item) => item.frota),
    );
    if (equipes.size)
      setFrotas((fs) =>
        fs.map((f) =>
          equipes.has(f.numero)
            ? { ...f, status: "Disponível", localDisponivel }
            : f,
        ),
      );
    setCompleteFrete(null);
    setSelected(null);
  };
  const addMaintenance = (d: ManutencaoInput) => {
    const n = nowParts(),
      interrupted = fretes.find(
        (f) =>
          f.status === "Em Frete" &&
          getEquipeTransporte(f).some((item) => item.frota === d.frota),
      );
    const numeroOs =
      d.componente === "Ambos" && !d.mesmaOs
        ? `Cavalo: ${d.numeroOsCavalo} · Prancha: ${d.numeroOsPrancha}`
        : d.numeroOs || "";
    setManutencoes((ms) => [
      {
        id: `MN-${202 + ms.length}`,
        frota: d.frota,
        numeroOs,
        numeroOsCavalo: d.numeroOsCavalo,
        numeroOsPrancha: d.numeroOsPrancha,
        localizacao: d.localizacao,
        entradaData: new Date(d.entradaData + "T12:00").toLocaleDateString(
          "pt-BR",
        ),
        entradaHora: d.entradaHora,
        tipo: d.tipo,
        componente: d.componente,
        servico: d.servico,
        observacoes: d.observacoes,
        previsao: d.previsao === "sim",
        previsaoData: d.previsaoData
          ? new Date(d.previsaoData + "T12:00").toLocaleDateString("pt-BR")
          : undefined,
        previsaoHora: d.previsaoHora,
        responsavel: "Ana Ribeiro",
        status: "Em manutenção",
        freteId: interrupted?.id,
        freteResumo: interrupted ? freightText(interrupted) : undefined,
        preOsUtilizada: d.usarPreOs === "sim",
      },
      ...ms,
    ]);
    setFrotas((fs) =>
      fs.map((f) =>
        f.numero === d.frota
          ? { ...f, status: "Manutenção" }
          : d.transferir === "sim" && f.numero === d.novaFrota
            ? { ...f, status: "Em Frete", semMotorista: false }
            : f,
      ),
    );
    if (
      interrupted &&
      d.transferir === "sim" &&
      d.novaFrota &&
      d.novoMotorista
    ) {
      const equipeAtualizada = getEquipeTransporte(interrupted).map((item) =>
        item.frota === d.frota
          ? { frota: d.novaFrota!, motorista: d.novoMotorista! }
          : item,
      );
      updateFrete(interrupted.id, {
        frotaInicial: interrupted.frotaInicial || interrupted.frota,
        frotaAnterior: d.frota,
        frota: d.novaFrota,
        motorista: d.novoMotorista,
        equipeTransporte: equipeAtualizada,
        motivoTransferencia: `Manutenção da frota ${d.frota}: ${d.servico}`,
        transferidoEm: `${n.date} ${n.time}`,
      });
    }
    setMaintenanceOpen(false);
    setMaintenanceFrota(null);
  };
  const finishMaintenance = (m: Manutencao) => {
    const n = nowParts();
    setManutencoes((ms) =>
      ms.map((x) =>
        x.id === m.id
          ? { ...x, status: "Finalizada", saidaData: n.date, saidaHora: n.time }
          : x,
      ),
    );
    setFrotas((fs) =>
      fs.map((f) =>
        f.numero === m.frota
          ? {
              ...f,
              status: "Disponível",
              ...(m.preOsUtilizada
                ? {
                    possuiPreOs: false,
                    numeroPreOs: undefined,
                    servicoPreOs: undefined,
                  }
                : {}),
            }
          : f,
      ),
    );
  };
  const generate = () => {
    const pending = fretes.filter((f) => f.status === "Pendente");
    const maintenance = manutencoes.filter((m) => m.status === "Em manutenção");
    const maintenanceFleetNumbers = new Set(maintenance.map((m) => m.frota));
    const fleetSituation = FROTAS_FIXAS.filter(
      (config) => !maintenanceFleetNumbers.has(config.numero),
    ).map((config) => {
      const movingFreight = fretes.find(
        (f) =>
          f.status === "Em Frete" &&
          getEquipeTransporte(f).some((item) => item.frota === config.numero),
      );
      const fleet = frotas.find((f) => f.numero === config.numero);
      const preOs = fleet?.possuiPreOs
        ? ` | ⚠️ Pré-OS: ${fleet.numeroPreOs} - ${fleet.servicoPreOs}`
        : "";
      if (movingFreight)
        return `*${config.numero}* - ${withObservation(movingFreight)}${preOs}`;
      return `*${config.numero}* - Disponível${fleet?.localDisponivel ? ` ${fleet.localDisponivel}` : ""}${preOs}`;
    });
    const orderedMaintenance = [...maintenance].sort(
      (a, b) =>
        FROTAS_FIXAS.findIndex((f) => f.numero === a.frota) -
        FROTAS_FIXAS.findIndex((f) => f.numero === b.frota),
    );
    setFlow(
      `🚛 *SITUAÇÃO DAS PRANCHAS*\n\n${fleetSituation.join("\n\n")}\n\n================================\n\n▶️ *FRETES PENDENTES*\n\n${pending.length ? pending.map((f) => `* ${withObservation(f)}`).join("\n\n") : "Nenhum frete pendente."}\n\n================================\n\n🔧 *PRANCHAS EM MANUTENÇÃO*\n\n${orderedMaintenance.length ? orderedMaintenance.map((m) => (m.freteResumo ? `*${m.frota}* - ${m.freteResumo.replace(/\.$/, "")} interrompido. Localização: ${m.localizacao}. OS: ${m.numeroOs}. ${m.servico}. ${m.previsao ? `Previsão: ${m.previsaoData?.slice(0, 5)} às ${m.previsaoHora}.` : "Sem previsão."}` : `*${m.frota}* - ${m.servico} | OS: ${m.numeroOs} | Local: ${m.localizacao} | ${m.previsao ? `Previsão: ${m.previsaoData?.slice(0, 5)} às ${m.previsaoHora}.` : "Sem previsão."}`)).join("\n\n") : "Nenhuma prancha em manutenção."}`,
    );
  };
  useEffect(() => {
    if (flow) generate();
    // Atualiza somente um fluxo que já tenha sido gerado pelo operador.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frotas, fretes, manutencoes]);
  const copy = async () => {
      await navigator.clipboard.writeText(flow);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    },
    download = async () => {
      if (!flowRef.current) return;
      const data = await toPng(flowRef.current, {
        backgroundColor: "#fff",
        pixelRatio: 2,
      });
      const a = document.createElement("a");
      a.download = "programacao-pranchas.png";
      a.href = data;
      a.click();
    },
    send = () =>
      window.open(`https://wa.me/?text=${encodeURIComponent(flow)}`, "_blank");
  if (!dataReady) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f5f7f5] p-6">
        <div className="panel w-full max-w-md p-6 text-center">
          <CircleGauge size={24} className="mx-auto text-[#557062]" />
          <h1 className="mt-4 text-base font-semibold text-[#2d342f]">
            {persistenceError ? "Dados indisponíveis" : "Carregando operação"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#6d7771]">
            {persistenceError || "Buscando os registros persistidos da plataforma."}
          </p>
          {persistenceError && (
            <button
              type="button"
              onClick={() => setLoadAttempt((attempt) => attempt + 1)}
              className="primary-action mt-5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
            >
              Tentar novamente
            </button>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-[#f5f7f5] lg:flex">
      <Sidebar mobile={mobile} close={() => setMobile(false)} user={user} onEquipment={() => setEquipmentOpen(true)} onMaintenance={() => { setMaintenanceFrota(null); setMaintenanceOpen(true); }} onFleet={() => setFleetOpen(true)} onWhatsapp={() => setWhatsappOpen(true)} />
      <main className="min-w-0 flex-1 lg:ml-[238px]">
        <MobileHeader open={() => setMobile(true)} />
        <div className="mx-auto max-w-[1920px] p-4 sm:p-6 lg:px-7 lg:py-6">
          {persistenceError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {persistenceError} As alterações permanecerão na tela, mas precisam ser salvas antes de sair.
            </div>
          )}
          <Header
            search={search}
            setSearch={setSearch}
            filter={filter}
            setFilter={setFilter}
            onNew={() => setNewOpen(true)}
            onEquipment={() => setEquipmentOpen(true)}
            onMaintenance={() => { setMaintenanceFrota(null); setMaintenanceOpen(true); }}
          />
          <Indicators fretes={fretes} manutencoes={manutencoes} />
          <div className="mt-6 grid gap-5">
            <div className="min-w-0 space-y-4">
              <div className="hidden">
                <button onClick={() => setFleetOpen(true)} className="workspace-action"><Truck size={15} /> Pranchas</button>
                <button onClick={() => setWhatsappOpen(true)} className="workspace-action"><MessageCircle size={15} /> Gerar Programação</button>
              </div>
              <Kanban
                fretes={filtered}
                frotas={frotas}
                manutencoes={manutencoes}
                onFrete={setSelected}
                onEdit={setEditFrete}
                onCancel={setCancelFrete}
                onFinishMaintenance={finishMaintenance}
              />
              <section className="panel overflow-hidden">
                <div className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="text-sm font-semibold">Últimas movimentações</h2>
                    <p className="mt-1 text-xs text-[#7a867f]">O histórico completo fica disponível quando necessário.</p>
                  </div>
                  <button className="workspace-action" onClick={() => setHistoryExpanded((value) => !value)}>
                    {historyExpanded ? "Recolher histórico" : "Ver histórico completo"}
                  </button>
                </div>
              {historyExpanded && <HistoryTabs
                tab={historyTab}
                setTab={setHistoryTab}
                fretes={filtered}
                onFrete={setSelected}
                manutencoes={manutencoes}
                filter={filter}
                setFilter={setFilter}
              />}
              </section>
            </div>
            <aside className="hidden">
              <Whatsapp
                flow={flow}
                flowRef={flowRef}
                generate={generate}
                copy={copy}
                download={download}
                send={send}
                copied={copied}
              />
              <FleetStatus
                frotas={frotas}
                onPreOs={setPreOsFrota}
                onNoDriver={(numero) =>
                  setFrotas((items) =>
                    items.map((item) =>
                      item.numero === numero
                        ? {
                            ...item,
                            status: "Disponível",
                            semMotorista: true,
                          }
                        : item,
                    ),
                  )
                }
                onMaintenance={(frota) => {
                  setMaintenanceFrota(frota.numero);
                  setMaintenanceOpen(true);
                }}
                onLocation={(numero, localDisponivel) =>
                  setFrotas((items) =>
                    items.map((item) =>
                      item.numero === numero
                        ? { ...item, localDisponivel }
                        : item,
                    ),
                  )
                }
              />
            </aside>
          </div>
        </div>
      </main>
      <Drawer open={whatsappOpen} close={() => setWhatsappOpen(false)} title="Programação WhatsApp">
        <div className="p-5">
          <Whatsapp flow={flow} flowRef={flowRef} generate={generate} copy={copy} download={download} send={send} copied={copied} />
        </div>
      </Drawer>
      <Drawer open={fleetOpen} close={() => setFleetOpen(false)} title="Status das Pranchas">
        <div className="p-5">
          <FleetStatus
            frotas={frotas}
            onPreOs={setPreOsFrota}
            onNoDriver={(numero) => setFrotas((items) => items.map((item) => item.numero === numero ? { ...item, status: "Disponível", semMotorista: true } : item))}
            onMaintenance={(frota) => { setFleetOpen(false); setMaintenanceFrota(frota.numero); setMaintenanceOpen(true); }}
            onLocation={(numero, localDisponivel) => setFrotas((items) => items.map((item) => item.numero === numero ? { ...item, localDisponivel } : item))}
          />
        </div>
      </Drawer>
      <FreteDrawer
        frete={selected}
        close={() => setSelected(null)}
        start={() => {
          setStartFrete(selected);
          setSelected(null);
        }}
        complete={() => {
          if (selected && advanceSequence(selected)) {
            setSelected(null);
            return;
          }
          setCompleteFrete(selected);
          setSelected(null);
        }}
      />
      <FinalizeFreteModal
        frete={completeFrete}
        close={() => setCompleteFrete(null)}
        confirm={complete}
      />
      <NewFrete
        open={newOpen}
        close={() => setNewOpen(false)}
        equipamentos={equipamentos}
        add={(f) => setFretes((fs) => [f, ...fs])}
      />
      <EquipmentModal
        open={equipmentOpen}
        close={() => setEquipmentOpen(false)}
        equipamentos={equipamentos}
        add={(e) => setEquipamentos((es) => [e, ...es])}
      />
      <StartModal
        frete={startFrete}
        close={() => setStartFrete(null)}
        frotas={frotas}
        confirm={start}
      />
      <CancelFreteModal
        frete={cancelFrete}
        close={() => setCancelFrete(null)}
        confirm={confirmCancellation}
      />
      <EditFreteModal
        frete={editFrete}
        frotas={frotas}
        equipamentos={equipamentos}
        close={() => setEditFrete(null)}
        save={saveEdit}
      />
      <PreOsModal
        frota={preOsFrota}
        close={() => setPreOsFrota(null)}
        save={(numero, servico) => {
          setFrotas((fs) =>
            fs.map((f) =>
              f.numero === preOsFrota?.numero
                ? {
                    ...f,
                    possuiPreOs: true,
                    numeroPreOs: numero,
                    servicoPreOs: servico,
                  }
                : f,
            ),
          );
          setPreOsFrota(null);
        }}
      />
      <MaintenanceTrackingModal
        open={maintenanceOpen}
        close={() => {
          setMaintenanceOpen(false);
          setMaintenanceFrota(null);
        }}
        frotas={frotas}
        fretes={fretes}
        initialFrota={maintenanceFrota}
        save={addMaintenance}
      />
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#d6f269] text-[#183527]">
        <Truck size={19} />
      </div>
      <div>
        <div className="font-semibold text-white">Plataforma</div>
        <div className="text-xs text-white/45">Logística integrada</div>
      </div>
    </div>
  );
}
function Sidebar({
  mobile,
  close,
  user,
  onEquipment,
  onMaintenance,
  onFleet,
  onWhatsapp,
}: {
  mobile: boolean;
  close: () => void;
  user: AuthUser;
  onEquipment: () => void;
  onMaintenance: () => void;
  onFleet: () => void;
  onWhatsapp: () => void;
}) {
  return (
    <>
      <div
        onClick={close}
        className={`fixed inset-0 z-30 bg-black/30 lg:hidden ${mobile ? "block" : "hidden"}`}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[238px] flex-col bg-[#17231d] p-5 text-white transition-transform lg:translate-x-0 ${mobile ? "translate-x-0" : "-translate-x-full"}`}
      >
        <Brand />
        <nav className="mt-10 space-y-1.5">
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/55">
            <LayoutDashboard size={18} />
            Dashboard
          </button>
          <button className="flex w-full items-center gap-3 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-medium">
            <Truck size={18} />
            Pranchas
            <span className="ml-auto h-2 w-2 rounded-full bg-[#d6f269]" />
          </button>
          <button onClick={onEquipment} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/55 hover:bg-white/5 hover:text-white">
            <Tractor size={18} /> Equipamentos
          </button>
          <button onClick={onMaintenance} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/55 hover:bg-white/5 hover:text-white">
            <Wrench size={18} /> Manutenção
          </button>
          <button onClick={onFleet} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/55 hover:bg-white/5 hover:text-white">
            <CircleGauge size={18} /> Status das Pranchas
          </button>
          <button onClick={onWhatsapp} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/55 hover:bg-white/5 hover:text-white">
            <MessageCircle size={18} /> Programação
          </button>
        </nav>
        <div className="mt-auto space-y-2.5">
          <ThemeToggle />
          <AccountMenu user={user} />
        </div>
      </aside>
    </>
  );
}
function MobileHeader({ open }: { open: () => void }) {
  return (
    <div className="flex h-16 items-center justify-between border-b bg-white px-5 lg:hidden">
      <button onClick={open}>
        <Menu />
      </button>
      <span className="font-semibold">Plataforma Logística</span>
      <Bell size={20} />
    </div>
  );
}
function Header({
  search,
  setSearch,
  filter,
  setFilter,
  onNew,
  onEquipment,
  onMaintenance,
}: {
  search: string;
  setSearch: (v: string) => void;
  filter: string;
  setFilter: (v: Status | "Todos") => void;
  onNew: () => void;
  onEquipment: () => void;
  onMaintenance: () => void;
}) {
  const [lastUpdated, setLastUpdated] = useState(
    new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  );
  useEffect(() => {
    const interval = window.setInterval(
      () =>
        setLastUpdated(
          new Date().toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        ),
      60000,
    );
    return () => window.clearInterval(interval);
  }, []);
  const todayLabel = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date());
  return (
    <>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="header-copy">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[.15em] text-[#688071]">
            Operação de transporte
          </div>
          <h1 className="text-2xl font-semibold tracking-[-.03em] sm:text-3xl">
            Gestão de Pranchas
          </h1>
          <p className="mt-1 text-sm text-[#6a776f]">
            Solicitação, deslocamento e manutenção em uma única visão.
          </p>
        </div>
        <div className="header-actions flex flex-wrap gap-2">
          <button
            onClick={onEquipment}
            className="flex h-10 items-center gap-2 rounded-xl border border-[#d9e0db] bg-white px-3.5 text-sm font-medium shadow-sm hover:-translate-y-0.5 hover:border-[#cdd5d0] hover:bg-[#fafbfa]"
          >
            <Tractor size={16} />
            Equipamentos
          </button>
          <button
            onClick={onMaintenance}
            className="flex h-10 items-center gap-2 rounded-xl border border-[#d9e0db] bg-white px-3.5 text-sm font-medium shadow-sm hover:-translate-y-0.5 hover:border-[#cdd5d0] hover:bg-[#fafbfa]"
          >
            <Wrench size={16} />
            Manutenção
          </button>
          <button
            onClick={onNew}
            className="primary-action flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white shadow-sm hover:-translate-y-0.5 hover:shadow-md"
          >
            <Plus size={16} />
            Novo Frete
          </button>
        </div>
      </div>
      <div className="operational-strip mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-[#e5e9e6] bg-white px-3 py-2 text-[11px] text-[#68736c] shadow-[0_1px_2px_rgba(18,24,21,.02)]">
        <span className="font-semibold text-[#343a36]">
          {operationLabel(operationKey())}
        </span>
        <span>07:00 → 06:59</span>
        <span className="inline-flex items-center gap-1.5">
          <i className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,.1)]" />
          Sistema Online
        </span>
        <span className="sm:ml-auto">Última atualização: {lastUpdated}</span>
      </div>
      <div className="panel mt-3 flex flex-col gap-2.5 p-2.5 md:flex-row md:items-center">
        <div className="flex items-center gap-2 border-b px-2 py-1.5 text-sm font-medium md:border-b-0 md:border-r md:py-0 md:pr-4">
          <CalendarDays size={17} />
          <span>{todayLabel}</span>
        </div>
        <label className="search-control flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 transition-shadow focus-within:ring-2 focus-within:ring-[#5f7669]/20">
          <Search size={17} className="text-[#7d8982]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full bg-transparent text-sm outline-none"
            placeholder="Pesquisar frota, equipamento ou motorista..."
          />
        </label>
        <div className="relative">
          <Filter
            className="pointer-events-none absolute left-3 top-2.5 text-[#7d8982]"
            size={15}
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Status | "Todos")}
            aria-label="Filtrar por status"
            className="h-9 min-w-[116px] appearance-none rounded-lg border bg-white pl-9 pr-8 text-xs font-medium"
          >
            <option value="Todos">Status: Todos</option>
            {statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2 top-3"
            size={13}
          />
        </div>
      </div>
    </>
  );
}

function Indicators({
  fretes,
  manutencoes,
}: {
  fretes: Frete[];
  manutencoes: Manutencao[];
}) {
  const current = operationKey();
  const items = [
    {
      label: "Pendentes",
      value: fretes.filter((f) => f.status === "Pendente").length,
      icon: Clock3,
      bg: "bg-amber-50",
      c: "text-amber-600",
    },
    {
      label: "Em Frete",
      value: fretes.filter((f) => f.status === "Em Frete").length,
      icon: Route,
      bg: "bg-blue-50",
      c: "text-blue-600",
    },
    {
      label: "Concluídos",
      value: fretes.filter(
        (f) => f.status === "Concluído" && f.operacao === current,
      ).length,
      icon: CheckCircle2,
      bg: "bg-emerald-50",
      c: "text-emerald-600",
    },
    {
      label: "Em Manutenção",
      value: manutencoes.filter((m) => m.status === "Em manutenção").length,
      icon: Wrench,
      bg: "bg-orange-50",
      c: "text-orange-600",
    },
  ];
  return (
    <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((x) => (
        <div
          className="panel flex min-h-[86px] items-center justify-center gap-3 p-3.5 text-center sm:px-4"
          key={x.label}
        >
          <div
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${x.bg} ${x.c}`}
          >
            <x.icon size={17} />
          </div>
          <div>
            <p className="text-3xl font-semibold leading-none tracking-[-.05em] tabular-nums">
              {String(x.value).padStart(2, "0")}
            </p>
            <p className="mt-1.5 text-[10px] font-medium uppercase tracking-[.05em] text-[#758078]">
              {x.label}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
function Kanban({
  fretes,
  frotas,
  manutencoes,
  onFrete,
  onEdit,
  onCancel,
  onFinishMaintenance,
}: {
  fretes: Frete[];
  frotas: Frota[];
  manutencoes: Manutencao[];
  onFrete: (f: Frete) => void;
  onEdit: (f: Frete) => void;
  onCancel: (f: Frete) => void;
  onFinishMaintenance: (m: Manutencao) => void;
}) {
  const [currentOperation, setCurrentOperation] = useState(operationKey());
  useEffect(() => {
    const id = window.setInterval(
      () => setCurrentOperation(operationKey()),
      60000,
    );
    return () => window.clearInterval(id);
  }, []);
  const active = fretes.filter(
    (f) => f.status !== "Concluído" || f.operacao === currentOperation,
  );
  return (
    <section>
      <div className="hidden">
        <div>
          <h2 className="font-semibold">Operação atual</h2>
          <p className="mt-1 text-xs text-[#7a867f]">
            07:00 às 06:59 do dia seguinte · Pendências e fretes permanecem
            ativos
          </p>
        </div>
        <span className="w-fit rounded-lg border border-[#e5e8e6] bg-white px-3 py-1.5 text-xs font-medium text-[#59625d]">
          {operationLabel(currentOperation)}
        </span>
      </div>
      <div className="grid items-start gap-5 md:grid-cols-2 2xl:grid-cols-4">
        <FreteColumn
          status="Pendente"
          fretes={active.filter((f) => f.status === "Pendente")}
          frotas={frotas}
          onClick={onFrete}
          onEdit={onEdit}
          onCancel={onCancel}
        />
        <FreteColumn
          status="Em Frete"
          fretes={active.filter((f) => f.status === "Em Frete")}
          frotas={frotas}
          onClick={onFrete}
          onEdit={onEdit}
          onCancel={onCancel}
        />
        <FreteColumn
          status="Concluído"
          fretes={active.filter((f) => f.status === "Concluído")}
          frotas={frotas}
          onClick={onFrete}
          onEdit={onEdit}
          onCancel={onCancel}
        />
        <MaintenanceColumn
          items={manutencoes.filter((m) => m.status === "Em manutenção")}
          finish={onFinishMaintenance}
        />
      </div>
    </section>
  );
}
function ColumnShell({
  title,
  count,
  dot,
  children,
}: {
  title: string;
  count: number;
  dot: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 self-start">
      <div className="mb-3 flex min-h-9 items-center gap-2 border-b border-[#e7ebe8] px-1 pb-2.5">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <h3 className="text-sm font-semibold tracking-[-.01em] text-[#2d332f]">
          {title}
        </h3>
        <span className="text-[11px] font-medium tabular-nums text-[#8a938e]">
          ({count})
        </span>
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}
function FreteColumn({
  status,
  fretes,
  frotas,
  onClick,
  onEdit,
  onCancel,
}: {
  status: Status;
  fretes: Frete[];
  frotas: Frota[];
  onClick: (f: Frete) => void;
  onEdit: (f: Frete) => void;
  onCancel: (f: Frete) => void;
}) {
  const dot =
      status === "Pendente"
        ? "bg-amber-400"
        : status === "Em Frete"
          ? "bg-blue-500"
          : "bg-emerald-500",
    line =
      status === "Pendente"
        ? "before:bg-amber-400"
        : status === "Em Frete"
          ? "before:bg-blue-500"
          : "before:bg-emerald-500";
  return (
    <ColumnShell title={status} count={fretes.length} dot={dot}>
      {fretes.map((f) => {
        const team = getEquipeTransporte(f);
        const fleet = (
          team[0]
            ? frotas.find((x) => x.numero === team[0].frota) ||
              getFrotaConfig(team[0].frota)
            : undefined
        ) as Frota | undefined;
        return (
          <button
            key={f.id}
            onClick={() => onClick(f)}
            className={`group relative w-full overflow-hidden rounded-xl border border-[#e8ece9] bg-white p-3 text-left shadow-[0_1px_2px_rgba(18,24,21,.022)] before:absolute before:inset-y-0 before:left-0 before:w-[3px] ${line} transition-[transform,border-color,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:border-[#d7ddd9] hover:shadow-[0_8px_20px_rgba(18,24,21,.06)]`}
          >
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold leading-5 text-[#262b28]">
                <MapPin size={14} className="shrink-0 text-[#727b76]" />
                <span className="truncate">
                  {f.origem} <span className="text-[#a0a7a3]">→</span>{" "}
                  {f.destino}
                </span>
              </div>
              <span
                className={`inline-flex shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-medium leading-4 ${priorityStyle[f.prioridade]}`}
              >
                {f.prioridade === "Alta"
                  ? "● Alta"
                  : f.prioridade === "Média"
                    ? "● Média"
                    : "● Baixa"}
              </span>
            </div>
            {f.fluxoOperacao === "sequencia" && f.etapas?.length && (
              <p className="mt-1.5 pl-5 text-[10px] font-medium text-blue-600">
                Etapa {(f.etapaAtual || 0) + 1} de {f.etapas.length}
              </p>
            )}
            <div className="mt-2 space-y-1.5 text-xs text-[#68716c]">
              {f.equipamentoTipo && (
                <span className="flex min-h-4 items-center gap-1.5 text-[12px] font-semibold text-[#3b433e]">
                  <Tractor size={14} className="shrink-0 text-[#67716b]" />
                  {f.equipamentoTipo} {f.equipamentoCodigo}
                </span>
              )}
              <span className="flex min-h-4 items-center gap-1.5">
                <Clock3 size={13} className="shrink-0" />
                {f.horario}
              </span>
              {f.status === "Pendente" && (
                <div className="space-y-1.5 pt-0.5 text-[11px] text-[#737c77]">
                  {f.setor && (
                    <span className="flex min-h-4 items-center gap-1.5">
                      <Building2 size={13} className="shrink-0" />
                      <span className="truncate">{f.setor}</span>
                    </span>
                  )}
                  {f.solicitante && (
                    <span className="flex min-h-4 items-center gap-1.5">
                      <UserRound size={13} className="shrink-0" />
                      <span className="truncate">{f.solicitante}</span>
                    </span>
                  )}
                </div>
              )}
              {f.status !== "Pendente" && (
                <div className="space-y-2 pt-0.5">
                  {team.length > 1 && (
                    <span className="flex min-h-4 items-center gap-1.5 text-[11px] font-medium text-[#4f5953]">
                      <Truck size={13} className="shrink-0" />
                      {team.length} Pranchas
                    </span>
                  )}
                  {team.slice(0, team.length === 1 ? 1 : 2).map((member) => {
                    const memberFleet =
                      frotas.find((item) => item.numero === member.frota) ||
                      getFrotaConfig(member.frota);
                    return (
                      <div
                        key={member.frota}
                        className="space-y-1.5"
                      >
                        <span className="flex min-h-4 min-w-0 items-center gap-1.5">
                          <Truck size={13} className="shrink-0" />
                          <span className="truncate">
                            Frota {member.frota} · Prancha {memberFleet?.prancha || "—"}
                          </span>
                        </span>
                        <span className="flex min-h-4 min-w-0 items-center gap-1.5">
                          <UserRound size={13} className="shrink-0" />
                          <span className="truncate">{member.motorista}</span>
                        </span>
                      </div>
                    );
                  })}
                  {team.length > 2 && (
                    <span className="block pl-[19px] text-[10px] font-medium text-[#7d8781]">
                      +{team.length - 2} prancha{team.length - 2 > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              )}
              {fleet?.possuiPreOs && (
                <span className="flex min-h-5 items-center gap-1.5 text-[10px] font-medium text-amber-700">
                  ⚠ Pré-OS: {fleet.numeroPreOs}
                </span>
              )}
            </div>
            {f.status !== "Concluído" && (
              <div className="mt-2 flex items-center justify-end gap-1 border-t border-[#edf0ee] pt-2">
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(f);
                  }}
                  className="inline-flex items-center justify-center gap-1 rounded-md border border-transparent px-1.5 py-0.5 text-[9px] font-medium text-[#59645d] transition-colors hover:border-[#e2e7e4] hover:bg-[#f1f4f2]"
                >
                  <Pencil size={11} />
                  Editar
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancel(f);
                  }}
                  className="inline-flex items-center justify-center gap-1 rounded-md border border-transparent px-1.5 py-0.5 text-[9px] font-medium text-red-600 transition-colors hover:border-red-100 hover:bg-red-50"
                >
                  <X size={11} />
                  Cancelar
                </span>
              </div>
            )}
          </button>
        );
      })}
      {!fretes.length && (
        <div className="rounded-xl border border-dashed border-[#e5e8e6] p-4 text-center text-xs text-[#969e99]">
          Sem fretes nesta etapa
        </div>
      )}
    </ColumnShell>
  );
}
function MaintenanceColumn({
  items,
  finish,
}: {
  items: Manutencao[];
  finish: (m: Manutencao) => void;
}) {
  return (
    <ColumnShell title="Manutenção" count={items.length} dot="bg-orange-500">
      {items.map((m) => (
        <div
          key={m.id}
          className="flex min-h-[196px] flex-col rounded-xl border border-[#f0e8dd] bg-[#fffcf8] p-3 shadow-[0_1px_2px_rgba(45,34,20,.025)] transition-[transform,border-color,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:border-[#e8dac8] hover:shadow-[0_8px_20px_rgba(45,34,20,.055)]"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="flex min-h-5 items-center gap-1.5 font-semibold">
              <Truck size={14} className="shrink-0" />
              Frota {m.frota}
            </p>
            <span className="text-[10px] font-medium text-[#7c756d]">
              OS: {m.numeroOs}
            </span>
          </div>
          <div className="mt-2 flex-1 space-y-2.5 text-xs text-[#68756d]">
            <p
              className={`flex items-center gap-1.5 text-[10px] font-medium ${
                m.preOsUtilizada
                  ? "text-amber-700"
                  : m.tipo === "Preventiva"
                    ? "text-emerald-700"
                    : "text-orange-700"
              }`}
            >
              <i
                className={`h-1.5 w-1.5 rounded-full ${
                  m.preOsUtilizada
                    ? "bg-amber-400"
                    : m.tipo === "Preventiva"
                      ? "bg-emerald-500"
                      : "bg-orange-500"
                }`}
              />
              {m.preOsUtilizada ? "Pré-OS" : m.tipo}
            </p>
            {m.freteId && (
              <p className="rounded-lg bg-orange-50 p-2 text-orange-800">
                Frete interrompido: {m.freteId}
              </p>
            )}
            <div>
              <p className="text-[9px] font-medium uppercase tracking-[.08em] text-[#9a938b]">
                Local
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 font-medium text-[#4c5650]">
                <MapPin size={12} className="shrink-0 text-[#858e88]" />
                {m.localizacao}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-medium uppercase tracking-[.08em] text-[#9a938b]">
                Serviço
              </p>
              <p className="mt-0.5 leading-4 text-[#4f5953]">{m.servico}</p>
            </div>
            <div>
              <p className="text-[9px] font-medium uppercase tracking-[.08em] text-[#9a938b]">
                Previsão
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 font-medium text-[#4c5650]">
                <Clock3 size={12} className="shrink-0 text-[#858e88]" />
                {m.previsao
                  ? `${m.previsaoData?.slice(0, 5)} • ${m.previsaoHora}`
                  : "Sem previsão"}
              </p>
            </div>
          </div>
          <button
            onClick={() => finish(m)}
            className="mt-3 w-full rounded-lg bg-[#174e37] py-2 text-[10px] font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#1f6247] hover:shadow-sm"
          >
            Finalizar Manutenção
          </button>
        </div>
      ))}
      {!items.length && (
        <div className="rounded-xl border border-dashed border-[#e5e8e6] p-4 text-center text-xs text-[#969e99]">
          Nenhuma manutenção no momento
        </div>
      )}
    </ColumnShell>
  );
}

const fc = createColumnHelper<Frete>(),
  mc = createColumnHelper<Manutencao>();
function HistoryTabs({
  tab,
  setTab,
  fretes,
  onFrete,
  manutencoes,
  filter,
  setFilter,
}: {
  tab: "fretes" | "manutencao";
  setTab: (v: "fretes" | "manutencao") => void;
  fretes: Frete[];
  onFrete: (f: Frete) => void;
  manutencoes: Manutencao[];
  filter: string;
  setFilter: (v: Status | "Todos") => void;
}) {
  return (
    <section className="panel overflow-hidden">
      <div className="flex border-b px-5 pt-4">
        <button
          onClick={() => setTab("fretes")}
          className={`border-b-2 px-3 py-3 text-sm font-semibold ${tab === "fretes" ? "border-[#174e37] text-[#174e37]" : "border-transparent text-[#78847d]"}`}
        >
          Histórico de Fretes
        </button>
        <button
          onClick={() => setTab("manutencao")}
          className={`border-b-2 px-3 py-3 text-sm font-semibold ${tab === "manutencao" ? "border-[#174e37] text-[#174e37]" : "border-transparent text-[#78847d]"}`}
        >
          Histórico de Manutenção
        </button>
      </div>
      {tab === "fretes" ? (
        <FreightHistoryTable
          fretes={fretes}
          filter={filter}
          setFilter={setFilter}
          onFrete={onFrete}
        />
      ) : (
        <MaintenanceHistoryTable items={manutencoes} />
      )}
    </section>
  );
}
function FreightHistory({
  fretes,
  filter,
  setFilter,
  onFrete,
}: {
  fretes: Frete[];
  filter: string;
  setFilter: (v: Status | "Todos") => void;
  onFrete: (f: Frete) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const columns = [
    fc.display({
      id: "dh",
      header: "Data/Hora",
      cell: (i) => (
        <div className="whitespace-nowrap">
          <p className="text-sm font-medium text-[#343b37]">
            {i.row.original.data.slice(0, 5)}
          </p>
          <p className="mt-1 text-[11px] text-[#8a938e]">
            {i.row.original.horario}
          </p>
        </div>
      ),
    }),
    fc.accessor("status", {
      header: "Status",
      cell: (i) => (
        <span
          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-1 text-[10px] font-medium ${statusStyle[i.getValue()]}`}
        >
          <i className="h-1.5 w-1.5 rounded-full bg-current opacity-75" />
          {i.getValue()}
        </span>
      ),
    }),
    fc.display({
      id: "equipamento",
      header: "Equipamento",
      cell: (i) =>
        i.row.original.equipamentoTipo ? (
          <div>
            <p className="whitespace-nowrap text-sm font-medium text-[#303733]">
              {i.row.original.equipamentoTipo}
            </p>
            <p className="mt-1 text-[11px] text-[#89928d]">
              {i.row.original.equipamentoCodigo}
            </p>
          </div>
        ) : (
          <span className="text-[#a0a7a3]">—</span>
        ),
    }),
    fc.accessor("frota", {
      header: "Frota",
      cell: (i) => (
        <span className="flex items-center gap-1.5 whitespace-nowrap text-sm">
          <Truck size={14} className="text-[#7d8781]" />
          {i.getValue() || "—"}
        </span>
      ),
    }),
    fc.accessor("motorista", {
      header: "Motorista",
      cell: (i) => (
        <span
          title={i.getValue() || "—"}
          className="block overflow-hidden text-ellipsis whitespace-nowrap text-sm text-[#505954]"
        >
          {i.getValue() || "—"}
        </span>
      ),
    }),
    fc.accessor("origem", {
      header: "Origem",
      cell: (i) => (
        <span className="block break-words text-sm font-medium leading-5 text-[#3b433e]">
          {i.getValue()}
        </span>
      ),
    }),
    fc.accessor("destino", {
      header: "Destino",
      cell: (i) => (
        <span className="block break-words text-sm leading-5 text-[#505954]">
          {i.getValue()}
        </span>
      ),
    }),
    fc.accessor("setor", {
      header: "Setor",
      cell: (i) => (
        <span
          title={i.getValue()}
          className="block overflow-hidden text-ellipsis whitespace-nowrap text-sm text-[#505954]"
        >
          {i.getValue()}
        </span>
      ),
    }),
    fc.accessor("solicitante", {
      header: "Solicitante",
      cell: (i) => (
        <span
          title={i.getValue()}
          className="block overflow-hidden text-ellipsis whitespace-nowrap text-sm text-[#505954]"
        >
          {i.getValue()}
        </span>
      ),
    }),
    fc.accessor("responsavel", {
      header: "Resp. Logística",
      cell: (i) => (
        <span
          title={i.getValue()}
          className="block overflow-hidden text-ellipsis whitespace-nowrap text-sm text-[#505954]"
        >
          {i.getValue()}
        </span>
      ),
    }),
  ];
  const table = useReactTable({
    data: fretes,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  const chip = (s: string) =>
      s === "Pendente"
        ? "border-amber-200 text-amber-700"
        : s === "Em Frete"
          ? "border-blue-200 text-blue-700"
          : s === "Concluído"
            ? "border-emerald-200 text-emerald-700"
            : "border-[#dfe4e1] text-[#66716a]",
    active = (s: string) =>
      s === "Pendente"
        ? "border-amber-600 bg-amber-600"
        : s === "Em Frete"
          ? "border-blue-600 bg-blue-600"
          : s === "Concluído"
            ? "border-emerald-600 bg-emerald-600"
            : "border-[#174e37] bg-[#174e37]";
  return (
    <div
      className={
        expanded
          ? "fixed inset-3 z-50 overflow-auto rounded-2xl border border-[#e3e7e4] bg-white shadow-2xl"
          : ""
      }
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-[#edf0ee] bg-white px-5 py-3">
        {["Todos", ...statuses].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s as Status | "Todos")}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all duration-200 ${filter === s ? `${active(s)} text-white shadow-sm` : `bg-white ${chip(s)} hover:bg-[#fafbfa]`}`}
          >
            {s !== "Todos" && (
              <i className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
            )}
            {s === "Cancelado" ? "Cancelados" : s}
          </button>
        ))}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="ml-auto rounded-lg border border-[#dfe4e1] bg-white px-3 py-1.5 text-[11px] font-medium text-[#566159] transition-colors hover:bg-[#f6f8f6]"
        >
          {expanded ? "⤢ Recolher" : "⛶ Expandir"}
        </button>
      </div>
      <DataTable
        table={table}
        onRowClick={(row) => onFrete(row.original as Frete)}
        modern
        expanded={expanded}
      />
    </div>
  );
}
function duration(m: Manutencao) {
  if (!m.saidaData || !m.saidaHora) return "Em andamento";
  const parse = (d: string, t: string) => {
    const [day, mo, y] = d.split("/").map(Number),
      [h, min] = t.split(":").map(Number);
    return new Date(y, mo - 1, day, h, min).getTime();
  };
  const mins = Math.max(
    0,
    Math.floor(
      (parse(m.saidaData, m.saidaHora) - parse(m.entradaData, m.entradaHora)) /
        60000,
    ),
  );
  return `${Math.floor(mins / 60)}h ${mins % 60}min`;
}
function MaintenanceHistory({ items }: { items: Manutencao[] }) {
  const [f, setF] = useState<"Todas" | "Em manutenção" | "Finalizadas">(
    "Todas",
  );
  const data = items.filter(
    (m) =>
      f === "Todas" ||
      (f === "Em manutenção"
        ? m.status === "Em manutenção"
        : m.status === "Finalizada"),
  );
  const columns = [
    mc.accessor("frota", { header: "Frota" }),
    mc.accessor("numeroOs", { header: "OS" }),
    mc.accessor("localizacao", { header: "Local" }),
    mc.accessor("freteId", {
      header: "Frete interrompido",
      cell: (i) => i.getValue() || "—",
    }),
    mc.accessor("entradaData", { header: "Data entrada" }),
    mc.accessor("entradaHora", { header: "Hora entrada" }),
    mc.accessor("saidaData", {
      header: "Data saída",
      cell: (i) => i.getValue() || "—",
    }),
    mc.accessor("saidaHora", {
      header: "Hora saída",
      cell: (i) => i.getValue() || "—",
    }),
    mc.display({
      id: "tempo",
      header: "Tempo",
      cell: (i) => duration(i.row.original),
    }),
    mc.accessor("tipo", { header: "Tipo" }),
    mc.accessor("servico", { header: "Serviço realizado" }),
    mc.accessor("responsavel", { header: "Responsável" }),
    mc.accessor("observacoes", { header: "Observações" }),
  ];
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  return (
    <>
      <div className="flex gap-1 p-4">
        {(["Todas", "Em manutenção", "Finalizadas"] as const).map((x) => (
          <button
            onClick={() => setF(x)}
            key={x}
            className={`rounded-lg px-3 py-1.5 text-xs ${f === x ? "bg-[#174e37] text-white" : "bg-[#f4f6f4]"}`}
          >
            {x}
          </button>
        ))}
      </div>
      <DataTable table={table} />
    </>
  );
}
function DataTable({
  table,
  onRowClick,
  modern = false,
  expanded = false,
}: {
  table: ReturnType<typeof useReactTable<any>>;
  onRowClick?: (row: any) => void;
  modern?: boolean;
  expanded?: boolean;
}) {
  const widths: Record<string, string> = {
    dh: "7%",
    status: "9%",
    equipamento: "16%",
    frota: "6%",
    motorista: "13%",
    origem: "10%",
    destino: "10%",
    setor: "8%",
    solicitante: "11%",
    responsavel: "10%",
  };
  return (
    <div
      className={
        modern ? "overflow-hidden bg-[#f8faf8] p-2 sm:p-3" : "overflow-x-auto"
      }
    >
      <table
        className={`w-full text-left text-sm ${modern ? (expanded ? "min-w-[1400px] table-fixed" : "table-fixed") : "min-w-[1100px]"}`}
      >
        <thead
          className={
            modern
              ? "bg-white text-[9px] uppercase tracking-[.08em] text-[#89928d]"
              : "bg-[#fafbfa] text-[10px] uppercase tracking-[.06em] text-[#7f8883]"
          }
        >
          {table.getHeaderGroups().map((g) => (
            <tr key={g.id}>
              {g.headers.map((h) => (
                <th
                  className={
                    modern
                      ? `${!expanded && ["setor", "solicitante", "responsavel"].includes(h.column.id) ? "hidden" : ""} px-3 py-2.5 font-medium whitespace-nowrap`
                      : "px-5 py-4"
                  }
                  style={modern ? { width: widths[h.column.id] } : undefined}
                  key={h.id}
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className={modern ? "before:block before:h-2" : ""}>
          {table.getRowModel().rows.map((r) => (
            <tr
              onClick={() => onRowClick?.(r)}
              className={
                modern
                  ? "group border-b-4 border-[#f8faf8] bg-white shadow-[0_1px_2px_rgba(17,24,20,.025)] transition-all duration-200 hover:-translate-y-px hover:bg-[#fbfcfb] hover:shadow-[0_5px_14px_rgba(17,24,20,.055)] cursor-pointer"
                  : "border-t border-[#eef0ef] transition-colors duration-200 hover:bg-[#fafbfa]"
              }
              key={r.id}
            >
              {r.getVisibleCells().map((c) => (
                <td
                  className={
                    modern
                      ? `${!expanded && ["setor", "solicitante", "responsavel"].includes(c.column.id) ? "hidden" : ""} px-3 py-5 align-middle first:rounded-l-lg last:rounded-r-lg`
                      : "px-5 py-5 align-middle"
                  }
                  style={modern ? { width: widths[c.column.id] } : undefined}
                  key={c.id}
                >
                  {flexRender(c.column.columnDef.cell, c.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Whatsapp({
  flow,
  flowRef,
  generate,
  copy,
  download,
  send,
  copied,
}: {
  flow: string;
  flowRef: React.RefObject<HTMLDivElement | null>;
  generate: () => void;
  copy: () => void;
  download: () => void;
  send: () => void;
  copied: boolean;
}) {
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);
  const handleGenerate = () => {
    generate();
    setLastGenerated(
      new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date()),
    );
  };
  return (
    <section className="panel p-4">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
          <MessageCircle size={17} />
        </div>
        <div>
          <h2 className="font-semibold">Fluxo WhatsApp</h2>
          <p className="text-xs text-[#7c8780]">
            Gerado automaticamente pelos cadastros
          </p>
        </div>
      </div>
      <button
        onClick={handleGenerate}
        className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#174e37] py-2 text-sm font-semibold text-white shadow-sm hover:-translate-y-0.5 hover:shadow-md"
      >
        <Send size={16} />
        Gerar Programação
      </button>
      <p className="mt-2 text-center text-[10px] text-[#8a938e]">
        {lastGenerated
          ? `Última geração: ${lastGenerated.replace(",", " às")}`
          : "Programação ainda não gerada"}
      </p>
      {flow && (
        <>
          <div
            ref={flowRef}
            aria-readonly
            className="mt-3 max-h-[280px] overflow-y-auto whitespace-pre-wrap rounded-xl border bg-[#f8faf8] p-3 text-[11px] leading-5"
          >
            {flow}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={copy}
              className="rounded-lg border py-2 text-xs font-semibold"
            >
              {copied ? (
                <Check size={14} className="inline" />
              ) : (
                <Copy size={14} className="inline" />
              )}{" "}
              {copied ? "Copiado" : "Copiar Texto"}
            </button>
            <button
              onClick={download}
              className="rounded-lg border py-2 text-xs font-semibold"
            >
              <Download size={14} className="inline" /> Baixar como Imagem
            </button>
            <button
              onClick={send}
              className="col-span-2 rounded-lg bg-[#21a461] py-2.5 text-xs font-semibold text-white"
            >
              Compartilhar via WhatsApp
            </button>
          </div>
        </>
      )}
    </section>
  );
}
function FleetStatus({
  frotas,
  onPreOs,
  onLocation,
  onNoDriver,
  onMaintenance,
}: {
  frotas: Frota[];
  onPreOs: (f: Frota) => void;
  onLocation: (numero: string, location: string) => void;
  onNoDriver: (numero: string) => void;
  onMaintenance: (f: Frota) => void;
}) {
  const [query, setQuery] = useState("");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [editingLocation, setEditingLocation] = useState<string | null>(null);
  const activeMenuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const closeMenuOnOutsideClick = (event: PointerEvent) => {
      if (
        activeMenuRef.current &&
        !activeMenuRef.current.contains(event.target as Node)
      ) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("pointerdown", closeMenuOnOutsideClick);
    return () =>
      document.removeEventListener("pointerdown", closeMenuOnOutsideClick);
  }, []);
  const colors = {
    Disponível: "bg-emerald-500",
    "Em Frete": "bg-blue-500",
    Manutenção: "bg-orange-500",
  };
  const filtered = frotas.filter((f) =>
    `${f.numero} ${f.prancha} ${f.status} ${f.localDisponivel || ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <section className="panel p-4">
      <div className="mb-3 flex items-center gap-2.5">
        <CircleGauge size={16} className="text-[#69726d]" />
        <div>
          <h2 className="text-sm font-medium">Status das Pranchas</h2>
          <p className="mt-0.5 text-[11px] text-[#8a938e]">
            Visão rápida das 7 frotas
          </p>
        </div>
      </div>
      <label className="mb-2 flex items-center gap-2 rounded-lg border border-[#e6e9e7] bg-[#fafbfa] px-2.5 py-1.5">
        <Search size={14} className="text-[#8b948f]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-transparent text-xs outline-none"
          placeholder="Pesquisar frota..."
        />
      </label>
      <div className="divide-y divide-[#edf0ee]">
        {filtered.map((f) => (
          <div
            className={`group relative px-1 py-3 transition-colors duration-200 first:pt-2 last:pb-1 hover:bg-[#fafbfa] ${openMenu === f.numero ? "z-30" : "z-0"}`}
            key={f.numero}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold tabular-nums text-[#303632]">
                {f.numero}
                <span className="mx-2 font-normal text-[#c0c6c2]">|</span>
                <span className="font-medium text-[#69736d]">{f.prancha}</span>
              </p>
              <div className="flex items-center gap-1">
                {f.tipo && (
                  <span className="rounded-md bg-[#f1f3f2] px-1.5 py-0.5 text-[9px] font-medium text-[#747d78]">
                    Bitola Aberta
                  </span>
                )}
                <div
                  className="relative"
                  ref={openMenu === f.numero ? activeMenuRef : undefined}
                >
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpenMenu((current) =>
                        current === f.numero ? null : f.numero,
                      );
                    }}
                    aria-label={`Ações da frota ${f.numero}`}
                    className="grid h-6 w-6 place-items-center rounded-md text-[#7d8781] hover:bg-[#eef1ef] hover:text-[#343a36]"
                  >
                    <MoreHorizontal size={15} />
                  </button>
                  {openMenu === f.numero && (
                    <div
                      className="absolute right-0 top-7 z-50 w-44 rounded-xl border border-[#e0e5e2] bg-white p-1.5 shadow-[0_12px_30px_rgba(18,24,21,.14)]"
                      onPointerDown={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenu(null);
                          onPreOs(f);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#59635d] hover:bg-[#f4f6f4]"
                      >
                        <Wrench size={13} />
                        {f.possuiPreOs ? "Editar Pré-OS" : "Adicionar Pré-OS"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenu(null);
                          setEditingLocation(f.numero);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#59635d] hover:bg-[#f4f6f4]"
                      >
                        <MapPin size={13} /> Editar Localização
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenu(null);
                          onNoDriver(f.numero);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#59635d] hover:bg-[#f4f6f4]"
                      >
                        <UserRound size={13} /> Sem Motorista
                      </button>
                      <button
                        type="button"
                        disabled={f.status === "Manutenção"}
                        onClick={() => {
                          setOpenMenu(null);
                          onMaintenance(f);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#59635d] hover:bg-[#f4f6f4] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Wrench size={13} /> Colocar em Manutenção
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-[#58635c]">
              <i
                className={`h-2 w-2 shrink-0 rounded-full ${
                  f.status === "Disponível" && f.semMotorista
                    ? "bg-amber-400"
                    : colors[f.status]
                }`}
              />
              {f.status}
              {f.semMotorista && (
                <span className="font-normal text-[#7a837e]">
                  • Sem motorista
                </span>
              )}
            </div>
            {editingLocation === f.numero ? (
              <label className="mt-1.5 flex min-w-0 items-center gap-1.5">
                <MapPin size={12} className="shrink-0 text-[#808a84]" />
                <span className="sr-only">Localização da frota {f.numero}</span>
                <input
                  autoFocus
                  key={`location-${f.numero}`}
                  value={f.localDisponivel || ""}
                  onChange={(event) => onLocation(f.numero, event.target.value)}
                  onBlur={() => setEditingLocation(null)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") setEditingLocation(null);
                  }}
                  className="h-7 w-full min-w-0 rounded-md border border-[#dde3df] bg-white px-2 text-[11px] text-[#5f6963] outline-none focus:border-[#aab5ae]"
                  placeholder="Informar localização"
                />
              </label>
            ) : (
              <p className="mt-1.5 flex min-h-5 items-center gap-1.5 text-[11px] text-[#68726c]">
                <MapPin size={12} className="shrink-0 text-[#808a84]" />
                <span className="truncate">
                  {f.localDisponivel || "Localização não informada"}
                </span>
              </p>
            )}
            {f.possuiPreOs && (
              <button
                type="button"
                onClick={() => onPreOs(f)}
                title={`Pré-OS ${f.numeroPreOs}`}
                className="mt-1 inline-flex items-center gap-1.5 text-[10px] font-medium text-[#7b847f] hover:text-[#174e37]"
              >
                <Wrench size={11} /> Pré-OS Ativa
              </button>
            )}
          </div>
        ))}
        {!filtered.length && (
          <p className="py-5 text-center text-xs text-[#929a95]">
            Nenhuma frota encontrada
          </p>
        )}
      </div>
    </section>
  );
}

function Modal({
  open,
  close,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  close: () => void;
  title: string;
  description: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#101914]/40" />
        <Dialog.Content
          className={`fadein fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white shadow-2xl outline-none ${wide ? "max-w-2xl" : "max-w-md"}`}
        >
          <div className="flex justify-between border-b p-5">
            <div>
              <Dialog.Title className="font-semibold">{title}</Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-[#78847d]">
                {description}
              </Dialog.Description>
            </div>
            <Dialog.Close>
              <X size={18} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
function Drawer({
  open,
  close,
  title,
  children,
}: {
  open: boolean;
  close: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#101914]/35" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 w-full max-w-[510px] overflow-y-auto bg-white shadow-2xl outline-none">
          <div className="sticky top-0 z-10 flex justify-between border-b bg-white p-5">
            <Dialog.Title className="font-semibold">{title}</Dialog.Title>
            <Dialog.Close>
              <X size={18} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
function FreteDrawer({
  frete,
  close,
  start,
  complete,
}: {
  frete: Frete | null;
  close: () => void;
  start: () => void;
  complete: () => void;
}) {
  if (!frete) return null;
  const team = getEquipeTransporte(frete);
  const statusLine =
    frete.status === "Pendente"
      ? "border-l-amber-400"
      : frete.status === "Em Frete"
        ? "border-l-blue-500"
        : frete.status === "Concluído"
          ? "border-l-emerald-500"
          : "border-l-red-500";
  return (
    <Drawer
      open
      close={close}
      title={
        <div className="flex items-center gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#849088]">
              {frete.id}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-[#29302b]">
              Detalhes do Frete
            </p>
          </div>
          <span
            className={`rounded-md px-2 py-1 text-[10px] font-medium ${priorityStyle[frete.prioridade]}`}
          >
            {frete.prioridade === "Alta" ? "● Alta" : frete.prioridade === "Média" ? "● Média" : "● Baixa"}
          </span>
        </div>
      }
    >
      <div className="flex min-h-[calc(100vh-70px)] flex-col">
        <div className="flex-1 p-6">
          <div className={`rounded-xl border border-[#e5e9e6] border-l-[3px] ${statusLine} bg-white p-5 shadow-[0_1px_2px_rgba(18,24,21,.025)]`}>
            <div className="flex items-start justify-between gap-3">
              <p className="flex min-w-0 items-center gap-2 text-[15px] font-semibold leading-5 text-[#2f3632]">
                <MapPin size={16} className="shrink-0 text-[#727c76]" />
                <span>{frete.origem} → {frete.destino}</span>
              </p>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${statusStyle[frete.status]}`}>
                {frete.status}
              </span>
            </div>
            {frete.equipamentoTipo && (
              <p className="mt-3 flex items-center gap-2 text-sm font-medium text-[#4c5650]">
                <Tractor size={15} className="text-[#727c76]" />
                {frete.equipamentoTipo} {frete.equipamentoCodigo}
              </p>
            )}
            <p className="mt-2.5 flex items-center gap-2 text-sm text-[#68736c]">
              <Truck size={15} className="text-[#727c76]" />
              {team.length === 0
                ? "Frota / Prancha ainda não definida"
                : team.length === 1
                  ? `${team[0].frota} / ${getFrotaConfig(team[0].frota)?.prancha || "—"}`
                  : `${team.length} conjuntos vinculados`}
            </p>
          </div>
        {!!team.length && (
          <section className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-[.08em] text-[#768179]">
              Equipe de Transporte
            </h3>
            <div className="mt-2.5 overflow-hidden rounded-lg border border-[#e7ebe8]">
              <div className="grid grid-cols-[.9fr_1.1fr] bg-[#f8f9f8] px-3 py-2 text-[9px] font-semibold uppercase tracking-[.08em] text-[#89938d]">
                <span>Frota / Prancha</span>
                <span>Motorista</span>
              </div>
              <div className="divide-y divide-[#edf0ee]">
              {team.map((member) => {
                const config = getFrotaConfig(member.frota);
                return (
                  <div
                    key={member.frota}
                    className="grid grid-cols-[.9fr_1.1fr] items-center gap-3 px-3 py-2.5"
                  >
                    <span className="text-sm font-medium">
                      {member.frota} / {config?.prancha || "—"}
                    </span>
                    <span className="truncate text-sm text-[#68736c]">
                      {member.motorista}
                    </span>
                  </div>
                );
              })}
              </div>
            </div>
          </section>
        )}
          <section className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-[.08em] text-[#768179]">Operação</h3>
            <div className="mt-2.5 grid grid-cols-3 gap-3 border-t border-[#edf0ee] pt-3.5">
              {[
                ["Solicitado", `${frete.data} · ${frete.horario}`],
                ["Iniciado", frete.inicioDeslocamento || "—"],
                ["Concluído", frete.conclusao || "—"],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-[10px] uppercase tracking-wide text-[#89948d]">{label}</p>
                  <p className="mt-1 text-xs font-medium leading-5 text-[#3c443f]">{value}</p>
                </div>
              ))}
            </div>
          </section>

          {frete.fluxoOperacao === "sequencia" && frete.etapas?.length && (
            <section className="mt-5">
              <h3 className="text-xs font-semibold uppercase tracking-[.08em] text-[#768179]">
                Sequência do Frete
              </h3>
              <div className="mt-2.5 space-y-1 border-l border-[#dfe5e1] pl-4">
                {frete.etapas.map((etapa, index) => {
                  const active = index === (frete.etapaAtual || 0);
                  const completed = index < (frete.etapaAtual || 0) || Boolean(etapa.conclusao);
                  return (
                    <div key={etapa.id} className="relative py-2">
                      <i className={`absolute -left-[21px] top-3.5 h-2.5 w-2.5 rounded-full border-2 border-white ${completed ? "bg-emerald-500" : active ? "bg-blue-500" : "bg-[#cbd2ce]"}`} />
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-[10px] font-semibold uppercase tracking-wide ${active ? "text-blue-600" : "text-[#89938d]"}`}>
                          Etapa {index + 1}
                        </p>
                        <span className="text-[9px] text-[#9aa29d]">
                          {completed ? "Concluída" : active ? "Atual" : "Aguardando"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-[#414944]">
                        {etapa.origem} → {etapa.destino}
                      </p>
                      {etapa.observacao && (
                        <p className="mt-1 text-xs text-[#737d77]">{etapa.observacao}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-[.08em] text-[#768179]">Responsáveis</h3>
            <div className="mt-2.5 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-[#edf0ee] pt-3.5">
              {[
                ["Setor", frete.setor],
                ["Solicitante", frete.solicitante],
                ["Resp. Logística", frete.responsavel],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-[10px] uppercase tracking-wide text-[#89948d]">{label}</p>
                  <p className="mt-1 text-sm font-medium text-[#3c443f]">{value}</p>
                </div>
              ))}
            </div>
          </section>
        {frete.status === "Cancelado" && (
          <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-800">
            <p className="font-semibold">Frete cancelado</p>
            <p className="mt-2 text-xs">
              <b>Solicitado por:</b> {frete.cancelamentoSolicitadoPor}
            </p>
            <p className="mt-1 text-xs">
              <b>Motivo:</b> {frete.motivoCancelamento}
            </p>
            <p className="mt-1 text-xs">
              <b>Data/Hora:</b> {frete.canceladoEm}
            </p>
          </div>
        )}
        {frete.observacao && (
          <section className="mt-5 border-t border-[#edf0ee] pt-4">
            <h3 className="text-[10px] font-medium uppercase tracking-wide text-[#89948d]">Observação</h3>
            <p className="mt-1.5 text-sm font-medium leading-6 text-[#49524d]">{frete.observacao}</p>
          </section>
        )}
        </div>
        {(frete.status === "Pendente" || frete.status === "Em Frete") && (
          <footer className="sticky bottom-0 border-t border-[#e9ecea] bg-white px-6 py-4">
          {frete.status === "Pendente" && (
          <button
            onClick={start}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-500 hover:shadow-md"
          >
            <Play size={17} />
            Iniciar Deslocamento
          </button>
        )}
        {frete.status === "Em Frete" && (
          <button
            onClick={complete}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#174e37] py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#1f6247] hover:shadow-md"
          >
            <CheckCircle2 size={17} />
            Finalizar Frete
          </button>
        )}
          </footer>
        )}
      </div>
    </Drawer>
  );
}
function NewFrete({
  open,
  close,
  equipamentos: _,
  add,
}: {
  open: boolean;
  close: () => void;
  equipamentos: Equipamento[];
  add: (f: Frete) => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AgendamentoInput>({
    resolver: zodResolver(agendamentoSchema),
    defaultValues: { prioridade: "Média", observacao: "" },
  });
  const newStage = (): EtapaFrete => ({
    id: `ET-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    origem: "",
    destino: "",
    observacao: "",
  });
  const [flowType, setFlowType] = useState<"unico" | "sequencia">("unico");
  const [stages, setStages] = useState<EtapaFrete[]>([newStage(), newStage()]);
  const [stageError, setStageError] = useState("");
  const [draggedStage, setDraggedStage] = useState<number | null>(null);
  const syncFirstStage = (items: EtapaFrete[]) => {
    const first = items[0];
    setValue("origem", first?.origem || "", { shouldValidate: false });
    setValue("destino", first?.destino || "", { shouldValidate: false });
    setValue("observacao", first?.observacao || "", { shouldValidate: false });
  };
  const updateStage = (
    index: number,
    field: "origem" | "destino" | "observacao",
    value: string,
  ) => {
    setStages((items) => {
      const next = items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      );
      if (index === 0) syncFirstStage(next);
      return next;
    });
    setStageError("");
  };
  const moveStage = (from: number, to: number) => {
    if (from === to || to < 0 || to >= stages.length) return;
    setStages((items) => {
      const next = [...items];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      syncFirstStage(next);
      return next;
    });
  };
  const submit = (d: AgendamentoInput) => {
    if (
      flowType === "sequencia" &&
      (stages.length < 2 || stages.some((stage) => !stage.origem.trim() || !stage.destino.trim()))
    ) {
      setStageError("Informe origem e destino em pelo menos duas etapas.");
      return;
    }
    const sequence = flowType === "sequencia" ? stages : undefined;
    add({
      ...d,
      origem: sequence?.[0].origem || d.origem,
      destino: sequence?.[0].destino || d.destino,
      observacao: sequence?.[0].observacao || d.observacao,
      id: `FR-${1060 + Math.floor(Math.random() * 90)}`,
      operacao: operationKey(),
      data: new Date(d.data + "T12:00").toLocaleDateString("pt-BR"),
      status: "Pendente",
      fluxoOperacao: flowType,
      etapas: sequence,
      etapaAtual: sequence ? 0 : undefined,
    });
    reset();
    setFlowType("unico");
    setStages([newStage(), newStage()]);
    setStageError("");
    close();
  };
  const prioridade = watch("prioridade");
  const locations = [
    "Aralco",
    "Generalco",
    "Oficina",
    "Oficina Aralco",
    "Oficina Generalco",
    "Frente 83",
    "Frente 87",
    "Frente 96",
    "Frente 97",
    "Pátio",
  ];
  return (
    <Dialog.Root open={open} onOpenChange={(value) => !value && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="freight-modal-overlay fixed inset-0 z-50 bg-[#111713]/45 backdrop-blur-[1px]" />
        <Dialog.Content className="freight-modal fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[calc(100%-2rem)] max-w-[860px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[#e7ebe8] bg-white shadow-[0_24px_80px_rgba(16,24,19,.18)] outline-none">
          <form
            onSubmit={handleSubmit(submit)}
            className="new-freight-form flex min-h-0 flex-1 flex-col"
          >
            <header className="flex shrink-0 items-start justify-between border-b border-[#e9ecea] px-6 py-4">
              <div>
                <Dialog.Title className="text-base font-semibold tracking-[-.02em] text-[#242a26]">
                  Novo Frete
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-xs text-[#7b857f]">
                  Preencha os dados da solicitação de transporte.
                </Dialog.Description>
              </div>
              <Dialog.Close
                type="button"
                aria-label="Fechar"
                className="grid h-8 w-8 place-items-center rounded-lg text-[#737d77] hover:bg-[#f1f3f2] hover:text-[#2d342f]"
              >
                <X size={17} />
              </Dialog.Close>
            </header>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <section>
                <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[.12em] text-[#77827b]">
                  Informações do frete
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="label">Equipamento</span>
                    <input
                      className="field"
                      placeholder="Ex.: Pá Carregadeira 41002"
                      {...register("equipamentoTipo")}
                    />
                  </label>
                  <label>
                    <span className="label">Data</span>
                    <input
                      type="date"
                      className="field"
                      {...register("data")}
                    />
                    {errors.data && (
                      <small className="text-red-600">
                        {errors.data.message}
                      </small>
                    )}
                  </label>
                  <label>
                    <span className="label">Horário</span>
                    <input
                      type="time"
                      className="field"
                      {...register("horario")}
                    />
                    {errors.horario && (
                      <small className="text-red-600">
                        {errors.horario.message}
                      </small>
                    )}
                  </label>
                  <fieldset>
                    <legend className="label">Prioridade</legend>
                    <input type="hidden" {...register("prioridade")} />
                    <div className="grid grid-cols-3 gap-2">
                      {(["Baixa", "Média", "Alta"] as const).map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() =>
                            setValue("prioridade", option, {
                              shouldValidate: true,
                            })
                          }
                          className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${prioridade === option ? "border-[#27342d] bg-[#27342d] text-white shadow-sm" : "border-[#e0e5e2] bg-white text-[#657069] hover:border-[#c9d1cc] hover:bg-[#fafbfa]"}`}
                        >
                          <span className="mr-1.5">
                            {prioridade === option ? "●" : "○"}
                          </span>
                          {option}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </div>
              </section>

              <section className="border-t border-[#edf0ee] pt-4">
                <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[.12em] text-[#77827b]">
                  Fluxo da Operação
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["unico", "Frete Único"],
                    ["sequencia", "Sequência de Fretes"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        const nextType = value as "unico" | "sequencia";
                        setFlowType(nextType);
                        if (nextType === "sequencia") syncFirstStage(stages);
                        setStageError("");
                      }}
                      className={`rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-all ${
                        flowType === value
                          ? "border-[#27342d] bg-[#27342d] text-white shadow-sm"
                          : "border-[#e0e5e2] bg-white text-[#657069] hover:border-[#c9d1cc] hover:bg-[#fafbfa]"
                      }`}
                    >
                      <span className="mr-2">{flowType === value ? "●" : "○"}</span>
                      {label}
                    </button>
                  ))}
                </div>

                {flowType === "sequencia" && (
                  <div className="mt-4 space-y-3">
                    <datalist id="locais-frete">
                      {locations.map((location) => (
                        <option value={location} key={location} />
                      ))}
                    </datalist>
                    {stages.map((stage, index) => (
                      <div
                        key={stage.id}
                        draggable
                        onDragStart={() => setDraggedStage(index)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => {
                          if (draggedStage !== null) moveStage(draggedStage, index);
                          setDraggedStage(null);
                        }}
                        onDragEnd={() => setDraggedStage(null)}
                        className={`rounded-xl border border-[#e3e8e5] bg-[#fafbfa] p-3.5 transition-opacity ${draggedStage === index ? "opacity-50" : "opacity-100"}`}
                      >
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="cursor-grab text-[#9aa39d] active:cursor-grabbing">
                              <GripVertical size={15} />
                            </span>
                            <h4 className="text-xs font-semibold text-[#414943]">Etapa {index + 1}</h4>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => moveStage(index, index - 1)}
                              className="grid h-7 w-7 place-items-center rounded-md text-xs text-[#758078] hover:bg-white disabled:opacity-30"
                              aria-label={`Mover etapa ${index + 1} para cima`}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              disabled={index === stages.length - 1}
                              onClick={() => moveStage(index, index + 1)}
                              className="grid h-7 w-7 place-items-center rounded-md text-xs text-[#758078] hover:bg-white disabled:opacity-30"
                              aria-label={`Mover etapa ${index + 1} para baixo`}
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              disabled={stages.length <= 2}
                              onClick={() => {
                                setStages((items) => {
                                  const next = items.filter((_, itemIndex) => itemIndex !== index);
                                  syncFirstStage(next);
                                  return next;
                                });
                              }}
                              className="grid h-7 w-7 place-items-center rounded-md text-red-500 hover:bg-red-50 disabled:opacity-30"
                              aria-label={`Remover etapa ${index + 1}`}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label>
                            <span className="label">Origem</span>
                            <input
                              list="locais-frete"
                              className="field"
                              value={stage.origem}
                              onChange={(event) => updateStage(index, "origem", event.target.value)}
                            />
                          </label>
                          <label>
                            <span className="label">Destino</span>
                            <input
                              list="locais-frete"
                              className="field"
                              value={stage.destino}
                              onChange={(event) => updateStage(index, "destino", event.target.value)}
                            />
                          </label>
                          <label className="sm:col-span-2">
                            <span className="label">Observação <span className="font-normal text-[#9aa29d]">(opcional)</span></span>
                            <input
                              className="field"
                              value={stage.observacao || ""}
                              onChange={(event) => updateStage(index, "observacao", event.target.value)}
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                    {stageError && <p className="text-xs text-red-600">{stageError}</p>}
                    <button
                      type="button"
                      onClick={() => setStages((items) => [...items, newStage()])}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[#ccd5cf] px-3 py-2 text-xs font-medium text-[#59645d] hover:border-[#aebbb3] hover:bg-[#fafbfa]"
                    >
                      <Plus size={13} /> Adicionar Etapa
                    </button>
                  </div>
                )}
              </section>

              <section className="border-t border-[#edf0ee] pt-4">
                <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[.12em] text-[#77827b]">
                  Responsáveis
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ["setor", "Setor Solicitante"],
                      ["solicitante", "Solicitante"],
                      ["responsavel", "Responsável da Logística"],
                    ] as const
                  ).map(([name, label], index) => (
                    <label key={name}>
                      <span className="label">{label}</span>
                      <input className="field" {...register(name)} />
                      {errors[name] && (
                        <small className="text-red-600">
                          {errors[name]?.message}
                        </small>
                      )}
                    </label>
                  ))}
                </div>
              </section>

              {flowType === "unico" && (
              <section className="border-t border-[#edf0ee] pt-4">
                <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[.12em] text-[#77827b]">
                  Operação
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ["origem", "Origem"],
                      ["destino", "Destino"],
                    ] as const
                  ).map(([name, label]) => (
                    <label key={name}>
                      <span className="label">{label}</span>
                      <input
                        list="locais-frete"
                        className="field"
                        autoComplete="off"
                        {...register(name)}
                      />
                      {errors[name] && (
                        <small className="text-red-600">
                          {errors[name]?.message}
                        </small>
                      )}
                    </label>
                  ))}
                  <datalist id="locais-frete">
                    {locations.map((location) => (
                      <option value={location} key={location} />
                    ))}
                  </datalist>
                  <label className="sm:col-span-2">
                    <span className="label">Observação</span>
                    <textarea
                      rows={3}
                      className="field min-h-[78px] resize-none overflow-hidden"
                      placeholder="Opcional"
                      onInput={(event) => {
                        event.currentTarget.style.height = "auto";
                        event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
                      }}
                      {...register("observacao")}
                    />
                  </label>
                </div>
              </section>
              )}
              <p className="text-center text-[11px] text-[#7c8880]">
                O frete será criado como Pendente, sem frota e motorista.
              </p>
            </div>
            <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-[#e9ecea] bg-white px-6 py-4">
              <button
                type="button"
                onClick={close}
                className="rounded-xl border border-[#dfe4e1] bg-white px-5 py-2.5 text-sm font-medium text-[#59635d] hover:bg-[#f7f8f7]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#174e37] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:-translate-y-0.5 hover:shadow-md"
              >
                Salvar Frete
              </button>
            </footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
function EquipmentModal({
  open,
  close,
  equipamentos,
  add,
}: {
  open: boolean;
  close: () => void;
  equipamentos: Equipamento[];
  add: (e: Equipamento) => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EquipamentoInput>({ resolver: zodResolver(equipamentoSchema) });
  const [custom, setCustom] = useState(false);
  const types = [
    "Pá Carregadeira",
    "Colhedora",
    "Trator",
    "Escavadeira",
    "Motoniveladora",
    "Transbordo",
    "Plantadora",
    "Pulverizador",
    "Caminhão",
    "Implemento",
    "Outro",
  ];
  const save = (d: EquipamentoInput) => {
    add({ ...d, id: `EQ-${Date.now()}` });
    reset();
  };
  return (
    <Modal
      open={open}
      close={close}
      title="Cadastro de Equipamentos"
      description="Catálogo pesquisável utilizado nos fretes"
      wide
    >
      <div className="p-5">
        <form
          onSubmit={handleSubmit(save)}
          className="grid gap-4 sm:grid-cols-2"
        >
          <label>
            <span className="label">Código do equipamento</span>
            <input
              className="field"
              placeholder="Ex.: 41002"
              {...register("codigo")}
            />
            {errors.codigo && (
              <small className="text-red-600">{errors.codigo.message}</small>
            )}
          </label>
          <label>
            <span className="label">Tipo do equipamento</span>
            {custom ? (
              <input
                className="field"
                placeholder="Novo tipo"
                {...register("tipo")}
              />
            ) : (
              <select
                className="field"
                {...register("tipo")}
                onChange={(e) => {
                  if (e.target.value === "Outro") setCustom(true);
                }}
              >
                <option value="">Selecione</option>
                {types.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            )}
          </label>
          <label className="sm:col-span-2">
            <span className="label">Descrição (opcional)</span>
            <input className="field" {...register("descricao")} />
          </label>
          <button className="rounded-xl bg-[#174e37] py-2.5 text-sm font-semibold text-white sm:col-span-2">
            <Plus size={16} className="inline" /> Adicionar Equipamento
          </button>
        </form>
        <div className="mt-6 max-h-64 overflow-y-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-[#f7f9f7] text-xs text-[#718078]">
              <tr>
                <th className="p-3">Código</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Descrição</th>
              </tr>
            </thead>
            <tbody>
              {equipamentos.map((e) => (
                <tr className="border-t" key={e.id}>
                  <td className="p-3 font-semibold">{e.codigo}</td>
                  <td className="p-3">{e.tipo}</td>
                  <td className="p-3 text-[#718078]">{e.descricao || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
function FleetCombobox({
  frotas,
  value,
  onChange,
}: {
  frotas: Frota[];
  value?: string;
  onChange: (v: string) => void;
}) {
  const [query, setQuery] = useState(""),
    [open, setOpen] = useState(false);
  const selected = frotas.find((f) => f.numero === value);
  const options = frotas.filter((f) =>
    `${f.numero} ${f.prancha} ${f.tipo || ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div>
      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-3.5 text-[#8a938e]"
        />
        <input
          className="field pl-9"
          value={
            open
              ? query
              : selected
                ? `Frota ${selected.numero} · Prancha ${selected.prancha}`
                : ""
          }
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          placeholder="Pesquisar frota ou prancha..."
        />
        {open && (
          <div className="absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-[#e2e6e3] bg-white p-1.5 shadow-xl">
            {options.map((f) => (
              <button
                type="button"
                disabled={f.status !== "Disponível"}
                onClick={() => {
                  onChange(f.numero);
                  setOpen(false);
                  setQuery("");
                }}
                className="flex w-full items-start justify-between rounded-lg px-3 py-3 text-left hover:bg-[#f7f9f7] disabled:cursor-not-allowed disabled:opacity-45"
                key={f.numero}
              >
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Truck size={15} />
                    Frota {f.numero}
                  </p>
                  <p className="mt-1 pl-[23px] text-xs text-[#727b76]">
                    Prancha {f.prancha}
                  </p>
                  {f.tipo && (
                    <p className="mt-1 flex items-center gap-2 pl-[23px] text-xs text-[#727b76]">
                      <Wrench size={13} />
                      {f.tipo}
                    </p>
                  )}
                </div>
                {f.status !== "Disponível" && (
                  <span className="text-[10px] text-[#89918c]">{f.status}</span>
                )}
              </button>
            ))}
            {!options.length && (
              <p className="p-4 text-center text-xs text-[#8b948f]">
                Nenhuma frota encontrada
              </p>
            )}
          </div>
        )}
      </div>
      {selected && (
        <div className="mt-3 rounded-xl border border-[#e8ebe9] bg-[#fafbfa] p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Truck size={15} />
            Frota {selected.numero}
          </p>
          <p className="mt-2 pl-[23px] text-xs text-[#68716c]">
            Prancha {selected.prancha}
          </p>
          {selected.tipo && (
            <p className="mt-2 flex items-center gap-2 pl-[23px] text-xs text-[#68716c]">
              <Wrench size={14} />
              {selected.tipo}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
function StartModal({
  frete,
  close,
  frotas,
  confirm,
}: {
  frete: Frete | null;
  close: () => void;
  frotas: Frota[];
  confirm: (f: Frete, d: DeslocamentoInput) => void;
}) {
  const [equipe, setEquipe] = useState<EquipeTransporte[]>([
    { frota: "", motorista: "" },
  ]);
  const [teamError, setTeamError] = useState("");
  useEffect(() => {
    if (frete) {
      const atual = getEquipeTransporte(frete);
      setEquipe(atual.length ? atual : [{ frota: "", motorista: "" }]);
      setTeamError("");
    }
  }, [frete]);
  if (!frete) return null;
  const updateMember = (
    index: number,
    field: keyof EquipeTransporte,
    value: string,
  ) =>
    setEquipe((items) =>
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  const submitTeam = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = deslocamentoSchema.safeParse({ equipeTransporte: equipe });
    if (!parsed.success) {
      setTeamError(parsed.error.issues[0]?.message || "Revise a equipe");
      return;
    }
    confirm(frete, parsed.data);
    setEquipe([{ frota: "", motorista: "" }]);
  };
  return (
    <Modal
      open
      close={close}
      title="Iniciar Deslocamento"
      description="Vincule uma ou mais pranchas com seus motoristas"
      wide
    >
      <form onSubmit={submitTeam} className="space-y-4 p-5">
        <div>
          <h3 className="text-sm font-semibold">Equipe de Transporte</h3>
          <p className="mt-1 text-xs text-[#77827b]">
            Cada motorista permanece obrigatoriamente vinculado à sua frota.
          </p>
        </div>
        <div className="space-y-3">
          {equipe.map((member, index) => (
            <div
              key={index}
              className="rounded-xl border border-[#e5e9e6] bg-[#fafbfa] p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold text-[#4f5953]">
                  Prancha {index + 1}
                </p>
                {equipe.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setEquipe((items) =>
                        items.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    className="rounded-md px-2 py-1 text-[10px] font-medium text-red-600 hover:bg-red-50"
                  >
                    Remover
                  </button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="label">Frota</span>
                  <FleetCombobox
                    frotas={frotas.filter(
                      (item) =>
                        !equipe.some(
                          (selectedMember, selectedIndex) =>
                            selectedIndex !== index &&
                            selectedMember.frota === item.numero,
                        ),
                    )}
                    value={member.frota}
                    onChange={(value) => updateMember(index, "frota", value)}
                  />
                </label>
                <label>
                  <span className="label">Motorista</span>
                  <input
                    className="field"
                    value={member.motorista}
                    onChange={(event) =>
                      updateMember(index, "motorista", event.target.value)
                    }
                    placeholder="Nome do motorista"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            setEquipe((items) => [...items, { frota: "", motorista: "" }])
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#dfe4e1] px-3 py-2 text-xs font-medium text-[#59645d] hover:bg-[#f6f8f6]"
        >
          <Plus size={14} /> Adicionar Prancha
        </button>
        {teamError && <p className="text-xs text-red-600">{teamError}</p>}
        <div className="flex gap-3 pt-3">
          <button
            type="button"
            onClick={close}
            className="flex-1 rounded-xl border py-3 text-sm font-semibold"
          >
            Cancelar
          </button>
          <button className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white">
            Confirmar
          </button>
        </div>
      </form>
    </Modal>
  );
}
function MaintenanceModal({
  open,
  close,
  frotas,
  save,
}: {
  open: boolean;
  close: () => void;
  frotas: Frota[];
  save: (d: ManutencaoInput) => void;
}) {
  const n = nowParts();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ManutencaoInput>({
    resolver: zodResolver(manutencaoSchema),
    defaultValues: {
      entradaData: n.iso,
      entradaHora: n.time,
      tipo: "Preventiva",
      componente: "Cavalo",
      mesmaOs: true,
      previsao: "nao",
      observacoes: "",
    },
  });
  const previsao = watch("previsao"),
    selected = watch("frota");
  return (
    <Modal
      open={open}
      close={close}
      title="Colocar em Manutenção"
      description="A frota ficará bloqueada até a finalização"
      wide
    >
      <form
        onSubmit={handleSubmit(save)}
        className="grid gap-4 p-5 sm:grid-cols-2"
      >
        <label className="sm:col-span-2">
          <span className="label">Frota</span>
          <FleetCombobox
            frotas={frotas}
            value={selected}
            onChange={(v) => setValue("frota", v, { shouldValidate: true })}
          />
          <input type="hidden" {...register("frota")} />
        </label>
        <label>
          <span className="label">Data de entrada</span>
          <input type="date" className="field" {...register("entradaData")} />
        </label>
        <label>
          <span className="label">Hora de entrada</span>
          <input type="time" className="field" {...register("entradaHora")} />
        </label>
        <label>
          <span className="label">Tipo</span>
          <select className="field" {...register("tipo")}>
            <option>Preventiva</option>
            <option>Corretiva</option>
          </select>
        </label>
        <label className="sm:col-span-2">
          <span className="label">Serviço a ser realizado</span>
          <input className="field" {...register("servico")} />
        </label>
        <label className="sm:col-span-2">
          <span className="label">Observações</span>
          <textarea className="field" rows={3} {...register("observacoes")} />
        </label>
        <fieldset className="sm:col-span-2">
          <legend className="label">Possui previsão de retorno?</legend>
          <div className="flex gap-5 text-sm">
            <label>
              <input type="radio" value="sim" {...register("previsao")} /> Sim
            </label>
            <label>
              <input type="radio" value="nao" {...register("previsao")} /> Não
            </label>
          </div>
        </fieldset>
        {previsao === "sim" && (
          <>
            <label>
              <span className="label">Data prevista</span>
              <input
                type="date"
                className="field"
                {...register("previsaoData")}
              />
            </label>
            <label>
              <span className="label">Hora prevista</span>
              <input
                type="time"
                className="field"
                {...register("previsaoHora")}
              />
            </label>
          </>
        )}
        {errors.previsaoData && (
          <p className="text-xs text-red-600 sm:col-span-2">
            {errors.previsaoData.message}
          </p>
        )}
        <div className="flex gap-3 pt-3 sm:col-span-2">
          <button
            type="button"
            onClick={close}
            className="flex-1 rounded-xl border py-3 text-sm font-semibold"
          >
            Cancelar
          </button>
          <button className="flex-1 rounded-xl bg-[#174e37] py-3 text-sm font-semibold text-white">
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}
