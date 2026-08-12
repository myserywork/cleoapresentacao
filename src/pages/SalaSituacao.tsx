import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, CalendarClock, Minimize2, Radio } from 'lucide-react'
import { useApp } from '@/store/app'
import { getOrgao, getProponente, resumoOrgao } from '@/data/repo'
import { fimDeExercicio, funilDoOrgao } from '@/dominio/orcamento'
import { carteiraDeVigencias, resumoPrestacoes } from '@/dominio/ciclo'
import { filaDoDia } from '@/dominio/riscos'
import { resumoEmendas } from '@/dominio/emendas'
import { cn, moedaCompacta, numero } from '@/lib/format'
import { Panel } from '@/components/ui'
import { Medidor } from '@/components/dados'
import { FunilExecucao, SerieTemporal } from '@/components/charts'
import { MapaTerritorial } from '@/components/MapaTerritorial'

/**
 * Sala de situação.
 *
 * Painel de parede: sem menu, sem filtro, tipografia grande o bastante para ser
 * lida do fundo da sala. Fica ligado durante a reunião inteira e se atualiza
 * sozinho — a plataforma como infraestrutura, não como tela de trabalho.
 */
export function SalaSituacao() {
  const { orgaoId } = useApp()
  const navegar = useNavigate()
  const orgao = getOrgao(orgaoId)!
  const [relogio, setRelogio] = useState(new Date())
  const [destaque, setDestaque] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setRelogio(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Rodízio do painel central: a sala vê os três recortes sem ninguém clicar.
  useEffect(() => {
    const t = setInterval(() => setDestaque((d) => (d + 1) % 3), 11_000)
    return () => clearInterval(t)
  }, [])

  const resumo = useMemo(() => resumoOrgao(orgaoId), [orgaoId])
  const funil = useMemo(() => funilDoOrgao(orgaoId), [orgaoId])
  const fim = useMemo(() => fimDeExercicio(orgaoId), [orgaoId])
  const contas = useMemo(() => resumoPrestacoes(orgaoId), [orgaoId])
  const emendas = useMemo(() => resumoEmendas(orgaoId), [orgaoId])
  const fila = useMemo(() => filaDoDia(orgaoId, 7), [orgaoId])
  const vigencias = useMemo(() => carteiraDeVigencias(orgaoId), [orgaoId])

  const vencendo30 = vigencias.filter(
    (v) => v.situacao.diasRestantes >= 0 && v.situacao.diasRestantes <= 30,
  ).length

  return (
    <div className="min-h-screen bg-abyss px-8 py-6">
      <header className="mb-6 flex items-end justify-between gap-8">
        <div>
          <div className="eyebrow mb-2 flex items-center gap-2">
            <Radio size={11} className="animate-pulse text-teal" />
            Sala de situação · {orgao.sigla}
          </div>
          <h1 className="text-[34px] leading-none">{orgao.nome}</h1>
          <p className="mt-2 text-[13px] text-muted">{orgao.unidadeGestora}</p>
        </div>
        <div className="flex items-end gap-8">
          <div className="text-right">
            <div className="num text-[38px] leading-none font-medium text-ink">
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

      <div className="grid grid-cols-6 gap-4">
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

      <div className="mt-4 grid grid-cols-[1.5fr_1fr] gap-4">
        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-3.5">
            <div className="eyebrow">
              {destaque === 0
                ? 'Execução orçamentária'
                : destaque === 1
                  ? 'Entrada de propostas'
                  : 'Distribuição territorial'}
            </div>
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <button
                  key={i}
                  onClick={() => setDestaque(i)}
                  className={cn(
                    'h-1 w-6 rounded-full transition-colors',
                    destaque === i ? 'bg-gold' : 'bg-line',
                  )}
                  aria-label={`Ver recorte ${i + 1}`}
                />
              ))}
            </div>
          </div>
          <div className="px-6 py-5">
            {destaque === 0 && <FunilExecucao degraus={funil.degraus} />}
            {destaque === 1 && <SerieTemporal dados={resumo.serieMensal} altura={230} />}
            {destaque === 2 && <MapaTerritorial itens={resumo.porUf} altura={230} />}
          </div>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel
            className={cn(
              'px-6 py-4',
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
            <div className="mt-3 text-[12px] text-muted">
              Ritmo necessário:{' '}
              <span className={cn('num', fim.emRisco ? 'text-alert' : 'text-teal')}>
                {moedaCompacta(fim.ritmoNecessario)}/dia
              </span>
            </div>
          </Panel>

          <div className="grid grid-cols-2 gap-4">
            <Panel className="px-5 py-4">
              <div className="eyebrow mb-1.5">Vencem em 30 dias</div>
              <div className="num text-[24px] leading-none text-alert">{vencendo30}</div>
              <div className="mt-1.5 text-[11px] text-faint">convênios sem aditivo</div>
            </Panel>
            <Panel className="px-5 py-4">
              <div className="eyebrow mb-1.5">Contas em atraso</div>
              <div className="num text-[24px] leading-none text-alert">{contas.atrasadas}</div>
              <div className="mt-1.5 text-[11px] text-faint">
                {contas.proponentesBloqueados} proponentes travados
              </div>
            </Panel>
            <Panel className="px-5 py-4">
              <div className="eyebrow mb-1.5">Emendas</div>
              <div className="num text-[24px] leading-none text-gold">
                {(emendas.execucao * 100).toFixed(0)}%
              </div>
              <div className="mt-2">
                <Medidor valor={emendas.execucao} tom="gold" altura={4} />
              </div>
            </Panel>
            <Panel className="px-5 py-4">
              <div className="eyebrow mb-1.5">Processos no SEI</div>
              <div className="num text-[24px] leading-none text-teal">
                {numero(resumo.processosSei)}
              </div>
              <div className="mt-1.5 text-[11px] text-faint">
                {numero(resumo.documentosGerados)} documentos da Cleo
              </div>
            </Panel>
          </div>
        </div>
      </div>

      <Panel className="mt-4 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-6 py-3">
          <Activity size={13} className="text-cleo" />
          <span className="eyebrow">Fila de prioridade agora</span>
        </div>
        <ul className="grid grid-cols-7 divide-x divide-line-soft">
          {fila.map((item, i) => (
            <li key={item.proposta.id} className="px-4 py-3.5">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="num text-[11px] text-faint">{i + 1}</span>
                <span className="num text-[12px] text-ink">{item.proposta.numero}</span>
              </div>
              <div className="mb-2 truncate text-[11px] text-muted">
                {getProponente(item.proposta.proponenteId)?.municipio}
              </div>
              <div
                className={cn(
                  'truncate text-[11px]',
                  item.alertas.some((a) => a.severidade === 'critico') ? 'text-alert' : 'text-gold',
                )}
              >
                {item.motivo}
              </div>
              <div className="num mt-2 text-[12px] text-gold">
                {moedaCompacta(item.proposta.valorGlobal)}
              </div>
            </li>
          ))}
        </ul>
      </Panel>

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
    <Panel className="px-5 py-4">
      <div className="eyebrow mb-2">{rotulo}</div>
      <div
        className={cn(
          'num text-[25px] leading-none font-medium tracking-tight whitespace-nowrap',
          cores[tom],
        )}
      >
        {valor}
      </div>
    </Panel>
  )
}
