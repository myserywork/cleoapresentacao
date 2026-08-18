import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Clock, Play, Timer } from 'lucide-react'
import { useApp } from '@/store/app'
import { automacoesDaProposta, getOrgao, getProponente } from '@/data/repo'
import {
  aderenciaSla,
  alertas,
  filaDoDia,
  prazo,
  SLA_POR_SITUACAO,
  TOM_SEVERIDADE,
} from '@/dominio/riscos'
import { proximaAcao } from '@/dominio/saude'
import { cn, moedaCompacta, numero } from '@/lib/format'
import { Badge, Botao, Panel, PanelHeader, SituacaoBadge } from '@/components/ui'

/**
 * Meu dia.
 *
 * A carteira é do órgão; o dia é da pessoa. Esta tela responde à única pergunta
 * que o analista faz ao abrir o sistema — "por onde eu começo?" — ordenando por
 * risco, prazo consumido e valor, nessa ordem de peso.
 */
export function MeuDia() {
  const { orgaoId, abrirExecucao } = useApp()
  const orgao = getOrgao(orgaoId)!

  const fila = useMemo(() => filaDoDia(orgaoId, 12), [orgaoId])
  const sla = useMemo(() => aderenciaSla(orgaoId), [orgaoId])

  const totalForaDoPrazo = sla.reduce((s, x) => s + x.fora, 0)
  const totalComSla = sla.reduce((s, x) => s + x.total, 0)
  const aderenciaGeral = totalComSla > 0 ? 1 - totalForaDoPrazo / totalComSla : 1

  const criticos = fila.filter((i) => i.alertas.some((a) => a.severidade === 'critico')).length

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <div className="eyebrow mb-2">Sua fila</div>
          <h1 className="text-[26px] leading-tight">Meu dia</h1>
          <p className="mt-1.5 text-[13px] text-muted">
            As doze propostas do {orgao.sigla} que mais pedem atenção agora, por risco, prazo e
            valor.
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="eyebrow mb-1">Fora do prazo</div>
            <div className="num text-[20px] text-alert">{numero(totalForaDoPrazo)}</div>
          </div>
          <div className="text-right">
            <div className="eyebrow mb-1">Aderência ao prazo</div>
            <div
              className={cn(
                'num text-[20px]',
                aderenciaGeral >= 0.8 ? 'text-teal' : aderenciaGeral >= 0.6 ? 'text-gold' : 'text-alert',
              )}
            >
              {(aderenciaGeral * 100).toFixed(0)}%
            </div>
          </div>
        </div>
      </header>

      {criticos > 0 && (
        <Panel className="flex items-center gap-4 border-alert/25 bg-alert/[0.05] px-5 py-3">
          <AlertTriangle size={15} className="shrink-0 text-alert" />
          <p className="flex-1 text-[12.5px] text-muted">
            <span className="text-ink">{criticos} propostas com alerta crítico</span> — contrapartida
            abaixo do mínimo, empenho acima do repasse ou habilitação incompleta em fase avançada.
          </p>
        </Panel>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
        <Panel className="overflow-hidden">
          <PanelHeader eyebrow="Prioridade" titulo="Por onde começar" />
          <ol className="divide-y divide-line-soft">
            {fila.map((item, i) => {
              const proponente = getProponente(item.proposta.proponenteId)
              const feitos = new Set(
                automacoesDaProposta(item.proposta.id)
                  .filter((a) => a.status === 'SUCESSO')
                  .map((a) => a.gatilho),
              )
              const proxima = proximaAcao(item.proposta, feitos)
              const critico = item.alertas.find((a) => a.severidade === 'critico')

              return (
                <li key={item.proposta.id} className="flex items-start gap-4 px-5 py-4">
                  <span className="num mt-0.5 w-5 shrink-0 text-[12px] text-faint">{i + 1}</span>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Link
                        to={`/propostas/${item.proposta.id}`}
                        className="num text-[13px] text-ink hover:text-gold"
                      >
                        {item.proposta.numero}
                      </Link>
                      <SituacaoBadge situacao={item.proposta.situacao} />
                      {item.alertas.slice(0, 2).map((a) => (
                        <Badge key={a.id} tom={TOM_SEVERIDADE[a.severidade]}>
                          {a.rotulo}
                        </Badge>
                      ))}
                    </div>

                    <div className="truncate text-[12px] text-muted">{proponente?.nome}</div>

                    <div className="mt-1.5 flex items-center gap-2 text-[11.5px]">
                      <ArrowRight size={12} className="shrink-0 text-cleo" />
                      <span className="text-muted">
                        Próxima ação: <span className="text-ink">{proxima.titulo}</span>
                      </span>
                    </div>

                    {critico && (
                      <p className="mt-1.5 text-[11px] text-alert">{critico.detalhe}</p>
                    )}
                  </div>

                  <div className="w-[112px] shrink-0 text-right">
                    <div className="num text-[12.5px] text-gold">
                      {moedaCompacta(item.proposta.valorGlobal)}
                    </div>
                    <div
                      className={cn(
                        'num mt-1 flex items-center justify-end gap-1 text-[11px]',
                        item.prazo.estourado ? 'text-alert' : 'text-faint',
                      )}
                    >
                      <Timer size={10} />
                      {item.prazo.estourado
                        ? `${item.prazo.decorrido - item.prazo.limite}d além`
                        : `${Math.max(item.prazo.restante, 0)}d restantes`}
                    </div>
                    <Botao
                      tamanho="sm"
                      variante="primario"
                      className="mt-2 w-full"
                      onClick={() =>
                        abrirExecucao({
                          propostaId: item.proposta.id,
                          fila: proxima.rito ?? [proxima.gatilho!],
                          titulo: proxima.rito ? 'Rito completo de instrução' : undefined,
                        })
                      }
                    >
                      <Play size={11} fill="currentColor" /> Resolver
                    </Botao>
                  </div>
                </li>
              )
            })}
          </ol>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel>
            <PanelHeader eyebrow="Prazo" titulo="Aderência por fase" />
            <ul className="flex flex-col gap-3 px-5 py-5">
              {sla.map((s) => (
                <li key={s.situacao}>
                  <div className="mb-1 flex items-baseline justify-between gap-3">
                    <span className="truncate text-[12.5px] text-ink">{s.situacao}</span>
                    <span
                      className={cn(
                        'num shrink-0 text-[12px]',
                        s.aderencia >= 0.8
                          ? 'text-teal'
                          : s.aderencia >= 0.6
                            ? 'text-gold'
                            : 'text-alert',
                      )}
                    >
                      {(s.aderencia * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="rounded-l-full bg-teal"
                      style={{ width: `${(s.dentro / s.total) * 100}%` }}
                    />
                    <div
                      className="flex-1 rounded-r-full bg-alert/70"
                      style={{ width: `${(s.fora / s.total) * 100}%` }}
                    />
                  </div>
                  {/* O prazo de cada fase é parâmetro do órgão, não regra fixa nossa */}
                  <div className="num mt-1 text-[10.5px] text-faint">
                    {s.dentro} no prazo · {s.fora} fora · prazo de{' '}
                    {SLA_POR_SITUACAO[s.situacao]} dias
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Como priorizamos" titulo="A regra da fila" />
            <div className="px-5 py-5">
              <ul className="flex flex-col gap-2.5 text-[12.5px] text-muted">
                <li className="flex items-start gap-2.5">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0 text-alert" />
                  <span>
                    <span className="text-ink">Alerta crítico</span> pesa 40 pontos; alerta de
                    atenção, 18.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Clock size={13} className="mt-0.5 shrink-0 text-gold" />
                  <span>
                    <span className="text-ink">Prazo consumido</span> vale até 30 pontos, conforme a
                    fase.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 text-[13px] text-teal">R$</span>
                  <span>
                    <span className="text-ink">Valor</span> vale até 15 — de propósito menos que
                    risco: proposta pequena irregular passa na frente de proposta grande em dia.
                  </span>
                </li>
              </ul>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}

export { alertas, prazo }
