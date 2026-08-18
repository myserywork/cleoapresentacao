import { useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Download } from 'lucide-react'
import { cn } from '@/lib/format'
import { Botao, type Tom, TOM_CLASSES } from './ui'

/**
 * Camada de exibição de dado tabular.
 *
 * Uma tabela só, usada em todas as telas novas: ordenação, exportação e estado
 * vazio no mesmo lugar. Tela de gestão pública vive de tabela — vale ter uma boa.
 */

export interface Coluna<T> {
  id: string
  cabecalho: string
  /** Conteúdo renderizado na célula. */
  celula: (item: T) => ReactNode
  /** Valor usado para ordenar e exportar; sem ele a coluna não ordena. */
  valor?: (item: T) => string | number
  largura?: string
  alinhamento?: 'esquerda' | 'direita'
  className?: string
}

export function Tabela<T>({
  itens,
  colunas,
  chave,
  aoClicar,
  vazio = 'Nada aqui com os filtros atuais.',
  ordemInicial,
  compacta = false,
  destaque,
}: {
  itens: T[]
  colunas: Coluna<T>[]
  chave: (item: T) => string
  aoClicar?: (item: T) => void
  vazio?: string
  ordemInicial?: { coluna: string; direcao: 'asc' | 'desc' }
  compacta?: boolean
  destaque?: (item: T) => boolean
}) {
  const [ordem, setOrdem] = useState(ordemInicial)

  const ordenados = useMemo(() => {
    if (!ordem) return itens
    const coluna = colunas.find((c) => c.id === ordem.coluna)
    if (!coluna?.valor) return itens
    const fator = ordem.direcao === 'asc' ? 1 : -1
    return [...itens].sort((a, b) => {
      const va = coluna.valor!(a)
      const vb = coluna.valor!(b)
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * fator
      return String(va).localeCompare(String(vb), 'pt-BR') * fator
    })
  }, [itens, colunas, ordem])

  function alternar(id: string) {
    const coluna = colunas.find((c) => c.id === id)
    if (!coluna?.valor) return
    setOrdem((atual) =>
      atual?.coluna === id
        ? { coluna: id, direcao: atual.direcao === 'asc' ? 'desc' : 'asc' }
        : { coluna: id, direcao: 'desc' },
    )
  }

  if (itens.length === 0) {
    return <div className="px-5 py-12 text-center text-[13px] text-muted">{vazio}</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-line">
            {colunas.map((c) => (
              <th
                key={c.id}
                style={{ width: c.largura }}
                className={cn(
                  'eyebrow px-4 py-2.5 font-medium whitespace-nowrap',
                  c.alinhamento === 'direita' && 'text-right',
                  c.valor && 'cursor-pointer select-none hover:text-ink',
                )}
                onClick={() => alternar(c.id)}
              >
                <span className="inline-flex items-center gap-1">
                  {c.cabecalho}
                  {ordem?.coluna === c.id &&
                    (ordem.direcao === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ordenados.map((item) => (
            <tr
              key={chave(item)}
              onClick={() => aoClicar?.(item)}
              className={cn(
                'border-b border-line-soft transition-colors last:border-0',
                aoClicar && 'cursor-pointer hover:bg-white/[0.035]',
                destaque?.(item) && 'bg-gold/[0.05]',
              )}
            >
              {colunas.map((c) => (
                <td
                  key={c.id}
                  className={cn(
                    'px-4 align-middle text-[12.5px]',
                    compacta ? 'py-2' : 'py-3',
                    c.alinhamento === 'direita' && 'text-right',
                    c.className,
                  )}
                >
                  {c.celula(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ---------- Exportação ---------- */

function escapar(valor: string | number): string {
  const texto = String(valor ?? '')
  return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

/**
 * CSV com ponto e vírgula e BOM: é o que o Excel em português abre sem pedir
 * assistente de importação nem comer os acentos.
 */
export function baixarCsv(nome: string, cabecalhos: string[], linhas: (string | number)[][]) {
  const conteudo = [cabecalhos, ...linhas].map((l) => l.map(escapar).join(';')).join('\r\n')
  const blob = new Blob([`﻿${conteudo}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${nome}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function BotaoExportar<T>({
  nome,
  itens,
  colunas,
  rotulo = 'Exportar',
}: {
  nome: string
  itens: T[]
  colunas: Coluna<T>[]
  rotulo?: string
}) {
  const exportaveis = colunas.filter((c) => c.valor)
  return (
    <Botao
      tamanho="sm"
      variante="fantasma"
      title={`Baixar ${itens.length} linha(s) em CSV`}
      onClick={() =>
        baixarCsv(
          nome,
          exportaveis.map((c) => c.cabecalho),
          itens.map((i) => exportaveis.map((c) => c.valor!(i))),
        )
      }
    >
      <Download size={12} />
      {rotulo}
    </Botao>
  )
}

/* ---------- Primitivas de leitura ---------- */

export function Medidor({
  valor,
  tom = 'teal',
  altura = 6,
  fundo = 'bg-white/6',
}: {
  /** 0..1 */
  valor: number
  tom?: Tom
  altura?: number
  fundo?: string
}) {
  return (
    <div className={cn('w-full overflow-hidden rounded-full', fundo)} style={{ height: altura }}>
      <div
        className={cn('h-full rounded-full transition-[width] duration-700 ease-out', TOM_CLASSES[tom].ponto)}
        style={{ width: `${Math.min(Math.max(valor, 0), 1) * 100}%` }}
      />
    </div>
  )
}

export function Avatar({ iniciais, tom = 'cleo' }: { iniciais: string; tom?: Tom }) {
  const t = TOM_CLASSES[tom]
  return (
    <span
      className={cn(
        'num inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-[10.5px] font-semibold',
        t.texto,
        t.fundo,
        t.borda,
      )}
    >
      {iniciais}
    </span>
  )
}

export function Abas<T extends string>({
  abas,
  ativa,
  aoTrocar,
}: {
  abas: { id: T; rotulo: string; contagem?: number }[]
  ativa: T
  aoTrocar: (id: T) => void
}) {
  // A régua rola de lado quando não cabe. Quebrar em duas linhas parece painel
  // quebrado; sumir atrás da borda do painel esconde aba que ninguém acha.
  return (
    <div className="rolagem-discreta flex items-center gap-1 overflow-x-auto border-b border-line">
      {abas.map((a) => (
        <button
          key={a.id}
          onClick={() => aoTrocar(a.id)}
          className={cn(
            'relative -mb-px shrink-0 border-b-2 px-3.5 py-2.5 text-[13px] whitespace-nowrap transition-colors',
            ativa === a.id
              ? 'border-gold text-gold'
              : 'border-transparent text-muted hover:text-ink',
          )}
        >
          {a.rotulo}
          {a.contagem !== undefined && (
            <span className="num ml-1.5 text-[11px] text-faint">{a.contagem}</span>
          )}
        </button>
      ))}
    </div>
  )
}

export function Segmentado<T extends string>({
  opcoes,
  valor,
  aoTrocar,
}: {
  opcoes: { id: T; rotulo: string }[]
  valor: T
  aoTrocar: (id: T) => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-abyss/50 p-0.5">
      {opcoes.map((o) => (
        <button
          key={o.id}
          onClick={() => aoTrocar(o.id)}
          className={cn(
            'rounded-[6px] px-3 py-1.5 text-[12px] transition-colors',
            valor === o.id ? 'bg-raised text-ink' : 'text-muted hover:text-ink',
          )}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  )
}

/** Par rótulo/valor — a unidade de leitura de qualquer ficha. */
export function Dado({
  rotulo,
  children,
  mono = false,
  className,
}: {
  rotulo: string
  children: ReactNode
  mono?: boolean
  className?: string
}) {
  return (
    <div className={className}>
      <div className="eyebrow mb-1">{rotulo}</div>
      <div className={cn('text-[13px] text-ink', mono && 'num')}>{children}</div>
    </div>
  )
}

/** Bloco de número grande, sem animação — para grades densas de indicador. */
export function Numero({
  rotulo,
  valor,
  detalhe,
  tom = 'ink',
}: {
  rotulo: string
  valor: string
  detalhe?: string
  tom?: 'ink' | 'gold' | 'teal' | 'cleo' | 'alert' | 'inert'
}) {
  const cores = {
    ink: 'text-ink',
    gold: 'text-gold',
    teal: 'text-teal',
    cleo: 'text-cleo',
    alert: 'text-alert',
    inert: 'text-inert',
  }
  return (
    <div>
      <div className="eyebrow mb-1.5">{rotulo}</div>
      {/* Valor não quebra linha: "R$ 1,0" numa linha e "bi" na outra deixa de
          ser número e vira erro de leitura. Encolhe a fonte antes disso. */}
      <div
        className={cn(
          'num text-[19px] leading-none font-medium whitespace-nowrap sm:text-[22px]',
          cores[tom],
        )}
      >
        {valor}
      </div>
      {detalhe && <div className="mt-1.5 text-[11.5px] text-muted">{detalhe}</div>}
    </div>
  )
}
