/**
 * Base inicial de motoristas.
 *
 * Esta fonte fica isolada para ser substituída futuramente por um repositório
 * conectado à tabela `motoristas`, sem alterar os componentes de seleção.
 */
const nomesBase = [
  "ADILSO",
  "AMADEU",
  "ANDERSON",
  "CLAUDEMIR",
  "CLAUDIO",
  "CLEITON",
  "DIMAS",
  "EDER",
  "EDEVANDRO",
  "ELESSANDRO",
  "EVERTON",
  "FRANK",
  "GESIAN",
  "GILMAR",
  "JOVANIO",
  "LEANDRO",
  "LUIZINHO",
  "MADEU",
  "MAIKON",
  "MARCOS",
  "MARLON",
  "NEGREIRA",
  "ODAIR",
  "ORTEGA",
  "PEDRO BENTO",
  "RAFAEL",
  "REGINALDO",
  "RODRIGO",
  "RODRIGO MARTINS",
  "SERGIO",
  "SEBASTIAO",
  "SIDNEI",
  "TIQUIL",
  "VALDECIO",
  "VEVÊ",
  "WASHINGTON",
];

export const normalizarMotoristas = (nomes: Array<string | undefined>) =>
  Array.from(
    new Map(
      nomes
        .map((nome) => nome?.trim())
        .filter((nome): nome is string => Boolean(nome))
        .map((nome) => [nome.toLocaleUpperCase("pt-BR"), nome]),
    ).values(),
  ).sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));

export const MOTORISTAS_INICIAIS = Object.freeze(
  normalizarMotoristas(nomesBase),
);

export const obterMotoristasDisponiveis = (nomesPersistidos: string[] = []) =>
  normalizarMotoristas([...MOTORISTAS_INICIAIS, ...nomesPersistidos]);
