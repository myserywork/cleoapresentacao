import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronRight, Loader2, Terminal, X } from 'lucide-react'
import { useApp } from '@/store/app'
import { MINUTAS, getOrgao, getProponente, getProposta } from '@/data/repo'
import { ROTULO_GATILHO, montarRoteiro, type ContextoSimulacao } from '@/simulacao/roteiros'
import { useSimulacao } from '@/simulacao/useSimulacao'
import { TelaSimulada } from './TelaSimulada'
import { Badge, Botao } from '@/components/ui'
import { cn, moeda } from '@/lib/format'

/** Pausa entre etapas do rito, para o resultado de cada uma ser lido. */
const PAUSA_ENTRE_ETAPAS_MS = 1400

function cronometro(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export function ModalAutomacao() {
  const { execucaoAtiva } = useApp()
  if (!execucaoAtiva) return null
  return <Conteudo key={`${execucaoAtiva.propostaId}-${execucaoAtiva.fila.join('-')}`} />
}

function Conteudo() {
  const { execucaoAtiva, fecharExecucao, registrarExecucao, notificar } = useApp()
  const { propostaId, fila, titulo } = execucaoAtiva!
  const proposta = getProposta(propostaId)!
  const proponente = getProponente(proposta.proponenteId)!
  const orgao = getOrgao(proposta.orgaoId)!

  const [etapa, setEtapa] = useState(0)
  const [resultados, setResultados] = useState<string[]>([])
  const [mostrarLog, setMostrarLog] = useState(false)
  const [tempoAcumulado, setTempoAcumulado] = useState(0)
  const registrado = useRef<Set<number>>(new Set())

  const emRito = fila.length > 1

  const ctx = useMemo<ContextoSimulacao>(() => {
    const numProcesso =
      proposta.numProcessoSei ??
      `${orgao.id === 'midr' ? '59000' : orgao.id === 'mpa' ? '00350' : '21000'}.${String(
        100000 + ((proposta.id.length * 7919) % 899999),
      )}/2026-41`
    return {
      numeroProposta: proposta.numero,
      proponente: proponente.nome,
      uf: proponente.uf,
      objeto: proposta.objeto,
      programa: proposta.programa,
      numProcesso,
      orgaoSigla: orgao.sigla,
      unidade: orgao.unidadeGestora.split('—')[1]?.trim() ?? orgao.unidadeGestora,
      valorRepasse: moeda(proposta.valorRepasse),
      valorGlobal: moeda(proposta.valorGlobal),
      contrapartida: moeda(proposta.valorContrapartida),
      minuta: MINUTAS[0].nome,
      bloco: 'Análise de propostas — 2026',
      usuarioSei: 'cleopatra.rpa',
      documentoGerado: String(41200000 + ((proposta.numero.length * 1327) % 99999)),
    }
  }, [proposta, proponente, orgao])

  const roteiro = useMemo(() => montarRoteiro(fila[etapa], ctx), [fila, etapa, ctx])
  const sim = useSimulacao(roteiro)
  const passo = roteiro.passos[sim.indice]
  const ultimaEtapa = etapa === fila.length - 1
  const tudoConcluido = sim.terminado && ultimaEtapa

  const logRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [sim.logs.length])

  // Ao terminar uma etapa: registra, guarda o resultado e emenda a seguinte.
  useEffect(() => {
    if (!sim.terminado || registrado.current.has(etapa)) return
    registrado.current.add(etapa)

    const duracao = roteiro.passos.reduce((s, p) => s + p.duracaoMs, 0)
    setTempoAcumulado((t) => t + duracao)
    setResultados((r) => [...r, roteiro.resultado(ctx as unknown as Record<string, string>)])
    registrarExecucao({
      id: `sessao-${Date.now()}-${etapa}`,
      gatilho: fila[etapa],
      propostaId,
      status: 'SUCESSO',
      criadoEm: new Date().toISOString(),
      duracaoMs: duracao,
      usuario: 'Você',
    })

    notificar({
      tipo: 'automacao',
      titulo: ROTULO_GATILHO[fila[etapa]],
      detalhe: `Proposta ${proposta.numero} · ${proponente.nome}`,
      href: `/propostas/${propostaId}`,
    })

    if (!ultimaEtapa) {
      const id = window.setTimeout(() => setEtapa((e) => e + 1), PAUSA_ENTRE_ETAPAS_MS)
      return () => window.clearTimeout(id)
    }
  }, [sim.terminado, etapa, roteiro, ctx, fila, propostaId, ultimaEtapa, registrarExecucao, notificar, proposta.numero, proponente.nome])

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fecharExecucao()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [fecharExecucao])

  const tempoTotal = tempoAcumulado + (sim.terminado ? 0 : sim.tempoDecorridoMs)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-abyss/85 p-2 backdrop-blur-sm sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo ?? roteiro.titulo}
        className="panel flex h-[min(740px,96vh)] w-[min(1220px,98vw)] flex-col overflow-hidden bg-surface shadow-2xl"
      >
        <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-3 sm:gap-6 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2.5">
              <span className="eyebrow">
                {emRito ? `Rito completo · etapa ${etapa + 1} de ${fila.length}` : 'Automação em execução'}
              </span>
              {tudoConcluido ? (
                <Badge tom="teal" ponto>
                  Concluída
                </Badge>
              ) : (
                <Badge tom="cleo" ponto>
                  Executando
                </Badge>
              )}
            </div>
            <h2 className="truncate text-[17px]">{titulo ?? roteiro.titulo}</h2>
            <p className="num mt-1 truncate text-[12px] text-muted">
              Proposta {proposta.numero} · {proponente.nome}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="eyebrow mb-0.5">Tempo</div>
              <div className="num text-[19px] text-ink">{cronometro(tempoTotal)}</div>
            </div>
            <button
              onClick={fecharExecucao}
              aria-label="Fechar"
              className="rounded-lg p-2 text-muted transition-colors hover:bg-white/5 hover:text-ink"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Trilha do rito: mostra a orquestração inteira, não só a etapa atual */}
        {emRito && (
          <div className="flex items-center gap-1.5 border-b border-line px-6 py-3">
            {fila.map((g, i) => (
              <div key={`${g}-${i}`} className="flex min-w-0 flex-1 items-center gap-2">
                <span
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-full border text-[9px]',
                    i < etapa || tudoConcluido
                      ? 'border-teal bg-teal/15 text-teal'
                      : i === etapa
                        ? 'border-cleo bg-cleo/15 text-cleo'
                        : 'border-line text-faint',
                  )}
                >
                  {i < etapa || tudoConcluido ? <Check size={11} strokeWidth={3} /> : i + 1}
                </span>
                <span
                  className={cn(
                    'truncate text-[11.5px]',
                    i <= etapa || tudoConcluido ? 'text-ink' : 'text-faint',
                  )}
                >
                  {ROTULO_GATILHO[g]}
                </span>
                {i < fila.length - 1 && (
                  <span
                    className={cn(
                      'h-px flex-1',
                      i < etapa || tudoConcluido ? 'bg-teal/40' : 'bg-line',
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* No celular a tela simulada vem primeiro — é o que a sala veio ver.
            O roteiro de passos desce para baixo dela, rolável. */}
        <div className="flex min-h-0 flex-1 flex-col-reverse md:flex-row">
          <aside className="flex max-h-[38%] shrink-0 flex-col border-t border-line md:max-h-none md:w-[310px] md:border-t-0 md:border-r">
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <ol className="flex flex-col">
                {roteiro.passos.map((p, i) => {
                  const concluido = i < sim.indice || sim.terminado
                  const atual = i === sim.indice && !sim.terminado
                  return (
                    <li key={p.id} className="flex gap-3 pb-4 last:pb-0">
                      <div className="flex flex-col items-center">
                        <span
                          className={cn(
                            'flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                            concluido && 'border-teal bg-teal/15 text-teal',
                            atual && 'border-cleo bg-cleo/15 text-cleo',
                            !concluido && !atual && 'border-line text-faint',
                          )}
                        >
                          {concluido ? (
                            <Check size={12} strokeWidth={3} />
                          ) : atual ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <span className="num text-[9px]">{i + 1}</span>
                          )}
                        </span>
                        {i < roteiro.passos.length - 1 && (
                          <span
                            className={cn(
                              'mt-1 w-px flex-1 transition-colors',
                              concluido ? 'bg-teal/40' : 'bg-line',
                            )}
                          />
                        )}
                      </div>
                      <div className="min-w-0 pb-1">
                        <div
                          className={cn(
                            'text-[13px] transition-colors',
                            concluido || atual ? 'text-ink' : 'text-faint',
                          )}
                        >
                          {p.rotulo}
                        </div>
                        <div className="mt-0.5 text-[11.5px] leading-snug text-muted">
                          {p.detalhe}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </div>

            <button
              onClick={() => setMostrarLog((v) => !v)}
              className="flex items-center gap-2 border-t border-line px-5 py-3 text-[12px] text-muted transition-colors hover:text-ink"
            >
              <Terminal size={13} />
              <span className="flex-1 text-left">Log técnico</span>
              <ChevronRight
                size={14}
                className={cn('transition-transform', mostrarLog && 'rotate-90')}
              />
            </button>
            {mostrarLog && (
              <div
                ref={logRef}
                className="h-[168px] overflow-y-auto border-t border-line bg-abyss/60 px-5 py-3"
              >
                {sim.logs.map((l, i) => (
                  <div key={i} className="num text-[10.5px] leading-relaxed text-muted">
                    <span className="text-faint">›</span> {l}
                  </div>
                ))}
              </div>
            )}
          </aside>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col p-3 md:p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="eyebrow">O que a Cleo está vendo</span>
              <span className="text-[11.5px] text-muted">
                {passo.cena.sistema} · passo {Math.min(sim.indice + 1, roteiro.passos.length)} de{' '}
                {roteiro.passos.length}
              </span>
            </div>
            <div className="min-h-0 flex-1">
              <TelaSimulada cena={passo.cena} duracaoMs={passo.duracaoMs} />
            </div>
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-line px-4 py-3 sm:flex-nowrap sm:px-6 sm:py-4">
          {tudoConcluido ? (
            <>
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-teal/15 text-teal">
                  <Check size={15} strokeWidth={3} />
                </span>
                <div className="min-w-0">
                  {resultados.map((r, i) => (
                    <p key={i} className="truncate text-[13px] text-ink">
                      {r}
                    </p>
                  ))}
                </div>
              </div>
              <Botao variante="primario" onClick={fecharExecucao}>
                Concluir
              </Botao>
            </>
          ) : (
            <>
              <p className="text-[12.5px] text-muted">
                Você pode fechar esta janela — a automação segue até o fim.
              </p>
              <Botao variante="fantasma" onClick={sim.concluir}>
                Avançar até o resultado
              </Botao>
            </>
          )}
        </footer>
      </div>
    </div>
  )
}
