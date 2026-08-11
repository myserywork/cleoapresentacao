import { useState } from 'react'
import { cn, moedaCompacta, numero } from '@/lib/format'

/**
 * Cartograma por UF.
 *
 * Cada UF é uma bolha posicionada no seu centroide real e dimensionada pelo
 * valor. Sem contorno do país: a própria distribuição das unidades desenha o
 * Brasil, e o que interessa — onde está o dinheiro — fica em primeiro plano.
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

/** Extremos com folga: as bolhas das pontas precisam caber inteiras. */
const LON_MIN = -76
const LON_MAX = -32
const LAT_MIN = -35
const LAT_MAX = 7

export interface ItemUf {
  uf: string
  valor: number
  qtd: number
}

export function MapaTerritorial({
  itens,
  altura = 300,
}: {
  itens: ItemUf[]
  altura?: number
}) {
  const [ativo, setAtivo] = useState<string | null>(null)
  const max = Math.max(...itens.map((i) => i.valor), 1)
  const emFoco = itens.find((i) => i.uf === ativo)

  const posicao = (uf: string) => {
    const c = CENTROIDE[uf]
    if (!c) return null
    return {
      x: ((c[0] - LON_MIN) / (LON_MAX - LON_MIN)) * 100,
      y: ((LAT_MAX - c[1]) / (LAT_MAX - LAT_MIN)) * 100,
    }
  }

  // Raio pela área, não pelo diâmetro: dobrar o valor dobra a área percebida.
  const raio = (valor: number) => 5 + Math.sqrt(valor / max) * 19

  return (
    <div onMouseLeave={() => setAtivo(null)}>
      <div className="relative" style={{ height: altura }}>
        {itens.map((item) => {
          const p = posicao(item.uf)
          if (!p) return null
          const r = raio(item.valor)
          const destacado = ativo === item.uf
          const apagado = ativo !== null && !destacado
          return (
            <button
              key={item.uf}
              onMouseEnter={() => setAtivo(item.uf)}
              aria-label={`${item.uf}: ${item.qtd} propostas, ${moedaCompacta(item.valor)}`}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-opacity"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: r * 2,
                height: r * 2,
                opacity: apagado ? 0.28 : 1,
              }}
            >
              <span
                className={cn(
                  'absolute inset-0 rounded-full border transition-colors',
                  destacado ? 'border-gold' : 'border-transparent',
                )}
                style={{ background: 'var(--color-viz-gold)', opacity: destacado ? 0.55 : 0.32 }}
              />
              <span
                className={cn(
                  'num relative text-[10px] font-medium',
                  destacado ? 'text-ink' : 'text-ink/75',
                )}
              >
                {r > 13 ? item.uf : ''}
              </span>
            </button>
          )
        })}
      </div>

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
          <span className="text-faint">
            Cada bolha é uma UF, no seu ponto geográfico, dimensionada pelo valor sob gestão.
          </span>
        )}
      </div>
    </div>
  )
}
