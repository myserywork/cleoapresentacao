import { useEffect, useMemo, useRef, useState } from 'react'
import { GripVertical, Plus, Save, Trash2, X } from 'lucide-react'
import { useApp } from '@/store/app'
import { getOrgao, resumoOrgao } from '@/data/repo'
import { moedaCompacta, numero } from '@/lib/format'
import {
  BarraComposicao,
  BarrasHorizontais,
  DistribuicaoSituacao,
  Indicador,
  SerieTemporal,
} from '@/components/charts'
import { Botao, Campo, Panel, PanelHeader, TOM_SITUACAO, Vazio } from '@/components/ui'
import { cn } from '@/lib/format'

type IdWidget =
  | 'total-propostas'
  | 'valor-global'
  | 'empenhado'
  | 'horas'
  | 'processos'
  | 'serie'
  | 'situacao'
  | 'uf'
  | 'programa'
  | 'composicao'

type Largura = 1 | 2 | 3

interface Bloco {
  id: IdWidget
  largura: Largura
}

interface DefinicaoWidget {
  id: IdWidget
  titulo: string
  descricao: string
  larguraPadrao: Largura
  /** Miniatura mostrada no catálogo, antes de inserir. */
  previa: 'numero' | 'linha' | 'barras' | 'faixas' | 'pilha'
}

const CATALOGO: DefinicaoWidget[] = [
  { id: 'total-propostas', titulo: 'Total de propostas', descricao: 'Contagem da carteira', larguraPadrao: 1, previa: 'numero' },
  { id: 'valor-global', titulo: 'Valor global', descricao: 'Soma dos valores pactuados', larguraPadrao: 1, previa: 'numero' },
  { id: 'empenhado', titulo: 'Empenhado', descricao: 'Execução orçamentária', larguraPadrao: 1, previa: 'numero' },
  { id: 'horas', titulo: 'Horas devolvidas', descricao: 'Ganho das automações', larguraPadrao: 1, previa: 'numero' },
  { id: 'processos', titulo: 'Processos no SEI', descricao: 'Autuados pela Cleo', larguraPadrao: 1, previa: 'numero' },
  { id: 'serie', titulo: 'Entrada de propostas', descricao: 'Série mensal', larguraPadrao: 2, previa: 'linha' },
  { id: 'situacao', titulo: 'Propostas por situação', descricao: 'Distribuição por fase', larguraPadrao: 2, previa: 'faixas' },
  { id: 'uf', titulo: 'Valor por UF', descricao: 'Ranking territorial', larguraPadrao: 1, previa: 'barras' },
  { id: 'programa', titulo: 'Valor por programa', descricao: 'Ranking por programa', larguraPadrao: 1, previa: 'barras' },
  { id: 'composicao', titulo: 'Composição do valor', descricao: 'Repasse e contrapartida', larguraPadrao: 1, previa: 'pilha' },
]

const PADRAO: Bloco[] = [
  { id: 'total-propostas', largura: 1 },
  { id: 'valor-global', largura: 1 },
  { id: 'empenhado', largura: 1 },
  { id: 'serie', largura: 2 },
  { id: 'uf', largura: 1 },
]

const PERIODOS = [
  { rotulo: 'Tudo', meses: undefined },
  { rotulo: '12 meses', meses: 12 },
  { rotulo: '6 meses', meses: 6 },
  { rotulo: '3 meses', meses: 3 },
] as const

const CHAVE = 'cleopatra:paineis:v2'

interface Layout {
  nome: string
  blocos: Bloco[]
  meses?: number
}

const COR_VIZ: Record<string, string> = {
  teal: 'var(--color-viz-teal)',
  gold: 'var(--color-viz-gold)',
  cleo: 'var(--color-viz-cleo)',
  inert: 'var(--color-viz-inert)',
  alert: 'var(--color-viz-alert)',
}
const CORES_SITUACAO = Object.fromEntries(
  Object.entries(TOM_SITUACAO).map(([s, t]) => [s, COR_VIZ[t]]),
)

/** Miniatura do bloco: mostra a forma antes de comprometer espaço no painel. */
function Previa({ tipo }: { tipo: DefinicaoWidget['previa'] }) {
  const base = 'h-full w-full rounded-md bg-abyss/50 p-2'
  switch (tipo) {
    case 'numero':
      // Forma, não valor: uma miniatura com número inventado ensina a coisa errada.
      return (
        <div className={cn(base, 'flex flex-col justify-center gap-1.5')}>
          <span className="h-1 w-7 rounded bg-line" />
          <span className="h-3 w-11 rounded-sm bg-gold/45" />
        </div>
      )
    case 'linha':
      return (
        <div className={base}>
          <svg viewBox="0 0 60 26" className="h-full w-full">
            <path
              d="M2 20 L12 12 L22 16 L32 6 L42 13 L52 4"
              fill="none"
              stroke="var(--color-viz-teal)"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </div>
      )
    case 'barras':
      return (
        <div className={cn(base, 'flex flex-col justify-center gap-1')}>
          {[100, 72, 48, 30].map((w) => (
            <span
              key={w}
              className="h-1 rounded-full"
              style={{ width: `${w}%`, background: 'var(--color-viz-teal)' }}
            />
          ))}
        </div>
      )
    case 'faixas':
      return (
        <div className={cn(base, 'flex flex-col justify-center gap-1')}>
          {['var(--color-viz-inert)', 'var(--color-viz-teal)', 'var(--color-viz-gold)'].map((c, i) => (
            <span
              key={c}
              className="h-1.5 rounded-sm"
              style={{ width: `${90 - i * 22}%`, background: c }}
            />
          ))}
        </div>
      )
    case 'pilha':
      return (
        <div className={cn(base, 'flex items-center')}>
          <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full">
            <span className="w-[78%] rounded-l-full" style={{ background: 'var(--color-viz-gold)' }} />
            <span className="flex-1 rounded-r-full" style={{ background: 'var(--color-viz-teal)' }} />
          </div>
        </div>
      )
  }
}

export function MeusPaineis() {
  const { orgaoId } = useApp()
  const orgao = getOrgao(orgaoId)!

  const [meses, setMeses] = useState<number | undefined>(undefined)
  const resumo = useMemo(() => resumoOrgao(orgaoId, meses), [orgaoId, meses])

  const [layouts, setLayouts] = useState<Layout[]>(() => {
    const salvo = localStorage.getItem(CHAVE)
    return salvo ? (JSON.parse(salvo) as Layout[]) : []
  })
  const [blocos, setBlocos] = useState<Bloco[]>(PADRAO)
  const [nome, setNome] = useState('')
  const [escolhendo, setEscolhendo] = useState(false)
  const [arrastando, setArrastando] = useState<number | null>(null)
  const gradeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    localStorage.setItem(CHAVE, JSON.stringify(layouts))
  }, [layouts])

  const disponiveis = CATALOGO.filter((c) => !blocos.some((b) => b.id === c.id))

  function remover(id: IdWidget) {
    setBlocos((prev) => prev.filter((b) => b.id !== id))
  }

  function soltarEm(destino: number) {
    if (arrastando === null || arrastando === destino) return
    setBlocos((prev) => {
      const proximo = [...prev]
      const [movido] = proximo.splice(arrastando, 1)
      proximo.splice(destino, 0, movido)
      return proximo
    })
    setArrastando(null)
  }

  /**
   * Redimensiona arrastando a borda direita.
   *
   * A largura salta de coluna em coluna: painel de gestor não precisa de pixel
   * exato, precisa de alinhamento — e grade que encaixa nunca fica torta.
   */
  function iniciarRedimensionamento(indice: number, evento: React.PointerEvent) {
    evento.preventDefault()
    evento.stopPropagation()
    const grade = gradeRef.current
    const bloco = (evento.currentTarget as HTMLElement).closest('[data-bloco]')
    if (!grade || !bloco) return

    const larguraColuna = grade.clientWidth / 3
    const esquerdaDoBloco = bloco.getBoundingClientRect().left

    const aoMover = (e: PointerEvent) => {
      const colunas = Math.round((e.clientX - esquerdaDoBloco) / larguraColuna)
      const nova = Math.max(1, Math.min(3, colunas)) as Largura
      setBlocos((prev) => prev.map((b, i) => (i === indice ? { ...b, largura: nova } : b)))
    }
    const aoSoltar = () => {
      window.removeEventListener('pointermove', aoMover)
      window.removeEventListener('pointerup', aoSoltar)
    }
    window.addEventListener('pointermove', aoMover)
    window.addEventListener('pointerup', aoSoltar)
  }

  function salvar() {
    const titulo = nome.trim() || `Painel ${layouts.length + 1}`
    setLayouts((prev) => [...prev.filter((l) => l.nome !== titulo), { nome: titulo, blocos, meses }])
    setNome('')
  }

  function renderizar(id: IdWidget) {
    switch (id) {
      case 'total-propostas':
        return <Indicador rotulo="Total de propostas" valor={resumo.totalPropostas} />
      case 'valor-global':
        return (
          <Indicador
            rotulo="Valor global"
            valor={resumo.valorGlobal}
            formato="moeda"
            tom="gold"
            detalhe={`Repasse ${moedaCompacta(resumo.valorRepasse)}`}
          />
        )
      case 'empenhado':
        return (
          <Indicador
            rotulo="Empenhado"
            valor={resumo.totalEmpenhado}
            formato="moeda"
            tom="gold"
            detalhe={`${numero(resumo.qtdEmpenhos)} empenhos`}
          />
        )
      case 'horas':
        return (
          <Indicador
            rotulo="Horas devolvidas"
            valor={resumo.horasEconomizadas}
            tom="cleo"
            detalhe={`${numero(resumo.automacoesExecutadas)} automações`}
          />
        )
      case 'processos':
        return (
          <Indicador
            rotulo="Processos no SEI"
            valor={resumo.processosSei}
            detalhe={`${numero(resumo.documentosGerados)} documentos`}
          />
        )
      case 'serie':
        return (
          <Panel>
            <PanelHeader eyebrow="Série mensal" titulo="Entrada de propostas" />
            <div className="px-4 pt-3 pb-2">
              <SerieTemporal dados={resumo.serieMensal} altura={168} />
            </div>
          </Panel>
        )
      case 'situacao':
        return (
          <Panel>
            <PanelHeader eyebrow="Fases" titulo="Propostas por situação" />
            <div className="px-5 py-5">
              <DistribuicaoSituacao dados={resumo.porSituacao} cores={CORES_SITUACAO} />
            </div>
          </Panel>
        )
      case 'uf':
        return (
          <Panel>
            <PanelHeader eyebrow="Territorial" titulo="Valor por UF" />
            <div className="px-5 py-5">
              <BarrasHorizontais
                itens={resumo.porUf.map((u) => ({ rotulo: u.uf, valor: u.valor }))}
                maxItens={7}
              />
            </div>
          </Panel>
        )
      case 'programa':
        return (
          <Panel>
            <PanelHeader eyebrow="Programas" titulo="Valor por programa" />
            <div className="px-5 py-5">
              <BarrasHorizontais
                itens={resumo.porPrograma.map((p) => ({
                  rotulo: p.programa,
                  valor: p.valor,
                  cor: 'var(--color-viz-gold)',
                }))}
                maxItens={5}
              />
            </div>
          </Panel>
        )
      case 'composicao':
        return (
          <Panel>
            <PanelHeader eyebrow="Carteira" titulo="Composição do valor" />
            <div className="px-5 py-5">
              <BarraComposicao
                segmentos={[
                  { rotulo: 'Repasse', valor: resumo.valorRepasse, cor: 'var(--color-viz-gold)' },
                  {
                    rotulo: 'Contrapartida',
                    valor: resumo.valorContrapartida,
                    cor: 'var(--color-viz-teal)',
                  },
                ]}
              />
            </div>
          </Panel>
        )
    }
  }

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-5">
      <header className="flex items-end justify-between gap-6">
        <div>
          <div className="eyebrow mb-2">Visão do gestor</div>
          <h1 className="text-[26px] leading-tight">Meus painéis</h1>
          <p className="mt-1.5 text-[13px] text-muted">
            Monte a leitura do {orgao.sigla}. Arraste para reordenar, puxe a borda direita para
            mudar a largura.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Campo
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome do painel"
            className="w-[190px]"
            aria-label="Nome do painel"
          />
          <Botao variante="primario" onClick={salvar}>
            <Save size={14} /> Salvar
          </Botao>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1 rounded-lg border border-line bg-raised p-0.5">
          {PERIODOS.map((p) => (
            <button
              key={p.rotulo}
              onClick={() => setMeses(p.meses)}
              className={cn(
                'rounded-md px-2.5 py-1.5 text-[12px] transition-colors',
                meses === p.meses ? 'bg-gold/12 text-gold' : 'text-muted hover:text-ink',
              )}
            >
              {p.rotulo}
            </button>
          ))}
        </div>
        <span className="text-[12px] text-muted">
          {meses ? `Propostas cadastradas nos últimos ${meses} meses` : 'Toda a carteira'} ·{' '}
          <span className="num text-ink">{numero(resumo.totalPropostas)}</span> propostas
        </span>

        {layouts.length > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="eyebrow">Salvos</span>
            {layouts.map((l) => (
              <span
                key={l.nome}
                className="flex items-center gap-2 rounded-full border border-line bg-raised py-1 pr-1.5 pl-3 text-[12.5px]"
              >
                <button
                  onClick={() => {
                    setBlocos(l.blocos)
                    setMeses(l.meses)
                  }}
                  className="text-ink hover:text-gold"
                >
                  {l.nome}
                </button>
                <button
                  onClick={() => setLayouts((prev) => prev.filter((x) => x.nome !== l.nome))}
                  aria-label={`Excluir ${l.nome}`}
                  className="rounded-full p-0.5 text-faint hover:text-alert"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {blocos.length === 0 ? (
        <Panel>
          <Vazio
            titulo="Painel vazio. Adicione o primeiro bloco."
            acao={<Botao onClick={() => setEscolhendo(true)}>Adicionar bloco</Botao>}
          />
        </Panel>
      ) : (
        <div ref={gradeRef} className="grid grid-cols-3 gap-4">
          {blocos.map((bloco, i) => {
            const def = CATALOGO.find((c) => c.id === bloco.id)!
            return (
              <div
                key={bloco.id}
                data-bloco
                draggable
                onDragStart={() => setArrastando(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => soltarEm(i)}
                className={cn(
                  'group relative transition-opacity',
                  bloco.largura === 2 && 'col-span-2',
                  bloco.largura === 3 && 'col-span-3',
                  arrastando === i && 'opacity-40',
                )}
              >
                <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="cursor-grab rounded-md bg-abyss/80 p-1.5 text-faint backdrop-blur">
                    <GripVertical size={13} />
                  </span>
                  <button
                    onClick={() => remover(bloco.id)}
                    aria-label={`Remover ${def.titulo}`}
                    className="rounded-md bg-abyss/80 p-1.5 text-faint backdrop-blur hover:text-alert"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {renderizar(bloco.id)}

                {/* Alça de largura */}
                <div
                  onPointerDown={(e) => iniciarRedimensionamento(i, e)}
                  role="separator"
                  aria-label={`Largura de ${def.titulo}`}
                  className="absolute inset-y-3 -right-2 w-4 cursor-col-resize opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <span className="absolute top-1/2 right-1.5 h-8 w-1 -translate-y-1/2 rounded-full bg-line group-hover:bg-gold/60" />
                </div>
              </div>
            )
          })}

          {disponiveis.length > 0 && (
            <button
              onClick={() => setEscolhendo(true)}
              className="flex min-h-[104px] items-center justify-center gap-2 rounded-[14px] border border-dashed border-line text-[13px] text-muted transition-colors hover:border-gold/40 hover:text-gold"
            >
              <Plus size={15} /> Adicionar bloco
            </button>
          )}
        </div>
      )}

      {escolhendo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-abyss/85 p-6 backdrop-blur-sm"
          onClick={() => setEscolhendo(false)}
        >
          <div className="panel w-[640px] bg-surface p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-[16px]">Adicionar bloco</h3>
                <p className="mt-0.5 text-[12px] text-muted">
                  A miniatura mostra a forma do bloco antes de você inseri-lo.
                </p>
              </div>
              <button
                onClick={() => setEscolhendo(false)}
                aria-label="Fechar"
                className="text-muted hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>

            {disponiveis.length === 0 ? (
              <Vazio titulo="Todos os blocos já estão no painel." />
            ) : (
              <ul className="grid max-h-[400px] grid-cols-2 gap-2 overflow-y-auto">
                {disponiveis.map((d) => (
                  <li key={d.id}>
                    <button
                      onClick={() => {
                        setBlocos((prev) => [...prev, { id: d.id, largura: d.larguraPadrao }])
                        setEscolhendo(false)
                      }}
                      className="flex w-full items-center gap-3 rounded-lg border border-line p-3 text-left transition-colors hover:border-gold/40 hover:bg-white/4"
                    >
                      <span className="h-11 w-16 shrink-0">
                        <Previa tipo={d.previa} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-ink">{d.titulo}</span>
                        <span className="block truncate text-[11.5px] text-muted">
                          {d.descricao}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
