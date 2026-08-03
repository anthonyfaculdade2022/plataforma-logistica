"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, Maximize2, Minimize2, Search } from "lucide-react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  Table,
  useReactTable,
} from "@tanstack/react-table";
import {
  Frete,
  getEquipeTransporte,
  Manutencao,
  Status,
} from "@/features/pranchas/types";
import { getFrotaConfig } from "@/features/pranchas/frotas-config";

type Period =
  | "Todos"
  | "Hoje"
  | "Ontem"
  | "Últimos 7 dias"
  | "Últimos 30 dias"
  | "Personalizado";
const parseDate = (value: string) => {
  const [d, m, y] = value.split("/").map(Number);
  return new Date(y, m - 1, d);
};
const matchesPeriod = (
  value: string,
  period: Period,
  start: string,
  end: string,
) => {
  if (period === "Todos") return true;
  const date = parseDate(value),
    today = new Date();
  today.setHours(0, 0, 0, 0);
  if (period === "Hoje") return date.getTime() === today.getTime();
  if (period === "Ontem") {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return date.getTime() === d.getTime();
  }
  if (period === "Personalizado") {
    const from = start ? new Date(start + "T00:00:00") : null,
      to = end ? new Date(end + "T23:59:59") : null;
    return (!from || date >= from) && (!to || date <= to);
  }
  const amount = period === "Últimos 7 dias" ? 7 : 30,
    from = new Date(today);
  from.setDate(from.getDate() - (amount - 1));
  return date >= from && date <= today;
};
const statusClass: Record<Status, string> = {
  Pendente: "border-amber-200 bg-amber-50 text-amber-700",
  "Em Frete": "border-blue-200 bg-blue-50 text-blue-700",
  Concluído: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Cancelado: "border-red-200 bg-red-50 text-red-700",
};
const equipmentText = (f: Frete) =>
  f.etapas?.[f.etapaAtual || 0]?.equipamento?.trim() ||
  [f.equipamentoTipo, f.equipamentoCodigo].filter(Boolean).join(" ").trim();
const clipped = (value?: string, fallback = "—") => (
  <span
    title={value || fallback}
    className="block overflow-hidden text-ellipsis whitespace-nowrap"
  >
    {value || fallback}
  </span>
);

function Controls({
  query,
  setQuery,
  period,
  setPeriod,
  start,
  setStart,
  end,
  setEnd,
  expanded,
  setExpanded,
  children,
}: {
  query: string;
  setQuery: (v: string) => void;
  period: Period;
  setPeriod: (v: Period) => void;
  start: string;
  setStart: (v: string) => void;
  end: string;
  setEnd: (v: string) => void;
  expanded: boolean;
  setExpanded: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-[#edf0ee] bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-[#dfe4e1] bg-white px-3 py-2 text-[11px] font-medium text-[#566159] hover:bg-[#f6f8f6]"
        >
          {expanded ? (
            <>
              <Minimize2 size={13} />
              Recolher
            </>
          ) : (
            <>
              <Maximize2 size={13} />
              Expandir
            </>
          )}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-[#e1e5e2] bg-[#fafbfa] px-3 py-2">
          <Search size={14} className="text-[#89928d]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-xs outline-none"
            placeholder="Pesquisar..."
          />
        </label>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as Period)}
          className="rounded-lg border border-[#e1e5e2] bg-white px-3 py-2 text-xs"
        >
          <option>Todos</option>
          <option>Hoje</option>
          <option>Ontem</option>
          <option>Últimos 7 dias</option>
          <option>Últimos 30 dias</option>
          <option>Personalizado</option>
        </select>
        {period === "Personalizado" && (
          <>
            <input
              aria-label="Data Inicial"
              title="Data Inicial"
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="rounded-lg border border-[#e1e5e2] px-3 py-2 text-xs"
            />
            <input
              aria-label="Data Final"
              title="Data Final"
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="rounded-lg border border-[#e1e5e2] px-3 py-2 text-xs"
            />
          </>
        )}
      </div>
    </div>
  );
}

function ModernHistoryTable({
  table,
  expanded,
  hidden,
  onRowClick,
  widths,
}: {
  table: Table<any>;
  expanded: boolean;
  hidden: string[];
  onRowClick?: (row: any) => void;
  widths?: Record<string, string>;
}) {
  return (
    <div className="overflow-x-auto bg-[#f8faf8] p-2 sm:p-3">
      <table
        className={`w-full table-fixed text-left text-sm ${expanded ? "min-w-[1600px]" : ""}`}
      >
        <thead className="bg-white text-[9px] uppercase tracking-[.08em] text-[#89928d]">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th
                  key={header.id}
                  style={
                    widths ? { width: widths[header.column.id] } : undefined
                  }
                  className={`${!expanded && hidden.includes(header.column.id) ? "hidden" : ""} whitespace-nowrap px-3 py-2.5 font-medium`}
                >
                  <button
                    disabled={!header.column.getCanSort()}
                    onClick={header.column.getToggleSortingHandler()}
                    className="inline-flex items-center gap-1 text-left disabled:cursor-default"
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                    {header.column.getCanSort() && (
                      <ArrowUpDown
                        size={10}
                        className={
                          header.column.getIsSorted()
                            ? "text-[#174e37]"
                            : "text-[#b0b7b2]"
                        }
                      />
                    )}
                  </button>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="before:block before:h-2">
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onRowClick?.(row.original)}
              className={`border-b-4 border-[#f8faf8] bg-white shadow-[0_1px_2px_rgba(17,24,20,.025)] transition-all duration-200 hover:-translate-y-px hover:bg-[#fbfcfb] hover:shadow-[0_5px_14px_rgba(17,24,20,.055)] ${onRowClick ? "cursor-pointer" : ""}`}
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  style={widths ? { width: widths[cell.column.id] } : undefined}
                  className={`${!expanded && hidden.includes(cell.column.id) ? "hidden" : ""} px-3 py-5 align-middle first:rounded-l-lg last:rounded-r-lg`}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const freightColumn = createColumnHelper<Frete>();
export function FreightHistoryTable({
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
  const [query, setQuery] = useState(""),
    [period, setPeriod] = useState<Period>("Todos"),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [expanded, setExpanded] = useState(false),
    [sorting, setSorting] = useState<SortingState>([]);
  const data = useMemo(
    () =>
      fretes.filter((f) => {
        const team = getEquipeTransporte(f),
          haystack = [
            ...team.flatMap((item) => {
              const fleet = getFrotaConfig(item.frota);
              return [item.frota, fleet?.prancha, item.motorista];
            }),
            equipmentText(f),
            f.origem,
            f.destino,
            f.setor,
            f.solicitante,
            f.responsavel,
            f.status,
            f.observacao,
          ]
            .join(" ")
            .toLowerCase();
        return (
          haystack.includes(query.trim().toLowerCase()) &&
          matchesPeriod(f.data, period, start, end)
        );
      }),
    [fretes, query, period, start, end],
  );
  const columns = [
    freightColumn.accessor((f) => parseDate(f.data).getTime(), {
      id: "dh",
      header: "Data/Hora",
      cell: (i) => (
        <div className="whitespace-nowrap">
          <p className="font-medium">{i.row.original.data.slice(0, 5)}</p>
          <p className="mt-1 text-[11px] text-[#8a938e]">
            {i.row.original.horario}
          </p>
        </div>
      ),
    }),
    freightColumn.accessor("status", {
      header: "Status",
      cell: (i) => (
        <span
          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-1 text-[10px] font-medium ${statusClass[i.getValue()]}`}
        >
          <i className="h-1.5 w-1.5 rounded-full bg-current" />
          {i.getValue()}
        </span>
      ),
    }),
    freightColumn.accessor(equipmentText, {
      id: "equipamento",
      header: "Equipamento",
      cell: (i) => <span className="font-medium">{clipped(i.getValue())}</span>,
    }),
    freightColumn.display({
      id: "frota",
      header: "Frota / Prancha",
      cell: (i) => (
        <div className="space-y-1 whitespace-nowrap">
          {getEquipeTransporte(i.row.original).map((member) => (
            <p key={member.frota}>
              {member.frota} / {getFrotaConfig(member.frota)?.prancha || "—"}
            </p>
          ))}
        </div>
      ),
    }),
    freightColumn.display({
      id: "motorista",
      header: "Motorista",
      cell: (i) => (
        <div className="space-y-1">
          {getEquipeTransporte(i.row.original).map((member) => (
            <p key={member.frota}>{clipped(member.motorista)}</p>
          ))}
        </div>
      ),
    }),
    freightColumn.accessor("origem", { header: "Origem" }),
    freightColumn.accessor("destino", { header: "Destino" }),
    freightColumn.accessor("setor", {
      header: "Setor",
      cell: (i) => clipped(i.getValue()),
    }),
    freightColumn.accessor("solicitante", {
      header: "Solicitante",
      cell: (i) => clipped(i.getValue()),
    }),
    freightColumn.accessor("responsavel", {
      header: "Resp. Logística",
      cell: (i) => clipped(i.getValue()),
    }),
    freightColumn.accessor("observacao", {
      header: "Observação",
      cell: (i) => clipped(i.getValue(), "Sem observação"),
    }),
  ];
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  return (
    <div
      className={
        expanded
          ? "fixed inset-3 z-50 overflow-auto rounded-2xl border bg-white shadow-2xl"
          : ""
      }
    >
      <Controls
        {...{
          query,
          setQuery,
          period,
          setPeriod,
          start,
          setStart,
          end,
          setEnd,
          expanded,
          setExpanded,
        }}
      >
        {(
          ["Todos", "Pendente", "Em Frete", "Concluído", "Cancelado"] as const
        ).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-medium ${filter === s ? "border-[#174e37] bg-[#174e37] text-white" : "border-[#dfe4e1] bg-white text-[#66716a]"}`}
          >
            {s === "Cancelado" ? "Cancelados" : s}
          </button>
        ))}
      </Controls>
      <ModernHistoryTable
        table={table}
        expanded={expanded}
        hidden={["setor", "solicitante", "responsavel", "observacao"]}
        onRowClick={onFrete}
      />
    </div>
  );
}

const maintenanceColumn = createColumnHelper<Manutencao>();
export function MaintenanceHistoryTable({ items }: { items: Manutencao[] }) {
  const [status, setStatus] = useState<
      "Todas" | "Em manutenção" | "Finalizadas"
    >("Todas"),
    [query, setQuery] = useState(""),
    [period, setPeriod] = useState<Period>("Todos"),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [expanded, setExpanded] = useState(false),
    [sorting, setSorting] = useState<SortingState>([]);
  const data = useMemo(
    () =>
      items.filter((m) => {
        const fleet = getFrotaConfig(m.frota),
          matchesStatus =
            status === "Todas" ||
            (status === "Em manutenção"
              ? m.status === "Em manutenção"
              : m.status === "Finalizada"),
          haystack = [
            m.frota,
            fleet?.prancha,
            m.numeroOs,
            m.preOsUtilizada ? m.numeroOs : "",
            m.servico,
            m.localizacao,
            m.status,
            m.observacoes,
          ]
            .join(" ")
            .toLowerCase();
        return (
          matchesStatus &&
          haystack.includes(query.trim().toLowerCase()) &&
          matchesPeriod(m.entradaData, period, start, end)
        );
      }),
    [items, status, query, period, start, end],
  );
  const columns = [
    maintenanceColumn.accessor((m) => parseDate(m.entradaData).getTime(), {
      id: "dh",
      header: "Data/Hora",
      cell: (i) => (
        <div className="whitespace-nowrap">
          <p className="font-medium">
            {i.row.original.entradaData.slice(0, 5)}
          </p>
          <p className="mt-1 text-[11px] text-[#8a938e]">
            {i.row.original.entradaHora}
          </p>
        </div>
      ),
    }),
    maintenanceColumn.accessor("frota", { header: "Frota" }),
    maintenanceColumn.display({
      id: "prancha",
      header: "Prancha",
      cell: (i) => getFrotaConfig(i.row.original.frota)?.prancha || "—",
    }),
    maintenanceColumn.accessor("numeroOs", { header: "OS" }),
    maintenanceColumn.display({
      id: "preOs",
      header: "Pré-OS",
      cell: (i) =>
        i.row.original.preOsUtilizada ? i.row.original.numeroOs : "—",
    }),
    maintenanceColumn.accessor("servico", {
      header: "Serviço Executado",
      cell: (i) => clipped(i.getValue()),
    }),
    maintenanceColumn.accessor("localizacao", {
      header: "Localização",
      cell: (i) => clipped(i.getValue()),
    }),
    maintenanceColumn.display({
      id: "previsao",
      header: "Previsão",
      cell: (i) =>
        clipped(
          i.row.original.previsao
            ? `${i.row.original.previsaoData?.slice(0, 5)} ${i.row.original.previsaoHora}`
            : "Sem previsão",
        ),
    }),
    maintenanceColumn.accessor("status", {
      header: "Status",
      cell: (i) => (
        <span
          className={`inline-flex whitespace-nowrap rounded-full border px-2 py-1 text-[10px] font-medium ${i.getValue() === "Em manutenção" ? "border-orange-200 bg-orange-50 text-orange-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
        >
          {i.getValue()}
        </span>
      ),
    }),
    maintenanceColumn.accessor("observacoes", {
      header: "Observação",
      cell: (i) => clipped(i.getValue(), "Sem observação"),
    }),
  ];
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  return (
    <div
      className={
        expanded
          ? "fixed inset-3 z-50 overflow-auto rounded-2xl border bg-white shadow-2xl"
          : ""
      }
    >
      <Controls
        {...{
          query,
          setQuery,
          period,
          setPeriod,
          start,
          setStart,
          end,
          setEnd,
          expanded,
          setExpanded,
        }}
      >
        {(["Todas", "Em manutenção", "Finalizadas"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-medium ${status === s ? "border-[#174e37] bg-[#174e37] text-white" : "border-[#dfe4e1] bg-white text-[#66716a]"}`}
          >
            {s}
          </button>
        ))}
      </Controls>
      <ModernHistoryTable
        table={table}
        expanded={expanded}
        hidden={["preOs", "localizacao", "previsao", "observacoes"]}
        widths={{
          dh: "7%",
          frota: "6%",
          prancha: "6%",
          numeroOs: "7%",
          preOs: "7%",
          servico: "22%",
          localizacao: "11%",
          previsao: "8%",
          status: "9%",
          observacoes: "17%",
        }}
      />
    </div>
  );
}
