import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDown,
  ArrowUp,
  Clock3,
  Copy,
  GitBranch,
  Layers,
  Play,
  Plus,
  Save,
  Trash2,
  Workflow,
  Zap,
} from 'lucide-react'
import { useApp } from '@/store/app'
import { Estudio } from '@/automacao/Estudio'
import { getOrgao, getProponente, propostasDoOrgao } from '@/data/repo'
import {
  avaliarRegra,
  CAMPOS,
  descreverRegra,
  formatarEspera,
  inferirFila,
  OPERADORES,
  PASSOS_DISPONIVEIS,
  proximaExecucao,
  ROTULO_RECORRENCIA,
} from '@/automacao/regras'
import { cn, duracao, numero } from '@/lib/format'
import { Badge, Botao, Campo, Panel, PanelHeader, Vazio } from '@/components/ui'
import { Abas, Medidor, Numero } from '@/components/dados'
import type { CondicaoRegra, PassoRito, RegraGatilho, Rito, TipoPasso } from '@/data/types'

/**
 * Ritos.
 *
 * A promessa do pitch é "qualquer automação". Ela só é crível quando o cliente
 * vê um rito nascer na tela, sem código, e rodar em seguida. Esta tela existe
 * para isso — e para mostrar a máquina em volta: regras, fila e agendamento.
 */
export function Ritos() {
  const [aba, setAba] = useState<'biblioteca' | 'estudio' | 'editor' | 'regras' | 'fila'>(
    'biblioteca',
  )
  const { ritos, regras } = useApp()
  const [editando, setEditando] = useState<Rito | null>(null)

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="eyebrow mb-2">Automação sem código</div>
          <h1 className="text-[26px] leading-tight">Ritos</h1>
          <p className="mt-1.5 max-w-[74ch] text-[13px] text-muted">
            Um rito é uma sequência de passos que a Cleo executa nos sistemas oficiais. Aqui eles
            são montados, publicados, condicionados a regra e agendados — sem passar pela TI.
          </p>
        </div>
        <Botao
          variante="primario"
          onClick={() => {
            setEditando(null)
            setAba('editor')
          }}
        >
          <Plus size={13} /> Novo rito
        </Botao>
      </header>

      <Abas
        ativa={aba}
        aoTrocar={setAba}
        abas={[
          { id: 'biblioteca', rotulo: 'Biblioteca', contagem: ritos.length },
          { id: 'estudio', rotulo: 'Estúdio visual' },
          { id: 'editor', rotulo: 'Editor em lista' },
          { id: 'regras', rotulo: 'Regras', contagem: regras.length },
          { id: 'fila', rotulo: 'Fila e agendamento' },
        ]}
      />

      {aba === 'estudio' && <Estudio />}
      {aba === 'biblioteca' && (
        <Biblioteca
          aoEditar={(r) => {
            setEditando(r)
            setAba('editor')
          }}
        />
      )}
      {aba === 'editor' && <Editor base={editando} aoSalvar={() => setAba('biblioteca')} />}
      {aba === 'regras' && <Regras />}
      {aba === 'fila' && <Fila />}
    </div>
  )
}

/* ==================== Biblioteca ==================== */

function Biblioteca({ aoEditar }: { aoEditar: (r: Rito) => void }) {
  const { ritos, orgaoId, abrirExecucao, abrirLote, removerRito, salvarRito } = useApp()
  const propostas = useMemo(() => propostasDoOrgao(orgaoId), [orgaoId])

  function duplicar(rito: Rito) {
    salvarRito({
      ...rito,
      id: `rt-${Date.now()}`,
      nome: `${rito.nome} (cópia)`,
      deFabrica: false,
      publicado: false,
      autor: 'Você',
      criadoEm: new Date().toISOString(),
      execucoes: 0,
    })
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {ritos.map((rito) => {
        const alvo = propostas.find((p) => p.numProcessoSei) ?? propostas[0]
        return (
          <Panel key={rito.id} className="flex flex-col overflow-hidden">
            <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
              <div className="min-w-0">
                <div className="mb-1.5 flex items-center gap-2">
                  <Workflow size={13} className="shrink-0 text-cleo" />
                  <h3 className="truncate text-[15px]">{rito.nome}</h3>
                </div>
                <p className="text-[12px] leading-relaxed text-muted">{rito.descricao}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <Badge tom={rito.sistema === 'SEI' ? 'teal' : rito.sistema === 'Ambos' ? 'cleo' : 'gold'}>
                  {rito.sistema}
                </Badge>
                {!rito.deFabrica && <Badge tom="inert">seu</Badge>}
              </div>
            </div>

            <ol className="flex flex-wrap gap-1.5 px-5 py-3.5">
              {rito.passos.map((p, i) => (
                <li
                  key={p.id}
                  className="flex items-center gap-1.5 rounded-md border border-line bg-raised px-2 py-1 text-[11px] text-muted"
                >
                  <span className="num text-faint">{i + 1}</span>
                  {p.rotulo}
                </li>
              ))}
            </ol>

            <div className="grid grid-cols-3 gap-4 border-t border-line-soft px-5 py-3.5">
              <Numero rotulo="Execuções" valor={numero(rito.execucoes)} />
              <Numero
                rotulo="Sucesso"
                valor={`${(rito.taxaSucesso * 100).toFixed(1)}%`}
                tom={rito.taxaSucesso > 0.95 ? 'teal' : 'gold'}
              />
              <Numero rotulo="Tempo médio" valor={duracao(rito.duracaoMediaMs)} />
            </div>

            <div className="mt-auto flex items-center gap-2 border-t border-line px-5 py-3">
              <Botao
                tamanho="sm"
                variante="primario"
                disabled={!alvo}
                onClick={() =>
                  alvo &&
                  abrirExecucao({ propostaId: alvo.id, fila: rito.fila, titulo: rito.nome })
                }
              >
                <Play size={11} fill="currentColor" /> Executar
              </Botao>
              <Botao
                tamanho="sm"
                onClick={() =>
                  abrirLote({
                    ritoId: rito.id,
                    titulo: `${rito.nome} — 12 propostas`,
                    propostaIds: propostas.slice(0, 12).map((p) => p.id),
                  })
                }
              >
                <Layers size={11} /> Em lote
              </Botao>
              <Botao tamanho="sm" variante="fantasma" onClick={() => duplicar(rito)}>
                <Copy size={11} /> Duplicar
              </Botao>
              <div className="flex-1" />
              {rito.deFabrica ? (
                <span className="text-[11px] text-faint">de fábrica</span>
              ) : (
                <>
                  <Botao tamanho="sm" variante="fantasma" onClick={() => aoEditar(rito)}>
                    Editar
                  </Botao>
                  <Botao tamanho="sm" variante="fantasma" onClick={() => removerRito(rito.id)}>
                    <Trash2 size={11} />
                  </Botao>
                </>
              )}
            </div>
          </Panel>
        )
      })}
    </div>
  )
}

/* ==================== Editor ==================== */

const RITO_VAZIO: Rito = {
  id: '',
  nome: '',
  descricao: '',
  sistema: 'SEI',
  passos: [],
  fila: ['criar_documento'],
  execucoes: 0,
  taxaSucesso: 1,
  duracaoMediaMs: 0,
  publicado: false,
  autor: 'Você',
  criadoEm: '',
  deFabrica: false,
}

function Editor({ base, aoSalvar }: { base: Rito | null; aoSalvar: () => void }) {
  const { salvarRito, orgaoId, abrirExecucao, registrarAuditoria, notificar } = useApp()
  const [rito, setRito] = useState<Rito>(base ?? RITO_VAZIO)

  useEffect(() => setRito(base ?? RITO_VAZIO), [base])

  const propostas = useMemo(() => propostasDoOrgao(orgaoId), [orgaoId])
  const duracaoEstimada = rito.passos.length * 7_400

  function adicionar(tipo: TipoPasso) {
    const modelo = PASSOS_DISPONIVEIS.find((p) => p.tipo === tipo)!
    const passo: PassoRito = {
      id: `p-${Date.now()}-${rito.passos.length}`,
      tipo,
      rotulo: modelo.rotulo,
      parametro: '',
    }
    setRito((r) => ({ ...r, passos: [...r.passos, passo] }))
  }

  function mover(indice: number, delta: number) {
    setRito((r) => {
      const passos = [...r.passos]
      const destino = indice + delta
      if (destino < 0 || destino >= passos.length) return r
      ;[passos[indice], passos[destino]] = [passos[destino], passos[indice]]
      return { ...r, passos }
    })
  }

  function salvar() {
    const salvo: Rito = {
      ...rito,
      id: rito.id || `rt-${Date.now()}`,
      criadoEm: rito.criadoEm || new Date().toISOString(),
      duracaoMediaMs: duracaoEstimada,
      fila: inferirFila(rito.passos.map((p) => p.tipo)),
      publicado: true,
    }
    salvarRito(salvo)
    registrarAuditoria({
      tipo: 'regra',
      ator: 'Você',
      acao: base ? 'Editou rito' : 'Publicou rito novo',
      alvo: salvo.nome,
      detalhe: `${salvo.passos.length} passos, sistema ${salvo.sistema}.`,
    })
    notificar({
      tipo: 'automacao',
      titulo: `Rito "${salvo.nome}" publicado`,
      detalhe: 'Já pode ser executado, colocado em lote ou condicionado a uma regra.',
      href: '/ritos',
    })
    aoSalvar()
  }

  const valido = rito.nome.trim().length > 2 && rito.passos.length > 0

  return (
    <div className="grid grid-cols-[280px_1fr_320px] gap-4">
      <Panel className="overflow-hidden">
        <PanelHeader eyebrow="Paleta" titulo="Passos disponíveis" />
        <ul className="max-h-[560px] divide-y divide-line-soft overflow-y-auto">
          {PASSOS_DISPONIVEIS.map((p) => (
            <li key={p.tipo}>
              <button
                onClick={() => adicionar(p.tipo)}
                className="w-full px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
              >
                <div className="flex items-center gap-2">
                  <Plus size={11} className="text-cleo" />
                  <span className="text-[12.5px] text-ink">{p.rotulo}</span>
                </div>
                <p className="mt-1 pl-[19px] text-[11px] leading-relaxed text-muted">
                  {p.descricao}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel className="overflow-hidden">
        <PanelHeader
          eyebrow={base ? 'Editando' : 'Novo rito'}
          titulo={rito.nome || 'Sem nome ainda'}
          acao={
            <span className="num text-[12px] text-muted">
              {rito.passos.length} passos · ~{duracao(duracaoEstimada)}
            </span>
          }
        />

        <div className="flex flex-col gap-3 border-b border-line px-5 py-4">
          <Campo
            placeholder="Nome do rito — ex.: Instruir proposta de defesa civil"
            value={rito.nome}
            onChange={(e) => setRito({ ...rito, nome: e.target.value })}
          />
          <Campo
            placeholder="O que este rito faz, em uma frase"
            value={rito.descricao}
            onChange={(e) => setRito({ ...rito, descricao: e.target.value })}
          />
          <div className="flex items-center gap-2">
            <span className="eyebrow">Sistema</span>
            {(['SEI', 'TransfereGov', 'Ambos'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setRito({ ...rito, sistema: s })}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-[11.5px] transition-colors',
                  rito.sistema === s
                    ? 'border-gold/40 bg-gold/10 text-gold'
                    : 'border-line text-muted hover:text-ink',
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {rito.passos.length === 0 ? (
          <Vazio titulo="Clique nos passos da paleta à esquerda para montar o rito." />
        ) : (
          <ol className="divide-y divide-line-soft">
            {rito.passos.map((passo, i) => {
              const modelo = PASSOS_DISPONIVEIS.find((p) => p.tipo === passo.tipo)
              return (
                <li key={passo.id} className="flex items-start gap-3 px-5 py-3">
                  <span className="num mt-1.5 w-5 shrink-0 text-[11.5px] text-faint">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] text-ink">{passo.rotulo}</div>
                    {modelo?.pedeParametro && (
                      <input
                        value={passo.parametro ?? ''}
                        placeholder={modelo.pedeParametro}
                        onChange={(e) =>
                          setRito((r) => ({
                            ...r,
                            passos: r.passos.map((p) =>
                              p.id === passo.id ? { ...p, parametro: e.target.value } : p,
                            ),
                          }))
                        }
                        className="mt-1.5 h-7 w-full rounded border border-line bg-abyss/50 px-2 text-[11.5px] text-muted focus:border-gold/50 focus:outline-none"
                      />
                    )}
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <button
                      onClick={() => mover(i, -1)}
                      className="rounded p-1 text-faint hover:text-ink"
                      aria-label="Subir passo"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      onClick={() => mover(i, 1)}
                      className="rounded p-1 text-faint hover:text-ink"
                      aria-label="Descer passo"
                    >
                      <ArrowDown size={12} />
                    </button>
                    <button
                      onClick={() =>
                        setRito((r) => ({ ...r, passos: r.passos.filter((p) => p.id !== passo.id) }))
                      }
                      className="rounded p-1 text-faint hover:text-alert"
                      aria-label="Remover passo"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </li>
              )
            })}
          </ol>
        )}

        <div className="flex items-center gap-2 border-t border-line px-5 py-4">
          <Botao variante="primario" disabled={!valido} onClick={salvar}>
            <Save size={12} /> Publicar rito
          </Botao>
          <Botao
            disabled={!valido || propostas.length === 0}
            onClick={() =>
              abrirExecucao({
                propostaId: propostas[0].id,
                fila: inferirFila(rito.passos.map((p) => p.tipo)),
                titulo: `${rito.nome} (teste)`,
              })
            }
          >
            <Play size={12} /> Testar agora
          </Botao>
          <span className="ml-auto text-[11px] text-faint">
            O teste roda na simulação, como toda execução da plataforma.
          </span>
        </div>
      </Panel>

      <Panel>
        <PanelHeader eyebrow="Como funciona" titulo="O que a Cleo faz com isso" />
        <div className="flex flex-col gap-4 px-5 py-5 text-[12.5px] leading-relaxed text-muted">
          <p>
            Cada passo vira uma ação no navegador da automação: abrir tela, localizar campo,
            digitar, clicar, conferir o resultado.
          </p>
          <p>
            O rito publicado fica disponível para execução avulsa, execução em lote e para ser
            disparado por regra — sem precisar de nova versão do sistema.
          </p>
          <p>
            <span className="text-ink">Falha não perde trabalho.</span> Se a sessão do SEI cair no
            passo 4, a retomada volta no passo 4.
          </p>
          <div className="rounded-lg border border-cleo/25 bg-cleo/[0.05] px-4 py-3">
            <div className="eyebrow mb-1.5">Nesta plataforma</div>
            <p className="text-[11.5px]">
              Nenhum passo toca os sistemas oficiais. A execução é reconstruída na tela, com o
              mesmo contrato de eventos que um worker real emitiria.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  )
}

/* ==================== Regras ==================== */

const REGRA_VAZIA = (ritoId: string): RegraGatilho => ({
  id: '',
  nome: '',
  ritoId,
  condicoes: [{ id: 'c1', campo: 'situacao', operador: 'igual', valor: '' }],
  juncao: 'todas',
  ativa: true,
  recorrencia: 'diaria',
  horario: '03:00',
  disparos: 0,
})

function Regras() {
  const { regras, ritos, orgaoId, alternarRegra, salvarRegra, removerRegra, registrarAuditoria } =
    useApp()
  const [rascunho, setRascunho] = useState<RegraGatilho | null>(null)

  const alcance = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const r of regras) mapa.set(r.id, avaliarRegra(r, orgaoId).length)
    return mapa
  }, [regras, orgaoId])

  const previa = useMemo(
    () => (rascunho ? avaliarRegra(rascunho, orgaoId) : []),
    [rascunho, orgaoId],
  )

  return (
    <div className="grid grid-cols-[1.35fr_1fr] gap-4">
      <Panel className="overflow-hidden">
        <PanelHeader
          eyebrow="Publicadas"
          titulo="Regras que disparam ritos sozinhas"
          acao={
            <Botao
              tamanho="sm"
              onClick={() => setRascunho(REGRA_VAZIA(ritos[0]?.id ?? 'rt-autuar'))}
            >
              <Plus size={11} /> Nova regra
            </Botao>
          }
        />
        <ul className="divide-y divide-line-soft">
          {regras.map((regra) => {
            const rito = ritos.find((r) => r.id === regra.ritoId)
            const pegaria = alcance.get(regra.id) ?? 0
            return (
              <li key={regra.id} className="px-5 py-4">
                <div className="mb-2 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <GitBranch size={12} className={regra.ativa ? 'text-teal' : 'text-inert'} />
                      <span className="truncate text-[13px] text-ink">{regra.nome}</span>
                    </div>
                    <p className="mt-1 text-[11.5px] text-muted">{descreverRegra(regra)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tom={regra.ativa ? 'teal' : 'inert'} ponto>
                      {regra.ativa ? 'ativa' : 'pausada'}
                    </Badge>
                    <button
                      onClick={() => alternarRegra(regra.id)}
                      className="text-[11.5px] text-muted hover:text-ink"
                    >
                      {regra.ativa ? 'Pausar' : 'Ativar'}
                    </button>
                    {!regra.id.startsWith('rg') && (
                      <button
                        onClick={() => removerRegra(regra.id)}
                        className="text-faint hover:text-alert"
                        aria-label="Remover regra"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-[11.5px] text-faint">
                  <span className="flex items-center gap-1.5">
                    <Zap size={10} className="text-cleo" />
                    executa <span className="text-muted">{rito?.nome ?? '—'}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock3 size={10} />
                    {ROTULO_RECORRENCIA[regra.recorrencia]}
                    {regra.recorrencia !== 'nenhuma' && ` às ${regra.horario}`}
                  </span>
                  <span className="num">{numero(regra.disparos)} disparos</span>
                  <span className={cn('num ml-auto', pegaria > 0 ? 'text-gold' : 'text-faint')}>
                    pegaria {pegaria} proposta(s) hoje
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      </Panel>

      <Panel className="overflow-hidden">
        <PanelHeader
          eyebrow={rascunho ? 'Nova regra' : 'Construtor'}
          titulo={rascunho ? 'Monte a condição' : 'Nenhuma regra em edição'}
        />
        {!rascunho ? (
          <Vazio
            titulo="Crie uma regra para ver, antes de publicar, quantas propostas ela pegaria hoje."
            acao={
              <Botao onClick={() => setRascunho(REGRA_VAZIA(ritos[0]?.id ?? 'rt-autuar'))}>
                <Plus size={12} /> Nova regra
              </Botao>
            }
          />
        ) : (
          <div className="flex flex-col gap-3.5 px-5 py-4">
            <Campo
              placeholder="Nome da regra"
              value={rascunho.nome}
              onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })}
            />

            <div>
              <div className="eyebrow mb-1.5">Executar o rito</div>
              <select
                value={rascunho.ritoId}
                onChange={(e) => setRascunho({ ...rascunho, ritoId: e.target.value })}
                className="h-9 w-full rounded-lg border border-line bg-raised px-2.5 text-[12.5px] text-ink focus:border-gold/50 focus:outline-none"
              >
                {ritos.map((r) => (
                  <option key={r.id} value={r.id} className="bg-surface">
                    {r.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="eyebrow">Condições</span>
                <div className="flex items-center gap-1">
                  {(['todas', 'qualquer'] as const).map((j) => (
                    <button
                      key={j}
                      onClick={() => setRascunho({ ...rascunho, juncao: j })}
                      className={cn(
                        'rounded px-2 py-0.5 text-[11px]',
                        rascunho.juncao === j ? 'bg-gold/15 text-gold' : 'text-faint hover:text-ink',
                      )}
                    >
                      {j === 'todas' ? 'todas (E)' : 'qualquer (OU)'}
                    </button>
                  ))}
                </div>
              </div>

              <ul className="flex flex-col gap-2">
                {rascunho.condicoes.map((c) => (
                  <li key={c.id} className="flex gap-1.5">
                    <select
                      value={c.campo}
                      onChange={(e) =>
                        setRascunho({
                          ...rascunho,
                          condicoes: rascunho.condicoes.map((x) =>
                            x.id === c.id
                              ? { ...x, campo: e.target.value as CondicaoRegra['campo'] }
                              : x,
                          ),
                        })
                      }
                      className="h-8 min-w-0 flex-1 rounded border border-line bg-raised px-1.5 text-[11.5px] text-ink focus:outline-none"
                    >
                      {CAMPOS.map((campo) => (
                        <option key={campo.id} value={campo.id} className="bg-surface">
                          {campo.rotulo}
                        </option>
                      ))}
                    </select>
                    <select
                      value={c.operador}
                      onChange={(e) =>
                        setRascunho({
                          ...rascunho,
                          condicoes: rascunho.condicoes.map((x) =>
                            x.id === c.id
                              ? { ...x, operador: e.target.value as CondicaoRegra['operador'] }
                              : x,
                          ),
                        })
                      }
                      className="h-8 w-[92px] shrink-0 rounded border border-line bg-raised px-1.5 text-[11.5px] text-ink focus:outline-none"
                    >
                      {OPERADORES.map((o) => (
                        <option key={o.id} value={o.id} className="bg-surface">
                          {o.rotulo}
                        </option>
                      ))}
                    </select>
                    <input
                      value={c.valor}
                      placeholder="valor"
                      onChange={(e) =>
                        setRascunho({
                          ...rascunho,
                          condicoes: rascunho.condicoes.map((x) =>
                            x.id === c.id ? { ...x, valor: e.target.value } : x,
                          ),
                        })
                      }
                      className="h-8 w-[104px] shrink-0 rounded border border-line bg-abyss/50 px-2 text-[11.5px] text-ink focus:border-gold/50 focus:outline-none"
                    />
                    <button
                      onClick={() =>
                        setRascunho({
                          ...rascunho,
                          condicoes: rascunho.condicoes.filter((x) => x.id !== c.id),
                        })
                      }
                      className="shrink-0 px-1 text-faint hover:text-alert"
                      aria-label="Remover condição"
                    >
                      <Trash2 size={11} />
                    </button>
                  </li>
                ))}
              </ul>

              <button
                onClick={() =>
                  setRascunho({
                    ...rascunho,
                    condicoes: [
                      ...rascunho.condicoes,
                      {
                        id: `c${rascunho.condicoes.length + 1}-${Date.now()}`,
                        campo: 'valorGlobal',
                        operador: 'maior',
                        valor: '',
                      },
                    ],
                  })
                }
                className="mt-2 text-[11.5px] text-cleo hover:underline"
              >
                + condição
              </button>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={rascunho.recorrencia}
                onChange={(e) =>
                  setRascunho({
                    ...rascunho,
                    recorrencia: e.target.value as RegraGatilho['recorrencia'],
                  })
                }
                className="h-8 flex-1 rounded border border-line bg-raised px-2 text-[11.5px] text-ink focus:outline-none"
              >
                {Object.entries(ROTULO_RECORRENCIA).map(([id, rotulo]) => (
                  <option key={id} value={id} className="bg-surface">
                    {rotulo}
                  </option>
                ))}
              </select>
              <input
                type="time"
                value={rascunho.horario}
                onChange={(e) => setRascunho({ ...rascunho, horario: e.target.value })}
                className="num h-8 w-[92px] rounded border border-line bg-abyss/50 px-2 text-[11.5px] text-ink focus:outline-none"
              />
            </div>

            {/* Pré-visualização: o número que impede publicar regra que pega a
                carteira inteira sem querer. */}
            <div
              className={cn(
                'rounded-lg border px-4 py-3',
                previa.length > 0 ? 'border-gold/30 bg-gold/[0.06]' : 'border-line bg-abyss/40',
              )}
            >
              <div className="eyebrow mb-1.5">Se rodasse agora</div>
              <div className="num text-[19px] text-ink">
                {previa.length}
                <span className="ml-1.5 text-[12px] text-muted">propostas</span>
              </div>
              {previa.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1">
                  {previa.slice(0, 4).map((p) => (
                    <li key={p.id} className="truncate text-[11px] text-muted">
                      <span className="num text-faint">{p.numero}</span> ·{' '}
                      {getProponente(p.proponenteId)?.nome}
                    </li>
                  ))}
                  {previa.length > 4 && (
                    <li className="text-[11px] text-faint">e mais {previa.length - 4}</li>
                  )}
                </ul>
              )}
            </div>

            <div className="flex gap-2">
              <Botao
                variante="primario"
                disabled={rascunho.nome.trim().length < 3 || previa.length === 0}
                onClick={() => {
                  const salva = { ...rascunho, id: rascunho.id || `rg-${Date.now()}` }
                  salvarRegra(salva)
                  registrarAuditoria({
                    tipo: 'regra',
                    ator: 'Você',
                    acao: 'Publicou regra de gatilho',
                    alvo: salva.nome,
                    detalhe: `${descreverRegra(salva)}. Alcance atual: ${previa.length} propostas.`,
                  })
                  setRascunho(null)
                }}
              >
                <Save size={12} /> Publicar regra
              </Botao>
              <Botao variante="fantasma" onClick={() => setRascunho(null)}>
                Cancelar
              </Botao>
            </div>
          </div>
        )}
      </Panel>
    </div>
  )
}

/* ==================== Fila e agendamento ==================== */

function Fila() {
  const { regras, ritos, orgaoId, abrirLote } = useApp()
  const navegar = useNavigate()
  const orgao = getOrgao(orgaoId)!
  const [agora, setAgora] = useState(Date.now())

  // O contador precisa andar na tela — é o que dá sensação de sistema vivo.
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const agendadas = useMemo(
    () =>
      regras
        .filter((r) => r.ativa && r.recorrencia !== 'nenhuma')
        .map((regra) => {
          const alvos = avaliarRegra(regra, orgaoId)
          const rito = ritos.find((r) => r.id === regra.ritoId)
          return { regra, alvos, rito, espera: proximaExecucao(regra) ?? 0 }
        })
        .sort((a, b) => a.espera - b.espera),
    [regras, ritos, orgaoId, agora],
  )

  const totalNaFila = agendadas.reduce((s, a) => s + a.alvos.length, 0)
  const tempoTotal = agendadas.reduce(
    (s, a) => s + a.alvos.length * (a.rito?.duracaoMediaMs ?? 25_000),
    0,
  )
  // Quatro execuções simultâneas é o limite prático de sessões do SEI.
  const tempoComConcorrencia = tempoTotal / 4

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-4 gap-4">
        <Panel className="px-5 py-4">
          <Numero rotulo="Regras ativas" valor={numero(agendadas.length)} tom="teal" />
        </Panel>
        <Panel className="px-5 py-4">
          <Numero
            rotulo="Propostas na fila"
            valor={numero(totalNaFila)}
            tom="gold"
            detalhe={`Na próxima rodada do ${orgao.sigla}`}
          />
        </Panel>
        <Panel className="px-5 py-4">
          <Numero
            rotulo="Tempo estimado"
            valor={duracao(tempoComConcorrencia)}
            detalhe="Com 4 execuções simultâneas"
          />
        </Panel>
        <Panel className="px-5 py-4">
          <Numero
            rotulo="Se fosse à mão"
            valor={`${Math.round((totalNaFila * 18) / 60)} h`}
            tom="cleo"
            detalhe="18 minutos por proposta, medidos com os analistas"
          />
        </Panel>
      </div>

      <Panel className="overflow-hidden">
        <PanelHeader eyebrow="Agendamento" titulo="O que roda sozinho e quando" />
        <ul className="divide-y divide-line-soft">
          {agendadas.map(({ regra, alvos, rito, espera }) => (
            <li key={regra.id} className="flex items-center gap-5 px-5 py-4">
              <div className="w-[104px] shrink-0">
                <div className="eyebrow mb-1">Próxima em</div>
                <div className="num text-[15px] text-cleo">{formatarEspera(espera)}</div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[13px] text-ink">{regra.nome}</div>
                <p className="mt-0.5 text-[11.5px] text-muted">
                  {descreverRegra(regra)} → <span className="text-cleo">{rito?.nome}</span>
                </p>
              </div>

              <div className="w-[150px] shrink-0">
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-[11px] text-faint">na fila</span>
                  <span className="num text-[12px] text-gold">{alvos.length}</span>
                </div>
                <Medidor
                  valor={totalNaFila > 0 ? alvos.length / Math.max(totalNaFila, 1) : 0}
                  tom="gold"
                  altura={4}
                />
              </div>

              <span className="num w-[92px] shrink-0 text-right text-[11.5px] text-faint">
                {ROTULO_RECORRENCIA[regra.recorrencia]} · {regra.horario}
              </span>

              <Botao
                tamanho="sm"
                disabled={alvos.length === 0}
                onClick={() =>
                  abrirLote({
                    ritoId: regra.ritoId,
                    titulo: `${regra.nome} — execução antecipada`,
                    propostaIds: alvos.slice(0, 20).map((p) => p.id),
                  })
                }
              >
                <Play size={11} fill="currentColor" /> Rodar agora
              </Botao>
            </li>
          ))}
          {agendadas.length === 0 && (
            <li>
              <Vazio
                titulo="Nenhuma regra ativa com recorrência. Ative uma na aba Regras para ver a fila se formar."
                acao={<Botao onClick={() => navegar('/ritos')}>Ir para regras</Botao>}
              />
            </li>
          )}
        </ul>
      </Panel>
    </div>
  )
}
