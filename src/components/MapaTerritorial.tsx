import { useMemo, useState } from 'react'
import { moedaCompacta, numero } from '@/lib/format'

/**
 * Cartograma por UF.
 *
 * Cada UF é uma bolha ancorada no seu centroide real e dimensionada pelo valor.
 * Como o Nordeste tem seis capitais num palmo de mapa, as bolhas passam por uma
 * relaxação de colisão: cada uma cede o mínimo necessário para não sobrepor a
 * vizinha, presa ao seu ponto geográfico por um fio desenhado quando o desvio
 * fica perceptível. Toda bolha tem rótulo — bolha anônima é ruído.
 */

/** Centroides aproximados (longitude, latitude) de cada unidade da federação. */
const CENTROIDE: Record<string, [number, number]> = {
  AC: [-70.5, -9.0],
  AL: [-36.6, -9.6],
  AM: [-64.6, -4.1],
  AP: [-51.9, 1.4],
  BA: [-41.7, -12.5],
  CE: [-39.6, -5.2],
  DF: [-47.8, -15.8],
  ES: [-40.3, -19.6],
  GO: [-49.6, -15.9],
  MA: [-45.3, -5.0],
  MG: [-44.6, -18.5],
  MS: [-54.5, -20.5],
  MT: [-55.9, -13.0],
  PA: [-52.9, -4.0],
  PB: [-36.7, -7.2],
  PE: [-37.9, -8.3],
  PI: [-43.0, -7.7],
  PR: [-51.5, -24.6],
  RJ: [-42.6, -22.2],
  RN: [-36.5, -5.8],
  RO: [-63.0, -10.9],
  RR: [-61.4, 2.1],
  RS: [-53.2, -29.7],
  SC: [-50.5, -27.2],
  SE: [-37.4, -10.6],
  SP: [-48.6, -22.2],
  TO: [-48.3, -10.2],
}

const LON_MIN = -74
const LON_MAX = -34
const LAT_MIN = -33.5
const LAT_MAX = 4.5

/** Espaço virtual do desenho — o SVG escala junto com o painel. */
const LARGURA = 420
const ALTURA_VB = 400

export interface ItemUf {
  uf: string
  valor: number
  qtd: number
}

interface Bolha extends ItemUf {
  /** Âncora geográfica. */
  ax: number
  ay: number
  /** Posição depois da relaxação. */
  x: number
  y: number
  r: number
}

function montarLayout(itens: ItemUf[]): Bolha[] {
  const max = Math.max(...itens.map((i) => i.valor), 1)
  const bolhas: Bolha[] = []

  for (const item of itens) {
    const c = CENTROIDE[item.uf]
    if (!c) continue
    const x = ((c[0] - LON_MIN) / (LON_MAX - LON_MIN)) * LARGURA
    const y = ((LAT_MAX - c[1]) / (LAT_MAX - LAT_MIN)) * ALTURA_VB
    // Raio pela área, não pelo diâmetro: dobrar o valor dobra a área percebida
    const r = 9 + Math.sqrt(item.valor / max) * 27
    bolhas.push({ ...item, ax: x, ay: y, x, y, r })
  }

  // Relaxação: separa pares sobrepostos e puxa cada bolha de volta à âncora.
  // Poucas dezenas de bolhas — dá para ser direto e determinístico.
  for (let volta = 0; volta < 120; volta++) {
    for (let i = 0; i < bolhas.length; i++) {
      for (let j = i + 1; j < bolhas.length; j++) {
        const a = bolhas[i]
        const b = bolhas[j]
        let dx = b.x - a.x
        let dy = b.y - a.y
        let d = Math.hypot(dx, dy)
        if (d === 0) {
          dx = 0.5
          dy = i - j
          d = Math.hypot(dx, dy)
        }
        const minimo = a.r + b.r + 2
        if (d >= minimo) continue
        const ajuste = (minimo - d) / 2
        const ux = dx / d
        const uy = dy / d
        a.x -= ux * ajuste
        a.y -= uy * ajuste
        b.x += ux * ajuste
        b.y += uy * ajuste
      }
    }
    for (const b of bolhas) {
      b.x += (b.ax - b.x) * 0.06
      b.y += (b.ay - b.y) * 0.06
      // Nada escapa da moldura
      b.x = Math.min(Math.max(b.x, b.r + 2), LARGURA - b.r - 2)
      b.y = Math.min(Math.max(b.y, b.r + 2), ALTURA_VB - b.r - 2)
    }
  }

  return bolhas.sort((a, b) => b.r - a.r)
}

export function MapaTerritorial({
  itens,
  altura = 300,
}: {
  itens: ItemUf[]
  altura?: number
}) {
  const [ativo, setAtivo] = useState<string | null>(null)
  const bolhas = useMemo(() => montarLayout(itens), [itens])
  const emFoco = itens.find((i) => i.uf === ativo)

  return (
    <div onMouseLeave={() => setAtivo(null)}>
      {/* Vinte e sete bolhas num palmo de celular viram borrão: abaixo de sm o
          mesmo dado vira ranking, que é o que cabe e o que se lê. */}
      <div className="sm:hidden">
        <RankingUf itens={itens} ativo={ativo} aoTocar={setAtivo} />
      </div>

      <svg
        viewBox={`0 0 ${LARGURA} ${ALTURA_VB}`}
        style={{ width: '100%', height: altura }}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Distribuição do valor sob gestão por unidade da federação"
        className="hidden sm:block"
      >
        {/* Fios até a âncora geográfica: a bolha cedeu espaço, não mudou de lugar */}
        {bolhas.map((b) => {
          const desvio = Math.hypot(b.x - b.ax, b.y - b.ay)
          if (desvio < 7) return null
          return (
            <g key={`fio-${b.uf}`} opacity={ativo && ativo !== b.uf ? 0.15 : 0.4}>
              <line
                x1={b.ax}
                y1={b.ay}
                x2={b.x}
                y2={b.y}
                stroke="var(--color-viz-gold)"
                strokeWidth="0.7"
                strokeDasharray="2 3"
              />
              <circle cx={b.ax} cy={b.ay} r="1.6" fill="var(--color-viz-gold)" />
            </g>
          )
        })}

        {bolhas.map((b) => {
          const destacada = ativo === b.uf
          const apagada = ativo !== null && !destacada
          const fonte = Math.max(Math.min(b.r * 0.62, 13), 8.5)
          const rotuloDentro = b.r >= 12
          return (
            <g
              key={b.uf}
              opacity={apagada ? 0.3 : 1}
              onMouseEnter={() => setAtivo(b.uf)}
              onClick={() => setAtivo((a) => (a === b.uf ? null : b.uf))}
              style={{ cursor: 'pointer', transition: 'opacity 160ms ease-out' }}
            >
              <circle
                cx={b.x}
                cy={b.y}
                r={b.r}
                fill="var(--color-viz-gold)"
                fillOpacity={destacada ? 0.55 : 0.3}
                stroke={destacada ? 'var(--color-gold)' : 'var(--color-viz-gold)'}
                strokeOpacity={destacada ? 1 : 0.45}
                strokeWidth={destacada ? 1.4 : 0.8}
              />
              {rotuloDentro ? (
                <>
                  <text
                    x={b.x}
                    y={b.r >= 22 ? b.y - 2 : b.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={fonte}
                    fontWeight="600"
                    fill="var(--color-ink)"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {b.uf}
                  </text>
                  {b.r >= 22 && (
                    <text
                      x={b.x}
                      y={b.y + fonte * 0.85}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={Math.max(b.r * 0.3, 7.5)}
                      fill="var(--color-ink)"
                      opacity="0.75"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {moedaCompacta(b.valor).replace('R$ ', '')}
                    </text>
                  )}
                </>
              ) : (
                // Bolha pequena demais para conter texto: o rótulo senta ao lado
                <text
                  x={b.x + b.r + 2.5}
                  y={b.y}
                  textAnchor="start"
                  dominantBaseline="middle"
                  fontSize="8"
                  fill="var(--color-muted)"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {b.uf}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* Legenda fora da área do mapa, para não disputar espaço com as bolhas */}
      <div className="flex min-h-[30px] items-center gap-4 border-t border-line pt-3 text-[12px]">
        {emFoco ? (
          <>
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-gold" />
              <span className="text-ink">{emFoco.uf}</span>
            </span>
            <span className="num text-muted">{numero(emFoco.qtd)} propostas</span>
            <span className="num text-gold">{moedaCompacta(emFoco.valor)}</span>
          </>
        ) : (
          <>
            <span className="text-faint sm:hidden">
              Valor sob gestão por unidade da federação. Toque numa linha para os números.
            </span>
            <span className="hidden text-faint sm:inline">
              Cada bolha é uma UF, presa ao seu ponto geográfico pelo fio, dimensionada pelo valor
              sob gestão.
            </span>
          </>
        )}
      </div>
    </div>
  )
}

/** Quantas UFs cabem no celular antes de a lista virar rolagem infinita. */
const TOPO_MOBILE = 9

function RankingUf({
  itens,
  ativo,
  aoTocar,
}: {
  itens: ItemUf[]
  ativo: string | null
  aoTocar: (uf: string | null) => void
}) {
  const ordenado = [...itens].sort((a, b) => b.valor - a.valor)
  const topo = ordenado.slice(0, TOPO_MOBILE)
  const resto = ordenado.slice(TOPO_MOBILE)
  const teto = topo[0]?.valor || 1

  return (
    <ul className="flex flex-col gap-2 pb-3">
      {topo.map((i) => (
        <li key={i.uf}>
          <button
            onClick={() => aoTocar(ativo === i.uf ? null : i.uf)}
            className="flex w-full items-center gap-3 text-left"
          >
            <span className="num w-6 shrink-0 text-[12px] text-ink">{i.uf}</span>
            <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
              <span
                className="block h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${Math.max((i.valor / teto) * 100, 3)}%`,
                  background: 'var(--color-viz-gold)',
                  opacity: ativo && ativo !== i.uf ? 0.35 : 0.85,
                }}
              />
            </span>
            <span className="num w-[74px] shrink-0 text-right text-[11.5px] whitespace-nowrap text-gold">
              {moedaCompacta(i.valor)}
            </span>
          </button>
        </li>
      ))}
      {resto.length > 0 && (
        <li className="num pt-0.5 text-[11px] text-faint">
          + {resto.length} UFs somando {moedaCompacta(resto.reduce((s, i) => s + i.valor, 0))}
        </li>
      )}
    </ul>
  )
}
