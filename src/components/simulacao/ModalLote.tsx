import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, Loader2, Pause, Play, RotateCcw, X } from 'lucide-react'
import { useApp } from '@/store/app'
import { getProponente, getProposta } from '@/data/repo'
import { cn, duracao } from '@/lib/format'
import { Badge, Botao, Panel } from '@/components/ui'
import { Medidor } from '@/components/dados'

type Estado = 'fila' | 'executando' | 'concluido' | 'falha'

interface ItemLote {
  propostaId: string
  estado: Estado
  progresso: number
  passo: number
  /** Falha simulada; a retomada segue do passo exato, não do começo. */
  falhou: boolean
  tentativas: number
}

const TICK_MS = 120

/**
 * Execução em lote.
 *
 * O mesmo rito sobre várias propostas, com concorrência controlada. O que
 * interessa mostrar não é a barra andando: é que uma falha isolada não derruba
 * o lote e que a retomada volta do passo exato — a diferença entre RPA de
 * brinquedo e RPA que roda de madrugada sem ninguém olhando.
 */
export function ModalLote() {
  const { loteAtivo, fecharLote, ritos, notificar, registrarAuditoria } = useApp()
  const rito = useMemo(
    () => ritos.find((r) => r.id === loteAtivo?.ritoId) ?? ritos[0],
    [ritos, loteAtivo],
  )

  const [itens, setItens] = useState<ItemLote[]>([])
  const [concorrencia, setConcorrencia] = useState(4)
  const [pausado, setPausado] = useState(false)
  const [decorrido, setDecorrido] = useState(0)
  const avisado = useRef(false)

  useEffect(() => {
    if (!loteAtivo) return
    avisado.current = false
    setDecorrido(0)
    setPausado(false)
    setItens(
      loteAtivo.propostaIds.map((propostaId, i) => ({
        propostaId,
        estado: 'fila',
        progresso: 0,
        passo: 0,
        // Falha a cada nove itens: frequência realista de sessão expirada.
        falhou: i > 0 && i % 9 === 0,
        tentativas: 0,
      })),
    )
  }, [loteAtivo])

  const totalPassos = rito?.passos.length ?? 4

  useEffect(() => {
    if (!loteAtivo || pausado) return
    const timer = setInterval(() => {
      setDecorrido((d) => d + TICK_MS)
      setItens((prev) => {
        const executando = prev.filter((i) => i.estado === 'executando').length
        let vagas = Math.max(concorrencia - executando, 0)

        return prev.map((item) => {
          if (item.estado === 'fila' && vagas > 0) {
            vagas--
            return { ...item, estado: 'executando' as Estado }
          }
          if (item.estado !== 'executando') return item

          // Passo do rito avança em fatias irregulares: execução real não é linear.
          const incremento = 0.055 + ((item.propostaId.length % 5) * 0.008)
          const progresso = item.progresso + incremento
          const passo = Math.min(Math.floor(progresso * totalPassos), totalPassos - 1)

          if (item.falhou && item.tentativas === 0 && progresso >= 0.55) {
            return { ...item, estado: 'falha' as Estado, progresso: 0.55, passo }
          }
          if (progresso >= 1) {
            return { ...item, estado: 'concluido' as Estado, progresso: 1, passo: totalPassos - 1 }
          }
          return { ...item, progresso, passo }
        })
      })
    }, TICK_MS)
    return () => clearInterval(timer)
  }, [loteAtivo, pausado, concorrencia, totalPassos])

  const concluidos = itens.filter((i) => i.estado === 'concluido').length
  const falhas = itens.filter((i) => i.estado === 'falha').length
  const emCurso = itens.filter((i) => i.estado === 'executando').length
  const terminou = itens.length > 0 && concluidos + falhas === itens.length

  useEffect(() => {
    if (!terminou || avisado.current || !loteAtivo || !rito) return
    avisado.current = true
    notificar({
      tipo: 'automacao',
      titulo: `Lote concluído — ${rito.nome}`,
      detalhe: `${concluidos} de ${itens.length} propostas processadas${falhas > 0 ? `, ${falhas} com falha para retomar` : ''}.`,
    })
    registrarAuditoria({
      tipo: 'automacao',
      ator: 'Você',
      acao: `Executou em lote "${rito.nome}"`,
      alvo: `${itens.length} propostas`,
      detalhe: `${concluidos} concluídas, ${falhas} com falha. Concorrência de ${concorrencia} execuções simultâneas.`,
    })
  }, [terminou, concluidos, falhas, itens.length, loteAtivo, rito, notificar, registrarAuditoria, concorrencia])

  if (!loteAtivo || !rito) return null

  function retomar(propostaId: string) {
    setItens((prev) =>
      prev.map((i) =>
        i.propostaId === propostaId
          ? { ...i, estado: 'executando', tentativas: i.tentativas + 1 }
          : i,
      ),
    )
  }

  function retomarTodas() {
    setItens((prev) =>
      prev.map((i) =>
        i.estado === 'falha' ? { ...i, estado: 'executando', tentativas: i.tentativas + 1 } : i,
      ),
    )
  }

  const progressoGeral = itens.length
    ? itens.reduce((s, i) => s + (i.estado === 'concluido' ? 1 : i.progresso), 0) / itens.length
    : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-abyss/85 p-3 backdrop-blur-sm sm:p-6">
      <Panel className="flex max-h-[92vh] w-full max-w-[900px] flex-col overflow-hidden bg-surface sm:max-h-[86vh]">
        <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3.5 sm:px-6 sm:py-4">
          <div>
            <div className="eyebrow mb-1.5">Execução em lote · {rito.nome}</div>
            <h3 className="text-[17px]">{loteAtivo.titulo}</h3>
            <p className="mt-1 text-[12px] text-muted">
              {itens.length} propostas · {rito.passos.length} passos cada · nada é enviado ao SEI
              nem ao TransfereGov
            </p>
          </div>
          <button onClick={fecharLote} className="text-faint hover:text-ink" aria-label="Fechar">
            <X size={17} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-line px-4 py-3.5 sm:flex-nowrap sm:px-6">
          <div className="min-w-[220px] flex-1">
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="text-[12px] text-muted">
                <span className="num text-ink">{concluidos}</span> de{' '}
                <span className="num">{itens.length}</span> concluídas
                {emCurso > 0 && <span className="ml-2 text-cleo">{emCurso} em curso</span>}
                {falhas > 0 && <span className="ml-2 text-alert">{falhas} com falha</span>}
              </span>
              <span className="num text-[11.5px] text-faint">{duracao(decorrido)}</span>
            </div>
            <Medidor valor={progressoGeral} tom={falhas > 0 ? 'gold' : 'teal'} altura={7} />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <label className="eyebrow">Concorrência</label>
            <input
              type="range"
              min={1}
              max={8}
              value={concorrencia}
              onChange={(e) => setConcorrencia(Number(e.target.value))}
              className="w-20 accent-[var(--color-cleo)]"
              aria-label="Execuções simultâneas"
            />
            <span className="num w-4 text-[12px] text-ink">{concorrencia}</span>
          </div>

          <Botao tamanho="sm" variante="fantasma" onClick={() => setPausado((p) => !p)}>
            {pausado ? <Play size={11} fill="currentColor" /> : <Pause size={11} />}
            {pausado ? 'Retomar' : 'Pausar'}
          </Botao>
        </div>

        <ul className="flex-1 divide-y divide-line-soft overflow-y-auto">
          {itens.map((item) => {
            const proposta = getProposta(item.propostaId)
            const proponente = proposta && getProponente(proposta.proponenteId)
            return (
              <li
                key={item.propostaId}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:flex-nowrap sm:px-6"
              >
                <span className="w-4 shrink-0">
                  {item.estado === 'concluido' && <Check size={14} className="text-teal" />}
                  {item.estado === 'falha' && <AlertTriangle size={14} className="text-alert" />}
                  {item.estado === 'executando' && (
                    <Loader2 size={14} className="animate-spin text-cleo" />
                  )}
                  {item.estado === 'fila' && (
                    <span className="block size-1.5 rounded-full bg-inert" />
                  )}
                </span>

                <span className="num w-[118px] shrink-0 text-[12px] text-ink">
                  {proposta?.numero}
                </span>

                <span className="min-w-0 flex-1 truncate text-[11.5px] text-muted">
                  {proponente?.nome}
                </span>

                {/* No celular passo e progresso descem para a segunda linha;
                    no desktop `contents` desmancha o invólucro e eles voltam
                    a ser colunas da mesma linha. */}
                <div className="order-last flex w-full items-center gap-3 sm:order-none sm:contents">
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate text-[11.5px] sm:w-[210px] sm:flex-none sm:shrink-0',
                      item.estado === 'falha' ? 'text-alert' : 'text-faint',
                    )}
                  >
                    {item.estado === 'fila'
                      ? 'na fila'
                      : item.estado === 'falha'
                        ? 'sessão do SEI expirada'
                        : rito.passos[item.passo]?.rotulo}
                  </span>

                  <div className="w-[110px] shrink-0">
                    <Medidor
                      valor={item.progresso}
                      tom={
                        item.estado === 'falha'
                          ? 'alert'
                          : item.estado === 'concluido'
                            ? 'teal'
                            : 'cleo'
                      }
                      altura={4}
                    />
                  </div>
                </div>

                <span className="w-[86px] shrink-0 text-right">
                  {item.estado === 'falha' ? (
                    <Botao tamanho="sm" variante="fantasma" onClick={() => retomar(item.propostaId)}>
                      <RotateCcw size={10} /> Retomar
                    </Botao>
                  ) : item.tentativas > 0 && item.estado === 'concluido' ? (
                    <Badge tom="cleo">retomada</Badge>
                  ) : null}
                </span>
              </li>
            )
          })}
        </ul>

        <div className="flex items-center justify-between gap-4 border-t border-line px-6 py-4">
          <p className="max-w-[54ch] text-[11.5px] leading-relaxed text-muted">
            {falhas > 0
              ? 'A falha isola o item: o lote continua e a retomada volta do passo em que parou, sem refazer o que já deu certo.'
              : terminou
                ? 'Lote encerrado. O registro de cada execução ficou na trilha de auditoria.'
                : 'A concorrência define quantas execuções correm ao mesmo tempo. Em produção, o limite vem da sessão do SEI.'}
          </p>
          <div className="flex gap-2">
            {falhas > 0 && (
              <Botao variante="secundario" onClick={retomarTodas}>
                <RotateCcw size={12} /> Retomar as {falhas}
              </Botao>
            )}
            <Botao variante={terminou ? 'primario' : 'fantasma'} onClick={fecharLote}>
              {terminou ? 'Concluir' : 'Fechar'}
            </Botao>
          </div>
        </div>
      </Panel>
    </div>
  )
}
