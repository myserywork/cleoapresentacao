import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Clock,
  Compass,
  FileSignature,
  Flame,
  HandCoins,
  Scale,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react'
import { useApp } from '@/store/app'
import {
  diagnosticar,
  diasAteFimDoCiclo,
  dinheiroDormindo,
  ESTAGIOS,
  MUNICIPIO_DEMO,
  NORMAS,
  oportunidades,
  pares,
  parlamentaresComSaldo,
  PECAS,
  pedidosDemo,
  redigirOficio,
  redigirPedidoEmenda,
  redigirReconsideracao,
  redigirRespostaDiligencia,
  ROTULO_CATEGORIA,
  type DinheiroDormindo,
  type EstagioPedido,
  type Oportunidade,
  type ParlamentarLivre,
  type Pedido,
  type PerfilMunicipio,
  type TipoPeca,
} from '@/prefeitura/dominio'
import {
  EXEMPLOS,
  INSTRUMENTOS,
  PROPONENTES,
  PROPONENTE_POR_ID,
  rotear,
  TIPOS_OBJETO,
  VIAS,
  type Rota,
  type TipoProponente,
} from '@/prefeitura/roteador'
import { diasAte } from '@/dominio/ciclo'
import { cn, data, moeda, moedaCompacta } from '@/lib/format'
import { Badge, Botao, Campo, Panel, PanelHeader } from '@/components/ui'
import { Abas, Avatar, Medidor, Numero } from '@/components/dados'

const TOM_ESTAGIO: Record<EstagioPedido, 'inert' | 'gold' | 'teal' | 'cleo' | 'alert'> = {
  rascunho: 'inert',
  documentacao: 'gold',
  enviado: 'cleo',
  em_analise: 'cleo',
  diligencia: 'alert',
  aprovado: 'teal',
  recusado: 'alert',
}

type Aba = 'rota' | 'radar' | 'parlamentares' | 'oportunidades' | 'pedidos' | 'oficio'

/**
 * Módulo cliente — a Cleopatra de quem pede.
 *
 * Do outro lado do balcão: enquanto a Cleopatra dos ministérios analisa o que
 * foi pedido, esta orquestra o pedido.
 *
 * A ordem das abas é a ordem das perguntas de quem precisa de dinheiro: *a quem
 * eu peço* (rota), *o que já é meu e vai vencer* (radar), *quem ainda tem saldo*
 * (bancada), *quais programas aceitam* e, por fim, o que já foi pedido.
 *
 * O proponente é configurável: município é o caso mais comum, não o único. Um
 * consórcio, um estado, uma OSC e uma estatal pedem sob normas diferentes, com
 * instrumentos diferentes — e a plataforma acompanha essa troca inteira.
 */
const ABAS_VALIDAS: Aba[] = [
  'rota',
  'radar',
  'parlamentares',
  'oportunidades',
  'pedidos',
  'oficio',
]

export function Prefeitura() {
  const { notificar, proponente: tipoProponente, setProponente: setTipoProponente } = useApp()
  const perfil = MUNICIPIO_DEMO
  // A aba mora na URL: assim a navegação lateral aponta para ela, o link é
  // compartilhável e o botão voltar do navegador faz o que se espera.
  const [params, setParams] = useSearchParams()
  const bruta = params.get('aba') as Aba | null
  const aba: Aba = bruta && ABAS_VALIDAS.includes(bruta) ? bruta : 'rota'
  const setAba = (a: Aba) => {
    if (a === 'rota') params.delete('aba')
    else params.set('aba', a)
    setParams(params, { replace: true })
  }
  const [pedidoAberto, setPedidoAberto] = useState<string | null>('pd1')
  const [oficioDe, setOficioDe] = useState<ParlamentarLivre | null>(null)
  const proponente = PROPONENTE_POR_ID.get(tipoProponente)!

  const oport = useMemo(() => oportunidades(perfil), [perfil])
  const pedidos = useMemo(() => pedidosDemo(), [])
  const dormindo = useMemo(() => dinheiroDormindo(), [])
  const parlamentares = useMemo(() => parlamentaresComSaldo(perfil), [perfil])
  const diag = useMemo(
    () => diagnosticar(pedidos, dormindo, parlamentares),
    [pedidos, dormindo, parlamentares],
  )
  const ciclo = diasAteFimDoCiclo()
  const pedido = pedidos.find((p) => p.id === pedidoAberto) ?? pedidos[0]

  // Emenda parlamentar é via de ente público. OSC entra por chamamento e
  // estatal contrata pelo regulamento interno — para esses dois, a aba da
  // bancada não é uma aba vazia: é uma aba que não existe.
  const acessaEmenda =
    tipoProponente === 'municipio' ||
    tipoProponente === 'consorcio' ||
    tipoProponente === 'estado'

  // A aba da bancada some com a troca de proponente; quem estava nela precisa
  // ir para algum lugar.
  const abaEfetiva: Aba = aba === 'parlamentares' && !acessaEmenda ? 'rota' : aba

  return (
    <div className="mx-auto flex max-w-[1360px] flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="eyebrow mb-2">Versão cliente</div>
          <h1 className="text-[26px] leading-tight">
            {tipoProponente === 'municipio' ? `Prefeitura de ${perfil.nome}` : proponente.rotulo}
            <span className="ml-2 text-[15px] text-muted">
              {tipoProponente === 'municipio' ? `/${perfil.uf}` : `em ${perfil.nome}/${perfil.uf}`}
            </span>
          </h1>
          <p className="mt-1.5 max-w-[76ch] text-[13px] text-muted">
            Aqui a Cleo trabalha para quem <span className="text-ink">pede</span> o recurso:
            descobre a quem pedir e como, mostra o dinheiro que já é seu e vai vencer, quem ainda
            tem saldo para destinar, e escreve a peça na linguagem que o concedente aceita.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-gold/30 bg-gold/[0.05] px-4 py-2.5">
          <Clock size={16} className="shrink-0 text-gold" />
          <div>
            <div className="num text-[15px] text-gold">{ciclo.dias} dias</div>
            <div className="text-[11px] text-muted">até o fim do ciclo orçamentário</div>
          </div>
        </div>
      </header>

      {/* Quem pede muda tudo o que vem depois: a norma, o instrumento, os
          anexos e quem assina. Fica no topo porque é a primeira decisão. */}
      <Panel className="flex flex-col gap-3 px-4 py-3.5 lg:flex-row lg:items-center lg:gap-5 lg:px-5">
        <div className="shrink-0">
          <div className="eyebrow mb-1.5">Quem pede</div>
          <div className="rolagem-discreta -mx-4 flex gap-1.5 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
            {PROPONENTES.map((p) => (
              <button
                key={p.id}
                onClick={() => setTipoProponente(p.id)}
                className={cn(
                  'shrink-0 rounded-lg border px-3 py-1.5 text-[12px] whitespace-nowrap transition-colors',
                  tipoProponente === p.id
                    ? 'border-teal/50 bg-teal/10 text-teal'
                    : 'border-line text-muted hover:text-ink',
                )}
              >
                {p.rotulo}
              </button>
            ))}
          </div>
        </div>
        <div className="min-w-0 flex-1 border-t border-line pt-3 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
          <p className="text-[12.5px] leading-relaxed text-muted">
            <span className="text-ink">{proponente.descricao}</span> Rege-se por{' '}
            {proponente.normaBase}. Instrumentos:{' '}
            {proponente.instrumentos.map((i) => INSTRUMENTOS[i].rotulo).join(', ')}. Assina:{' '}
            {proponente.quemAssina.toLowerCase()}. Contrapartida: {proponente.contrapartida}.
          </p>
        </div>
      </Panel>

      {/* Os quatro números que mudam a semana do prefeito */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Panel className="border-alert/30 bg-alert/[0.04] px-4 py-4 lg:px-5">
          <Numero
            rotulo="Perde se não agir"
            valor={moedaCompacta(diag.dinheiroEmRisco)}
            tom="alert"
            detalhe="Recurso já conquistado, expirando"
          />
        </Panel>
        <Panel className="px-4 py-4 lg:px-5">
          {acessaEmenda ? (
            <Numero
              rotulo="Ao alcance na bancada"
              valor={moedaCompacta(diag.saldoAoAlcance)}
              tom="teal"
              detalhe={(() => {
                const n = parlamentares.filter((p) => p.baseNaRegiao).length
                return `Saldo livre ${n === 1 ? 'de 1 parlamentar' : `de ${n} parlamentares`} do ${perfil.uf}`
              })()}
            />
          ) : (
            // Inventar um número de emenda para quem não acessa emenda seria
            // mentir com precisão de dois dígitos. Aqui o cartão diz a via.
            <Numero
              rotulo="Via de acesso"
              valor={tipoProponente === 'osc' ? 'Chamamento' : 'Regulamento'}
              tom="cleo"
              detalhe={
                tipoProponente === 'osc'
                  ? 'Parceria com OSC depende de edital, não de emenda'
                  : 'Estatal contrata pelo regulamento interno, fora do regime de convênios'
              }
            />
          )}
        </Panel>
        <Panel className="px-4 py-4 lg:px-5">
          <Numero
            rotulo="Pleiteado agora"
            valor={moedaCompacta(diag.valorPleiteado)}
            tom="gold"
            detalhe={`${pedidos.length} pedidos em andamento`}
          />
        </Panel>
        <Panel className="px-4 py-4 lg:px-5">
          <Numero
            rotulo="Chance média"
            valor={`${(diag.chanceMedia * 100).toFixed(0)}%`}
            tom={diag.chanceMedia > 0.7 ? 'teal' : 'gold'}
            detalhe={
              diag.proximoPrazo
                ? `diligência mais urgente vence em ${diag.proximoPrazo.dias} dias`
                : 'nenhuma diligência aberta'
            }
          />
          <div className="mt-3">
            <Medidor valor={diag.chanceMedia} tom={diag.chanceMedia > 0.7 ? 'teal' : 'gold'} />
          </div>
        </Panel>
      </div>

      {perfil.pendencias.length > 0 && (
        <Panel className="flex flex-col gap-3 border-gold/25 bg-gold/[0.05] px-4 py-3 sm:flex-row sm:items-center lg:px-5">
          <AlertTriangle size={15} className="shrink-0 text-gold" />
          <p className="flex-1 text-[12.5px] leading-relaxed text-muted">
            <span className="text-ink">{perfil.pendencias[0].item}</span> vence em{' '}
            {perfil.pendencias[0].prazo} dias — certidão vencida derruba pedido na triagem, antes
            mesmo da análise técnica.
          </p>
          <Botao tamanho="sm" className="shrink-0">
            Renovar agora
          </Botao>
        </Panel>
      )}

      <Abas
        ativa={abaEfetiva}
        aoTrocar={setAba}
        abas={[
          { id: 'rota' as Aba, rotulo: 'A quem eu peço' },
          { id: 'radar' as Aba, rotulo: 'Radar', contagem: dormindo.length },
          ...(acessaEmenda
            ? [
                {
                  id: 'parlamentares' as Aba,
                  rotulo: 'Quem tem saldo',
                  contagem: parlamentares.length,
                },
              ]
            : []),
          { id: 'oportunidades' as Aba, rotulo: 'Programas', contagem: oport.length },
          { id: 'pedidos' as Aba, rotulo: 'Meus pedidos', contagem: pedidos.length },
          { id: 'oficio' as Aba, rotulo: 'Ofícios' },
        ]}
      />

      {abaEfetiva === 'rota' && (
        <Roteador
          tipoProponente={tipoProponente}
          aoPedirEmenda={() => setAba('parlamentares')}
          aoRedigir={() => {
            setOficioDe(null)
            setAba('oficio')
            notificar({
              tipo: 'automacao',
              titulo: 'Rascunho iniciado pela rota',
              detalhe: 'A Cleo montou a peça no programa recomendado. Revise e envie.',
              href: '/prefeitura?aba=oficio',
            })
          }}
        />
      )}

      {abaEfetiva === 'radar' && <Radar dormindo={dormindo} perfil={perfil} />}

      {abaEfetiva === 'parlamentares' && (
        <Parlamentares
          lista={parlamentares}
          aoPedir={(p) => {
            setOficioDe(p)
            setAba('oficio')
            notificar({
              tipo: 'automacao',
              titulo: `Ofício para ${p.nome}`,
              detalhe: 'A Cleo redigiu o pedido de indicação de emenda. Revise e envie.',
              href: '/prefeitura',
            })
          }}
        />
      )}

      {abaEfetiva === 'oportunidades' && (
        <Oportunidades
          perfil={perfil}
          lista={oport}
          aoUsar={(o) => {
            setOficioDe(null)
            setAba('oficio')
            notificar({
              tipo: 'automacao',
              titulo: `Rascunho iniciado — ${o.programa}`,
              detalhe: 'A Cleo montou o pedido com a linguagem do programa. Revise e envie.',
              href: '/prefeitura',
            })
          }}
        />
      )}

      {abaEfetiva === 'pedidos' && <Pedidos pedidos={pedidos} aberto={pedido} aoAbrir={setPedidoAberto} />}

      {abaEfetiva === 'oficio' && <Oficio pedido={pedido} perfil={perfil} parlamentar={oficioDe} />}
    </div>
  )
}

/* ---------- A quem eu peço ---------- */

/**
 * O roteador de demanda.
 *
 * A pergunta que trava a prefeitura antes do primeiro ofício. Aqui ela é
 * respondida com a conta aberta: o que a Cleo entendeu do texto, qual programa
 * de qual ministério, sob qual instrumento e por quê — e as rotas que ela
 * descartou, com o motivo. Recomendação sem o descarte à vista é adivinhação.
 */
function Roteador({
  tipoProponente,
  aoRedigir,
  aoPedirEmenda,
}: {
  tipoProponente: TipoProponente
  aoRedigir: () => void
  aoPedirEmenda: () => void
}) {
  const [texto, setTexto] = useState(EXEMPLOS[0])
  const [valor, setValor] = useState(4_800_000)
  const resultado = useMemo(
    () => rotear(texto, tipoProponente, valor),
    [texto, tipoProponente, valor],
  )
  const [abertaId, setAbertaId] = useState<string | null>(null)
  const melhor = resultado.rotas[0]
  const rotaAberta = resultado.rotas.find((r) => r.id === abertaId) ?? melhor

  return (
    <div className="flex flex-col gap-4">
      <Panel className="overflow-hidden">
        <PanelHeader
          eyebrow="Descreva a necessidade como você a contaria no telefone"
          titulo="A quem eu peço, e como"
          acao={<Compass size={15} className="text-cleo" />}
        />
        <div className="flex flex-col gap-3 px-4 py-4 lg:px-5">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            aria-label="Descrição da necessidade"
            className="w-full resize-y rounded-lg border border-line bg-abyss/50 px-3.5 py-3 text-[13px] leading-relaxed text-ink placeholder:text-faint focus:border-gold/50 focus:outline-none"
            placeholder="Ex.: a encosta do bairro cedeu de novo na última chuva e precisamos de obra de contenção"
          />

          <div className="rolagem-discreta -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
            {EXEMPLOS.map((e) => (
              <button
                key={e}
                onClick={() => setTexto(e)}
                className="shrink-0 rounded-full border border-line px-3 py-1 text-[11.5px] whitespace-nowrap text-muted transition-colors hover:border-cleo/45 hover:text-cleo lg:whitespace-normal"
              >
                {e.length > 46 ? `${e.slice(0, 46)}…` : e}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-[12px] text-muted" htmlFor="valor-estimado">
              Valor estimado
            </label>
            <Campo
              id="valor-estimado"
              type="number"
              step={100_000}
              min={0}
              value={valor}
              onChange={(e) => setValor(Number(e.target.value) || 0)}
              className="num w-[150px] text-[12.5px]"
            />
            <span className="num text-[12px] text-gold">{moedaCompacta(valor)}</span>
          </div>
        </div>

        {/* O que a Cleo entendeu — dito antes da resposta, para poder discordar */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line bg-cleo/[0.04] px-4 py-3 text-[12px] lg:px-5">
          <span className="eyebrow">O que eu entendi</span>
          {resultado.temasLidos.length === 0 ? (
            <span className="text-muted">
              Nenhum tema reconhecido — descreva o objeto com as palavras do dia a dia
              (encosta, drenagem, trator, vicinal, pescador…).
            </span>
          ) : (
            <>
              <span className="text-muted">
                assunto:{' '}
                <span className="text-ink">
                  {resultado.temasLidos.flatMap((t) => t.achadas).slice(0, 4).join(', ')}
                </span>
              </span>
              <span className="text-muted">
                natureza:{' '}
                <span className="text-ink">{TIPOS_OBJETO[resultado.tipoObjeto].rotulo}</span>
                {resultado.termoQueDecidiu && (
                  <span className="text-faint"> (por "{resultado.termoQueDecidiu}")</span>
                )}
              </span>
            </>
          )}
        </div>
      </Panel>

      {resultado.rotas.length === 0 ? (
        // Beco sem saída também é resposta — desde que venha com o motivo.
        // "Não tem rota" sem explicação faz a pessoa insistir por semanas.
        <Panel className="overflow-hidden">
          <PanelHeader
            eyebrow="Nenhuma rota para esta combinação"
            titulo="E o motivo de cada porta fechada"
          />
          <p className="border-b border-line px-4 py-3.5 text-[12.5px] leading-relaxed text-muted lg:px-5">
            Saber que não há caminho vale tanto quanto achar um: evita meses de instrução para uma
            proposta que voltaria na triagem.
          </p>
          {resultado.descartadas.length > 0 ? (
            <ul className="divide-y divide-line-soft">
              {resultado.descartadas.map((d, i) => (
                <li key={`${d.programa}-${i}`} className="px-4 py-3 lg:px-5">
                  <div className="text-[12.5px] text-ink">
                    <span className="text-inert">{d.orgaoSigla} · </span>
                    {d.programa}
                  </div>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-gold">{d.motivo}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-[12.5px] text-muted lg:px-5">
              Nenhum programa do catálogo trata deste assunto. Descreva o objeto com as palavras do
              dia a dia — encosta, drenagem, trator, vicinal, pescador, defesa civil.
            </p>
          )}
        </Panel>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_1.25fr]">
          <div className="flex flex-col gap-3">
            <div className="eyebrow px-1">
              {resultado.rotas.length === 1
                ? '1 rota possível'
                : `${resultado.rotas.length} rotas possíveis`}
            </div>
            {resultado.rotas.map((r, i) => (
              <button
                key={r.id}
                onClick={() => setAbertaId(r.id)}
                className={cn(
                  'panel px-4 py-3.5 text-left transition-colors lg:px-5',
                  r.id === rotaAberta.id ? 'border-gold/45 bg-gold/[0.05]' : 'hover:border-[#2c3c58]',
                )}
              >
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <Badge tom="cleo">{r.orgaoSigla}</Badge>
                  {i === 0 && <Badge tom="gold">rota recomendada</Badge>}
                  <span
                    className={cn(
                      'num ml-auto text-[13px]',
                      r.aderencia > 0.75 ? 'text-teal' : 'text-gold',
                    )}
                  >
                    {(r.aderencia * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="text-[13px] leading-snug text-ink">{r.programa}</div>
                <div className="num mt-0.5 text-[11px] text-faint">{r.acao}</div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                  <span className="text-teal">{INSTRUMENTOS[r.instrumento].rotulo}</span>
                  <span>{VIAS[r.via].rotulo}</span>
                  <span className={cn('num', r.prazoDias <= 15 ? 'text-alert' : 'text-faint')}>
                    {r.prazoDias} dias de prazo
                  </span>
                </div>
              </button>
            ))}

            {resultado.descartadas.length > 0 && (
              <details className="panel px-4 py-3 lg:px-5">
                <summary className="cursor-pointer text-[12px] text-muted">
                  Por que não os outros {resultado.descartadas.length} programas
                </summary>
                <ul className="mt-2.5 flex flex-col gap-2">
                  {resultado.descartadas.map((d, i) => (
                    <li key={`${d.programa}-${i}`} className="text-[11.5px] leading-relaxed">
                      <span className="text-inert">
                        {d.orgaoSigla} · {d.programa}
                      </span>
                      <div className="text-faint">{d.motivo}</div>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          <DetalheRota rota={rotaAberta} aoRedigir={aoRedigir} aoPedirEmenda={aoPedirEmenda} />
        </div>
      )}
    </div>
  )
}

function DetalheRota({
  rota,
  aoRedigir,
  aoPedirEmenda,
}: {
  rota: Rota
  aoRedigir: () => void
  aoPedirEmenda: () => void
}) {
  return (
    <Panel className="overflow-hidden">
      <PanelHeader eyebrow={rota.orgaoNome} titulo={rota.programa} />

      <div className="grid grid-cols-2 gap-x-5 gap-y-3.5 border-b border-line px-4 py-4 text-[12px] lg:grid-cols-3 lg:px-5">
        <div className="min-w-0">
          <div className="eyebrow mb-0.5">Unidade gestora</div>
          <div className="num text-ink">{rota.unidadeGestora}</div>
        </div>
        <div className="min-w-0">
          <div className="eyebrow mb-0.5">Ação orçamentária</div>
          <div className="num text-ink">{rota.acao}</div>
        </div>
        <div className="min-w-0">
          <div className="eyebrow mb-0.5">Faixa do programa</div>
          <div className="num whitespace-nowrap text-ink">
            {moedaCompacta(rota.faixa[0])}–{moedaCompacta(rota.faixa[1])}
          </div>
        </div>
        <div className="col-span-2 min-w-0 lg:col-span-3">
          <div className="eyebrow mb-0.5">Instrumento</div>
          <div className="text-teal">{INSTRUMENTOS[rota.instrumento].rotulo}</div>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">{rota.porqueInstrumento}</p>
        </div>
        <div className="col-span-2 min-w-0 lg:col-span-3">
          <div className="eyebrow mb-0.5">Via de acesso</div>
          <div className="text-ink">{VIAS[rota.via].rotulo}</div>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">{VIAS[rota.via].explica}</p>
        </div>
      </div>

      <div className="border-b border-line px-4 py-4 lg:px-5">
        <div className="eyebrow mb-2">Por que esta rota</div>
        <ul className="mb-3 flex flex-col gap-1.5">
          {rota.porque.map((p) => (
            <li key={p} className="flex items-start gap-2 text-[12px] leading-relaxed text-muted">
              <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-teal" /> {p}
            </li>
          ))}
        </ul>
        {rota.contra.length > 0 && (
          <>
            <div className="eyebrow mb-2">O que pesa contra</div>
            <ul className="flex flex-col gap-1.5">
              {rota.contra.map((c) => (
                <li key={c} className="flex items-start gap-2 text-[12px] leading-relaxed text-gold">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {c}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="px-4 py-4 lg:px-5">
        <div className="eyebrow mb-3">Como se pede — e quem faz cada passo</div>
        <ol className="flex flex-col gap-3">
          {rota.comoPedir.map((p) => (
            <li key={p.ordem} className="flex gap-3">
              <span
                className={cn(
                  'num mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px]',
                  p.quem === 'cleo'
                    ? 'border-cleo/50 bg-cleo/10 text-cleo'
                    : 'border-gold/50 bg-gold/10 text-gold',
                )}
              >
                {p.ordem}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12.5px] text-ink">{p.titulo}</span>
                  <Badge tom={p.quem === 'cleo' ? 'cleo' : 'gold'}>
                    {p.quem === 'cleo' ? 'a Cleo faz' : 'depende de você'}
                  </Badge>
                </div>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">{p.detalhe}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-4 flex flex-wrap gap-2">
          <Botao variante="primario" tamanho="sm" onClick={aoRedigir}>
            <Sparkles size={11} /> A Cleo monta o pedido
          </Botao>
          {rota.via === 'emenda' && (
            <Botao tamanho="sm" onClick={aoPedirEmenda}>
              <HandCoins size={11} /> Ver quem tem saldo para indicar
            </Botao>
          )}
        </div>
      </div>
    </Panel>
  )
}

/* ---------- Radar: dinheiro dormindo + comparação com pares ---------- */

function Radar({ dormindo, perfil }: { dormindo: DinheiroDormindo[]; perfil: PerfilMunicipio }) {
  const comparacao = useMemo(() => pares(perfil), [perfil])
  const todos = [comparacao.alvo, ...comparacao.pares].sort((a, b) => b.porHabitante - a.porHabitante)
  const melhor = todos[0]
  const teto = melhor.porHabitante

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Panel className="overflow-hidden">
        <PanelHeader
          eyebrow="O que já é seu e vai vencer"
          titulo="Dinheiro dormindo"
          acao={<Flame size={15} className="text-alert" />}
        />
        <div className="border-b border-line bg-alert/[0.04] px-4 py-3 lg:px-5">
          <p className="text-[12px] leading-relaxed text-muted">
            Recurso que o município já conquistou e perde por inércia.{' '}
            <span className="text-ink">
              Não depende de convencer ninguém em Brasília — depende de alguém aqui dentro mexer.
            </span>
          </p>
        </div>
        <ul className="divide-y divide-line-soft">
          {dormindo.map((d) => (
            <li key={d.id} className="px-4 py-3.5 lg:px-5">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <Badge
                  tom={
                    d.categoria === 'rap_expirando'
                      ? 'alert'
                      : d.categoria === 'emenda_livre'
                        ? 'cleo'
                        : 'gold'
                  }
                >
                  {ROTULO_CATEGORIA[d.categoria]}
                </Badge>
                <span
                  className={cn(
                    'num text-[11.5px]',
                    d.diasParaVencer <= 30
                      ? 'text-alert'
                      : d.diasParaVencer <= 90
                        ? 'text-gold'
                        : 'text-faint',
                  )}
                >
                  {d.diasParaVencer} dias
                </span>
                <span className="num ml-auto text-[13px] text-gold">{moedaCompacta(d.valor)}</span>
              </div>
              <div className="text-[12.5px] leading-snug text-ink">{d.titulo}</div>
              <div className="mt-0.5 text-[11px] text-faint">{d.origem}</div>
              <div className="mt-2 flex items-start gap-2 rounded-lg border border-teal/25 bg-teal/[0.05] px-3 py-2">
                <Sparkles size={11} className="mt-0.5 shrink-0 text-teal" />
                <p className="text-[11.5px] leading-relaxed text-muted">{d.acao}</p>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel className="overflow-hidden">
        <PanelHeader
          eyebrow="Mesmo porte, mesma UF"
          titulo="Como seus pares captam"
          acao={<Trophy size={15} className="text-gold" />}
        />
        <div className="border-b border-line px-4 py-3.5 lg:px-5">
          <p className="text-[12px] leading-relaxed text-muted">
            {perfil.nome} está em{' '}
            <span className="text-ink">
              {comparacao.posicao}º de {todos.length}
            </span>{' '}
            em captação por habitante no exercício.
          </p>
        </div>
        <ul className="flex flex-col gap-3 px-4 py-4 lg:px-5">
          {todos.map((p) => {
            const eu = p.nome === perfil.nome
            return (
              <li key={p.nome}>
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <span className={cn('truncate text-[12.5px]', eu ? 'text-gold' : 'text-ink')}>
                    {p.nome}
                    {eu && <span className="ml-1.5 text-[10px] text-faint">você</span>}
                  </span>
                  <span className="num shrink-0 text-[11.5px] text-muted">
                    {moedaCompacta(p.captadoNoAno)}
                  </span>
                </div>
                <Medidor valor={p.porHabitante / teto} tom={eu ? 'gold' : 'inert'} />
                <div className="num mt-0.5 text-[10px] text-faint">
                  R$ {p.porHabitante.toFixed(0)} por habitante · {p.convenios} convênios
                </div>
              </li>
            )
          })}
        </ul>
        <div className="border-t border-line px-4 py-3.5 lg:px-5">
          <p className="text-[11.5px] leading-relaxed text-muted">
            <span className="text-ink">{melhor.nome}</span> captou{' '}
            {(melhor.porHabitante / comparacao.alvo.porHabitante).toFixed(1)}× mais por habitante no
            mesmo período. A diferença não é de porte — é de quantas propostas entraram.
          </p>
        </div>
      </Panel>
    </div>
  )
}

/* ---------- Parlamentares com saldo livre ---------- */

function Parlamentares({
  lista,
  aoPedir,
}: {
  lista: ParlamentarLivre[]
  aoPedir: (p: ParlamentarLivre) => void
}) {
  const [soRegiao, setSoRegiao] = useState(true)
  const filtrada = soRegiao ? lista.filter((p) => p.baseNaRegiao) : lista
  const total = filtrada.reduce((s, p) => s + p.saldoLivre, 0)

  return (
    <div className="flex flex-col gap-4">
      <Panel className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center lg:px-5">
        <HandCoins size={16} className="mt-0.5 shrink-0 text-teal" />
        <p className="flex-1 text-[12.5px] leading-relaxed text-muted">
          Emenda autorizada menos empenhada é{' '}
          <span className="text-ink">saldo que ainda pode ser destinado</span> — e quem chega
          primeiro com o pedido pronto leva. Execução abaixo de 50% significa janela de decisão
          aberta.
        </p>
        <button
          onClick={() => setSoRegiao((v) => !v)}
          className={cn(
            'shrink-0 rounded-lg border px-3 py-1.5 text-[11.5px] transition-colors',
            soRegiao
              ? 'border-teal/45 bg-teal/10 text-teal'
              : 'border-line text-muted hover:text-ink',
          )}
        >
          {soRegiao ? 'Só a bancada do RJ' : 'Todos os parlamentares'}
        </button>
      </Panel>

      <div className="flex flex-wrap items-baseline gap-3 px-1">
        <span className="num text-[19px] text-teal">{moedaCompacta(total)}</span>
        <span className="text-[12.5px] text-muted">
          de saldo livre em {filtrada.length}{' '}
          {filtrada.length === 1 ? 'parlamentar' : 'parlamentares'}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtrada.map((p) => {
          const janelaAberta = p.pctExecutado < 50
          return (
            <Panel key={p.id} className="flex flex-col overflow-hidden">
              <div className="flex items-start gap-3 border-b border-line px-4 py-3.5">
                <Avatar
                  iniciais={p.nome
                    .split(' ')
                    .map((x) => x[0])
                    .slice(0, 2)
                    .join('')}
                  tom={p.baseNaRegiao ? 'teal' : 'inert'}
                />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <Badge tom={p.casa === 'Senado' ? 'cleo' : 'teal'}>
                      {p.casa === 'Senado' ? 'SEN' : 'DEP'}
                    </Badge>
                    <span className="num text-[10.5px] text-faint">
                      {p.partido}/{p.uf}
                    </span>
                  </div>
                  <div className="truncate text-[13px] text-ink">{p.nome}</div>
                </div>
              </div>

              <div className="px-4 py-3.5">
                <div className="eyebrow mb-1">Saldo livre</div>
                <div className="num text-[21px] leading-none text-teal">
                  {moedaCompacta(p.saldoLivre)}
                </div>

                <div className="mt-3 mb-1 flex items-baseline justify-between">
                  <span className="text-[11px] text-muted">Executado</span>
                  <span className={cn('num text-[11.5px]', janelaAberta ? 'text-teal' : 'text-gold')}>
                    {p.pctExecutado.toFixed(0)}%
                  </span>
                </div>
                <Medidor valor={p.pctExecutado / 100} tom={janelaAberta ? 'teal' : 'gold'} />
                <div className="num mt-1 text-[10px] text-faint">
                  autorizado {moedaCompacta(p.valorAutorizado)}
                </div>

                {janelaAberta && (
                  <div className="mt-2.5 text-[11px] text-teal">janela de decisão aberta</div>
                )}
                {p.jaAtendeuMunicipio && (
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-gold">
                    <CheckCircle2 size={10} className="shrink-0" /> já destinou recurso ao município
                  </div>
                )}
              </div>

              <div className="mt-auto border-t border-line px-4 py-3">
                <Botao
                  variante="primario"
                  tamanho="sm"
                  className="w-full justify-center"
                  onClick={() => aoPedir(p)}
                >
                  <FileSignature size={11} /> A Cleo escreve o pedido
                </Botao>
              </div>
            </Panel>
          )
        })}
      </div>
    </div>
  )
}

/* ---------- Oportunidades ---------- */

function Oportunidades({
  lista,
  perfil,
  aoUsar,
}: {
  lista: Oportunidade[]
  perfil: PerfilMunicipio
  aoUsar: (o: Oportunidade) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <Panel className="flex items-start gap-3.5 px-4 py-4 lg:px-5">
        <Target size={16} className="mt-0.5 shrink-0 text-cleo" />
        <p className="text-[12.5px] leading-relaxed text-muted">
          A Cleo cruza o perfil do município — porte, contrapartida disponível, regularidade e
          histórico — com a regra de cada programa aberto.{' '}
          <span className="text-ink">A aderência é conta aberta</span>, não palpite: cada card
          mostra por que combina e o que ainda falta.
        </p>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {lista.map((o) => {
          const dias = diasAte(o.prazoFinal)
          return (
            <Panel key={o.id} className="flex flex-col overflow-hidden">
              <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-4 lg:px-5">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge tom="cleo">{o.orgaoSigla}</Badge>
                    {o.status === 'encerrando' && <Badge tom="alert">encerrando</Badge>}
                    <span className="text-[10.5px] text-faint">
                      {o.paresQueCaptaram} pares já captaram
                    </span>
                  </div>
                  <h3 className="text-[14.5px] leading-snug">{o.programa}</h3>
                  <p className="mt-1 text-[11.5px] text-muted">{o.objetoTipico}</p>
                </div>
                <div className="shrink-0 text-right">
                  <div
                    className={cn(
                      'num text-[19px]',
                      o.aderencia > 0.8
                        ? 'text-teal'
                        : o.aderencia > 0.55
                          ? 'text-gold'
                          : 'text-muted',
                    )}
                  >
                    {(o.aderencia * 100).toFixed(0)}%
                  </div>
                  <div className="text-[10px] text-faint">aderência</div>
                </div>
              </div>

              <div className="px-4 py-4 lg:px-5">
                <div className="mb-3 grid grid-cols-2 gap-3 text-[11.5px] sm:grid-cols-3">
                  <div className="col-span-2 min-w-0 sm:col-span-1">
                    <div className="eyebrow mb-0.5">Faixa</div>
                    <div className="num text-ink">
                      {moedaCompacta(o.faixaMin)}–{moedaCompacta(o.faixaMax)}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="eyebrow mb-0.5">Contrapartida</div>
                    <div className="num text-ink">
                      {(o.contrapartidaMinima * 100).toFixed(0)}% mín.
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="eyebrow mb-0.5">Prazo</div>
                    <div className={cn('num', dias <= 7 ? 'text-alert' : 'text-ink')}>
                      {dias} dias
                    </div>
                  </div>
                </div>

                <div className="eyebrow mb-1.5">Leitura da Cleo para {perfil.nome}</div>
                <ul className="mb-3 flex flex-col gap-1">
                  {o.porqueCombina.map((c) => (
                    <li key={c} className="flex items-start gap-2 text-[11.5px] text-muted">
                      <CheckCircle2 size={11} className="mt-0.5 shrink-0 text-teal" /> {c}
                    </li>
                  ))}
                  {o.oQueFalta.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[11.5px] text-gold">
                      <AlertTriangle size={11} className="mt-0.5 shrink-0" /> {f}
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
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.15fr_1fr]">
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
                    'w-full px-4 py-3.5 text-left transition-colors lg:px-5',
                    p.id === aberto.id ? 'bg-gold/[0.06]' : 'hover:bg-white/[0.03]',
                  )}
                >
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <Badge tom={TOM_ESTAGIO[p.estagio]} ponto>
                      {estagio.rotulo}
                    </Badge>
                    <span className="num text-[11px] text-faint">{p.orgaoSigla}</span>
                    <span className="num ml-auto text-[12px] text-gold">
                      {moedaCompacta(p.valor)}
                    </span>
                  </div>
                  <div className="line-clamp-2 text-[12.5px] text-ink">{p.objeto}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                    <span>{p.programa}</span>
                    {faltam > 0 && <span className="text-gold">{faltam} anexo(s) faltando</span>}
                    {p.posicaoFila && (
                      <span className="num text-faint">
                        {p.posicaoFila.posicao}º de {p.posicaoFila.total} na fila
                      </span>
                    )}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </Panel>

      <Panel className="overflow-hidden">
        <div className="border-b border-line px-4 py-4 lg:px-5">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge tom={TOM_ESTAGIO[aberto.estagio]} ponto>
              {ESTAGIOS.find((e) => e.id === aberto.estagio)!.rotulo}
            </Badge>
            <span className="num ml-auto text-[13px] text-gold">{moeda(aberto.valor)}</span>
          </div>
          <h3 className="text-[14px] leading-snug">{aberto.objeto}</h3>
          <p className="mt-1 text-[11.5px] text-muted">
            {ESTAGIOS.find((e) => e.id === aberto.estagio)!.explica}
          </p>
          {aberto.padrinho && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-cleo">
              <Users size={11} className="shrink-0" /> {aberto.padrinho}
            </div>
          )}
        </div>

        {aberto.diligencia && (
          <div className="border-b border-line bg-alert/[0.05] px-4 py-4 lg:px-5">
            <div className="mb-2 flex items-center gap-2">
              <Clock size={13} className="shrink-0 text-alert" />
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

        <div className="px-4 py-4 lg:px-5">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="eyebrow">Documentação</span>
            <span className="num text-[11.5px] text-muted">
              {aberto.checklist.filter((c) => c.ok).length}/{aberto.checklist.length}
            </span>
          </div>
          <ul className="mb-4 flex flex-col gap-1.5">
            {aberto.checklist.map((c) => (
              <li key={c.item} className="flex items-start gap-2.5 text-[12px]">
                {c.ok ? (
                  <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-teal" />
                ) : (
                  <CircleDashed size={13} className="mt-0.5 shrink-0 text-gold" />
                )}
                <span className={c.ok ? 'text-muted' : 'text-ink'}>{c.item}</span>
              </li>
            ))}
          </ul>

          <div className="rounded-lg border border-cleo/25 bg-cleo/[0.05] px-4 py-3">
            <div className="mb-1.5 flex items-center gap-2">
              <TrendingUp size={13} className="shrink-0 text-cleo" />
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

function Oficio({
  pedido,
  perfil,
  parlamentar,
}: {
  pedido: Pedido
  perfil: PerfilMunicipio
  parlamentar: ParlamentarLivre | null
}) {
  // Chegar por "a Cleo escreve o pedido" já escolhe a peça — mas daqui a
  // pessoa troca livremente, porque o mesmo pleito precisa das quatro.
  const [tipo, setTipo] = useState<TipoPeca>(parlamentar ? 'emenda' : 'proposta')
  const peca = PECAS.find((p) => p.id === tipo)!

  const texto = useMemo(() => {
    if (tipo === 'emenda' && parlamentar)
      return redigirPedidoEmenda(parlamentar, perfil, pedido.objeto)
    if (tipo === 'diligencia') return redigirRespostaDiligencia(pedido, perfil)
    if (tipo === 'reconsideracao') return redigirReconsideracao(pedido, perfil)
    return redigirOficio(pedido, perfil)
  }, [tipo, pedido, perfil, parlamentar])

  const semDestinatario = tipo === 'emenda' && !parlamentar

  return (
    <div className="flex flex-col gap-4">
      <Panel className="overflow-hidden">
        <div className="border-b border-line px-4 py-3.5 lg:px-5">
          <div className="eyebrow mb-2">A peça</div>
          <div className="flex flex-wrap gap-2">
            {PECAS.map((p) => (
              <button
                key={p.id}
                onClick={() => setTipo(p.id)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-[12px] transition-colors',
                  tipo === p.id
                    ? 'border-gold/50 bg-gold/10 text-gold'
                    : 'border-line text-muted hover:text-ink',
                )}
              >
                {p.rotulo}
              </button>
            ))}
          </div>
          <p className="mt-2.5 text-[12px] leading-relaxed text-muted">
            <span className="text-ink">{peca.serve}</span> Destinatário: {peca.destinatario}.
          </p>
        </div>
      </Panel>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel className="overflow-hidden">
          <PanelHeader
            eyebrow="Redigido pela Cleo"
            titulo={
              tipo === 'emenda' && parlamentar
                ? `Pedido de emenda a ${parlamentar.nome}`
                : peca.rotulo
            }
            acao={<FileSignature size={15} className="text-cleo" />}
          />
          {semDestinatario ? (
            <p className="px-4 py-10 text-center text-[12.5px] leading-relaxed text-muted lg:px-5">
              Escolha um parlamentar na aba <span className="text-ink">Quem tem saldo</span> — o
              pedido de emenda é redigido para um gabinete específico, com o tratamento e o histórico
              daquele mandato.
            </p>
          ) : (
            <div className="bg-[#f4f1ea] px-5 py-6 sm:px-10 sm:py-9">
              <pre className="font-sans text-[11.5px] leading-[1.85] whitespace-pre-wrap text-[#2b2618] sm:text-[12px]">
                {texto}
              </pre>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3.5 lg:px-5">
            <Botao variante="primario" tamanho="sm" disabled={semDestinatario}>
              Enviar ao {tipo === 'emenda' ? 'gabinete' : pedido.orgaoSigla}
            </Botao>
            <Botao
              tamanho="sm"
              disabled={semDestinatario}
              onClick={() => navigator.clipboard?.writeText(texto)}
            >
              Copiar texto
            </Botao>
            <span className="text-[11px] text-faint">gerado com a norma vigente</span>
          </div>
        </Panel>

        <div className="flex flex-col gap-4">
          {/* A base legal à vista: é o que separa "texto que alguém escreveu"
              de "texto que se pode conferir" — e o que a consultoria vende. */}
          <Panel className="overflow-hidden">
            <PanelHeader
              eyebrow="Base legal aplicada"
              titulo={
                peca.normas.length === 1 ? '1 norma nesta peça' : `${peca.normas.length} normas nesta peça`
              }
              acao={<Scale size={15} className="text-gold" />}
            />
            <ul className="divide-y divide-line-soft">
              {peca.normas.map((id) => {
                const n = NORMAS[id]
                return (
                  <li key={id} className="px-4 py-3 lg:px-5">
                    <div className="text-[12.5px] text-gold">{n.rotulo}</div>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">{n.ementa}</p>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-faint">{n.ondeEntra}</p>
                  </li>
                )
              })}
            </ul>
            <div className="border-t border-line bg-alert/[0.04] px-4 py-3 lg:px-5">
              <div className="eyebrow mb-1">Sem a Cleo</div>
              <p className="text-[11.5px] leading-relaxed text-muted">{peca.semACleo}</p>
            </div>
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Por que isso importa" titulo="A linguagem que abre porta" />
            <div className="flex flex-col gap-4 px-4 py-5 text-[12.5px] leading-relaxed text-muted lg:px-5">
              <p>
                <span className="text-ink">Pedido que volta custa 40 dias.</span> A maior parte das
                devoluções não é por mérito do projeto — é por forma: falta o fundamento legal, o
                percentual de contrapartida não está explícito, o objeto está descrito em linguagem
                de obra e não de programa.
              </p>
              <p>
                <span className="text-ink">A Cleo já leu a norma.</span> Cita cada dispositivo onde
                o analista espera ver, declara a regularidade no parágrafo certo e apresenta o valor
                no formato que o sistema aceita.
              </p>
              <p>
                <span className="text-ink">É o trabalho que a consultoria cobra para fazer.</span>{' '}
                Aqui ele sai em segundos, com a norma sempre atualizada, e o município entende o que
                assina.
              </p>
              <div className="rounded-lg border border-teal/25 bg-teal/[0.05] px-4 py-3 text-[11.5px]">
                A mesma lógica se empacota para estatais: basta trocar a norma pelas diretrizes
                internas de compras, análise e hierarquia da instituição.
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
