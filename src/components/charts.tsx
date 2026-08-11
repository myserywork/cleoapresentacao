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

export function Indicador({
  rotulo,
  valor,
  detalhe,
  formato = 'numero',
  tom = 'ink',
  icone,
}: {
  rotulo: string
  valor: number
  detalhe?: string
  formato?: 'numero' | 'moeda'
  tom?: 'ink' | 'gold' | 'teal' | 'cleo'
  icone?: React.ReactNode
}) {
  const animado = useContagem(valor)
  const cores = {
    ink: 'text-ink',
    gold: 'text-gold',
    teal: 'text-teal',
    cleo: 'text-cleo',
  }
  return (
    <div className="panel px-5 py-4">
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
