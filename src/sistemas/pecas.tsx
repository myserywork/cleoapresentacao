import { MousePointer2, Sparkles, Play, Square, Puzzle } from 'lucide-react'

/**
 * Peças compartilhadas das páginas-alvo.
 *
 * O cursor fantasma que a Cleo pilota, a etiqueta que aparece quando a extensão
 * está no comando, e o painel de reserva para demonstrar sem a extensão
 * instalada. Nenhuma delas pertence ao SEI ou ao TransfereGov reais — são a
 * marca de que quem está dirigindo é a Cleo.
 */

export interface CursorState {
  x: number
  y: number
  visivel: boolean
  clicando: boolean
}

export function CursorFantasma({ cursor }: { cursor: CursorState }) {
  if (!cursor.visivel) return null
  return (
    <div
      className="pointer-events-none absolute z-[60] transition-transform"
      style={{ left: cursor.x, top: cursor.y, transform: 'translate(-2px, -2px)' }}
    >
      {cursor.clicando && (
        <span className="absolute -top-2 -left-2 block size-8 animate-ping rounded-full bg-[#8b6cf0]/40" />
      )}
      <MousePointer2 size={22} className="text-[#8b6cf0] drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]" fill="#fff" />
      <span className="absolute top-5 left-4 rounded-md bg-[#2a1e55] px-1.5 py-0.5 text-[9px] font-medium whitespace-nowrap text-[#c8b6ff]">
        Cleo
      </span>
    </div>
  )
}

export function EtiquetaCleo({ rodando }: { rodando: boolean }) {
  return (
    <div className="fixed top-3 right-3 z-[70] flex items-center gap-2 rounded-full border border-[#8b6cf0]/40 bg-[#1a1433]/95 px-3 py-1.5 text-[11.5px] text-[#c8b6ff] shadow-lg backdrop-blur">
      <Sparkles size={12} className={rodando ? 'animate-pulse' : ''} />
      {rodando ? 'Cleo executando na sua sessão…' : 'Extensão Cleo conectada'}
    </div>
  )
}

/**
 * Sem a extensão instalada, a página ainda demonstra — mas deixa claro que a
 * experiência completa é com o copiloto injetado.
 */
export function HintExtensao({
  sistema,
  rodando,
  onExecutar,
  onDocumento,
  onParar,
}: {
  sistema: string
  rodando: boolean
  onExecutar: () => void
  onDocumento: () => void
  onParar: () => void
}) {
  return (
    <div className="fixed top-3 right-3 z-[70] w-[290px] rounded-xl border border-[#8b6cf0]/30 bg-[#14102b]/97 p-3.5 text-white shadow-2xl backdrop-blur">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-md bg-[#8b6cf0]/20">
          <Sparkles size={13} className="text-[#c8b6ff]" />
        </span>
        <span className="text-[12.5px] font-medium">Copiloto Cleo</span>
        <span className="ml-auto flex items-center gap-1 text-[10px] text-[#f0a]">
          <Puzzle size={10} /> modo local
        </span>
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-white/60">
        Sem a extensão, a Cleo dirige este {sistema} no modo local. Instale a extensão do Chrome
        para o copiloto operar a sua própria sessão do {sistema}.
      </p>
      {rodando ? (
        <button
          onClick={onParar}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 py-2 text-[12px] hover:bg-white/10"
        >
          <Square size={11} /> Parar
        </button>
      ) : (
        <div className="flex flex-col gap-1.5">
          <button
            onClick={onExecutar}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#8b6cf0] py-2 text-[12px] font-medium text-white hover:bg-[#7c5ce8]"
          >
            <Play size={11} fill="currentColor" /> Autuar processo
          </button>
          <button
            onClick={onDocumento}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 py-2 text-[12px] text-white/80 hover:bg-white/5"
          >
            Gerar documento de minuta
          </button>
        </div>
      )}
    </div>
  )
}
