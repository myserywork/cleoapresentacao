import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, MessagesSquare, Sun, Volume2, VolumeX } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useApp } from '@/store/app'
import { getOrgao, getProponente } from '@/data/repo'
import { responder, type ContextoConversa, type Resposta } from '@/assistente/motor'
import { useExecutor } from '@/comandos/executor'
import { fimDeExercicio } from '@/dominio/orcamento'
import { carteiraDeVigencias, resumoPrestacoes, diasAte } from '@/dominio/ciclo'
import { diligenciasDoOrgao } from '@/data/repo'
import { filaDoDia } from '@/dominio/riscos'
import { carteirasPorParlamentar } from '@/dominio/emendas'
import { cn, moedaCompacta, numero } from '@/lib/format'

/**
 * A Cleo.
 *
 * Não é um chat com avatar: é a projeção da inteligência da casa. Um núcleo
 * vivo no centro da tela, o estado do órgão orbitando em volta, e uma única
 * pergunta de cada vez — feita em voz alta, se quiser. O Assistente é a mesa
 * de trabalho; esta tela é a presença.
 */

type Estado = 'ociosa' | 'ouvindo' | 'pensando' | 'falando'

/* ---------- O núcleo ---------- */

function Nucleo({ estado }: { estado: Estado }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const estadoRef = useRef(estado)
  estadoRef.current = estado

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const TAM = 320
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = TAM * dpr
    canvas.height = TAM * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const c = TAM / 2

    // Partículas orbitais: cada uma com raio, fase e velocidade próprios
    const particulas = Array.from({ length: 64 }, (_, i) => ({
      raio: 74 + (i % 5) * 11 + (i % 3) * 4,
      fase: (i / 64) * Math.PI * 2,
      veloc: 0.0016 + (i % 7) * 0.00042,
      tam: 0.9 + (i % 3) * 0.65,
    }))

    let quadro = 0
    const desenhar = (agora: number) => {
      const e = estadoRef.current
      const ritmo = e === 'pensando' ? 3.1 : e === 'falando' ? 1.9 : e === 'ouvindo' ? 1.35 : 1
      const t = agora * ritmo

      ctx.clearRect(0, 0, TAM, TAM)

      // Respiração do halo central
      const pulso = 1 + Math.sin(t / 900) * 0.07 + (e === 'falando' ? Math.sin(t / 90) * 0.05 : 0)
      const nucleoR = 46 * pulso

      const halo = ctx.createRadialGradient(c, c, nucleoR * 0.2, c, c, nucleoR * 2.6)
      halo.addColorStop(0, 'rgba(139,108,240,0.85)')
      halo.addColorStop(0.4, 'rgba(139,108,240,0.28)')
      halo.addColorStop(1, 'rgba(139,108,240,0)')
      ctx.fillStyle = halo
      ctx.beginPath()
      ctx.arc(c, c, nucleoR * 2.6, 0, Math.PI * 2)
      ctx.fill()

      const miolo = ctx.createRadialGradient(c - 8, c - 10, 4, c, c, nucleoR)
      miolo.addColorStop(0, 'rgba(233,225,255,0.95)')
      miolo.addColorStop(0.55, 'rgba(160,132,246,0.9)')
      miolo.addColorStop(1, 'rgba(96,70,190,0.85)')
      ctx.fillStyle = miolo
      ctx.beginPath()
      ctx.arc(c, c, nucleoR, 0, Math.PI * 2)
      ctx.fill()

      // Arcos orbitais: três anéis girando em sentidos e ritmos diferentes
      const arcos = [
        { r: 68, largura: 1.4, vel: 1, abre: 1.9, cor: 'rgba(139,108,240,0.55)' },
        { r: 86, largura: 1.1, vel: -0.62, abre: 2.6, cor: 'rgba(223,181,82,0.4)' },
        { r: 104, largura: 0.9, vel: 0.4, abre: 1.2, cor: 'rgba(53,195,167,0.35)' },
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

      // Poeira orbital
      for (const p of particulas) {
        const ang = p.fase + t * p.veloc * 0.06
        const x = c + Math.cos(ang) * p.raio
        const y = c + Math.sin(ang) * p.raio * 0.94
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

  return <canvas ref={ref} style={{ width: 320, height: 320 }} aria-hidden />
}

/* ---------- Máquina de escrever ---------- */

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
    }, 14)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto, ativo])
  return visivel
}

/* ---------- A página ---------- */

export function Cleo() {
  const { orgaoId } = useApp()
  const { executar } = useExecutor()
  const orgao = getOrgao(orgaoId)!

  const [estado, setEstado] = useState<Estado>('ociosa')
  const [pergunta, setPergunta] = useState('')
  const [ultimaPergunta, setUltimaPergunta] = useState('')
  const [resposta, setResposta] = useState<Resposta | null>(null)
  const [voz, setVoz] = useState(false)
  const contexto = useRef<ContextoConversa>({})

  /* Os sinais do órgão orbitando a presença */
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
      fila
        ? `a prioridade do dia é ${fila.proposta.numero} — ${fila.motivo.toLowerCase()}`
        : 'fila do dia em dia',
      `${numero(vigencias)} convênio(s) vencendo em 30 dias`,
      `${numero(contas.atrasadas)} prestação(ões) de contas em atraso`,
      `${numero(diligencias)} diligência(s) vencida(s) esperando reiteração`,
      gabinete
        ? `a maior pressão de gabinete é de ${gabinete.parlamentar.nome}`
        : 'nenhuma pressão de gabinete acumulada',
    ]
  }, [orgaoId])
  const [sinalAtivo, setSinalAtivo] = useState(0)

  useEffect(() => {
    if (estado !== 'ociosa') return
    const t = window.setInterval(() => setSinalAtivo((s) => (s + 1) % sinais.length), 4600)
    return () => window.clearInterval(t)
  }, [estado, sinais])

  const falar = useCallback(
    (texto: string) => {
      if (!voz || !('speechSynthesis' in window)) return
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(texto)
      u.lang = 'pt-BR'
      u.rate = 1.06
      window.speechSynthesis.speak(u)
    },
    [voz],
  )

  const perguntar = useCallback(
    (texto: string) => {
      const limpo = texto.trim()
      if (!limpo) return
      setPergunta('')
      setUltimaPergunta(limpo)
      setResposta(null)
      setEstado('pensando')
      window.setTimeout(() => {
        const r = responder(limpo, orgaoId, contexto.current)
        contexto.current = r.contexto
        setResposta(r.resposta)
        setEstado('falando')
        falar(r.resposta.texto)
      }, 900)
    },
    [orgaoId, falar],
  )

  function briefing() {
    const fim = fimDeExercicio(orgaoId)
    const contas = resumoPrestacoes(orgaoId)
    const fila = filaDoDia(orgaoId, 3)
    const prop = fila[0] ? getProponente(fila[0].proposta.proponenteId) : undefined
    const texto = [
      `Bom dia. O ${orgao.sigla} tem ${moedaCompacta(fim.saldoAEmpenhar)} a empenhar em ${fim.diasUteis} dias úteis — ritmo necessário de ${moedaCompacta(fim.ritmoNecessario)} por dia.`,
      fila[0]
        ? `Se eu fosse começar por uma coisa: a ${fila[0].proposta.numero}, de ${prop?.nome}. Motivo: ${fila[0].motivo.toLowerCase()}.`
        : '',
      contas.atrasadas > 0
        ? `Há ${contas.atrasadas} prestações de contas em atraso travando ${contas.proponentesBloqueados} proponentes.`
        : 'Nenhuma prestação de contas em atraso.',
      'Quer que eu detalhe algum desses pontos, ou disparo o rito da prioridade do dia?',
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
          'Executar o rito completo na prioridade do dia',
          'Quais convênios vencem em 30 dias?',
          'Como está a carga da equipe?',
        ],
      })
      setEstado('falando')
      falar(texto)
    }, 900)
  }

  const textoDigitado = useDatilografia(resposta?.texto ?? '', estado === 'falando', () =>
    setEstado('ociosa'),
  )

  return (
    <div className="relative flex h-screen w-full flex-col items-center overflow-hidden">
      {/* Fundo: a mesma noite do Cérebro, mais funda */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_540px_at_50%_30%,#141033_0%,transparent_65%)]" />

      <header className="z-10 flex w-full items-center justify-between px-8 pt-6">
        <div>
          <div className="eyebrow">A presença · {orgao.sigla}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setVoz((v) => !v)}
            className={cn(
              'flex items-center gap-2 rounded-lg border border-line bg-surface/80 px-3 py-2 text-[12px] backdrop-blur-xl transition-colors',
              voz ? 'border-cleo/50 text-cleo' : 'text-muted hover:text-ink',
            )}
            title="A Cleo lê as respostas em voz alta"
          >
            {voz ? <Volume2 size={13} /> : <VolumeX size={13} />}
            {voz ? 'Voz ativa' : 'Voz'}
          </button>
          <Link
            to="/assistente"
            className="flex items-center gap-2 rounded-lg border border-line bg-surface/80 px-3 py-2 text-[12px] text-muted backdrop-blur-xl transition-colors hover:text-ink"
          >
            <MessagesSquare size={13} /> Conversa completa
          </Link>
        </div>
      </header>

      <div className="z-10 -mt-2 flex flex-col items-center">
        <Nucleo estado={estado} />
        <h1 className="-mt-7 font-display text-[30px] font-semibold tracking-[0.42em] text-ink">
          CLEO
        </h1>
        <p className="mt-1 h-5 text-[12.5px] text-muted">
          {estado === 'pensando'
            ? 'consultando a carteira…'
            : estado === 'falando'
              ? 'respondendo'
              : estado === 'ouvindo'
                ? 'ouvindo'
                : sinais[sinalAtivo]}
        </p>
      </div>

      {/* A conversa: uma troca por vez, como quem fala com alguém */}
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
                    onClick={() => void executar(o.acoes, { silencioso: false })}
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
                    onClick={() => perguntar(s)}
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
                  onClick={() => perguntar(s)}
                  className="rounded-full border border-line bg-surface/70 px-4 py-2 text-[13px] text-muted transition-colors hover:text-ink"
                >
                  {s}
                </button>
              ),
            )}
          </div>
        )}
      </div>

      {/* A pergunta */}
      <div className="z-10 w-full max-w-[760px] px-6 pb-7">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            perguntar(pergunta)
          }}
          className="flex items-center gap-2 rounded-2xl border border-line bg-surface/85 px-4 py-2 backdrop-blur-xl focus-within:border-cleo/50"
        >
          <input
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            onFocus={() => estado === 'ociosa' && setEstado('ouvindo')}
            onBlur={() => estado === 'ouvindo' && setEstado('ociosa')}
            placeholder={`Pergunte, ou mande a Cleo agir no ${orgao.sigla}…`}
            className="h-10 flex-1 bg-transparent text-[14px] text-ink placeholder:text-faint focus:outline-none"
            aria-label="Pergunta para a Cleo"
          />
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
          A Cleo responde com os dados da carteira e executa na interface — nada é enviado aos
          sistemas oficiais.
        </p>
      </div>
    </div>
  )
}
