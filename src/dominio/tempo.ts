import { HOJE } from '@/data/extensoes'
import type { Proposta } from '@/data/types'

/**
 * Contagem de tempo.
 *
 * Um lugar só para as três perguntas de prazo — quanto falta, quanto passou e
 * há quanto tempo esta proposta não anda. Ficar espalhado produzia respostas
 * diferentes para a mesma pergunta em telas diferentes.
 */

export const DIA = 86_400_000

/** Positivo enquanto a data está no futuro. */
export function diasAte(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - HOJE.getTime()) / DIA)
}

export function diasDesde(iso: string): number {
  return Math.floor((HOJE.getTime() - new Date(iso).getTime()) / DIA)
}

/**
 * Dias desde o último movimento real da proposta.
 *
 * O critério é o evento mais recente da linha do tempo, não a última
 * sincronização: sincronizar é a Cleo lendo o TransfereGov todo dia, e isso não
 * significa que alguém tocou no processo.
 */
export function diasParada(p: Proposta): number {
  const ultimo = p.timeline.reduce((mais, e) => (e.data > mais ? e.data : mais), p.dataCadastro)
  return Math.max(diasDesde(ultimo), 0)
}
