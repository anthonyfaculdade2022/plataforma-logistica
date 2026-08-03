import { z } from "zod";
export const agendamentoSchema = z.object({
  data: z.string().min(1, "Informe a data"),
  horario: z.string().min(1, "Informe o horário"),
  solicitante: z.string().min(2, "Informe o solicitante"),
  responsavel: z.string().min(2, "Informe o responsável"),
  setor: z.string().min(2, "Informe o setor"),
  origem: z.string().min(2, "Informe a origem"),
  destino: z.string().min(2, "Informe o destino"),
  prioridade: z.enum(["Baixa", "Média", "Alta"]),
  observacao: z.string().max(300),
  equipamentoTipo: z.string().optional(),
});
export const equipeTransporteSchema = z.object({
  frota: z.string().min(1, "Selecione a frota"),
  motorista: z.string().trim().min(2, "Informe o motorista"),
});
export const deslocamentoSchema = z
  .object({
    equipeTransporte: z
      .array(equipeTransporteSchema)
      .min(1, "Adicione ao menos uma prancha"),
  })
  .superRefine((value, context) => {
    const frotas = value.equipeTransporte.map((item) => item.frota);
    if (new Set(frotas).size !== frotas.length)
      context.addIssue({
        code: "custom",
        message: "A mesma frota não pode ser adicionada duas vezes",
        path: ["equipeTransporte"],
      });
  });
export const manutencaoSchema = z
  .object({
    frota: z.string().min(1, "Selecione a frota"),
    numeroOs: z.string().optional(),
    numeroOsCavalo: z.string().optional(),
    numeroOsPrancha: z.string().optional(),
    localizacao: z.string().min(2, "Informe a localização"),
    entradaData: z.string().min(1),
    entradaHora: z.string().min(1),
    tipo: z.enum(["Preventiva", "Corretiva"]),
    componente: z.enum(["Cavalo", "Prancha", "Ambos"]),
    mesmaOs: z.boolean().default(true),
    servico: z.string().min(3),
    observacoes: z.string(),
    previsao: z.enum(["sim", "nao"]),
    previsaoData: z.string().optional(),
    previsaoHora: z.string().optional(),
    transferir: z.enum(["sim", "nao"]).default("nao"),
    usarPreOs: z.enum(["sim", "nao"]).default("nao"),
    novaFrota: z.string().optional(),
    novoMotorista: z.string().optional(),
  })
  .superRefine((v, c) => {
    if (v.componente === "Ambos" && !v.mesmaOs) {
      if (!v.numeroOsCavalo?.trim())
        c.addIssue({
          code: "custom",
          message: "Informe a OS do cavalo",
          path: ["numeroOsCavalo"],
        });
      if (!v.numeroOsPrancha?.trim())
        c.addIssue({
          code: "custom",
          message: "Informe a OS da prancha",
          path: ["numeroOsPrancha"],
        });
    } else if (!v.numeroOs?.trim()) {
      c.addIssue({
        code: "custom",
        message: "Informe o número da OS",
        path: ["numeroOs"],
      });
    }
    if (v.previsao === "sim" && (!v.previsaoData || !v.previsaoHora))
      c.addIssue({
        code: "custom",
        message: "Informe data e hora previstas",
        path: ["previsaoData"],
      });
    if (v.transferir === "sim" && !v.novaFrota)
      c.addIssue({
        code: "custom",
        message: "Selecione a nova frota",
        path: ["novaFrota"],
      });
    if (
      v.transferir === "sim" &&
      (!v.novoMotorista || v.novoMotorista.length < 2)
    )
      c.addIssue({
        code: "custom",
        message: "Informe o novo motorista",
        path: ["novoMotorista"],
      });
  });
export type AgendamentoInput = z.infer<typeof agendamentoSchema>;
export type DeslocamentoInput = z.infer<typeof deslocamentoSchema>;
export type ManutencaoInput = z.infer<typeof manutencaoSchema>;
export const equipamentoSchema = z.object({
  codigo: z.string().min(2, "Informe o código"),
  tipo: z.string().min(2, "Informe o tipo"),
  descricao: z.string().optional(),
});
export type EquipamentoInput = z.infer<typeof equipamentoSchema>;
