import { acoesDoOrgao, extensaoDa, getAcao, propostasDoOrgao } from '@/data/repo'
import { HOJE } from '@/data/extensoes'
import type { AcaoOrcamentaria, Proposta } from '@/data/types'

/**
 * Execução orçamentária.
 *
 * O funil dotação → empenho → liquidação → pagamento é a régua com que o gestor
 * é cobrado. Cada degrau tem um nome próprio para o que sobra nele, porque o
 * problema é diferente em cada um: saldo a empenhar é planejamento, saldo a
 * liquidar é obra parada, saldo a pagar é tesouraria.
 */

export interface Degrau {
  id: 'dotacao' | 'empenhado' | 'liquidado' | 'pago'
  rotulo: string
  valor: number
  /** Nome do que sobra deste degrau para o próximo. */
  sobraRotulo: string
  sobra: number
  explicacao: string
}

export interface Funil {
  degraus: Degrau[]
  dotacao: number
  empenhado: number
  liquidado: number
  pago: number
  /** 0..1 — quanto da dotação já virou pagamento. */
  execucao: number
}

export function funilDoOrgao(orgaoId: string): Funil {
  const acoes = acoesDoOrgao(orgaoId)
  return funilDeAcoes(acoes)
}

export function funilDeAcoes(acoes: AcaoOrcamentaria[]): Funil {
  const dotacao = acoes.reduce((s, a) => s + a.dotacao, 0)
  const empenhado = acoes.reduce((s, a) => s + a.empenhado, 0)
  const liquidado = acoes.reduce((s, a) => s + a.liquidado, 0)
  const pago = acoes.reduce((s, a) => s + a.pago, 0)

  const degraus: Degrau[] = [
    {
      id: 'dotacao',
      rotulo: 'Dotação autorizada',
      valor: dotacao,
      sobraRotulo: 'Saldo a empenhar',
      sobra: dotacao - empenhado,
      explicacao:
        'O que a lei orçamentária autorizou gastar. O que não for empenhado até 31 de dezembro volta para o Tesouro.',
    },
    {
      id: 'empenhado',
      rotulo: 'Empenhado',
      valor: empenhado,
      sobraRotulo: 'Empenhado a liquidar',
      sobra: empenhado - liquidado,
      explicacao:
        'Recurso reservado por nota de empenho. Garante o crédito, mas ainda não reconhece a despesa.',
    },
    {
      id: 'liquidado',
      rotulo: 'Liquidado',
      valor: liquidado,
      sobraRotulo: 'Liquidado a pagar',
      sobra: liquidado - pago,
      explicacao:
        'Entrega conferida e despesa reconhecida. O que ficar aqui na virada vira restos a pagar processados.',
    },
    {
      id: 'pago',
      rotulo: 'Pago',
      valor: pago,
      sobraRotulo: '—',
      sobra: 0,
      explicacao: 'Recurso efetivamente transferido ao proponente.',
    },
  ]

  return { degraus, dotacao, empenhado, liquidado, pago, execucao: dotacao > 0 ? pago / dotacao : 0 }
}

/* ---------- Fim de exercício ---------- */

export interface FimDeExercicio {
  diasCorridos: number
  diasUteis: number
  saldoAEmpenhar: number
  /** Quanto precisa ser empenhado por dia útil para zerar o saldo. */
  ritmoNecessario: number
  /** Ritmo observado nos últimos 90 dias, para comparação. */
  ritmoAtual: number
  /** Verdadeiro quando o ritmo atual não fecha a conta. */
  emRisco: boolean
}

/** Dias úteis entre duas datas, sem feriados — a aproximação que o gestor usa de cabeça. */
function diasUteisEntre(inicio: Date, fim: Date): number {
  let dias = 0
  const cursor = new Date(inicio)
  while (cursor < fim) {
    const dia = cursor.getDay()
    if (dia !== 0 && dia !== 6) dias++
    cursor.setDate(cursor.getDate() + 1)
  }
  return dias
}

export function fimDeExercicio(orgaoId: string): FimDeExercicio {
  const funil = funilDoOrgao(orgaoId)
  const virada = new Date(`${HOJE.getFullYear()}-12-31T23:59:59`)
  const diasCorridos = Math.max(
    Math.ceil((virada.getTime() - HOJE.getTime()) / 86_400_000),
    0,
  )
  const diasUteis = Math.max(diasUteisEntre(HOJE, virada), 1)
  const saldoAEmpenhar = Math.max(funil.dotacao - funil.empenhado, 0)

  // Ritmo observado: o empenhado do órgão distribuído nos dias úteis do
  // exercício já decorridos. É estimativa declarada, não medição de sistema.
  const inicioAno = new Date(`${HOJE.getFullYear()}-01-01T00:00:00`)
  const uteisDecorridos = Math.max(diasUteisEntre(inicioAno, HOJE), 1)
  const ritmoAtual = funil.empenhado / uteisDecorridos
  const ritmoNecessario = saldoAEmpenhar / diasUteis

  return {
    diasCorridos,
    diasUteis,
    saldoAEmpenhar,
    ritmoNecessario,
    ritmoAtual,
    emRisco: ritmoNecessario > ritmoAtual * 1.15,
  }
}

/* ---------- Restos a pagar ---------- */

export interface FaixaRestos {
  rotulo: string
  valor: number
  qtd: number
  tom: 'teal' | 'gold' | 'alert'
  explicacao: string
}

export interface RiscoRestos {
  faixas: FaixaRestos[]
  total: number
  /** Empenhos com mais de 180 dias sem liquidação — o núcleo do problema. */
  criticos: { proposta: Proposta; valor: number; dias: number }[]
}

export function riscoRestosAPagar(orgaoId: string): RiscoRestos {
  const propostas = propostasDoOrgao(orgaoId)
  const faixas: Record<string, { valor: number; qtd: number }> = {
    ate90: { valor: 0, qtd: 0 },
    ate180: { valor: 0, qtd: 0 },
    acima: { valor: 0, qtd: 0 },
  }
  const criticos: RiscoRestos['criticos'] = []

  for (const p of propostas) {
    for (const e of p.empenhos) {
      const dias = Math.floor((HOJE.getTime() - new Date(e.data).getTime()) / 86_400_000)
      // A liquidação acompanha a execução física: proposta em prestação de
      // contas já liquidou; em execução, parcialmente.
      const fracaoLiquidada =
        p.situacao === 'Prestação de contas' ? 0.95 : p.situacao === 'Em execução' ? 0.55 : 0.15
      const aLiquidar = Math.round(e.valor * (1 - fracaoLiquidada))
      if (aLiquidar <= 0) continue
      const faixa = dias <= 90 ? 'ate90' : dias <= 180 ? 'ate180' : 'acima'
      faixas[faixa].valor += aLiquidar
      faixas[faixa].qtd++
      if (dias > 180) criticos.push({ proposta: p, valor: aLiquidar, dias })
    }
  }

  return {
    faixas: [
      {
        rotulo: 'Até 90 dias',
        valor: faixas.ate90.valor,
        qtd: faixas.ate90.qtd,
        tom: 'teal',
        explicacao: 'Empenho recente, dentro do ciclo normal de execução.',
      },
      {
        rotulo: 'De 91 a 180 dias',
        valor: faixas.ate180.valor,
        qtd: faixas.ate180.qtd,
        tom: 'gold',
        explicacao: 'Começa a pesar: obra sem medição ou entrega sem conferência.',
      },
      {
        rotulo: 'Acima de 180 dias',
        valor: faixas.acima.valor,
        qtd: faixas.acima.qtd,
        tom: 'alert',
        explicacao: 'Candidato direto a restos a pagar não processados na virada do exercício.',
      },
    ],
    total: faixas.ate90.valor + faixas.ate180.valor + faixas.acima.valor,
    criticos: criticos.sort((a, b) => b.valor - a.valor).slice(0, 8),
  }
}

/* ---------- Simulador de empenho ---------- */

export interface CandidataEmpenho {
  proposta: Proposta
  valor: number
  motivo: string
}

/** Propostas prontas para receber empenho: aprovadas ou celebradas sem nota. */
export function candidatasAEmpenho(orgaoId: string): CandidataEmpenho[] {
  return propostasDoOrgao(orgaoId)
    .filter(
      (p) =>
        (p.situacao === 'Aprovada' || p.situacao === 'Convênio celebrado') &&
        p.empenhos.length === 0,
    )
    .map((p) => ({
      proposta: p,
      valor: p.valorRepasse,
      motivo:
        p.situacao === 'Aprovada'
          ? 'Aprovada e aguardando celebração — empenho reserva o crédito.'
          : 'Convênio celebrado sem nota de empenho registrada.',
    }))
    .sort((a, b) => b.valor - a.valor)
}

export interface ResultadoSimulacao {
  selecionadas: CandidataEmpenho[]
  valorTotal: number
  saldoAntes: number
  saldoDepois: number
  /** 0..1 — fração do saldo a empenhar coberta pela seleção. */
  cobertura: number
}

export function simularEmpenho(orgaoId: string, quantidade: number): ResultadoSimulacao {
  const candidatas = candidatasAEmpenho(orgaoId)
  const selecionadas = candidatas.slice(0, quantidade)
  const valorTotal = selecionadas.reduce((s, c) => s + c.valor, 0)
  const saldoAntes = fimDeExercicio(orgaoId).saldoAEmpenhar
  return {
    selecionadas,
    valorTotal,
    saldoAntes,
    saldoDepois: Math.max(saldoAntes - valorTotal, 0),
    cobertura: saldoAntes > 0 ? Math.min(valorTotal / saldoAntes, 1) : 1,
  }
}

/* ---------- Ação orçamentária da proposta ---------- */

export function acaoDaProposta(propostaId: string): AcaoOrcamentaria | undefined {
  const ext = extensaoDa(propostaId)
  return ext ? getAcao(ext.acaoId) : undefined
}
