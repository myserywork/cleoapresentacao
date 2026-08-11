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
