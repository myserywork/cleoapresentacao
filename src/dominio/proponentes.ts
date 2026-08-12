import {
  diligenciasDaProposta,
  extensaoDa,
  getProponente,
  propostasDoOrgao,
  propostasDoProponente,
} from '@/data/repo'
import type { Proponente, Proposta } from '@/data/types'
import { diasAte, execucaoFisica } from './ciclo'

/**
 * Capacidade do proponente.
 *
 * A pergunta é sempre a mesma: "esse município consegue executar?". A nota não
 * decide nada sozinha — ela abre e mostra as parcelas que a formaram, porque
 * negar convênio com base em número fechado não passa em nenhuma auditoria.
 */

export interface ParcelaScore {
  rotulo: string
  peso: number
  obtido: number
  detalhe: string
}

export interface ScoreProponente {
  proponente: Proponente
  pontos: number
  faixa: 'alta' | 'media' | 'baixa'
  rotulo: string
  parcelas: ParcelaScore[]
  historico: HistoricoProponente
}

export interface HistoricoProponente {
  propostas: Proposta[]
  emCurso: number
  concluidos: number
  rejeitados: number
  valorTotal: number
  valorRecebido: number
  prestacoesAtrasadas: number
  prestacoesAprovadas: number
  diligencias: number
  diligenciasVencidas: number
  execucaoFisicaMedia: number
  inadimplente: boolean
}

export function historicoDoProponente(proponenteId: string): HistoricoProponente {
  const propostas = propostasDoProponente(proponenteId)
  let prestacoesAtrasadas = 0
  let prestacoesAprovadas = 0
  let diligencias = 0
  let diligenciasVencidas = 0
  let somaExecucao = 0
  let comExecucao = 0

  for (const p of propostas) {
    const ext = extensaoDa(p.id)
    if (ext?.prestacao) {
      const atrasada =
        diasAte(ext.prestacao.prazo) < 0 &&
        (ext.prestacao.status === 'Não iniciada' || ext.prestacao.status === 'Aguardando apresentação')
      if (atrasada || ext.prestacao.status === 'Rejeitada') prestacoesAtrasadas++
      if (ext.prestacao.status.startsWith('Aprovada')) prestacoesAprovadas++
    }
    if (ext?.vigencia) {
      somaExecucao += execucaoFisica(p.id)
      comExecucao++
    }
    for (const d of diligenciasDaProposta(p.id)) {
      diligencias++
      if (!d.respondidaEm && diasAte(d.prazo) < 0) diligenciasVencidas++
    }
  }

  return {
    propostas,
    emCurso: propostas.filter((p) =>
      ['Em análise', 'Em complementação', 'Aprovada', 'Convênio celebrado', 'Em execução'].includes(
        p.situacao,
      ),
    ).length,
    concluidos: propostas.filter((p) => p.situacao === 'Prestação de contas').length,
    rejeitados: propostas.filter((p) => p.situacao === 'Rejeitada').length,
    valorTotal: propostas.reduce((s, p) => s + p.valorGlobal, 0),
    valorRecebido: propostas.reduce(
      (s, p) => s + p.empenhos.reduce((t, e) => t + e.valor, 0),
      0,
    ),
    prestacoesAtrasadas,
    prestacoesAprovadas,
    diligencias,
    diligenciasVencidas,
    execucaoFisicaMedia: comExecucao > 0 ? somaExecucao / comExecucao : 0,
    inadimplente: prestacoesAtrasadas > 0,
  }
}

export function scoreProponente(proponenteId: string): ScoreProponente | undefined {
  const proponente = getProponente(proponenteId)
  if (!proponente) return undefined
  const h = historicoDoProponente(proponenteId)

  const parcelas: ParcelaScore[] = [
    {
      rotulo: 'Execução física dos convênios',
      peso: 30,
      obtido: Math.round(h.execucaoFisicaMedia * 30),
      detalhe:
        h.execucaoFisicaMedia > 0
          ? `${(h.execucaoFisicaMedia * 100).toFixed(0)}% das metas físicas cumpridas na média dos convênios.`
          : 'Ainda sem convênio celebrado com meta física medida.',
    },
    {
      rotulo: 'Pontualidade na prestação de contas',
      peso: 25,
      obtido: Math.round(
        h.prestacoesAtrasadas + h.prestacoesAprovadas > 0
          ? (h.prestacoesAprovadas / (h.prestacoesAtrasadas + h.prestacoesAprovadas)) * 25
          : 18,
      ),
      detalhe:
        h.prestacoesAtrasadas > 0
          ? `${h.prestacoesAtrasadas} prestação(ões) atrasada(s) ou rejeitada(s).`
          : 'Nenhuma prestação de contas em atraso.',
    },
    {
      rotulo: 'Ausência de inadimplência',
      peso: 20,
      obtido: h.inadimplente ? 0 : 20,
      detalhe: h.inadimplente
        ? 'Inadimplente — impedido de receber nova transferência até a regularização.'
        : 'Regular perante o órgão para novas transferências.',
    },
    {
      rotulo: 'Resposta a diligências',
      peso: 15,
      obtido: Math.round(
        h.diligencias > 0 ? Math.max(1 - h.diligenciasVencidas / h.diligencias, 0) * 15 : 11,
      ),
      detalhe:
        h.diligencias > 0
          ? `${h.diligenciasVencidas} de ${h.diligencias} diligência(s) sem resposta no prazo.`
          : 'Sem diligência aberta no período.',
    },
    {
      rotulo: 'Experiência com o órgão',
      peso: 10,
      obtido: Math.min(h.propostas.length * 2, 10),
      detalhe: `${h.propostas.length} proposta(s) apresentada(s), ${h.concluidos} em prestação de contas.`,
    },
  ]

  const pontos = parcelas.reduce((s, p) => s + p.obtido, 0)
  const faixa: ScoreProponente['faixa'] = pontos >= 72 ? 'alta' : pontos >= 45 ? 'media' : 'baixa'

  return {
    proponente,
    pontos,
    faixa,
    rotulo:
      faixa === 'alta'
        ? 'Capacidade comprovada'
        : faixa === 'media'
          ? 'Capacidade com ressalvas'
          : 'Capacidade frágil',
    parcelas,
    historico: h,
  }
}

/* ---------- Ranking do órgão ---------- */

export interface ItemRanking {
  proponente: Proponente
  qtd: number
  valor: number
  score: number
  inadimplente: boolean
}

export function rankingProponentes(orgaoId: string, limite = 20): ItemRanking[] {
  const porProponente = new Map<string, Proposta[]>()
  for (const p of propostasDoOrgao(orgaoId)) {
    if (!porProponente.has(p.proponenteId)) porProponente.set(p.proponenteId, [])
    porProponente.get(p.proponenteId)!.push(p)
  }

  const lista: ItemRanking[] = []
  for (const [id, propostas] of porProponente) {
    const proponente = getProponente(id)
    if (!proponente) continue
    const score = scoreProponente(id)
    lista.push({
      proponente,
      qtd: propostas.length,
      valor: propostas.reduce((s, p) => s + p.valorGlobal, 0),
      score: score?.pontos ?? 0,
      inadimplente: score?.historico.inadimplente ?? false,
    })
  }

  return lista.sort((a, b) => b.valor - a.valor).slice(0, limite)
}
