import { CORES_TIPO, type Grafo, type No, type TipoNo } from './grafo'

/**
 * Camadas de desenho do Cérebro.
 *
 * Separadas do componente porque cada uma é uma decisão visual independente:
 * a envoltória do cluster, o pulso que percorre a aresta, o rótulo que só
 * aparece com zoom suficiente. Juntas dão a impressão de um organismo vivo —
 * que é literalmente o que os dados do órgão são.
 */

export interface Camera {
  x: number
  y: number
  zoom: number
}

export interface Viewport {
  largura: number
  altura: number
}

export function projetar(camera: Camera, vp: Viewport) {
  return {
    px: (x: number) => (x - camera.x) * camera.zoom + vp.largura / 2,
    py: (y: number) => (y - camera.y) * camera.zoom + vp.altura / 2,
  }
}

/* ---------- Vinheta ---------- */

/**
 * Escurece as bordas da tela. O olho vai para onde há luz — e a luz fica no
 * centro, onde o grafo mora. É o truque mais barato de sala de cinema que existe.
 */
export function desenharVinheta(ctx: CanvasRenderingContext2D, vp: Viewport) {
  const g = ctx.createRadialGradient(
    vp.largura / 2,
    vp.altura / 2,
    Math.min(vp.largura, vp.altura) * 0.34,
    vp.largura / 2,
    vp.altura / 2,
    Math.max(vp.largura, vp.altura) * 0.72,
  )
  g.addColorStop(0, 'rgba(7,10,18,0)')
  g.addColorStop(1, 'rgba(7,10,18,0.55)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, vp.largura, vp.altura)
}

/* ---------- Envoltória convexa por cluster ---------- */

/** Fecho convexo (varredura de Andrew) — a silhueta que agrupa um conjunto. */
function fechoConvexo(pontos: { x: number; y: number }[]): { x: number; y: number }[] {
  if (pontos.length < 3) return pontos
  const ordenados = [...pontos].sort((a, b) => a.x - b.x || a.y - b.y)
  const cruz = (o: any, a: any, b: any) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)

  const inferior: typeof pontos = []
  for (const p of ordenados) {
    while (inferior.length >= 2 && cruz(inferior.at(-2), inferior.at(-1), p) <= 0) inferior.pop()
    inferior.push(p)
  }
  const superior: typeof pontos = []
  for (const p of [...ordenados].reverse()) {
    while (superior.length >= 2 && cruz(superior.at(-2), superior.at(-1), p) <= 0) superior.pop()
    superior.push(p)
  }
  return [...inferior.slice(0, -1), ...superior.slice(0, -1)]
}

export interface Cluster {
  chave: string
  rotulo: string
  tipo: TipoNo
  indices: number[]
}

/**
 * Agrupa por proponente.
 *
 * O programa liga propostas do órgão inteiro, então a envoltória dele
 * englobaria tudo e não diria nada. O proponente, não: ele e suas propostas,
 * processos e documentos formam a vizinhança que a força mantém junta — que é
 * exatamente a história "este ente e tudo que ele tocou".
 */
export function detectarClusters(grafo: Grafo): Cluster[] {
  const clusters: Cluster[] = []
  const vizinhosDe = new Map<number, number[]>()

  for (const a of grafo.arestas) {
    if (!vizinhosDe.has(a.origem)) vizinhosDe.set(a.origem, [])
    if (!vizinhosDe.has(a.destino)) vizinhosDe.set(a.destino, [])
    vizinhosDe.get(a.origem)!.push(a.destino)
    vizinhosDe.get(a.destino)!.push(a.origem)
  }

  grafo.nos.forEach((n, i) => {
    if (n.tipo !== 'proponente') return
    const propostas = (vizinhosDe.get(i) ?? []).filter(
      (v) => grafo.nos[v].tipo === 'proposta',
    )
    if (propostas.length < 2) return

    // Puxa também o que pende de cada proposta: processo e documentos
    const membros = new Set<number>([i, ...propostas])
    for (const p of propostas) {
      for (const v of vizinhosDe.get(p) ?? []) {
        if (grafo.nos[v].tipo === 'processo') {
          membros.add(v)
          for (const d of vizinhosDe.get(v) ?? []) {
            if (grafo.nos[d].tipo === 'documento') membros.add(d)
          }
        }
      }
    }

    clusters.push({ chave: n.id, rotulo: n.rotulo, tipo: n.tipo, indices: [...membros] })
  })

  return clusters
}

/**
 * Fechos em coordenadas do mundo.
 *
 * Separado do desenho de propósito: recalcular o fecho convexo de uma centena de
 * clusters a cada quadro era a causa da lentidão. Agora o cálculo acontece
 * quando o layout muda; o desenho apenas projeta.
 */
export function calcularFechos(
  grafo: Grafo,
  clusters: Cluster[],
): { pontos: { x: number; y: number }[]; extensao: number }[] {
  const fechos: { pontos: { x: number; y: number }[]; extensao: number }[] = []

  for (const cluster of clusters) {
    const pontos = cluster.indices
      .map((i) => grafo.nos[i])
      .filter(Boolean)
      .map((n) => ({ x: n.x, y: n.y }))
    if (pontos.length < 3) continue

    const fecho = fechoConvexo(pontos)
    if (fecho.length < 3) continue

    const xs = fecho.map((p) => p.x)
    const ys = fecho.map((p) => p.y)
    const extensao = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
    fechos.push({ pontos: fecho, extensao })
  }

  return fechos
}

export function desenharFechos(
  ctx: CanvasRenderingContext2D,
  fechos: { pontos: { x: number; y: number }[]; extensao: number }[],
  camera: Camera,
  vp: Viewport,
  intensidade: number,
) {
  if (intensidade <= 0.01) return
  const { px, py } = projetar(camera, vp)
  // Cluster espalhado demais não agrupa nada — só suja a tela
  const limite = (Math.min(vp.largura, vp.altura) * 0.42) / camera.zoom

  for (const fecho of fechos) {
    if (fecho.extensao > limite) continue

    ctx.beginPath()
    for (let i = 0; i < fecho.pontos.length; i++) {
      const atual = fecho.pontos[i]
      const proximo = fecho.pontos[(i + 1) % fecho.pontos.length]
      const mx = px((atual.x + proximo.x) / 2)
      const my = py((atual.y + proximo.y) / 2)
      if (i === 0) ctx.moveTo(mx, my)
      else ctx.quadraticCurveTo(px(atual.x), py(atual.y), mx, my)
    }
    ctx.closePath()

    ctx.fillStyle = `rgba(125,140,166,${0.055 * intensidade})`
    ctx.fill()
    ctx.strokeStyle = `rgba(125,140,166,${0.2 * intensidade})`
    ctx.lineWidth = 1
    ctx.stroke()
  }
}

/* ---------- Pulsos ---------- */

export interface Pulso {
  aresta: number
  progresso: number
  velocidade: number
}

/**
 * Cria os pulsos que percorrem as arestas.
 *
 * Não é enfeite: cada pulso viaja no sentido proposta → processo → documento,
 * que é o sentido em que o trabalho realmente flui no órgão.
 */
export function criarPulsos(grafo: Grafo, quantidade: number): Pulso[] {
  const candidatas: number[] = []
  grafo.arestas.forEach((a, i) => {
    const to = grafo.nos[a.origem].tipo
    const td = grafo.nos[a.destino].tipo
    const fluxo =
      (to === 'proposta' && td === 'processo') ||
      (to === 'processo' && td === 'documento') ||
      (to === 'documento' && td === 'minuta')
    if (fluxo) candidatas.push(i)
  })

  const fonte = candidatas.length > 0 ? candidatas : grafo.arestas.map((_, i) => i)
  return Array.from({ length: Math.min(quantidade, fonte.length) }, (_, k) => ({
    aresta: fonte[(k * 7919) % fonte.length],
    progresso: (k / quantidade) % 1,
    velocidade: 0.0022 + ((k * 37) % 100) / 90_000,
  }))
}

export function desenharPulsos(
  ctx: CanvasRenderingContext2D,
  grafo: Grafo,
  pulsos: Pulso[],
  camera: Camera,
  vp: Viewport,
  ocultos: Set<TipoNo>,
) {
  const { px, py } = projetar(camera, vp)

  for (const pulso of pulsos) {
    const aresta = grafo.arestas[pulso.aresta]
    if (!aresta) continue
    const a = grafo.nos[aresta.origem]
    const b = grafo.nos[aresta.destino]
    if (ocultos.has(a.tipo) || ocultos.has(b.tipo)) continue

    pulso.progresso += pulso.velocidade
    if (pulso.progresso > 1) pulso.progresso -= 1

    const t = pulso.progresso
    const x = px(a.x + (b.x - a.x) * t)
    const y = py(a.y + (b.y - a.y) * t)

    // Cauda: dá direção ao movimento sem precisar de seta
    const tc = Math.max(t - 0.12, 0)
    const xc = px(a.x + (b.x - a.x) * tc)
    const yc = py(a.y + (b.y - a.y) * tc)

    const gradiente = ctx.createLinearGradient(xc, yc, x, y)
    gradiente.addColorStop(0, 'rgba(139,108,240,0)')
    gradiente.addColorStop(1, 'rgba(180,155,247,0.85)')
    ctx.strokeStyle = gradiente
    ctx.lineWidth = Math.max(1.6 * camera.zoom, 1)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(xc, yc)
    ctx.lineTo(x, y)
    ctx.stroke()

    // Cabeça do cometa: um brilho suave por baixo do ponto sólido
    const raioCabeca = Math.max(1.6 * camera.zoom, 1.2)
    const brilho = ctx.createRadialGradient(x, y, 0, x, y, raioCabeca * 3.4)
    brilho.addColorStop(0, 'rgba(200,182,255,0.5)')
    brilho.addColorStop(1, 'rgba(200,182,255,0)')
    ctx.fillStyle = brilho
    ctx.beginPath()
    ctx.arc(x, y, raioCabeca * 3.4, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = 'rgba(200,182,255,0.95)'
    ctx.beginPath()
    ctx.arc(x, y, raioCabeca, 0, Math.PI * 2)
    ctx.fill()
  }
}

/* ---------- Rótulos por nível de zoom ---------- */

/**
 * Só rotula o que cabe: abaixo de certo zoom, rótulo vira ruído cinza. Hubs
 * aparecem antes dos satélites porque são eles que orientam a leitura.
 */
export function desenharRotulos(
  ctx: CanvasRenderingContext2D,
  grafo: Grafo,
  camera: Camera,
  vp: Viewport,
  ocultos: Set<TipoNo>,
) {
  if (camera.zoom < 0.85) return
  const { px, py } = projetar(camera, vp)
  const grauMinimo = camera.zoom > 2.6 ? 0 : camera.zoom > 1.7 ? 4 : 12

  ctx.font = '11px "IBM Plex Sans", system-ui, sans-serif'
  ctx.textAlign = 'center'

  const ocupados: { x: number; y: number; w: number }[] = []
  const TETO = 28

  for (const n of grafo.nos) {
    if (ocupados.length >= TETO) break
    if (ocultos.has(n.tipo)) continue
    if (n.grau < grauMinimo) continue

    const x = px(n.x)
    const y = py(n.y)
    if (x < 0 || x > vp.largura || y < 0 || y > vp.altura) continue

    const texto = n.rotulo.length > 26 ? `${n.rotulo.slice(0, 26)}…` : n.rotulo
    const largura = ctx.measureText(texto).width

    // Evita sobreposição: rótulo em cima de rótulo não se lê
    const colide = ocupados.some(
      (o) => Math.abs(o.x - x) < (o.w + largura) / 2 + 6 && Math.abs(o.y - y) < 14,
    )
    if (colide) continue
    ocupados.push({ x, y, w: largura })

    const alturaTexto = y + n.raio * camera.zoom + 12
    ctx.fillStyle = 'rgba(7,10,18,0.75)'
    ctx.fillRect(x - largura / 2 - 3, alturaTexto - 9, largura + 6, 13)
    ctx.fillStyle = 'rgba(231,237,248,0.92)'
    ctx.fillText(texto, x, alturaTexto)
  }
  ctx.textAlign = 'left'
}

/* ---------- Ego-network ---------- */

/** Distância em saltos a partir de um nó, até o limite pedido. */
export function anelDeDistancia(grafo: Grafo, origem: number, maxSaltos: number): Map<number, number> {
  const distancia = new Map<number, number>([[origem, 0]])
  let fronteira = [origem]

  const adjacencia = new Map<number, number[]>()
  for (const a of grafo.arestas) {
    if (!adjacencia.has(a.origem)) adjacencia.set(a.origem, [])
    if (!adjacencia.has(a.destino)) adjacencia.set(a.destino, [])
    adjacencia.get(a.origem)!.push(a.destino)
    adjacencia.get(a.destino)!.push(a.origem)
  }

  for (let salto = 1; salto <= maxSaltos; salto++) {
    const proxima: number[] = []
    for (const i of fronteira) {
      for (const v of adjacencia.get(i) ?? []) {
        if (distancia.has(v)) continue
        distancia.set(v, salto)
        proxima.push(v)
      }
    }
    fronteira = proxima
    if (fronteira.length === 0) break
  }

  return distancia
}

export function corDoNo(n: No): string {
  return CORES_TIPO[n.tipo]
}
