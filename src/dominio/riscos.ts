import { getProponente, propostasDoOrgao } from '@/data/repo'
import type { Proposta, SituacaoProposta } from '@/data/types'
import { diasParada } from '@/assistente/motor'

/**
 * Riscos, conformidade e prazo.
 *
 * Toda regra aqui é parametrizada e a origem fica visível na tela. Alerta cuja
 * regra o servidor não consegue ler vira ruído — ele aprende a ignorar, e aí o
 * alerta que importa passa batido junto.
 */

export type Severidade = 'critico' | 'atencao' | 'informativo'

export interface Alerta {
  id: string
  rotulo: string
  detalhe: string
  regra: string
  severidade: Severidade
}

/** Prazo de permanência aceitável em cada fase, em dias corridos. */
export const SLA_POR_SITUACAO: Record<SituacaoProposta, number> = {
  Cadastrada: 10,
  'Em análise': 30,
  'Em complementação': 45,
  Aprovada: 20,
  'Convênio celebrado': 60,
  'Em execução': 180,
  'Prestação de contas': 60,
  Rejeitada: 0,
}

/** Percentual mínimo de contrapartida adotado pelo órgão. */
export const CONTRAPARTIDA_MINIMA = 0.02

/** A partir de quantas vezes a mediana do programa o valor vira ponto fora da curva. */
export const FATOR_FORA_DA_CURVA = 2.5

export interface Prazo {
  limite: number
  decorrido: number
  restante: number
  estourado: boolean
  /** 0..1 — quanto do prazo já foi consumido. */
  consumo: number
}

export function prazo(proposta: Proposta): Prazo {
  const limite = SLA_POR_SITUACAO[proposta.situacao] || 0
  const decorrido = diasParada(proposta)
  return {
    limite,
    decorrido,
    restante: limite - decorrido,
    estourado: limite > 0 && decorrido > limite,
    consumo: limite > 0 ? Math.min(decorrido / limite, 1.6) : 0,
  }
}

function mediana(valores: number[]): number {
  if (valores.length === 0) return 0
  const ordenados = [...valores].sort((a, b) => a - b)
  const meio = Math.floor(ordenados.length / 2)
  return ordenados.length % 2
    ? ordenados[meio]
    : (ordenados[meio - 1] + ordenados[meio]) / 2
}

/** Mediana de valor global por programa, base da detecção de ponto fora da curva. */
const medianasPorOrgao = new Map<string, Map<string, number>>()

function medianaDoPrograma(orgaoId: string, programa: string): number {
  let cache = medianasPorOrgao.get(orgaoId)
  if (!cache) {
    cache = new Map()
    const porPrograma = new Map<string, number[]>()
    for (const p of propostasDoOrgao(orgaoId)) {
      if (!porPrograma.has(p.programa)) porPrograma.set(p.programa, [])
      porPrograma.get(p.programa)!.push(p.valorGlobal)
    }
    for (const [prog, valores] of porPrograma) cache.set(prog, mediana(valores))
    medianasPorOrgao.set(orgaoId, cache)
  }
  return cache.get(programa) ?? 0
}

export function alertas(proposta: Proposta): Alerta[] {
  const lista: Alerta[] = []
  const p = prazo(proposta)

  const pctContrapartida = proposta.valorContrapartida / proposta.valorGlobal
  if (pctContrapartida < CONTRAPARTIDA_MINIMA) {
    lista.push({
      id: 'contrapartida',
      rotulo: 'Contrapartida abaixo do mínimo',
      detalhe: `${(pctContrapartida * 100).toFixed(1)}% do valor global, contra o mínimo de ${(CONTRAPARTIDA_MINIMA * 100).toFixed(0)}%.`,
      regra: `contrapartida ÷ valor global < ${(CONTRAPARTIDA_MINIMA * 100).toFixed(0)}%`,
      severidade: 'critico',
    })
  }

  const referencia = medianaDoPrograma(proposta.orgaoId, proposta.programa)
  if (referencia > 0 && proposta.valorGlobal > referencia * FATOR_FORA_DA_CURVA) {
    lista.push({
      id: 'fora-da-curva',
      rotulo: 'Valor fora da curva do programa',
      detalhe: `${(proposta.valorGlobal / referencia).toFixed(1)}× a mediana do programa, que é de ${Math.round(referencia / 1000)} mil.`,
      regra: `valor global > ${FATOR_FORA_DA_CURVA}× a mediana do programa`,
      severidade: 'atencao',
    })
  }

  if (p.estourado) {
    lista.push({
      id: 'prazo',
      rotulo: 'Prazo da fase estourado',
      detalhe: `${p.decorrido} dias em "${proposta.situacao}", contra o prazo de ${p.limite}.`,
      regra: `dias sem movimento > prazo da situação`,
      severidade: p.decorrido > p.limite * 2 ? 'critico' : 'atencao',
    })
  }

  const empenhado = proposta.empenhos.reduce((s, e) => s + e.valor, 0)
  if (empenhado > proposta.valorRepasse) {
    lista.push({
      id: 'empenho',
      rotulo: 'Empenho acima do repasse',
      detalhe: 'A soma dos empenhos supera o valor de repasse pactuado.',
      regra: 'soma dos empenhos > valor de repasse',
      severidade: 'critico',
    })
  }

  const avancada: SituacaoProposta[] = ['Aprovada', 'Convênio celebrado', 'Em execução']
  const faltamObrigatorios = proposta.checklist.filter((c) => c.obrigatorio && !c.concluido)
  if (avancada.includes(proposta.situacao) && faltamObrigatorios.length > 0) {
    lista.push({
      id: 'habilitacao',
      rotulo: 'Habilitação incompleta em fase avançada',
      detalhe: `${faltamObrigatorios.length} item(ns) obrigatório(s) pendente(s) com a proposta já em "${proposta.situacao}".`,
      regra: 'item obrigatório pendente após a aprovação',
      severidade: 'critico',
    })
  }

  if (!proposta.numProcessoSei && proposta.situacao !== 'Cadastrada') {
    lista.push({
      id: 'sem-processo',
      rotulo: 'Sem processo no SEI',
      detalhe: 'A proposta avançou de fase sem processo autuado.',
      regra: 'situação diferente de "Cadastrada" sem número de processo',
      severidade: 'atencao',
    })
  }

  return lista
}

export const TOM_SEVERIDADE: Record<Severidade, 'alert' | 'gold' | 'inert'> = {
  critico: 'alert',
  atencao: 'gold',
  informativo: 'inert',
}

/**
 * Prioridade de trabalho.
 *
 * Combina risco, prazo consumido e valor: é o que ordena a fila do dia. Valor
 * pesa menos que risco de propósito — proposta pequena irregular passa na frente
 * de proposta grande em dia.
 */
export function prioridade(proposta: Proposta): number {
  const risco = alertas(proposta).reduce(
    (s, a) => s + (a.severidade === 'critico' ? 40 : a.severidade === 'atencao' ? 18 : 5),
    0,
  )
  const p = prazo(proposta)
  const pesoPrazo = p.consumo * 30
  const pesoValor = Math.min(proposta.valorGlobal / 1_000_000, 15)
  return Math.round(risco + pesoPrazo + pesoValor)
}

export interface ItemDoDia {
  proposta: Proposta
  pontos: number
  alertas: Alerta[]
  prazo: Prazo
  motivo: string
}

export function filaDoDia(orgaoId: string, limite = 12): ItemDoDia[] {
  return propostasDoOrgao(orgaoId)
    .filter((p) => p.situacao !== 'Rejeitada')
    .map((proposta) => {
      const lista = alertas(proposta)
      const p = prazo(proposta)
      const critico = lista.find((a) => a.severidade === 'critico')
      return {
        proposta,
        pontos: prioridade(proposta),
        alertas: lista,
        prazo: p,
        motivo: critico
          ? critico.rotulo
          : p.estourado
            ? `Parada há ${p.decorrido} dias`
            : lista[0]?.rotulo ?? 'Aguardando andamento',
      }
    })
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, limite)
}

/** Aderência do órgão ao prazo, por fase. */
export function aderenciaSla(orgaoId: string) {
  const porSituacao = new Map<SituacaoProposta, { dentro: number; fora: number }>()
  for (const p of propostasDoOrgao(orgaoId)) {
    if (SLA_POR_SITUACAO[p.situacao] === 0) continue
    const atual = porSituacao.get(p.situacao) ?? { dentro: 0, fora: 0 }
    if (prazo(p).estourado) atual.fora++
    else atual.dentro++
    porSituacao.set(p.situacao, atual)
  }
  return [...porSituacao.entries()].map(([situacao, v]) => ({
    situacao,
    ...v,
    total: v.dentro + v.fora,
    aderencia: v.dentro + v.fora > 0 ? v.dentro / (v.dentro + v.fora) : 1,
  }))
}

export function proponenteDe(proposta: Proposta) {
  return getProponente(proposta.proponenteId)
}
