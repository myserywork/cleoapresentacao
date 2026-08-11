import type { Gatilho, SituacaoProposta } from '@/data/types'

/**
 * Uma intenção resolvida vira uma lista de AÇÕES — coisas que acontecem na
 * interface, não texto que descreve o que aconteceria.
 *
 * É isso que separa um chat de um copiloto: o assistente, a paleta de comando e
 * o modo apresentação falam todos esta mesma linguagem, e por isso qualquer um
 * deles pode dirigir a plataforma inteira.
 */

export interface FiltroPropostas {
  termo?: string
  situacao?: SituacaoProposta[]
  uf?: string[]
  paradaHaDias?: number
  ordenarPor?: 'valor' | 'recencia' | 'parada'
}

export type Acao =
  | { tipo: 'navegar'; para: string; motivo?: string }
  | { tipo: 'filtrar-propostas'; filtro: FiltroPropostas; motivo?: string }
  | { tipo: 'abrir-proposta'; propostaId: string; aba?: string; motivo?: string }
  | { tipo: 'executar-automacao'; propostaId: string; gatilho: Gatilho; motivo?: string }
  | { tipo: 'executar-rito'; propostaId: string; gatilhos: Gatilho[]; motivo?: string }
  | { tipo: 'focar-no-cerebro'; noId: string; motivo?: string }
  | { tipo: 'destacar'; seletor: string; rotulo: string }
  | { tipo: 'esperar'; ms: number }

export interface Comando {
  id: string
  /** O que aparece na paleta e no rastro do copiloto. */
  rotulo: string
  categoria: 'Ir para' | 'Propostas' | 'Automações' | 'Apresentação' | 'Órgão'
  /** Termos alternativos que também encontram este comando. */
  sinonimos?: string[]
  acoes: Acao[]
  atalho?: string
}
