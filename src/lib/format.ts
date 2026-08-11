const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

const BRL_CENTAVOS = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const NUM = new Intl.NumberFormat('pt-BR')

export const moeda = (v: number) => BRL.format(v)
export const moedaExata = (v: number) => BRL_CENTAVOS.format(v)
export const numero = (v: number) => NUM.format(v)

/** Valores de painel: 14,2 mi lê melhor que 14.237.000 quando o que importa é a ordem de grandeza. */
export function moedaCompacta(v: number): string {
  if (Math.abs(v) >= 1_000_000_000) return `R$ ${(v / 1_000_000_000).toFixed(1).replace('.', ',')} bi`
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace('.', ',')} mi`
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(0)} mil`
  return BRL.format(v)
}

export function data(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function dataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function desde(iso: string): string {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (dias <= 0) return 'hoje'
  if (dias === 1) return 'ontem'
  if (dias < 30) return `há ${dias} dias`
  const meses = Math.floor(dias / 30)
  if (meses < 12) return `há ${meses} ${meses === 1 ? 'mês' : 'meses'}`
  const anos = Math.floor(meses / 12)
  return `há ${anos} ${anos === 1 ? 'ano' : 'anos'}`
}

export function duracao(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}min ${String(s % 60).padStart(2, '0')}s`
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** '2026-03' → 'mar/26' */
export function mesCurto(ym: string): string {
  const [ano, mes] = ym.split('-')
  return `${MESES[Number(mes) - 1]}/${ano.slice(2)}`
}

export const cn = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(' ')
