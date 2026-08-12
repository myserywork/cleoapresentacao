import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MapPin } from 'lucide-react'
import { useApp } from '@/store/app'
import { getParlamentar, getProponente } from '@/data/repo'
import { carteirasPorParlamentar, TOM_TIPO_EMENDA } from '@/dominio/emendas'
import { diasParada } from '@/dominio/tempo'
import { moedaCompacta, numero } from '@/lib/format'
import { Badge, Botao, Panel, PanelHeader, SituacaoBadge, Vazio } from '@/components/ui'
import { Avatar, BotaoExportar, Medidor, Numero, Tabela, type Coluna } from '@/components/dados'
import { BarrasHorizontais } from '@/components/charts'
import type { Proposta } from '@/data/types'

/**
 * Ficha do parlamentar.
 *
 * Existe para ser aberta com o gabinete na linha: tudo o que ele indicou, onde
 * cada real parou e o que falta para destravar — sem precisar montar planilha.
 */
export function ParlamentarFicha() {
  const { id = '' } = useParams()
  const { orgaoId } = useApp()
  const navegar = useNavigate()

  const parlamentar = getParlamentar(id)
  const carteira = useMemo(
    () => carteirasPorParlamentar(orgaoId).find((c) => c.parlamentar.id === id),
    [orgaoId, id],
  )

  if (!parlamentar) {
    return <Vazio titulo="Parlamentar não encontrado." acao={<Link to="/emendas">Voltar</Link>} />
  }

  if (!carteira) {
    return (
      <div className="mx-auto max-w-[900px]">
        <Botao variante="fantasma" onClick={() => navegar('/emendas')}>
          <ArrowLeft size={13} /> Emendas
        </Botao>
        <Panel className="mt-4">
          <Vazio
            titulo={`${parlamentar.nome} não tem emenda apontada para este órgão. Troque o órgão na barra lateral para ver a carteira dele.`}
          />
        </Panel>
      </div>
    )
  }

  const porSituacao = new Map<string, { qtd: number; valor: number }>()
  for (const p of carteira.propostas) {
    const atual = porSituacao.get(p.situacao) ?? { qtd: 0, valor: 0 }
    porSituacao.set(p.situacao, { qtd: atual.qtd + 1, valor: atual.valor + p.valorGlobal })
  }

  const colunas: Coluna<Proposta>[] = [
    {
      id: 'numero',
      cabecalho: 'Proposta',
      valor: (p) => p.numero,
      celula: (p) => <span className="num text-[12.5px] text-ink">{p.numero}</span>,
    },
    {
      id: 'proponente',
      cabecalho: 'Proponente',
      valor: (p) => getProponente(p.proponenteId)?.nome ?? '',
      celula: (p) => {
        const prop = getProponente(p.proponenteId)
        return (
          <div className="min-w-0">
            <div className="truncate text-[12.5px] text-ink">{prop?.nome}</div>
            <div className="num text-[11px] text-faint">
              {prop?.municipio}/{prop?.uf}
            </div>
          </div>
        )
      },
    },
    {
      id: 'objeto',
      cabecalho: 'Objeto',
      valor: (p) => p.objeto,
      celula: (p) => (
        <span className="line-clamp-1 max-w-[300px] text-[12px] text-muted">{p.objeto}</span>
      ),
    },
    {
      id: 'situacao',
      cabecalho: 'Situação',
      valor: (p) => p.situacao,
      celula: (p) => <SituacaoBadge situacao={p.situacao} />,
    },
    {
      id: 'parada',
      cabecalho: 'Parada há',
      alinhamento: 'direita',
      valor: (p) => diasParada(p),
      celula: (p) => {
        const dias = diasParada(p)
        return (
          <span className={`num text-[12px] ${dias > 60 ? 'text-alert' : 'text-faint'}`}>
            {dias}d
          </span>
        )
      },
    },
    {
      id: 'valor',
      cabecalho: 'Valor global',
      alinhamento: 'direita',
      valor: (p) => p.valorGlobal,
      celula: (p) => <span className="num text-gold">{moedaCompacta(p.valorGlobal)}</span>,
    },
    {
      id: 'empenhado',
      cabecalho: 'Empenhado',
      alinhamento: 'direita',
      valor: (p) => p.empenhos.reduce((s, e) => s + e.valor, 0),
      celula: (p) => {
        const v = p.empenhos.reduce((s, e) => s + e.valor, 0)
        return v > 0 ? (
          <span className="num text-teal">{moedaCompacta(v)}</span>
        ) : (
          <span className="text-[11.5px] text-faint">sem empenho</span>
        )
      },
    },
  ]

  return (
    <div className="mx-auto flex max-w-[1320px] flex-col gap-5">
      <Botao variante="fantasma" className="self-start" onClick={() => navegar('/emendas')}>
        <ArrowLeft size={13} /> Emendas
      </Botao>

      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex items-center gap-4">
          <Avatar
            iniciais={parlamentar.nome
              .split(' ')
              .map((p) => p[0])
              .slice(0, 2)
              .join('')}
            tom="cleo"
          />
          <div>
            <div className="eyebrow mb-1.5">
              {parlamentar.casa} · {parlamentar.partido}/{parlamentar.uf}
            </div>
            <h1 className="text-[26px] leading-tight">{parlamentar.nome}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tom={carteira.pressao > 90 ? 'alert' : carteira.pressao > 45 ? 'gold' : 'inert'} ponto>
            Pressão {carteira.pressao}
          </Badge>
          <BotaoExportar
            nome={`carteira-${parlamentar.nome.toLowerCase().replace(/\s+/g, '-')}`}
            itens={carteira.propostas}
            colunas={colunas}
          />
        </div>
      </header>

      <div className="grid grid-cols-5 gap-4">
        <Panel className="px-5 py-4">
          <Numero rotulo="Indicado" valor={moedaCompacta(carteira.valorIndicado)} tom="gold" />
        </Panel>
        <Panel className="px-5 py-4">
          <Numero rotulo="Empenhado" valor={moedaCompacta(carteira.valorEmpenhado)} tom="teal" />
        </Panel>
        <Panel className="px-5 py-4">
          <Numero
            rotulo="Execução"
            valor={`${(carteira.execucao * 100).toFixed(0)}%`}
            tom={carteira.execucao > 0.5 ? 'teal' : 'alert'}
          />
          <div className="mt-3">
            <Medidor valor={carteira.execucao} tom={carteira.execucao > 0.5 ? 'teal' : 'gold'} />
          </div>
        </Panel>
        <Panel className="px-5 py-4">
          <Numero
            rotulo="Propostas"
            valor={numero(carteira.propostas.length)}
            detalhe={`${carteira.emendas.length} emenda(s)`}
          />
        </Panel>
        <Panel className="px-5 py-4">
          <Numero
            rotulo="Sem andamento"
            valor={numero(carteira.paradas)}
            tom={carteira.paradas > 0 ? 'alert' : 'inert'}
            detalhe="Sem processo ou paradas há 60+ dias"
          />
        </Panel>
      </div>

      <div className="grid grid-cols-[1.9fr_1fr] gap-4">
        <Panel className="overflow-hidden">
          <PanelHeader
            eyebrow="Carteira"
            titulo="Propostas apoiadas por estas emendas"
          />
          <Tabela
            itens={carteira.propostas}
            colunas={colunas}
            chave={(p) => p.id}
            aoClicar={(p) => navegar(`/propostas/${p.id}`)}
            ordemInicial={{ coluna: 'valor', direcao: 'desc' }}
            destaque={(p) => p.empenhos.length === 0}
          />
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel>
            <PanelHeader eyebrow="Indicações" titulo="Emendas apontadas ao órgão" />
            <ul className="divide-y divide-line-soft">
              {carteira.emendas.map((e) => (
                <li key={e.emenda.id} className="px-5 py-3.5">
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <span className="num text-[12.5px] text-ink">{e.emenda.numero}</span>
                    <span className="num text-[12px] text-gold">
                      {moedaCompacta(e.valorIndicado)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tom={TOM_TIPO_EMENDA[e.emenda.tipo]}>{e.emenda.tipo}</Badge>
                    <span className="num text-[11px] text-faint">{e.emenda.ano}</span>
                    <span className="num ml-auto text-[11px] text-muted">
                      {e.propostas.length} {e.propostas.length === 1 ? 'proposta' : 'propostas'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Onde cai" titulo="Municípios beneficiados" />
            <div className="flex flex-wrap gap-1.5 px-5 py-4">
              {carteira.municipios.map((m) => (
                <span
                  key={m}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-raised px-2.5 py-1 text-[11.5px] text-muted"
                >
                  <MapPin size={10} className="text-teal" />
                  {m}
                </span>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Estágio" titulo="Onde a carteira está" />
            <div className="px-5 py-4">
              <BarrasHorizontais
                formato="numero"
                itens={[...porSituacao.entries()]
                  .map(([rotulo, v]) => ({
                    rotulo,
                    valor: v.qtd,
                    secundario: moedaCompacta(v.valor),
                  }))
                  .sort((a, b) => b.valor - a.valor)}
              />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
