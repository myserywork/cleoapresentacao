import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { APROVACOES, ORGAOS } from '@/data/repo'
import type { Aprovacao, Automacao, Gatilho } from '@/data/types'
import type { FiltroPropostas } from '@/comandos/tipos'

export interface ExecucaoPendente {
  propostaId: string
  /** Gatilhos em sequência. Um só é o caso comum; vários formam o rito completo. */
  fila: Gatilho[]
  titulo?: string
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

interface AppState {
  orgaoId: string
  setOrgaoId: (id: string) => void

  execucoesDaSessao: Automacao[]
  registrarExecucao: (a: Automacao) => void

  execucaoAtiva: ExecucaoPendente | null
  abrirExecucao: (e: ExecucaoPendente) => void
  fecharExecucao: () => void

  aprovacoes: Aprovacao[]
  decidir: (ids: string[], decisao: 'aprovada' | 'recusada') => void
  /** Devolve decisões à fila — decisão em lote sem volta é armadilha. */
  reverter: (ids: string[]) => void
  /** Envia propostas da listagem para a fila do gestor. */
  solicitarAprovacao: (propostaIds: string[]) => number

  /** Filtro da listagem — compartilhado para que um comando possa alterá-lo. */
  filtroPropostas: FiltroPropostas
  setFiltroPropostas: (f: FiltroPropostas) => void

  /** Nó que o Cérebro deve centralizar ao abrir. */
  focoCerebro: string | null
  setFocoCerebro: (id: string | null) => void

  rastro: Rastro | null
  setRastro: (r: Rastro | null) => void

  /** Verdadeiro enquanto o modo apresentação dirige a plataforma. */
  apresentando: boolean
  setApresentando: (v: boolean) => void

  comentarios: Comentario[]
  comentar: (propostaId: string, texto: string) => void

  notificacoes: Notificacao[]
  notificar: (n: Omit<Notificacao, 'id' | 'criadoEm' | 'lida'>) => void
  marcarLidas: () => void
}

const Ctx = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [orgaoId, setOrgaoId] = useState(ORGAOS[0].id)
  const [execucoesDaSessao, setExecucoes] = useState<Automacao[]>([])
  const [execucaoAtiva, setExecucaoAtiva] = useState<ExecucaoPendente | null>(null)
  const [aprovacoes, setAprovacoes] = useState<Aprovacao[]>(APROVACOES)
  const [filtroPropostas, setFiltroPropostas] = useState<FiltroPropostas>({})
  const [focoCerebro, setFocoCerebro] = useState<string | null>(null)
  const [rastro, setRastro] = useState<Rastro | null>(null)
  const [apresentando, setApresentando] = useState(false)
  const [comentarios, setComentarios] = useState<Comentario[]>([])
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])

  const notificar = useCallback((n: Omit<Notificacao, 'id' | 'criadoEm' | 'lida'>) => {
    setNotificacoes((prev) => [
      { ...n, id: `nt-${Date.now()}-${prev.length}`, criadoEm: new Date().toISOString(), lida: false },
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

  const value = useMemo<AppState>(
    () => ({
      orgaoId,
      setOrgaoId,
      execucoesDaSessao,
      registrarExecucao,
      execucaoAtiva,
      abrirExecucao: setExecucaoAtiva,
      fecharExecucao: () => setExecucaoAtiva(null),
      aprovacoes,
      decidir,
      reverter,
      solicitarAprovacao,
      filtroPropostas,
      setFiltroPropostas,
      focoCerebro,
      setFocoCerebro,
      rastro,
      setRastro,
      apresentando,
      setApresentando,
      comentarios,
      comentar,
      notificacoes,
      notificar,
      marcarLidas,
    }),
    [
      orgaoId,
      execucoesDaSessao,
      execucaoAtiva,
      aprovacoes,
      filtroPropostas,
      focoCerebro,
      rastro,
      apresentando,
      comentarios,
      notificacoes,
      comentar,
      notificar,
      marcarLidas,
      registrarExecucao,
      decidir,
      reverter,
      solicitarAprovacao,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp precisa estar dentro de AppProvider')
  return ctx
}
