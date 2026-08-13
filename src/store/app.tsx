import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { APROVACOES, ORGAOS, REGRAS_FABRICA, RITOS_FABRICA } from '@/data/repo'
import type {
  Aprovacao,
  Automacao,
  EventoAuditoria,
  Gatilho,
  RegraGatilho,
  Rito,
} from '@/data/types'
import type { FiltroPropostas, WidgetSpec } from '@/comandos/tipos'

export interface ExecucaoPendente {
  propostaId: string
  /** Gatilhos em sequência. Um só é o caso comum; vários formam o rito completo. */
  fila: Gatilho[]
  titulo?: string
}

/** Execução do mesmo rito sobre várias propostas, com progresso individual. */
export interface LoteAtivo {
  ritoId: string
  titulo: string
  propostaIds: string[]
}

/** Narração do que o copiloto está fazendo, exibida sobre a interface. */
export interface Rastro {
  rotulo: string
  detalhe?: string
}

export interface Comentario {
  id: string
  propostaId: string
  autor: string
  texto: string
  criadoEm: string
}

export interface Notificacao {
  id: string
  titulo: string
  detalhe: string
  criadoEm: string
  lida: boolean
  href?: string
  tipo: 'automacao' | 'aprovacao' | 'comentario'
}

export type Tema = 'escuro' | 'claro'
export type Publico = 'gestor' | 'tecnico' | 'parlamentar'

interface AppState {
  orgaoId: string
  setOrgaoId: (id: string) => void

  tema: Tema
  alternarTema: () => void

  execucoesDaSessao: Automacao[]
  registrarExecucao: (a: Automacao) => void

  execucaoAtiva: ExecucaoPendente | null
  abrirExecucao: (e: ExecucaoPendente) => void
  fecharExecucao: () => void

  loteAtivo: LoteAtivo | null
  abrirLote: (l: LoteAtivo) => void
  fecharLote: () => void

  aprovacoes: Aprovacao[]
  decidir: (ids: string[], decisao: 'aprovada' | 'recusada') => void
  /** Devolve decisões à fila — decisão em lote sem volta é armadilha. */
  reverter: (ids: string[]) => void
  /** Envia propostas da listagem para a fila do gestor. */
  solicitarAprovacao: (propostaIds: string[]) => number

  ritos: Rito[]
  salvarRito: (r: Rito) => void
  removerRito: (id: string) => void

  regras: RegraGatilho[]
  salvarRegra: (r: RegraGatilho) => void
  alternarRegra: (id: string) => void
  removerRegra: (id: string) => void

  /** Eventos produzidos durante a sessão, somados à trilha histórica. */
  auditoriaDaSessao: EventoAuditoria[]
  registrarAuditoria: (e: Omit<EventoAuditoria, 'id' | 'data'>) => void

  /** Filtro da listagem — compartilhado para que um comando possa alterá-lo. */
  filtroPropostas: FiltroPropostas
  setFiltroPropostas: (f: FiltroPropostas) => void

  /** Nó que o Cérebro deve centralizar ao abrir. */
  focoCerebro: string | null
  setFocoCerebro: (id: string | null) => void

  /** Widget flutuante em foco — a Cleo mostra sem tirar a pessoa da tela. */
  widget: WidgetSpec | null
  abrirWidget: (w: WidgetSpec) => void
  fecharWidget: () => void

  rastro: Rastro | null
  setRastro: (r: Rastro | null) => void

  /** Verdadeiro enquanto o modo apresentação dirige a plataforma. */
  apresentando: boolean
  setApresentando: (v: boolean) => void
  publico: Publico
  setPublico: (p: Publico) => void

  /** Propostas na bandeja de comparação. */
  comparacao: string[]
  alternarComparacao: (propostaId: string) => void
  limparComparacao: () => void

  comentarios: Comentario[]
  comentar: (propostaId: string, texto: string) => void

  notificacoes: Notificacao[]
  notificar: (n: Omit<Notificacao, 'id' | 'criadoEm' | 'lida'>) => void
  marcarLidas: () => void

  tourVisto: boolean
  marcarTourVisto: () => void
}

const Ctx = createContext<AppState | null>(null)

/* ---------- Persistência ---------- */

const CHAVE = 'cleopatra.sessao.v1'

interface Persistido {
  orgaoId?: string
  tema?: Tema
  publico?: Publico
  decisoes?: Record<string, 'pendente' | 'aprovada' | 'recusada'>
  comentarios?: Comentario[]
  ritosProprios?: Rito[]
  regras?: RegraGatilho[]
  tourVisto?: boolean
}

function ler(): Persistido {
  try {
    const bruto = localStorage.getItem(CHAVE)
    return bruto ? (JSON.parse(bruto) as Persistido) : {}
  } catch {
    // Sessão sem armazenamento local (aba anônima, política restritiva): a
    // plataforma continua funcionando, só não sobrevive ao F5.
    return {}
  }
}

function gravar(dados: Persistido) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(dados))
  } catch {
    /* silêncio proposital: persistir é conveniência, não requisito */
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const salvo = useMemo(ler, [])

  const [orgaoId, setOrgaoId] = useState(salvo.orgaoId ?? ORGAOS[0].id)
  const [tema, setTema] = useState<Tema>(salvo.tema ?? 'escuro')
  const [publico, setPublico] = useState<Publico>(salvo.publico ?? 'gestor')
  const [execucoesDaSessao, setExecucoes] = useState<Automacao[]>([])
  const [execucaoAtiva, setExecucaoAtiva] = useState<ExecucaoPendente | null>(null)
  const [loteAtivo, setLoteAtivo] = useState<LoteAtivo | null>(null)
  const [aprovacoes, setAprovacoes] = useState<Aprovacao[]>(() =>
    salvo.decisoes
      ? APROVACOES.map((a) => ({ ...a, decidida: salvo.decisoes![a.id] ?? a.decidida }))
      : APROVACOES,
  )
  const [ritosProprios, setRitosProprios] = useState<Rito[]>(salvo.ritosProprios ?? [])
  const [regras, setRegras] = useState<RegraGatilho[]>(salvo.regras ?? REGRAS_FABRICA)
  const [auditoriaDaSessao, setAuditoria] = useState<EventoAuditoria[]>([])
  const [filtroPropostas, setFiltroPropostas] = useState<FiltroPropostas>({})
  const [focoCerebro, setFocoCerebro] = useState<string | null>(null)
  const [widget, setWidget] = useState<WidgetSpec | null>(null)
  const [rastro, setRastro] = useState<Rastro | null>(null)
  const [apresentando, setApresentando] = useState(false)
  const [comparacao, setComparacao] = useState<string[]>([])
  const [comentarios, setComentarios] = useState<Comentario[]>(salvo.comentarios ?? [])
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [tourVisto, setTourVisto] = useState(salvo.tourVisto ?? false)

  const ritos = useMemo(() => [...ritosProprios, ...RITOS_FABRICA], [ritosProprios])

  // O tema mora no elemento raiz para que o CSS resolva sem passar por React.
  useEffect(() => {
    document.documentElement.dataset.tema = tema
  }, [tema])

  useEffect(() => {
    const decisoes: Record<string, 'pendente' | 'aprovada' | 'recusada'> = {}
    for (const a of aprovacoes) if (a.decidida !== 'pendente') decisoes[a.id] = a.decidida
    gravar({ orgaoId, tema, publico, decisoes, comentarios, ritosProprios, regras, tourVisto })
  }, [orgaoId, tema, publico, aprovacoes, comentarios, ritosProprios, regras, tourVisto])

  const notificar = useCallback((n: Omit<Notificacao, 'id' | 'criadoEm' | 'lida'>) => {
    setNotificacoes((prev) => [
      { ...n, id: `nt-${Date.now()}-${prev.length}`, criadoEm: new Date().toISOString(), lida: false },
      ...prev,
    ])
  }, [])

  const registrarAuditoria = useCallback((e: Omit<EventoAuditoria, 'id' | 'data'>) => {
    setAuditoria((prev) => [
      { ...e, id: `aus-${Date.now()}-${prev.length}`, data: new Date().toISOString() },
      ...prev,
    ])
  }, [])

  const comentar = useCallback((propostaId: string, texto: string) => {
    setComentarios((prev) => [
      ...prev,
      {
        id: `cm-${Date.now()}`,
        propostaId,
        autor: 'Você',
        texto,
        criadoEm: new Date().toISOString(),
      },
    ])
  }, [])

  const marcarLidas = useCallback(() => {
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })))
  }, [])

  const registrarExecucao = useCallback((a: Automacao) => {
    setExecucoes((prev) => [a, ...prev])
  }, [])

  const decidir = useCallback((ids: string[], decisao: 'aprovada' | 'recusada') => {
    const alvo = new Set(ids)
    setAprovacoes((prev) => prev.map((a) => (alvo.has(a.id) ? { ...a, decidida: decisao } : a)))
  }, [])

  const reverter = useCallback((ids: string[]) => {
    const alvo = new Set(ids)
    setAprovacoes((prev) =>
      prev.map((a) => (alvo.has(a.id) ? { ...a, decidida: 'pendente' } : a)),
    )
  }, [])

  const solicitarAprovacao = useCallback((propostaIds: string[]) => {
    let criadas = 0
    setAprovacoes((prev) => {
      // Não duplica: proposta que já tem pedido pendente é ignorada.
      const jaPendentes = new Set(
        prev.filter((a) => a.decidida === 'pendente').map((a) => a.propostaId),
      )
      const novas = propostaIds
        .filter((id) => !jaPendentes.has(id))
        .map((propostaId, i) => ({
          id: `ap-nova-${Date.now()}-${i}`,
          tipo: 'aprovar_proposta' as const,
          propostaId,
          solicitadoEm: new Date().toISOString(),
          solicitadoPor: 'Você',
          justificativa: 'Enviada em lote a partir da listagem de propostas.',
          decidida: 'pendente' as const,
        }))
      criadas = novas.length
      return [...novas, ...prev]
    })
    return criadas
  }, [])

  const salvarRito = useCallback((rito: Rito) => {
    setRitosProprios((prev) => {
      const existe = prev.some((r) => r.id === rito.id)
      return existe ? prev.map((r) => (r.id === rito.id ? rito : r)) : [rito, ...prev]
    })
  }, [])

  const removerRito = useCallback((id: string) => {
    setRitosProprios((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const salvarRegra = useCallback((regra: RegraGatilho) => {
    setRegras((prev) => {
      const existe = prev.some((r) => r.id === regra.id)
      return existe ? prev.map((r) => (r.id === regra.id ? regra : r)) : [regra, ...prev]
    })
  }, [])

  const alternarRegra = useCallback((id: string) => {
    setRegras((prev) => prev.map((r) => (r.id === id ? { ...r, ativa: !r.ativa } : r)))
  }, [])

  const removerRegra = useCallback((id: string) => {
    setRegras((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const alternarComparacao = useCallback((propostaId: string) => {
    setComparacao((prev) =>
      prev.includes(propostaId)
        ? prev.filter((id) => id !== propostaId)
        : // Três é o limite que ainda cabe lado a lado sem rolagem horizontal.
          [...prev, propostaId].slice(-3),
    )
  }, [])

  const value = useMemo<AppState>(
    () => ({
      orgaoId,
      setOrgaoId,
      tema,
      alternarTema: () => setTema((t) => (t === 'escuro' ? 'claro' : 'escuro')),
      execucoesDaSessao,
      registrarExecucao,
      execucaoAtiva,
      abrirExecucao: setExecucaoAtiva,
      fecharExecucao: () => setExecucaoAtiva(null),
      loteAtivo,
      abrirLote: setLoteAtivo,
      fecharLote: () => setLoteAtivo(null),
      aprovacoes,
      decidir,
      reverter,
      solicitarAprovacao,
      ritos,
      salvarRito,
      removerRito,
      regras,
      salvarRegra,
      alternarRegra,
      removerRegra,
      auditoriaDaSessao,
      registrarAuditoria,
      filtroPropostas,
      setFiltroPropostas,
      focoCerebro,
      setFocoCerebro,
      widget,
      abrirWidget: setWidget,
      fecharWidget: () => setWidget(null),
      rastro,
      setRastro,
      apresentando,
      setApresentando,
      publico,
      setPublico,
      comparacao,
      alternarComparacao,
      limparComparacao: () => setComparacao([]),
      comentarios,
      comentar,
      notificacoes,
      notificar,
      marcarLidas,
      tourVisto,
      marcarTourVisto: () => setTourVisto(true),
    }),
    [
      orgaoId,
      tema,
      execucoesDaSessao,
      execucaoAtiva,
      loteAtivo,
      aprovacoes,
      ritos,
      regras,
      auditoriaDaSessao,
      filtroPropostas,
      focoCerebro,
      widget,
      rastro,
      apresentando,
      publico,
      comparacao,
      comentarios,
      notificacoes,
      tourVisto,
      comentar,
      notificar,
      marcarLidas,
      registrarExecucao,
      registrarAuditoria,
      decidir,
      reverter,
      solicitarAprovacao,
      salvarRito,
      removerRito,
      salvarRegra,
      alternarRegra,
      removerRegra,
      alternarComparacao,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp precisa estar dentro de AppProvider')
  return ctx
}
