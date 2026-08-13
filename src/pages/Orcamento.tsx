import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CalendarClock, Play, Wallet } from 'lucide-react'
import { useApp } from '@/store/app'
import { acoesDoOrgao, getOrgao, getProponente } from '@/data/repo'
import {
  candidatasAEmpenho,
  fimDeExercicio,
  funilDoOrgao,
  riscoRestosAPagar,
  simularEmpenho,
} from '@/dominio/orcamento'
import { cn, moeda, moedaCompacta, numero } from '@/lib/format'
import { Badge, Botao, Panel, PanelHeader } from '@/components/ui'
import { BotaoExportar, Medidor, Numero, Tabela, type Coluna } from '@/components/dados'
import { FunilExecucao } from '@/components/charts'
import type { AcaoOrcamentaria } from '@/data/types'

/**
 * Execução orçamentária.
 *
 * A tela responde a duas perguntas que se repetem toda semana a partir de
 * agosto: quanto ainda dá para empenhar, e o que vira restos a pagar se nada
 * mudar. Tudo o mais é contexto para essas duas.
 */
export function Orcamento() {
  const { orgaoId, abrirLote } = useApp()
  const navegar = useNavigate()
  const orgao = getOrgao(orgaoId)!

  const funil = useMemo(() => funilDoOrgao(orgaoId), [orgaoId])
  const fim = useMemo(() => fimDeExercicio(orgaoId), [orgaoId])
  const restos = useMemo(() => riscoRestosAPagar(orgaoId), [orgaoId])
  const acoes = useMemo(() => acoesDoOrgao(orgaoId), [orgaoId])
  const candidatas = useMemo(() => candidatasAEmpenho(orgaoId), [orgaoId])

  const [quantidade, setQuantidade] = useState(() => Math.min(8, candidatas.length))
  const simulacao = useMemo(
    () => simularEmpenho(orgaoId, quantidade),
    [orgaoId, quantidade],
  )

  const colunasAcao: Coluna<AcaoOrcamentaria>[] = [
    {
      id: 'codigo',
      cabecalho: 'Ação',
      valor: (a) => a.codigo,
      celula: (a) => (
        <div className="min-w-0">
          <div className="num text-[12.5px] text-ink">{a.codigo}</div>
          <div className="truncate text-[11.5px] text-muted">{a.nome}</div>
        </div>
      ),
    },
    {
      id: 'dotacao',
      cabecalho: 'Dotação',
      alinhamento: 'direita',
      valor: (a) => a.dotacao,
      celula: (a) => <span className="num text-ink">{moedaCompacta(a.dotacao)}</span>,
    },
    {
      id: 'empenhado',
      cabecalho: 'Empenhado',
      alinhamento: 'direita',
      valor: (a) => a.empenhado,
      celula: (a) => <span className="num text-gold">{moedaCompacta(a.empenhado)}</span>,
    },
    {
      id: 'liquidado',
      cabecalho: 'Liquidado',
      alinhamento: 'direita',
      valor: (a) => a.liquidado,
      celula: (a) => <span className="num text-cleo">{moedaCompacta(a.liquidado)}</span>,
    },
    {
      id: 'pago',
      cabecalho: 'Pago',
      alinhamento: 'direita',
      valor: (a) => a.pago,
      celula: (a) => <span className="num text-teal">{moedaCompacta(a.pago)}</span>,
    },
    {
      id: 'saldo',
      cabecalho: 'Saldo a empenhar',
      alinhamento: 'direita',
      largura: '210px',
      className: 'whitespace-nowrap',
      valor: (a) => a.dotacao - a.empenhado,
      celula: (a) => {
        const saldo = a.dotacao - a.empenhado
        const fatia = a.dotacao > 0 ? saldo / a.dotacao : 0
        return (
          <div className="flex items-center justify-end gap-2.5">
            <div className="w-16">
              <Medidor valor={1 - fatia} tom={fatia > 0.4 ? 'alert' : fatia > 0.2 ? 'gold' : 'teal'} />
            </div>
            <span className={cn('num w-[74px] text-right', fatia > 0.4 ? 'text-alert' : 'text-muted')}>
              {moedaCompacta(saldo)}
            </span>
          </div>
        )
      },
    },
  ]

  return (
    <div className="mx-auto flex max-w-[1360px] flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="eyebrow mb-2">Execução financeira</div>
          <h1 className="text-[26px] leading-tight">Orçamento</h1>
          <p className="mt-1.5 max-w-[72ch] text-[13px] text-muted">
            Dotação, empenho, liquidação e pagamento das {acoes.length} ações do {orgao.sigla}. O
            que sobra em cada degrau tem nome próprio — e dono diferente.
          </p>
        </div>
        <BotaoExportar nome={`orcamento-${orgao.sigla}`} itens={acoes} colunas={colunasAcao} />
      </header>

      {/* Relógio de fim de exercício: a única coisa que muda o comportamento da
          casa a partir de setembro. */}
      <Panel
        className={cn(
          'grid grid-cols-1 lg:grid-cols-[1.1fr_1fr_1fr_1.4fr] gap-6 px-6 py-5',
          fim.emRisco ? 'border-alert/30 bg-alert/[0.04]' : 'border-teal/25 bg-teal/[0.03]',
        )}
      >
        <div className="flex items-center gap-4">
          <CalendarClock size={26} className={fim.emRisco ? 'text-alert' : 'text-teal'} />
          <div>
            <div className="eyebrow mb-1">Até 31 de dezembro</div>
            <div className="num text-[30px] leading-none font-medium text-ink">
              {fim.diasUteis}
              <span className="ml-1.5 text-[13px] text-muted">dias úteis</span>
            </div>
            <div className="mt-1.5 text-[11.5px] text-faint">{fim.diasCorridos} dias corridos</div>
          </div>
        </div>
        <Numero
          rotulo="Saldo a empenhar"
          valor={moedaCompacta(fim.saldoAEmpenhar)}
          tom="gold"
          detalhe="Volta ao Tesouro se não for empenhado"
        />
        <Numero
          rotulo="Ritmo necessário"
          valor={`${moedaCompacta(fim.ritmoNecessario)}/dia`}
          tom={fim.emRisco ? 'alert' : 'teal'}
          detalhe={`Ritmo observado no ano: ${moedaCompacta(fim.ritmoAtual)}/dia útil`}
        />
        <div className="flex flex-col justify-center gap-2">
          <div className="flex items-center gap-2">
            {fim.emRisco ? (
              <AlertTriangle size={14} className="shrink-0 text-alert" />
            ) : (
              <Wallet size={14} className="shrink-0 text-teal" />
            )}
            <span className="text-[12.5px] text-ink">
              {fim.emRisco
                ? 'O ritmo atual não fecha a conta'
                : 'O ritmo atual dá conta do saldo'}
            </span>
          </div>
          <p className="text-[11.5px] leading-relaxed text-muted">
            {fim.emRisco
              ? `Seria preciso empenhar ${(fim.ritmoNecessario / Math.max(fim.ritmoAtual, 1)).toFixed(1)}× o ritmo praticado até aqui. Sem acelerar, sobra dotação na virada.`
              : 'Mantido o ritmo do exercício, o saldo é empenhado antes do encerramento.'}
          </p>
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-4">
        <Panel>
          <PanelHeader
            eyebrow="Funil"
            titulo="Do que foi autorizado ao que chegou ao proponente"
            acao={
              <span className="num text-[12px] text-teal">
                {(funil.execucao * 100).toFixed(0)}% pago
              </span>
            }
          />
          <div className="px-5 py-5">
            <FunilExecucao degraus={funil.degraus} />
            <p className="mt-4 border-t border-line-soft pt-3 text-[11.5px] leading-relaxed text-muted">
              Passe o cursor em cada degrau para ver o que ele significa na prática. O degrau que
              mais dói muda com o calendário: em agosto é o saldo a empenhar; em janeiro, o
              empenhado a liquidar.
            </p>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            eyebrow="Risco"
            titulo="O que tende a virar restos a pagar"
            acao={<span className="num text-[12px] text-gold">{moedaCompacta(restos.total)}</span>}
          />
          <div className="flex flex-col gap-3.5 px-5 py-5">
            {restos.faixas.map((f) => (
              <div key={f.rotulo}>
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <span className="text-[12.5px] text-ink">{f.rotulo}</span>
                  <span className="num text-[12px] text-muted">
                    {moedaCompacta(f.valor)}
                    <span className="ml-2 text-faint">{f.qtd} empenhos</span>
                  </span>
                </div>
                <Medidor valor={restos.total > 0 ? f.valor / restos.total : 0} tom={f.tom} />
                <p className="mt-1 text-[11px] text-faint">{f.explicacao}</p>
              </div>
            ))}
          </div>

          {restos.criticos.length > 0 && (
            <div className="border-t border-line px-5 py-4">
              <div className="eyebrow mb-2.5">Empenhos acima de 180 dias sem liquidar</div>
              <ul className="flex flex-col gap-2">
                {restos.criticos.slice(0, 5).map((c) => (
                  <li key={c.proposta.id} className="flex items-center gap-3">
                    <button
                      onClick={() => navegar(`/propostas/${c.proposta.id}`)}
                      className="num shrink-0 text-[12px] text-ink hover:text-gold"
                    >
                      {c.proposta.numero}
                    </button>
                    <span className="min-w-0 flex-1 truncate text-[11.5px] text-muted">
                      {getProponente(c.proposta.proponenteId)?.nome}
                    </span>
                    <span className="num shrink-0 text-[11.5px] text-alert">
                      {moedaCompacta(c.valor)}
                    </span>
                    <span className="num w-12 shrink-0 text-right text-[11px] text-faint">
                      {c.dias}d
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>

      {/* Simulador: mexer no controle recalcula o efeito no saldo, na hora. */}
      <Panel>
        <PanelHeader
          eyebrow="Simulador"
          titulo="Quanto do saldo eu zero empenhando as maiores"
          acao={
            <Badge tom={simulacao.cobertura >= 1 ? 'teal' : 'gold'}>
              {(simulacao.cobertura * 100).toFixed(0)}% do saldo coberto
            </Badge>
          }
        />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.35fr] gap-6 px-5 py-5">
          <div>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <span className="text-[12.5px] text-muted">
                Empenhar as <span className="num text-ink">{quantidade}</span> maiores propostas
                prontas
              </span>
              <span className="num text-[11.5px] text-faint">
                {candidatas.length} disponíveis
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(candidatas.length, 1)}
              value={quantidade}
              onChange={(e) => setQuantidade(Number(e.target.value))}
              className="w-full accent-[var(--color-gold)]"
              aria-label="Quantidade de propostas a empenhar na simulação"
            />

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Numero
                rotulo="Valor selecionado"
                valor={moedaCompacta(simulacao.valorTotal)}
                tom="gold"
              />
              <Numero rotulo="Saldo antes" valor={moedaCompacta(simulacao.saldoAntes)} tom="inert" />
              <Numero
                rotulo="Saldo depois"
                valor={moedaCompacta(simulacao.saldoDepois)}
                tom={simulacao.saldoDepois === 0 ? 'teal' : 'alert'}
              />
            </div>

            <div className="mt-4">
              <Medidor valor={simulacao.cobertura} tom={simulacao.cobertura >= 1 ? 'teal' : 'gold'} altura={8} />
            </div>

            <p className="mt-4 text-[11.5px] leading-relaxed text-muted">
              A simulação usa as propostas aprovadas ou celebradas que ainda não têm nota de
              empenho, da maior para a menor. Nada é empenhado de verdade — é conta de quanto o
              saldo cairia.
            </p>

            <Botao
              variante="primario"
              className="mt-4"
              disabled={simulacao.selecionadas.length === 0}
              onClick={() =>
                abrirLote({
                  ritoId: 'rt-documento',
                  titulo: 'Gerar minutas de empenho da seleção',
                  propostaIds: simulacao.selecionadas.map((c) => c.proposta.id),
                })
              }
            >
              <Play size={12} fill="currentColor" /> Preparar as {simulacao.selecionadas.length}{' '}
              minutas
            </Botao>
          </div>

          <div className="max-h-[340px] overflow-y-auto rounded-lg border border-line">
            <ul className="divide-y divide-line-soft">
              {simulacao.selecionadas.map((c, i) => (
                <li key={c.proposta.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="num w-5 shrink-0 text-[11px] text-faint">{i + 1}</span>
                  <button
                    onClick={() => navegar(`/propostas/${c.proposta.id}`)}
                    className="num shrink-0 text-[12px] text-ink hover:text-gold"
                  >
                    {c.proposta.numero}
                  </button>
                  <span className="min-w-0 flex-1 truncate text-[11.5px] text-muted">
                    {getProponente(c.proposta.proponenteId)?.nome}
                  </span>
                  <span className="num shrink-0 text-[12px] text-gold">
                    {moedaCompacta(c.valor)}
                  </span>
                </li>
              ))}
              {simulacao.selecionadas.length === 0 && (
                <li className="px-4 py-10 text-center text-[12.5px] text-muted">
                  Arraste o controle para escolher quantas propostas entram na conta.
                </li>
              )}
            </ul>
          </div>
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <PanelHeader
          eyebrow="Detalhe"
          titulo="Execução por ação orçamentária"
          acao={
            <span className="num text-[12px] text-muted">
              Dotação total {moeda(funil.dotacao)}
            </span>
          }
        />
        <Tabela
          itens={acoes}
          colunas={colunasAcao}
          chave={(a) => a.id}
          ordemInicial={{ coluna: 'dotacao', direcao: 'desc' }}
          destaque={(a) => a.dotacao > 0 && (a.dotacao - a.empenhado) / a.dotacao > 0.4}
        />
      </Panel>

      <p className="text-center text-[11px] text-faint">
        {numero(candidatas.length)} propostas prontas para empenho · nenhuma nota é emitida por
        esta plataforma
      </p>
    </div>
  )
}
