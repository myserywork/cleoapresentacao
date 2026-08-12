import { equipeDoOrgao, extensaoDa, propostasDoOrgao } from '@/data/repo'
import type { Analista, Proposta } from '@/data/types'
import { alertas, prioridade } from './riscos'

/**
 * Carga da equipe.
 *
 * A pergunta que a coordenação faz toda segunda-feira: quem está afogado e quem
 * tem espaço. A resposta não é contagem de processos — é contagem ponderada por
 * risco, porque vinte propostas em dia dão menos trabalho que cinco travadas.
 */

export interface CargaAnalista {
  analista: Analista
  propostas: Proposta[]
  qtd: number
  valor: number
  emRisco: number
  /** Soma da prioridade das propostas — a carga real, não a nominal. */
  peso: number
  /** qtd ÷ capacidade declarada. Acima de 1 é sobrecarga. */
  ocupacao: number
  faixa: 'ociosa' | 'saudavel' | 'cheia' | 'sobrecarregada'
}

const FAIXA = (ocupacao: number): CargaAnalista['faixa'] =>
  ocupacao < 0.55 ? 'ociosa' : ocupacao < 0.9 ? 'saudavel' : ocupacao <= 1.15 ? 'cheia' : 'sobrecarregada'

export function cargaDaEquipe(orgaoId: string): CargaAnalista[] {
  const time = equipeDoOrgao(orgaoId).filter((a) => a.perfil === 'técnico')
  const porAnalista = new Map<string, Proposta[]>()
  for (const a of time) porAnalista.set(a.id, [])

  for (const p of propostasDoOrgao(orgaoId)) {
    if (p.situacao === 'Rejeitada') continue
    const responsavel = extensaoDa(p.id)?.responsavelId
    if (responsavel && porAnalista.has(responsavel)) porAnalista.get(responsavel)!.push(p)
  }

  return time
    .map((analista) => {
      const propostas = porAnalista.get(analista.id) ?? []
      const emRisco = propostas.filter((p) =>
        alertas(p).some((a) => a.severidade === 'critico'),
      ).length
      const ocupacao = propostas.length / Math.max(analista.capacidade, 1)
      return {
        analista,
        propostas,
        qtd: propostas.length,
        valor: propostas.reduce((s, p) => s + p.valorGlobal, 0),
        emRisco,
        peso: propostas.reduce((s, p) => s + prioridade(p), 0),
        ocupacao,
        faixa: FAIXA(ocupacao),
      }
    })
    .sort((a, b) => b.ocupacao - a.ocupacao)
}

export interface SugestaoRedistribuicao {
  de: Analista
  para: Analista
  propostas: Proposta[]
  motivo: string
  /** Ocupação das duas pontas depois do movimento. */
  ocupacaoDepois: { de: number; para: number }
}

/**
 * Sugestão de movimento: tira da ponta mais cheia e entrega à mais folgada, até
 * as duas ficarem dentro da faixa saudável. Move as de maior prioridade — quem
 * está sobrecarregado precisa se livrar do que pesa, não do que é fácil.
 */
export function sugerirRedistribuicao(orgaoId: string): SugestaoRedistribuicao[] {
  const carga = cargaDaEquipe(orgaoId)
  if (carga.length < 2) return []

  const sugestoes: SugestaoRedistribuicao[] = []
  const restante = carga.map((c) => ({ ...c, propostas: [...c.propostas] }))

  for (let volta = 0; volta < 3; volta++) {
    restante.sort((a, b) => b.ocupacao - a.ocupacao)
    const cheio = restante[0]
    const vazio = restante[restante.length - 1]
    if (cheio.ocupacao - vazio.ocupacao < 0.25) break

    const alvo = Math.ceil(
      ((cheio.ocupacao - vazio.ocupacao) / 2) * Math.min(cheio.analista.capacidade, vazio.analista.capacidade),
    )
    const mover = [...cheio.propostas]
      .sort((a, b) => prioridade(b) - prioridade(a))
      .slice(0, Math.max(alvo, 1))
    if (mover.length === 0) break

    const idsMovidas = new Set(mover.map((p) => p.id))
    cheio.propostas = cheio.propostas.filter((p) => !idsMovidas.has(p.id))
    vazio.propostas = [...vazio.propostas, ...mover]
    cheio.ocupacao = cheio.propostas.length / cheio.analista.capacidade
    vazio.ocupacao = vazio.propostas.length / vazio.analista.capacidade

    sugestoes.push({
      de: cheio.analista,
      para: vazio.analista,
      propostas: mover,
      motivo: `${cheio.analista.nome.split(' ')[0]} está com ${(cheio.ocupacao * 100).toFixed(0)}% da capacidade depois do movimento; ${vazio.analista.nome.split(' ')[0]} sobe para ${(vazio.ocupacao * 100).toFixed(0)}%.`,
      ocupacaoDepois: { de: cheio.ocupacao, para: vazio.ocupacao },
    })
  }

  return sugestoes
}

export interface ResumoEquipe {
  pessoas: number
  capacidadeTotal: number
  atribuidas: number
  ocupacaoMedia: number
  desequilibrio: number
  semResponsavel: number
}

export function resumoEquipe(orgaoId: string): ResumoEquipe {
  const carga = cargaDaEquipe(orgaoId)
  const capacidadeTotal = carga.reduce((s, c) => s + c.analista.capacidade, 0)
  const atribuidas = carga.reduce((s, c) => s + c.qtd, 0)
  const ocupacoes = carga.map((c) => c.ocupacao)
  const ativas = propostasDoOrgao(orgaoId).filter((p) => p.situacao !== 'Rejeitada').length

  return {
    pessoas: carga.length,
    capacidadeTotal,
    atribuidas,
    ocupacaoMedia: capacidadeTotal > 0 ? atribuidas / capacidadeTotal : 0,
    // Distância entre a ponta mais cheia e a mais vazia: o número que justifica
    // redistribuir. Média boa esconde equipe desequilibrada.
    desequilibrio: ocupacoes.length ? Math.max(...ocupacoes) - Math.min(...ocupacoes) : 0,
    semResponsavel: Math.max(ativas - atribuidas, 0),
  }
}
