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
 *
 * No celular cada uma das seis fases teria uns 48px: o rótulo sairia truncado
 * em duas sílabas e a descrição só aparece no passar do mouse, que não existe.
 * Então lá a régua vira barra contínua e o texto se concentra na fase atual —
 * que é a única resposta que alguém procura de pé, no corredor.
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
  const fase = CICLO[Math.min(Math.max(atual, 0), CICLO.length - 1)]

  return (
    <div>
      <div className="flex items-stretch gap-1">
        {CICLO.map((f, i) => {
          const passada = !rejeitada && i < atual
          const agora = !rejeitada && i === atual
          return (
            <div key={f.id} className="group relative min-w-0 flex-1">
              <div
                className={cn(
                  'h-1.5 rounded-full transition-colors',
                  agora ? 'bg-gold' : passada ? 'bg-teal' : rejeitada ? 'bg-alert/25' : 'bg-line',
                )}
              />
              <div className="mt-2 hidden items-center gap-1.5 sm:flex">
                {passada && <Check size={10} className="shrink-0 text-teal" />}
                {agora && <span className="size-1.5 shrink-0 rounded-full bg-gold" />}
                <span
                  className={cn(
                    'truncate text-[11px]',
                    agora ? 'text-gold' : passada ? 'text-muted' : 'text-faint',
                  )}
                >
                  {f.rotulo}
                </span>
              </div>
              {!compacto && (
                <p className="mt-1 line-clamp-2 hidden text-[10.5px] leading-snug text-faint opacity-0 transition-opacity group-hover:opacity-100 sm:block">
                  {f.descricao}
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

      {/* Leitura de celular: onde está, em quantas fases, e o que essa fase é */}
      <div className="mt-2.5 sm:hidden">
        <div className="flex items-baseline gap-2">
          <span className={cn('text-[12px]', rejeitada ? 'text-alert' : 'text-gold')}>
            {rejeitada ? 'Rejeitada' : fase.rotulo}
          </span>
          {!rejeitada && (
            <span className="num text-[10.5px] text-faint">
              fase {atual + 1} de {CICLO.length}
            </span>
          )}
        </div>
        {!compacto && !rejeitada && (
          <p className="mt-1 text-[11px] leading-snug text-faint">{fase.descricao}</p>
        )}
      </div>
    </div>
  )
}
