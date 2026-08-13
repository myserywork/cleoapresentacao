import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink, GripVertical, Maximize2, Minus, X } from 'lucide-react'
import { useApp } from '@/store/app'
import { getOrgao, getProponente, getProposta } from '@/data/repo'
import { fimDeExercicio, funilDoOrgao, riscoRestosAPagar } from '@/dominio/orcamento'
import { carteiraDeVigencias, resumoPrestacoes, situacaoVigencia, TOM_PRESTACAO, carteiraDePrestacoes } from '@/dominio/ciclo'
import { resumoEmendas, carteirasPorParlamentar } from '@/dominio/emendas'
import { cargaDaEquipe, resumoEquipe } from '@/dominio/equipe'
import { detectarAnomalias } from '@/dominio/anomalias'
import { alertas } from '@/dominio/riscos'
import { cn, data, moedaCompacta, numero } from '@/lib/format'
import { Badge, Botao, SituacaoBadge } from '@/components/ui'
import { Medidor, Numero } from '@/components/dados'
import { FunilExecucao, BarrasHorizontais } from '@/components/charts'
import { CicloDeVida } from '@/components/CicloDeVida'
import type { WidgetSpec } from '@/comandos/tipos'

/**
 * Palco de widgets.
 *
 * A alternativa à navegação: a Cleo — ou qualquer parte da plataforma — abre um
 * painel flutuante sobre a tela com exatamente o que interessa, e oferece
 * "abrir a página" para quem quiser aprofundar. O painel é arrastável e pode
 * ser minimizado para o canto, virando uma pastilha que se reabre num clique.
 *
 * Isso muda a conversa com a plataforma: perguntar deixa de custar o lugar em
 * que você estava.
 */
export function PalcoWidget() {
  const { widget, fecharWidget, orgaoId } = useApp()
  const navegar = useNavigate()

  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [minimizado, setMinimizado] = useState(false)
  const arraste = useRef<{ dx: number; dy: number } | null>(null)

  // Cada widget novo entra na posição padrão e expandido
  useEffect(() => {
    if (widget) {
      setPos(null)
      setMinimizado(false)
    }
  }, [widget])

  useEffect(() => {
    if (!widget) return
    const fechar = (e: KeyboardEvent) => e.key === 'Escape' && fecharWidget()
    window.addEventListener('keydown', fechar)
    return () => window.removeEventListener('keydown', fechar)
  }, [widget, fecharWidget])

  useEffect(() => {
    function mover(e: PointerEvent) {
      if (!arraste.current) return
      setPos({
        x: Math.max(e.clientX - arraste.current.dx, 8),
        y: Math.max(e.clientY - arraste.current.dy, 8),
      })
    }
    function soltar() {
      arraste.current = null
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
    return () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
    }
  }, [])

  if (!widget) return null

  if (minimizado) {
    return (
      <button
        onClick={() => setMinimizado(false)}
        className="nao-imprimir fixed right-6 bottom-6 z-[58] flex items-center gap-2.5 rounded-full border border-cleo/40 bg-surface/96 px-4 py-2.5 text-[12.5px] text-ink shadow-2xl backdrop-blur-xl transition-colors hover:border-cleo"
      >
        <span className="size-2 rounded-full bg-cleo" />
        {widget.titulo}
        <Maximize2 size={12} className="text-faint" />
      </button>
    )
  }

  const estilo = pos
    ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' }
    : { right: 24, bottom: 24 }

  return (
    <div
      className="nao-imprimir pagina-entra fixed inset-x-2 bottom-2 z-[58] overflow-hidden rounded-2xl border border-cleo/30 bg-surface/97 shadow-2xl backdrop-blur-xl md:inset-x-auto md:bottom-auto md:w-[min(560px,92vw)]"
      style={window.innerWidth >= 768 ? (estilo as React.CSSProperties) : undefined}
    >
      <div
        onPointerDown={(e) => {
          const r = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect()
          arraste.current = { dx: e.clientX - r.left, dy: e.clientY - r.top }
        }}
        className="flex cursor-grab items-start justify-between gap-3 border-b border-line px-4 py-3 active:cursor-grabbing"
      >
        <div className="flex min-w-0 items-start gap-2.5">
          <GripVertical size={14} className="mt-0.5 shrink-0 text-faint" />
          <div className="min-w-0">
            <div className="truncate text-[13.5px] text-ink">{widget.titulo}</div>
            {widget.subtitulo && (
              <div className="truncate text-[11px] text-muted">{widget.subtitulo}</div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {widget.href && (
            <button
              onClick={() => {
                navegar(widget.href!)
                fecharWidget()
              }}
              title="Abrir a página inteira"
              className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-[11px] text-muted transition-colors hover:border-gold/40 hover:text-gold"
            >
              <ExternalLink size={11} /> Abrir página
            </button>
          )}
          <button
            onClick={() => setMinimizado(true)}
            title="Minimizar"
            className="rounded p-1 text-faint hover:text-ink"
          >
            <Minus size={14} />
          </button>
          <button onClick={fecharWidget} title="Fechar" className="rounded p-1 text-faint hover:text-ink">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="max-h-[min(62vh,560px)] overflow-y-auto">
        <Conteudo widget={widget} orgaoId={orgaoId} aoNavegar={(r) => { navegar(r); fecharWidget() }} />
      </div>
    </div>
  )
}

/* ---------- Renderizadores por tipo ---------- */

function Conteudo({
  widget,
  orgaoId,
  aoNavegar,
}: {
  widget: WidgetSpec
  orgaoId: string
  aoNavegar: (rota: string) => void
}) {
  switch (widget.tipo) {
    case 'orcamento':
      return <WOrcamento orgaoId={orgaoId} />
    case 'vigencias':
      return <WVigencias orgaoId={orgaoId} aoNavegar={aoNavegar} />
    case 'contas':
      return <WContas orgaoId={orgaoId} aoNavegar={aoNavegar} />
    case 'emendas':
      return <WEmendas orgaoId={orgaoId} aoNavegar={aoNavegar} />
    case 'equipe':
      return <WEquipe orgaoId={orgaoId} />
    case 'padroes':
      return <WPadroes orgaoId={orgaoId} />
    case 'proposta':
      return <WProposta id={String(widget.params?.id ?? '')} aoNavegar={aoNavegar} />
    case 'tabela':
      return <WTabela params={widget.params} />
    case 'grafico':
      return <WGrafico params={widget.params} />
    default:
      return null
  }
}

function WOrcamento({ orgaoId }: { orgaoId: string }) {
  const funil = useMemo(() => funilDoOrgao(orgaoId), [orgaoId])
  const fim = useMemo(() => fimDeExercicio(orgaoId), [orgaoId])
  const restos = useMemo(() => riscoRestosAPagar(orgaoId), [orgaoId])
  return (
    <div className="flex flex-col gap-4 px-5 py-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Numero rotulo="Saldo a empenhar" valor={moedaCompacta(fim.saldoAEmpenhar)} tom="gold" />
        <Numero rotulo="Dias úteis" valor={numero(fim.diasUteis)} tom={fim.emRisco ? 'alert' : 'teal'} />
        <Numero rotulo="A liquidar" valor={moedaCompacta(restos.total)} tom="cleo" />
      </div>
      <FunilExecucao degraus={funil.degraus} />
    </div>
  )
}

function WVigencias({ orgaoId, aoNavegar }: { orgaoId: string; aoNavegar: (r: string) => void }) {
  const carteira = useMemo(() => carteiraDeVigencias(orgaoId), [orgaoId])
  const criticos = carteira.filter((v) => v.situacao.diasRestantes <= 30).slice(0, 8)
  return (
    <ul className="divide-y divide-line-soft">
      {criticos.map((v) => (
        <li
          key={v.proposta.id}
          onClick={() => aoNavegar(`/propostas/${v.proposta.id}`)}
          className="flex cursor-pointer items-center gap-3 px-5 py-2.5 hover:bg-white/[0.03]"
        >
          <span className="num shrink-0 text-[12px] text-ink">{v.proposta.numero}</span>
          <span className="min-w-0 flex-1 truncate text-[11.5px] text-muted">
            {getProponente(v.proposta.proponenteId)?.nome}
          </span>
          <span className="num shrink-0 text-[11.5px] text-muted">{data(v.situacao.vigencia.fim)}</span>
          <span
            className={cn(
              'num w-20 shrink-0 text-right text-[11.5px]',
              v.situacao.diasRestantes < 0 ? 'text-alert' : 'text-gold',
            )}
          >
            {v.situacao.diasRestantes < 0
              ? `${Math.abs(v.situacao.diasRestantes)}d vencida`
              : `${v.situacao.diasRestantes}d`}
          </span>
        </li>
      ))}
      {criticos.length === 0 && (
        <li className="px-5 py-8 text-center text-[12.5px] text-muted">
          Nenhum convênio vencendo em 30 dias.
        </li>
      )}
    </ul>
  )
}

function WContas({ orgaoId, aoNavegar }: { orgaoId: string; aoNavegar: (r: string) => void }) {
  const resumo = useMemo(() => resumoPrestacoes(orgaoId), [orgaoId])
  const itens = useMemo(
    () => carteiraDePrestacoes(orgaoId).filter((i) => i.bloqueia).slice(0, 7),
    [orgaoId],
  )
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 border-b border-line px-5 py-4">
        <Numero rotulo="Em atraso" valor={numero(resumo.atrasadas)} tom="alert" />
        <Numero rotulo="Proponentes travados" valor={numero(resumo.proponentesBloqueados)} tom="gold" />
        <Numero rotulo="Valor travado" valor={moedaCompacta(resumo.valorBloqueado)} tom="alert" />
      </div>
      <ul className="divide-y divide-line-soft">
        {itens.map((i) => (
          <li
            key={i.proposta.id}
            onClick={() => aoNavegar(`/propostas/${i.proposta.id}`)}
            className="flex cursor-pointer items-center gap-3 px-5 py-2.5 hover:bg-white/[0.03]"
          >
            <span className="num shrink-0 text-[12px] text-ink">{i.proposta.numero}</span>
            <span className="min-w-0 flex-1 truncate text-[11.5px] text-muted">
              {getProponente(i.proposta.proponenteId)?.nome}
            </span>
            <Badge tom={TOM_PRESTACAO[i.status]}>{i.status}</Badge>
          </li>
        ))}
      </ul>
    </div>
  )
}

function WEmendas({ orgaoId, aoNavegar }: { orgaoId: string; aoNavegar: (r: string) => void }) {
  const resumo = useMemo(() => resumoEmendas(orgaoId), [orgaoId])
  const top = useMemo(() => carteirasPorParlamentar(orgaoId).slice(0, 6), [orgaoId])
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 border-b border-line px-5 py-4">
        <Numero rotulo="Indicado" valor={moedaCompacta(resumo.valorIndicado)} tom="gold" />
        <Numero rotulo="Empenhado" valor={moedaCompacta(resumo.valorEmpenhado)} tom="teal" />
        <Numero rotulo="Execução" valor={`${(resumo.execucao * 100).toFixed(0)}%`} tom="cleo" />
      </div>
      <ul className="divide-y divide-line-soft">
        {top.map((c) => (
          <li
            key={c.parlamentar.id}
            onClick={() => aoNavegar(`/parlamentares/${c.parlamentar.id}`)}
            className="flex cursor-pointer items-center gap-3 px-5 py-2.5 hover:bg-white/[0.03]"
          >
            <span className="min-w-0 flex-1 truncate text-[12px] text-ink">{c.parlamentar.nome}</span>
            <span className="num shrink-0 text-[11px] text-faint">
              {c.parlamentar.partido}/{c.parlamentar.uf}
            </span>
            <div className="w-16 shrink-0">
              <Medidor valor={c.execucao} tom={c.execucao > 0.5 ? 'teal' : 'gold'} altura={4} />
            </div>
            <span className={cn('num w-9 shrink-0 text-right text-[11.5px]', c.pressao > 90 ? 'text-alert' : 'text-muted')}>
              {c.pressao}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function WEquipe({ orgaoId }: { orgaoId: string }) {
  const carga = useMemo(() => cargaDaEquipe(orgaoId), [orgaoId])
  const resumo = useMemo(() => resumoEquipe(orgaoId), [orgaoId])
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 border-b border-line px-5 py-4">
        <Numero rotulo="Ocupação média" valor={`${(resumo.ocupacaoMedia * 100).toFixed(0)}%`} tom="gold" />
        <Numero rotulo="Desequilíbrio" valor={`${(resumo.desequilibrio * 100).toFixed(0)} p.p.`} tom="alert" />
        <Numero rotulo="Propostas" valor={numero(resumo.atribuidas)} />
      </div>
      <ul className="flex flex-col gap-3 px-5 py-4">
        {carga.map((c) => (
          <li key={c.analista.id}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="truncate text-[12px] text-ink">{c.analista.nome}</span>
              <span className="num shrink-0 text-[11.5px] text-muted">
                {c.qtd}/{c.analista.capacidade}
              </span>
            </div>
            <Medidor
              valor={Math.min(c.ocupacao, 1)}
              tom={c.ocupacao > 1.15 ? 'alert' : c.ocupacao > 0.9 ? 'gold' : 'teal'}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

function WPadroes({ orgaoId }: { orgaoId: string }) {
  const achados = useMemo(() => detectarAnomalias(orgaoId).slice(0, 6), [orgaoId])
  return (
    <ul className="divide-y divide-line-soft">
      {achados.map((a) => (
        <li key={a.id} className="px-5 py-3">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[12.5px] text-ink">{a.titulo}</span>
            <Badge tom={a.severidade === 'critico' ? 'alert' : a.severidade === 'atencao' ? 'gold' : 'inert'}>
              {a.propostas.length}
            </Badge>
            <span className="num ml-auto text-[11px] text-gold">{moedaCompacta(a.valor)}</span>
          </div>
          <p className="text-[11px] leading-relaxed text-muted">{a.descricao}</p>
        </li>
      ))}
    </ul>
  )
}

function WProposta({ id, aoNavegar }: { id: string; aoNavegar: (r: string) => void }) {
  const proposta = getProposta(id)
  if (!proposta) return <div className="px-5 py-8 text-center text-[12.5px] text-muted">Proposta não encontrada.</div>
  const prop = getProponente(proposta.proponenteId)
  const lista = alertas(proposta)
  const vig = situacaoVigencia(proposta.id)
  return (
    <div className="flex flex-col gap-4 px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="num text-[15px] text-ink">{proposta.numero}</div>
          <p className="mt-1 line-clamp-2 text-[12px] text-muted">{proposta.objeto}</p>
          <div className="mt-1.5 text-[11.5px] text-muted">{prop?.nome}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="num text-[16px] text-gold">{moedaCompacta(proposta.valorGlobal)}</div>
          <div className="mt-1"><SituacaoBadge situacao={proposta.situacao} /></div>
        </div>
      </div>

      <CicloDeVida situacao={proposta.situacao} compacto />

      {lista.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {lista.map((a) => (
            <Badge key={a.id} tom={a.severidade === 'critico' ? 'alert' : 'gold'}>
              {a.rotulo}
            </Badge>
          ))}
        </div>
      )}

      {vig && (
        <div className="rounded-lg border border-line bg-abyss/40 px-3.5 py-2.5 text-[11.5px] text-muted">
          Vigência até <span className="num text-ink">{data(vig.vigencia.fim)}</span> ·{' '}
          <span className={vig.diasRestantes < 30 ? 'text-alert' : 'text-teal'}>
            {vig.diasRestantes < 0 ? `${Math.abs(vig.diasRestantes)}d vencida` : `${vig.diasRestantes}d restantes`}
          </span>
        </div>
      )}

      <Botao variante="primario" tamanho="sm" onClick={() => aoNavegar(`/propostas/${proposta.id}`)}>
        Abrir o dossiê completo
      </Botao>
    </div>
  )
}

function WTabela({ params }: { params?: Record<string, unknown> }) {
  const colunas = (params?.colunas as string[]) ?? []
  const linhas = (params?.linhas as string[][]) ?? []
  return (
    <table className="w-full text-left">
      <thead className="sticky top-0 bg-surface">
        <tr className="border-b border-line">
          {colunas.map((c) => (
            <th key={c} className="eyebrow px-4 py-2.5 font-normal whitespace-nowrap">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {linhas.map((l, i) => (
          <tr key={i} className="border-b border-line-soft last:border-0">
            {l.map((c, j) => (
              <td
                key={j}
                className={cn(
                  'px-4 py-2 text-[12px] whitespace-nowrap',
                  j === 0 ? 'num text-ink' : 'text-muted',
                  j === l.length - 1 && 'num text-right text-gold',
                )}
              >
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function WGrafico({ params }: { params?: Record<string, unknown> }) {
  const itens = (params?.itens as { rotulo: string; valor: number }[]) ?? []
  const formato = (params?.formato as 'moeda' | 'numero') ?? 'moeda'
  return (
    <div className="px-5 py-4">
      <BarrasHorizontais itens={itens} formato={formato} maxItens={10} />
    </div>
  )
}

export function useOrgaoWidget() {
  const { orgaoId } = useApp()
  return getOrgao(orgaoId)
}
