import { Check } from 'lucide-react'
import { CICLO, faseAtual } from '@/dominio/ciclo'
import { cn } from '@/lib/format'
import type { SituacaoProposta } from '@/data/types'

/**
 * Ciclo de vida do convênio.
 *
 * Faixa única do cadastro à prestação de contas. Serve para quem nunca viu o
 * processo entender em cinco segundos onde a proposta está e o que ainda falta
 * — inclusive na sala, apontando para a tela.
 */
export function CicloDeVida({
  situacao,
  compacto = false,
}: {
  situacao: SituacaoProposta
  compacto?: boolean
}) {
  const atual = faseAtual(situacao)
  const rejeitada = situacao === 'Rejeitada'

  return (
    <div className="flex items-stretch gap-1">
      {CICLO.map((fase, i) => {
        const passada = !rejeitada && i < atual
        const agora = !rejeitada && i === atual
        return (
          <div key={fase.id} className="group relative min-w-0 flex-1">
            <div
              className={cn(
                'h-1.5 rounded-full transition-colors',
                agora ? 'bg-gold' : passada ? 'bg-teal' : rejeitada ? 'bg-alert/25' : 'bg-line',
              )}
            />
            <div className="mt-2 flex items-center gap-1.5">
              {passada && <Check size={10} className="shrink-0 text-teal" />}
              {agora && <span className="size-1.5 shrink-0 rounded-full bg-gold" />}
              <span
                className={cn(
                  'truncate text-[11px]',
                  agora ? 'text-gold' : passada ? 'text-muted' : 'text-faint',
                )}
              >
                {fase.rotulo}
              </span>
            </div>
            {!compacto && (
              <p className="mt-1 line-clamp-2 text-[10.5px] leading-snug text-faint opacity-0 transition-opacity group-hover:opacity-100">
                {fase.descricao}
              </p>
            )}
          </div>
        )
      })}

      {rejeitada && (
        <div className="ml-2 flex shrink-0 items-center">
          <span className="rounded-full border border-alert/30 bg-alert/10 px-2.5 py-0.5 text-[11px] text-alert">
            Rejeitada
          </span>
        </div>
      )}
    </div>
  )
}
