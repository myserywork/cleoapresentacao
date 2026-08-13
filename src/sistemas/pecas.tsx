import { MousePointer2, Sparkles, Play, Square, Puzzle } from 'lucide-react'

/* Peças recoloridas para a paleta da Cleopatra (navy + dourado). */

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
        <span className="absolute -top-2 -left-2 block size-8 animate-ping rounded-full bg-[#dfb552]/45" />
      )}
      <MousePointer2 size={22} className="text-[#b8892e] drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]" fill="#dfb552" />
      <span className="absolute top-5 left-4 rounded-md bg-[#0d1421] px-1.5 py-0.5 text-[9px] font-medium whitespace-nowrap text-[#dfb552] shadow">
        Cleopatra
      </span>
    </div>
  )
}

export function EtiquetaCleo({ rodando }: { rodando: boolean }) {
  return (
    <div className="fixed top-3 right-3 z-[70] flex items-center gap-2 rounded-full border border-[#dfb552]/45 bg-[#0d1421]/95 px-3 py-1.5 text-[11.5px] text-[#dfb552] shadow-lg backdrop-blur">
      <img src="/marca/mark.png" alt="" className="size-4" />
      {rodando ? 'Cleopatra executando na sua sessão…' : 'Extensão Cleopatra conectada'}
      <Sparkles size={11} className={rodando ? 'animate-pulse text-[#35c3a7]' : 'text-[#8698b3]'} />
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
  const primario = sistema === 'SEI' ? 'Autuar processo' : 'Localizar e baixar da proposta'
  const secundario = sistema === 'SEI' ? 'Gerar documento de minuta' : 'Repetir a extração'
  return (
    <div className="fixed top-4 right-4 z-[70] w-[300px] overflow-hidden rounded-2xl border border-[#dfb552]/25 bg-[#0b111d]/97 text-[#e7edf8] shadow-2xl backdrop-blur">
      <div className="flex items-center gap-2.5 border-b border-[#1d2a41] px-4 py-3">
        <img src="/marca/mark.png" alt="" className="size-7 rounded-md border border-[#dfb552]/40" />
        <div>
          <div className="text-[12px] font-semibold tracking-[0.2em]">CLEOPATRA</div>
          <div className="text-[10px] text-[#dfb552]">copiloto do {sistema}</div>
        </div>
        <span className="ml-auto flex items-center gap-1 rounded-full border border-[#1d2a41] px-2 py-0.5 text-[9px] text-[#8698b3]">
          <Puzzle size={9} /> modo local
        </span>
      </div>
      <div className="p-4">
        <p className="mb-3 text-[11px] leading-relaxed text-[#8698b3]">
          Sem a extensão, a Cleo dirige este {sistema} no modo local. Instale a extensão do Chrome
          para o copiloto operar a sua própria sessão — e levar a sessão autenticada para a
          Cleopatra continuar sozinha.
        </p>
        {rodando ? (
          <button
            onClick={onParar}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#1d2a41] bg-white/5 py-2 text-[12px] hover:bg-white/10"
          >
            <Square size={11} /> Parar
          </button>
        ) : (
          <div className="flex flex-col gap-1.5">
            <button
              onClick={onExecutar}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#dfb552] py-2 text-[12px] font-semibold text-[#151003] hover:bg-[#eecb74]"
            >
              <Play size={11} fill="currentColor" /> {primario}
            </button>
            <button
              onClick={onDocumento}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#1d2a41] py-2 text-[12px] text-[#b8c0d4] hover:bg-white/5"
            >
              {secundario}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
