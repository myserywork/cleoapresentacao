import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, FileText, GitBranch, Mails, Radio, Workflow } from 'lucide-react'
import { useApp } from '@/store/app'
import { auditoriaDoOrgao } from '@/data/repo'
import { cn, desde } from '@/lib/format'
import { Panel } from '@/components/ui'
import type { TipoEventoAuditoria } from '@/data/types'

const ICONE: Partial<Record<TipoEventoAuditoria, typeof Activity>> = {
  automacao: Workflow,
  documento: FileText,
  regra: GitBranch,
  diligencia: Mails,
}

const COR: Record<TipoEventoAuditoria, string> = {
  automacao: 'text-cleo',
  documento: 'text-teal',
  regra: 'text-cleo',
  diligencia: 'text-gold',
  decisao: 'text-gold',
  acesso: 'text-inert',
  comentario: 'text-inert',
}

const FILTROS: { id: TipoEventoAuditoria | 'todos'; rotulo: string }[] = [
  { id: 'todos', rotulo: 'Tudo' },
  { id: 'automacao', rotulo: 'Automação' },
  { id: 'documento', rotulo: 'Documento' },
  { id: 'diligencia', rotulo: 'Diligência' },
]

/**
 * Feed de atividade.
 *
 * O que dá a sensação de sistema em uso não é o número parado: é a linha que
 * aparece sozinha. O feed revela um evento a cada poucos segundos, do mais
 * recente para o mais antigo — o mesmo dado da trilha de auditoria, em ritmo.
 */
export function FeedAtividade({ altura = 340 }: { altura?: number }) {
  const { orgaoId, auditoriaDaSessao } = useApp()
  const navegar = useNavigate()
  const [filtro, setFiltro] = useState<TipoEventoAuditoria | 'todos'>('todos')
  const [visiveis, setVisiveis] = useState(6)

  const eventos = useMemo(() => {
    const todos = [...auditoriaDaSessao, ...auditoriaDoOrgao(orgaoId)].filter(
      (e) => e.tipo !== 'acesso',
    )
    return filtro === 'todos' ? todos : todos.filter((e) => e.tipo === filtro)
  }, [orgaoId, auditoriaDaSessao, filtro])

  useEffect(() => {
    setVisiveis(6)
  }, [filtro, orgaoId])

  useEffect(() => {
    const t = setInterval(() => setVisiveis((v) => Math.min(v + 1, 24)), 3200)
    return () => clearInterval(t)
  }, [])

  return (
    <Panel className="flex flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line px-4 py-3 sm:px-5 sm:py-3.5">
        <div className="flex items-center gap-2">
          <Radio size={12} className="animate-pulse text-teal" />
          <span className="eyebrow">Atividade do órgão</span>
        </div>
        <div className="rolagem-discreta -mx-1 flex gap-0.5 overflow-x-auto px-1">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className={cn(
                'shrink-0 rounded px-2 py-1 text-[11px] transition-colors',
                filtro === f.id ? 'bg-gold/15 text-gold' : 'text-faint hover:text-ink',
              )}
            >
              {f.rotulo}
            </button>
          ))}
        </div>
      </div>

      <ul className="flex-1 divide-y divide-line-soft overflow-y-auto" style={{ maxHeight: altura }}>
        {eventos.slice(0, visiveis).map((e, i) => {
          const Icone = ICONE[e.tipo] ?? Activity
          return (
            <li
              key={e.id}
              onClick={() => e.propostaId && navegar(`/propostas/${e.propostaId}`)}
              className={cn(
                'flex items-start gap-3 px-4 py-2.5 transition-colors sm:px-5',
                e.propostaId && 'cursor-pointer hover:bg-white/[0.03]',
                i === 0 && 'bg-white/[0.02]',
              )}
            >
              <Icone size={13} className={cn('mt-0.5 shrink-0', COR[e.tipo])} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] text-ink">
                  <span className={e.ator === 'Cleo' ? 'text-cleo' : 'text-muted'}>{e.ator}</span>{' '}
                  {e.acao.toLowerCase()}
                </div>
                <div className="num truncate text-[11px] text-faint">{e.alvo}</div>
              </div>
              <span className="shrink-0 text-[10.5px] text-faint">{desde(e.data)}</span>
            </li>
          )
        })}
        {eventos.length === 0 && (
          <li className="px-5 py-8 text-center text-[12.5px] text-muted">
            Nenhum evento deste tipo no órgão.
          </li>
        )}
      </ul>

      <button
        onClick={() => navegar('/auditoria')}
        className="border-t border-line px-5 py-2.5 text-left text-[11.5px] text-muted transition-colors hover:text-gold"
      >
        Ver a trilha completa →
      </button>
    </Panel>
  )
}
