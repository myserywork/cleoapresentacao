import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Focus, Maximize2, Route, Search, Sparkles, Waves } from 'lucide-react'
import { useApp } from '@/store/app'
import { getOrgao, getProponente, getProposta } from '@/data/repo'
import { CORES_TIPO, ROTULO_TIPO, montarGrafo, vizinhos, type TipoNo } from '@/cerebro/grafo'
import { criarSimulacao } from '@/cerebro/forca'
import {
  anelDeDistancia,
  calcularFechos,
  criarPulsos,
  desenharFechos,
  desenharPulsos,
  desenharRotulos,
  detectarClusters,
  projetar,
} from '@/cerebro/render'
import { cn, moedaCompacta, numero } from '@/lib/format'
import { Badge, Botao } from '@/components/ui'

const TIPOS: TipoNo[] = ['proposta', 'proponente', 'processo', 'documento', 'programa', 'minuta']
const QTD_PULSOS = 70
const SALTOS_EGO = 2
/** Quadros entre recálculos do fecho enquanto o layout ainda se move. */
const INTERVALO_FECHOS = 40

type Historia = 'panorama' | 'jornada' | 'producao' | 'movimenta'

const HISTORIAS: { id: Historia; rotulo: string; explica: string }[] = [
  {
    id: 'panorama',
    rotulo: 'Panorama',
    explica:
      'Tudo que a Cleo sabe sobre o órgão. Cada ponto é um registro real do banco; cada linha, um vínculo que existe entre eles.',
  },
  {
    id: 'jornada',
    rotulo: 'A jornada de um convênio',
    explica:
      'Um convênio do começo ao fim: o ente que propôs, a proposta, o processo autuado no SEI e os documentos gerados. É este caminho que a Cleo percorre sozinha.',
  },
  {
    id: 'producao',
    rotulo: 'O que a Cleo produziu',
    explica:
      'Só os processos e documentos criados pela automação, e as minutas que os originaram. O que está aceso aqui não foi digitado por ninguém.',
  },
  {
    id: 'movimenta',
    rotulo: 'Quem mais movimenta',
    explica:
      'Os entes com mais propostas e processos no órgão. O tamanho do ponto acompanha o número de vínculos.',
  },
]

export function Cerebro() {
  const { orgaoId, focoCerebro, setFocoCerebro } = useApp()
  const orgao = getOrgao(orgaoId)!
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const grafo = useMemo(() => montarGrafo(orgaoId), [orgaoId])
  const clusters = useMemo(() => detectarClusters(grafo), [grafo])

  const [selecionado, setSelecionado] = useState<number | null>(null)
  const [sobrevoado, setSobrevoado] = useState<number | null>(null)
  const [termo, setTermo] = useState('')
  const [ocultos, setOcultos] = useState<Set<TipoNo>>(new Set())
  const [fluxo, setFluxo] = useState(true)
  const [isolando, setIsolando] = useState(false)
  const [historia, setHistoria] = useState<Historia>('panorama')

  const camera = useRef({ x: 0, y: 0, zoom: 1 })
  const arraste = useRef<{ x: number; y: number; moveu: boolean } | null>(null)
  const cameraLivre = useRef(true)
  const pulsos = useRef(criarPulsos(grafo, QTD_PULSOS))

  useEffect(() => {
    pulsos.current = criarPulsos(grafo, QTD_PULSOS)
  }, [grafo])

  /* ---------- Recortes das histórias ---------- */

  const destaqueHistoria = useMemo(() => {
    if (historia === 'producao') {
      const conjunto = new Set<number>()
      grafo.nos.forEach((n, i) => {
        if (n.tipo === 'processo' || n.tipo === 'documento' || n.tipo === 'minuta') conjunto.add(i)
      })
      return conjunto
    }
    if (historia === 'movimenta') {
      const ordenados = grafo.nos
        .map((n, i) => ({ i, n }))
        .filter((x) => x.n.tipo === 'proponente')
        .sort((a, b) => b.n.grau - a.n.grau)
        .slice(0, 12)
      const conjunto = new Set<number>()
      for (const { i } of ordenados) {
        conjunto.add(i)
        for (const v of vizinhos(grafo, i)) conjunto.add(v)
      }
      return conjunto
    }
    return null
  }, [historia, grafo])

  /* ---------- Busca e realce ---------- */

  const correspondentes = useMemo(() => {
    const t = termo.trim().toLowerCase()
    if (!t) return null
    const conjunto = new Set<number>()
    grafo.nos.forEach((n, i) => {
      if (n.rotulo.toLowerCase().includes(t) || n.detalhe.toLowerCase().includes(t)) conjunto.add(i)
    })
    return conjunto
  }, [termo, grafo])

  const realce = useMemo(() => {
    const foco = selecionado ?? sobrevoado
    if (foco === null) return null
    const conjunto = vizinhos(grafo, foco)
    conjunto.add(foco)
    return { foco, conjunto }
  }, [selecionado, sobrevoado, grafo])

  const ego = useMemo(() => {
    if (!isolando || selecionado === null) return null
    return anelDeDistancia(grafo, selecionado, SALTOS_EGO)
  }, [isolando, selecionado, grafo])

  /** Cadeia legível: é isto que responde "o que estou vendo" sem interpretar grafo. */
  const cadeia = useMemo(() => {
    if (selecionado === null) return null
    const no = grafo.nos[selecionado]
    const idProposta = no.href?.split('/').pop()
    const proposta = idProposta ? getProposta(idProposta) : undefined
    if (!proposta) return null
    const proponente = getProponente(proposta.proponenteId)
    const docs = proposta.documentos.slice(0, 3)
    return {
      proposta,
      proponente,
      docs,
      pelaCleo: proposta.documentos.filter((d) => d.geradoPelaCleo).length,
    }
  }, [selecionado, grafo])

  const enquadrar = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const n of grafo.nos) {
      minX = Math.min(minX, n.x)
      maxX = Math.max(maxX, n.x)
      minY = Math.min(minY, n.y)
      maxY = Math.max(maxY, n.y)
    }
    camera.current.zoom = Math.min(
      canvas.clientWidth / (Math.max(maxX - minX, 1) * 1.12),
      canvas.clientHeight / (Math.max(maxY - minY, 1) * 1.12),
    )
    camera.current.x = (minX + maxX) / 2
    camera.current.y = (minY + maxY) / 2
  }, [grafo])

  const centralizarEm = useCallback(
    (indice: number, zoom = 2.6) => {
      cameraLivre.current = false
      const n = grafo.nos[indice]
      camera.current.x = n.x
      camera.current.y = n.y
      camera.current.zoom = Math.max(camera.current.zoom, zoom)
      setSelecionado(indice)
    },
    [grafo],
  )

  /* ---------- Histórias que movem a câmera ---------- */

  function contarHistoria(id: Historia) {
    setHistoria(id)
    setTermo('')

    if (id === 'panorama') {
      setIsolando(false)
      setSelecionado(null)
      cameraLivre.current = true
      enquadrar()
      return
    }

    if (id === 'jornada') {
      // Escolhe um convênio com a cadeia inteira: proponente, processo e documentos
      const alvo = grafo.nos.findIndex(
        (n) => n.tipo === 'proposta' && n.grau >= 3 && n.href,
      )
      if (alvo >= 0) {
        setIsolando(true)
        centralizarEm(alvo, 3.2)
      }
      return
    }

    setIsolando(false)
    setSelecionado(null)
    cameraLivre.current = true
    enquadrar()
  }

  /* ---------- Laço de desenho ---------- */

  const refs = useRef({
    realce,
    correspondentes,
    ocultos,
    ego,
    fluxo,
    destaqueHistoria,
  })
  refs.current = { realce, correspondentes, ocultos, ego, fluxo, destaqueHistoria }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const sim = criarSimulacao(grafo)

    let frame = 0
    let contador = 0
    let enquadrado = false
    let fechos = calcularFechos(grafo, clusters)

    const dimensionar = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = canvas.clientWidth * dpr
      canvas.height = canvas.clientHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    dimensionar()
    window.addEventListener('resize', dimensionar)

    const desenhar = () => {
      contador++
      const assentado = sim.alpha < 0.05

      for (let i = 0; i < (sim.alpha > 0.35 ? 3 : 1); i++) sim.passo()

      // Fechos só acompanham o layout enquanto ele muda
      if (!assentado && contador % INTERVALO_FECHOS === 0) {
        fechos = calcularFechos(grafo, clusters)
      }

      if (!enquadrado && cameraLivre.current) {
        enquadrar()
        if (assentado) {
          enquadrado = true
          fechos = calcularFechos(grafo, clusters)
        }
      }

      const vp = { largura: canvas.clientWidth, altura: canvas.clientHeight }
      const { px, py } = projetar(camera.current, vp)
      const est = refs.current

      const visivel = (i: number) => !est.ocultos.has(grafo.nos[i].tipo)

      ctx.clearRect(0, 0, vp.largura, vp.altura)

      if (!est.ego && est.destaqueHistoria === null) {
        desenharFechos(ctx, fechos, camera.current, vp, camera.current.zoom < 2 ? 1 : 0.35)
      }

      // Arestas
      ctx.lineWidth = Math.max(camera.current.zoom * 0.6, 0.4)
      for (const a of grafo.arestas) {
        if (!visivel(a.origem) || !visivel(a.destino)) continue
        const na = grafo.nos[a.origem]
        const nb = grafo.nos[a.destino]

        const dentroDoEgo = !est.ego || (est.ego.has(a.origem) && est.ego.has(a.destino))
        const naHistoria =
          !est.destaqueHistoria ||
          (est.destaqueHistoria.has(a.origem) && est.destaqueHistoria.has(a.destino))
        const destacada =
          est.realce && (est.realce.conjunto.has(a.origem) || est.realce.conjunto.has(a.destino))

        ctx.strokeStyle = destacada
          ? 'rgba(223,181,82,0.6)'
          : !dentroDoEgo || !naHistoria
            ? 'rgba(120,138,168,0.035)'
            : est.realce
              ? 'rgba(120,138,168,0.07)'
              : 'rgba(120,138,168,0.2)'
        ctx.beginPath()
        ctx.moveTo(px(na.x), py(na.y))
        ctx.lineTo(px(nb.x), py(nb.y))
        ctx.stroke()
      }

      if (est.fluxo && !est.ego) {
        desenharPulsos(ctx, grafo, pulsos.current, camera.current, vp, est.ocultos)
      }

      // Nós
      for (let i = 0; i < grafo.nos.length; i++) {
        if (!visivel(i)) continue
        const n = grafo.nos[i]
        const x = px(n.x)
        const y = py(n.y)
        if (x < -40 || x > vp.largura + 40 || y < -40 || y > vp.altura + 40) continue

        const distancia = est.ego?.get(i)
        const foraDoEgo = est.ego && distancia === undefined
        const foraDaHistoria = est.destaqueHistoria && !est.destaqueHistoria.has(i)
        const noRealce = !est.realce || est.realce.conjunto.has(i)
        const correspondeBusca = !est.correspondentes || est.correspondentes.has(i)
        const apagado = foraDoEgo || foraDaHistoria || !noRealce || !correspondeBusca

        const r = Math.max((n.raio + Math.min(n.grau, 14) * 0.22) * camera.current.zoom, 1.1)

        if (!apagado && n.grau > 10) {
          const halo = ctx.createRadialGradient(x, y, r, x, y, r * 3.2)
          halo.addColorStop(0, `${CORES_TIPO[n.tipo]}44`)
          halo.addColorStop(1, 'transparent')
          ctx.fillStyle = halo
          ctx.beginPath()
          ctx.arc(x, y, r * 3.2, 0, Math.PI * 2)
          ctx.fill()
        }

        ctx.globalAlpha = apagado ? 0.08 : 1
        ctx.fillStyle = CORES_TIPO[n.tipo]
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()

        if (est.ego && distancia !== undefined && distancia > 0) {
          ctx.globalAlpha = 1
          ctx.strokeStyle = distancia === 1 ? 'rgba(223,181,82,0.55)' : 'rgba(139,108,240,0.35)'
          ctx.lineWidth = 1.2
          ctx.beginPath()
          ctx.arc(x, y, r + 3, 0, Math.PI * 2)
          ctx.stroke()
        }

        if (!apagado && (est.realce?.foco === i || est.correspondentes?.has(i))) {
          ctx.globalAlpha = 1
          ctx.strokeStyle = '#dfb552'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(x, y, r + 5, 0, Math.PI * 2)
          ctx.stroke()
        }
      }
      ctx.globalAlpha = 1

      desenharRotulos(ctx, grafo, camera.current, vp, est.ocultos)

      if (est.realce) {
        const n = grafo.nos[est.realce.foco]
        const x = px(n.x)
        const y = py(n.y)
        ctx.font = '12px "IBM Plex Sans", system-ui, sans-serif'
        const texto = n.rotulo.length > 44 ? `${n.rotulo.slice(0, 44)}…` : n.rotulo
        const larg = ctx.measureText(texto).width
        ctx.fillStyle = 'rgba(7,10,18,0.94)'
        ctx.beginPath()
        ctx.roundRect(x + 12, y - 21, larg + 16, 22, 6)
        ctx.fill()
        ctx.strokeStyle = 'rgba(223,181,82,0.4)'
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.fillStyle = '#e7edf8'
        ctx.fillText(texto, x + 20, y - 6)
      }

      frame = requestAnimationFrame(desenhar)
    }

    frame = requestAnimationFrame(desenhar)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', dimensionar)
    }
  }, [grafo, clusters, enquadrar])

  /* ---------- Interação ---------- */

  const noEm = useCallback(
    (clienteX: number, clienteY: number): number | null => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      const mxp = clienteX - rect.left
      const myp = clienteY - rect.top
      const vp = { largura: canvas.clientWidth, altura: canvas.clientHeight }
      const { px, py } = projetar(camera.current, vp)

      let melhor: number | null = null
      let melhorDist = Infinity
      for (let i = 0; i < grafo.nos.length; i++) {
        const n = grafo.nos[i]
        if (ocultos.has(n.tipo)) continue
        const d = Math.hypot(px(n.x) - mxp, py(n.y) - myp)
        const alvo = Math.max(n.raio * camera.current.zoom + 6, 9)
        if (d < alvo && d < melhorDist) {
          melhor = i
          melhorDist = d
        }
      }
      return melhor
    },
    [grafo, ocultos],
  )

  useEffect(() => {
    if (!focoCerebro) return
    const alvo = grafo.nos.findIndex((n) => n.id === focoCerebro)
    if (alvo < 0) return
    const id = window.setTimeout(() => {
      centralizarEm(alvo, 3)
      setIsolando(true)
      setHistoria('jornada')
      setFocoCerebro(null)
    }, 1500)
    return () => window.clearTimeout(id)
  }, [focoCerebro, grafo, centralizarEm, setFocoCerebro])

  const detalhe = selecionado !== null ? grafo.nos[selecionado] : null
  const explicacao = HISTORIAS.find((h) => h.id === historia)!

  return (
    <div className="relative h-screen w-full overflow-hidden">
      <canvas
        ref={canvasRef}
        className={cn('h-full w-full', arraste.current ? 'cursor-grabbing' : 'cursor-grab')}
        onMouseMove={(e) => {
          if (arraste.current) {
            cameraLivre.current = false
            const dx = e.clientX - arraste.current.x
            const dy = e.clientY - arraste.current.y
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) arraste.current.moveu = true
            camera.current.x -= dx / camera.current.zoom
            camera.current.y -= dy / camera.current.zoom
            arraste.current.x = e.clientX
            arraste.current.y = e.clientY
            return
          }
          const alvo = noEm(e.clientX, e.clientY)
          setSobrevoado((prev) => (prev === alvo ? prev : alvo))
        }}
        onMouseDown={(e) => {
          arraste.current = { x: e.clientX, y: e.clientY, moveu: false }
        }}
        onMouseUp={(e) => {
          const moveu = arraste.current?.moveu
          arraste.current = null
          if (!moveu) setSelecionado(noEm(e.clientX, e.clientY))
        }}
        onMouseLeave={() => {
          arraste.current = null
          setSobrevoado(null)
        }}
        onWheel={(e) => {
          cameraLivre.current = false
          camera.current.zoom = Math.min(
            Math.max(camera.current.zoom * (e.deltaY < 0 ? 1.14 : 1 / 1.14), 0.15),
            12,
          )
        }}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 h-[190px] bg-linear-to-b from-abyss via-abyss/80 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[130px] bg-linear-to-t from-abyss via-abyss/70 to-transparent" />

      {/* Cabeçalho e histórias */}
      <div className="pointer-events-none absolute inset-x-0 top-0 p-7">
        <div className="pointer-events-auto flex items-start justify-between gap-6">
          <div className="max-w-[560px]">
            <div className="eyebrow mb-2">Cérebro da Cleopatra</div>
            <h1 className="text-[24px] leading-tight">
              Tudo que a Cleo sabe sobre o {orgao.sigla}
            </h1>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">{explicacao.explica}</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-[250px]">
              <Search
                size={14}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint"
              />
              <input
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && correspondentes?.size)
                    centralizarEm([...correspondentes][0])
                }}
                placeholder="Buscar registro…"
                className="h-9 w-full rounded-lg border border-line bg-surface/85 pr-3 pl-9 text-[12.5px] text-ink backdrop-blur-xl placeholder:text-faint focus:border-gold/50 focus:outline-none"
              />
            </div>
            <Botao
              onClick={() => setFluxo((v) => !v)}
              className={cn('bg-surface/85 backdrop-blur-xl', fluxo && 'border-cleo/45 text-cleo')}
              aria-label="Fluxo"
            >
              <Waves size={14} />
            </Botao>
            <Botao
              onClick={() => contarHistoria('panorama')}
              className="bg-surface/85 backdrop-blur-xl"
              aria-label="Enquadrar"
            >
              <Maximize2 size={14} />
            </Botao>
          </div>
        </div>

        {/* As histórias substituem o "explore por conta própria" — numa
            apresentação, ninguém tem tempo de descobrir o que o grafo quer dizer */}
        <div className="pointer-events-auto mt-5 flex flex-wrap gap-2">
          {HISTORIAS.map((h) => (
            <button
              key={h.id}
              onClick={() => contarHistoria(h.id)}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-[12.5px] backdrop-blur-xl transition-colors',
                historia === h.id
                  ? 'border-gold/50 bg-gold/12 text-gold'
                  : 'border-line bg-surface/80 text-muted hover:border-[#2c3c58] hover:text-ink',
              )}
            >
              {h.rotulo}
            </button>
          ))}
          {termo && (
            <span className="rounded-full border border-line bg-surface/80 px-3.5 py-1.5 text-[12.5px] backdrop-blur-xl">
              <span className="num text-gold">{correspondentes?.size ?? 0}</span>
              <span className="text-muted"> encontrados · Enter centraliza</span>
            </span>
          )}
        </div>
      </div>

      {/* Legenda */}
      <div className="absolute bottom-7 left-7 flex flex-col gap-1 rounded-xl border border-line bg-surface/85 p-3 backdrop-blur-xl">
        <div className="eyebrow mb-1 px-1">Tipos de registro</div>
        {TIPOS.map((t) => {
          const oculto = ocultos.has(t)
          return (
            <button
              key={t}
              onClick={() =>
                setOcultos((prev) => {
                  const p = new Set(prev)
                  if (p.has(t)) p.delete(t)
                  else p.add(t)
                  return p
                })
              }
              className={cn(
                'flex items-center gap-2.5 rounded-md px-1.5 py-1 text-left transition-opacity hover:bg-white/5',
                oculto && 'opacity-35',
              )}
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: CORES_TIPO[t] }}
              />
              <span className="flex-1 text-[12px] text-ink">{ROTULO_TIPO[t]}</span>
              <span className="num text-[11px] text-faint">{numero(grafo.porTipo[t])}</span>
            </button>
          )
        })}
      </div>

      {/* Cadeia legível do registro selecionado */}
      {detalhe && (
        <aside className="absolute top-[200px] right-7 flex w-[344px] flex-col rounded-xl border border-line bg-surface/95 p-5 backdrop-blur-xl">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className="size-2.5 rounded-full"
                style={{ background: CORES_TIPO[detalhe.tipo] }}
              />
              <span className="eyebrow">{ROTULO_TIPO[detalhe.tipo]}</span>
            </div>
            <button
              onClick={() => {
                setSelecionado(null)
                setIsolando(false)
              }}
              className="text-[11px] text-faint hover:text-ink"
            >
              fechar
            </button>
          </div>

          <h2 className="text-[16px] leading-snug break-words">{detalhe.rotulo}</h2>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{detalhe.detalhe}</p>

          {cadeia && (
            <div className="mt-4 border-t border-line pt-4">
              <div className="eyebrow mb-3 flex items-center gap-1.5">
                <Route size={11} /> A cadeia deste convênio
              </div>
              <ol className="flex flex-col gap-2">
                {[
                  {
                    tipo: 'proponente' as TipoNo,
                    rotulo: cadeia.proponente?.nome ?? '—',
                    nota: `${cadeia.proponente?.municipio} · ${cadeia.proponente?.uf}`,
                  },
                  {
                    tipo: 'proposta' as TipoNo,
                    rotulo: cadeia.proposta.numero,
                    nota: moedaCompacta(cadeia.proposta.valorGlobal),
                  },
                  {
                    tipo: 'processo' as TipoNo,
                    rotulo: cadeia.proposta.numProcessoSei ?? 'processo não autuado',
                    nota: cadeia.proposta.numProcessoSei ? 'autuado no SEI' : 'pendente',
                  },
                  {
                    tipo: 'documento' as TipoNo,
                    rotulo: `${cadeia.proposta.documentos.length} documentos`,
                    nota: `${cadeia.pelaCleo} gerados pela Cleo`,
                  },
                ].map((etapa, i) => (
                  <li key={i} className="flex items-center gap-2.5">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: CORES_TIPO[etapa.tipo] }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] text-ink">{etapa.rotulo}</span>
                      <span className="block text-[11px] text-faint">{etapa.nota}</span>
                    </span>
                    {i < 3 && <ArrowRight size={11} className="shrink-0 text-faint" />}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="mt-4 flex items-center gap-2 border-t border-line pt-4 text-[12px]">
            <span className="text-muted">Ligado a</span>
            <span className="num text-ink">{vizinhos(grafo, selecionado!).size}</span>
            <span className="text-muted">registros</span>
            {isolando && (
              <Badge tom="cleo">
                <Sparkles size={9} /> isolado
              </Badge>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <Botao
              onClick={() => setIsolando((v) => !v)}
              className={cn(isolando && 'border-cleo/50 text-cleo')}
            >
              <Focus size={13} />
              {isolando ? 'Mostrar o grafo inteiro' : 'Isolar este e seus vínculos'}
            </Botao>
            {detalhe.href && (
              <Link to={detalhe.href}>
                <Botao variante="primario" className="w-full">
                  Abrir registro
                </Botao>
              </Link>
            )}
          </div>
        </aside>
      )}
    </div>
  )
}
