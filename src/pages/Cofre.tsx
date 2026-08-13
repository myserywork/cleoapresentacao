import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Cookie,
  KeyRound,
  Lock,
  Puzzle,
  RefreshCw,
  ShieldCheck,
  Timer,
  Trash2,
  Workflow,
} from 'lucide-react'
import { Badge, Botao, Panel } from '@/components/ui'
import { Medidor, Numero } from '@/components/dados'
import { cn } from '@/lib/format'

/**
 * Cofre de Sessões.
 *
 * O outro lado da captura: aqui a Cleopatra recebe da extensão a sessão
 * autenticada e passa a operar os sistemas sozinha, mesmo sem a aba do usuário
 * aberta. Cada sessão tem validade; quando está perto de expirar, a Cleo pede
 * renovação — e o RPA de fila usa a sessão viva para trabalhar a madrugada.
 *
 * A ponte com a extensão é real: o content script escuta o pedido desta página
 * e devolve as sessões guardadas. Sem a extensão, mostra um exemplo para
 * explicar o conceito.
 */

interface CookieInfo {
  nome: string
  amostra: string
  httpOnly: boolean
  seguro: boolean
}
interface Sessao {
  sistema: 'sei' | 'tgov'
  dominio: string
  usuario: string
  qtdCookies: number
  cookies: CookieInfo[]
  capturadaEm: number
  expiraEm: number
}

const ROTULO: Record<string, string> = { sei: 'SEI', tgov: 'TransfereGov' }
const DURACAO = 2 * 60 * 60 * 1000

function exemploSessao(sistema: 'sei' | 'tgov'): Sessao {
  const agora = Date.now()
  return {
    sistema,
    dominio: sistema === 'sei' ? 'sei.exemplo.gov.br' : 'transferegov.exemplo.gov.br',
    usuario: sistema === 'sei' ? 'SNPDC · usuário de serviço' : 'gov.br · usuário de serviço MIDR',
    qtdCookies: sistema === 'sei' ? 4 : 3,
    cookies:
      sistema === 'sei'
        ? [
            { nome: 'SEI_SESSAO', amostra: 'a3f2••••••b71', httpOnly: true, seguro: true },
            { nome: 'SEI_USUARIO', amostra: 'serv••••midr', httpOnly: false, seguro: true },
          ]
        : [
            { nome: 'TGOV_SESSAO', amostra: '9c1d••••••e40', httpOnly: true, seguro: true },
            { nome: 'TGOV_GOVBR', amostra: 'selo••••rata', httpOnly: false, seguro: true },
          ],
    capturadaEm: agora - 26 * 60 * 1000,
    expiraEm: agora + (sistema === 'sei' ? 94 * 60 * 1000 : 15 * 60 * 1000),
  }
}

export function Cofre() {
  const [sessoes, setSessoes] = useState<Record<string, Sessao>>({})
  const [temExtensao, setTemExtensao] = useState(false)
  const [, forcar] = useState(0)
  const respondeu = useRef(false)

  // Ponte com a extensão: pede as sessões e escuta a resposta do content script
  const pedir = useCallback(() => {
    window.postMessage({ source: 'cleo-page', cmd: 'listar-sessoes' }, '*')
  }, [])

  useEffect(() => {
    function ouvir(e: MessageEvent) {
      const d = e.data
      if (!d || d.source !== 'cleo-ext') return
      setTemExtensao(true)
      if (d.event === 'sessoes') {
        respondeu.current = true
        setSessoes(d.sessoes || {})
      }
    }
    window.addEventListener('message', ouvir)
    pedir()
    const t = setInterval(pedir, 4000)
    // Sem resposta da extensão em 1,4s → mostra o exemplo, para explicar o conceito
    const semExt = setTimeout(() => {
      if (!respondeu.current) setSessoes({ sei: exemploSessao('sei'), tgov: exemploSessao('tgov') })
    }, 1400)
    return () => {
      window.removeEventListener('message', ouvir)
      clearInterval(t)
      clearTimeout(semExt)
    }
  }, [pedir])

  // Relógio de 1s para as contagens andarem
  useEffect(() => {
    const t = setInterval(() => forcar((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  function descartar(sistema: string) {
    if (temExtensao) {
      window.postMessage({ source: 'cleo-page', cmd: 'descartar-sessao', sistema }, '*')
    } else {
      setSessoes((s) => {
        const c = { ...s }
        delete c[sistema]
        return c
      })
    }
  }

  const lista = useMemo(() => Object.values(sessoes).sort((a, b) => a.expiraEm - b.expiraEm), [sessoes])
  const ativas = lista.filter((s) => s.expiraEm > Date.now())
  const perto = ativas.filter((s) => s.expiraEm - Date.now() < 20 * 60 * 1000)

  return (
    <div className="mx-auto flex max-w-[1160px] flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="eyebrow mb-2">Operação autônoma</div>
          <h1 className="text-[26px] leading-tight">Cofre de Sessões</h1>
          <p className="mt-1.5 max-w-[74ch] text-[13px] text-muted">
            A extensão leva a sessão autenticada do usuário para cá. Com ela viva, a Cleo opera o SEI
            e o TransfereGov sozinha — o servidor não precisa ficar operando o tempo todo. Quando a
            sessão se esgota, a Cleo pede renovação.
          </p>
        </div>
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px]',
            temExtensao ? 'border-teal/40 bg-teal/[0.06] text-teal' : 'border-line text-muted',
          )}
        >
          <Puzzle size={13} />
          {temExtensao ? 'Extensão conectada' : 'Extensão não detectada — exemplo'}
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Panel className="px-5 py-4">
          <Numero rotulo="Sessões ativas" valor={String(ativas.length)} tom="teal" detalhe="Operáveis agora pela Cleo" />
        </Panel>
        <Panel className={cn('px-5 py-4', perto.length > 0 && 'border-gold/30 bg-gold/[0.04]')}>
          <Numero rotulo="Perto de expirar" valor={String(perto.length)} tom="gold" detalhe="Renovação em menos de 20 min" />
        </Panel>
        <Panel className="px-5 py-4">
          <Numero rotulo="Sistemas cobertos" valor={String(new Set(ativas.map((s) => s.sistema)).size)} detalhe="SEI e/ou TransfereGov" />
        </Panel>
        <Panel className="px-5 py-4">
          <Numero
            rotulo="Cookies sob guarda"
            valor={String(ativas.reduce((n, s) => n + s.qtdCookies, 0))}
            tom="cleo"
            detalhe="Metadados apenas — nunca o valor"
          />
        </Panel>
      </div>

      {lista.length === 0 ? (
        <Panel>
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <KeyRound size={30} className="text-faint" />
            <p className="max-w-[46ch] text-[13px] leading-relaxed text-muted">
              Nenhuma sessão no cofre. Abra o SEI ou o TransfereGov com a extensão instalada e clique
              em <span className="text-ink">"Levar minha sessão para a Cleo"</span> no painel do
              copiloto.
            </p>
            <a href="/extensao">
              <Botao variante="primario">
                <Puzzle size={13} /> Ver a extensão
              </Botao>
            </a>
          </div>
        </Panel>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {lista.map((s) => (
            <CartaoSessao key={s.sistema} sessao={s} onRenovar={() => window.open(`/sistemas/${s.sistema}`, '_blank')} onDescartar={() => descartar(s.sistema)} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          [ShieldCheck, 'A sessão é do usuário', 'A extensão captura a sessão que ele já abriu — inclusive os cookies httpOnly que a página não enxerga. Nenhuma senha passa pela Cleo.'],
          [Workflow, 'A Cleo opera sozinha', 'Com a sessão viva no cofre, a fila de ritos roda no servidor sem o usuário presente — a madrugada trabalha por ele.'],
          [RefreshCw, 'Renovação sob pedido', 'Perto de expirar, a Cleo avisa e pede para o usuário reabrir o sistema um instante. A extensão recaptura, e a operação segue.'],
        ].map(([Icone, titulo, texto]) => {
          const I = Icone as typeof ShieldCheck
          return (
            <Panel key={titulo as string} className="px-5 py-4">
              <I size={16} className="mb-2.5 text-teal" />
              <div className="mb-1 text-[13px] text-ink">{titulo as string}</div>
              <p className="text-[11.5px] leading-relaxed text-muted">{texto as string}</p>
            </Panel>
          )
        })}
      </div>
    </div>
  )
}

function CartaoSessao({
  sessao,
  onRenovar,
  onDescartar,
}: {
  sessao: Sessao
  onRenovar: () => void
  onDescartar: () => void
}) {
  const restante = sessao.expiraEm - Date.now()
  const expirada = restante <= 0
  const perto = restante > 0 && restante < 20 * 60 * 1000
  const fracao = Math.max(Math.min(restante / DURACAO, 1), 0)

  return (
    <Panel
      className={cn(
        'overflow-hidden',
        expirada ? 'border-alert/30' : perto ? 'border-gold/30' : 'border-teal/25',
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              'flex size-8 items-center justify-center rounded-lg border',
              sessao.sistema === 'sei' ? 'border-[#4a90d9]/40 bg-[#4a90d9]/10' : 'border-[#1351b4]/40 bg-[#1351b4]/10',
            )}
          >
            <Lock size={14} className={sessao.sistema === 'sei' ? 'text-[#6aa9e0]' : 'text-[#5b8ede]'} />
          </span>
          <div>
            <div className="text-[13.5px] text-ink">Sessão {ROTULO[sessao.sistema]}</div>
            <div className="num text-[10.5px] text-faint">{sessao.dominio}</div>
          </div>
        </div>
        <Badge tom={expirada ? 'alert' : perto ? 'gold' : 'teal'} ponto>
          {expirada ? 'expirada' : perto ? 'expira já' : 'ativa'}
        </Badge>
      </div>

      <div className="px-5 py-4">
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className="flex items-center gap-1.5 text-[11.5px] text-muted">
            <Timer size={12} /> Validade restante
          </span>
          <span
            className={cn(
              'num text-[13px]',
              expirada ? 'text-alert' : perto ? 'text-gold' : 'text-teal',
            )}
          >
            {formatar(restante)}
          </span>
        </div>
        <Medidor valor={fracao} tom={expirada ? 'alert' : perto ? 'gold' : 'teal'} altura={6} />

        <div className="num mt-3 text-[11px] text-faint">usuário {sessao.usuario}</div>

        <div className="mt-3 rounded-lg border border-line bg-abyss/40 p-3">
          <div className="eyebrow mb-2 flex items-center gap-1.5">
            <Cookie size={10} /> {sessao.qtdCookies} cookies de sessão
          </div>
          <ul className="flex flex-col gap-1.5">
            {sessao.cookies.map((c) => (
              <li key={c.nome} className="flex items-center gap-2 text-[11px]">
                <span className="num text-ink">{c.nome}</span>
                <span className="num text-faint">{c.amostra}</span>
                {c.httpOnly && <span className="rounded bg-cleo/15 px-1.5 text-[9px] text-cleo">httpOnly</span>}
                {c.seguro && <span className="rounded bg-teal/15 px-1.5 text-[9px] text-teal">secure</span>}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 flex items-center gap-2">
          {expirada || perto ? (
            <Botao variante="primario" tamanho="sm" onClick={onRenovar}>
              <RefreshCw size={11} /> Renovar sessão
            </Botao>
          ) : (
            <span className="flex items-center gap-1.5 text-[11.5px] text-teal">
              <ShieldCheck size={12} /> A Cleo pode operar agora
            </span>
          )}
          <Botao variante="fantasma" tamanho="sm" className="ml-auto" onClick={onDescartar}>
            <Trash2 size={11} /> Encerrar
          </Botao>
        </div>
      </div>
    </Panel>
  )
}

function formatar(ms: number): string {
  if (ms <= 0) return 'expirada'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}min`
  return `${m}min ${String(s).padStart(2, '0')}s`
}
