import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowUp, Download, Sparkles } from 'lucide-react'
import { useApp } from '@/store/app'
import { getOrgao } from '@/data/repo'
import { paraCsv, responder, type ContextoConversa, type Resposta } from '@/assistente/motor'
import { useExecutor } from '@/comandos/executor'
import { BarrasHorizontais } from '@/components/charts'
import { Botao, Panel } from '@/components/ui'
import { cn } from '@/lib/format'

interface Turno {
  id: number
  pergunta: string
  resposta?: Resposta
}

const SUGESTOES = [
  'Quais propostas estão paradas há 30 dias?',
  'Quanto falta empenhar até dezembro?',
  'Como está a execução das emendas?',
  'Quais convênios vencem nos próximos 30 dias?',
  'Quem está inadimplente na prestação de contas?',
  'Como está a carga da equipe?',
  'Quais diligências passaram do prazo?',
  'Que padrões existem na carteira?',
  'Mostre as dez maiores propostas',
  'Execute o rito completo',
]

/** Atraso curto antes da resposta: réplica instantânea parece pré-gravada. */
const LATENCIA_MS = 620

export function Assistente() {
  const { orgaoId } = useApp()
  const { executar } = useExecutor()
  const orgao = getOrgao(orgaoId)!
  const [params, setParams] = useSearchParams()
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [entrada, setEntrada] = useState('')
  const [pensando, setPensando] = useState(false)
  const contexto = useRef<ContextoConversa>({})
  const fimRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turnos, pensando])

  function perguntar(texto: string) {
    const pergunta = texto.trim()
    if (!pergunta || pensando) return
    const id = Date.now()
    setTurnos((prev) => [...prev, { id, pergunta }])
    setEntrada('')
    setPensando(true)

    window.setTimeout(() => {
      const { resposta, contexto: novo } = responder(pergunta, orgaoId, contexto.current)
      contexto.current = novo
      setTurnos((prev) => prev.map((t) => (t.id === id ? { ...t, resposta } : t)))
      setPensando(false)
      // A resposta não descreve o que faria: a interface se move junto.
      if (resposta.acoes?.length) void executar(resposta.acoes)
    }, LATENCIA_MS)
  }

  // Pergunta vinda da paleta de comando (Ctrl+K)
  const jaPerguntou = useRef(false)
  useEffect(() => {
    const q = params.get('q')
    if (!q || jaPerguntou.current) return
    jaPerguntou.current = true
    perguntar(q)
    params.delete('q')
    setParams(params, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  function exportar(resposta: Resposta) {
    if (!resposta.tabela) return
    const url = URL.createObjectURL(
      new Blob([`﻿${paraCsv(resposta.tabela)}`], { type: 'text/csv;charset=utf-8' }),
    )
    const a = document.createElement('a')
    a.href = url
    a.download = `cleopatra-${orgao.sigla.toLowerCase()}-consulta.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-56px)] max-w-[900px] flex-col">
      <header className="pb-5">
        <div className="eyebrow mb-2">Assistente</div>
        <h1 className="text-[26px] leading-tight">Pergunte à Cleo</h1>
        <p className="mt-1.5 text-[13px] text-muted">
          Ela consulta os dados do {orgao.sigla}, responde na hora — e executa o que você pedir.
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {turnos.length === 0 && (
          <div className="flex flex-col gap-2.5 pt-2">
            <span className="eyebrow">Comece por aqui</span>
            <div className="flex flex-wrap gap-2">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  onClick={() => perguntar(s)}
                  className="rounded-full border border-line bg-raised px-3.5 py-1.5 text-[12.5px] text-muted transition-colors hover:border-cleo/40 hover:text-ink"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-6 py-2">
          {turnos.map((t) => (
            <div key={t.id} className="flex flex-col gap-4">
              <div className="flex justify-end">
                <div className="max-w-[75%] rounded-2xl rounded-br-sm border border-line bg-raised px-4 py-2.5 text-[13.5px] text-ink">
                  {t.pergunta}
                </div>
              </div>

              {t.resposta && (
                <div className="flex gap-3">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-cleo/15 text-cleo">
                    <Sparkles size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] leading-relaxed text-ink">{t.resposta.texto}</p>

                    {t.resposta.destaque && (
                      <div className="mt-3.5 flex flex-wrap gap-2.5">
                        {t.resposta.destaque.map((d) => (
                          <div key={d.rotulo} className="panel px-4 py-3">
                            <div className="eyebrow mb-1">{d.rotulo}</div>
                            <div className="num text-[18px] text-gold">{d.valor}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {t.resposta.grafico && (
                      <Panel className="mt-3.5 px-5 py-4">
                        <div className="eyebrow mb-3">{t.resposta.grafico.titulo}</div>
                        <BarrasHorizontais
                          itens={t.resposta.grafico.itens.map((i) => ({
                            rotulo: i.rotulo,
                            valor: i.valor,
                          }))}
                          formato={t.resposta.grafico.formato}
                          maxItens={10}
                        />
                      </Panel>
                    )}

                    {t.resposta.tabela && (
                      <Panel className="mt-3.5 overflow-hidden">
                        <div className="max-h-[330px] overflow-auto">
                          <table className="w-full">
                            <thead className="sticky top-0 bg-surface">
                              <tr className="border-b border-line">
                                {t.resposta.tabela.colunas.map((c) => (
                                  <th
                                    key={c}
                                    className="eyebrow px-4 py-2.5 text-left font-normal whitespace-nowrap"
                                  >
                                    {c}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {t.resposta.tabela.linhas.map((linha, i) => (
                                <tr key={i} className="border-b border-line-soft last:border-0">
                                  {linha.map((celula, j) => (
                                    <td
                                      key={j}
                                      className={cn(
                                        'px-4 py-2.5 text-[12.5px] whitespace-nowrap',
                                        j === 0 ? 'num text-ink' : 'text-muted',
                                        j === linha.length - 1 && 'num text-right text-gold',
                                      )}
                                    >
                                      {celula}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex items-center justify-between border-t border-line px-4 py-2.5">
                          <span className="text-[11.5px] text-faint">
                            {t.resposta.tabela.linhas.length} linhas
                          </span>
                          <Botao tamanho="sm" onClick={() => exportar(t.resposta!)}>
                            <Download size={12} /> Exportar CSV
                          </Botao>
                        </div>
                      </Panel>
                    )}

                    {/* Ações oferecidas: a Cleo propõe, você decide */}
                    {t.resposta.oferecidas && (
                      <div className="mt-3.5 flex flex-wrap gap-2">
                        {t.resposta.oferecidas.map((o) => (
                          <Botao
                            key={o.rotulo}
                            tamanho="sm"
                            variante={o.destacada ? 'primario' : 'secundario'}
                            onClick={() => void executar(o.acoes)}
                          >
                            {o.rotulo}
                          </Botao>
                        ))}
                      </div>
                    )}

                    {t.resposta.seguintes && (
                      <div className="mt-3.5 flex flex-wrap gap-2">
                        {t.resposta.seguintes.map((s) => (
                          <button
                            key={s}
                            onClick={() => perguntar(s)}
                            className="rounded-full border border-line px-3 py-1 text-[11.5px] text-muted transition-colors hover:border-cleo/40 hover:text-ink"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {pensando && (
            <div className="flex items-center gap-3">
              <span className="flex size-7 items-center justify-center rounded-full bg-cleo/15 text-cleo">
                <Sparkles size={14} />
              </span>
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="size-1.5 animate-bounce rounded-full bg-cleo/70"
                    style={{ animationDelay: `${i * 130}ms` }}
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={fimRef} />
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          perguntar(entrada)
        }}
        className="flex items-center gap-2 border-t border-line py-4"
      >
        <input
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          placeholder={`Pergunte ou mande a Cleo fazer algo no ${orgao.sigla}…`}
          className="h-11 flex-1 rounded-xl border border-line bg-surface px-4 text-[13.5px] text-ink placeholder:text-faint focus:border-cleo/50 focus:outline-none"
          aria-label="Pergunta"
        />
        <button
          type="submit"
          disabled={!entrada.trim() || pensando}
          className="flex size-11 items-center justify-center rounded-xl bg-gold text-[#151003] transition-colors hover:bg-[#eecb74] disabled:opacity-35"
          aria-label="Enviar"
        >
          <ArrowUp size={18} strokeWidth={2.4} />
        </button>
      </form>
    </div>
  )
}
