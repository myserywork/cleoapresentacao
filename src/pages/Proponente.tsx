import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Ban, Building2, ShieldCheck } from 'lucide-react'
import { useApp } from '@/store/app'
import { diligenciasDaProposta, extensaoDa, getEmenda, getParlamentar } from '@/data/repo'
import { scoreProponente } from '@/dominio/proponentes'
import { execucaoFisica, situacaoVigencia, TOM_PRESTACAO } from '@/dominio/ciclo'
import { alertas } from '@/dominio/riscos'
import { cn, data, moeda, moedaCompacta, numero } from '@/lib/format'
import { Badge, Botao, Panel, PanelHeader, SituacaoBadge, Vazio } from '@/components/ui'
import { BotaoExportar, Dado, Medidor, Numero, Tabela, type Coluna } from '@/components/dados'
import type { Proposta } from '@/data/types'

/**
 * Ficha do proponente.
 *
 * Responde a pergunta que antecede qualquer celebração: "esse município
 * consegue executar?". A nota não decide sozinha — ela abre e mostra as
 * parcelas que a formaram, com o histórico inteiro logo abaixo.
 */
export function ProponenteFicha() {
  const { id = '' } = useParams()
  const { alternarComparacao } = useApp()
  const navegar = useNavigate()

  const score = useMemo(() => scoreProponente(id), [id])

  if (!score) {
    return <Vazio titulo="Proponente não encontrado." acao={<Link to="/propostas">Voltar</Link>} />
  }

  const { proponente, historico } = score

  const colunas: Coluna<Proposta>[] = [
    {
      id: 'numero',
      cabecalho: 'Proposta',
      valor: (p) => p.numero,
      celula: (p) => <span className="num text-[12.5px] text-ink">{p.numero}</span>,
    },
    {
      id: 'objeto',
      cabecalho: 'Objeto',
      valor: (p) => p.objeto,
      celula: (p) => (
        <span className="line-clamp-1 max-w-[340px] text-[12px] text-muted">{p.objeto}</span>
      ),
    },
    {
      id: 'situacao',
      cabecalho: 'Situação',
      valor: (p) => p.situacao,
      celula: (p) => <SituacaoBadge situacao={p.situacao} />,
    },
    {
      id: 'meta',
      cabecalho: 'Meta física',
      largura: '130px',
      valor: (p) => execucaoFisica(p.id),
      celula: (p) => {
        const e = execucaoFisica(p.id)
        if (!extensaoDa(p.id)?.vigencia) return <span className="text-[11.5px] text-faint">—</span>
        return (
          <div className="flex items-center gap-2">
            <Medidor valor={e} tom={e > 0.75 ? 'teal' : e > 0.4 ? 'gold' : 'alert'} />
            <span className="num w-8 shrink-0 text-right text-[11px] text-muted">
              {(e * 100).toFixed(0)}%
            </span>
          </div>
        )
      },
    },
    {
      id: 'contas',
      cabecalho: 'Prestação',
      valor: (p) => extensaoDa(p.id)?.prestacao?.status ?? '—',
      celula: (p) => {
        const prestacao = extensaoDa(p.id)?.prestacao
        return prestacao ? (
          <Badge tom={TOM_PRESTACAO[prestacao.status]}>{prestacao.status}</Badge>
        ) : (
          <span className="text-[11.5px] text-faint">—</span>
        )
      },
    },
    {
      id: 'alertas',
      cabecalho: 'Alertas',
      alinhamento: 'direita',
      valor: (p) => alertas(p).length,
      celula: (p) => {
        const lista = alertas(p)
        const criticos = lista.filter((a) => a.severidade === 'critico').length
        return lista.length === 0 ? (
          <span className="num text-faint">—</span>
        ) : (
          <Badge tom={criticos > 0 ? 'alert' : 'gold'}>{lista.length}</Badge>
        )
      },
    },
    {
      id: 'valor',
      cabecalho: 'Valor global',
      alinhamento: 'direita',
      valor: (p) => p.valorGlobal,
      celula: (p) => <span className="num text-gold">{moedaCompacta(p.valorGlobal)}</span>,
    },
    {
      id: 'comparar',
      cabecalho: '',
      largura: '90px',
      celula: (p) => (
        <Botao
          tamanho="sm"
          variante="fantasma"
          onClick={(e) => {
            e.stopPropagation()
            alternarComparacao(p.id)
          }}
        >
          comparar
        </Botao>
      ),
    },
  ]

  const emendas = [
    ...new Set(
      historico.propostas.map((p) => extensaoDa(p.id)?.emendaId).filter(Boolean) as string[],
    ),
  ]

  const vencendo = historico.propostas
    .map((p) => ({ p, v: situacaoVigencia(p.id) }))
    .filter((x) => x.v && x.v.diasRestantes <= 90)

  return (
    <div className="mx-auto flex max-w-[1340px] flex-col gap-5">
      <Botao variante="fantasma" className="self-start" onClick={() => navegar(-1)}>
        <ArrowLeft size={13} /> Voltar
      </Botao>

      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex items-start gap-4">
          <span className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-lg border border-line bg-raised">
            <Building2 size={19} className="text-teal" />
          </span>
          <div>
            <div className="eyebrow mb-1.5">
              {proponente.esfera} · {proponente.municipio}/{proponente.uf}
            </div>
            <h1 className="text-[26px] leading-tight">{proponente.nome}</h1>
            <p className="num mt-1.5 text-[12px] text-muted">
              CNPJ {proponente.cnpj} · {proponente.representante} ({proponente.cargoRepresentante})
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {historico.inadimplente && (
            <Badge tom="alert" ponto>
              Inadimplente
            </Badge>
          )}
          <BotaoExportar
            nome={`proponente-${proponente.municipio.toLowerCase().replace(/\s+/g, '-')}`}
            itens={historico.propostas}
            colunas={colunas}
          />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr_1fr_1fr_1fr] gap-4">
        <Panel
          className={cn(
            'px-5 py-4',
            score.faixa === 'alta'
              ? 'border-teal/25'
              : score.faixa === 'media'
                ? 'border-gold/25'
                : 'border-alert/25',
          )}
        >
          <div className="eyebrow mb-1.5">Capacidade</div>
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                'num text-[30px] leading-none font-medium',
                score.faixa === 'alta'
                  ? 'text-teal'
                  : score.faixa === 'media'
                    ? 'text-gold'
                    : 'text-alert',
              )}
            >
              {score.pontos}
            </span>
            <span className="num text-[13px] text-faint">/100</span>
          </div>
          <div className="mt-2 text-[11.5px] text-muted">{score.rotulo}</div>
        </Panel>
        <Panel className="px-5 py-4">
          <Numero rotulo="Propostas" valor={numero(historico.propostas.length)} detalhe={`${historico.emCurso} em curso`} />
        </Panel>
        <Panel className="px-5 py-4">
          <Numero rotulo="Valor pactuado" valor={moedaCompacta(historico.valorTotal)} tom="gold" />
        </Panel>
        <Panel className="px-5 py-4">
          <Numero rotulo="Recebido" valor={moedaCompacta(historico.valorRecebido)} tom="teal" detalhe="Soma dos empenhos" />
        </Panel>
        <Panel className="px-5 py-4">
          <Numero
            rotulo="Meta física média"
            valor={`${(historico.execucaoFisicaMedia * 100).toFixed(0)}%`}
            tom={historico.execucaoFisicaMedia > 0.7 ? 'teal' : 'gold'}
            detalhe="Nos convênios com meta medida"
          />
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.6fr] gap-4">
        <Panel>
          <PanelHeader
            eyebrow="Como a nota foi formada"
            titulo="As cinco parcelas do score"
            acao={
              historico.inadimplente ? (
                <Ban size={15} className="text-alert" />
              ) : (
                <ShieldCheck size={15} className="text-teal" />
              )
            }
          />
          <ul className="flex flex-col gap-4 px-5 py-5">
            {score.parcelas.map((p) => (
              <li key={p.rotulo}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="text-[12.5px] text-ink">{p.rotulo}</span>
                  <span className="num shrink-0 text-[12px] text-muted">
                    {p.obtido}
                    <span className="text-faint">/{p.peso}</span>
                  </span>
                </div>
                <Medidor
                  valor={p.obtido / p.peso}
                  tom={p.obtido / p.peso > 0.7 ? 'teal' : p.obtido / p.peso > 0.4 ? 'gold' : 'alert'}
                />
                <p className="mt-1.5 text-[11px] leading-relaxed text-faint">{p.detalhe}</p>
              </li>
            ))}
          </ul>
          <div className="border-t border-line px-5 py-3.5">
            <p className="text-[11.5px] leading-relaxed text-muted">
              A nota orienta a análise, não a substitui. Nenhuma decisão de convênio se sustenta em
              número fechado — por isso as parcelas ficam à vista.
            </p>
          </div>
        </Panel>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <Panel className="px-5 py-4">
              <Numero
                rotulo="Prestações em atraso"
                valor={numero(historico.prestacoesAtrasadas)}
                tom={historico.prestacoesAtrasadas > 0 ? 'alert' : 'teal'}
              />
            </Panel>
            <Panel className="px-5 py-4">
              <Numero
                rotulo="Prestações aprovadas"
                valor={numero(historico.prestacoesAprovadas)}
                tom="teal"
              />
            </Panel>
            <Panel className="px-5 py-4">
              <Numero
                rotulo="Diligências"
                valor={numero(historico.diligencias)}
                detalhe={`${historico.diligenciasVencidas} sem resposta no prazo`}
                tom={historico.diligenciasVencidas > 0 ? 'gold' : 'inert'}
              />
            </Panel>
            <Panel className="px-5 py-4">
              <Numero
                rotulo="Vencendo em 90 dias"
                valor={numero(vencendo.length)}
                tom={vencendo.length > 0 ? 'gold' : 'inert'}
                detalhe="Convênios com vigência a expirar"
              />
            </Panel>
          </div>

          {emendas.length > 0 && (
            <Panel>
              <PanelHeader eyebrow="Origem do recurso" titulo="Emendas que apontam para este proponente" />
              <ul className="flex flex-col gap-2.5 px-5 py-4">
                {emendas.slice(0, 6).map((emendaId) => {
                  const emenda = getEmenda(emendaId)
                  const parlamentar = emenda?.parlamentarId
                    ? getParlamentar(emenda.parlamentarId)
                    : undefined
                  if (!emenda) return null
                  return (
                    <li key={emendaId} className="flex items-center gap-3">
                      <span className="num shrink-0 text-[12px] text-ink">{emenda.numero}</span>
                      <Badge tom="cleo">{emenda.tipo}</Badge>
                      {parlamentar ? (
                        <button
                          onClick={() => navegar(`/parlamentares/${parlamentar.id}`)}
                          className="min-w-0 flex-1 truncate text-left text-[12px] text-muted hover:text-gold"
                        >
                          {parlamentar.nome} ({parlamentar.partido}/{parlamentar.uf})
                        </button>
                      ) : (
                        <span className="min-w-0 flex-1 text-[12px] text-faint">
                          Dotação própria do programa
                        </span>
                      )}
                      <span className="num shrink-0 text-[12px] text-gold">
                        {moeda(emenda.valorIndicado)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </Panel>
          )}

          <Panel>
            <PanelHeader eyebrow="Identificação" titulo="Dados cadastrais" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 px-5 py-4">
              <Dado rotulo="CNPJ" mono>
                {proponente.cnpj}
              </Dado>
              <Dado rotulo="Esfera">{proponente.esfera}</Dado>
              <Dado rotulo="Município">
                {proponente.municipio}/{proponente.uf}
              </Dado>
              <Dado rotulo="Representante">{proponente.representante}</Dado>
              <Dado rotulo="Cargo">{proponente.cargoRepresentante}</Dado>
              <Dado rotulo="CPF do representante" mono>
                {proponente.cpfRepresentante}
              </Dado>
            </div>
          </Panel>
        </div>
      </div>

      <Panel className="overflow-hidden">
        <PanelHeader
          eyebrow="Histórico"
          titulo={`${historico.propostas.length} propostas com este proponente`}
          acao={
            <span className="num text-[12px] text-muted">
              {numero(
                historico.propostas.reduce((s, p) => s + diligenciasDaProposta(p.id).length, 0),
              )}{' '}
              diligências abertas no total
            </span>
          }
        />
        <Tabela
          itens={historico.propostas}
          colunas={colunas}
          chave={(p) => p.id}
          aoClicar={(p) => navegar(`/propostas/${p.id}`)}
          ordemInicial={{ coluna: 'valor', direcao: 'desc' }}
        />
      </Panel>

      {vencendo.length > 0 && (
        <Panel>
          <PanelHeader eyebrow="Atenção" titulo="Convênios com vigência a expirar" />
          <ul className="divide-y divide-line-soft">
            {vencendo.map(({ p, v }) => (
              <li key={p.id} className="flex items-center gap-4 px-5 py-3">
                <button
                  onClick={() => navegar(`/propostas/${p.id}`)}
                  className="num shrink-0 text-[12.5px] text-ink hover:text-gold"
                >
                  {p.numero}
                </button>
                <span className="min-w-0 flex-1 truncate text-[12px] text-muted">{p.objeto}</span>
                <span className="num shrink-0 text-[12px] text-muted">{data(v!.vigencia.fim)}</span>
                <span
                  className={cn(
                    'num w-24 shrink-0 text-right text-[12px]',
                    v!.diasRestantes < 0 ? 'text-alert' : 'text-gold',
                  )}
                >
                  {v!.diasRestantes < 0
                    ? `${Math.abs(v!.diasRestantes)}d vencida`
                    : `${v!.diasRestantes}d`}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}
