import { NavLink, useLocation } from 'react-router-dom'
import {
  Boxes,
  BrainCircuit,
  Command,
  FileStack,
  Gauge,
  ScrollText,
  Sunrise,
  LayoutDashboard,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { BotaoApresentar } from '@/components/ModoApresentacao'
import { Notificacoes } from '@/components/Notificacoes'
import { useApp } from '@/store/app'
import { ORGAOS, aprovacoesDoOrgao } from '@/data/repo'
import { cn } from '@/lib/format'

const NAV = [
  { to: '/', rotulo: 'Painel', icone: LayoutDashboard, fim: true },
  { to: '/meu-dia', rotulo: 'Meu dia', icone: Sunrise },
  { to: '/propostas', rotulo: 'Propostas', icone: FileStack },
  { to: '/aprovacoes', rotulo: 'Aprovações', icone: ShieldCheck },
  { to: '/cerebro', rotulo: 'Cérebro', icone: BrainCircuit },
  { to: '/assistente', rotulo: 'Assistente', icone: MessagesSquare },
  { to: '/minutas', rotulo: 'Minutas', icone: ScrollText },
  { to: '/paineis', rotulo: 'Meus painéis', icone: Boxes },
  { to: '/ganho', rotulo: 'O ganho', icone: Gauge },
]

export function Shell({ children }: { children: React.ReactNode }) {
  const { orgaoId, setOrgaoId, aprovacoes } = useApp()
  const { pathname } = useLocation()
  const pendentes = aprovacoesDoOrgao(orgaoId).filter(
    (a) => aprovacoes.find((x) => x.id === a.id)?.decidida === 'pendente',
  ).length

  // O Cérebro ocupa a tela inteira: é a peça de assinatura, não cabe numa caixa.
  const telaCheia = pathname === '/cerebro'

  return (
    <div className="flex min-h-screen">
      <a
        href="#conteudo"
        className="pular-para-conteudo rounded-lg border border-gold bg-surface px-3 py-2 text-[13px] text-gold"
      >
        Pular para o conteúdo
      </a>

      <nav
        aria-label="Navegação principal"
        className="fixed inset-y-0 left-0 z-30 flex w-[212px] flex-col border-r border-line bg-abyss/80 backdrop-blur-xl"
      >
        <div className="flex items-center gap-2.5 px-5 py-5">
          <img src="/marca/mark.png" alt="" className="size-8 rounded-md" />
          <div>
            <div className="font-display text-[15px] font-semibold tracking-[0.14em] text-ink">
              CLEOPATRA
            </div>
            <div className="eyebrow mt-0.5">Gestão de convênios</div>
          </div>
        </div>

        <div className="px-3 pt-2 pb-4">
          <label className="eyebrow mb-1.5 block px-2">Órgão</label>
          <select
            value={orgaoId}
            onChange={(e) => setOrgaoId(e.target.value)}
            className="h-9 w-full cursor-pointer rounded-lg border border-line bg-raised px-2.5 text-[13px] text-ink focus:border-gold/50 focus:outline-none"
          >
            {ORGAOS.map((o) => (
              <option key={o.id} value={o.id} className="bg-surface">
                {o.sigla}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-1 flex-col gap-0.5 px-3">
          {NAV.map(({ to, rotulo, icone: Icone, fim }) => (
            <NavLink
              key={to}
              to={to}
              end={fim}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition-colors',
                  isActive ? 'bg-gold/10 text-gold' : 'text-muted hover:bg-white/5 hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute top-1/2 -left-3 h-5 w-[3px] -translate-y-1/2 rounded-r bg-gold" />
                  )}
                  <Icone size={16} strokeWidth={1.8} />
                  <span className="flex-1">{rotulo}</span>
                  {to === '/aprovacoes' && pendentes > 0 && (
                    <span className="num rounded-full bg-gold/15 px-1.5 py-px text-[10px] font-semibold text-gold">
                      {pendentes}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>

        <div className="flex flex-col gap-1 border-t border-line px-3 py-3">
          <Notificacoes />
          <BotaoApresentar />
          <button
            onClick={() =>
              window.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
              )
            }
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[12px] text-muted transition-colors hover:bg-white/5 hover:text-ink"
          >
            <Command size={12} />
            Comandos
            <kbd className="num ml-auto text-[9.5px] text-faint">Ctrl+K</kbd>
          </button>
          <div className="flex items-center gap-2 px-2 pt-1.5 text-[11px] text-faint">
            <Sparkles size={12} className="text-cleo" />
            <span>Cleo ativa · v2</span>
          </div>
        </div>
      </nav>

      <main id="conteudo" className={cn('ml-[212px] flex-1', telaCheia ? '' : 'px-8 py-7')}>
        {children}
      </main>
    </div>
  )
}
