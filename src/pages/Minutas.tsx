import { useMemo, useState } from 'react'
import { Braces, Eye, FileText, User } from 'lucide-react'
import { useApp } from '@/store/app'
import { MINUTAS, getProponente, propostasDoOrgao } from '@/data/repo'
import type { Minuta } from '@/data/types'
import { cn, moeda, numero } from '@/lib/format'
import { Badge, Panel, PanelHeader } from '@/components/ui'

/**
 * Minutas.
 *
 * A minuta é o ativo do órgão: é ela que transforma dado em documento assinável.
 * A pré-visualização usa uma proposta real justamente porque campo calculado só
 * revela seu comportamento quando encontra um caso concreto.
 */

/** Resolve os campos da minuta contra uma proposta, como o worker faria. */
function resolver(minuta: Minuta, ctx: Record<string, string>): { campo: string; valor: string }[] {
  return minuta.campos.map((c) => ({
    campo: c.nome,
    valor: ctx[c.nome] ?? (c.origem === 'usuario' ? '— preenchido no disparo —' : '—'),
  }))
}

export function Minutas() {
  const { orgaoId } = useApp()
  const [selecionada, setSelecionada] = useState(MINUTAS[0].id)

  const propostas = useMemo(() => propostasDoOrgao(orgaoId), [orgaoId])
  const exemplo = propostas.find((p) => p.numProcessoSei) ?? propostas[0]
  const proponente = exemplo ? getProponente(exemplo.proponenteId) : undefined
  const minuta = MINUTAS.find((m) => m.id === selecionada)!

  const contexto = useMemo<Record<string, string>>(() => {
    if (!exemplo) return {} as Record<string, string>
    const pct = (exemplo.valorContrapartida / exemplo.valorGlobal) * 100
    return {
      programa: exemplo.programa,
      fundamentoLegal: exemplo.fundamentoLegal,
      valorGlobal: moeda(exemplo.valorGlobal),
      percentualContrapartida: `${pct.toFixed(1)}%`,
      valorRepasseExtenso: `${moeda(exemplo.valorRepasse)} (por extenso na geração)`,
      prazoResposta: '15 dias úteis a contar do recebimento',
    }
  }, [exemplo])

  const resolvidos = resolver(minuta, contexto)

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-5">
      <header>
        <div className="eyebrow mb-2">Documentos</div>
        <h1 className="text-[26px] leading-tight">Minutas</h1>
        <p className="mt-1.5 max-w-[680px] text-[13px] leading-relaxed text-muted">
          Modelos que a Cleo usa para gerar documentos no SEI. Campos de usuário são preenchidos no
          momento do disparo; campos internos são calculados a partir da própria proposta.
        </p>
      </header>

      <div className="grid grid-cols-[300px_1fr] gap-4">
        <Panel className="overflow-hidden">
          <div className="border-b border-line px-4 py-2.5">
            <span className="eyebrow">{MINUTAS.length} modelos</span>
          </div>
          <ul>
            {MINUTAS.map((m) => (
              <li key={m.id}>
                <button
                  onClick={() => setSelecionada(m.id)}
                  className={cn(
                    'flex w-full flex-col items-start gap-1 border-b border-line-soft px-4 py-3 text-left transition-colors last:border-0',
                    m.id === selecionada ? 'bg-gold/[0.07]' : 'hover:bg-white/[0.025]',
                  )}
                >
                  <span className="flex w-full items-center gap-2">
                    <FileText size={13} className="shrink-0 text-faint" />
                    <span className="flex-1 truncate text-[13px] text-ink">{m.nome}</span>
                  </span>
                  <span className="flex items-center gap-2 pl-[21px]">
                    <Badge tom="inert">{m.tipo}</Badge>
                    <span className="num text-[10.5px] text-faint">{numero(m.usos)} usos</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel>
            <PanelHeader
              eyebrow={minuta.tipo}
              titulo={minuta.nome}
              acao={<span className="num text-[12px] text-muted">{numero(minuta.usos)} documentos gerados</span>}
            />
            <div className="px-5 py-5">
              <p className="mb-5 text-[13px] leading-relaxed text-muted">{minuta.descricao}</p>

              <div className="eyebrow mb-3">Campos</div>
              <ul className="flex flex-col gap-2.5">
                {minuta.campos.map((c) => {
                  const resolvido = resolvidos.find((r) => r.campo === c.nome)
                  return (
                    <li
                      key={c.nome}
                      className="flex items-start gap-3 rounded-lg border border-line bg-abyss/30 px-3.5 py-3"
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md',
                          c.origem === 'interno' ? 'bg-cleo/15 text-cleo' : 'bg-gold/15 text-gold',
                        )}
                      >
                        {c.origem === 'interno' ? <Braces size={12} /> : <User size={12} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="num text-[12.5px] text-ink">{c.nome}</span>
                          <Badge tom={c.origem === 'interno' ? 'cleo' : 'gold'}>
                            {c.origem === 'interno' ? 'calculado' : 'do usuário'}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-[11.5px] text-muted">{c.descricao}</p>
                        {resolvido && (
                          <p className="num mt-1.5 text-[11.5px] text-teal">→ {resolvido.valor}</p>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>

              <p className="mt-4 border-t border-line pt-3.5 text-[11.5px] leading-relaxed text-faint">
                Campos calculados rodam isolados, sem acesso a rede ou disco, com limite de tempo e
                memória. Um campo que trava é interrompido e reportado, sem derrubar a execução.
              </p>
            </div>
          </Panel>

          {exemplo && (
            <Panel>
              <PanelHeader
                eyebrow="Pré-visualização"
                titulo={`Aplicada à proposta ${exemplo.numero}`}
                acao={
                  <span className="flex items-center gap-1.5 text-[12px] text-muted">
                    <Eye size={13} /> exemplo real da carteira
                  </span>
                }
              />
              <div className="px-5 py-5">
                <div className="mx-auto max-w-[540px] rounded-lg bg-white px-8 py-6 shadow-lg">
                  <div className="mb-4 border-b border-[#e2e2e2] pb-3 text-center">
                    <div className="text-[8px] leading-tight text-[#555]">
                      MINISTÉRIO DA INTEGRAÇÃO E DO DESENVOLVIMENTO REGIONAL
                    </div>
                  </div>
                  <div className="mb-4 text-center text-[11px] font-bold tracking-wide text-[#111]">
                    {minuta.nome.toUpperCase()}
                  </div>
                  <div className="flex flex-col gap-2 text-[9px] leading-[1.7] text-[#222]">
                    <p className="text-justify">
                      Referência: Proposta nº {exemplo.numero}, apresentada por {proponente?.nome} (
                      {proponente?.uf}), no âmbito do programa{' '}
                      <mark className="bg-[#fff3c4] px-0.5">{contexto.programa}</mark>.
                    </p>
                    <p className="text-justify">Objeto: {exemplo.objeto}.</p>
                    <p className="text-justify">
                      O valor global pactuado é de{' '}
                      <mark className="bg-[#fff3c4] px-0.5">{contexto.valorGlobal}</mark>, cabendo ao
                      proponente contrapartida de{' '}
                      <mark className="bg-[#fff3c4] px-0.5">{contexto.percentualContrapartida}</mark>{' '}
                      do total, nos termos do{' '}
                      <mark className="bg-[#fff3c4] px-0.5">{contexto.fundamentoLegal}</mark>.
                    </p>
                    <p className="text-justify">
                      Analisada a documentação apresentada, verifica-se o atendimento aos requisitos
                      de habilitação e a compatibilidade do objeto com a finalidade do programa.
                    </p>
                  </div>
                  <div className="mt-6 text-center">
                    <div className="mx-auto mb-1 h-px w-[170px] bg-[#cbd5e0]" />
                    <div className="text-[8px] text-[#4a5568]">Assinatura eletrônica no SEI</div>
                  </div>
                </div>
                <p className="mt-3.5 text-center text-[11.5px] text-faint">
                  Os trechos destacados vêm de campos resolvidos automaticamente.
                </p>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}
