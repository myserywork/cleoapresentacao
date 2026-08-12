import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  Building2,
  CornerDownLeft,
  FileText,
  Landmark,
  MessagesSquare,
  Play,
  Search,
  Sparkles,
  Workflow,
} from 'lucide-react'
import { useApp } from '@/store/app'
import { useExecutor } from '@/comandos/executor'
import { CATALOGO } from '@/comandos/catalogo'
import type { Acao } from '@/comandos/tipos'
import {
  buscarPropostas,
  emendasDoOrgao,
  getParlamentar,
  getProponente,
  propostasDoOrgao,
} from '@/data/repo'
import { cn, moeda, moedaCompacta } from '@/lib/format'

interface Item {
  id: string
  rotulo: string
  detalhe?: string
  categoria: string
  icone: React.ReactNode
  acoes: Acao[]
}

function normalizar(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Paleta de comando (Ctrl+K).
 *
 * Além dos comandos fixos e das propostas, aceita uma frase solta e a encaminha
 * para a Cleo — a mesma intenção que o chat resolveria, sem trocar de tela antes.
 */
export function PaletaComando() {
  const [aberta, setAberta] = useState(false)
  const [termo, setTermo] = useState('')
  const [indice, setIndice] = useState(0)
  const { orgaoId, ritos } = useApp()
  const { executar } = useExecutor()
  const entradaRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setAberta((v) => !v)
        return
      }
      if (e.key === 'Escape') setAberta(false)
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [])

  useEffect(() => {
    if (aberta) {
      setTermo('')
      setIndice(0)
      window.setTimeout(() => entradaRef.current?.focus(), 20)
    }
  }, [aberta])

  const itens = useMemo<Item[]>(() => {
    const t = normalizar(termo.trim())

    const comandos: Item[] = CATALOGO.filter((c) => {
      if (!t) return true
      const alvo = normalizar(`${c.rotulo} ${(c.sinonimos ?? []).join(' ')}`)
      return alvo.includes(t)
    }).map((c) => ({
      id: c.id,
      rotulo: c.rotulo,
      categoria: c.categoria,
      icone: <ArrowRight size={14} />,
      acoes: c.acoes,
    }))

    const propostas: Item[] = t
      ? buscarPropostas(orgaoId, termo)
          .slice(0, 5)
          .map((p) => {
            const prop = getProponente(p.proponenteId)
            return {
              id: `pr-${p.id}`,
              rotulo: p.numero,
              detalhe: `${prop?.nome} · ${prop?.uf} · ${moedaCompacta(p.valorGlobal)}`,
              categoria: 'Propostas',
              icone: <FileText size={14} />,
              acoes: [{ tipo: 'abrir-proposta', propostaId: p.id }] as Acao[],
            }
          })
      : []

    // Busca global: o que a plataforma conhece cabe no mesmo campo.
    const proponentes: Item[] = t
      ? [
          ...new Map(
            propostasDoOrgao(orgaoId)
              .map((p) => getProponente(p.proponenteId))
              .filter((p) => p && normalizar(`${p.nome} ${p.municipio} ${p.uf}`).includes(t))
              .map((p) => [p!.id, p!]),
          ).values(),
        ]
          .slice(0, 4)
          .map((p) => ({
            id: `pn-${p.id}`,
            rotulo: p.nome,
            detalhe: `${p.municipio}/${p.uf} · ${p.esfera} · CNPJ ${p.cnpj}`,
            categoria: 'Proponentes',
            icone: <Building2 size={14} />,
            acoes: [{ tipo: 'navegar', para: `/proponentes/${p.id}` }] as Acao[],
          }))
      : []

    const parlamentares: Item[] = t
      ? [
          ...new Map(
            emendasDoOrgao(orgaoId)
              .map((e) => (e.parlamentarId ? getParlamentar(e.parlamentarId) : undefined))
              .filter((p) => p && normalizar(`${p.nome} ${p.partido} ${p.uf}`).includes(t))
              .map((p) => [p!.id, p!]),
          ).values(),
        ]
          .slice(0, 4)
          .map((p) => ({
            id: `pl-${p.id}`,
            rotulo: p.nome,
            detalhe: `${p.partido}/${p.uf} · ${p.casa}`,
            categoria: 'Parlamentares',
            icone: <Landmark size={14} />,
            acoes: [{ tipo: 'navegar', para: `/parlamentares/${p.id}` }] as Acao[],
          }))
      : []

    const emendas: Item[] = t
      ? emendasDoOrgao(orgaoId)
          .filter((e) => normalizar(`${e.numero} ${e.tipo} ${e.ano}`).includes(t))
          .slice(0, 3)
          .map((e) => ({
            id: `em-${e.id}`,
            rotulo: `Emenda ${e.numero}`,
            detalhe: `${e.tipo} · ${e.ano} · ${moeda(e.valorIndicado)}`,
            categoria: 'Emendas',
            icone: <Landmark size={14} />,
            acoes: [
              {
                tipo: 'navegar',
                para: e.parlamentarId ? `/parlamentares/${e.parlamentarId}` : '/emendas',
              },
            ] as Acao[],
          }))
      : []

    const ritosEncontrados: Item[] = t
      ? ritos
          .filter((r) => normalizar(`${r.nome} ${r.descricao}`).includes(t))
          .slice(0, 3)
          .map((r) => ({
            id: `rt-${r.id}`,
            rotulo: r.nome,
            detalhe: `${r.passos.length} passos · ${r.sistema}`,
            categoria: 'Ritos',
            icone: <Workflow size={14} className="text-cleo" />,
            acoes: [{ tipo: 'navegar', para: '/ritos' }] as Acao[],
          }))
      : []

    const perguntar: Item[] =
      t.length > 3
        ? [
            {
              id: 'perguntar',
              rotulo: `Perguntar à Cleo: “${termo.trim()}”`,
              categoria: 'Assistente',
              icone: <Sparkles size={14} className="text-cleo" />,
              acoes: [
                { tipo: 'navegar', para: `/assistente?q=${encodeURIComponent(termo.trim())}` },
              ] as Acao[],
            },
          ]
        : []

    const apresentar: Item[] = !t
      ? [
          {
            id: 'apresentar',
            rotulo: 'Iniciar o modo apresentação',
            detalhe: 'A plataforma se apresenta sozinha',
            categoria: 'Apresentação',
            icone: <Play size={14} className="text-gold" />,
            acoes: [{ tipo: 'navegar', para: '/?apresentar=1' }] as Acao[],
          },
        ]
      : []

    // Sem busca, a apresentação vem primeiro: é o que se procura antes de subir ao palco.
    return [
      ...perguntar,
      ...propostas,
      ...proponentes,
      ...parlamentares,
      ...emendas,
      ...ritosEncontrados,
      ...apresentar,
      ...comandos,
    ]
  }, [termo, orgaoId, ritos])

  useEffect(() => {
    setIndice(0)
  }, [termo])

  if (!aberta) return null

  function acionar(item: Item) {
    setAberta(false)
    void executar(item.acoes, { silencioso: true })
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-abyss/80 p-6 pt-[14vh] backdrop-blur-sm"
      onClick={() => setAberta(false)}
    >
      <div
        className="panel w-[620px] overflow-hidden bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={16} className="shrink-0 text-faint" />
          <input
            ref={entradaRef}
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setIndice((i) => Math.min(i + 1, itens.length - 1))
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                setIndice((i) => Math.max(i - 1, 0))
              }
              if (e.key === 'Enter' && itens[indice]) acionar(itens[indice])
            }}
            placeholder="Buscar, comandar ou perguntar…"
            className="h-13 flex-1 bg-transparent py-4 text-[14px] text-ink placeholder:text-faint focus:outline-none"
            aria-label="Comando"
          />
          <kbd className="num rounded border border-line px-1.5 py-0.5 text-[10px] text-faint">
            esc
          </kbd>
        </div>

        <div className="max-h-[380px] overflow-y-auto py-2">
          {itens.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-muted">
              Nada encontrado. Tente o número da proposta, o proponente ou uma pergunta.
            </p>
          ) : (
            itens.map((item, i) => (
              <button
                key={item.id}
                onMouseEnter={() => setIndice(i)}
                onClick={() => acionar(item)}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                  i === indice ? 'bg-white/6' : 'hover:bg-white/4',
                )}
              >
                <span className="shrink-0 text-muted">{item.icone}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-ink">{item.rotulo}</span>
                  {item.detalhe && (
                    <span className="block truncate text-[11.5px] text-muted">{item.detalhe}</span>
                  )}
                </span>
                <span className="eyebrow shrink-0">{item.categoria}</span>
                {i === indice && <CornerDownLeft size={13} className="shrink-0 text-faint" />}
              </button>
            ))
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-line px-4 py-2.5 text-[11px] text-faint">
          <span className="flex items-center gap-1.5">
            <MessagesSquare size={11} /> escreva uma pergunta para a Cleo agir
          </span>
          <span className="ml-auto">↑↓ navegar · ⏎ executar</span>
        </div>
      </div>
    </div>
  )
}
