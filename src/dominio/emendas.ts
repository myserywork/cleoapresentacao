import {
  EMENDAS,
  extensaoDa,
  getParlamentar,
  getProponente,
  propostasDaEmenda,
  propostasDoOrgao,
} from '@/data/repo'
import type { Emenda, Parlamentar, Proposta, TipoEmenda } from '@/data/types'
import { diasParada } from './tempo'

/**
 * Emenda parlamentar.
 *
 * É de onde vem a maior parte do recurso de transferência voluntária e é a
 * origem de quase toda cobrança que chega à coordenação. A carteira aqui não é
 * organizada por proposta: é organizada por quem vai ligar cobrando.
 */

export const TOM_TIPO_EMENDA: Record<TipoEmenda, 'cleo' | 'teal' | 'gold'> = {
  'Individual (RP6)': 'cleo',
  'Bancada (RP7)': 'teal',
  'Discricionária (RP2)': 'gold',
}

export interface CarteiraEmenda {
  emenda: Emenda
  parlamentar?: Parlamentar
  propostas: Proposta[]
  valorIndicado: number
  valorPropostas: number
  valorEmpenhado: number
  /** Propostas ainda sem processo ou paradas há mais de 60 dias. */
  paradas: number
  /** 0..1 — indicado que já virou empenho. */
  execucao: number
  municipios: string[]
}

export function carteiraDaEmenda(emenda: Emenda): CarteiraEmenda {
  const propostas = propostasDaEmenda(emenda.id)
  const valorPropostas = propostas.reduce((s, p) => s + p.valorGlobal, 0)
  const valorEmpenhado = propostas.reduce(
    (s, p) => s + p.empenhos.reduce((t, e) => t + e.valor, 0),
    0,
  )
  const paradas = propostas.filter(
    (p) => !p.numProcessoSei || diasParada(p) > 60,
  ).length
  const municipios = [
    ...new Set(propostas.map((p) => getProponente(p.proponenteId)?.municipio).filter(Boolean)),
  ] as string[]

  return {
    emenda,
    parlamentar: emenda.parlamentarId ? getParlamentar(emenda.parlamentarId) : undefined,
    propostas,
    valorIndicado: emenda.valorIndicado,
    valorPropostas,
    valorEmpenhado,
    paradas,
    execucao: emenda.valorIndicado > 0 ? Math.min(valorEmpenhado / emenda.valorIndicado, 1) : 0,
    municipios,
  }
}

export function carteirasDoOrgao(orgaoId: string): CarteiraEmenda[] {
  return EMENDAS.filter((e) => e.orgaoId === orgaoId)
    .map(carteiraDaEmenda)
    .sort((a, b) => b.valorIndicado - a.valorIndicado)
}

/* ---------- Visão por parlamentar ---------- */

export interface CarteiraParlamentar {
  parlamentar: Parlamentar
  emendas: CarteiraEmenda[]
  valorIndicado: number
  valorEmpenhado: number
  propostas: Proposta[]
  paradas: number
  municipios: string[]
  execucao: number
  /**
   * Pressão: o que sustenta um telefonema. Combina valor parado, tempo parado e
   * quantidade de propostas sem andamento. Não é métrica de sistema — é a ordem
   * em que a coordenação deveria devolver as ligações.
   */
  pressao: number
}

export function carteirasPorParlamentar(orgaoId: string): CarteiraParlamentar[] {
  const porParlamentar = new Map<string, CarteiraEmenda[]>()
  for (const carteira of carteirasDoOrgao(orgaoId)) {
    const id = carteira.parlamentar?.id
    if (!id) continue
    if (!porParlamentar.has(id)) porParlamentar.set(id, [])
    porParlamentar.get(id)!.push(carteira)
  }

  const lista: CarteiraParlamentar[] = []
  for (const [id, emendas] of porParlamentar) {
    const parlamentar = getParlamentar(id)
    if (!parlamentar) continue
    const propostas = emendas.flatMap((e) => e.propostas)
    const valorIndicado = emendas.reduce((s, e) => s + e.valorIndicado, 0)
    const valorEmpenhado = emendas.reduce((s, e) => s + e.valorEmpenhado, 0)
    const paradas = emendas.reduce((s, e) => s + e.paradas, 0)
    const valorParado = propostas
      .filter((p) => p.empenhos.length === 0)
      .reduce((s, p) => s + p.valorGlobal, 0)
    const mediaDiasParada = propostas.length
      ? propostas.reduce((s, p) => s + diasParada(p), 0) / propostas.length
      : 0

    lista.push({
      parlamentar,
      emendas,
      valorIndicado,
      valorEmpenhado,
      propostas,
      paradas,
      municipios: [...new Set(emendas.flatMap((e) => e.municipios))],
      execucao: valorIndicado > 0 ? Math.min(valorEmpenhado / valorIndicado, 1) : 0,
      pressao: Math.round(
        (valorParado / 1_000_000) * 3 + mediaDiasParada * 0.4 + paradas * 6,
      ),
    })
  }

  return lista.sort((a, b) => b.pressao - a.pressao)
}

/* ---------- Resumo do órgão ---------- */

export interface ResumoEmendas {
  totalEmendas: number
  parlamentares: number
  valorIndicado: number
  valorEmpenhado: number
  execucao: number
  porTipo: { tipo: TipoEmenda; qtd: number; valor: number }[]
  semEmenda: { qtd: number; valor: number }
}

export function resumoEmendas(orgaoId: string): ResumoEmendas {
  const carteiras = carteirasDoOrgao(orgaoId)
  const valorIndicado = carteiras.reduce((s, c) => s + c.valorIndicado, 0)
  const valorEmpenhado = carteiras.reduce((s, c) => s + c.valorEmpenhado, 0)

  const porTipoMap = new Map<TipoEmenda, { qtd: number; valor: number }>()
  for (const c of carteiras) {
    const atual = porTipoMap.get(c.emenda.tipo) ?? { qtd: 0, valor: 0 }
    porTipoMap.set(c.emenda.tipo, { qtd: atual.qtd + 1, valor: atual.valor + c.valorIndicado })
  }

  const semEmendaPropostas = propostasDoOrgao(orgaoId).filter((p) => !extensaoDa(p.id)?.emendaId)

  return {
    totalEmendas: carteiras.length,
    parlamentares: new Set(carteiras.map((c) => c.parlamentar?.id).filter(Boolean)).size,
    valorIndicado,
    valorEmpenhado,
    execucao: valorIndicado > 0 ? valorEmpenhado / valorIndicado : 0,
    porTipo: [...porTipoMap.entries()]
      .map(([tipo, v]) => ({ tipo, ...v }))
      .sort((a, b) => b.valor - a.valor),
    semEmenda: {
      qtd: semEmendaPropostas.length,
      valor: semEmendaPropostas.reduce((s, p) => s + p.valorGlobal, 0),
    },
  }
}
