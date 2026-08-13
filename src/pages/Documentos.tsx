import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, CircleDashed, FileText, Layers, Search, Sparkles, Wand2 } from 'lucide-react'
import { useApp } from '@/store/app'
import { MINUTAS, getOrgao, getProponente, propostasDoOrgao } from '@/data/repo'
import { analisar, CORPOS_FABRICA } from '@/dominio/minutas'
import { cn, data, numero } from '@/lib/format'
import { Badge, Botao, Campo, Panel, PanelHeader } from '@/components/ui'
import { Abas, Numero, Medidor } from '@/components/dados'
import type { DocumentoSei, Proposta } from '@/data/types'

/**
 * Documentos.
 *
 * Tudo o que o órgão produziu, num lugar só — com a divisão que importa: o que
 * a Cleo redigiu e o que foi anexado à mão, o que já está assinado e o que
 * dorme no bloco. Clicar num documento abre o papel, não uma ficha.
 */

interface Item {
  doc: DocumentoSei
  proposta: Proposta
}

type Aba = 'todos' | 'bloco' | 'cleo'

export function Documentos() {
  const { orgaoId, abrirLote, abrirExecucao } = useApp()
  const navegar = useNavigate()
  const orgao = getOrgao(orgaoId)!

  const [aba, setAba] = useState<Aba>('todos')
  const [termo, setTermo] = useState('')
  const [tipo, setTipo] = useState<string>('todos')
  const [abertoId, setAbertoId] = useState<string | null>(null)

  const todos = useMemo<Item[]>(() => {
    const itens: Item[] = []
    for (const p of propostasDoOrgao(orgaoId)) {
      for (const d of p.documentos) itens.push({ doc: d, proposta: p })
    }
    return itens.sort((a, b) => b.doc.data.localeCompare(a.doc.data))
  }, [orgaoId])

  const tipos = useMemo(() => [...new Set(todos.map((i) => i.doc.tipo))].sort(), [todos])

  const noBloco = useMemo(() => todos.filter((i) => !i.doc.assinado), [todos])
  const daCleo = useMemo(() => todos.filter((i) => i.doc.geradoPelaCleo), [todos])

  const lista = useMemo(() => {
    const base = aba === 'bloco' ? noBloco : aba === 'cleo' ? daCleo : todos
    const t = termo.trim().toLowerCase()
    return base.filter((i) => {
      if (tipo !== 'todos' && i.doc.tipo !== tipo) return false
      if (!t) return true
      return (
        i.doc.tipo.toLowerCase().includes(t) ||
        i.doc.numero.includes(t) ||
        i.proposta.numero.toLowerCase().includes(t) ||
        (getProponente(i.proposta.proponenteId)?.nome.toLowerCase() ?? '').includes(t)
      )
    })
  }, [aba, termo, tipo, todos, noBloco, daCleo])

  const aberto = lista.find((i) => i.doc.id + i.proposta.id === abertoId) ?? lista[0]
  const fracaoCleo = todos.length > 0 ? daCleo.length / todos.length : 0

  // O papel: se o documento nasceu de minuta, o corpo real preenchido com a
  // proposta dele; senão, a ficha de documento externo.
  const corpoAberto = useMemo(() => {
    if (!aberto?.doc.minutaId) return null
    const corpo = CORPOS_FABRICA[aberto.doc.minutaId]
    if (!corpo) return null
    return analisar(corpo, aberto.proposta)
  }, [aberto])

  const minutaAberta = aberto?.doc.minutaId
    ? MINUTAS.find((m) => m.id === aberto.doc.minutaId)
    : undefined

  return (
    <div className="mx-auto flex max-w-[1460px] flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="eyebrow mb-2">Produção documental</div>
          <h1 className="text-[26px] leading-tight">Documentos</h1>
          <p className="mt-1.5 max-w-[74ch] text-[13px] text-muted">
            {numero(todos.length)} documentos nos processos do {orgao.sigla}. Clicar abre o papel —
            com a origem de cada dado pintada quando o documento nasceu de minuta.
          </p>
        </div>
        {noBloco.length > 0 && (
          <Botao
            variante="primario"
            onClick={() =>
              abrirLote({
                ritoId: 'rt-bloco',
                titulo: `Incluir ${Math.min(noBloco.length, 20)} processos no bloco de assinatura`,
                propostaIds: [...new Set(noBloco.map((i) => i.proposta.id))].slice(0, 20),
              })
            }
          >
            <Layers size={13} /> Levar o bloco à assinatura
          </Botao>
        )}
      </header>

      <div className="grid grid-cols-4 gap-4">
        <Panel className="px-5 py-4">
          <Numero rotulo="Documentos" valor={numero(todos.length)} detalhe="Nos processos do órgão" />
        </Panel>
        <Panel className="px-5 py-4">
          <Numero
            rotulo="Redigidos pela Cleo"
            valor={`${(fracaoCleo * 100).toFixed(0)}%`}
            tom="cleo"
            detalhe={`${numero(daCleo.length)} a partir de minuta`}
          />
          <div className="mt-3">
            <Medidor valor={fracaoCleo} tom="cleo" />
          </div>
        </Panel>
        <Panel className="px-5 py-4">
          <Numero
            rotulo="Assinados"
            valor={numero(todos.length - noBloco.length)}
            tom="teal"
            detalhe="Assinatura eletrônica registrada"
          />
        </Panel>
        <Panel className={cn('px-5 py-4', noBloco.length > 0 && 'border-gold/30 bg-gold/[0.04]')}>
          <Numero
            rotulo="No bloco de assinatura"
            valor={numero(noBloco.length)}
            tom="gold"
            detalhe="Aguardando a chefia assinar"
          />
        </Panel>
      </div>

      <div className="grid grid-cols-[1fr_460px] items-start gap-4">
        <Panel className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 pt-1 pb-3">
            <Abas
              ativa={aba}
              aoTrocar={setAba}
              abas={[
                { id: 'todos', rotulo: 'Todos', contagem: todos.length },
                { id: 'bloco', rotulo: 'Bloco de assinatura', contagem: noBloco.length },
                { id: 'cleo', rotulo: 'Da Cleo', contagem: daCleo.length },
              ]}
            />
            <div className="relative ml-auto w-[220px]">
              <Search size={13} className="absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
              <Campo
                placeholder="Documento, proposta, proponente"
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
                className="h-8 pl-8 text-[12px]"
              />
            </div>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="h-8 rounded-lg border border-line bg-raised px-2 text-[12px] text-ink focus:outline-none"
              aria-label="Filtrar por tipo de documento"
            >
              <option value="todos" className="bg-surface">
                Todos os tipos
              </option>
              {tipos.map((t) => (
                <option key={t} value={t} className="bg-surface">
                  {t}
                </option>
              ))}
            </select>
          </div>

          <ul className="max-h-[620px] divide-y divide-line-soft overflow-y-auto">
            {lista.slice(0, 120).map((i) => {
              const chave = i.doc.id + i.proposta.id
              const selecionado = aberto && chave === aberto.doc.id + aberto.proposta.id
              return (
                <li key={chave}>
                  <button
                    onClick={() => setAbertoId(chave)}
                    className={cn(
                      'flex w-full items-center gap-4 px-5 py-2.5 text-left transition-colors',
                      selecionado ? 'bg-gold/[0.06]' : 'hover:bg-white/[0.03]',
                    )}
                  >
                    {i.doc.geradoPelaCleo ? (
                      <Sparkles size={13} className="shrink-0 text-cleo" />
                    ) : (
                      <FileText size={13} className="shrink-0 text-faint" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[12.5px] text-ink">{i.doc.tipo}</span>
                        <span className="num text-[11px] text-faint">{i.doc.numero}</span>
                      </div>
                      <div className="truncate text-[11px] text-muted">
                        <span className="num">{i.proposta.numero}</span> ·{' '}
                        {getProponente(i.proposta.proponenteId)?.nome}
                      </div>
                    </div>
                    <span className="num shrink-0 text-[11px] text-faint">{data(i.doc.data)}</span>
                    {i.doc.assinado ? (
                      <CheckCircle2 size={13} className="shrink-0 text-teal" />
                    ) : (
                      <CircleDashed size={13} className="shrink-0 text-gold" />
                    )}
                  </button>
                </li>
              )
            })}
            {lista.length === 0 && (
              <li className="px-5 py-12 text-center text-[12.5px] text-muted">
                Nenhum documento com esses filtros.
              </li>
            )}
          </ul>
          {lista.length > 120 && (
            <div className="border-t border-line px-5 py-2.5 text-center text-[11px] text-faint">
              Mostrando 120 de {numero(lista.length)} — refine pela busca.
            </div>
          )}
        </Panel>

        {/* O papel */}
        <Panel className="sticky top-6 overflow-hidden">
          {aberto ? (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  {aberto.doc.geradoPelaCleo ? (
                    <Wand2 size={13} className="shrink-0 text-cleo" />
                  ) : (
                    <FileText size={13} className="shrink-0 text-faint" />
                  )}
                  <span className="truncate text-[13px] text-ink">
                    {aberto.doc.tipo} {aberto.doc.numero}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {aberto.doc.assinado ? (
                    <Badge tom="teal" ponto>
                      assinado
                    </Badge>
                  ) : (
                    <Badge tom="gold" ponto>
                      no bloco
                    </Badge>
                  )}
                </div>
              </div>

              {corpoAberto ? (
                <div className="max-h-[520px] overflow-y-auto bg-[#f4f1ea] px-8 py-7">
                  <div className="mb-5 border-b border-[#c9c2b4] pb-3 text-center">
                    <div className="text-[9px] tracking-[0.2em] text-[#6b6350] uppercase">
                      {orgao.nome}
                    </div>
                  </div>
                  <div className="text-[11.5px] leading-[1.8] whitespace-pre-wrap text-[#2b2618]">
                    {corpoAberto.map((t, idx) =>
                      t.tipo === 'texto' ? (
                        <span key={idx}>{t.texto}</span>
                      ) : (
                        <span
                          key={idx}
                          title={t.variavel}
                          className={cn(
                            'rounded-[3px] px-0.5',
                            t.tipo === 'interno' && 'bg-[#d7ebe3] text-[#0d5c4a]',
                            t.tipo === 'usuario' && 'bg-[#f3e3bb] text-[#7a5a10]',
                            t.tipo === 'desconhecida' && 'bg-[#f3cdc9] text-[#8c2f28]',
                          )}
                        >
                          {t.texto}
                        </span>
                      ),
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 px-8 py-14 text-center">
                  <FileText size={28} className="text-faint" />
                  <p className="max-w-[38ch] text-[12.5px] leading-relaxed text-muted">
                    Documento externo, anexado ao processo — o conteúdo mora no PDF original. O
                    registro guarda tipo, número, data e situação de assinatura.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2 border-t border-line px-5 py-3">
                <Botao tamanho="sm" onClick={() => navegar(`/propostas/${aberto.proposta.id}?aba=Documentos`)}>
                  Abrir a proposta
                </Botao>
                {!aberto.doc.assinado && (
                  <Botao
                    tamanho="sm"
                    variante="primario"
                    onClick={() =>
                      abrirExecucao({
                        propostaId: aberto.proposta.id,
                        fila: ['adicionar_bloco_interno'],
                        titulo: 'Disponibilizar para assinatura',
                      })
                    }
                  >
                    <Layers size={11} /> Levar à assinatura
                  </Botao>
                )}
                {minutaAberta && (
                  <span className="ml-auto truncate text-[10.5px] text-faint">
                    minuta: {minutaAberta.nome}
                  </span>
                )}
              </div>
            </>
          ) : (
            <PanelHeader eyebrow="Documento" titulo="Selecione ao lado" />
          )}
        </Panel>
      </div>
    </div>
  )
}
