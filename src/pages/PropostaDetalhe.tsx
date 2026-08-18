import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  BrainCircuit,
  CalendarRange,
  CheckCircle2,
  CircleDashed,
  Columns3,
  FileText,
  Gavel,
  Play,
  MessageSquare,
  Printer,
  ShieldAlert,
  Sparkles,
  Timer,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { useApp } from '@/store/app'
import {
  automacoesDaProposta,
  diligenciasDaProposta,
  extensaoDa,
  getAcao,
  getEmenda,
  getOrgao,
  getParlamentar,
  getProponente,
  getProposta,
  responsavelDaProposta,
} from '@/data/repo'
import type { Gatilho } from '@/data/types'
import { DESCRICAO_GATILHO, ROTULO_GATILHO } from '@/simulacao/roteiros'
import { avaliar, proximaAcao } from '@/dominio/saude'
import { alertas as calcularAlertas, prazo as calcularPrazo, TOM_SEVERIDADE } from '@/dominio/riscos'
import {
  execucaoFisica,
  prazosLegais,
  situacaoVigencia,
  TOM_PRESTACAO,
  diasAte,
} from '@/dominio/ciclo'
import { preverConclusao } from '@/dominio/recomendacao'
import { scoreProponente } from '@/dominio/proponentes'
import { useExecutor } from '@/comandos/executor'
import { cn, data, dataHora, desde, duracao, moeda, moedaCompacta } from '@/lib/format'
import { Badge, Botao, Panel, PanelHeader, SituacaoBadge, Vazio } from '@/components/ui'
import { BarraComposicao } from '@/components/charts'
import { CicloDeVida } from '@/components/CicloDeVida'
import { Medidor } from '@/components/dados'

const ABAS = [
  'Visão geral',
  'Ciclo e prazos',
  'Automações',
  'Empenhos',
  'Cronograma',
  'Documentos',
  'Linha do tempo',
] as const
type Aba = (typeof ABAS)[number]

const GATILHOS: Gatilho[] = [
  'criar_processo',
  'adicionar_bloco_interno',
  'anexar_extrato_proposta',
  'anexar_contrapartidas',
  'anexar_capacidades_tecnicas',
  'criar_documento',
]

const TOM_SAUDE = {
  boa: { texto: 'text-teal', anel: 'stroke-teal', fundo: 'bg-teal/10' },
  atencao: { texto: 'text-gold', anel: 'stroke-gold', fundo: 'bg-gold/10' },
  critica: { texto: 'text-alert', anel: 'stroke-alert', fundo: 'bg-alert/10' },
}

/** Anel de saúde: uma leitura só, do canto do olho. */
function AnelSaude({ pontos, faixa }: { pontos: number; faixa: keyof typeof TOM_SAUDE }) {
  const r = 26
  const circunferencia = 2 * Math.PI * r
  return (
    <div className="relative flex size-[68px] items-center justify-center">
      <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--color-line)" strokeWidth="4" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          className={TOM_SAUDE[faixa].anel}
          strokeDasharray={circunferencia}
          strokeDashoffset={circunferencia * (1 - pontos / 100)}
          style={{ transition: 'stroke-dashoffset 900ms ease-out' }}
        />
      </svg>
      <span className={cn('num text-[17px] font-medium', TOM_SAUDE[faixa].texto)}>{pontos}</span>
    </div>
  )
}

export function PropostaDetalhe() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const { abrirExecucao, execucoesDaSessao, comentarios, comentar, notificar, alternarComparacao, comparacao } =
    useApp()
  const [rascunho, setRascunho] = useState('')
  const { executar } = useExecutor()

  const aba = (params.get('aba') as Aba) ?? 'Visão geral'
  const trocarAba = (a: Aba) => {
    if (a === 'Visão geral') params.delete('aba')
    else params.set('aba', a)
    setParams(params, { replace: true })
  }

  const proposta = id ? getProposta(id) : undefined

  const historico = proposta ? automacoesDaProposta(proposta.id) : []
  const daSessao = execucoesDaSessao.filter((a) => a.propostaId === proposta?.id)
  const todas = [...daSessao, ...historico]

  const concluidas = useMemo(
    () => new Set(todas.filter((a) => a.status === 'SUCESSO').map((a) => a.gatilho)),
    [todas],
  )

  const saude = useMemo(
    () => (proposta ? avaliar(proposta, concluidas) : null),
    [proposta, concluidas],
  )
  const proxima = useMemo(
    () => (proposta ? proximaAcao(proposta, concluidas) : null),
    [proposta, concluidas],
  )
  const listaAlertas = useMemo(() => (proposta ? calcularAlertas(proposta) : []), [proposta])
  const prazoFase = useMemo(() => (proposta ? calcularPrazo(proposta) : null), [proposta])
  const daProposta = comentarios.filter((c) => c.propostaId === proposta?.id)

  if (!proposta || !saude || !proxima) {
    return <Vazio titulo="Proposta não encontrada." />
  }

  const proponente = getProponente(proposta.proponenteId)!
  const orgao = getOrgao(proposta.orgaoId)!
  const temProcesso = !!proposta.numProcessoSei || concluidas.has('criar_processo')
  const checklistOk = proposta.checklist.filter((c) => c.concluido).length

  // Segunda camada do dossiê: de onde veio o dinheiro, quem responde, quanto tempo resta.
  const extensao = extensaoDa(proposta.id)
  const emenda = extensao?.emendaId ? getEmenda(extensao.emendaId) : undefined
  const parlamentar = emenda?.parlamentarId ? getParlamentar(emenda.parlamentarId) : undefined
  const acao = extensao ? getAcao(extensao.acaoId) : undefined
  const responsavel = responsavelDaProposta(proposta.id)
  const vigencia = situacaoVigencia(proposta.id)
  const prestacao = extensao?.prestacao
  const metas = extensao?.metas ?? []
  const prazos = prazosLegais(proposta)
  const previsao = preverConclusao(proposta)
  const diligencias = diligenciasDaProposta(proposta.id)
  const score = scoreProponente(proposta.proponenteId)
  const naBandeja = comparacao.includes(proposta.id)

  function dispararProxima() {
    if (!proposta || !proxima) return
    if (proxima.rito) abrirExecucao({ propostaId: proposta.id, fila: proxima.rito, titulo: 'Rito completo de instrução' })
    else if (proxima.gatilho) abrirExecucao({ propostaId: proposta.id, fila: [proxima.gatilho] })
  }

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-5">
      <div className="nao-imprimir flex items-center justify-between gap-4">
        <Link
          to="/propostas"
          className="flex w-fit items-center gap-1.5 text-[12.5px] text-muted hover:text-ink"
        >
          <ArrowLeft size={14} /> Propostas
        </Link>
        <div className="flex items-center gap-2">
          <Botao
            tamanho="sm"
            variante={naBandeja ? 'primario' : 'secundario'}
            onClick={() => alternarComparacao(proposta.id)}
          >
            <Columns3 size={11} /> {naBandeja ? 'Na bandeja' : 'Comparar'}
          </Botao>
          <Botao tamanho="sm" onClick={() => window.print()} title="Dossiê de uma página">
            <Printer size={11} /> Dossiê
          </Botao>
        </div>
      </div>

      {/* Capa do convênio */}
      <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="eyebrow">Proposta</span>
            <SituacaoBadge situacao={proposta.situacao} />
            {saude.diasParada > 30 && (
              <Badge tom="alert">parada há {saude.diasParada} dias</Badge>
            )}
          </div>
          <h1 className="num text-[24px] leading-tight">{proposta.numero}</h1>
          <p className="mt-2 max-w-[680px] text-[13.5px] leading-relaxed text-muted">
            {proposta.objeto}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px] text-muted">
            <span className="text-ink">{proponente.nome}</span>
            <span>
              {proponente.municipio} · {proponente.uf}
            </span>
            <span className="num">{proponente.cnpj}</span>
            {proposta.numProcessoSei && (
              <span className="num text-cleo">SEI {proposta.numProcessoSei}</span>
            )}
            <Link
              to={`/proponentes/${proponente.id}`}
              className="text-teal hover:underline"
            >
              ficha do proponente
            </Link>
            {parlamentar && (
              <Link
                to={`/parlamentares/${parlamentar.id}`}
                className="flex items-center gap-1.5 text-gold hover:underline"
              >
                <Gavel size={12} /> {parlamentar.nome} ({parlamentar.partido}/{parlamentar.uf})
              </Link>
            )}
            <button
              onClick={() =>
                void executar([{ tipo: 'focar-no-cerebro', noId: `pr:${proposta.id}` }], {
                  silencioso: true,
                })
              }
              className="flex items-center gap-1.5 text-cleo hover:underline"
            >
              <BrainCircuit size={13} /> ver no Cérebro
            </button>
          </div>
        </div>

        {/* No celular a capa empilha: o valor e o anel de saúde ficam lado a
            lado numa faixa própria, alinhados à esquerda como o resto. */}
        <div className="flex shrink-0 items-start justify-between gap-6 lg:justify-start">
          <div className="lg:text-right">
            <div className="eyebrow mb-1">Valor global</div>
            <div className="num text-[21px] whitespace-nowrap text-gold lg:text-[24px]">
              {moeda(proposta.valorGlobal)}
            </div>
            <div className="num mt-1 text-[12px] text-muted">
              repasse {moedaCompacta(proposta.valorRepasse)} · contrapartida{' '}
              {moedaCompacta(proposta.valorContrapartida)}
            </div>
            <div className="mt-2 text-[11.5px] text-faint">
              sincronizada {desde(proposta.dataUltimaSincronizacao)}
            </div>
          </div>
          <div className="flex flex-col items-center">
            <AnelSaude pontos={saude.pontos} faixa={saude.faixa} />
            <span className={cn('mt-1.5 text-[11.5px]', TOM_SAUDE[saude.faixa].texto)}>
              {saude.rotulo}
            </span>
          </div>
        </div>
      </header>

      {/* Onde a proposta está no processo inteiro, antes de qualquer detalhe */}
      <Panel className="px-5 py-4">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <span className="eyebrow">Ciclo do convênio</span>
          {previsao && (
            <span className="text-[11.5px] text-muted">
              Celebração provável em{' '}
              <span className="num text-cleo">{data(previsao.dataProvavel)}</span>
              <span className="num ml-1.5 text-faint">
                ({previsao.diasOtimista}–{previsao.diasPessimista} dias)
              </span>
            </span>
          )}
        </div>
        <CicloDeVida situacao={proposta.situacao} />
      </Panel>

      {/* Próxima ação: responde "e agora?" antes de qualquer aba */}
      <Panel className="flex items-center gap-5 border-cleo/25 bg-cleo/[0.04] px-5 py-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-cleo/15 text-cleo">
          <Zap size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="eyebrow mb-1">Próxima ação recomendada</div>
          <div className="text-[14px] text-ink">{proxima.titulo}</div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{proxima.porque}</p>
        </div>
        <Botao variante="primario" onClick={dispararProxima} className="shrink-0">
          <Play size={13} fill="currentColor" />
          {proxima.rito ? 'Executar o rito completo' : 'Executar'}
        </Botao>
      </Panel>

      {/* Conformidade: a regra que gerou cada alerta fica escrita, para o servidor
          poder discordar com base — alerta sem regra visível vira ruído ignorado. */}
      {listaAlertas.length > 0 && (
        <Panel className="overflow-hidden">
          <PanelHeader
            eyebrow="Conformidade"
            titulo={`${listaAlertas.length} ${listaAlertas.length === 1 ? 'alerta' : 'alertas'} nesta proposta`}
            acao={
              prazoFase && prazoFase.limite > 0 ? (
                <span
                  className={cn(
                    'num flex items-center gap-1.5 text-[12px]',
                    prazoFase.estourado ? 'text-alert' : 'text-muted',
                  )}
                >
                  <Timer size={13} />
                  {prazoFase.decorrido} de {prazoFase.limite} dias na fase
                </span>
              ) : undefined
            }
          />
          <ul className="divide-y divide-line-soft">
            {listaAlertas.map((a) => (
              <li key={a.id} className="flex items-start gap-3 px-5 py-3.5">
                <ShieldAlert
                  size={15}
                  className={cn(
                    'mt-0.5 shrink-0',
                    a.severidade === 'critico' ? 'text-alert' : 'text-gold',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[13px] text-ink">{a.rotulo}</span>
                    <Badge tom={TOM_SEVERIDADE[a.severidade]}>{a.severidade}</Badge>
                  </div>
                  <p className="mt-0.5 text-[12px] text-muted">{a.detalhe}</p>
                  <p className="num mt-1 text-[10.5px] text-faint">regra: {a.regra}</p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* Oito abas não cabem em 390px: no celular a régua rola de lado em vez
          de sumir atrás da borda do painel. */}
      <nav className="rolagem-discreta -mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 md:mx-0 md:px-0">
        {ABAS.map((a) => (
          <button
            key={a}
            onClick={() => trocarAba(a)}
            className={cn(
              'relative shrink-0 px-3.5 py-2.5 text-[13px] whitespace-nowrap transition-colors',
              aba === a ? 'text-ink' : 'text-muted hover:text-ink',
            )}
          >
            {a}
            {a === 'Automações' && (
              <span className="num ml-1.5 text-[10.5px] text-faint">{todas.length}</span>
            )}
            {aba === a && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-t bg-gold" />}
          </button>
        ))}
      </nav>

      {aba === 'Ciclo e prazos' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-4">
          <div className="flex flex-col gap-4">
            <Panel>
              <PanelHeader
                eyebrow="Relógio"
                titulo="Prazos que correm sobre esta proposta"
                acao={<Timer size={15} className="text-faint" />}
              />
              {prazos.length === 0 ? (
                <p className="px-5 py-8 text-center text-[12.5px] text-muted">
                  Nenhum prazo em curso nesta fase.
                </p>
              ) : (
                <ul className="divide-y divide-line-soft">
                  {prazos.map((p) => (
                    <li key={p.id} className="flex items-center gap-4 px-5 py-3.5">
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] text-ink">{p.rotulo}</div>
                        <p className="mt-0.5 text-[11.5px] text-muted">{p.detalhe}</p>
                        <p className="mt-1 text-[10.5px] text-faint">base: {p.base}</p>
                      </div>
                      <span
                        className={cn(
                          'num shrink-0 text-right text-[13px]',
                          p.vencido ? 'text-alert' : p.dias < 15 ? 'text-gold' : 'text-teal',
                        )}
                      >
                        {p.dias < 0 ? `${Math.abs(p.dias)}d vencido` : `${p.dias}d`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {vigencia && (
              <Panel>
                <PanelHeader
                  eyebrow="Vigência"
                  titulo={vigencia.rotulo}
                  acao={<CalendarRange size={15} className="text-faint" />}
                />
                <div className="px-5 py-5">
                  <div className="mb-2 flex items-baseline justify-between gap-4">
                    <span className="num text-[12.5px] text-muted">
                      {data(vigencia.vigencia.inicio)} → {data(vigencia.vigencia.fim)}
                    </span>
                    <span
                      className={cn(
                        'num text-[12.5px]',
                        vigencia.diasRestantes < 0
                          ? 'text-alert'
                          : vigencia.diasRestantes < 90
                            ? 'text-gold'
                            : 'text-teal',
                      )}
                    >
                      {vigencia.diasRestantes < 0
                        ? `encerrada há ${Math.abs(vigencia.diasRestantes)} dias`
                        : `${vigencia.diasRestantes} dias restantes`}
                    </span>
                  </div>
                  <Medidor
                    valor={vigencia.consumo}
                    tom={vigencia.consumo > 0.9 ? 'alert' : vigencia.consumo > 0.7 ? 'gold' : 'teal'}
                    altura={7}
                  />

                  {vigencia.vigencia.aditivos.length > 0 && (
                    <ul className="mt-5 flex flex-col gap-3 border-t border-line-soft pt-4">
                      {vigencia.vigencia.aditivos.map((a) => (
                        <li key={a.id} className="flex items-start gap-3">
                          <Badge tom="cleo">{a.tipo}</Badge>
                          <div className="min-w-0 flex-1">
                            <div className="text-[12.5px] text-ink">{a.numero}</div>
                            <p className="mt-0.5 text-[11.5px] text-muted">{a.descricao}</p>
                          </div>
                          <span className="num shrink-0 text-[11.5px] text-faint">
                            {data(a.data)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Panel>
            )}

            {diligencias.length > 0 && (
              <Panel>
                <PanelHeader
                  eyebrow="Comunicação"
                  titulo={`${diligencias.length} diligência(s) ao proponente`}
                />
                <ul className="divide-y divide-line-soft">
                  {diligencias.map((d) => {
                    const dias = diasAte(d.prazo)
                    return (
                      <li key={d.id} className="px-5 py-3.5">
                        <div className="mb-1.5 flex items-center justify-between gap-3">
                          <span className="text-[12.5px] text-ink">{d.assunto}</span>
                          {d.respondidaEm ? (
                            <Badge tom="teal">respondida em {data(d.respondidaEm)}</Badge>
                          ) : (
                            <Badge tom={dias < 0 ? 'alert' : 'gold'}>
                              {dias < 0 ? `${Math.abs(dias)}d vencida` : `${dias}d de prazo`}
                            </Badge>
                          )}
                        </div>
                        <ul className="flex flex-col gap-1">
                          {d.itens.map((item) => (
                            <li key={item} className="flex items-start gap-2 text-[11.5px] text-muted">
                              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-faint" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </li>
                    )
                  })}
                </ul>
              </Panel>
            )}
          </div>

          <div className="flex flex-col gap-4">
            {previsao && (
              <Panel className="border-cleo/25">
                <PanelHeader
                  eyebrow="Previsão"
                  titulo="Quando esta proposta chega à celebração"
                  acao={<TrendingUp size={15} className="text-cleo" />}
                />
                <div className="px-5 py-5">
                  <div className="num text-[26px] leading-none text-cleo">
                    {data(previsao.dataProvavel)}
                  </div>
                  <div className="num mt-2 text-[12px] text-muted">
                    {previsao.diasMediana} dias na mediana · faixa de {previsao.diasOtimista} a{' '}
                    {previsao.diasPessimista}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {previsao.fasesRestantes.map((f) => (
                      <span
                        key={f}
                        className="rounded-md border border-line bg-raised px-2 py-1 text-[11px] text-muted"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                  <p className="mt-4 text-[11.5px] leading-relaxed text-faint">{previsao.base}</p>
                </div>
              </Panel>
            )}

            {metas.length > 0 && (
              <Panel>
                <PanelHeader
                  eyebrow="Execução física"
                  titulo={`${(execucaoFisica(proposta.id) * 100).toFixed(0)}% das metas cumpridas`}
                />
                <ul className="flex flex-col gap-4 px-5 py-5">
                  {metas.map((m) => (
                    <li key={m.id}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3">
                        <span className="text-[12.5px] text-ink">{m.descricao}</span>
                        <span className="num shrink-0 text-[12px] text-muted">
                          {m.realizado} / {m.previsto} {m.unidade}
                        </span>
                      </div>
                      <Medidor
                        valor={m.previsto > 0 ? m.realizado / m.previsto : 0}
                        tom={m.realizado >= m.previsto ? 'teal' : 'gold'}
                      />
                    </li>
                  ))}
                </ul>
              </Panel>
            )}

            {prestacao && (
              <Panel>
                <PanelHeader eyebrow="Encerramento" titulo="Prestação de contas" />
                <div className="flex flex-col gap-3 px-5 py-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[12.5px] text-muted">Status</span>
                    <Badge tom={TOM_PRESTACAO[prestacao.status]} ponto>
                      {prestacao.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[12.5px] text-muted">Prazo legal</span>
                    <span className="num text-[12.5px] text-ink">{data(prestacao.prazo)}</span>
                  </div>
                  {prestacao.dataEntrega && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[12.5px] text-muted">Apresentada em</span>
                      <span className="num text-[12.5px] text-teal">
                        {data(prestacao.dataEntrega)}
                      </span>
                    </div>
                  )}
                  {prestacao.ressalvas.length > 0 && (
                    <div className="mt-1 border-t border-line-soft pt-3">
                      <div className="eyebrow mb-1.5">Ressalvas</div>
                      <ul className="flex flex-col gap-1.5">
                        {prestacao.ressalvas.map((r) => (
                          <li key={r} className="text-[11.5px] leading-relaxed text-gold">
                            {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="mt-1 text-[11px] leading-relaxed text-faint">
                    O prazo de 60 dias corre do fim da vigência. Prestação em atraso impede o
                    proponente de receber nova transferência.
                  </p>
                </div>
              </Panel>
            )}

            {!vigencia && !prestacao && metas.length === 0 && (
              <Panel>
                <PanelHeader eyebrow="Ainda não" titulo="Sem vigência registrada" />
                <p className="px-5 py-6 text-[12.5px] leading-relaxed text-muted">
                  Vigência, metas físicas e prestação de contas passam a existir quando o
                  instrumento é celebrado. Até lá, o que corre são os prazos de análise e de
                  resposta a diligência.
                </p>
              </Panel>
            )}
          </div>
        </div>
      )}

      {aba === 'Visão geral' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
          <div className="flex flex-col gap-4">
            <Panel>
              <PanelHeader eyebrow="Cadastro" titulo="Dados da proposta" />
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 px-5 py-5">
                {[
                  ['Programa', proposta.programa],
                  ['Modalidade', proposta.modalidade],
                  ['Fundamento legal', proposta.fundamentoLegal],
                  ['Concedente', orgao.sigla],
                  ['Unidade gestora', orgao.unidadeGestora],
                  ['Cadastrada em', data(proposta.dataCadastro)],
                  ['Representante', proponente.representante],
                  ['Cargo', proponente.cargoRepresentante],
                  [
                    'Origem do recurso',
                    emenda
                      ? `Emenda ${emenda.numero}/${emenda.ano} — ${emenda.tipo}`
                      : 'Dotação própria do programa',
                  ],
                  ['Ação orçamentária', acao ? `${acao.codigo} — ${acao.nome}` : '—'],
                  ['Responsável pela análise', responsavel?.nome ?? 'Não atribuída'],
                  [
                    'Capacidade do proponente',
                    score ? `${score.pontos}/100 — ${score.rotulo}` : '—',
                  ],
                ].map(([rotulo, valor]) => (
                  <div key={rotulo}>
                    <dt className="eyebrow mb-1">{rotulo}</dt>
                    <dd className="text-[13px] text-ink">{valor}</dd>
                  </div>
                ))}
              </dl>
            </Panel>

            <Panel>
              <PanelHeader eyebrow="Diagnóstico" titulo="O que falta para instruir" />
              <ul className="flex flex-col gap-2.5 px-5 py-5">
                {saude.pendencias.map((p) => (
                  <li key={p.rotulo} className="flex items-center gap-2.5">
                    {p.resolvida ? (
                      <CheckCircle2 size={15} className="shrink-0 text-teal" />
                    ) : (
                      <CircleDashed size={15} className="shrink-0 text-gold" />
                    )}
                    <span
                      className={cn('flex-1 text-[12.5px]', p.resolvida ? 'text-muted' : 'text-ink')}
                    >
                      {p.rotulo}
                    </span>
                    <span className="num text-[11px] text-faint">{p.peso} pts</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <div className="flex flex-col gap-4">
            <Panel>
              <PanelHeader eyebrow="Financeiro" titulo="Composição" />
              <div className="px-5 py-5">
                <BarraComposicao
                  segmentos={[
                    { rotulo: 'Repasse', valor: proposta.valorRepasse, cor: 'var(--color-viz-gold)' },
                    {
                      rotulo: 'Contrapartida',
                      valor: proposta.valorContrapartida,
                      cor: 'var(--color-viz-teal)',
                    },
                  ]}
                />
              </div>
            </Panel>

            <Panel>
              <PanelHeader
                eyebrow="Habilitação"
                titulo="Checklist"
                acao={
                  <span className="num text-[12px] text-muted">
                    {checklistOk}/{proposta.checklist.length}
                  </span>
                }
              />
              <ul className="flex flex-col gap-2.5 px-5 py-5">
                {proposta.checklist.map((item) => (
                  <li key={item.id} className="flex items-start gap-2.5">
                    {item.concluido ? (
                      <CheckCircle2 size={15} className="mt-px shrink-0 text-teal" />
                    ) : (
                      <CircleDashed
                        size={15}
                        className={cn('mt-px shrink-0', item.obrigatorio ? 'text-gold' : 'text-faint')}
                      />
                    )}
                    <span className={cn('text-[12.5px]', item.concluido ? 'text-muted' : 'text-ink')}>
                      {item.rotulo}
                      {!item.obrigatorio && (
                        <span className="ml-1.5 text-[10.5px] text-faint">opcional</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
      )}

      {aba === 'Visão geral' && (
        <Panel>
          <PanelHeader
            eyebrow="Colaboração"
            titulo="Comentários"
            acao={<span className="num text-[12px] text-muted">{daProposta.length}</span>}
          />
          <div className="px-5 py-5">
            {daProposta.length === 0 ? (
              <p className="mb-4 text-[12.5px] text-muted">
                A conversa sobre esta proposta começa aqui — e fica junto do processo, não no e-mail.
              </p>
            ) : (
              <ul className="mb-4 flex flex-col gap-3.5">
                {daProposta.map((c) => (
                  <li key={c.id} className="flex gap-3">
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-teal/15 text-[11px] font-medium text-teal">
                      {c.autor.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2.5">
                        <span className="text-[12.5px] text-ink">{c.autor}</span>
                        <span className="text-[10.5px] text-faint">{desde(c.criadoEm)}</span>
                      </div>
                      <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{c.texto}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault()
                const texto = rascunho.trim()
                if (!texto) return
                comentar(proposta.id, texto)
                notificar({
                  tipo: 'comentario',
                  titulo: 'Comentário registrado',
                  detalhe: `Proposta ${proposta.numero}`,
                  href: `/propostas/${proposta.id}`,
                })
                setRascunho('')
              }}
              className="flex items-center gap-2"
            >
              <MessageSquare size={15} className="shrink-0 text-faint" />
              <input
                value={rascunho}
                onChange={(e) => setRascunho(e.target.value)}
                placeholder="Escreva um comentário para a equipe…"
                aria-label="Novo comentário"
                className="h-9 flex-1 rounded-lg border border-line bg-abyss/60 px-3 text-[12.5px] text-ink placeholder:text-faint focus:border-teal/50 focus:outline-none"
              />
              <Botao variante="primario" tamanho="sm" type="submit" disabled={!rascunho.trim()}>
                Comentar
              </Botao>
            </form>
          </div>
        </Panel>
      )}

      {aba === 'Automações' && (
        <div className="flex flex-col gap-4">
          <Panel className="flex items-center gap-5 px-5 py-4">
            <div className="flex-1">
              <div className="text-[13.5px] text-ink">Instruir do começo ao fim</div>
              <p className="mt-0.5 text-[12px] text-muted">
                Autua no SEI, anexa extrato e contrapartidas e gera o termo de análise — quatro
                automações na ordem certa, numa janela só.
              </p>
            </div>
            <Botao
              variante="primario"
              onClick={() =>
                abrirExecucao({
                  propostaId: proposta.id,
                  fila: [
                    'criar_processo',
                    'anexar_extrato_proposta',
                    'anexar_contrapartidas',
                    'criar_documento',
                  ],
                  titulo: 'Rito completo de instrução',
                })
              }
            >
              <Play size={13} fill="currentColor" /> Executar o rito completo
            </Botao>
          </Panel>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {GATILHOS.map((g) => {
              const feita = concluidas.has(g)
              const bloqueado = g !== 'criar_processo' && !temProcesso
              return (
                <button
                  key={g}
                  disabled={bloqueado}
                  onClick={() => abrirExecucao({ propostaId: proposta.id, fila: [g] })}
                  className={cn(
                    'panel group flex flex-col items-start gap-2 p-4 text-left transition-colors',
                    bloqueado
                      ? 'cursor-not-allowed opacity-45'
                      : 'hover:border-cleo/40 hover:bg-cleo/[0.05]',
                  )}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="text-[13px] text-ink">{ROTULO_GATILHO[g]}</span>
                    {feita ? (
                      <Badge tom="teal">feita</Badge>
                    ) : (
                      <span className="flex size-6 items-center justify-center rounded-full bg-white/5 text-muted transition-colors group-hover:bg-cleo/20 group-hover:text-cleo">
                        <Play size={11} fill="currentColor" />
                      </span>
                    )}
                  </div>
                  <p className="text-[11.5px] leading-snug text-muted">{DESCRICAO_GATILHO[g]}</p>
                  {bloqueado && (
                    <span className="text-[10.5px] text-faint">Depende do processo criado no SEI</span>
                  )}
                </button>
              )
            })}
          </div>

          <Panel>
            <PanelHeader eyebrow="Histórico" titulo="Execuções desta proposta" />
            {todas.length === 0 ? (
              <Vazio titulo="Nenhuma automação executada ainda." />
            ) : (
              <ul className="divide-y divide-line-soft">
                {todas.slice(0, 12).map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 sm:flex-nowrap sm:px-5"
                  >
                    <span
                      className={cn(
                        'size-1.5 shrink-0 rounded-full',
                        a.status === 'SUCESSO' ? 'bg-teal' : 'bg-alert',
                      )}
                    />
                    <span className="min-w-0 flex-1 text-[12.5px] text-ink">
                      {ROTULO_GATILHO[a.gatilho]}
                    </span>
                    <span className="num shrink-0 text-[11.5px] text-muted">
                      {duracao(a.duracaoMs)}
                    </span>
                    {/* Quem executou e quando: segunda linha no celular */}
                    <span className="flex w-full items-center gap-4 pl-4 sm:contents">
                      <span className="min-w-0 flex-1 truncate text-[11.5px] text-faint sm:w-[150px] sm:flex-none sm:text-right">
                        {a.usuario}
                      </span>
                      <span className="num shrink-0 text-right text-[11.5px] text-faint sm:w-[110px]">
                        {dataHora(a.criadoEm)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}

      {aba === 'Empenhos' && (
        <Panel>
          <PanelHeader
            eyebrow="Execução orçamentária"
            titulo="Empenhos emitidos"
            acao={
              <span className="num text-[12.5px] text-gold">
                {moeda(proposta.empenhos.reduce((s, e) => s + e.valor, 0))}
              </span>
            }
          />
          {proposta.empenhos.length === 0 ? (
            <Vazio titulo="Nenhum empenho emitido para esta proposta." />
          ) : (
            <ul className="divide-y divide-line-soft">
              {proposta.empenhos.map((e) => (
                <li key={e.id} className="flex items-center gap-5 px-5 py-3.5">
                  <span className="num text-[12.5px] text-ink">{e.numero}</span>
                  <Badge tom="inert">{e.tipo}</Badge>
                  <span className="num ml-auto text-[12.5px] text-gold">{moeda(e.valor)}</span>
                  <span className="num w-[90px] text-right text-[11.5px] text-faint">
                    {data(e.data)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {aba === 'Cronograma' && (
        <Panel>
          <PanelHeader eyebrow="Plano de trabalho" titulo="Cronograma físico-financeiro" />
          <ul className="divide-y divide-line-soft">
            {proposta.cronograma.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3.5 sm:flex-nowrap sm:px-5"
              >
                <span className="num w-6 shrink-0 text-[11.5px] text-faint">{p.ordem}</span>
                <span className="min-w-0 flex-1 text-[12.5px] text-ink">{p.descricao}</span>
                {/* Mês, valor e situação da etapa: segunda linha no celular */}
                <span className="flex w-full items-center gap-4 pl-10 sm:contents">
                  <span className="num shrink-0 text-[11.5px] text-muted sm:w-[70px]">{p.mes}</span>
                  <span className="num flex-1 text-right text-[12.5px] whitespace-nowrap text-ink sm:w-[110px] sm:flex-none">
                    {moedaCompacta(p.valor)}
                  </span>
                  <span className="w-[92px] shrink-0 text-right">
                    {p.executado ? (
                      <Badge tom="teal">executada</Badge>
                    ) : (
                      <Badge tom="inert">prevista</Badge>
                    )}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {aba === 'Documentos' && (
        <Panel>
          <PanelHeader
            eyebrow="Processo SEI"
            titulo="Documentos"
            acao={
              proposta.numProcessoSei ? (
                <span className="num text-[12px] text-muted">{proposta.numProcessoSei}</span>
              ) : undefined
            }
          />
          {proposta.documentos.length === 0 ? (
            <Vazio titulo="Nenhum documento no processo." />
          ) : (
            <ul className="divide-y divide-line-soft">
              {proposta.documentos.map((d) => (
                <li key={d.id} className="flex items-center gap-4 px-5 py-3.5">
                  <FileText size={15} className="shrink-0 text-faint" />
                  <span className="flex-1 text-[12.5px] text-ink">{d.tipo}</span>
                  <span className="num text-[11.5px] text-muted">{d.numero}</span>
                  {d.geradoPelaCleo && (
                    <Badge tom="cleo">
                      <Sparkles size={9} /> Cleo
                    </Badge>
                  )}
                  {d.assinado ? (
                    <Badge tom="teal">assinado</Badge>
                  ) : (
                    <Badge tom="gold">a assinar</Badge>
                  )}
                  <span className="num w-[90px] text-right text-[11.5px] text-faint">
                    {data(d.data)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {aba === 'Linha do tempo' && (
        <Panel>
          <PanelHeader eyebrow="Histórico" titulo="Tudo que aconteceu com esta proposta" />
          <ol className="px-5 py-5">
            {proposta.timeline.map((e, i) => (
              <li key={e.id} className="flex gap-4 pb-5 last:pb-0">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      'mt-1 size-2 shrink-0 rounded-full',
                      e.autor === 'Cleo' ? 'bg-cleo' : 'bg-inert',
                    )}
                  />
                  {i < proposta.timeline.length - 1 && <span className="mt-1 w-px flex-1 bg-line" />}
                </div>
                <div className="min-w-0 pb-1">
                  <div className="flex items-baseline gap-3">
                    <span className="text-[13px] text-ink">{e.titulo}</span>
                    <span className="num text-[11px] text-faint">{data(e.data)}</span>
                  </div>
                  <div className="mt-0.5 text-[12px] text-muted">{e.detalhe}</div>
                  <div className="mt-1 text-[11px] text-faint">
                    {e.autor === 'Cleo' ? <span className="text-cleo">Cleo</span> : e.autor}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      )}
    </div>
  )
}
