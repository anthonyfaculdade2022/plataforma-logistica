export type Status = "Pendente" | "Em Frete" | "Concluído" | "Cancelado";
export type Prioridade = "Baixa" | "Média" | "Alta";
export type FrotaStatus = "Disponível" | "Em Frete" | "Manutenção";
export type EquipeTransporte = {
  frota: string;
  motorista: string;
};
export type EtapaFrete = {
  id: string;
  origem: string;
  destino: string;
  observacao?: string;
  inicio?: string;
  conclusao?: string;
};
export type Frete = {
  id: string;
  operacao: string;
  data: string;
  horario: string;
  frota?: string;
  motorista?: string;
  equipeTransporte?: EquipeTransporte[];
  solicitante: string;
  responsavel: string;
  setor: string;
  origem: string;
  destino: string;
  prioridade: Prioridade;
  status: Status;
  observacao: string;
  inicioDeslocamento?: string;
  conclusao?: string;
  equipamentoId?: string;
  equipamentoTipo?: string;
  equipamentoCodigo?: string;
  frotaInicial?: string;
  frotaAnterior?: string;
  motivoTransferencia?: string;
  transferidoEm?: string;
  historicoAlteracoes?: AlteracaoFrete[];
  cancelamentoSolicitadoPor?: string;
  motivoCancelamento?: string;
  canceladoEm?: string;
  fluxoOperacao?: "unico" | "sequencia";
  etapas?: EtapaFrete[];
  etapaAtual?: number;
};
export const getEquipeTransporte = (frete: Frete): EquipeTransporte[] => {
  if (frete.equipeTransporte?.length) return frete.equipeTransporte;
  return frete.frota && frete.motorista
    ? [{ frota: frete.frota, motorista: frete.motorista }]
    : [];
};
export type AlteracaoFrete = {
  alteradoEm: string;
  campo: string;
  valorAnterior: string;
  novoValor: string;
};
export type Equipamento = {
  id: string;
  codigo: string;
  tipo: string;
  descricao?: string;
};
export type Frota = {
  numero: string;
  prancha: string;
  tipo?: "Bitola Aberta";
  status: FrotaStatus;
  localDisponivel?: string;
  possuiPreOs?: boolean;
  numeroPreOs?: string;
  servicoPreOs?: string;
  semMotorista?: boolean;
};
export type Manutencao = {
  id: string;
  frota: string;
  entradaData: string;
  entradaHora: string;
  saidaData?: string;
  saidaHora?: string;
  tipo: "Preventiva" | "Corretiva";
  componente?: "Cavalo" | "Prancha" | "Ambos";
  servico: string;
  observacoes: string;
  previsao: boolean;
  previsaoData?: string;
  previsaoHora?: string;
  responsavel: string;
  status: "Em manutenção" | "Finalizada";
  numeroOs: string;
  numeroOsCavalo?: string;
  numeroOsPrancha?: string;
  localizacao: string;
  freteId?: string;
  freteResumo?: string;
  preOsUtilizada?: boolean;
};
