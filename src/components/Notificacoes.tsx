import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Check, MessageSquare, ShieldCheck, Sparkles } from 'lucide-react'
import { useApp } from '@/store/app'
import { cn, desde } from '@/lib/format'

const ICONE = {
  automacao: Sparkles,
  aprovacao: ShieldCheck,
  comentario: MessageSquare,
}

const TOM = {
  automacao: 'text-cleo',
  aprovacao: 'text-gold',
  comentario: 'text-teal',
}

/**
 * Central de atividade.
 *
 * Fecha o ciclo do produto: sem aviso, a fila de aprovação depende de alguém
 * lembrar de olhar, e o trabalho que a Cleo fez sozinha passa despercebido.
 */
export function Notificacoes() {
  const { notificacoes, marcarLidas } = useApp()
  const [aberta, setAberta] = useState(false)
  const caixaRef = useRef<HTMLDivElement>(null)

  const naoLidas = notificacoes.filter((n) => !n.lida).length

  useEffect(() => {
    if (!aberta) return
    const aoClicar = (e: MouseEvent) => {
      if (!caixaRef.current?.contains(e.target as Node)) setAberta(false)
    }
    window.addEventListener('mousedown', aoClicar)
    return () => window.removeEventListener('mousedown', aoClicar)
  }, [aberta])

  return (
    <div ref={caixaRef} className="relative">
      <button
        onClick={() => {
          setAberta((v) => !v)
          if (!aberta) marcarLidas()
        }}
        aria-label={`Atividade${naoLidas > 0 ? `, ${naoLidas} não lidas` : ''}`}
        className="relative flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[12px] text-muted transition-colors hover:bg-white/5 hover:text-ink"
      >
        <Bell size={12} />
        Atividade
        {naoLidas > 0 && (
          <span className="num ml-auto rounded-full bg-gold/15 px-1.5 py-px text-[10px] font-semibold text-gold">
            {naoLidas}
          </span>
        )}
      </button>

      {aberta && (
        <div className="absolute bottom-0 left-full z-50 ml-3 w-[330px] rounded-xl border border-line bg-surface/97 shadow-2xl backdrop-blur-xl">
          <div className="border-b border-line px-4 py-2.5">
            <span className="eyebrow">Atividade</span>
          </div>

          {notificacoes.length === 0 ? (
            <p className="px-4 py-8 text-center text-[12.5px] text-muted">
              Nada aconteceu ainda. Dispare uma automação ou envie propostas para aprovação.
            </p>
          ) : (
            <ul className="max-h-[380px] overflow-y-auto">
              {notificacoes.slice(0, 20).map((n) => {
                const Icone = ICONE[n.tipo]
                const conteudo = (
                  <span className="flex items-start gap-3 px-4 py-3">
                    <Icone size={14} className={cn('mt-0.5 shrink-0', TOM[n.tipo])} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] text-ink">{n.titulo}</span>
                      <span className="mt-0.5 block text-[11.5px] leading-snug text-muted">
                        {n.detalhe}
                      </span>
                      <span className="mt-1 block text-[10.5px] text-faint">
                        {desde(n.criadoEm)}
                      </span>
                    </span>
                  </span>
                )
                return (
                  <li key={n.id} className="border-b border-line-soft last:border-0">
                    {n.href ? (
                      <Link
                        to={n.href}
                        onClick={() => setAberta(false)}
                        className="block transition-colors hover:bg-white/[0.03]"
                      >
                        {conteudo}
                      </Link>
                    ) : (
                      conteudo
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          {notificacoes.length > 0 && (
            <div className="flex items-center justify-between border-t border-line px-4 py-2.5">
              <span className="text-[11px] text-faint">{notificacoes.length} eventos</span>
              <button
                onClick={marcarLidas}
                className="flex items-center gap-1.5 text-[11.5px] text-muted hover:text-ink"
              >
                <Check size={11} /> Marcar todas como lidas
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
