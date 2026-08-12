import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Landmark, Phone, TrendingUp } from 'lucide-react'
import { useApp } from '@/store/app'
import { getOrgao } from '@/data/repo'
import {
  carteirasDoOrgao,
  carteirasPorParlamentar,
  resumoEmendas,
  TOM_TIPO_EMENDA,
  type CarteiraEmenda,
  type CarteiraParlamentar,
} from '@/dominio/emendas'
import { cn, moedaCompacta, numero } from '@/lib/format'
import { Badge, Panel, PanelHeader } from '@/components/ui'
import { Abas, Avatar, BotaoExportar, Medidor, Numero, Tabela, type Coluna } from '@/components/dados'
import { Anel } from '@/components/charts'

/**
 * Emendas parlamentares.
 *
 * A tela é organizada por quem cobra, não por proposta. A ordem padrão é a de
 * pressão: quanto valor está parado, há quanto tempo, e em quantas propostas.
 * É a fila de ligações que a coordenação deveria devolver hoje.
 */
export function Emendas() {
  const { orgaoId } = useApp()
  const navegar = useNavigate()
  const orgao = getOrgao(orgaoId)!
  const [aba, setAba] = useState<'parlamentares' | 'emendas'>('parlamentares')

  const resumo = useMemo(() => resumoEmendas(orgaoId), [orgaoId])
  const porParlamentar = useMemo(() => carteirasPorParlamentar(orgaoId), [orgaoId])
  const porEmenda = useMemo(() => carteirasDoOrgao(orgaoId), [orgaoId])

  const CORES_TIPO: Record<string, string> = {
    'Individual (RP6)': 'var(--color-viz-cleo)',
    'Bancada (RP7)': 'var(--color-viz-teal)',
    'Discricionária (RP2)': 'var(--color-viz-gold)',
  }

  const colunasParlamentar: Coluna<CarteiraParlamentar>[] = [
    {
      id: 'nome',
      cabecalho: 'Parlamentar',
      valor: (c) => c.parlamentar.nome,
      celula: (c) => (
        <div className="flex items-center gap-2.5">
          <Avatar
            iniciais={c.parlamentar.nome
              .split(' ')
              .map((p) => p[0])
              .slice(0, 2)
              .join('')}
            tom="cleo"
          />
          <div className="min-w-0">
            <div className="truncate text-[12.5px] text-ink">{c.parlamentar.nome}</div>
            <div className="num text-[11px] text-faint">
              {c.parlamentar.partido}/{c.parlamentar.uf} · {c.parlamentar.casa}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'emendas',
      cabecalho: 'Emendas',
      alinhamento: 'direita',
      valor: (c) => c.emendas.length,
      celula: (c) => <span className="num text-muted">{c.emendas.length}</span>,
    },
    {
      id: 'propostas',
      cabecalho: 'Propostas',
      alinhamento: 'direita',
      valor: (c) => c.propostas.length,
      celula: (c) => <span className="num text-muted">{c.propostas.length}</span>,
    },
    {
      id: 'indicado',
      cabecalho: 'Indicado',
      alinhamento: 'direita',
      valor: (c) => c.valorIndicado,
      celula: (c) => <span className="num text-gold">{moedaCompacta(c.valorIndicado)}</span>,
    },
    {
      id: 'execucao',
      cabecalho: 'Execução',
      largura: '140px',
      valor: (c) => c.execucao,
      celula: (c) => (
        <div className="flex items-center gap-2">
          <Medidor valor={c.execucao} tom={c.execucao > 0.6 ? 'teal' : c.execucao > 0.3 ? 'gold' : 'alert'} />
          <span className="num w-9 shrink-0 text-right text-[11.5px] text-muted">
            {(c.execucao * 100).toFixed(0)}%
          </span>
        </div>
      ),
    },
    {
      id: 'paradas',
      cabecalho: 'Paradas',
      alinhamento: 'direita',
      valor: (c) => c.paradas,
      celula: (c) =>
        c.paradas > 0 ? (
          <Badge tom="alert">{c.paradas}</Badge>
        ) : (
          <span className="num text-faint">—</span>
        ),
    },
    {
      id: 'pressao',
      cabecalho: 'Pressão',
      alinhamento: 'direita',
      valor: (c) => c.pressao,
      celula: (c) => (
        <span
          className={cn(
            'num text-[12.5px]',
            c.pressao > 90 ? 'text-alert' : c.pressao > 45 ? 'text-gold' : 'text-faint',
          )}
        >
          {c.pressao}
        </span>
      ),
    },
  ]

  const colunasEmenda: Coluna<CarteiraEmenda>[] = [
    {
      id: 'numero',
      cabecalho: 'Emenda',
      valor: (c) => c.emenda.numero,
      celula: (c) => (
        <div>
          <div className="num text-[12.5px] text-ink">{c.emenda.numero}</div>
          <div className="text-[11px] text-faint">{c.emenda.ano}</div>
        </div>
      ),
    },
    {
      id: 'tipo',
      cabecalho: 'Tipo',
      valor: (c) => c.emenda.tipo,
      celula: (c) => <Badge tom={TOM_TIPO_EMENDA[c.emenda.tipo]}>{c.emenda.tipo}</Badge>,
    },
    {
      id: 'autor',
      cabecalho: 'Autor',
      valor: (c) => c.parlamentar?.nome ?? '—',
      celula: (c) =>
        c.parlamentar ? (
          <div className="min-w-0">
            <div className="truncate text-[12.5px] text-ink">{c.parlamentar.nome}</div>
            <div className="num text-[11px] text-faint">
              {c.parlamentar.partido}/{c.parlamentar.uf}
            </div>
          </div>
        ) : (
          <span className="text-[12px] text-faint">Dotação própria do programa</span>
        ),
    },
    {
      id: 'propostas',
      cabecalho: 'Propostas',
      alinhamento: 'direita',
      valor: (c) => c.propostas.length,
      celula: (c) => <span className="num text-muted">{c.propostas.length}</span>,
    },
    {
      id: 'municipios',
      cabecalho: 'Municípios',
      valor: (c) => c.municipios.join(', '),
      celula: (c) => (
        <span className="text-[11.5px] text-muted">
          {c.municipios.slice(0, 2).join(', ') || '—'}
          {c.municipios.length > 2 && <span className="text-faint"> +{c.municipios.length - 2}</span>}
        </span>
      ),
    },
    {
      id: 'indicado',
      cabecalho: 'Indicado',
      alinhamento: 'direita',
      valor: (c) => c.valorIndicado,
      celula: (c) => <span className="num text-gold">{moedaCompacta(c.valorIndicado)}</span>,
    },
    {
      id: 'empenhado',
      cabecalho: 'Empenhado',
      alinhamento: 'direita',
      valor: (c) => c.valorEmpenhado,
      celula: (c) => <span className="num text-teal">{moedaCompacta(c.valorEmpenhado)}</span>,
    },
  ]

  return (
    <div className="mx-auto flex max-w-[1360px] flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="eyebrow mb-2">Origem do recurso</div>
          <h1 className="text-[26px] leading-tight">Emendas parlamentares</h1>
          <p className="mt-1.5 max-w-[70ch] text-[13px] text-muted">
            {numero(resumo.totalEmendas)} emendas de {numero(resumo.parlamentares)} parlamentares
            apontam para a carteira do {orgao.sigla}. A ordem é a de pressão: valor parado, tempo
            parado e propostas sem andamento.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-cleo/25 bg-cleo/[0.06] px-4 py-2.5">
          <Phone size={14} className="text-cleo" />
          <span className="text-[12px] text-muted">
            <span className="text-ink">{porParlamentar.filter((p) => p.pressao > 90).length}</span>{' '}
            gabinetes com cobrança provável esta semana
          </span>
        </div>
      </header>

      <div className="grid grid-cols-[1fr_1fr_1fr_1.25fr] gap-4">
        <Panel className="px-5 py-4">
          <Numero
            rotulo="Valor indicado"
            valor={moedaCompacta(resumo.valorIndicado)}
            tom="gold"
            detalhe={`${numero(resumo.totalEmendas)} emendas apontadas ao órgão`}
          />
        </Panel>
        <Panel className="px-5 py-4">
          <Numero
            rotulo="Empenhado"
            valor={moedaCompacta(resumo.valorEmpenhado)}
            tom="teal"
            detalhe="Indicado que já virou nota de empenho"
          />
        </Panel>
        <Panel className="px-5 py-4">
          <Numero
            rotulo="Execução do indicado"
            valor={`${(resumo.execucao * 100).toFixed(0)}%`}
            tom={resumo.execucao > 0.5 ? 'teal' : 'alert'}
            detalhe="Empenhado ÷ indicado"
          />
          <div className="mt-3">
            <Medidor valor={resumo.execucao} tom={resumo.execucao > 0.5 ? 'teal' : 'gold'} />
          </div>
        </Panel>
        <Panel className="flex items-center gap-4 px-5 py-4">
          <Anel
            tamanho={92}
            espessura={11}
            segmentos={resumo.porTipo.map((t) => ({
              rotulo: t.tipo,
              valor: t.valor,
              cor: CORES_TIPO[t.tipo],
            }))}
          />
          <ul className="flex min-w-0 flex-col gap-1.5">
            {resumo.porTipo.map((t) => (
              <li key={t.tipo} className="flex items-center gap-2">
                <span className="size-2 shrink-0 rounded-full" style={{ background: CORES_TIPO[t.tipo] }} />
                <span className="min-w-0 flex-1 truncate text-[11.5px] text-muted">{t.tipo}</span>
                <span className="num shrink-0 text-[11px] text-ink">{moedaCompacta(t.valor)}</span>
              </li>
            ))}
            <li className="mt-1 flex items-center gap-2 border-t border-line-soft pt-1.5">
              <span className="size-2 shrink-0 rounded-full bg-inert" />
              <span className="min-w-0 flex-1 truncate text-[11.5px] text-muted">Sem emenda</span>
              <span className="num shrink-0 text-[11px] text-ink">
                {moedaCompacta(resumo.semEmenda.valor)}
              </span>
            </li>
          </ul>
        </Panel>
      </div>

      <Panel className="overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-5 pt-1">
          <Abas
            ativa={aba}
            aoTrocar={setAba}
            abas={[
              { id: 'parlamentares', rotulo: 'Por parlamentar', contagem: porParlamentar.length },
              { id: 'emendas', rotulo: 'Por emenda', contagem: porEmenda.length },
            ]}
          />
          {aba === 'parlamentares' ? (
            <BotaoExportar nome="emendas-por-parlamentar" itens={porParlamentar} colunas={colunasParlamentar} />
          ) : (
            <BotaoExportar nome="emendas" itens={porEmenda} colunas={colunasEmenda} />
          )}
        </div>

        {aba === 'parlamentares' ? (
          <Tabela
            itens={porParlamentar}
            colunas={colunasParlamentar}
            chave={(c) => c.parlamentar.id}
            aoClicar={(c) => navegar(`/parlamentares/${c.parlamentar.id}`)}
            ordemInicial={{ coluna: 'pressao', direcao: 'desc' }}
            destaque={(c) => c.pressao > 90}
          />
        ) : (
          <Tabela
            itens={porEmenda}
            colunas={colunasEmenda}
            chave={(c) => c.emenda.id}
            aoClicar={(c) => c.parlamentar && navegar(`/parlamentares/${c.parlamentar.id}`)}
            ordemInicial={{ coluna: 'indicado', direcao: 'desc' }}
          />
        )}
      </Panel>

      <Panel>
        <PanelHeader
          eyebrow="Como lemos pressão"
          titulo="A regra que ordena a fila de gabinetes"
          acao={<Landmark size={15} className="text-faint" />}
        />
        <div className="grid grid-cols-3 gap-6 px-5 py-5">
          <div className="flex items-start gap-2.5">
            <TrendingUp size={13} className="mt-0.5 shrink-0 text-gold" />
            <p className="text-[12.5px] text-muted">
              <span className="text-ink">Valor parado</span> — cada R$ 1 milhão sem empenho vale 3
              pontos. É o que o gabinete percebe primeiro.
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <TrendingUp size={13} className="mt-0.5 shrink-0 text-teal" />
            <p className="text-[12.5px] text-muted">
              <span className="text-ink">Tempo parado</span> — a média de dias sem movimento das
              propostas vale 0,4 ponto por dia.
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <TrendingUp size={13} className="mt-0.5 shrink-0 text-alert" />
            <p className="text-[12.5px] text-muted">
              <span className="text-ink">Propostas sem andamento</span> — 6 pontos cada. Duas
              pequenas travadas incomodam mais que uma grande em dia.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  )
}
