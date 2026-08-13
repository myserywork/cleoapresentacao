import type { ReactNode } from 'react'
import { ArrowUpRight, Lock } from 'lucide-react'
import { usePermissao } from '@/dominio/usePermissao'
import { PERFIL_POR_ID, type Permissao } from '@/dominio/permissoes'
import { cn, moedaCompacta } from '@/lib/format'

/**
 * Autorização na interface.
 *
 * O botão que a pessoa não pode usar não some: ele fica ali, explicando por quê
 * e a quem o pedido sobe. Sumir esconde a regra; explicar constrói confiança —
 * e é o que um gestor precisa ver para acreditar que a máquina obedece à casa.
 */
export function Autorizado({
  permissao,
  valor,
  children,
  aoNegado = 'explicar',
}: {
  permissao: Permissao
  /** Valor da operação, quando houver alçada envolvida. */
  valor?: number
  children: ReactNode
  /** 'explicar' mostra o cadeado com o motivo; 'esconder' remove da tela. */
  aoNegado?: 'explicar' | 'esconder'
}) {
  const { checar } = usePermissao()
  const veredito = checar(permissao, valor)

  if (veredito.permitido) return <>{children}</>
  if (aoNegado === 'esconder') return null

  const quem = veredito.quemPode?.[0]
  return (
    <div className="group relative inline-flex">
      <div className="pointer-events-none opacity-40 select-none">{children}</div>
      <div className="absolute inset-0 z-10 cursor-not-allowed rounded-lg" />
      {/* Ancorado à direita: perto da borda da tela, centralizar cortaria o texto */}
      <div className="pointer-events-none absolute right-0 bottom-full z-30 mb-2 hidden w-[280px] rounded-xl border border-gold/30 bg-surface px-3.5 py-3 shadow-2xl group-hover:block">
        <div className="mb-1.5 flex items-center gap-2">
          <Lock size={12} className="text-gold" />
          <span className="text-[12px] text-gold">Fora da sua alçada</span>
        </div>
        <p className="text-[11.5px] leading-relaxed text-muted">{veredito.motivo}</p>
        {valor !== undefined && (
          <p className="num mt-1 text-[11px] text-faint">valor da operação: {moedaCompacta(valor)}</p>
        )}
        {quem && (
          <div className="mt-2 flex items-start gap-1.5 border-t border-line pt-2">
            <ArrowUpRight size={11} className="mt-0.5 shrink-0 text-teal" />
            <p className="text-[11px] leading-relaxed text-muted">
              Sobe para <span className="text-ink">{quem.nome}</span> (
              {PERFIL_POR_ID.get(quem.perfil)?.nome}) — o pedido entra na fila dele.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/** Etiqueta compacta do perfil de quem está operando, para os cabeçalhos. */
export function SeloPerfil({ className }: { className?: string }) {
  const { eu, perfil, alcada } = usePermissao()
  if (!perfil) return null
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border border-line bg-raised px-3 py-1.5 text-[11.5px]',
        className,
      )}
      title={`Você opera como ${eu.nome} — alçada de ${alcada === Infinity ? 'sem teto' : moedaCompacta(alcada)}`}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          perfil.tom === 'cleo' && 'bg-cleo',
          perfil.tom === 'gold' && 'bg-gold',
          perfil.tom === 'teal' && 'bg-teal',
          perfil.tom === 'alert' && 'bg-alert',
          perfil.tom === 'inert' && 'bg-inert',
        )}
      />
      <span className="text-muted">{perfil.nome}</span>
      <span className="num text-faint">
        {alcada === Infinity ? 'sem teto' : `até ${moedaCompacta(alcada)}`}
      </span>
    </div>
  )
}
