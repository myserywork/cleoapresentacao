import { NavLink, useLocation } from 'react-router-dom'
import {
  Boxes,
  BrainCircuit,
  Building2,
  Command,
  Columns3,
  Fingerprint,
  FileStack,
  FileText,
  Gauge,
  GitBranch,
  KeyRound,
  Landmark,
  Mails,
  Puzzle,
  Moon,
  MonitorPlay,
  ScrollText,
  ShieldCheck,
  Sun,
  Sunrise,
  LayoutDashboard,
  MessagesSquare,
  ReceiptText,
  Sparkles,
  Target,
  Timer,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react'
import { BotaoApresentar } from '@/components/ModoApresentacao'
import { Notificacoes } from '@/components/Notificacoes'
import { useApp } from '@/store/app'
import { ORGAOS, aprovacoesDoOrgao, diligenciasDoOrgao } from '@/data/repo'
import { carteiraDeVigencias, diasAte, resumoPrestacoes } from '@/dominio/ciclo'
import { cn } from '@/lib/format'
import { SeloPerfil } from '@/components/Autorizacao'

interface ItemNav {
  to: string
  rotulo: string
  icone: typeof LayoutDashboard
  fim?: boolean
  /** Chave do contador exibido à direita. */
  contador?: 'aprovacoes' | 'vigencias' | 'contas' | 'diligencias'
}

/**
 * Navegação em grupos.
 *
 * Com dezoito telas, lista plana vira parede. Os grupos seguem a cabeça de quem
 * usa: primeiro a carteira, depois o dinheiro, o prazo, a casa, a inteligência
 * e por último o que serve para apresentar.
 */
const GRUPOS: { titulo: string; itens: ItemNav[] }[] = [
  {
    titulo: 'Carteira',
    itens: [
      { to: '/', rotulo: 'Painel', icone: LayoutDashboard, fim: true },
      { to: '/meu-dia', rotulo: 'Meu dia', icone: Sunrise },
      { to: '/propostas', rotulo: 'Propostas', icone: FileStack },
      { to: '/aprovacoes', rotulo: 'Aprovações', icone: ShieldCheck, contador: 'aprovacoes' },
    ],
  },
  {
    titulo: 'Recurso',
    itens: [
      { to: '/emendas', rotulo: 'Emendas', icone: Landmark },
      { to: '/orcamento', rotulo: 'Orçamento', icone: Wallet },
    ],
  },
  {
    titulo: 'Prazo',
    itens: [
      { to: '/vigencias', rotulo: 'Vigências', icone: Timer, contador: 'vigencias' },
      { to: '/contas', rotulo: 'Prestação de contas', icone: ReceiptText, contador: 'contas' },
      { to: '/diligencias', rotulo: 'Diligências', icone: Mails, contador: 'diligencias' },
    ],
  },
  {
    titulo: 'Casa',
    itens: [
      { to: '/equipe', rotulo: 'Equipe', icone: Users },
      { to: '/ritos', rotulo: 'Ritos', icone: GitBranch },
      { to: '/minutas', rotulo: 'Minutas', icone: ScrollText },
      { to: '/documentos', rotulo: 'Documentos', icone: FileStack },
      { to: '/extensao', rotulo: 'Extensão', icone: Puzzle },
      { to: '/cofre', rotulo: 'Cofre de sessões', icone: KeyRound },
      { to: '/usuarios', rotulo: 'Usuários', icone: UserCog },
      { to: '/auditoria', rotulo: 'Auditoria', icone: Building2 },
    ],
  },
  {
    titulo: 'Inteligência',
    itens: [
      { to: '/cleo', rotulo: 'Cleo', icone: Sparkles },
      { to: '/cerebro', rotulo: 'Cérebro', icone: BrainCircuit },
      { to: '/assistente', rotulo: 'Assistente', icone: MessagesSquare },
      { to: '/padroes', rotulo: 'Padrões', icone: Fingerprint },
    ],
  },
  {
    titulo: 'Apresentar',
    itens: [
      { to: '/situacao', rotulo: 'Sala de situação', icone: MonitorPlay },
      { to: '/relatorio', rotulo: 'Relatório', icone: FileText },
      { to: '/comparar', rotulo: 'Comparar', icone: Columns3 },
      { to: '/paineis', rotulo: 'Meus painéis', icone: Boxes },
      { to: '/ganho', rotulo: 'O ganho', icone: Gauge },
    ],
  },
]

/** A prefeitura tem outra vida: pede, acompanha e responde diligência. */
const GRUPOS_PREFEITURA: { titulo: string; itens: ItemNav[] }[] = [
  {
    titulo: 'Solicitar',
    itens: [
      { to: '/prefeitura', rotulo: 'Início', icone: LayoutDashboard, fim: true },
      { to: '/prefeitura', rotulo: 'Oportunidades', icone: Target },
      { to: '/prefeitura', rotulo: 'Meus pedidos', icone: FileStack },
    ],
  },
  {
    titulo: 'Inteligência',
    itens: [
      { to: '/cleo', rotulo: 'Cleo', icone: Sparkles },
      { to: '/assistente', rotulo: 'Assistente', icone: MessagesSquare },
    ],
  },
]

export function Shell({ children }: { children: React.ReactNode }) {
  const { orgaoId, setOrgaoId, aprovacoes, tema, alternarTema, comparacao, modulo, setModulo } =
    useApp()
  const { pathname } = useLocation()

  const pendentes = aprovacoesDoOrgao(orgaoId).filter(
    (a) => aprovacoes.find((x) => x.id === a.id)?.decidida === 'pendente',
  ).length
  const vigenciasCriticas = carteiraDeVigencias(orgaoId).filter(
    (v) => v.situacao.diasRestantes >= 0 && v.situacao.diasRestantes <= 30,
  ).length
  const contasAtrasadas = resumoPrestacoes(orgaoId).atrasadas
  const diligenciasVencidas = diligenciasDoOrgao(orgaoId).filter(
    (d) => !d.respondidaEm && diasAte(d.prazo) < 0,
  ).length

  const contadores = {
    aprovacoes: pendentes,
    vigencias: vigenciasCriticas,
    contas: contasAtrasadas,
    diligencias: diligenciasVencidas,
  }

  // Cérebro e Cleo ocupam toda a área de conteúdo; a sala de situação dispensa
  // até a navegação — é painel de parede, não tela de trabalho.
  const telaCheia = pathname === '/cerebro' || pathname === '/situacao' || pathname === '/cleo'
  const semNavegacao = pathname === '/situacao'

  if (semNavegacao) {
    return (
      <main id="conteudo" className="min-h-screen">
        {children}
      </main>
    )
  }

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
        className="fixed inset-y-0 left-0 z-30 flex w-[218px] flex-col border-r border-line bg-abyss/80 backdrop-blur-xl"
      >
        <div className="flex items-center gap-2.5 px-5 py-4">
          <img src="/marca/mark.png" alt="" className="size-8 rounded-md" />
          <div>
            <div className="font-display text-[15px] font-semibold tracking-[0.14em] text-ink">
              CLEOPATRA
            </div>
            <div className="eyebrow mt-0.5">Gestão de convênios</div>
          </div>
        </div>

        {/* O switch entre os dois lados do balcão: quem analisa e quem pede */}
        <div className="px-3 pb-2.5">
          <div className="flex rounded-lg border border-line bg-abyss/60 p-0.5">
            {(
              [
                ['ministerio', 'Ministério'],
                ['prefeitura', 'Prefeitura'],
              ] as const
            ).map(([id, rotulo]) => (
              <button
                key={id}
                onClick={() => setModulo(id)}
                className={cn(
                  'flex-1 rounded-[6px] px-2 py-1.5 text-[11.5px] transition-colors',
                  modulo === id
                    ? id === 'prefeitura'
                      ? 'bg-teal/15 text-teal'
                      : 'bg-gold/15 text-gold'
                    : 'text-muted hover:text-ink',
                )}
              >
                {rotulo}
              </button>
            ))}
          </div>
        </div>

        <div className="px-3 pb-3">
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

        <div className="flex-1 overflow-y-auto px-3 pb-2">
          {(modulo === 'prefeitura' ? GRUPOS_PREFEITURA : GRUPOS).map((grupo) => (
            <div key={grupo.titulo} className="mb-2">
              <div className="eyebrow mb-0.5 px-3 text-[9px] opacity-70">{grupo.titulo}</div>
              <div className="flex flex-col gap-px">
                {grupo.itens.map(({ to, rotulo, icone: Icone, fim, contador }) => {
                  const valor = contador ? contadores[contador] : 0
                  return (
                    <NavLink
                      key={to}
                      to={to}
                      end={fim}
                      className={({ isActive }) =>
                        cn(
                          'group relative flex items-center gap-2.5 rounded-lg px-3 py-[5px] text-[12.5px] transition-colors',
                          isActive
                            ? 'bg-gold/10 text-gold'
                            : 'text-muted hover:bg-white/5 hover:text-ink',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <span className="absolute top-1/2 -left-3 h-4 w-[3px] -translate-y-1/2 rounded-r bg-gold" />
                          )}
                          <Icone size={15} strokeWidth={1.8} className="shrink-0" />
                          <span className="min-w-0 flex-1 truncate">{rotulo}</span>
                          {valor > 0 && (
                            <span
                              className={cn(
                                'num rounded-full px-1.5 py-px text-[10px] font-semibold',
                                contador === 'aprovacoes'
                                  ? 'bg-gold/15 text-gold'
                                  : 'bg-alert/15 text-alert',
                              )}
                            >
                              {valor}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1 border-t border-line px-3 py-2.5">
          {comparacao.length > 0 && (
            <NavLink
              to="/comparar"
              className="flex items-center gap-2 rounded-lg bg-gold/10 px-2 py-1.5 text-[11.5px] text-gold"
            >
              <Columns3 size={12} />
              {comparacao.length} na bandeja
            </NavLink>
          )}
          <Notificacoes />
          <BotaoApresentar />
          <div className="flex gap-1">
            <button
              onClick={() =>
                window.dispatchEvent(
                  new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
                )
              }
              className="flex flex-1 items-center gap-2 rounded-lg px-2 py-2 text-[12px] text-muted transition-colors hover:bg-white/5 hover:text-ink"
            >
              <Command size={12} />
              Buscar
              <kbd className="num ml-auto text-[9.5px] text-faint">Ctrl+K</kbd>
            </button>
            <button
              onClick={alternarTema}
              title={tema === 'escuro' ? 'Tema claro' : 'Tema escuro'}
              aria-label="Alternar tema"
              className="rounded-lg px-2 py-2 text-muted transition-colors hover:bg-white/5 hover:text-ink"
            >
              {tema === 'escuro' ? <Sun size={13} /> : <Moon size={13} />}
            </button>
          </div>
          <SeloPerfil className="mb-1" />
          <div className="flex items-center gap-2 px-2 pt-1 text-[10.5px] text-faint">
            <Sparkles size={11} className="text-cleo" />
            <span>Cleo ativa · v3</span>
          </div>
        </div>
      </nav>

      <main id="conteudo" className={cn('ml-[218px] flex-1', telaCheia ? '' : 'px-8 py-7')}>
        {/* A chave pela rota reinicia a animação de entrada a cada navegação */}
        <div key={pathname} className={telaCheia ? '' : 'pagina-entra'}>
          {children}
        </div>
      </main>
    </div>
  )
}
