import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowDown,
  ArrowUp,
  Columns3,
  Download,
  Layers,
  LayoutGrid,
  Play,
  Rows3,
  Search,
  Send,
  X,
} from 'lucide-react'
import { useApp } from '@/store/app'
import { buscarPropostas, getProponente } from '@/data/repo'
import type { Proposta, SituacaoProposta } from '@/data/types'
import { diasParada, filtrar } from '@/assistente/motor'
import { cn, desde, moedaCompacta, numero } from '@/lib/format'
import {
  Badge,
  Botao,
  Campo,
  Panel,
  SituacaoBadge,
  TOM_CLASSES,
  TOM_SITUACAO,
  Vazio,
} from '@/components/ui'

const SITUACOES: SituacaoProposta[] = [
  'Cadastrada',
  'Em análise',
  'Em complementação',
  'Aprovada',
  'Convênio celebrado',
  'Em execução',
  'Prestação de contas',
  'Rejeitada',
]

type Coluna = 'numero' | 'proponente' | 'programa' | 'situacao' | 'valor' | 'parada' | 'sincronizada'

const COLUNAS: { id: Coluna; rotulo: string; ordenavel: boolean; opcional?: boolean }[] = [
  { id: 'numero', rotulo: 'Proposta', ordenavel: true },
  { id: 'proponente', rotulo: 'Proponente', ordenavel: true },
  { id: 'programa', rotulo: 'Programa', ordenavel: false, opcional: true },
  { id: 'situacao', rotulo: 'Situação', ordenavel: true },
  { id: 'valor', rotulo: 'Valor global', ordenavel: true },
  { id: 'parada', rotulo: 'Parada há', ordenavel: true, opcional: true },
  { id: 'sincronizada', rotulo: 'Sincronizada', ordenavel: false, opcional: true },
]

const PAGINA = 40

export function Propostas() {
  const {
    orgaoId,
    filtroPropostas,
    setFiltroPropostas,
    abrirExecucao,
    abrirLote,
    solicitarAprovacao,
    notificar,
    alternarComparacao,
    limparComparacao,
  } = useApp()
  const navegar = useNavigate()
  const [termo, setTermo] = useState('')
  const [limite, setLimite] = useState(PAGINA)
  const [selecao, setSelecao] = useState<Set<string>>(new Set())
  const [visao, setVisao] = useState<'tabela' | 'tramite'>('tabela')
  const [ordem, setOrdem] = useState<{ coluna: Coluna; desc: boolean }>({
    coluna: 'valor',
    desc: true,
  })
  const [ocultas, setOcultas] = useState<Set<Coluna>>(new Set(['programa']))
  const [escolhendoColunas, setEscolhendoColunas] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  // Um comando da Cleo pode trocar o filtro: a ordenação segue junto.
  useEffect(() => {
    if (filtroPropostas.ordenarPor === 'valor') setOrdem({ coluna: 'valor', desc: true })
    if (filtroPropostas.ordenarPor === 'parada') setOrdem({ coluna: 'parada', desc: true })
    if (filtroPropostas.paradaHaDias !== undefined) {
      setOcultas((prev) => {
        const p = new Set(prev)
        p.delete('parada')
        return p
      })
    }
  }, [filtroPropostas])

  const situacoes = filtroPropostas.situacao ?? []
  const ufs = filtroPropostas.uf ?? []

  const resultado = useMemo(() => {
    const base = buscarPropostas(orgaoId, termo)
    const filtrada = filtrar(base, filtroPropostas)
    const dir = ordem.desc ? -1 : 1
    return [...filtrada].sort((a, b) => {
      switch (ordem.coluna) {
        case 'valor':
          return (a.valorGlobal - b.valorGlobal) * dir
        case 'parada':
          return (diasParada(a) - diasParada(b)) * dir
        case 'numero':
          return a.numero.localeCompare(b.numero) * dir
        case 'situacao':
          return a.situacao.localeCompare(b.situacao) * dir
        case 'proponente':
          return (
            (getProponente(a.proponenteId)?.nome ?? '').localeCompare(
              getProponente(b.proponenteId)?.nome ?? '',
            ) * dir
          )
        default:
          return 0
      }
    })
  }, [orgaoId, termo, filtroPropostas, ordem])

  const valorTotal = useMemo(
    () => resultado.reduce((s, p) => s + p.valorGlobal, 0),
    [resultado],
  )

  const temFiltro =
    situacoes.length > 0 || ufs.length > 0 || filtroPropostas.paradaHaDias !== undefined || !!termo

  function alternarSituacao(s: SituacaoProposta) {
    setLimite(PAGINA)
    const proxima = situacoes.includes(s) ? situacoes.filter((x) => x !== s) : [...situacoes, s]
    setFiltroPropostas({ ...filtroPropostas, situacao: proxima })
  }

  function ordenarPor(coluna: Coluna) {
    setOrdem((prev) => (prev.coluna === coluna ? { coluna, desc: !prev.desc } : { coluna, desc: true }))
  }

  function alternarSelecao(id: string) {
    setSelecao((prev) => {
      const p = new Set(prev)
      if (p.has(id)) p.delete(id)
      else p.add(id)
      return p
    })
  }

  function exportarSelecao() {
    const alvo = resultado.filter((p) => selecao.has(p.id))
    const linhas = [
      ['Proposta', 'Proponente', 'UF', 'Situação', 'Valor global', 'Parada há (dias)'],
      ...alvo.map((p) => {
        const prop = getProponente(p.proponenteId)
        return [
          p.numero,
          prop?.nome ?? '',
          prop?.uf ?? '',
          p.situacao,
          String(p.valorGlobal),
          String(diasParada(p)),
        ]
      }),
    ]
    const csv = linhas.map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(';')).join('\n')
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'cleopatra-propostas.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const colunasVisiveis = COLUNAS.filter((c) => !ocultas.has(c.id))

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-5 pb-24">
      <header className="flex items-end justify-between gap-6">
        <div>
          <div className="eyebrow mb-2">Carteira</div>
          <h1 className="text-[26px] leading-tight">Propostas</h1>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-line bg-raised p-0.5">
          {(
            [
              ['tabela', Rows3, 'Tabela'],
              ['tramite', LayoutGrid, 'Trâmite'],
            ] as const
          ).map(([id, Icone, rotulo]) => (
            <button
              key={id}
              onClick={() => setVisao(id)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] transition-colors',
                visao === id ? 'bg-gold/12 text-gold' : 'text-muted hover:text-ink',
              )}
            >
              <Icone size={13} /> {rotulo}
            </button>
          ))}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-[320px]">
          <Search
            size={15}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint"
          />
          <Campo
            value={termo}
            onChange={(e) => {
              setTermo(e.target.value)
              setLimite(PAGINA)
            }}
            placeholder="Proponente, número, processo, UF ou objeto"
            className="pl-9"
            aria-label="Buscar propostas"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {SITUACOES.map((s) => {
            const ativo = situacoes.includes(s)
            return (
              <button
                key={s}
                onClick={() => alternarSituacao(s)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11.5px] transition-colors',
                  ativo
                    ? 'border-gold/40 bg-gold/10 text-gold'
                    : 'border-line text-muted hover:border-[#2c3c58] hover:text-ink',
                )}
              >
                {s}
              </button>
            )
          })}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => setEscolhendoColunas((v) => !v)}
            className="flex items-center gap-1.5 text-[12px] text-muted hover:text-ink"
          >
            <Columns3 size={13} /> Colunas
          </button>
          <div className="text-[12.5px] text-muted">
            <span className="num text-ink">{numero(resultado.length)}</span> propostas ·{' '}
            <span className="num text-gold">{moedaCompacta(valorTotal)}</span>
          </div>
        </div>
      </div>

      {/* Filtros vindos de um comando ficam visíveis e removíveis */}
      {temFiltro && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow">Recorte ativo</span>
          {filtroPropostas.paradaHaDias !== undefined && (
            <Badge tom="alert">paradas há mais de {filtroPropostas.paradaHaDias} dias</Badge>
          )}
          {ufs.map((uf) => (
            <Badge key={uf} tom="gold">
              {uf}
            </Badge>
          ))}
          {situacoes.map((s) => (
            <Badge key={s} tom="teal">
              {s}
            </Badge>
          ))}
          <button
            onClick={() => {
              setFiltroPropostas({})
              setTermo('')
            }}
            className="flex items-center gap-1 text-[11.5px] text-faint hover:text-ink"
          >
            <X size={11} /> limpar
          </button>
        </div>
      )}

      {escolhendoColunas && (
        <Panel className="flex flex-wrap gap-3 px-5 py-4">
          {COLUNAS.filter((c) => c.opcional).map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-[12.5px] text-ink">
              <input
                type="checkbox"
                checked={!ocultas.has(c.id)}
                onChange={() =>
                  setOcultas((prev) => {
                    const p = new Set(prev)
                    if (p.has(c.id)) p.delete(c.id)
                    else p.add(c.id)
                    return p
                  })
                }
                className="size-3.5 accent-[#dfb552]"
              />
              {c.rotulo}
            </label>
          ))}
          <span className="text-[11.5px] text-faint">
            As demais colunas são fixas por serem a identidade da linha.
          </span>
        </Panel>
      )}

      {aviso && (
        <div className="rounded-lg border border-teal/30 bg-teal/8 px-4 py-2.5 text-[12.5px] text-teal">
          {aviso}
        </div>
      )}

      {visao === 'tramite' ? (
        <VisaoTramite propostas={resultado} />
      ) : (
        <Panel className="overflow-hidden">
          {resultado.length === 0 ? (
            <Vazio
              titulo="Nenhuma proposta corresponde a este recorte."
              acao={
                <Botao
                  onClick={() => {
                    setTermo('')
                    setFiltroPropostas({})
                  }}
                >
                  Limpar filtros
                </Botao>
              }
            />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-line">
                  <th className="w-9 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selecao.size > 0 && selecao.size === resultado.slice(0, limite).length}
                      onChange={(e) =>
                        setSelecao(
                          e.target.checked
                            ? new Set(resultado.slice(0, limite).map((p) => p.id))
                            : new Set(),
                        )
                      }
                      className="size-3.5 accent-[#dfb552]"
                      aria-label="Selecionar tudo"
                    />
                  </th>
                  {colunasVisiveis.map((c) => (
                    <th
                      key={c.id}
                      className={cn(
                        'eyebrow px-4 py-3 text-left font-normal whitespace-nowrap',
                        c.id === 'valor' && 'text-right',
                      )}
                    >
                      {c.ordenavel ? (
                        <button
                          onClick={() => ordenarPor(c.id)}
                          className={cn(
                            'inline-flex items-center gap-1 transition-colors hover:text-ink',
                            ordem.coluna === c.id && 'text-gold',
                          )}
                        >
                          {c.rotulo}
                          {ordem.coluna === c.id &&
                            (ordem.desc ? <ArrowDown size={10} /> : <ArrowUp size={10} />)}
                        </button>
                      ) : (
                        c.rotulo
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resultado.slice(0, limite).map((p) => {
                  const prop = getProponente(p.proponenteId)
                  const parada = diasParada(p)
                  const escolhida = selecao.has(p.id)
                  return (
                    <tr
                      key={p.id}
                      className={cn(
                        'group border-b border-line-soft transition-colors last:border-0',
                        escolhida ? 'bg-gold/[0.045]' : 'hover:bg-white/[0.025]',
                      )}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={escolhida}
                          onChange={() => alternarSelecao(p.id)}
                          className="size-3.5 accent-[#dfb552]"
                          aria-label={`Selecionar ${p.numero}`}
                        />
                      </td>
                      {colunasVisiveis.map((c) => (
                        <td
                          key={c.id}
                          className={cn(
                            'px-4 py-3',
                            c.id === 'valor' && 'text-right whitespace-nowrap',
                            c.id === 'proponente' && 'max-w-[230px]',
                            c.id === 'programa' && 'max-w-[190px]',
                          )}
                        >
                          {c.id === 'numero' && (
                            <Link to={`/propostas/${p.id}`} className="block">
                              <div className="num text-[12.5px] text-ink group-hover:text-gold">
                                {p.numero}
                              </div>
                              {p.numProcessoSei && (
                                <div className="num mt-0.5 text-[10.5px] text-faint">
                                  SEI {p.numProcessoSei}
                                </div>
                              )}
                            </Link>
                          )}
                          {c.id === 'proponente' && (
                            <Link to={`/propostas/${p.id}`} className="block">
                              <div className="truncate text-[12.5px] text-ink">{prop?.nome}</div>
                              <div className="mt-0.5 text-[10.5px] text-faint">
                                {prop?.municipio} · {prop?.uf}
                              </div>
                            </Link>
                          )}
                          {c.id === 'programa' && (
                            <div className="truncate text-[12px] text-muted">{p.programa}</div>
                          )}
                          {c.id === 'situacao' && <SituacaoBadge situacao={p.situacao} />}
                          {c.id === 'valor' && (
                            <>
                              <div className="num text-[12.5px] text-ink">
                                {moedaCompacta(p.valorGlobal)}
                              </div>
                              <div className="num mt-0.5 text-[10.5px] text-faint">
                                repasse {moedaCompacta(p.valorRepasse)}
                              </div>
                            </>
                          )}
                          {c.id === 'parada' && (
                            <span
                              className={cn(
                                'num text-[12px]',
                                parada > 60 ? 'text-alert' : parada > 30 ? 'text-gold' : 'text-muted',
                              )}
                            >
                              {parada} dias
                            </span>
                          )}
                          {c.id === 'sincronizada' && (
                            <span className="text-[11.5px] whitespace-nowrap text-muted">
                              {desde(p.dataUltimaSincronizacao)}
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Panel>
      )}

      {visao === 'tabela' && limite < resultado.length && (
        <div className="flex justify-center">
          <Botao onClick={() => setLimite((l) => l + PAGINA)}>
            Mostrar mais {Math.min(PAGINA, resultado.length - limite)} de{' '}
            {numero(resultado.length - limite)} restantes
          </Botao>
        </div>
      )}

      {/* Ação em lote */}
      {selecao.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 ml-[218px] border-t border-line bg-surface/95 px-8 py-4 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1240px] items-center gap-5">
            <div>
              <div className="text-[13px] text-ink">
                <span className="num">{selecao.size}</span> propostas selecionadas
              </div>
              <div className="num text-[11.5px] text-muted">
                {moedaCompacta(
                  resultado.filter((p) => selecao.has(p.id)).reduce((s, p) => s + p.valorGlobal, 0),
                )}{' '}
                em valor global
              </div>
            </div>
            <button
              onClick={() => setSelecao(new Set())}
              className="text-[12.5px] text-muted hover:text-ink"
            >
              limpar seleção
            </button>

            <div className="ml-auto flex gap-2.5">
              <Botao onClick={exportarSelecao}>
                <Download size={13} /> Exportar
              </Botao>
              <Botao
                disabled={selecao.size < 2 || selecao.size > 3}
                title="Duas ou três propostas lado a lado"
                onClick={() => {
                  limparComparacao()
                  for (const id of selecao) alternarComparacao(id)
                  setSelecao(new Set())
                  navegar('/comparar')
                }}
              >
                <Columns3 size={13} /> Comparar
              </Botao>
              <Botao
                onClick={() => {
                  abrirLote({
                    ritoId: 'rt-instrucao',
                    titulo: `Instrução completa — ${selecao.size} propostas`,
                    propostaIds: [...selecao],
                  })
                  setSelecao(new Set())
                }}
              >
                <Layers size={13} /> Rodar em lote
              </Botao>
              <Botao
                onClick={() => {
                  const criadas = solicitarAprovacao([...selecao])
                  setSelecao(new Set())
                  setAviso(
                    criadas === 0
                      ? 'Essas propostas já estavam na fila do gestor.'
                      : `${criadas} propostas enviadas para a fila de aprovação.`,
                  )
                  if (criadas > 0) {
                    notificar({
                      tipo: 'aprovacao',
                      titulo: `${criadas} propostas aguardando decisão`,
                      detalhe: 'Enviadas em lote a partir da listagem.',
                      href: '/aprovacoes',
                    })
                  }
                  window.setTimeout(() => setAviso(null), 5000)
                }}
              >
                <Send size={13} /> Enviar para aprovação
              </Botao>
              <Botao
                variante="primario"
                disabled={selecao.size !== 1}
                onClick={() => {
                  const [id] = [...selecao]
                  abrirExecucao({
                    propostaId: id,
                    fila: [
                      'criar_processo',
                      'anexar_extrato_proposta',
                      'anexar_contrapartidas',
                      'criar_documento',
                    ],
                    titulo: 'Rito completo de instrução',
                  })
                  setSelecao(new Set())
                }}
              >
                <Play size={13} fill="currentColor" /> Executar o rito
              </Botao>
            </div>
          </div>
          {selecao.size > 1 && (
            <p className="mx-auto mt-2 max-w-[1240px] text-[11px] text-faint">
              O rito roda numa proposta por vez — selecione uma só para executá-lo.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/** Trâmite: a carteira lida como fluxo, não como lista. */
function VisaoTramite({ propostas }: { propostas: Proposta[] }) {
  const colunas = SITUACOES.map((situacao) => ({
    situacao,
    itens: propostas.filter((p) => p.situacao === situacao),
  })).filter((c) => c.itens.length > 0)

  if (colunas.length === 0) {
    return (
      <Panel>
        <Vazio titulo="Nenhuma proposta corresponde a este recorte." />
      </Panel>
    )
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {colunas.map(({ situacao, itens }) => {
        const tom = TOM_CLASSES[TOM_SITUACAO[situacao]]
        return (
          <div key={situacao} className="flex w-[248px] shrink-0 flex-col">
            <div className="mb-2 flex items-center gap-2 px-1">
              <span className={cn('size-2 rounded-full', tom.ponto)} />
              <span className="flex-1 truncate text-[12.5px] text-ink">{situacao}</span>
              <span className="num text-[11.5px] text-faint">{itens.length}</span>
            </div>
            <div className="flex max-h-[62vh] flex-col gap-2 overflow-y-auto pr-1">
              {itens.slice(0, 40).map((p) => {
                const prop = getProponente(p.proponenteId)
                const parada = diasParada(p)
                return (
                  <Link
                    key={p.id}
                    to={`/propostas/${p.id}`}
                    className="panel block p-3 transition-colors hover:border-gold/35"
                  >
                    <div className="num mb-1 text-[12px] text-ink">{p.numero}</div>
                    <div className="mb-2 truncate text-[11.5px] text-muted">{prop?.nome}</div>
                    <div className="flex items-center justify-between">
                      <span className="num text-[12px] text-gold">
                        {moedaCompacta(p.valorGlobal)}
                      </span>
                      <span
                        className={cn(
                          'num text-[10.5px]',
                          parada > 60 ? 'text-alert' : parada > 30 ? 'text-gold' : 'text-faint',
                        )}
                      >
                        {parada}d
                      </span>
                    </div>
                  </Link>
                )
              })}
              {itens.length > 40 && (
                <p className="px-1 py-2 text-[11px] text-faint">
                  +{itens.length - 40} nesta fase — use a tabela para ver todas
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
