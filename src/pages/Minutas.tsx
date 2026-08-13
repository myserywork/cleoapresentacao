import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Braces,
  Copy,
  Eye,
  FileSignature,
  PenLine,
  Play,
  Plus,
  Save,
  ScrollText,
  Trash2,
  Wand2,
} from 'lucide-react'
import { useApp } from '@/store/app'
import { MINUTAS, getOrgao, getProponente, propostasDoOrgao } from '@/data/repo'
import { analisar, CORPOS_FABRICA, VARIAVEIS, variaveisUsadas } from '@/dominio/minutas'
import { cn, numero } from '@/lib/format'
import { Badge, Botao, Panel, PanelHeader } from '@/components/ui'
import { Segmentado } from '@/components/dados'

/**
 * Minutas.
 *
 * O modelo deixa de ser uma ficha com lista de campos e vira o que ele é de
 * verdade: um documento com variáveis vivas dentro. O editor pinta cada
 * variável com a cor da origem — o que a Cleo calcula sozinha, o que fica
 * como lacuna para o analista — e a pré-visualização mostra o papel pronto,
 * preenchido com uma proposta real do órgão.
 */

interface MinutaLocal {
  id: string
  nome: string
  tipo: string
  descricao: string
  corpo: string
  usos: number
  deFabrica: boolean
}

const CHAVE = 'cleopatra.minutas.v1'

function carregarBase(): MinutaLocal[] {
  const fabrica: MinutaLocal[] = MINUTAS.map((m) => ({
    id: m.id,
    nome: m.nome,
    tipo: m.tipo,
    descricao: m.descricao,
    corpo: CORPOS_FABRICA[m.id] ?? '',
    usos: m.usos,
    deFabrica: true,
  }))
  try {
    const bruto = localStorage.getItem(CHAVE)
    if (!bruto) return fabrica
    const salvas = JSON.parse(bruto) as MinutaLocal[]
    // Edições sobrescrevem as de fábrica; criações entram no fim
    const porId = new Map(fabrica.map((m) => [m.id, m]))
    for (const s of salvas) porId.set(s.id, { ...porId.get(s.id), ...s })
    return [...porId.values()]
  } catch {
    return fabrica
  }
}

export function Minutas() {
  const { orgaoId, abrirExecucao, notificar, registrarAuditoria } = useApp()
  const orgao = getOrgao(orgaoId)!

  const [minutas, setMinutas] = useState<MinutaLocal[]>(carregarBase)
  const [ativaId, setAtivaId] = useState(minutas[0]?.id ?? '')
  const [modo, setModo] = useState<'editor' | 'documento'>('documento')
  const [sujo, setSujo] = useState(false)
  const areaRef = useRef<HTMLTextAreaElement>(null)

  const ativa = minutas.find((m) => m.id === ativaId) ?? minutas[0]

  // A pré-visualização usa uma proposta real, escolhível — o documento nunca é lorem ipsum
  const candidatas = useMemo(
    () => propostasDoOrgao(orgaoId).filter((p) => p.numProcessoSei).slice(0, 24),
    [orgaoId],
  )
  const [propostaId, setPropostaId] = useState('')
  const proposta = candidatas.find((p) => p.id === propostaId) ?? candidatas[0]

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(minutas))
    } catch {
      /* sem armazenamento local, sem persistência — segue o baile */
    }
  }, [minutas])

  const uso = useMemo(() => (ativa ? variaveisUsadas(ativa.corpo) : null), [ativa])
  const trechos = useMemo(
    () => (ativa && proposta ? analisar(ativa.corpo, proposta) : []),
    [ativa, proposta],
  )

  function alterarCorpo(corpo: string) {
    setSujo(true)
    setMinutas((prev) => prev.map((m) => (m.id === ativaId ? { ...m, corpo } : m)))
  }

  function inserirVariavel(nome: string) {
    const area = areaRef.current
    const token = `{{${nome}}}`
    if (!area || modo !== 'editor') return
    const inicio = area.selectionStart ?? ativa.corpo.length
    const fim = area.selectionEnd ?? inicio
    alterarCorpo(ativa.corpo.slice(0, inicio) + token + ativa.corpo.slice(fim))
    requestAnimationFrame(() => {
      area.focus()
      area.setSelectionRange(inicio + token.length, inicio + token.length)
    })
  }

  function criarNova() {
    const nova: MinutaLocal = {
      id: `m-${Date.now()}`,
      nome: 'Nova minuta',
      tipo: 'Ofício',
      descricao: 'Descreva quando este modelo deve ser usado.',
      corpo: `OFÍCIO

Ao representante legal de {{proponente}}
{{municipioUf}}

Assunto: Proposta nº {{numeroProposta}}

1. …

{{dataHoje}} — {{unidadeGestora}}`,
      usos: 0,
      deFabrica: false,
    }
    setMinutas((prev) => [...prev, nova])
    setAtivaId(nova.id)
    setModo('editor')
  }

  function duplicar(m: MinutaLocal) {
    const copia = { ...m, id: `m-${Date.now()}`, nome: `${m.nome} (cópia)`, deFabrica: false, usos: 0 }
    setMinutas((prev) => [...prev, copia])
    setAtivaId(copia.id)
    setModo('editor')
  }

  function remover(id: string) {
    setMinutas((prev) => prev.filter((m) => m.id !== id))
    if (ativaId === id) setAtivaId(minutas[0]?.id ?? '')
  }

  function salvar() {
    setSujo(false)
    registrarAuditoria({
      tipo: 'documento',
      ator: 'Você',
      acao: 'Editou minuta',
      alvo: ativa.nome,
      detalhe: `${uso?.internas.length ?? 0} variáveis internas, ${uso?.usuario.length ?? 0} lacunas de usuário.`,
    })
    notificar({
      tipo: 'automacao',
      titulo: `Minuta "${ativa.nome}" salva`,
      detalhe: 'Disponível para os ritos que geram documento.',
      href: '/minutas',
    })
  }

  if (!ativa) return null

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="eyebrow mb-2">Modelos vivos</div>
          <h1 className="text-[26px] leading-tight">Minutas</h1>
          <p className="mt-1.5 max-w-[76ch] text-[13px] text-muted">
            Documento com variável dentro não se redigita — se gera.{' '}
            <span className="text-teal">Verde</span> é o que a Cleo calcula do cadastro;{' '}
            <span className="text-gold">dourado</span> é lacuna que espera o analista.
          </p>
        </div>
        <Botao variante="primario" onClick={criarNova}>
          <Plus size={13} /> Nova minuta
        </Botao>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[268px_1fr_296px] items-start gap-4">
        {/* Biblioteca */}
        <Panel className="overflow-hidden">
          <PanelHeader eyebrow="Biblioteca" titulo={`${minutas.length} modelos`} />
          <ul className="divide-y divide-line-soft">
            {minutas.map((m) => {
              const usoM = variaveisUsadas(m.corpo)
              return (
                <li key={m.id}>
                  <button
                    onClick={() => setAtivaId(m.id)}
                    className={cn(
                      'w-full px-4 py-3 text-left transition-colors',
                      m.id === ativaId ? 'bg-gold/[0.07]' : 'hover:bg-white/[0.03]',
                    )}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          'truncate text-[12.5px]',
                          m.id === ativaId ? 'text-gold' : 'text-ink',
                        )}
                      >
                        {m.nome}
                      </span>
                      {!m.deFabrica && <Badge tom="inert">sua</Badge>}
                    </div>
                    <div className="flex items-center gap-3 text-[10.5px] text-faint">
                      <span>{m.tipo}</span>
                      <span className="num">{numero(m.usos)} usos</span>
                      <span className="num text-teal">{usoM.internas.length} auto</span>
                      {usoM.usuario.length > 0 && (
                        <span className="num text-gold">{usoM.usuario.length} lacunas</span>
                      )}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </Panel>

        {/* Editor / Documento */}
        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <ScrollText size={15} className="shrink-0 text-cleo" />
              {modo === 'editor' ? (
                <input
                  value={ativa.nome}
                  onChange={(e) => {
                    setSujo(true)
                    setMinutas((prev) =>
                      prev.map((m) => (m.id === ativaId ? { ...m, nome: e.target.value } : m)),
                    )
                  }}
                  className="min-w-0 flex-1 bg-transparent text-[15px] text-ink focus:outline-none"
                  aria-label="Nome da minuta"
                />
              ) : (
                <h2 className="truncate text-[15px]">{ativa.nome}</h2>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Segmentado
                valor={modo}
                aoTrocar={setModo}
                opcoes={[
                  { id: 'documento', rotulo: 'Documento' },
                  { id: 'editor', rotulo: 'Editar' },
                ]}
              />
            </div>
          </div>

          {modo === 'documento' && (
            <div className="flex items-center gap-3 border-b border-line bg-abyss/30 px-5 py-2.5">
              <Eye size={13} className="shrink-0 text-faint" />
              <span className="text-[11.5px] text-muted">Preenchida com</span>
              <select
                value={proposta?.id ?? ''}
                onChange={(e) => setPropostaId(e.target.value)}
                className="h-7 min-w-0 flex-1 rounded border border-line bg-raised px-2 text-[11.5px] text-ink focus:outline-none"
                aria-label="Proposta usada na pré-visualização"
              >
                {candidatas.map((p) => (
                  <option key={p.id} value={p.id} className="bg-surface">
                    {p.numero} · {getProponente(p.proponenteId)?.nome}
                  </option>
                ))}
              </select>
              <Botao
                tamanho="sm"
                variante="primario"
                disabled={!proposta}
                onClick={() =>
                  proposta &&
                  abrirExecucao({
                    propostaId: proposta.id,
                    fila: ['criar_documento'],
                    titulo: `Gerar "${ativa.nome}" no SEI`,
                  })
                }
              >
                <Play size={11} fill="currentColor" /> Gerar no SEI
              </Botao>
            </div>
          )}

          {modo === 'editor' ? (
            <div className="flex flex-col">
              <textarea
                ref={areaRef}
                value={ativa.corpo}
                onChange={(e) => alterarCorpo(e.target.value)}
                spellCheck={false}
                className="num min-h-[520px] w-full resize-y bg-transparent px-5 py-4 text-[12.5px] leading-relaxed text-ink focus:outline-none"
                aria-label="Corpo da minuta"
              />
              <div className="flex items-center gap-2 border-t border-line px-5 py-3">
                <Botao variante="primario" tamanho="sm" onClick={salvar} disabled={!sujo}>
                  <Save size={11} /> {sujo ? 'Salvar' : 'Salvo'}
                </Botao>
                <Botao tamanho="sm" onClick={() => duplicar(ativa)}>
                  <Copy size={11} /> Duplicar
                </Botao>
                {!ativa.deFabrica && (
                  <Botao tamanho="sm" variante="fantasma" onClick={() => remover(ativa.id)}>
                    <Trash2 size={11} />
                  </Botao>
                )}
                <span className="ml-auto text-[11px] text-faint">
                  Escreva {'{{'}variavel{'}}'} ou clique na paleta ao lado
                </span>
              </div>
            </div>
          ) : (
            /* O papel: fundo claro de documento oficial, com as variáveis pintadas */
            <div className="bg-[#f4f1ea] px-10 py-9">
              <div className="mx-auto max-w-[640px]">
                <div className="mb-6 border-b border-[#c9c2b4] pb-4 text-center">
                  <div className="text-[10px] tracking-[0.22em] text-[#6b6350] uppercase">
                    {orgao.nome}
                  </div>
                  <div className="mt-1 text-[10px] text-[#8a8270]">{orgao.unidadeGestora}</div>
                </div>
                <div className="text-[12.5px] leading-[1.85] whitespace-pre-wrap text-[#2b2618]">
                  {trechos.map((t, i) =>
                    t.tipo === 'texto' ? (
                      <span key={i}>{t.texto}</span>
                    ) : (
                      <span
                        key={i}
                        title={t.variavel}
                        className={cn(
                          'rounded-[3px] px-0.5',
                          t.tipo === 'interno' && 'bg-[#d7ebe3] text-[#0d5c4a]',
                          t.tipo === 'usuario' && 'bg-[#f3e3bb] text-[#7a5a10]',
                          t.tipo === 'desconhecida' && 'bg-[#f3cdc9] text-[#8c2f28]',
                        )}
                      >
                        {t.texto}
                      </span>
                    ),
                  )}
                </div>
                <div className="mt-8 border-t border-[#c9c2b4] pt-3 text-[9.5px] text-[#8a8270]">
                  Documento gerado pela Cleopatra a partir da minuta "{ativa.nome}" — as marcações
                  coloridas mostram a origem de cada dado e não aparecem no documento final.
                </div>
              </div>
            </div>
          )}
        </Panel>

        {/* Paleta e leitura */}
        <div className="flex flex-col gap-4">
          <Panel className="overflow-hidden">
            <PanelHeader
              eyebrow="Leitura da Cleo"
              titulo="O que esta minuta usa"
              acao={<Wand2 size={14} className="text-cleo" />}
            />
            <div className="flex flex-col gap-2.5 px-4 py-4 text-[12px]">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-teal" />
                <span className="text-muted">
                  <span className="num text-ink">{uso?.internas.length ?? 0}</span> variáveis que a
                  Cleo preenche sozinha
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-gold" />
                <span className="text-muted">
                  <span className="num text-ink">{uso?.usuario.length ?? 0}</span> lacunas para o
                  analista
                </span>
              </div>
              {uso && uso.desconhecidas.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-alert/30 bg-alert/[0.06] px-2.5 py-2">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0 text-alert" />
                  <span className="text-[11.5px] text-muted">
                    Variável desconhecida:{' '}
                    <span className="num text-alert">{uso.desconhecidas.join(', ')}</span> — confira
                    a grafia na paleta.
                  </span>
                </div>
              )}
              <p className="mt-1 border-t border-line-soft pt-2.5 text-[11px] leading-relaxed text-faint">
                Quanto mais verde, menos digitação — e menos erro. A minuta ideal só deixa dourado
                o que é julgamento humano.
              </p>
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <PanelHeader
              eyebrow="Paleta"
              titulo="Variáveis disponíveis"
              acao={<Braces size={14} className="text-faint" />}
            />
            <ul className="max-h-[430px] divide-y divide-line-soft overflow-y-auto">
              {VARIAVEIS.map((v) => (
                <li key={v.nome}>
                  <button
                    onClick={() => inserirVariavel(v.nome)}
                    disabled={modo !== 'editor'}
                    title={modo !== 'editor' ? 'Entre no modo Editar para inserir' : v.descricao}
                    className="w-full px-4 py-2 text-left transition-colors hover:bg-white/[0.04] disabled:cursor-default disabled:opacity-60"
                  >
                    <div className="flex items-center gap-2">
                      {v.origem === 'interno' ? (
                        <Wand2 size={10} className="shrink-0 text-teal" />
                      ) : (
                        <PenLine size={10} className="shrink-0 text-gold" />
                      )}
                      <span className="num text-[11.5px] text-ink">{`{{${v.nome}}}`}</span>
                    </div>
                    <div className="mt-0.5 pl-[18px] text-[10.5px] text-faint">{v.descricao}</div>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel className="flex items-start gap-3 px-4 py-3.5">
            <FileSignature size={14} className="mt-0.5 shrink-0 text-cleo" />
            <p className="text-[11.5px] leading-relaxed text-muted">
              O rito <span className="text-ink">"Redigir documento a partir de minuta"</span> usa
              estes modelos: escolhe a minuta, preenche as variáveis internas e deixa o documento
              no SEI aguardando as lacunas e a assinatura.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  )
}
