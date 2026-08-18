import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  Minimize2,
  Pause,
  Play,
  Radio,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { useApp } from '@/store/app'
import { auditoriaDoOrgao, diligenciasDoOrgao, getOrgao, getProponente, resumoOrgao } from '@/data/repo'
import { fimDeExercicio, funilDoOrgao } from '@/dominio/orcamento'
import { carteiraDeVigencias, diasAte, resumoPrestacoes } from '@/dominio/ciclo'
import { filaDoDia } from '@/dominio/riscos'
import { resumoEmendas } from '@/dominio/emendas'
import { cn, desde, moedaCompacta, numero } from '@/lib/format'
import { Panel } from '@/components/ui'
import { Medidor } from '@/components/dados'
import { FunilExecucao, SerieTemporal } from '@/components/charts'
import { MapaTerritorial } from '@/components/MapaTerritorial'

/**
 * Sala de situação.
 *
 * Painel de parede: sem menu, sem filtro, tipografia grande o bastante para ser
 * lida do fundo da sala. Fica ligado durante a reunião inteira.
 *
 * A diferença entre uma sala de situação e um painel comum é a hierarquia. Um
 * painel mostra tudo com o mesmo peso e deixa a leitura por conta de quem olha;
 * uma sala de situação **decide o que é a coisa mais urgente agora** e escreve
 * isso em letra grande no alto. Quem entra na sala no meio da reunião tem que
 * entender o estado do órgão em três segundos, de pé, a cinco metros da tela.
 */

const SEGUNDOS_POR_RECORTE = 11

interface Recorte {
  id: string
  titulo: string
  legenda: string
}

const RECORTES: Recorte[] = [
  {
    id: 'execucao',
    titulo: 'Execução orçamentária',
    legenda: 'Onde o dinheiro para em cada degrau, do empenho ao pagamento',
  },
  {
    id: 'entrada',
    titulo: 'Entrada de propostas',
    legenda: 'O volume que chega mês a mês — e o que ele exige de análise',
  },
  {
    id: 'territorio',
    titulo: 'Distribuição territorial',
    legenda: 'Onde o recurso sob gestão está, por unidade da federação',
  },
]

export function SalaSituacao() {
  const { orgaoId } = useApp()
  const navegar = useNavigate()
  const orgao = getOrgao(orgaoId)!
  const [relogio, setRelogio] = useState(new Date())
  const [destaque, setDestaque] = useState(0)
  const [rodando, setRodando] = useState(true)
  const [restante, setRestante] = useState(SEGUNDOS_POR_RECORTE)

  useEffect(() => {
    const t = setInterval(() => setRelogio(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Rodízio do painel central com contagem à vista: numa parede, ver quanto
  // falta para virar evita a sensação de que a tela travou.
  useEffect(() => {
    if (!rodando) return
    const t = setInterval(() => {
      setRestante((r) => {
        if (r > 1) return r - 1
        setDestaque((d) => (d + 1) % RECORTES.length)
        return SEGUNDOS_POR_RECORTE
      })
    }, 1000)
    return () => clearInterval(t)
  }, [rodando])

  const irPara = useCallback((i: number) => {
    setDestaque(i)
    setRestante(SEGUNDOS_POR_RECORTE)
  }, [])

  const resumo = useMemo(() => resumoOrgao(orgaoId), [orgaoId])
  const funil = useMemo(() => funilDoOrgao(orgaoId), [orgaoId])
  const fim = useMemo(() => fimDeExercicio(orgaoId), [orgaoId])
  const contas = useMemo(() => resumoPrestacoes(orgaoId), [orgaoId])
  const emendas = useMemo(() => resumoEmendas(orgaoId), [orgaoId])
  const fila = useMemo(() => filaDoDia(orgaoId, 7), [orgaoId])
  const vigencias = useMemo(() => carteiraDeVigencias(orgaoId), [orgaoId])
  const diligencias = useMemo(() => diligenciasDoOrgao(orgaoId), [orgaoId])
  const trilha = useMemo(() => auditoriaDoOrgao(orgaoId).slice(0, 14), [orgaoId])

  const vencendo30 = vigencias.filter(
    (v) => v.situacao.diasRestantes >= 0 && v.situacao.diasRestantes <= 30,
  ).length

  // Vigência encerrada em convênio que já foi para prestação de contas é o
  // curso normal do instrumento, não pendência. O que alarma é o que continua
  // em execução com o prazo vencido — aí não há amparo para pagar.
  const vencidasEmExecucao = vigencias.filter(
    (v) => v.situacao.diasRestantes < 0 && v.proposta.situacao === 'Em execução',
  ).length
  const diligenciasVencidas = diligencias.filter(
    (d) => !d.respondidaEm && diasAte(d.prazo) < 0,
  ).length

  /**
   * A manchete.
   *
   * Uma sala de situação precisa responder "o que é o problema agora" antes de
   * qualquer número. A ordem abaixo é a de gravidade real na vida do órgão:
   * prazo legal perdido vem antes de prazo apertado, e prazo apertado vem
   * antes de ritmo insuficiente — que ainda dá para corrigir.
   */
  const manchete = useMemo(() => {
    if (diligenciasVencidas > 0)
      return {
        tom: 'alert' as const,
        titulo: `${diligenciasVencidas} diligências com prazo vencido`,
        detalhe:
          'O proponente perdeu o prazo de resposta. Cada uma exige decisão do gestor: prorrogar ou arquivar.',
      }
    if (vencidasEmExecucao > 0)
      return {
        tom: 'alert' as const,
        titulo: `${vencidasEmExecucao} convênios em execução com vigência vencida`,
        detalhe:
          'Instrumento fora da vigência não admite pagamento. O aditivo tem que ser retroativo, com justificativa, ou o saldo se perde.',
      }
    if (contas.atrasadas > 0)
      return {
        tom: 'alert' as const,
        titulo: `${contas.atrasadas} prestações de contas em atraso`,
        detalhe: `${contas.proponentesBloqueados} proponentes ficam impedidos de receber repasse novo enquanto não regularizarem.`,
      }
    if (vencendo30 > 0)
      return {
        tom: 'gold' as const,
        titulo: `${vencendo30} convênios vencem em 30 dias`,
        detalhe: 'Aditivo pedido depois do vencimento não retroage sem justificativa formal.',
      }
    if (fim.emRisco)
      return {
        tom: 'gold' as const,
        titulo: `${moedaCompacta(fim.saldoAEmpenhar)} a empenhar em ${fim.diasUteis} dias úteis`,
        detalhe: `Manter o ritmo atual devolve recurso ao Tesouro. O necessário é ${moedaCompacta(fim.ritmoNecessario)} por dia útil.`,
      }
    return {
      tom: 'teal' as const,
      titulo: 'Nenhum prazo legal estourado na carteira',
      detalhe: 'Vigências, prestações e diligências estão dentro dos prazos. A fila abaixo é a ordem do dia.',
    }
  }, [diligenciasVencidas, vencidasEmExecucao, contas, vencendo30, fim])

  const razaoRitmo = fim.ritmoAtual > 0 ? fim.ritmoNecessario / fim.ritmoAtual : 0

  return (
    <div className="min-h-screen bg-abyss px-4 py-5 sm:px-8 sm:py-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <div className="eyebrow mb-2 flex items-center gap-2">
            <Radio size={11} className="animate-pulse text-teal" />
            Sala de situação · {orgao.sigla}
          </div>
          <h1 className="text-[26px] leading-tight sm:text-[34px] sm:leading-none">{orgao.nome}</h1>
          <p className="mt-2 text-[13px] text-muted">{orgao.unidadeGestora}</p>
        </div>
        <div className="flex flex-1 items-end justify-between gap-6 sm:flex-none sm:justify-start sm:gap-8">
          <div className="text-right">
            <div className="num text-[30px] leading-none font-medium text-ink sm:text-[38px]">
              {relogio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="mt-1.5 text-[12px] text-muted">
              {relogio.toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
              })}
            </div>
          </div>
          <button
            onClick={() => navegar('/')}
            className="nao-imprimir flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-[12px] text-muted hover:text-ink"
          >
            <Minimize2 size={13} /> Sair
          </button>
        </div>
      </header>

      {/* A manchete — o que a sala precisa saber antes de qualquer número */}
      <Panel
        className={cn(
          'mb-4 flex items-start gap-4 px-5 py-4 sm:px-7 sm:py-5',
          manchete.tom === 'alert'
            ? 'border-alert/35 bg-alert/[0.06]'
            : manchete.tom === 'gold'
              ? 'border-gold/35 bg-gold/[0.05]'
              : 'border-teal/30 bg-teal/[0.04]',
        )}
      >
        <AlertTriangle
          size={22}
          className={cn(
            'mt-0.5 shrink-0',
            manchete.tom === 'alert'
              ? 'text-alert'
              : manchete.tom === 'gold'
                ? 'text-gold'
                : 'text-teal',
          )}
        />
        <div className="min-w-0">
          <div className="eyebrow mb-1.5">Agora</div>
          <h2
            className={cn(
              'text-[19px] leading-tight sm:text-[24px]',
              manchete.tom === 'alert'
                ? 'text-alert'
                : manchete.tom === 'gold'
                  ? 'text-gold'
                  : 'text-teal',
            )}
          >
            {manchete.titulo}
          </h2>
          <p className="mt-1.5 max-w-[92ch] text-[13px] leading-relaxed text-muted">
            {manchete.detalhe}
          </p>
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:gap-4">
        <Grande rotulo="Propostas" valor={numero(resumo.totalPropostas)} tom="ink" />
        <Grande rotulo="Valor da carteira" valor={moedaCompacta(resumo.valorGlobal)} tom="gold" />
        <Grande rotulo="Empenhado" valor={moedaCompacta(funil.empenhado)} tom="teal" />
        <Grande
          rotulo="Saldo a empenhar"
          valor={moedaCompacta(fim.saldoAEmpenhar)}
          tom={fim.emRisco ? 'alert' : 'gold'}
        />
        <Grande rotulo="Automações" valor={numero(resumo.automacoesExecutadas)} tom="cleo" />
        <Grande rotulo="Horas devolvidas" valor={numero(resumo.horasEconomizadas)} tom="cleo" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Panel className="flex flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-5 py-3.5 sm:px-6">
            <div className="min-w-0">
              <div className="eyebrow">{RECORTES[destaque].titulo}</div>
              <p className="mt-1 truncate text-[11.5px] text-faint">
                {RECORTES[destaque].legenda}
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setRodando((v) => !v)}
                className="nao-imprimir text-faint transition-colors hover:text-ink"
                aria-label={rodando ? 'Pausar o rodízio' : 'Retomar o rodízio'}
                title={rodando ? 'Pausar o rodízio' : 'Retomar o rodízio'}
              >
                {rodando ? <Pause size={13} /> : <Play size={13} fill="currentColor" />}
              </button>
              {RECORTES.map((r, i) => (
                <button
                  key={r.id}
                  onClick={() => irPara(i)}
                  className={cn(
                    'h-1 w-7 overflow-hidden rounded-full transition-colors',
                    destaque === i ? 'bg-line' : 'bg-line hover:bg-[#2c3c58]',
                  )}
                  aria-label={`Ver ${r.titulo}`}
                >
                  {/* A barra que enche mostra quando vira — parede parada
                      parece parede travada. */}
                  {destaque === i && (
                    <span
                      className="block h-full rounded-full bg-gold transition-[width] duration-1000 ease-linear"
                      style={{
                        width: `${((SEGUNDOS_POR_RECORTE - restante) / SEGUNDOS_POR_RECORTE) * 100}%`,
                      }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 px-5 py-5 sm:px-6">
            {destaque === 0 && <FunilExecucao degraus={funil.degraus} />}
            {destaque === 1 && <SerieTemporal dados={resumo.serieMensal} altura={230} />}
            {destaque === 2 && <MapaTerritorial itens={resumo.porUf} altura={230} />}
          </div>
        </Panel>

        <div className="flex flex-col gap-4">
          {/* O relógio do exercício com veredito, não só com número */}
          <Panel
            className={cn(
              'px-5 py-4 sm:px-6',
              fim.emRisco ? 'border-alert/30 bg-alert/[0.05]' : 'border-teal/25',
            )}
          >
            <div className="mb-2 flex items-center gap-2">
              <CalendarClock size={14} className={fim.emRisco ? 'text-alert' : 'text-teal'} />
              <span className="eyebrow">Fim de exercício</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="num text-[30px] leading-none font-medium text-ink">
                {fim.diasUteis}
              </span>
              <span className="text-[13px] text-muted">dias úteis até 31/12</span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-3.5">
              <div>
                <div className="eyebrow mb-1">Ritmo atual</div>
                <div className="num text-[15px] whitespace-nowrap text-ink">
                  {moedaCompacta(fim.ritmoAtual)}
                  <span className="text-[11px] text-faint">/dia</span>
                </div>
              </div>
              <div>
                <div className="eyebrow mb-1">Ritmo necessário</div>
                <div
                  className={cn(
                    'num text-[15px] whitespace-nowrap',
                    fim.emRisco ? 'text-alert' : 'text-teal',
                  )}
                >
                  {moedaCompacta(fim.ritmoNecessario)}
                  <span className="text-[11px] text-faint">/dia</span>
                </div>
              </div>
            </div>

            <div
              className={cn(
                'mt-3 flex items-start gap-2 text-[12px] leading-relaxed',
                fim.emRisco ? 'text-alert' : 'text-teal',
              )}
            >
              {fim.emRisco ? (
                <TrendingDown size={13} className="mt-0.5 shrink-0" />
              ) : (
                <TrendingUp size={13} className="mt-0.5 shrink-0" />
              )}
              <span>
                {fim.emRisco
                  ? `Precisa acelerar ${razaoRitmo.toFixed(1)}× o ritmo atual para não devolver saldo.`
                  : 'O ritmo atual cobre o saldo dentro do exercício.'}
              </span>
            </div>
          </Panel>

          <div className="grid grid-cols-2 gap-3 lg:gap-4">
            <Sinal
              rotulo="Vencem em 30 dias"
              valor={vencendo30}
              detalhe={
                vencidasEmExecucao > 0
                  ? `${vencidasEmExecucao} em execução já vencidos`
                  : 'convênios sem aditivo'
              }
              tom={vencendo30 > 0 ? 'alert' : 'teal'}
            />
            <Sinal
              rotulo="Contas em atraso"
              valor={contas.atrasadas}
              detalhe={`${contas.proponentesBloqueados} proponentes travados`}
              tom={contas.atrasadas > 0 ? 'alert' : 'teal'}
            />
            <Sinal
              rotulo="Diligências vencidas"
              valor={diligenciasVencidas}
              detalhe={`de ${diligencias.filter((d) => !d.respondidaEm).length} em aberto`}
              tom={diligenciasVencidas > 0 ? 'alert' : 'teal'}
            />
            <Panel className="px-4 py-3.5 sm:px-5">
              <div className="eyebrow mb-1.5">Emendas executadas</div>
              <div className="num text-[24px] leading-none text-gold">
                {(emendas.execucao * 100).toFixed(0)}%
              </div>
              <div className="mt-2.5">
                <Medidor valor={emendas.execucao} tom="gold" altura={4} />
              </div>
            </Panel>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Panel className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-5 py-3 sm:px-6">
            <Activity size={13} className="text-cleo" />
            <span className="eyebrow">Fila de prioridade agora</span>
            <span className="ml-auto text-[11px] text-faint">
              ordenada por risco, prazo consumido e valor
            </span>
          </div>
          <ul className="divide-y divide-line-soft">
            {fila.slice(0, 5).map((item, i) => {
              const critico = item.alertas.some((a) => a.severidade === 'critico')
              return (
                <li
                  key={item.proposta.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5 sm:flex-nowrap sm:px-6"
                >
                  <span
                    className={cn(
                      'num flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px]',
                      critico ? 'border-alert/45 text-alert' : 'border-line text-faint',
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="num shrink-0 text-[12.5px] text-ink">
                    {item.proposta.numero}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-muted">
                    {getProponente(item.proposta.proponenteId)?.municipio}
                  </span>
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate text-[12px]',
                      critico ? 'text-alert' : 'text-gold',
                    )}
                  >
                    {item.motivo}
                  </span>
                  <span className="num shrink-0 text-[12.5px] whitespace-nowrap text-gold">
                    {moedaCompacta(item.proposta.valorGlobal)}
                  </span>
                </li>
              )
            })}
          </ul>
        </Panel>

        {/* O pulso: prova de que a plataforma está viva enquanto a sala conversa */}
        <Panel className="flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-5 py-3 sm:px-6">
            <Radio size={12} className="animate-pulse text-teal" />
            <span className="eyebrow">Pulso do órgão</span>
          </div>
          <ul className="max-h-[248px] flex-1 divide-y divide-line-soft overflow-y-auto">
            {trilha.map((e) => (
              <li key={e.id} className="flex items-start gap-3 px-5 py-2 sm:px-6">
                <span
                  className={cn(
                    'mt-1.5 size-1.5 shrink-0 rounded-full',
                    e.ator === 'Cleo' ? 'bg-cleo' : 'bg-inert',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] text-ink">
                    <span className={e.ator === 'Cleo' ? 'text-cleo' : 'text-muted'}>{e.ator}</span>{' '}
                    {e.acao.toLowerCase()}
                  </div>
                  <div className="num truncate text-[10.5px] text-faint">{e.alvo}</div>
                </div>
                <span className="shrink-0 text-[10.5px] whitespace-nowrap text-faint">
                  {desde(e.data)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <p className="mt-5 text-center text-[11px] text-faint">
        Dados da carteira do {orgao.sigla} · plataforma de apresentação, sem execução real no
        TransfereGov ou no SEI
      </p>
    </div>
  )
}

function Grande({
  rotulo,
  valor,
  tom,
}: {
  rotulo: string
  valor: string
  tom: 'ink' | 'gold' | 'teal' | 'cleo' | 'alert'
}) {
  const cores = {
    ink: 'text-ink',
    gold: 'text-gold',
    teal: 'text-teal',
    cleo: 'text-cleo',
    alert: 'text-alert',
  }
  return (
    <Panel className="px-4 py-3.5 sm:px-5 sm:py-4">
      <div className="eyebrow mb-2">{rotulo}</div>
      <div
        className={cn(
          'num text-[21px] leading-none font-medium tracking-tight whitespace-nowrap sm:text-[25px]',
          cores[tom],
        )}
      >
        {valor}
      </div>
    </Panel>
  )
}

/** Sinal de risco: zero é notícia boa e merece ficar verde, não cinza. */
function Sinal({
  rotulo,
  valor,
  detalhe,
  tom,
}: {
  rotulo: string
  valor: number
  detalhe: string
  tom: 'alert' | 'teal'
}) {
  return (
    <Panel className={cn('px-4 py-3.5 sm:px-5', tom === 'alert' && 'border-alert/25')}>
      <div className="eyebrow mb-1.5">{rotulo}</div>
      <div
        className={cn('num text-[24px] leading-none', tom === 'alert' ? 'text-alert' : 'text-teal')}
      >
        {valor}
      </div>
      <div className="mt-1.5 text-[11px] text-faint">{detalhe}</div>
    </Panel>
  )
}
