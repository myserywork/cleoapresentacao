import { useEffect, useMemo, useRef, useState } from 'react'
import { cn, mesCurto, moedaCompacta, numero } from '@/lib/format'

/* ---------- Número que sobe ---------- */

const prefereMenosMovimento = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function useContagem(alvo: number, duracaoMs = 1100): number {
  const [valor, setValor] = useState(prefereMenosMovimento() ? alvo : 0)
  const alvoRef = useRef(alvo)

  useEffect(() => {
    alvoRef.current = alvo
    if (prefereMenosMovimento()) {
      setValor(alvo)
      return
    }
    let frame = 0
    const inicio = performance.now()
    const passo = (agora: number) => {
      const t = Math.min((agora - inicio) / duracaoMs, 1)
      // desaceleração no fim: o número "assenta" em vez de parar seco
      const eased = 1 - Math.pow(1 - t, 3)
      setValor(alvoRef.current * eased)
      if (t < 1) frame = requestAnimationFrame(passo)
    }
    frame = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(frame)
  }, [alvo, duracaoMs])

  return valor
}

/* ---------- Bloco de indicador ---------- */

const COR_TOM = {
  ink: 'var(--color-viz-inert)',
  gold: 'var(--color-viz-gold)',
  teal: 'var(--color-viz-teal)',
  cleo: 'var(--color-viz-cleo)',
}

export function Indicador({
  rotulo,
  valor,
  detalhe,
  formato = 'numero',
  tom = 'ink',
  icone,
  serie,
}: {
  rotulo: string
  valor: number
  detalhe?: string
  formato?: 'numero' | 'moeda'
  tom?: 'ink' | 'gold' | 'teal' | 'cleo'
  icone?: React.ReactNode
  /** Histórico curto atrás do número — a tendência sem abrir gráfico. */
  serie?: number[]
}) {
  const animado = useContagem(valor)
  const cores = {
    ink: 'text-ink',
    gold: 'text-gold',
    teal: 'text-teal',
    cleo: 'text-cleo',
  }
  return (
    <div className="panel relative overflow-hidden px-5 py-4">
      {serie && serie.length > 1 && (
        <div className="pointer-events-none absolute right-2 bottom-1 opacity-35">
          <Sparkline valores={serie} cor={COR_TOM[tom]} largura={110} altura={26} />
        </div>
      )}
      <div className="mb-2 flex items-center justify-between">
        <span className="eyebrow">{rotulo}</span>
        {icone && <span className="text-faint">{icone}</span>}
      </div>
      <div className={cn('num text-[27px] leading-none font-medium tracking-tight', cores[tom])}>
        {formato === 'moeda' ? moedaCompacta(animado) : numero(Math.round(animado))}
      </div>
      {detalhe && <div className="mt-2 text-[11.5px] text-muted">{detalhe}</div>}
    </div>
  )
}

/* ---------- Série temporal ---------- */

interface PontoSerie {
  mes: string
  qtd: number
  valor: number
}

export function SerieTemporal({
  dados,
  medida = 'valor',
  altura = 190,
}: {
  dados: PontoSerie[]
  medida?: 'valor' | 'qtd'
  altura?: number
}) {
  const [ativo, setAtivo] = useState<number | null>(null)
  const larg = 760
  const alt = altura
  // Folga nas laterais para o primeiro e o último rótulo do eixo caberem inteiros
  const padL = 26
  const padR = 26
  const padT = 14
  const padB = 24

  const valores = dados.map((d) => (medida === 'valor' ? d.valor : d.qtd))
  const max = Math.max(...valores, 1)
  const x = (i: number) => padL + (i * (larg - padL - padR)) / Math.max(dados.length - 1, 1)
  const y = (v: number) => padT + (1 - v / max) * (alt - padT - padB)

  const linha = valores.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ')
  const area = `${linha} L ${x(valores.length - 1)} ${alt - padB} L ${x(0)} ${alt - padB} Z`

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${larg} ${alt}`}
        className="w-full"
        style={{ height: alt }}
        onMouseLeave={() => setAtivo(null)}
        role="img"
        aria-label="Evolução mensal das propostas cadastradas"
      >
        <defs>
          <linearGradient id="gradSerie" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-viz-teal)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--color-viz-teal)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* grade recessiva: presente para leitura, nunca disputando com o dado */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={padL}
            x2={larg - padR}
            y1={y(max * f)}
            y2={y(max * f)}
            stroke="var(--color-line-soft)"
            strokeWidth="1"
          />
        ))}

        <path d={area} fill="url(#gradSerie)" />
        <path
          d={linha}
          fill="none"
          stroke="var(--color-viz-teal)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {ativo !== null && (
          <>
            <line
              x1={x(ativo)}
              x2={x(ativo)}
              y1={padT}
              y2={alt - padB}
              stroke="var(--color-gold)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <circle
              cx={x(ativo)}
              cy={y(valores[ativo])}
              r="5"
              fill="var(--color-viz-teal)"
              stroke="var(--color-surface)"
              strokeWidth="2"
            />
          </>
        )}

        {dados.map((d, i) => (
          <rect
            key={d.mes}
            x={x(i) - (larg - padL - padR) / dados.length / 2}
            y={0}
            width={(larg - padL - padR) / dados.length}
            height={alt}
            fill="transparent"
            onMouseEnter={() => setAtivo(i)}
          />
        ))}

        {dados.map((d, i) =>
          i % 3 === 0 || i === dados.length - 1 ? (
            <text
              key={d.mes}
              x={x(i)}
              y={alt - 6}
              textAnchor={i === 0 ? 'start' : i === dados.length - 1 ? 'end' : 'middle'}
              className="num"
              fontSize="10"
              fill="var(--color-faint)"
            >
              {mesCurto(d.mes)}
            </text>
          ) : null,
        )}
      </svg>

      {ativo !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-lg border border-line bg-surface px-3 py-2 shadow-xl"
          style={{ left: `${(x(ativo) / larg) * 100}%`, top: 0 }}
        >
          <div className="eyebrow mb-1">{mesCurto(dados[ativo].mes)}</div>
          <div className="num text-[13px] text-ink">{moedaCompacta(dados[ativo].valor)}</div>
          <div className="num text-[11px] text-muted">{dados[ativo].qtd} propostas</div>
        </div>
      )}
    </div>
  )
}

/* ---------- Barras horizontais ---------- */

export interface ItemBarra {
  rotulo: string
  valor: number
  secundario?: string
  cor?: string
}

export function BarrasHorizontais({
  itens,
  formato = 'moeda',
  maxItens = 8,
}: {
  itens: ItemBarra[]
  formato?: 'moeda' | 'numero'
  maxItens?: number
}) {
  const lista = itens.slice(0, maxItens)
  const max = Math.max(...lista.map((i) => i.valor), 1)

  return (
    <ul className="flex flex-col gap-2.5">
      {lista.map((item) => (
        <li key={item.rotulo} className="group">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="truncate text-[12.5px] text-ink">{item.rotulo}</span>
            <span className="num shrink-0 text-[12px] text-muted">
              {formato === 'moeda' ? moedaCompacta(item.valor) : numero(item.valor)}
              {item.secundario && <span className="ml-1.5 text-faint">{item.secundario}</span>}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-out"
              style={{
                width: `${(item.valor / max) * 100}%`,
                background: item.cor ?? 'var(--color-viz-teal)',
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

/* ---------- Composição em barra única ---------- */

export function BarraComposicao({
  segmentos,
}: {
  segmentos: { rotulo: string; valor: number; cor: string }[]
}) {
  const total = segmentos.reduce((s, x) => s + x.valor, 0) || 1
  return (
    <div>
      {/* gap de 2px entre segmentos: a superfície separa, não uma borda */}
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {segmentos.map((s) => (
          <div
            key={s.rotulo}
            style={{ width: `${(s.valor / total) * 100}%`, background: s.cor }}
            className="first:rounded-l-full last:rounded-r-full"
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {segmentos.map((s) => (
          <li key={s.rotulo} className="flex items-center gap-2">
            <span className="size-2 rounded-full" style={{ background: s.cor }} />
            <span className="text-[12px] text-muted">{s.rotulo}</span>
            <span className="num text-[12px] text-ink">{moedaCompacta(s.valor)}</span>
            <span className="num text-[11px] text-faint">
              {((s.valor / total) * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ---------- Anel ---------- */

export function Anel({
  segmentos,
  tamanho = 132,
  espessura = 14,
  centro,
  legenda,
}: {
  segmentos: { rotulo: string; valor: number; cor: string }[]
  tamanho?: number
  espessura?: number
  centro?: { valor: string; rotulo: string }
  legenda?: boolean
}) {
  const total = segmentos.reduce((s, x) => s + x.valor, 0) || 1
  const raio = (tamanho - espessura) / 2
  const circunferencia = 2 * Math.PI * raio
  let acumulado = 0

  return (
    <div className={legenda ? 'flex items-center gap-5' : ''}>
      <svg width={tamanho} height={tamanho} className="shrink-0 -rotate-90">
        <circle
          cx={tamanho / 2}
          cy={tamanho / 2}
          r={raio}
          fill="none"
          stroke="var(--color-line-soft)"
          strokeWidth={espessura}
        />
        {segmentos.map((s) => {
          const fracao = s.valor / total
          const traco = fracao * circunferencia
          const el = (
            <circle
              key={s.rotulo}
              cx={tamanho / 2}
              cy={tamanho / 2}
              r={raio}
              fill="none"
              stroke={s.cor}
              strokeWidth={espessura}
              strokeDasharray={`${Math.max(traco - 2, 0)} ${circunferencia}`}
              strokeDashoffset={-acumulado * circunferencia}
              strokeLinecap="butt"
            />
          )
          acumulado += fracao
          return el
        })}
        {centro && (
          <g className="rotate-90" style={{ transformOrigin: 'center' }}>
            <text
              x={tamanho / 2}
              y={tamanho / 2 - 2}
              textAnchor="middle"
              className="num"
              fontSize="19"
              fontWeight="500"
              fill="var(--color-ink)"
            >
              {centro.valor}
            </text>
            <text
              x={tamanho / 2}
              y={tamanho / 2 + 14}
              textAnchor="middle"
              fontSize="9.5"
              letterSpacing="0.14em"
              fill="var(--color-muted)"
            >
              {centro.rotulo.toUpperCase()}
            </text>
          </g>
        )}
      </svg>

      {legenda && (
        <ul className="flex min-w-0 flex-col gap-2">
          {segmentos.map((s) => (
            <li key={s.rotulo} className="flex items-center gap-2">
              <span className="size-2 shrink-0 rounded-full" style={{ background: s.cor }} />
              <span className="min-w-0 flex-1 truncate text-[12px] text-muted">{s.rotulo}</span>
              <span className="num shrink-0 text-[11.5px] text-faint">
                {((s.valor / total) * 100).toFixed(0)}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ---------- Linha mínima ---------- */

export function Sparkline({
  valores,
  cor = 'var(--color-viz-teal)',
  largura = 120,
  altura = 30,
}: {
  valores: number[]
  cor?: string
  largura?: number
  altura?: number
}) {
  if (valores.length < 2) return null
  const max = Math.max(...valores)
  const min = Math.min(...valores)
  const faixa = max - min || 1
  const pontos = valores.map((v, i) => {
    const x = (i / (valores.length - 1)) * largura
    const y = altura - ((v - min) / faixa) * (altura - 3) - 1.5
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
  })
  return (
    <svg width={largura} height={altura} className="overflow-visible">
      <path d={pontos.join(' ')} fill="none" stroke={cor} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/* ---------- Funil de execução ---------- */

export interface DegrauFunil {
  id: string
  rotulo: string
  valor: number
  sobraRotulo: string
  sobra: number
  explicacao: string
}

/**
 * Funil orçamentário.
 *
 * O que importa não é a barra que encolhe: é o nome do que ficou para trás em
 * cada degrau. Saldo a empenhar, empenhado a liquidar e liquidado a pagar são
 * três problemas diferentes, com donos diferentes.
 */
export function FunilExecucao({
  degraus,
  formato = moedaCompacta,
}: {
  degraus: DegrauFunil[]
  formato?: (v: number) => string
}) {
  const topo = degraus[0]?.valor || 1
  const [ativo, setAtivo] = useState<string | null>(null)
  const cores = [
    'var(--color-viz-inert)',
    'var(--color-viz-gold)',
    'var(--color-viz-cleo)',
    'var(--color-viz-teal)',
  ]

  return (
    <ul className="flex flex-col gap-3">
      {degraus.map((d, i) => {
        const fracao = d.valor / topo
        return (
          <li
            key={d.id}
            onMouseEnter={() => setAtivo(d.id)}
            onMouseLeave={() => setAtivo(null)}
          >
            <div className="mb-1.5 flex items-baseline justify-between gap-4">
              <span className="text-[12.5px] text-ink">{d.rotulo}</span>
              <span className="num shrink-0 text-[12.5px] text-ink">{formato(d.valor)}</span>
            </div>
            <div className="flex h-7 items-center gap-3">
              <div className="h-full flex-1 overflow-hidden rounded-md bg-white/[0.035]">
                <div
                  className="flex h-full items-center rounded-md px-2.5 transition-[width] duration-700 ease-out"
                  style={{ width: `${Math.max(fracao * 100, 2)}%`, background: cores[i] }}
                >
                  <span className="num text-[11px] font-medium text-[#0b1018]">
                    {(fracao * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
            {d.sobra > 0 && (
              <div className="mt-1.5 flex items-baseline gap-2 pl-0.5">
                <span className="text-[11px] text-faint">↳ {d.sobraRotulo}</span>
                <span className="num text-[11px] text-gold">{formato(d.sobra)}</span>
              </div>
            )}
            {ativo === d.id && (
              <p className="mt-1.5 max-w-[52ch] text-[11px] leading-relaxed text-muted">
                {d.explicacao}
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/* ---------- Distribuição por situação ---------- */

export function DistribuicaoSituacao({
  dados,
  cores,
}: {
  dados: { situacao: string; qtd: number; valor: number }[]
  cores: Record<string, string>
}) {
  const max = useMemo(() => Math.max(...dados.map((d) => d.qtd), 1), [dados])
  return (
    <ul className="flex flex-col gap-3">
      {dados.map((d) => (
        <li key={d.situacao} className="flex items-center gap-3">
          <span className="w-[136px] shrink-0 truncate text-[12.5px] text-muted">{d.situacao}</span>
          <div className="h-4 flex-1 overflow-hidden rounded-[4px] bg-white/4">
            <div
              className="h-full rounded-[4px] transition-[width] duration-700 ease-out"
              style={{ width: `${(d.qtd / max) * 100}%`, background: cores[d.situacao] }}
            />
          </div>
          <span className="num w-8 shrink-0 text-right text-[12.5px] text-ink">{d.qtd}</span>
          <span className="num w-[86px] shrink-0 text-right text-[11.5px] whitespace-nowrap text-faint">
            {moedaCompacta(d.valor)}
          </span>
        </li>
      ))}
    </ul>
  )
}
