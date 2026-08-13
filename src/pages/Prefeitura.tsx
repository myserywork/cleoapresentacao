import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CircleDashed,
  Clock,
  FileSignature,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'
import { useApp } from '@/store/app'
import {
  diagnosticar,
  ESTAGIOS,
  MUNICIPIO_DEMO,
  oportunidades,
  pedidosDemo,
  redigirOficio,
  type EstagioPedido,
  type Oportunidade,
  type Pedido,
} from '@/prefeitura/dominio'
import { diasAte } from '@/dominio/ciclo'
import { cn, data, moeda, moedaCompacta, numero } from '@/lib/format'
import { Badge, Botao, Panel, PanelHeader } from '@/components/ui'
import { Abas, Medidor, Numero } from '@/components/dados'

const TOM_ESTAGIO: Record<EstagioPedido, 'inert' | 'gold' | 'teal' | 'cleo' | 'alert'> = {
  rascunho: 'inert',
  documentacao: 'gold',
  enviado: 'cleo',
  em_analise: 'cleo',
  diligencia: 'alert',
  aprovado: 'teal',
  recusado: 'alert',
}

/**
 * Módulo Prefeitura — a versão cliente.
 *
 * Do outro lado do balcão: enquanto a Cleopatra dos ministérios analisa o que
 * foi pedido, esta orquestra o pedido. Encontra o programa que aceita o
 * projeto, escreve o ofício na língua que o ministério exige e acompanha o que
 * travou — as três coisas que a consultoria cobra para fazer à mão.
 */
export function Prefeitura() {
  const { notificar } = useApp()
  const perfil = MUNICIPIO_DEMO
  const [aba, setAba] = useState<'oportunidades' | 'pedidos' | 'oficio'>('oportunidades')
  const [pedidoAberto, setPedidoAberto] = useState<string | null>('pd1')

  const oport = useMemo(() => oportunidades(perfil), [perfil])
  const pedidos = useMemo(() => pedidosDemo(), [])
  const diag = useMemo(() => diagnosticar(pedidos), [pedidos])
  const pedido = pedidos.find((p) => p.id === pedidoAberto) ?? pedidos[0]

  return (
    <div className="mx-auto flex max-w-[1360px] flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="eyebrow mb-2">Versão cliente</div>
          <h1 className="text-[26px] leading-tight">
            Prefeitura de {perfil.nome}
            <span className="ml-2 text-[15px] text-muted">/{perfil.uf}</span>
          </h1>
          <p className="mt-1.5 max-w-[76ch] text-[13px] text-muted">
            Aqui a Cleo trabalha para quem <span className="text-ink">pede</span> o recurso: acha o
            programa que aceita o seu projeto, escreve o ofício na linguagem que o ministério exige
            e acompanha cada trava até a aprovação.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-teal/30 bg-teal/[0.05] px-4 py-2.5">
          <Building2 size={16} className="shrink-0 text-teal" />
          <div>
            <div className="num text-[13px] text-ink">
              {numero(perfil.populacao)} habitantes
            </div>
            <div className="text-[11px] text-muted">
              {perfil.convenios.ativos} convênios ativos · {moedaCompacta(perfil.convenios.valorTotal)} no
              histórico
            </div>
          </div>
        </div>
      </header>

      {/* Diagnóstico */}
      <div className="grid grid-cols-4 gap-4">
        <Panel className="px-5 py-4">
          <Numero
            rotulo="Pleiteado agora"
            valor={moedaCompacta(diag.valorPleiteado)}
            tom="gold"
            detalhe={`${pedidos.length} pedidos em andamento`}
          />
        </Panel>
        <Panel className="px-5 py-4">
          <Numero
            rotulo="Chance média"
            valor={`${(diag.chanceMedia * 100).toFixed(0)}%`}
            tom={diag.chanceMedia > 0.7 ? 'teal' : 'gold'}
            detalhe="Estimativa da Cleo pelo histórico do programa"
          />
          <div className="mt-3">
            <Medidor valor={diag.chanceMedia} tom={diag.chanceMedia > 0.7 ? 'teal' : 'gold'} />
          </div>
        </Panel>
        <Panel className={cn('px-5 py-4', diag.emDiligencia > 0 && 'border-alert/30 bg-alert/[0.04]')}>
          <Numero
            rotulo="Em diligência"
            valor={numero(diag.emDiligencia)}
            tom="alert"
            detalhe={
              diag.proximoPrazo
                ? `o mais urgente vence em ${diag.proximoPrazo.dias} dias`
                : 'nenhuma pendência aberta'
            }
          />
        </Panel>
        <Panel className="px-5 py-4">
          <Numero
            rotulo="Contrapartida disponível"
            valor={moedaCompacta(perfil.contrapartidaDisponivel)}
            tom="cleo"
            detalhe={perfil.regular ? 'Município regular nos cadastros' : 'Há pendência de regularidade'}
          />
        </Panel>
      </div>

      {perfil.pendencias.length > 0 && (
        <Panel className="flex items-center gap-3.5 border-gold/25 bg-gold/[0.05] px-5 py-3">
          <AlertTriangle size={15} className="shrink-0 text-gold" />
          <p className="flex-1 text-[12.5px] text-muted">
            {perfil.pendencias[0]} —{' '}
            <span className="text-ink">
              certidão vencida derruba pedido na triagem, antes mesmo da análise técnica.
            </span>
          </p>
          <Botao tamanho="sm">Renovar agora</Botao>
        </Panel>
      )}

      <Abas
        ativa={aba}
        aoTrocar={setAba}
        abas={[
          { id: 'oportunidades', rotulo: 'Oportunidades', contagem: oport.length },
          { id: 'pedidos', rotulo: 'Meus pedidos', contagem: pedidos.length },
          { id: 'oficio', rotulo: 'Ofício da Cleo' },
        ]}
      />

      {aba === 'oportunidades' && <Oportunidades lista={oport} aoUsar={(o) => {
        setAba('oficio')
        notificar({
          tipo: 'automacao',
          titulo: `Rascunho iniciado — ${o.programa}`,
          detalhe: 'A Cleo montou o pedido com a linguagem do programa. Revise e envie.',
          href: '/prefeitura',
        })
      }} />}

      {aba === 'pedidos' && (
        <Pedidos pedidos={pedidos} aberto={pedido} aoAbrir={setPedidoAberto} />
      )}

      {aba === 'oficio' && <Oficio pedido={pedido} perfil={perfil} />}
    </div>
  )
}

/* ---------- Oportunidades ---------- */

function Oportunidades({
  lista,
  aoUsar,
}: {
  lista: Oportunidade[]
  aoUsar: (o: Oportunidade) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <Panel className="flex items-start gap-3.5 px-5 py-4">
        <Target size={16} className="mt-0.5 shrink-0 text-cleo" />
        <p className="text-[12.5px] leading-relaxed text-muted">
          A Cleo cruza o perfil do município — porte, contrapartida disponível, regularidade e
          histórico — com as regras de cada programa aberto.{' '}
          <span className="text-ink">A aderência é conta aberta</span>, não palpite: cada linha
          mostra por que combina.
        </p>
      </Panel>

      <div className="grid grid-cols-2 gap-4">
        {lista.map((o) => {
          const dias = diasAte(o.prazoFinal)
          return (
            <Panel key={o.id} className="flex flex-col overflow-hidden">
              <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge tom="cleo">{o.orgaoSigla}</Badge>
                    {o.status === 'encerrando' && <Badge tom="alert">encerrando</Badge>}
                  </div>
                  <h3 className="text-[14.5px] leading-snug">{o.programa}</h3>
                  <p className="mt-1 text-[11.5px] text-muted">{o.objetoTipico}</p>
                </div>
                <div className="shrink-0 text-right">
                  <div
                    className={cn(
                      'num text-[19px]',
                      o.aderencia > 0.8 ? 'text-teal' : o.aderencia > 0.6 ? 'text-gold' : 'text-muted',
                    )}
                  >
                    {(o.aderencia * 100).toFixed(0)}%
                  </div>
                  <div className="text-[10px] text-faint">aderência</div>
                </div>
              </div>

              <div className="px-5 py-4">
                <div className="mb-3 grid grid-cols-3 gap-3 text-[11.5px]">
                  <div>
                    <div className="eyebrow mb-0.5">Faixa</div>
                    <div className="num text-ink">
                      {moedaCompacta(o.faixaMin)}–{moedaCompacta(o.faixaMax)}
                    </div>
                  </div>
                  <div>
                    <div className="eyebrow mb-0.5">Contrapartida</div>
                    <div className="num text-ink">{(o.contrapartidaMinima * 100).toFixed(0)}% mín.</div>
                  </div>
                  <div>
                    <div className="eyebrow mb-0.5">Prazo</div>
                    <div className={cn('num', dias <= 7 ? 'text-alert' : 'text-ink')}>
                      {dias} dias
                    </div>
                  </div>
                </div>

                <div className="eyebrow mb-1.5">Por que combina com {'Petrópolis'}</div>
                <ul className="mb-3 flex flex-col gap-1">
                  {o.porqueCombina.map((c) => (
                    <li key={c} className="flex items-start gap-2 text-[11.5px] text-muted">
                      <CheckCircle2 size={11} className="mt-0.5 shrink-0 text-teal" /> {c}
                    </li>
                  ))}
                </ul>

                <details className="mb-3">
                  <summary className="cursor-pointer text-[11.5px] text-cleo">
                    O que o programa exige ({o.exigencias.length} documentos)
                  </summary>
                  <ul className="mt-2 flex flex-col gap-1">
                    {o.exigencias.map((e) => (
                      <li key={e} className="flex items-start gap-2 text-[11px] text-muted">
                        <CircleDashed size={10} className="mt-0.5 shrink-0 text-faint" /> {e}
                      </li>
                    ))}
                  </ul>
                </details>

                <Botao variante="primario" tamanho="sm" onClick={() => aoUsar(o)}>
                  <Sparkles size={11} /> A Cleo monta o pedido
                </Botao>
              </div>
            </Panel>
          )
        })}
      </div>
    </div>
  )
}

/* ---------- Pedidos ---------- */

function Pedidos({
  pedidos,
  aberto,
  aoAbrir,
}: {
  pedidos: Pedido[]
  aberto: Pedido
  aoAbrir: (id: string) => void
}) {
  return (
    <div className="grid grid-cols-[1.15fr_1fr] items-start gap-4">
      <Panel className="overflow-hidden">
        <PanelHeader eyebrow="Acompanhamento" titulo="Onde cada pedido está" />
        <ul className="divide-y divide-line-soft">
          {pedidos.map((p) => {
            const estagio = ESTAGIOS.find((e) => e.id === p.estagio)!
            const faltam = p.checklist.filter((c) => !c.ok).length
            return (
              <li key={p.id}>
                <button
                  onClick={() => aoAbrir(p.id)}
                  className={cn(
                    'w-full px-5 py-3.5 text-left transition-colors',
                    p.id === aberto.id ? 'bg-gold/[0.06]' : 'hover:bg-white/[0.03]',
                  )}
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <Badge tom={TOM_ESTAGIO[p.estagio]} ponto>
                      {estagio.rotulo}
                    </Badge>
                    <span className="num text-[11px] text-faint">{p.orgaoSigla}</span>
                    <span className="num ml-auto text-[12px] text-gold">
                      {moedaCompacta(p.valor)}
                    </span>
                  </div>
                  <div className="line-clamp-1 text-[12.5px] text-ink">{p.objeto}</div>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-muted">
                    <span>{p.programa}</span>
                    {faltam > 0 && <span className="text-gold">{faltam} anexo(s) faltando</span>}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </Panel>

      <Panel className="overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <div className="mb-1 flex items-center gap-2">
            <Badge tom={TOM_ESTAGIO[aberto.estagio]} ponto>
              {ESTAGIOS.find((e) => e.id === aberto.estagio)!.rotulo}
            </Badge>
            <span className="num ml-auto text-[13px] text-gold">{moeda(aberto.valor)}</span>
          </div>
          <h3 className="text-[14px] leading-snug">{aberto.objeto}</h3>
          <p className="mt-1 text-[11.5px] text-muted">
            {ESTAGIOS.find((e) => e.id === aberto.estagio)!.explica}
          </p>
        </div>

        {aberto.diligencia && (
          <div className="border-b border-line bg-alert/[0.05] px-5 py-4">
            <div className="mb-2 flex items-center gap-2">
              <Clock size={13} className="text-alert" />
              <span className="text-[12.5px] text-alert">
                Diligência aberta — responda em {diasAte(aberto.diligencia.prazo)} dias
              </span>
            </div>
            <ul className="flex flex-col gap-1.5">
              {aberto.diligencia.itens.map((i) => (
                <li key={i} className="flex items-start gap-2 text-[11.5px] text-muted">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-alert" /> {i}
                </li>
              ))}
            </ul>
            <Botao variante="primario" tamanho="sm" className="mt-3">
              <Sparkles size={11} /> A Cleo redige a resposta
            </Botao>
          </div>
        )}

        <div className="px-5 py-4">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="eyebrow">Documentação</span>
            <span className="num text-[11.5px] text-muted">
              {aberto.checklist.filter((c) => c.ok).length}/{aberto.checklist.length}
            </span>
          </div>
          <ul className="mb-4 flex flex-col gap-1.5">
            {aberto.checklist.map((c) => (
              <li key={c.item} className="flex items-center gap-2.5 text-[12px]">
                {c.ok ? (
                  <CheckCircle2 size={13} className="shrink-0 text-teal" />
                ) : (
                  <CircleDashed size={13} className="shrink-0 text-gold" />
                )}
                <span className={c.ok ? 'text-muted' : 'text-ink'}>{c.item}</span>
              </li>
            ))}
          </ul>

          <div className="rounded-lg border border-cleo/25 bg-cleo/[0.05] px-4 py-3">
            <div className="mb-1.5 flex items-center gap-2">
              <TrendingUp size={13} className="text-cleo" />
              <span className="text-[12px] text-cleo">
                Chance de aprovação: {(aberto.chance * 100).toFixed(0)}%
              </span>
            </div>
            <p className="text-[11.5px] leading-relaxed text-muted">{aberto.observacao}</p>
          </div>

          <div className="num mt-3 text-[10.5px] text-faint">
            criado em {data(aberto.criadoEm)} · atualizado em {data(aberto.atualizadoEm)}
          </div>
        </div>
      </Panel>
    </div>
  )
}

/* ---------- Ofício ---------- */

function Oficio({ pedido, perfil }: { pedido: Pedido; perfil: typeof MUNICIPIO_DEMO }) {
  const texto = useMemo(() => redigirOficio(pedido, perfil), [pedido, perfil])

  return (
    <div className="grid grid-cols-[1.4fr_1fr] items-start gap-4">
      <Panel className="overflow-hidden">
        <PanelHeader
          eyebrow="Redigido pela Cleo"
          titulo="Ofício de apresentação da proposta"
          acao={<FileSignature size={15} className="text-cleo" />}
        />
        <div className="bg-[#f4f1ea] px-10 py-9">
          <pre className="font-sans text-[12px] leading-[1.85] whitespace-pre-wrap text-[#2b2618]">
            {texto}
          </pre>
        </div>
        <div className="flex items-center gap-2 border-t border-line px-5 py-3.5">
          <Botao variante="primario" tamanho="sm">
            Enviar ao {pedido.orgaoSigla}
          </Botao>
          <Botao tamanho="sm" onClick={() => navigator.clipboard?.writeText(texto)}>
            Copiar texto
          </Botao>
          <span className="ml-auto text-[11px] text-faint">
            gerado com a norma vigente do programa
          </span>
        </div>
      </Panel>

      <Panel>
        <PanelHeader eyebrow="Por que isso importa" titulo="A linguagem que o ministério espera" />
        <div className="flex flex-col gap-4 px-5 py-5 text-[12.5px] leading-relaxed text-muted">
          <p>
            <span className="text-ink">Pedido que volta custa 40 dias.</span> A maior parte das
            devoluções não é por mérito do projeto — é por forma: falta o fundamento legal, o
            percentual de contrapartida não está explícito, o objeto está descrito em linguagem de
            obra e não de programa.
          </p>
          <p>
            <span className="text-ink">A Cleo já leu a norma.</span> Ela cita a Portaria
            Interministerial 424/2016 e o Decreto 6.170/2007 onde o analista espera ver, declara a
            regularidade no parágrafo certo e apresenta o valor no formato que o sistema aceita.
          </p>
          <p>
            <span className="text-ink">É o trabalho que a consultoria cobra para fazer.</span> A
            diferença é que aqui ele sai em segundos, com a norma sempre atualizada, e o município
            entende o que está assinando.
          </p>
          <div className="rounded-lg border border-teal/25 bg-teal/[0.05] px-4 py-3 text-[11.5px]">
            A mesma lógica se empacota para estatais: basta trocar a norma pelas diretrizes internas
            de compras, análise e hierarquia da instituição.
          </div>
        </div>
      </Panel>
    </div>
  )
}
