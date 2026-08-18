import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUp,
  Info,
  Mic,
  MicOff,
  MessagesSquare,
  Square,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useApp } from '@/store/app'
import { diligenciasDoOrgao, getOrgao, getProponente } from '@/data/repo'
import { responder, type ContextoConversa, type Resposta } from '@/assistente/motor'
import { useEscuta, useFala } from '@/assistente/voz'
import { IDENTIDADE, PENSANDO, PRINCIPIOS, saudacao, TONS, type Tom } from '@/assistente/identidade'
import { useExecutor } from '@/comandos/executor'
import { usePermissao } from '@/dominio/usePermissao'
import { fimDeExercicio } from '@/dominio/orcamento'
import { carteiraDeVigencias, diasAte, resumoPrestacoes } from '@/dominio/ciclo'
import { filaDoDia } from '@/dominio/riscos'
import { carteirasPorParlamentar } from '@/dominio/emendas'
import { cn, moedaCompacta, numero } from '@/lib/format'
import { Badge } from '@/components/ui'

/**
 * A Cleo.
 *
 * Não é um chat com avatar: é a projeção da inteligência da casa. Núcleo vivo
 * no centro, o estado do órgão orbitando, e uma conversa por vez — falada, se
 * a pessoa quiser. Ela ouve, responde em voz alta e abre widgets em vez de
 * arrastar você para outra tela.
 */

type Estado = 'ociosa' | 'ouvindo' | 'pensando' | 'falando'

/* ---------- O núcleo ---------- */

function Nucleo({ estado, volume }: { estado: Estado; volume: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const estadoRef = useRef(estado)
  const volRef = useRef(volume)
  estadoRef.current = estado
  volRef.current = volume

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const TAM = 300
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = TAM * dpr
    canvas.height = TAM * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const c = TAM / 2

    const particulas = Array.from({ length: 58 }, (_, i) => ({
      raio: 70 + (i % 5) * 10 + (i % 3) * 4,
      fase: (i / 58) * Math.PI * 2,
      veloc: 0.0016 + (i % 7) * 0.0004,
      tam: 0.9 + (i % 3) * 0.6,
    }))

    let quadro = 0
    const desenhar = (agora: number) => {
      const e = estadoRef.current
      const ritmo = e === 'pensando' ? 3 : e === 'falando' ? 2 : e === 'ouvindo' ? 1.4 : 1
      const t = agora * ritmo

      ctx.clearRect(0, 0, TAM, TAM)

      // Ouvindo: o núcleo responde ao volume do microfone
      const reacao = e === 'ouvindo' ? 1 + volRef.current * 0.35 : 1
      const pulso =
        (1 + Math.sin(t / 900) * 0.07 + (e === 'falando' ? Math.sin(t / 85) * 0.06 : 0)) * reacao
      const nucleoR = 44 * pulso

      const halo = ctx.createRadialGradient(c, c, nucleoR * 0.2, c, c, nucleoR * 2.7)
      halo.addColorStop(0, e === 'ouvindo' ? 'rgba(53,195,167,0.8)' : 'rgba(139,108,240,0.85)')
      halo.addColorStop(0.4, e === 'ouvindo' ? 'rgba(53,195,167,0.24)' : 'rgba(139,108,240,0.26)')
      halo.addColorStop(1, 'transparent')
      ctx.fillStyle = halo
      ctx.beginPath()
      ctx.arc(c, c, nucleoR * 2.7, 0, Math.PI * 2)
      ctx.fill()

      const miolo = ctx.createRadialGradient(c - 8, c - 10, 4, c, c, nucleoR)
      miolo.addColorStop(0, 'rgba(240,233,255,0.96)')
      miolo.addColorStop(0.55, e === 'ouvindo' ? 'rgba(90,205,180,0.9)' : 'rgba(160,132,246,0.9)')
      miolo.addColorStop(1, e === 'ouvindo' ? 'rgba(20,120,102,0.85)' : 'rgba(96,70,190,0.85)')
      ctx.fillStyle = miolo
      ctx.beginPath()
      ctx.arc(c, c, nucleoR, 0, Math.PI * 2)
      ctx.fill()

      const arcos = [
        { r: 65, largura: 1.4, vel: 1, abre: 1.9, cor: 'rgba(139,108,240,0.55)' },
        { r: 82, largura: 1.1, vel: -0.62, abre: 2.6, cor: 'rgba(223,181,82,0.42)' },
        { r: 99, largura: 0.9, vel: 0.4, abre: 1.2, cor: 'rgba(53,195,167,0.36)' },
      ]
      for (const a of arcos) {
        const inicio = (t / 1400) * a.vel
        ctx.strokeStyle = a.cor
        ctx.lineWidth = a.largura
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.arc(c, c, a.r, inicio, inicio + a.abre)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(c, c, a.r, inicio + Math.PI, inicio + Math.PI + a.abre * 0.6)
        ctx.stroke()
      }

      for (const p of particulas) {
        const ang = p.fase + t * p.veloc * 0.06
        const x = c + Math.cos(ang) * p.raio * reacao
        const y = c + Math.sin(ang) * p.raio * 0.94 * reacao
        ctx.fillStyle = 'rgba(180,155,247,0.5)'
        ctx.beginPath()
        ctx.arc(x, y, p.tam, 0, Math.PI * 2)
        ctx.fill()
      }

      quadro = requestAnimationFrame(desenhar)
    }
    quadro = requestAnimationFrame(desenhar)
    return () => cancelAnimationFrame(quadro)
  }, [])

  return <canvas ref={ref} style={{ width: 300, height: 300 }} aria-hidden />
}

/* ---------- Datilografia ---------- */

function useDatilografia(texto: string, ativo: boolean, aoTerminar?: () => void) {
  const [visivel, setVisivel] = useState('')
  useEffect(() => {
    if (!ativo) {
      setVisivel(texto)
      return
    }
    setVisivel('')
    let i = 0
    const t = window.setInterval(() => {
      i += 2
      setVisivel(texto.slice(0, i))
      if (i >= texto.length) {
        window.clearInterval(t)
        aoTerminar?.()
      }
    }, 13)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto, ativo])
  return visivel
}

/* ---------- A página ---------- */

export function Cleo() {
  const { orgaoId } = useApp()
  const { executar } = useExecutor()
  const { eu, perfil } = usePermissao()
  const orgao = getOrgao(orgaoId)!

  const [estado, setEstado] = useState<Estado>('ociosa')
  const [pergunta, setPergunta] = useState('')
  const [ultimaPergunta, setUltimaPergunta] = useState('')
  const [resposta, setResposta] = useState<Resposta | null>(null)
  const [vozLigada, setVozLigada] = useState(false)
  const [tom, setTom] = useState<Tom>('objetiva')
  const [mostrarPerfil, setMostrarPerfil] = useState(false)
  const [volume, setVolume] = useState(0)
  const contexto = useRef<ContextoConversa>({})
  const [frasePensando] = useState(() => PENSANDO[Math.floor(Math.random() * PENSANDO.length)])

  const { falar, calar, falando } = useFala()

  const responderTexto = useCallback(
    (limpo: string) => {
      setPergunta('')
      setUltimaPergunta(limpo)
      setResposta(null)
      setEstado('pensando')
      window.setTimeout(() => {
        const r = responder(limpo, orgaoId, contexto.current)
        contexto.current = r.contexto
        setResposta(r.resposta)
        setEstado('falando')
        if (vozLigada) falar(r.resposta.texto)
      }, 850)
    },
    [orgaoId, vozLigada, falar],
  )

  const escuta = useEscuta((texto) => responderTexto(texto))

  // Nível do microfone para o núcleo reagir enquanto ela ouve
  useEffect(() => {
    if (!escuta.ouvindo) {
      setVolume(0)
      return
    }
    let ctx: AudioContext | null = null
    let stream: MediaStream | null = null
    let quadro = 0
    navigator.mediaDevices
      ?.getUserMedia({ audio: true })
      .then((s) => {
        stream = s
        ctx = new AudioContext()
        const fonte = ctx.createMediaStreamSource(s)
        const analisador = ctx.createAnalyser()
        analisador.fftSize = 256
        fonte.connect(analisador)
        const dados = new Uint8Array(analisador.frequencyBinCount)
        const medir = () => {
          analisador.getByteFrequencyData(dados)
          const media = dados.reduce((a, b) => a + b, 0) / dados.length
          setVolume(Math.min(media / 90, 1))
          quadro = requestAnimationFrame(medir)
        }
        medir()
      })
      .catch(() => {
        /* sem permissão de áudio o núcleo só não reage — a escuta segue */
      })
    return () => {
      cancelAnimationFrame(quadro)
      stream?.getTracks().forEach((t) => t.stop())
      void ctx?.close()
    }
  }, [escuta.ouvindo])

  useEffect(() => {
    if (escuta.ouvindo) setEstado('ouvindo')
    else if (estado === 'ouvindo') setEstado('ociosa')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escuta.ouvindo])

  /* Sinais do órgão orbitando a presença */
  const sinais = useMemo(() => {
    const fim = fimDeExercicio(orgaoId)
    const contas = resumoPrestacoes(orgaoId)
    const vigencias = carteiraDeVigencias(orgaoId).filter(
      (v) => v.situacao.diasRestantes >= 0 && v.situacao.diasRestantes <= 30,
    ).length
    const diligencias = diligenciasDoOrgao(orgaoId).filter(
      (d) => !d.respondidaEm && diasAte(d.prazo) < 0,
    ).length
    const fila = filaDoDia(orgaoId, 1)[0]
    const gabinete = carteirasPorParlamentar(orgaoId)[0]
    return [
      `${moedaCompacta(fim.saldoAEmpenhar)} a empenhar em ${fim.diasUteis} dias úteis`,
      fila ? `a prioridade do dia é ${fila.proposta.numero} — ${fila.motivo.toLowerCase()}` : 'fila em dia',
      `${numero(vigencias)} convênio(s) vencendo em 30 dias`,
      `${numero(contas.atrasadas)} prestação(ões) de contas em atraso`,
      `${numero(diligencias)} diligência(s) vencida(s) esperando reiteração`,
      gabinete ? `maior pressão de gabinete: ${gabinete.parlamentar.nome}` : 'sem pressão acumulada',
    ]
  }, [orgaoId])
  const [sinalAtivo, setSinalAtivo] = useState(0)

  useEffect(() => {
    if (estado !== 'ociosa') return
    const t = window.setInterval(() => setSinalAtivo((s) => (s + 1) % sinais.length), 4600)
    return () => window.clearInterval(t)
  }, [estado, sinais])

  function briefing() {
    const fim = fimDeExercicio(orgaoId)
    const contas = resumoPrestacoes(orgaoId)
    const fila = filaDoDia(orgaoId, 3)
    const prop = fila[0] ? getProponente(fila[0].proposta.proponenteId) : undefined
    const texto = [
      `${saudacao(eu?.nome)} O ${orgao.sigla} tem ${moedaCompacta(fim.saldoAEmpenhar)} a empenhar em ${fim.diasUteis} dias úteis — ritmo necessário de ${moedaCompacta(fim.ritmoNecessario)} por dia.`,
      fila[0]
        ? `Se eu fosse começar por uma coisa: a ${fila[0].proposta.numero}, de ${prop?.nome}. Motivo: ${fila[0].motivo.toLowerCase()}.`
        : '',
      contas.atrasadas > 0
        ? `Há ${contas.atrasadas} prestações de contas em atraso travando ${contas.proponentesBloqueados} proponentes.`
        : 'Nenhuma prestação de contas em atraso.',
      'Quer que eu detalhe algum desses pontos?',
    ]
      .filter(Boolean)
      .join(' ')

    setUltimaPergunta('O briefing do dia')
    setResposta(null)
    setEstado('pensando')
    window.setTimeout(() => {
      setResposta({
        texto,
        seguintes: [
          'Quanto falta empenhar até dezembro?',
          'Quais convênios vencem em 30 dias?',
          'Como está a carga da equipe?',
        ],
      })
      setEstado('falando')
      if (vozLigada) falar(texto)
    }, 850)
  }

  const textoDigitado = useDatilografia(resposta?.texto ?? '', estado === 'falando', () =>
    setEstado('ociosa'),
  )

  return (
    <div className="relative flex h-[calc(100dvh-56px)] w-full flex-col items-center overflow-hidden md:h-screen">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_540px_at_50%_28%,#141033_0%,transparent_65%)]" />

      {/* No celular a barra empilha e os controles viram uma régua que rola:
          espremer sete controles numa linha de 390px não deixa nenhum legível. */}
      <header className="z-10 flex w-full flex-col gap-3 px-4 pt-4 sm:flex-row sm:items-start sm:justify-between sm:px-8 sm:pt-6">
        <div className="min-w-0">
          <div className="eyebrow">A presença · {orgao.sigla}</div>
          {perfil && (
            <div className="mt-1 truncate text-[11px] text-faint">
              operando pela alçada de {eu?.nome?.split(' ')[0]} · {perfil.nome}
            </div>
          )}
        </div>
        <div className="rolagem-discreta -mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:justify-end sm:overflow-visible sm:px-0">
          <div className="flex shrink-0 items-center gap-1 rounded-lg border border-line bg-surface/80 p-0.5 backdrop-blur-xl">
            {TONS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTom(t.id)}
                title={t.descricao}
                className={cn(
                  'rounded-md px-2.5 py-1.5 text-[11.5px] transition-colors',
                  tom === t.id ? 'bg-cleo/15 text-cleo' : 'text-muted hover:text-ink',
                )}
              >
                {t.nome}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              if (vozLigada) calar()
              setVozLigada((v) => !v)
            }}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-lg border border-line bg-surface/80 px-3 py-2 text-[12px] whitespace-nowrap backdrop-blur-xl transition-colors',
              vozLigada ? 'border-cleo/50 text-cleo' : 'text-muted hover:text-ink',
            )}
            title="A Cleo lê as respostas em voz alta"
          >
            {vozLigada ? <Volume2 size={13} /> : <VolumeX size={13} />}
            {vozLigada ? 'Voz ativa' : 'Voz'}
          </button>
          <button
            onClick={() => setMostrarPerfil((v) => !v)}
            title="Quem é a Cleo"
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-lg border border-line bg-surface/80 px-3 py-2 text-[12px] whitespace-nowrap backdrop-blur-xl transition-colors',
              mostrarPerfil ? 'border-gold/50 text-gold' : 'text-muted hover:text-ink',
            )}
          >
            <Info size={13} /> <span className="hidden sm:inline">Quem é a Cleo</span>
          </button>
          <Link
            to="/assistente"
            title="Conversa completa"
            className="flex shrink-0 items-center gap-2 rounded-lg border border-line bg-surface/80 px-3 py-2 text-[12px] whitespace-nowrap text-muted backdrop-blur-xl transition-colors hover:text-ink"
          >
            <MessagesSquare size={13} /> <span className="hidden sm:inline">Conversa completa</span>
          </Link>
        </div>
      </header>

      <div className="z-10 -mt-1 flex flex-col items-center">
        <Nucleo estado={estado} volume={volume} />
        <h1 className="-mt-7 font-display text-[30px] font-semibold tracking-[0.42em] text-ink">
          CLEO
        </h1>
        <p className="mt-1 h-5 text-[12.5px] text-muted">
          {estado === 'pensando'
            ? frasePensando
            : estado === 'falando'
              ? 'respondendo'
              : estado === 'ouvindo'
                ? escuta.parcial || 'ouvindo…'
                : sinais[sinalAtivo]}
        </p>
      </div>

      {/* Ficha de identidade */}
      {mostrarPerfil && (
        <div className="pagina-entra z-10 mt-4 w-full max-w-[760px] rounded-2xl border border-gold/25 bg-surface/95 px-6 py-5 backdrop-blur-xl">
          <div className="mb-3 flex items-baseline gap-3">
            <span className="text-[15px] text-ink">{IDENTIDADE.nome}</span>
            <span className="text-[12px] text-gold">{IDENTIDADE.papel}</span>
          </div>
          <p className="mb-4 text-[12.5px] leading-relaxed text-muted">{IDENTIDADE.origem}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PRINCIPIOS.map((p) => (
              <div key={p.titulo}>
                <div className="mb-1 text-[12.5px] text-cleo">{p.titulo}</div>
                <p className="text-[11.5px] leading-relaxed text-muted">{p.texto}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
            {IDENTIDADE.jeito.map((j) => (
              <Badge key={j} tom="inert">
                {j}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* A conversa */}
      <div className="z-10 mt-5 flex w-full max-w-[760px] flex-1 flex-col items-center gap-4 overflow-y-auto px-6">
        {ultimaPergunta && (
          <div className="self-end rounded-2xl rounded-br-md border border-line bg-raised px-4 py-2.5 text-[13px] text-ink">
            {ultimaPergunta}
          </div>
        )}

        {estado === 'pensando' && (
          <div className="flex items-center gap-1.5 self-start px-2 py-2">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-1.5 animate-pulse rounded-full bg-cleo"
                style={{ animationDelay: `${i * 160}ms` }}
              />
            ))}
          </div>
        )}

        {resposta && (
          <div className="w-full self-start">
            <p className="text-[14.5px] leading-relaxed text-ink">
              {textoDigitado}
              {estado === 'falando' && <span className="animate-pulse text-cleo">▍</span>}
            </p>

            {estado !== 'falando' && resposta.destaque && (
              <div className="mt-4 flex flex-wrap gap-3">
                {resposta.destaque.map((d) => (
                  <div key={d.rotulo} className="rounded-xl border border-line bg-surface/70 px-4 py-2.5">
                    <div className="eyebrow mb-1">{d.rotulo}</div>
                    <div className="num text-[16px] text-gold">{d.valor}</div>
                  </div>
                ))}
              </div>
            )}

            {estado !== 'falando' && (
              <div className="mt-4 flex flex-wrap gap-2">
                {resposta.oferecidas?.map((o) => (
                  <button
                    key={o.rotulo}
                    onClick={() => void executar(o.acoes, { silencioso: true })}
                    className={cn(
                      'rounded-full border px-3.5 py-1.5 text-[12.5px] transition-colors',
                      o.destacada
                        ? 'border-gold/50 bg-gold/12 text-gold hover:bg-gold/20'
                        : 'border-line text-muted hover:text-ink',
                    )}
                  >
                    {o.rotulo}
                  </button>
                ))}
                {resposta.seguintes?.map((s) => (
                  <button
                    key={s}
                    onClick={() => responderTexto(s)}
                    className="rounded-full border border-cleo/35 px-3.5 py-1.5 text-[12.5px] text-cleo transition-colors hover:bg-cleo/10"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {!resposta && estado === 'ociosa' && (
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <button
              onClick={briefing}
              className="flex items-center gap-2 rounded-full border border-gold/45 bg-gold/10 px-4 py-2 text-[13px] text-gold transition-colors hover:bg-gold/18"
            >
              <Sun size={13} /> O briefing do dia
            </button>
            {['Quanto falta empenhar até dezembro?', 'O que está parado há 30 dias?', 'Como estão as emendas?'].map(
              (s) => (
                <button
                  key={s}
                  onClick={() => responderTexto(s)}
                  className="rounded-full border border-line bg-surface/70 px-4 py-2 text-[13px] text-muted transition-colors hover:text-ink"
                >
                  {s}
                </button>
              ),
            )}
          </div>
        )}
      </div>

      {/* A pergunta — teclado ou voz */}
      <div className="z-10 w-full max-w-[760px] px-6 pb-7">
        {escuta.erro && (
          <div className="mb-2 rounded-lg border border-alert/30 bg-alert/[0.06] px-3.5 py-2 text-[11.5px] text-alert">
            {escuta.erro}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (pergunta.trim()) responderTexto(pergunta.trim())
          }}
          className={cn(
            'flex items-center gap-2 rounded-2xl border bg-surface/85 px-4 py-2 backdrop-blur-xl transition-colors',
            escuta.ouvindo ? 'border-teal/60' : 'border-line focus-within:border-cleo/50',
          )}
        >
          <input
            value={escuta.ouvindo ? escuta.parcial : pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            readOnly={escuta.ouvindo}
            placeholder={
              escuta.ouvindo ? 'Estou ouvindo…' : `Fale ou escreva — a Cleo age no ${orgao.sigla}`
            }
            className="h-10 flex-1 bg-transparent text-[14px] text-ink placeholder:text-faint focus:outline-none"
            aria-label="Pergunta para a Cleo"
          />

          {falando && (
            <button
              type="button"
              onClick={calar}
              className="flex size-9 items-center justify-center rounded-xl border border-line text-muted hover:text-ink"
              title="Parar de falar"
            >
              <Square size={13} />
            </button>
          )}

          {escuta.suportado && (
            <button
              type="button"
              onClick={() => (escuta.ouvindo ? escuta.parar() : escuta.ouvir())}
              className={cn(
                'flex size-9 items-center justify-center rounded-xl transition-colors',
                escuta.ouvindo
                  ? 'bg-teal text-[#04150f]'
                  : 'border border-line text-muted hover:text-ink',
              )}
              title={escuta.ouvindo ? 'Parar de ouvir' : 'Falar com a Cleo'}
              aria-label="Microfone"
            >
              {escuta.ouvindo ? <MicOff size={15} /> : <Mic size={15} />}
            </button>
          )}

          <button
            type="submit"
            disabled={!pergunta.trim()}
            className="flex size-9 items-center justify-center rounded-xl bg-cleo text-white transition-opacity disabled:opacity-30"
            aria-label="Enviar"
          >
            <ArrowUp size={15} />
          </button>
        </form>
        <p className="mt-2 text-center text-[10.5px] text-faint">
          {escuta.ouvindo
            ? 'Microfone aberto — a Cleo está ouvindo esta aba.'
            : escuta.suportado
              ? 'Clique no microfone para falar. Nada é enviado aos sistemas oficiais.'
              : 'Este navegador não reconhece voz — use o teclado.'}
        </p>
      </div>
    </div>
  )
}
