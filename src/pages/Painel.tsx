import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Banknote, FileCheck2, Landmark, Timer } from 'lucide-react'
import { useApp } from '@/store/app'
import { getOrgao, resumoOrgao } from '@/data/repo'
import type { SituacaoProposta } from '@/data/types'
import { moedaCompacta, numero } from '@/lib/format'
import {
  BarraComposicao,
  BarrasHorizontais,
  DistribuicaoSituacao,
  Indicador,
  SerieTemporal,
} from '@/components/charts'
import { Panel, PanelHeader, TOM_SITUACAO } from '@/components/ui'
import { MapaTerritorial } from '@/components/MapaTerritorial'
import { FeedAtividade } from '@/components/FeedAtividade'
import { fimDeExercicio } from '@/dominio/orcamento'
import { carteiraDeVigencias, resumoPrestacoes } from '@/dominio/ciclo'
import { resumoEmendas } from '@/dominio/emendas'
import { cn } from '@/lib/format'

/** Cartão de sinal: um número, o que ele significa e para onde ir resolver. */
function Sinal({
  para,
  eyebrow,
  valor,
  rotulo,
  detalhe,
  tom,
}: {
  para: string
  eyebrow: string
  valor: string
  rotulo: string
  detalhe: string
  tom: 'gold' | 'alert' | 'teal' | 'cleo'
}) {
  const cores = {
    gold: 'text-gold',
    alert: 'text-alert',
    teal: 'text-teal',
    cleo: 'text-cleo',
  }
  return (
    <Link
      to={para}
      className={cn(
        'panel group px-5 py-4 transition-colors hover:border-[#2c3c58]',
        tom === 'alert' && 'border-alert/25',
      )}
    >
      <div className="eyebrow mb-2 flex items-center justify-between">
        {eyebrow}
        <ArrowUpRight size={12} className="opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className={cn('num text-[22px] leading-none font-medium', cores[tom])}>{valor}</span>
        <span className="text-[12px] text-muted">{rotulo}</span>
      </div>
      <div className="mt-2 text-[11.5px] text-faint">{detalhe}</div>
    </Link>
  )
}

const COR_VIZ: Record<string, string> = {
  teal: 'var(--color-viz-teal)',
  gold: 'var(--color-viz-gold)',
  cleo: 'var(--color-viz-cleo)',
  inert: 'var(--color-viz-inert)',
  alert: 'var(--color-viz-alert)',
}

const CORES_SITUACAO: Record<string, string> = Object.fromEntries(
  Object.entries(TOM_SITUACAO).map(([situacao, tom]) => [situacao, COR_VIZ[tom]]),
)

/**
 * Fita de trâmite — onde está cada proposta do órgão neste momento.
 *
 * É o retrato mais característico do trabalho: a carteira inteira distribuída
 * pelas fases, numa faixa só. Substitui o "número grande" genérico de abertura.
 */
function FitaDeTramite({
  dados,
  total,
}: {
  dados: { situacao: SituacaoProposta; qtd: number; valor: number }[]
  total: number
}) {
  const [ativo, setAtivo] = useState<string | null>(null)
  const visiveis = dados.filter((d) => d.qtd > 0)

  return (
    <div>
      <div className="flex h-[74px] gap-1" onMouseLeave={() => setAtivo(null)}>
        {visiveis.map((d) => {
          const pct = (d.qtd / total) * 100
          const destacado = ativo === d.situacao
          return (
            <button
              key={d.situacao}
              onMouseEnter={() => setAtivo(d.situacao)}
              className="group relative min-w-0 overflow-hidden rounded-[5px] text-left transition-[flex-grow] duration-500"
              style={{ flex: `${pct} 1 0%` }}
              aria-label={`${d.situacao}: ${d.qtd} propostas`}
            >
              <span
                className="absolute inset-0 transition-opacity duration-200"
                style={{
                  background: CORES_SITUACAO[d.situacao],
                  opacity: ativo && !destacado ? 0.32 : 0.85,
                }}
              />
              <span className="relative flex h-full flex-col justify-between p-2.5">
                <span className="num text-[15px] font-medium text-[#0b1220]">{d.qtd}</span>
                {pct > 9 && (
                  <span className="truncate text-[10.5px] leading-tight font-medium text-[#0b1220]/75">
                    {d.situacao}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex min-h-[18px] items-center gap-4 text-[12px]">
        {ativo ? (
          <>
            <span className="flex items-center gap-2">
              <span
                className="size-2 rounded-full"
                style={{ background: CORES_SITUACAO[ativo] }}
              />
              <span className="text-ink">{ativo}</span>
            </span>
            <span className="num text-muted">
              {visiveis.find((d) => d.situacao === ativo)?.qtd} propostas
            </span>
            <span className="num text-muted">
              {moedaCompacta(visiveis.find((d) => d.situacao === ativo)?.valor ?? 0)}
            </span>
          </>
        ) : (
          <span className="text-faint">
            Passe o mouse por uma faixa para ver o volume e o valor parado nela.
          </span>
        )}
      </div>
    </div>
  )
}

export function Painel() {
  const { orgaoId } = useApp()
  const orgao = getOrgao(orgaoId)!
  const resumo = useMemo(() => resumoOrgao(orgaoId), [orgaoId])

  const emTramite = resumo.porSituacao
    .filter((s) => ['Em análise', 'Em complementação', 'Cadastrada'].includes(s.situacao))
    .reduce((s, x) => s + x.qtd, 0)

  const fim = useMemo(() => fimDeExercicio(orgaoId), [orgaoId])
  const contas = useMemo(() => resumoPrestacoes(orgaoId), [orgaoId])
  const emendas = useMemo(() => resumoEmendas(orgaoId), [orgaoId])
  const vigencias = useMemo(() => carteiraDeVigencias(orgaoId), [orgaoId])
  const vencendo30 = vigencias.filter(
    (v) => v.situacao.diasRestantes >= 0 && v.situacao.diasRestantes <= 30,
  ).length
  const vencidas = vigencias.filter((v) => v.situacao.diasRestantes < 0).length

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-5">
      <header className="flex items-end justify-between gap-6">
        <div>
          <div className="eyebrow mb-2">Painel do órgão</div>
          <h1 className="text-[26px] leading-tight">{orgao.nome}</h1>
          <p className="mt-1.5 text-[13px] text-muted">
            {orgao.unidadeGestora} · {numero(resumo.totalPropostas)} propostas sob gestão
          </p>
        </div>
        <Link
          to="/propostas"
          className="flex items-center gap-1.5 text-[13px] text-gold hover:underline"
        >
          Ver todas as propostas <ArrowUpRight size={15} />
        </Link>
      </header>

      <Panel className="px-5 py-5">
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <div className="eyebrow mb-1">Onde estão as propostas agora</div>
            <h2 className="text-[15px]">Trâmite da carteira</h2>
          </div>
          <div className="text-[12px] text-muted">
            <span className="num text-ink">{emTramite}</span> aguardando decisão
          </div>
        </div>
        <FitaDeTramite dados={resumo.porSituacao} total={resumo.totalPropostas} />
      </Panel>

      <div className="grid grid-cols-4 gap-4">
        <Indicador
          rotulo="Valor global"
          valor={resumo.valorGlobal}
          formato="moeda"
          tom="gold"
          icone={<Banknote size={15} />}
          detalhe={`Repasse ${moedaCompacta(resumo.valorRepasse)}`}
        />
        <Indicador
          rotulo="Empenhado"
          valor={resumo.totalEmpenhado}
          formato="moeda"
          tom="gold"
          icone={<Landmark size={15} />}
          detalhe={`${numero(resumo.qtdEmpenhos)} empenhos emitidos`}
        />
        <Indicador
          rotulo="Processos no SEI"
          valor={resumo.processosSei}
          icone={<FileCheck2 size={15} />}
          detalhe={`${numero(resumo.documentosGerados)} documentos gerados pela Cleo`}
        />
        <Indicador
          rotulo="Horas devolvidas à equipe"
          valor={resumo.horasEconomizadas}
          tom="cleo"
          icone={<Timer size={15} />}
          detalhe={`${numero(resumo.automacoesExecutadas)} automações concluídas`}
        />
      </div>

      {/* Sinais que mudam a semana da coordenação, com o caminho para agir */}
      <div className="grid grid-cols-[1fr_1fr_1fr_1.15fr] gap-4">
        <Sinal
          para="/orcamento"
          eyebrow="Fim de exercício"
          valor={moedaCompacta(fim.saldoAEmpenhar)}
          rotulo="a empenhar"
          detalhe={`${fim.diasUteis} dias úteis · ${moedaCompacta(fim.ritmoNecessario)}/dia`}
          tom={fim.emRisco ? 'alert' : 'gold'}
        />
        <Sinal
          para="/vigencias"
          eyebrow="Vigências"
          valor={numero(vencendo30)}
          rotulo="vencem em 30 dias"
          detalhe={`${vencidas} já com vigência encerrada`}
          tom={vencendo30 > 0 ? 'alert' : 'teal'}
        />
        <Sinal
          para="/contas"
          eyebrow="Prestação de contas"
          valor={numero(contas.atrasadas)}
          rotulo="em atraso"
          detalhe={`${contas.proponentesBloqueados} proponentes travados`}
          tom={contas.atrasadas > 0 ? 'alert' : 'teal'}
        />
        <Sinal
          para="/emendas"
          eyebrow="Emendas"
          valor={`${(emendas.execucao * 100).toFixed(0)}%`}
          rotulo="do indicado empenhado"
          detalhe={`${numero(emendas.totalEmendas)} emendas · ${moedaCompacta(emendas.valorIndicado)}`}
          tom="cleo"
        />
      </div>

      <div className="grid grid-cols-[1.55fr_1fr] gap-4">
        <Panel>
          <PanelHeader eyebrow="Últimos 18 meses" titulo="Entrada de propostas" />
          <div className="px-4 pt-3 pb-2">
            <SerieTemporal dados={resumo.serieMensal} />
          </div>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Carteira" titulo="Composição do valor" />
          <div className="px-5 py-5">
            <BarraComposicao
              segmentos={[
                {
                  rotulo: 'Repasse da União',
                  valor: resumo.valorRepasse,
                  cor: 'var(--color-viz-gold)',
                },
                {
                  rotulo: 'Contrapartida',
                  valor: resumo.valorContrapartida,
                  cor: 'var(--color-viz-teal)',
                },
              ]}
            />
            <div className="mt-6 border-t border-line pt-5">
              <div className="eyebrow mb-3">Execução orçamentária</div>
              <BarraComposicao
                segmentos={[
                  {
                    rotulo: 'Empenhado',
                    valor: resumo.totalEmpenhado,
                    cor: 'var(--color-viz-cleo)',
                  },
                  {
                    rotulo: 'A empenhar',
                    valor: Math.max(resumo.valorRepasse - resumo.totalEmpenhado, 0),
                    cor: 'var(--color-viz-inert)',
                  },
                ]}
              />
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Panel>
          <PanelHeader eyebrow="Fases" titulo="Propostas por situação" />
          <div className="px-5 py-5">
            <DistribuicaoSituacao dados={resumo.porSituacao} cores={CORES_SITUACAO} />
          </div>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Territorial" titulo="Onde está o recurso" />
          <div className="px-5 pt-3 pb-4">
            <MapaTerritorial itens={resumo.porUf} altura={286} />
          </div>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Programas" titulo="Valor por programa" />
          <div className="px-5 py-5">
            <BarrasHorizontais
              itens={resumo.porPrograma.map((p) => ({
                rotulo: p.programa,
                valor: p.valor,
                secundario: `· ${p.qtd}`,
                cor: 'var(--color-viz-gold)',
              }))}
              maxItens={6}
            />
          </div>
        </Panel>
      </div>

      <FeedAtividade altura={300} />
    </div>
  )
}
