import { useMemo, useState } from 'react'
import {
  ArrowUpRight,
  Check,
  Lock,
  Minus,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  Users as UsersIcon,
} from 'lucide-react'
import { useApp } from '@/store/app'
import { getOrgao } from '@/data/repo'
import {
  distribuicaoPorAlcada,
  GRUPOS_PERMISSAO,
  impacto,
  PERFIL_POR_ID,
  PERFIS,
  PERMISSOES,
  permissoesDe,
  type Permissao,
  type PerfilId,
  type Usuario,
} from '@/dominio/permissoes'
import { usePermissao } from '@/dominio/usePermissao'
import { cn, desde, moeda, moedaCompacta, numero } from '@/lib/format'
import { Badge, Botao, Panel, PanelHeader } from '@/components/ui'
import { Abas, Avatar, Medidor, Numero } from '@/components/dados'

/**
 * Usuários e permissões.
 *
 * A tela que o gestor precisa ver para dormir tranquilo: quem é quem, o que
 * cada perfil pode, até quanto decide sozinho, e — o que ninguém mostra — o
 * efeito prático disso na carteira real. Trocar o perfil de alguém aqui muda
 * o que a plataforma inteira deixa aquela pessoa fazer, inclusive pela Cleo.
 */
export function Usuarios() {
  const { orgaoId, usuarios, salvarUsuario, usuarioAtualId, setUsuarioAtualId, permissoesDoPerfil, salvarPerfilCustom, registrarAuditoria, notificar } = useApp()
  const { eu } = usePermissao()
  const orgao = getOrgao(orgaoId)!
  const [aba, setAba] = useState<'pessoas' | 'perfis' | 'alcada'>('pessoas')
  const [selecionado, setSelecionado] = useState<string | null>(null)

  const doOrgao = useMemo(
    () => usuarios.filter((u) => u.orgaoId === orgaoId),
    [usuarios, orgaoId],
  )
  const detalhe = doOrgao.find((u) => u.id === selecionado)

  const podeConfigurar = permissoesDe(eu).has('permissao.configurar')

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="eyebrow mb-2">Governança</div>
          <h1 className="text-[26px] leading-tight">Usuários e permissões</h1>
          <p className="mt-1.5 max-w-[76ch] text-[13px] text-muted">
            Cada ação da plataforma é uma permissão nomeada, cada perfil tem uma alçada, e a Cleo
            herda a alçada de quem a acionou —{' '}
            <span className="text-ink">ela nunca faz o que a pessoa não poderia fazer sozinha</span>.
          </p>
        </div>
        <SeletorDeQuemSou
          usuarios={doOrgao}
          atual={usuarioAtualId}
          aoTrocar={(id) => {
            setUsuarioAtualId(id)
            const u = usuarios.find((x) => x.id === id)
            notificar({
              tipo: 'aprovacao',
              titulo: `Agora operando como ${u?.nome}`,
              detalhe: `Perfil ${PERFIL_POR_ID.get(u!.perfil)?.nome} — a plataforma inteira se ajusta à alçada dele.`,
              href: '/usuarios',
            })
          }}
        />
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Panel className="px-5 py-4">
          <Numero rotulo="Pessoas no órgão" valor={numero(doOrgao.length)} detalhe={`${doOrgao.filter((u) => u.ativo).length} ativas`} />
        </Panel>
        <Panel className="px-5 py-4">
          <Numero
            rotulo="Podem decidir"
            valor={numero(doOrgao.filter((u) => permissoesDe(u).has('aprovacao.decidir')).length)}
            tom="gold"
            detalhe="Com acesso à fila de aprovações"
          />
        </Panel>
        <Panel className="px-5 py-4">
          <Numero
            rotulo="Sem teto de alçada"
            valor={numero(doOrgao.filter((u) => (PERFIL_POR_ID.get(u.perfil)?.alcada ?? 0) === Infinity).length)}
            tom="cleo"
            detalhe="Ordenadores de despesa"
          />
        </Panel>
        <Panel className="px-5 py-4">
          <Numero
            rotulo="Operação autônoma"
            valor={numero(doOrgao.filter((u) => permissoesDe(u).has('sessao.usar_autonomo')).length)}
            tom="teal"
            detalhe="Podem deixar a Cleo operar sozinha"
          />
        </Panel>
      </div>

      <Abas
        ativa={aba}
        aoTrocar={setAba}
        abas={[
          { id: 'pessoas', rotulo: 'Pessoas', contagem: doOrgao.length },
          { id: 'perfis', rotulo: 'Perfis e permissões', contagem: PERFIS.length },
          { id: 'alcada', rotulo: 'Alçada na carteira' },
        ]}
      />

      {aba === 'pessoas' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] items-start gap-4">
          <Panel className="overflow-hidden">
            <PanelHeader eyebrow="Equipe" titulo={`${doOrgao.length} pessoas no ${orgao.sigla}`} acao={<UsersIcon size={15} className="text-faint" />} />
            <ul className="divide-y divide-line-soft">
              {doOrgao.map((u) => {
                const perfil = PERFIL_POR_ID.get(u.perfil)!
                const eusou = u.id === usuarioAtualId
                return (
                  <li key={u.id}>
                    <button
                      onClick={() => setSelecionado(u.id === selecionado ? null : u.id)}
                      className={cn(
                        'flex w-full items-center gap-3.5 px-5 py-3 text-left transition-colors',
                        u.id === selecionado ? 'bg-gold/[0.06]' : 'hover:bg-white/[0.03]',
                        !u.ativo && 'opacity-50',
                      )}
                    >
                      <Avatar iniciais={u.iniciais} tom={perfil.tom} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[12.5px] text-ink">{u.nome}</span>
                          {eusou && <Badge tom="gold">você</Badge>}
                          {!u.ativo && <Badge tom="inert">desativado</Badge>}
                        </div>
                        <div className="truncate text-[11px] text-faint">{u.cargo}</div>
                      </div>
                      <Badge tom={perfil.tom}>{perfil.nome}</Badge>
                      <span className="num w-[92px] shrink-0 text-right text-[11.5px] text-muted">
                        {perfil.alcada === Infinity ? 'sem teto' : moedaCompacta(perfil.alcada)}
                      </span>
                      <span className="w-[76px] shrink-0 text-right text-[10.5px] text-faint">
                        {desde(u.ultimoAcesso)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </Panel>

          {detalhe ? (
            <FichaUsuario
              usuario={detalhe}
              podeEditar={podeConfigurar}
              aoSalvar={(u) => {
                salvarUsuario(u)
                registrarAuditoria({
                  tipo: 'acesso',
                  ator: eu.nome,
                  acao: 'Alterou perfil de usuário',
                  alvo: u.nome,
                  detalhe: `Perfil agora é ${PERFIL_POR_ID.get(u.perfil)?.nome}.`,
                })
              }}
            />
          ) : (
            <Panel>
              <PanelHeader eyebrow="Ficha" titulo="Selecione uma pessoa" />
              <p className="px-5 py-8 text-[12.5px] leading-relaxed text-muted">
                A ficha mostra o que a pessoa pode fazer, quanto decide sozinha e — o que importa de
                verdade — o efeito disso na carteira que ela carrega hoje.
              </p>
            </Panel>
          )}
        </div>
      )}

      {aba === 'perfis' && (
        <MatrizPermissoes
          podeEditar={podeConfigurar}
          custom={permissoesDoPerfil}
          aoSalvar={(perfil, permissoes) => {
            salvarPerfilCustom(perfil, permissoes)
            registrarAuditoria({
              tipo: 'acesso',
              ator: eu.nome,
              acao: 'Configurou permissões de perfil',
              alvo: PERFIL_POR_ID.get(perfil)?.nome ?? perfil,
              detalhe: `${permissoes.length} permissões ativas no perfil.`,
            })
          }}
        />
      )}

      {aba === 'alcada' && <AlcadaNaCarteira orgaoId={orgaoId} />}
    </div>
  )
}

/* ---------- Trocar de quem sou ---------- */

function SeletorDeQuemSou({
  usuarios,
  atual,
  aoTrocar,
}: {
  usuarios: Usuario[]
  atual: string
  aoTrocar: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-gold/30 bg-gold/[0.05] px-4 py-2.5">
      <UserCog size={15} className="shrink-0 text-gold" />
      <div>
        <div className="eyebrow mb-0.5">Operando como</div>
        <select
          value={atual}
          onChange={(e) => aoTrocar(e.target.value)}
          className="h-7 max-w-[260px] cursor-pointer rounded border border-line bg-raised px-2 text-[12.5px] text-ink focus:outline-none"
        >
          {usuarios.map((u) => (
            <option key={u.id} value={u.id} className="bg-surface">
              {u.nome} — {PERFIL_POR_ID.get(u.perfil)?.nome}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

/* ---------- Ficha ---------- */

function FichaUsuario({
  usuario,
  podeEditar,
  aoSalvar,
}: {
  usuario: Usuario
  podeEditar: boolean
  aoSalvar: (u: Usuario) => void
}) {
  const perfil = PERFIL_POR_ID.get(usuario.perfil)!
  const dados = useMemo(() => impacto(usuario), [usuario])
  const conjunto = permissoesDe(usuario)

  return (
    <Panel className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        <Avatar iniciais={usuario.iniciais} tom={perfil.tom} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] text-ink">{usuario.nome}</div>
          <div className="truncate text-[11.5px] text-muted">{usuario.cargo}</div>
        </div>
        <Badge tom={perfil.tom} ponto>
          {perfil.nome}
        </Badge>
      </div>

      <div className="px-5 py-4">
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Numero
            rotulo="Alçada"
            valor={perfil.alcada === Infinity ? 'sem teto' : moeda(perfil.alcada)}
            tom={perfil.alcada === Infinity ? 'cleo' : 'gold'}
            detalhe="Decide sozinho até este valor"
          />
          <Numero
            rotulo="Carteira sob gestão"
            valor={moedaCompacta(dados.valorSobGestao)}
            detalhe={`${dados.propostas.length} propostas atribuídas`}
          />
        </div>

        {dados.acimaDaAlcada > 0 && (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-gold/30 bg-gold/[0.06] px-3.5 py-2.5">
            <ArrowUpRight size={14} className="mt-0.5 shrink-0 text-gold" />
            <p className="text-[11.5px] leading-relaxed text-muted">
              <span className="text-ink">{dados.acimaDaAlcada} propostas</span> da carteira desta
              pessoa passam da alçada dela. Nessas, a decisão sobe automaticamente para quem tem
              teto maior — e a fila de aprovação já sabe disso.
            </p>
          </div>
        )}

        <div className="eyebrow mb-2">Perfil</div>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {PERFIS.map((p) => (
            <button
              key={p.id}
              disabled={!podeEditar}
              onClick={() => aoSalvar({ ...usuario, perfil: p.id })}
              className={cn(
                'rounded-lg border px-2.5 py-1.5 text-[11.5px] transition-colors disabled:opacity-40',
                usuario.perfil === p.id
                  ? 'border-gold/50 bg-gold/12 text-gold'
                  : 'border-line text-muted hover:text-ink',
              )}
            >
              {p.nome}
            </button>
          ))}
        </div>

        <div className="eyebrow mb-2">O que pode fazer</div>
        <ul className="flex flex-col gap-1.5">
          {GRUPOS_PERMISSAO.map((grupo) => {
            const doGrupo = PERMISSOES.filter((p) => p.grupo === grupo)
            const tem = doGrupo.filter((p) => conjunto.has(p.id)).length
            return (
              <li key={grupo}>
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-[11.5px] text-muted">{grupo}</span>
                  <span className="num text-[11px] text-faint">
                    {tem}/{doGrupo.length}
                  </span>
                </div>
                <Medidor valor={tem / doGrupo.length} tom={tem === doGrupo.length ? 'teal' : tem > 0 ? 'gold' : 'inert'} altura={4} />
              </li>
            )
          })}
        </ul>

        <div className="mt-4 flex items-center gap-2 border-t border-line pt-4">
          <Botao
            tamanho="sm"
            variante={usuario.ativo ? 'perigo' : 'primario'}
            disabled={!podeEditar}
            onClick={() => aoSalvar({ ...usuario, ativo: !usuario.ativo })}
          >
            {usuario.ativo ? 'Desativar acesso' : 'Reativar acesso'}
          </Botao>
          {!podeEditar && (
            <span className="flex items-center gap-1.5 text-[11px] text-faint">
              <Lock size={11} /> só quem tem "Configurar permissões"
            </span>
          )}
        </div>
      </div>
    </Panel>
  )
}

/* ---------- Matriz ---------- */

function MatrizPermissoes({
  podeEditar,
  custom,
  aoSalvar,
}: {
  podeEditar: boolean
  custom: Record<string, Permissao[] | undefined>
  aoSalvar: (perfil: PerfilId, permissoes: Permissao[]) => void
}) {
  const conjuntoDe = (p: PerfilId): Set<Permissao> =>
    new Set(custom[p] ?? PERFIL_POR_ID.get(p)!.permissoes)

  function alternar(perfil: PerfilId, permissao: Permissao) {
    const atual = conjuntoDe(perfil)
    if (atual.has(permissao)) atual.delete(permissao)
    else atual.add(permissao)
    aoSalvar(perfil, [...atual])
  }

  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        eyebrow="Matriz"
        titulo="O que cada perfil pode fazer"
        acao={
          podeEditar ? (
            <span className="flex items-center gap-1.5 text-[11.5px] text-teal">
              <SlidersHorizontal size={12} /> clique para alternar
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[11.5px] text-faint">
              <Lock size={12} /> somente leitura no seu perfil
            </span>
          )
        }
      />

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-line">
              <th className="eyebrow px-5 py-3 font-medium">Permissão</th>
              {PERFIS.map((p) => (
                <th key={p.id} className="px-3 py-3 text-center">
                  <div className={cn('text-[12px]', `text-${p.tom === 'inert' ? 'muted' : p.tom}`)}>{p.nome}</div>
                  <div className="num mt-0.5 text-[10px] text-faint">
                    {p.alcada === Infinity ? 'sem teto' : p.alcada > 0 ? moedaCompacta(p.alcada) : '—'}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GRUPOS_PERMISSAO.map((grupo) => (
              <>
                <tr key={grupo} className="bg-abyss/40">
                  <td colSpan={PERFIS.length + 1} className="eyebrow px-5 py-2">
                    {grupo}
                  </td>
                </tr>
                {PERMISSOES.filter((p) => p.grupo === grupo).map((perm) => (
                  <tr key={perm.id} className="border-b border-line-soft last:border-0">
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[12.5px] text-ink">{perm.rotulo}</span>
                        {perm.sensivel && (
                          <span title="Permissão sensível — registro reforçado na trilha">
                            <ShieldAlert size={11} className="text-gold" />
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[10.5px] text-faint">{perm.descricao}</div>
                    </td>
                    {PERFIS.map((p) => {
                      const tem = conjuntoDe(p.id).has(perm.id)
                      return (
                        <td key={p.id} className="px-3 py-2.5 text-center">
                          <button
                            disabled={!podeEditar}
                            onClick={() => alternar(p.id, perm.id)}
                            className={cn(
                              'inline-flex size-6 items-center justify-center rounded-md border transition-colors disabled:cursor-default',
                              tem
                                ? 'border-teal/40 bg-teal/15 text-teal'
                                : 'border-line text-faint hover:border-[#2c3c58]',
                            )}
                            aria-label={`${perm.rotulo} para ${p.nome}`}
                          >
                            {tem ? <Check size={12} /> : <Minus size={11} />}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>

      <p className="border-t border-line px-5 py-3.5 text-[11.5px] leading-relaxed text-muted">
        Alterar a matriz muda a plataforma inteira na hora: botões somem, ações passam a exigir
        aprovação e a Cleo deixa de oferecer o que aquele perfil não pode fazer. As mudanças ficam
        na trilha de auditoria com quem as fez.
      </p>
    </Panel>
  )
}

/* ---------- Alçada na carteira ---------- */

function AlcadaNaCarteira({ orgaoId }: { orgaoId: string }) {
  const dist = useMemo(() => distribuicaoPorAlcada(orgaoId), [orgaoId])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
      <Panel>
        <PanelHeader eyebrow="Cruzamento" titulo="Quanto da carteira cada perfil decide sozinho" acao={<ShieldCheck size={15} className="text-teal" />} />
        <ul className="flex flex-col gap-4 px-5 py-5">
          {dist.map((d) => (
            <li key={d.perfil.id}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="text-[12.5px] text-ink">{d.perfil.nome}</span>
                <span className="num text-[11.5px] text-muted">
                  {numero(d.qtd)} propostas · {moedaCompacta(d.valor)}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <Medidor valor={d.fracao} tom={d.perfil.tom === 'inert' ? 'inert' : d.perfil.tom} />
                <span className="num w-10 shrink-0 text-right text-[11.5px] text-muted">
                  {(d.fracao * 100).toFixed(0)}%
                </span>
              </div>
              <div className="mt-1 text-[10.5px] text-faint">
                alçada de {d.perfil.alcada === Infinity ? 'sem teto' : moeda(d.perfil.alcada)}
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel>
        <PanelHeader eyebrow="Por que isso importa" titulo="A régua que a Cleo obedece" />
        <div className="flex flex-col gap-4 px-5 py-5 text-[12.5px] leading-relaxed text-muted">
          <p>
            <span className="text-ink">A Cleo herda a alçada de quem a acionou.</span> Se um analista
            manda instruir uma proposta de R$ 8 milhões, ela instrui — mas a aprovação final entra na
            fila de quem tem teto para aquele valor.
          </p>
          <p>
            <span className="text-ink">Nada acontece fora da hierarquia.</span> Um rito em lote
            disparado por quem não tem "Executar em lote" simplesmente não aparece como opção — e a
            tentativa fica registrada.
          </p>
          <p>
            <span className="text-ink">A trilha guarda a autoridade, não só a ação.</span> Cada
            evento registra quem fez, com qual perfil e sob qual alçada — é o que responde a um
            questionamento de controle sem reconstituir memória.
          </p>
          <div className="rounded-lg border border-teal/25 bg-teal/[0.05] px-4 py-3 text-[11.5px]">
            Troque de pessoa no seletor acima e navegue pela plataforma: os botões que ela não pode
            usar aparecem bloqueados, com o motivo e a quem o pedido sobe.
          </div>
        </div>
      </Panel>
    </div>
  )
}
