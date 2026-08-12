/**
 * Modelo de domínio da plataforma de apresentação.
 *
 * Espelha o domínio real do Cleopatra (proposta de transferência voluntária,
 * processo SEI, empenho, minuta, automação) para que a troca da origem dos
 * dados por uma API real seja substituição de módulo, não reescrita de telas.
 */

export type Esfera = 'Municipal' | 'Estadual' | 'Consórcio' | 'OSC'

export type SituacaoProposta =
  | 'Cadastrada'
  | 'Em análise'
  | 'Em complementação'
  | 'Aprovada'
  | 'Convênio celebrado'
  | 'Em execução'
  | 'Prestação de contas'
  | 'Rejeitada'

export type Gatilho =
  | 'criar_processo'
  | 'adicionar_bloco_interno'
  | 'anexar_extrato_proposta'
  | 'anexar_contrapartidas'
  | 'anexar_capacidades_tecnicas'
  | 'criar_documento'

export type StatusAutomacao = 'NA_FILA' | 'EXECUTANDO' | 'SUCESSO' | 'FALHA' | 'CANCELADO'

export interface Orgao {
  id: string
  sigla: string
  nome: string
  unidadeGestora: string
  representante: string
  cpfRepresentante: string
}

export interface Proponente {
  id: string
  nome: string
  cnpj: string
  uf: string
  municipio: string
  esfera: Esfera
  representante: string
  cpfRepresentante: string
  cargoRepresentante: string
}

export interface Empenho {
  id: string
  numero: string
  data: string
  valor: number
  tipo: 'Ordinário' | 'Estimativo' | 'Global'
}

export interface DocumentoSei {
  id: string
  numero: string
  tipo: string
  data: string
  assinado: boolean
  minutaId?: string
  geradoPelaCleo: boolean
}

export interface EventoTimeline {
  id: string
  data: string
  titulo: string
  detalhe: string
  autor: 'Cleo' | string
  tipo: 'sistema' | 'automacao' | 'humano' | 'documento'
}

export interface ItemChecklist {
  id: string
  rotulo: string
  concluido: boolean
  obrigatorio: boolean
}

export interface ParcelaCronograma {
  id: string
  ordem: number
  descricao: string
  mes: string
  valor: number
  executado: boolean
}

export interface Proposta {
  id: string
  numero: string
  orgaoId: string
  proponenteId: string
  objeto: string
  programa: string
  situacao: SituacaoProposta
  modalidade: 'Convênio' | 'Contrato de repasse' | 'Termo de fomento' | 'Termo de colaboração'
  fundamentoLegal: string
  valorGlobal: number
  valorRepasse: number
  valorContrapartida: number
  dataCadastro: string
  dataUltimaSincronizacao: string
  numProcessoSei?: string
  empenhos: Empenho[]
  documentos: DocumentoSei[]
  cronograma: ParcelaCronograma[]
  checklist: ItemChecklist[]
  timeline: EventoTimeline[]
}

export interface Minuta {
  id: string
  nome: string
  tipo: string
  descricao: string
  campos: { nome: string; origem: 'usuario' | 'interno'; descricao: string }[]
  usos: number
}

export interface Automacao {
  id: string
  gatilho: Gatilho
  propostaId: string
  status: StatusAutomacao
  criadoEm: string
  duracaoMs: number
  usuario: string
  resultado?: string
}

export type TipoAprovacao =
  | 'aprovar_proposta'
  | 'corrigir_repasse'
  | 'alterar_situacao'
  | 'liberar_documento'

export interface Aprovacao {
  id: string
  tipo: TipoAprovacao
  propostaId: string
  solicitadoEm: string
  solicitadoPor: string
  justificativa: string
  valorAtual?: number
  valorSugerido?: number
  situacaoSugerida?: SituacaoProposta
  documentoSugerido?: string
  decidida: 'pendente' | 'aprovada' | 'recusada'
}

export interface Usuario {
  id: string
  nome: string
  cargo: string
  perfil: 'admin' | 'gestor' | 'técnico'
}

/** Pessoa da equipe do órgão, com carteira e capacidade declarada. */
export interface Analista {
  id: string
  nome: string
  iniciais: string
  cargo: string
  perfil: 'admin' | 'gestor' | 'técnico'
  orgaoId: string
  /** Quantas propostas a coordenação considera carga saudável para esta pessoa. */
  capacidade: number
}

/* ---------- Origem do recurso ---------- */

export type Casa = 'Câmara' | 'Senado'

export interface Parlamentar {
  id: string
  nome: string
  partido: string
  uf: string
  casa: Casa
}

/** RP6 individual, RP7 bancada e RP2 discricionária — a classificação que o
 *  orçamento usa e que muda a régua de obrigatoriedade de execução. */
export type TipoEmenda = 'Individual (RP6)' | 'Bancada (RP7)' | 'Discricionária (RP2)'

export interface Emenda {
  id: string
  numero: string
  ano: number
  tipo: TipoEmenda
  orgaoId: string
  /** Ausente na discricionária: não tem autor parlamentar. */
  parlamentarId?: string
  valorIndicado: number
}

export interface AcaoOrcamentaria {
  id: string
  codigo: string
  nome: string
  orgaoId: string
  programa: string
  dotacao: number
  empenhado: number
  liquidado: number
  pago: number
}

/* ---------- Ciclo de vida do convênio ---------- */

export type TipoAditivo = 'Prazo' | 'Valor' | 'Meta'

export interface Aditivo {
  id: string
  numero: string
  tipo: TipoAditivo
  data: string
  descricao: string
  novaDataFim?: string
  valorAcrescido?: number
}

export interface Vigencia {
  inicio: string
  fim: string
  aditivos: Aditivo[]
}

export type StatusPrestacao =
  | 'Não iniciada'
  | 'Aguardando apresentação'
  | 'Apresentada'
  | 'Em análise'
  | 'Aprovada'
  | 'Aprovada com ressalva'
  | 'Rejeitada'

export interface PrestacaoContas {
  status: StatusPrestacao
  /** Prazo legal de apresentação, contado do fim da vigência. */
  prazo: string
  dataEntrega?: string
  analistaId?: string
  ressalvas: string[]
}

export interface MetaFisica {
  id: string
  descricao: string
  unidade: string
  previsto: number
  realizado: number
}

/* ---------- Comunicação com o proponente ---------- */

export interface Diligencia {
  id: string
  propostaId: string
  assunto: string
  itens: string[]
  criadaEm: string
  prazo: string
  respondidaEm?: string
  reiteracoes: number
  autorId: string
}

/** Tudo o que a proposta ganhou depois da primeira versão, indexado por id. */
export interface Extensao {
  propostaId: string
  emendaId?: string
  acaoId: string
  responsavelId: string
  vigencia?: Vigencia
  prestacao?: PrestacaoContas
  metas: MetaFisica[]
}

/* ---------- Automação sem código ---------- */

export type TipoPasso =
  | 'abrir_sistema'
  | 'autenticar'
  | 'buscar_processo'
  | 'criar_processo'
  | 'preencher_formulario'
  | 'anexar_documento'
  | 'gerar_documento'
  | 'incluir_bloco'
  | 'assinar'
  | 'notificar'
  | 'aguardar'

export interface PassoRito {
  id: string
  tipo: TipoPasso
  rotulo: string
  parametro?: string
}

export interface Rito {
  id: string
  nome: string
  descricao: string
  sistema: 'SEI' | 'TransfereGov' | 'Ambos'
  passos: PassoRito[]
  /** Gatilhos que a simulação reproduz quando o rito é executado. */
  fila: Gatilho[]
  execucoes: number
  taxaSucesso: number
  duracaoMediaMs: number
  publicado: boolean
  autor: string
  criadoEm: string
  /** Ritos de fábrica não podem ser apagados — só duplicados. */
  deFabrica: boolean
}

export type OperadorRegra = 'igual' | 'diferente' | 'maior' | 'menor' | 'contem'

export interface CondicaoRegra {
  id: string
  campo: 'situacao' | 'valorGlobal' | 'programa' | 'uf' | 'diasParada' | 'temProcesso'
  operador: OperadorRegra
  valor: string
}

export type Recorrencia = 'nenhuma' | 'diaria' | 'semanal' | 'mensal'

export interface RegraGatilho {
  id: string
  nome: string
  ritoId: string
  condicoes: CondicaoRegra[]
  /** 'todas' = E lógico; 'qualquer' = OU lógico. */
  juncao: 'todas' | 'qualquer'
  ativa: boolean
  recorrencia: Recorrencia
  horario: string
  ultimaExecucao?: string
  disparos: number
}

/* ---------- Auditoria ---------- */

export type TipoEventoAuditoria =
  | 'automacao'
  | 'decisao'
  | 'documento'
  | 'regra'
  | 'acesso'
  | 'comentario'
  | 'diligencia'

export interface EventoAuditoria {
  id: string
  data: string
  tipo: TipoEventoAuditoria
  ator: string
  acao: string
  alvo: string
  propostaId?: string
  detalhe: string
}
