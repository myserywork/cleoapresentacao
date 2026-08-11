import type { Grafo } from './grafo'

/**
 * Simulação de forças com decaimento.
 *
 * A repulsão usa uma grade espacial: cada nó só é comparado com os vizinhos das
 * células adjacentes. Sem isso, algumas centenas de nós já derrubariam o quadro.
 */

const CELULA = 90
const REPULSAO = 3400
const COMPRIMENTO_MOLA = 52
const FORCA_MOLA = 0.028
const CENTRO = 0.00035
const ATRITO = 0.86
const DECAIMENTO = 0.992
const ALPHA_MIN = 0.02
/** Teto de deslocamento por tique — sem ele um hub muito ligado é arremessado. */
const VELOCIDADE_MAX = 12

export interface Simulacao {
  alpha: number
  passo: () => void
  reaquecer: () => void
}

export function criarSimulacao(grafo: Grafo): Simulacao {
  const estado = { alpha: 1 }
  const grade = new Map<number, number[]>()

  const chave = (cx: number, cy: number) => cx * 73856093 + cy * 19349663

  function passo() {
    const { nos, arestas } = grafo
    if (estado.alpha < ALPHA_MIN) return

    grade.clear()
    for (let i = 0; i < nos.length; i++) {
      const cx = Math.floor(nos[i].x / CELULA)
      const cy = Math.floor(nos[i].y / CELULA)
      const k = chave(cx, cy)
      const balde = grade.get(k)
      if (balde) balde.push(i)
      else grade.set(k, [i])
    }

    // Repulsão local
    for (let i = 0; i < nos.length; i++) {
      const a = nos[i]
      const cx = Math.floor(a.x / CELULA)
      const cy = Math.floor(a.y / CELULA)
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const balde = grade.get(chave(cx + dx, cy + dy))
          if (!balde) continue
          for (const j of balde) {
            if (j <= i) continue
            const b = nos[j]
            let ex = a.x - b.x
            let ey = a.y - b.y
            let d2 = ex * ex + ey * ey
            if (d2 === 0) {
              ex = (i % 7) - 3
              ey = (j % 7) - 3
              d2 = ex * ex + ey * ey || 1
            }
            if (d2 > CELULA * CELULA * 4) continue
            // Nós muito ligados empurram mais forte: é o que abre os clusters
            const massa = 1 + Math.min(a.grau + b.grau, 40) * 0.05
            const f = (REPULSAO * massa * estado.alpha) / d2
            const d = Math.sqrt(d2)
            const fx = (ex / d) * f
            const fy = (ey / d) * f
            a.vx += fx
            a.vy += fy
            b.vx -= fx
            b.vy -= fy
          }
        }
      }
    }

    // Molas das arestas
    for (const aresta of arestas) {
      const a = nos[aresta.origem]
      const b = nos[aresta.destino]
      const ex = b.x - a.x
      const ey = b.y - a.y
      const d = Math.hypot(ex, ey) || 1
      const f = (d - COMPRIMENTO_MOLA) * FORCA_MOLA * estado.alpha
      const fx = (ex / d) * f
      const fy = (ey / d) * f
      a.vx += fx
      a.vy += fy
      b.vx -= fx
      b.vy -= fy
    }

    // Gravidade fraca para o centro, senão os satélites escapam
    for (const n of nos) {
      n.vx -= n.x * CENTRO * estado.alpha
      n.vy -= n.y * CENTRO * estado.alpha
      n.vx *= ATRITO
      n.vy *= ATRITO
      const v = Math.hypot(n.vx, n.vy)
      if (v > VELOCIDADE_MAX) {
        n.vx = (n.vx / v) * VELOCIDADE_MAX
        n.vy = (n.vy / v) * VELOCIDADE_MAX
      }
      n.x += n.vx
      n.y += n.vy
    }

    estado.alpha *= DECAIMENTO
  }

  return {
    get alpha() {
      return estado.alpha
    },
    passo,
    reaquecer: () => {
      estado.alpha = 0.6
    },
  }
}
