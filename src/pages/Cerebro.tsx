import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Clapperboard,
  Focus,
  History,
  Maximize2,
  Pause,
  Play,
  Route,
  Search,
  Sparkles,
  Waves,
  X,
} from 'lucide-react'
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
  desenharVinheta,
  detectarClusters,
  projetar,
} from '@/cerebro/render'
import { cn, moedaCompacta, numero } from '@/lib/format'
import { Badge, Botao } from '@/components/ui'

const TIPOS: TipoNo[] = [
  'proposta',
  'proponente',
  'processo',
  'documento',
  'programa',
  'minuta',
  'emenda',
  'parlamentar',
  'uf',
]
const QTD_PULSOS = 70
const SALTOS_EGO = 2
/** Quadros entre recálculos do fecho enquanto o layout ainda se move. */
const INTERVALO_FECHOS = 40

type Historia =
  | 'panorama'
  | 'jornada'
  | 'dinheiro'
  | 'territorio'
  | 'producao'
  | 'travado'
  | 'movimenta'

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
    id: 'dinheiro',
    rotulo: 'De onde vem o dinheiro',
    explica:
      'Parlamentar, emenda e proposta no mesmo caminho. Partindo de um gabinete, o grafo mostra em que município a indicação virou obra — e onde ela parou.',
  },
  {
    id: 'territorio',
    rotulo: 'Onde o dinheiro cai',
    explica:
      'O recorte geográfico: cada unidade da federação puxa os proponentes que atende, e cada proponente, as propostas que apresentou.',
  },
  {
    id: 'producao',
    rotulo: 'O que a Cleo produziu',
    explica:
      'Só os processos e documentos criados pela automação, e as minutas que os originaram. O que está aceso aqui não foi digitado por ninguém.',
  },
  {
    id: 'travado',
    rotulo: 'Onde o fluxo para',
    explica:
      'As propostas que ainda não têm processo no SEI — o ponto exato em que o trabalho manual não deu conta. É por aqui que a automação começa.',
  },
  {
    id: 'movimenta',
    rotulo: 'Quem mais movimenta',
    explica:
      'Os entes com mais propostas e processos no órgão. O tamanho do ponto acompanha o número de vínculos.',
  },
]

/**
 * Roteiro do modo cinema: as histórias em sequência, cada uma com tempo de
 * tela. O Cérebro se apresenta sozinho enquanto o apresentador fala — ou
 * enquanto ninguém fala, num telão de recepção.
 */
const CINEMA: { id: Historia; duracaoMs: number }[] = [
  { id: 'panorama', duracaoMs: 9000 },
  { id: 'jornada', duracaoMs: 11000 },
  { id: 'dinheiro', duracaoMs: 11000 },
  { id: 'territorio', duracaoMs: 9000 },
  { id: 'producao', duracaoMs: 9000 },
  { id: 'travado', duracaoMs: 9000 },
  { id: 'movimenta', duracaoMs: 9000 },
]

/** Duração da varredura completa da linha do tempo, em milissegundos. */
const DURACAO_LINHA_TEMPO = 20_000

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

  // Modo cinema: o Cérebro percorre as histórias sozinho
  const [cinema, setCinema] = useState(false)
  const [cenaCinema, setCenaCinema] = useState(0)

  // Linha do tempo: o conhecimento crescendo na ordem em que foi aprendido
  const [modoTempo, setModoTempo] = useState(false)
  const [reproduzindoTempo, setReproduzindoTempo] = useState(false)
  const [tempoUi, setTempoUi] = useState(1)
  const tempoRef = useRef(1)

  const camera = useRef({ x: 0, y: 0, zoom: 1 })
  /** Destino da câmera — o laço de desenho anima até ele em vez de teleportar. */
  const alvoCam = useRef<{ x: number; y: number; zoom: number } | null>(null)
  const arraste = useRef<{ x: number; y: number; moveu: boolean } | null>(null)
  const cameraLivre = useRef(true)
  const pulsos = useRef(criarPulsos(grafo, QTD_PULSOS))

  useEffect(() => {
    pulsos.current = criarPulsos(grafo, QTD_PULSOS)
  }, [grafo])

  /** Instante de cada nó em milissegundos — parsear ISO a cada quadro custaria caro. */
  const temposMs = useMemo(() => grafo.nos.map((n) => new Date(n.tempo).getTime()), [grafo])
  const faixaTempo = useMemo(() => {
    let min = Infinity
    let max = -Infinity
    for (const t of temposMs) {
      if (t < min) min = t
      if (t > max) max = t
    }
    return { min, max: Math.max(max, min + 1) }
  }, [temposMs])

  /* ---------- Recortes das histórias ---------- */

  const destaqueHistoria = useMemo(() => {
    if (historia === 'producao') {
      const conjunto = new Set<number>()
      grafo.nos.forEach((n, i) => {
        if (n.tipo === 'processo' || n.tipo === 'documento' || n.tipo === 'minuta') conjunto.add(i)
      })
      return conjunto
    }
    if (historia === 'dinheiro') {
      const conjunto = new Set<number>()
      grafo.nos.forEach((n, i) => {
        if (n.tipo === 'parlamentar' || n.tipo === 'emenda') {
          conjunto.add(i)
          for (const v of vizinhos(grafo, i)) conjunto.add(v)
        }
      })
      return conjunto
    }
    if (historia === 'territorio') {
      const conjunto = new Set<number>()
      grafo.nos.forEach((n, i) => {
        if (n.tipo === 'uf' || n.tipo === 'proponente') {
          conjunto.add(i)
          for (const v of vizinhos(grafo, i)) conjunto.add(v)
        }
      })
      return conjunto
    }
    if (historia === 'travado') {
      // Proposta sem vizinho do tipo processo: o trabalho parou antes do SEI.
      const conjunto = new Set<number>()
      grafo.nos.forEach((n, i) => {
        if (n.tipo !== 'proposta') return
        let temProcesso = false
        for (const v of vizinhos(grafo, i)) {
          if (grafo.nos[v].tipo === 'processo') {
            temProcesso = true
            break
          }
        }
        if (!temProcesso) {
          conjunto.add(i)
          for (const v of vizinhos(grafo, i)) conjunto.add(v)
        }
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

  const medirEnquadramento = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return null
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
    return {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      zoom: Math.min(
        canvas.clientWidth / (Math.max(maxX - minX, 1) * 1.12),
        canvas.clientHeight / (Math.max(maxY - minY, 1) * 1.12),
      ),
    }
  }, [grafo])

  /** Enquadramento seco — usado só enquanto o layout inicial assenta. */
  const enquadrar = useCallback(() => {
    const alvo = medirEnquadramento()
    if (!alvo) return
    camera.current.x = alvo.x
    camera.current.y = alvo.y
    camera.current.zoom = alvo.zoom
  }, [medirEnquadramento])

  /** Enquadramento animado — a câmera viaja até o quadro geral. */
  const enquadrarSuave = useCallback(() => {
    const alvo = medirEnquadramento()
    if (alvo) alvoCam.current = alvo
  }, [medirEnquadramento])

  const centralizarEm = useCallback(
    (indice: number, zoom = 2.6) => {
      cameraLivre.current = false
      const n = grafo.nos[indice]
      alvoCam.current = { x: n.x, y: n.y, zoom: Math.max(camera.current.zoom, zoom) }
      setSelecionado(indice)
    },
    [grafo],
  )

  /* ---------- Histórias que movem a câmera ---------- */

  /** O nó de maior grau de um tipo — a âncora natural de cada história. */
  const maiorDoTipo = useCallback(
    (tipo: TipoNo): number => {
      let alvo = -1
      let melhor = -1
      grafo.nos.forEach((n, i) => {
        if (n.tipo === tipo && n.grau > melhor) {
          melhor = n.grau
          alvo = i
        }
      })
      return alvo
    },
    [grafo],
  )

  function contarHistoria(id: Historia) {
    setHistoria(id)
    setTermo('')
    setModoTempo(false)
    tempoRef.current = 1

    if (id === 'jornada') {
      // Escolhe um convênio com a cadeia inteira: proponente, processo e documentos
      const alvo = grafo.nos.findIndex((n) => n.tipo === 'proposta' && n.grau >= 3 && n.href)
      if (alvo >= 0) {
        setIsolando(true)
        centralizarEm(alvo, 3.2)
      }
      return
    }

    if (id === 'dinheiro') {
      // O parlamentar com mais vínculos: é dele que sai a cadeia mais rica.
      const alvo = maiorDoTipo('parlamentar')
      if (alvo >= 0) {
        setIsolando(true)
        centralizarEm(alvo, 2.4)
        return
      }
    }

    if (id === 'territorio') {
      // A UF que mais recebe: dá um centro à história geográfica.
      const alvo = maiorDoTipo('uf')
      if (alvo >= 0) {
        setIsolando(false)
        centralizarEm(alvo, 1.6)
        return
      }
    }

    if (id === 'movimenta') {
      const alvo = maiorDoTipo('proponente')
      if (alvo >= 0) {
        setIsolando(false)
        centralizarEm(alvo, 1.9)
        return
      }
    }

    setIsolando(false)
    setSelecionado(null)
    cameraLivre.current = true
    enquadrarSuave()
  }

  /* ---------- Modo cinema ---------- */

  useEffect(() => {
    if (!cinema) return
    const cena = CINEMA[cenaCinema % CINEMA.length]
    contarHistoria(cena.id)
    const t = window.setTimeout(
      () => setCenaCinema((c) => (c + 1) % CINEMA.length),
      cena.duracaoMs,
    )
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cinema, cenaCinema])

  useEffect(() => {
    if (!cinema) return
    const sair = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCinema(false)
    }
    window.addEventListener('keydown', sair)
    return () => window.removeEventListener('keydown', sair)
  }, [cinema])

  /* ---------- Linha do tempo ---------- */

  useEffect(() => {
    if (!reproduzindoTempo) return
    let quadro = 0
    let anterior = performance.now()
    const passo = (agora: number) => {
      const dt = agora - anterior
      anterior = agora
      const proximo = Math.min(tempoRef.current + dt / DURACAO_LINHA_TEMPO, 1)
      tempoRef.current = proximo
      setTempoUi(proximo)
      if (proximo >= 1) {
        setReproduzindoTempo(false)
        return
      }
      quadro = requestAnimationFrame(passo)
    }
    quadro = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(quadro)
  }, [reproduzindoTempo])

  function abrirLinhaDoTempo() {
    setModoTempo(true)
    setIsolando(false)
    setSelecionado(null)
    setHistoria('panorama')
    cameraLivre.current = true
    enquadrarSuave()
    tempoRef.current = 0
    setTempoUi(0)
    setReproduzindoTempo(true)
  }

  function fecharLinhaDoTempo() {
    setModoTempo(false)
    setReproduzindoTempo(false)
    tempoRef.current = 1
    setTempoUi(1)
  }

  // A busca leva a câmera junto: digitar um município e não sair do lugar faz o
  // grafo parecer decorativo. Só entra em ação com termo específico o bastante.
  useEffect(() => {
    if (termo.trim().length < 3 || !correspondentes || correspondentes.size === 0) return
    const alvo = [...correspondentes].sort(
      (a, b) => grafo.nos[b].grau - grafo.nos[a].grau,
    )[0]
    const atraso = setTimeout(() => centralizarEm(alvo, correspondentes.size === 1 ? 3 : 2), 320)
    return () => clearTimeout(atraso)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termo, correspondentes, grafo])

  /* ---------- Laço de desenho ---------- */

  const refs = useRef({
    realce,
    correspondentes,
    ocultos,
    ego,
    fluxo,
    destaqueHistoria,
    modoTempo,
    temposMs,
    faixaTempo,
  })
  refs.current = {
    realce,
    correspondentes,
    ocultos,
    ego,
    fluxo,
    destaqueHistoria,
    modoTempo,
    temposMs,
    faixaTempo,
  }

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
      const agora = performance.now()
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

      // A câmera viaja: interpola até o destino em vez de teleportar. O zoom
      // anda em escala logarítmica — é o que faz o voo parecer constante.
      const alvo = alvoCam.current
      if (alvo) {
        const c = camera.current
        c.x += (alvo.x - c.x) * 0.085
        c.y += (alvo.y - c.y) * 0.085
        c.zoom *= Math.pow(alvo.zoom / c.zoom, 0.085)
        const chegouPerto =
          Math.abs(alvo.x - c.x) * c.zoom < 0.5 &&
          Math.abs(alvo.y - c.y) * c.zoom < 0.5 &&
          Math.abs(Math.log(alvo.zoom / c.zoom)) < 0.004
        if (chegouPerto) alvoCam.current = null
      }

      const vp = { largura: canvas.clientWidth, altura: canvas.clientHeight }
      const { px, py } = projetar(camera.current, vp)
      const est = refs.current

      // Corte temporal: nós ainda "não aprendidos" ficam apagados
      const corteMs = est.modoTempo
        ? est.faixaTempo.min + tempoRef.current * (est.faixaTempo.max - est.faixaTempo.min)
        : Infinity
      const noTempo = (i: number) => est.temposMs[i] <= corteMs

      const visivel = (i: number) => !est.ocultos.has(grafo.nos[i].tipo)

      ctx.clearRect(0, 0, vp.largura, vp.altura)

      if (!est.ego && est.destaqueHistoria === null && !est.modoTempo) {
        desenharFechos(ctx, fechos, camera.current, vp, camera.current.zoom < 2 ? 1 : 0.35)
      }

      // Arestas — com uma curvatura leve: o feixe reto parece fio esticado,
      // o curvo parece tecido. A direção da curva alterna pelo índice.
      ctx.lineWidth = Math.max(camera.current.zoom * 0.6, 0.4)
      for (let ai = 0; ai < grafo.arestas.length; ai++) {
        const a = grafo.arestas[ai]
        if (!visivel(a.origem) || !visivel(a.destino)) continue
        const na = grafo.nos[a.origem]
        const nb = grafo.nos[a.destino]

        const dentroDoEgo = !est.ego || (est.ego.has(a.origem) && est.ego.has(a.destino))
        const naHistoria =
          !est.destaqueHistoria ||
          (est.destaqueHistoria.has(a.origem) && est.destaqueHistoria.has(a.destino))
        const noCorte = noTempo(a.origem) && noTempo(a.destino)
        const destacada =
          est.realce && (est.realce.conjunto.has(a.origem) || est.realce.conjunto.has(a.destino))

        ctx.strokeStyle = destacada
          ? 'rgba(223,181,82,0.6)'
          : !dentroDoEgo || !naHistoria || !noCorte
            ? 'rgba(120,138,168,0.03)'
            : est.realce
              ? 'rgba(120,138,168,0.07)'
              : 'rgba(120,138,168,0.2)'

        const x1 = px(na.x)
        const y1 = py(na.y)
        const x2 = px(nb.x)
        const y2 = py(nb.y)
        const dx = x2 - x1
        const dy = y2 - y1
        const dist = Math.hypot(dx, dy)
        const bojo = Math.min(dist * 0.09, 16) * (ai % 2 === 0 ? 1 : -1)
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.quadraticCurveTo(
          (x1 + x2) / 2 + (-dy / (dist || 1)) * bojo,
          (y1 + y2) / 2 + (dx / (dist || 1)) * bojo,
          x2,
          y2,
        )
        ctx.stroke()
      }

      if (est.fluxo && !est.ego && !est.modoTempo) {
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
        const antesDoCorte = noTempo(i)
        const apagado =
          foraDoEgo || foraDaHistoria || !noRealce || !correspondeBusca || !antesDoCorte

        // Hubs respiram: uma oscilação de raio quase subliminar que mantém o
        // organismo vivo mesmo com o layout assentado.
        const respiro = n.grau > 8 ? 1 + Math.sin(agora / 640 + i * 1.7) * 0.05 : 1
        const r =
          Math.max((n.raio + Math.min(n.grau, 14) * 0.22) * camera.current.zoom, 1.1) * respiro

        // Nó recém-acendido na linha do tempo ganha um flash curto
        const idade = est.modoTempo ? corteMs - est.temposMs[i] : Infinity
        const janelaFlash = (est.faixaTempo.max - est.faixaTempo.min) * 0.03
        const flash = est.modoTempo && idade >= 0 && idade < janelaFlash

        if (!apagado && (n.grau > 10 || flash)) {
          const alcance = flash ? r * 5 : r * 3.2
          const halo = ctx.createRadialGradient(x, y, r, x, y, alcance)
          halo.addColorStop(0, flash ? `${CORES_TIPO[n.tipo]}88` : `${CORES_TIPO[n.tipo]}44`)
          halo.addColorStop(1, 'transparent')
          ctx.fillStyle = halo
          ctx.beginPath()
          ctx.arc(x, y, alcance, 0, Math.PI * 2)
          ctx.fill()
        }

        ctx.globalAlpha = apagado ? (antesDoCorte ? 0.08 : 0.04) : 1
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
          // Anel que gira devagar: sinaliza "este é o escolhido" sem piscar
          ctx.setLineDash([7, 6])
          ctx.lineDashOffset = -agora / 40
          ctx.beginPath()
          ctx.arc(x, y, r + 5, 0, Math.PI * 2)
          ctx.stroke()
          ctx.setLineDash([])
        }
      }
      ctx.globalAlpha = 1

      desenharVinheta(ctx, vp)

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
    <div className="relative h-[calc(100dvh-56px)] w-full overflow-hidden md:h-screen">
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
      <div className="pointer-events-none absolute inset-x-0 top-0 p-4 sm:p-7">
        <div className="pointer-events-auto flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="max-w-[560px]">
            <div className="eyebrow mb-1.5 sm:mb-2">Cérebro da Cleopatra</div>
            <h1 className="text-[24px] leading-tight">
              Tudo que a Cleo sabe sobre o {orgao.sigla}
            </h1>
            {/* No celular o grafo é o assunto: a explicação cede espaço a ele */}
            <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-muted sm:line-clamp-none">
              {explicacao.explica}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full min-w-[150px] flex-1 sm:w-[250px] sm:flex-none">
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
              title="Pulsos de trabalho"
            >
              <Waves size={14} />
            </Botao>
            <Botao
              onClick={() => (modoTempo ? fecharLinhaDoTempo() : abrirLinhaDoTempo())}
              className={cn(
                'bg-surface/85 backdrop-blur-xl',
                modoTempo && 'border-teal/50 text-teal',
              )}
              aria-label="Linha do tempo"
              title="Ver o conhecimento crescer no tempo"
            >
              <History size={14} />
            </Botao>
            <Botao
              onClick={() => {
                setCenaCinema(0)
                setCinema((v) => !v)
                if (cinema) contarHistoria('panorama')
              }}
              className={cn(
                'bg-surface/85 backdrop-blur-xl',
                cinema && 'border-gold/55 text-gold',
              )}
              aria-label="Modo cinema"
              title="O Cérebro se apresenta sozinho"
            >
              <Clapperboard size={14} />
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
        <div className="rolagem-discreta pointer-events-auto -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:mt-5 sm:flex-wrap sm:overflow-visible sm:px-0">
          {HISTORIAS.map((h) => (
            <button
              key={h.id}
              onClick={() => contarHistoria(h.id)}
              className={cn(
                'shrink-0 rounded-full border px-3.5 py-1.5 text-[12.5px] backdrop-blur-xl transition-colors',
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

      {/* Linha do tempo: o conhecimento crescendo na ordem em que foi aprendido */}
      {modoTempo && !cinema && (
        <div className="absolute inset-x-3 bottom-3 rounded-xl border border-teal/30 bg-surface/92 px-4 py-4 backdrop-blur-xl sm:inset-x-auto sm:bottom-7 sm:left-1/2 sm:w-[560px] sm:-translate-x-1/2 sm:px-5">
          <div className="mb-2.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <History size={13} className="text-teal" />
              <span className="eyebrow">O conhecimento crescendo</span>
            </div>
            <span className="num text-[13px] text-teal">
              {new Date(
                faixaTempo.min + tempoUi * (faixaTempo.max - faixaTempo.min),
              ).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (tempoUi >= 1) {
                  tempoRef.current = 0
                  setTempoUi(0)
                }
                setReproduzindoTempo((v) => !v)
              }}
              className="flex size-8 shrink-0 items-center justify-center rounded-full border border-teal/40 bg-teal/10 text-teal transition-colors hover:bg-teal/20"
              aria-label={reproduzindoTempo ? 'Pausar' : 'Reproduzir'}
            >
              {reproduzindoTempo ? (
                <Pause size={13} />
              ) : (
                <Play size={13} fill="currentColor" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1000}
              value={Math.round(tempoUi * 1000)}
              onChange={(e) => {
                const v = Number(e.target.value) / 1000
                tempoRef.current = v
                setTempoUi(v)
                setReproduzindoTempo(false)
              }}
              className="w-full accent-[var(--color-teal)]"
              aria-label="Posição na linha do tempo"
            />
            <button
              onClick={fecharLinhaDoTempo}
              className="shrink-0 text-faint hover:text-ink"
              aria-label="Fechar linha do tempo"
            >
              <X size={14} />
            </button>
          </div>

          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            Cada registro acende na data em que a Cleo o conheceu. O que o órgão sabe hoje não
            foi carregado de uma vez — foi aprendido, processo a processo.
          </p>
        </div>
      )}

      {/* Letreiro do modo cinema */}
      {cinema && (
        <div className="absolute inset-x-3 bottom-3 rounded-xl border border-gold/30 bg-surface/94 px-4 py-4 backdrop-blur-xl sm:inset-x-auto sm:bottom-7 sm:left-1/2 sm:w-[620px] sm:-translate-x-1/2 sm:px-6">
          <div className="mb-1.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Clapperboard size={13} className="text-gold" />
              <span className="eyebrow text-gold">
                {HISTORIAS.find((h) => h.id === CINEMA[cenaCinema % CINEMA.length].id)?.rotulo}
              </span>
            </div>
            <button
              onClick={() => {
                setCinema(false)
                contarHistoria('panorama')
              }}
              className="text-[11.5px] text-faint hover:text-ink"
            >
              parar · Esc
            </button>
          </div>
          <p key={cenaCinema} className="pagina-entra text-[13px] leading-relaxed text-muted">
            {HISTORIAS.find((h) => h.id === CINEMA[cenaCinema % CINEMA.length].id)?.explica}
          </p>
          <div className="mt-3 flex gap-1">
            {CINEMA.map((c, i) => (
              <button
                key={c.id}
                onClick={() => setCenaCinema(i)}
                aria-label={`Cena ${i + 1}`}
                className={cn(
                  'h-1 flex-1 overflow-hidden rounded-full',
                  i < cenaCinema % CINEMA.length ? 'bg-gold/45' : 'bg-line',
                )}
              >
                {i === cenaCinema % CINEMA.length && (
                  <span
                    key={cenaCinema}
                    className="block h-full rounded-full bg-gold"
                    style={{
                      animation: `cresce-x ${c.duracaoMs}ms linear forwards`,
                    }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Legenda — e filtro por tipo.
          Em coluna ela come metade da tela do celular, então vira uma régua
          de fichas rolando no rodapé. Some quando outro painel ocupa o rodapé:
          dois painéis empilhados ali embaixo tapariam o grafo inteiro. */}
      <div
        className={cn(
          'rolagem-discreta absolute inset-x-3 bottom-3 flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface/85 p-2 backdrop-blur-xl sm:inset-x-auto sm:bottom-7 sm:left-7 sm:flex-col sm:overflow-visible sm:p-3',
          (detalhe || modoTempo || cinema) && 'hidden sm:flex',
        )}
      >
        <div className="eyebrow mb-1 hidden px-1 sm:block">Tipos de registro</div>
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
                'flex shrink-0 items-center gap-2 rounded-md px-1.5 py-1 text-left whitespace-nowrap transition-opacity hover:bg-white/5 sm:gap-2.5',
                oculto && 'opacity-35',
              )}
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: CORES_TIPO[t] }}
              />
              <span className="text-[12px] text-ink sm:flex-1">{ROTULO_TIPO[t]}</span>
              <span className="num text-[11px] text-faint">{numero(grafo.porTipo[t])}</span>
            </button>
          )
        })}
      </div>

      {/* Cadeia legível do registro selecionado */}
      {detalhe && (
        <aside className="absolute inset-x-3 bottom-3 flex max-h-[52vh] flex-col overflow-y-auto rounded-xl border border-line bg-surface/95 p-4 backdrop-blur-xl sm:inset-x-auto sm:top-[200px] sm:right-7 sm:bottom-auto sm:max-h-none sm:w-[344px] sm:overflow-visible sm:p-5">
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
