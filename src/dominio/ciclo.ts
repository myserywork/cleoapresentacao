import { diligenciasDaProposta, extensaoDa, propostasDoOrgao } from '@/data/repo'
import type { Proposta, SituacaoProposta, StatusPrestacao, Vigencia } from '@/data/types'
import { SLA_POR_SITUACAO } from './riscos'
import { DIA, diasAte, diasDesde, diasParada } from './tempo'

export { DIA, diasAte, diasDesde }

/**
 * O tempo do convênio.
 *
 * Vigência, aditivo, prestação de contas e prazo legal. É a dimensão que a
 * primeira versão não tinha e que decide o destino do recurso: convênio que
 * vence sem prorrogação morre, e prestação de contas atrasada bloqueia o
 * proponente para qualquer transferência nova.
 */

/* ---------- Vigência ---------- */

export type FaixaVigencia = 'vencida' | 'critica' | 'atencao' | 'confortavel'

export interface SituacaoVigencia {
  vigencia: Vigencia
  diasRestantes: number
  faixa: FaixaVigencia
  rotulo: string
  /** Fração do prazo total já consumida, 0..1. */
  consumo: number
  prorrogada: boolean
  /** Prorrogar depois do fim da vigência exige justificativa e nem sempre é aceito. */
  aindaProrrogavel: boolean
}

const ROTULO_FAIXA: Record<FaixaVigencia, string> = {
  vencida: 'Vigência encerrada',
  critica: 'Vence em menos de 30 dias',
  atencao: 'Vence em menos de 90 dias',
  confortavel: 'Vigência em dia',
}

export function situacaoVigencia(propostaId: string): SituacaoVigencia | undefined {
  const vigencia = extensaoDa(propostaId)?.vigencia
  if (!vigencia) return undefined

  const diasRestantes = diasAte(vigencia.fim)
  const total = Math.max(
    (new Date(vigencia.fim).getTime() - new Date(vigencia.inicio).getTime()) / DIA,
    1,
  )
  const decorrido = total - diasRestantes
  const faixa: FaixaVigencia =
    diasRestantes < 0 ? 'vencida' : diasRestantes <= 30 ? 'critica' : diasRestantes <= 90 ? 'atencao' : 'confortavel'

  return {
    vigencia,
    diasRestantes,
    faixa,
    rotulo: ROTULO_FAIXA[faixa],
    consumo: Math.min(Math.max(decorrido / total, 0), 1),
    prorrogada: vigencia.aditivos.some((a) => a.tipo === 'Prazo'),
    aindaProrrogavel: diasRestantes > -30,
  }
}

export interface ItemVigencia {
  proposta: Proposta
  situacao: SituacaoVigencia
  /** Fração das metas físicas concluídas, 0..1 — o que decide se prorrogar resolve. */
  execucaoFisica: number
}

export function carteiraDeVigencias(orgaoId: string): ItemVigencia[] {
  const itens: ItemVigencia[] = []
  for (const proposta of propostasDoOrgao(orgaoId)) {
    const situacao = situacaoVigencia(proposta.id)
    if (!situacao) continue
    itens.push({ proposta, situacao, execucaoFisica: execucaoFisica(proposta.id) })
  }
  // Ordem de urgência: o que vence antes primeiro; entre iguais, o de execução
  // física mais baixa — é o que corre risco real de não terminar.
  return itens.sort(
    (a, b) =>
      a.situacao.diasRestantes - b.situacao.diasRestantes ||
      a.execucaoFisica - b.execucaoFisica,
  )
}

export function execucaoFisica(propostaId: string): number {
  const metas = extensaoDa(propostaId)?.metas ?? []
  if (metas.length === 0) return 0
  const previsto = metas.reduce((s, m) => s + m.previsto, 0)
  const realizado = metas.reduce((s, m) => s + Math.min(m.realizado, m.previsto), 0)
  return previsto > 0 ? realizado / previsto : 0
}

/** Nova data sugerida numa prorrogação: o tempo que falta para concluir a meta. */
export function sugerirProrrogacao(propostaId: string): { meses: number; porque: string } {
  const execucao = execucaoFisica(propostaId)
  const situacao = situacaoVigencia(propostaId)
  if (!situacao) return { meses: 6, porque: 'Sem vigência registrada; sugestão padrão do órgão.' }

  const faltando = 1 - execucao
  const meses = Math.max(Math.min(Math.round(faltando * 24), 24), 3)
  return {
    meses,
    porque: `${(execucao * 100).toFixed(0)}% da meta física executada. No ritmo atual, faltam cerca de ${meses} meses para o objeto ser concluído.`,
  }
}

/* ---------- Prestação de contas ---------- */

export const TOM_PRESTACAO: Record<StatusPrestacao, 'teal' | 'gold' | 'inert' | 'alert' | 'cleo'> = {
  'Não iniciada': 'inert',
  'Aguardando apresentação': 'alert',
  Apresentada: 'cleo',
  'Em análise': 'gold',
  Aprovada: 'teal',
  'Aprovada com ressalva': 'gold',
  Rejeitada: 'alert',
}

export interface ItemPrestacao {
  proposta: Proposta
  status: StatusPrestacao
  prazo: string
  dataEntrega?: string
  diasParaPrazo: number
  atrasada: boolean
  /** Proponente inadimplente não pode receber transferência nova. */
  bloqueia: boolean
  ressalvas: string[]
}

export function carteiraDePrestacoes(orgaoId: string): ItemPrestacao[] {
  const itens: ItemPrestacao[] = []
  for (const proposta of propostasDoOrgao(orgaoId)) {
    const prestacao = extensaoDa(proposta.id)?.prestacao
    if (!prestacao) continue
    const diasParaPrazo = diasAte(prestacao.prazo)
    const atrasada =
      diasParaPrazo < 0 &&
      (prestacao.status === 'Não iniciada' || prestacao.status === 'Aguardando apresentação')
    itens.push({
      proposta,
      status: prestacao.status,
      prazo: prestacao.prazo,
      dataEntrega: prestacao.dataEntrega,
      diasParaPrazo,
      atrasada,
      bloqueia: atrasada || prestacao.status === 'Rejeitada',
      ressalvas: prestacao.ressalvas,
    })
  }
  return itens.sort((a, b) => a.diasParaPrazo - b.diasParaPrazo)
}

export interface ResumoPrestacao {
  total: number
  atrasadas: number
  emAnalise: number
  aprovadas: number
  rejeitadas: number
  /** Proponentes distintos bloqueados por inadimplência. */
  proponentesBloqueados: number
  valorBloqueado: number
}

export function resumoPrestacoes(orgaoId: string): ResumoPrestacao {
  const itens = carteiraDePrestacoes(orgaoId)
  const bloqueados = new Set(itens.filter((i) => i.bloqueia).map((i) => i.proposta.proponenteId))
  return {
    total: itens.length,
    atrasadas: itens.filter((i) => i.atrasada).length,
    emAnalise: itens.filter((i) => i.status === 'Em análise' || i.status === 'Apresentada').length,
    aprovadas: itens.filter((i) => i.status.startsWith('Aprovada')).length,
    rejeitadas: itens.filter((i) => i.status === 'Rejeitada').length,
    proponentesBloqueados: bloqueados.size,
    valorBloqueado: itens.filter((i) => i.bloqueia).reduce((s, i) => s + i.proposta.valorGlobal, 0),
  }
}

/* ---------- Ciclo de vida ---------- */

export interface FaseCiclo {
  id: string
  rotulo: string
  descricao: string
  /** Situações da proposta que caem nesta fase. */
  situacoes: SituacaoProposta[]
}

export const CICLO: FaseCiclo[] = [
  {
    id: 'cadastro',
    rotulo: 'Cadastro',
    descricao: 'Proposta registrada no TransfereGov pelo proponente.',
    situacoes: ['Cadastrada'],
  },
  {
    id: 'analise',
    rotulo: 'Análise',
    descricao: 'Instrução do processo, habilitação e diligências ao proponente.',
    situacoes: ['Em análise', 'Em complementação'],
  },
  {
    id: 'aprovacao',
    rotulo: 'Aprovação',
    descricao: 'Parecer técnico conclusivo e decisão do gestor.',
    situacoes: ['Aprovada'],
  },
  {
    id: 'celebracao',
    rotulo: 'Celebração',
    descricao: 'Assinatura do instrumento, empenho e publicação do extrato.',
    situacoes: ['Convênio celebrado'],
  },
  {
    id: 'execucao',
    rotulo: 'Execução',
    descricao: 'Liberação de parcelas, execução do objeto e acompanhamento de metas.',
    situacoes: ['Em execução'],
  },
  {
    id: 'contas',
    rotulo: 'Prestação de contas',
    descricao: 'Comprovação da aplicação do recurso e análise financeira e física.',
    situacoes: ['Prestação de contas'],
  },
]

export function faseAtual(situacao: SituacaoProposta): number {
  if (situacao === 'Rejeitada') return -1
  return CICLO.findIndex((f) => f.situacoes.includes(situacao))
}

/* ---------- Prazos legais ---------- */

export interface PrazoLegal {
  id: string
  rotulo: string
  base: string
  /** Dias restantes; negativo quando vencido. */
  dias: number
  vencido: boolean
  detalhe: string
}

export function prazosLegais(proposta: Proposta): PrazoLegal[] {
  const lista: PrazoLegal[] = []
  const ext = extensaoDa(proposta.id)

  const limiteFase = SLA_POR_SITUACAO[proposta.situacao]
  if (limiteFase > 0) {
    const decorrido = diasParada(proposta)
    lista.push({
      id: 'fase',
      rotulo: `Permanência em "${proposta.situacao}"`,
      base: 'Parâmetro de gestão do órgão',
      dias: limiteFase - decorrido,
      vencido: decorrido > limiteFase,
      detalhe: `${decorrido} de ${limiteFase} dias consumidos nesta fase.`,
    })
  }

  for (const d of diligenciasDaProposta(proposta.id)) {
    if (d.respondidaEm) continue
    const dias = diasAte(d.prazo)
    lista.push({
      id: `dil-${d.id}`,
      rotulo: 'Resposta à diligência',
      base: 'Portaria Interministerial nº 424/2016',
      dias,
      vencido: dias < 0,
      detalhe: `${d.itens.length} item(ns) pendente(s) — ${d.assunto}.`,
    })
  }

  if (ext?.vigencia) {
    const dias = diasAte(ext.vigencia.fim)
    lista.push({
      id: 'vigencia',
      rotulo: 'Fim da vigência',
      base: 'Termo de convênio e aditivos',
      dias,
      vencido: dias < 0,
      detalhe:
        ext.vigencia.aditivos.length > 0
          ? `Já prorrogada por ${ext.vigencia.aditivos.filter((a) => a.tipo === 'Prazo').length} termo(s) aditivo(s).`
          : 'Sem prorrogação até o momento.',
    })
  }

  if (ext?.prestacao) {
    const dias = diasAte(ext.prestacao.prazo)
    lista.push({
      id: 'contas',
      rotulo: 'Apresentação da prestação de contas',
      base: 'Decreto nº 6.170/2007',
      dias,
      vencido: dias < 0 && !ext.prestacao.dataEntrega,
      detalhe: ext.prestacao.dataEntrega
        ? 'Prestação já apresentada pelo proponente.'
        : '60 dias contados do fim da vigência.',
    })
  }

  return lista.sort((a, b) => a.dias - b.dias)
}
