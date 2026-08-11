import { Sparkles } from 'lucide-react'
import { useApp } from '@/store/app'

/**
 * Narração do copiloto.
 *
 * Quando a Cleo dirige a interface, a plateia precisa saber que foi ela — sem
 * isso a tela "muda sozinha" e o efeito vira confusão em vez de impressão.
 */
export function RastroCopiloto() {
  const { rastro } = useApp()
  if (!rastro) return null

  return (
    <div className="pointer-events-none fixed bottom-7 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-full border border-cleo/35 bg-surface/95 py-2.5 pr-5 pl-3.5 shadow-2xl backdrop-blur-xl">
        <span className="relative flex size-6 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-cleo/25" />
          <Sparkles size={14} className="relative text-cleo" />
        </span>
        <span className="text-[13px] text-ink">{rastro.rotulo}</span>
        {rastro.detalhe && <span className="text-[12px] text-muted">{rastro.detalhe}</span>}
      </div>
    </div>
  )
}
