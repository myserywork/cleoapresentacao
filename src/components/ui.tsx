import type { ReactNode } from 'react'
import { cn } from '@/lib/format'
import type { SituacaoProposta } from '@/data/types'

/* ---------- Tom semântico ---------- */

export type Tom = 'teal' | 'gold' | 'cleo' | 'inert' | 'alert'

export const TOM_CLASSES: Record<Tom, { texto: string; fundo: string; borda: string; ponto: string }> = {
  teal: { texto: 'text-teal', fundo: 'bg-teal/10', borda: 'border-teal/30', ponto: 'bg-teal' },
  gold: { texto: 'text-gold', fundo: 'bg-gold/10', borda: 'border-gold/30', ponto: 'bg-gold' },
  cleo: { texto: 'text-cleo', fundo: 'bg-cleo/10', borda: 'border-cleo/30', ponto: 'bg-cleo' },
  inert: { texto: 'text-inert', fundo: 'bg-inert/10', borda: 'border-inert/30', ponto: 'bg-inert' },
  alert: { texto: 'text-alert', fundo: 'bg-alert/10', borda: 'border-alert/30', ponto: 'bg-alert' },
}

/**
 * A cor carrega significado fixo no sistema inteiro:
 * teal = em trâmite · dourado = recurso comprometido · cinza = parado · vermelho = negado.
 */
export const TOM_SITUACAO: Record<SituacaoProposta, Tom> = {
  Cadastrada: 'inert',
  'Em análise': 'teal',
  'Em complementação': 'gold',
  Aprovada: 'teal',
  'Convênio celebrado': 'gold',
  'Em execução': 'gold',
  'Prestação de contas': 'inert',
  Rejeitada: 'alert',
}

/* ---------- Primitivas ---------- */

export function Panel({
  children,
  className,
  ...rest
}: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('panel', className)} {...rest}>
      {children}
    </div>
  )
}

export function PanelHeader({
  titulo,
  eyebrow,
  acao,
}: {
  titulo: string
  eyebrow?: string
  acao?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div>
        {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
        <h3 className="text-[15px]">{titulo}</h3>
      </div>
      {acao}
    </div>
  )
}

export function Badge({
  children,
  tom = 'inert',
  ponto = false,
}: {
  children: ReactNode
  tom?: Tom
  ponto?: boolean
}) {
  const t = TOM_CLASSES[tom]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[11px] font-medium whitespace-nowrap',
        t.texto,
        t.fundo,
        t.borda,
      )}
    >
      {ponto && <span className={cn('size-1.5 rounded-full', t.ponto)} />}
      {children}
    </span>
  )
}

export function SituacaoBadge({ situacao }: { situacao: SituacaoProposta }) {
  return (
    <Badge tom={TOM_SITUACAO[situacao]} ponto>
      {situacao}
    </Badge>
  )
}

type BotaoProps = {
  children: ReactNode
  variante?: 'primario' | 'secundario' | 'fantasma' | 'perigo'
  tamanho?: 'md' | 'sm'
} & React.ButtonHTMLAttributes<HTMLButtonElement>

export function Botao({
  children,
  variante = 'secundario',
  tamanho = 'md',
  className,
  ...rest
}: BotaoProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap'
  const tamanhos = {
    md: 'h-9 px-3.5 text-[13px]',
    sm: 'h-7.5 px-2.5 text-xs',
  }
  const variantes = {
    primario: 'btn-primario',
    secundario: 'border border-line bg-raised text-ink hover:border-[#2c3c58] hover:bg-[#182339]',
    fantasma: 'text-muted hover:bg-white/5 hover:text-ink',
    perigo: 'border border-alert/40 bg-alert/10 text-alert hover:bg-alert/20',
  }
  return (
    <button className={cn(base, tamanhos[tamanho], variantes[variante], className)} {...rest}>
      {children}
    </button>
  )
}

export function Campo({
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-9 w-full rounded-lg border border-line bg-abyss/60 px-3 text-[13px] text-ink placeholder:text-faint',
        'focus:border-gold/50 focus:outline-none',
        className,
      )}
      {...rest}
    />
  )
}

export function Vazio({ titulo, acao }: { titulo: string; acao?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <p className="text-[13px] text-muted">{titulo}</p>
      {acao}
    </div>
  )
}

export function Rotulo({ children }: { children: ReactNode }) {
  return <div className="eyebrow mb-1">{children}</div>
}
