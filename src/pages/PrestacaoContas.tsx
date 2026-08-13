import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ban, FileCheck2, ShieldAlert } from 'lucide-react'
import { useApp } from '@/store/app'
import { getOrgao, getProponente } from '@/data/repo'
import {
  carteiraDePrestacoes,
  resumoPrestacoes,
  TOM_PRESTACAO,
  type ItemPrestacao,
} from '@/dominio/ciclo'
import { cn, data, moedaCompacta, numero } from '@/lib/format'
import { Badge, Panel, PanelHeader } from '@/components/ui'
import { Abas, BotaoExportar, Numero, Tabela, type Coluna } from '@/components/dados'
import { Anel } from '@/components/charts'
import type { StatusPrestacao } from '@/data/types'

const CORES_STATUS: Record<string, string> = {
  'Não iniciada': 'var(--color-viz-inert)',
  'Aguardando apresentação': 'var(--color-viz-alert)',
  Apresentada: 'var(--color-viz-cleo)',
  'Em análise': 'var(--color-viz-gold)',
  Aprovada: 'var(--color-viz-teal)',
  'Aprovada com ressalva': 'var(--color-viz-gold)',
  Rejeitada: 'var(--color-viz-alert)',
}

/**
 * Prestação de contas.
 *
 * O efeito prático é o que importa: proponente inadimplente fica impedido de
 * receber transferência nova. A tela mostra quanto da carteira está travado por
 * isso, e de quem é a pendência.
 */
export function PrestacaoContas() {
  const { orgaoId } = useApp()
  const navegar = useNavigate()
  const orgao = getOrgao(orgaoId)!
  const [aba, setAba] = useState<'radar' | 'analise' | 'bloqueios'>('radar')

  const carteira = useMemo(() => carteiraDePrestacoes(orgaoId), [orgaoId])
  const resumo = useMemo(() => resumoPrestacoes(orgaoId), [orgaoId])

  const porStatus = useMemo(() => {
    const mapa = new Map<StatusPrestacao, number>()
    for (const i of carteira) mapa.set(i.status, (mapa.get(i.status) ?? 0) + 1)
    return [...mapa.entries()].map(([status, qtd]) => ({ status, qtd }))
  }, [carteira])

  const emAnalise = carteira.filter((i) => i.status === 'Apresentada' || i.status === 'Em análise')
  const bloqueios = carteira.filter((i) => i.bloqueia)

  const colunas: Coluna<ItemPrestacao>[] = [
    {
      id: 'numero',
      cabecalho: 'Proposta',
      valor: (i) => i.proposta.numero,
      celula: (i) => (
        <div className="min-w-0">
          <div className="num text-[12.5px] text-ink">{i.proposta.numero}</div>
          <div className="truncate text-[11px] text-faint">
            {getProponente(i.proposta.proponenteId)?.nome}
          </div>
        </div>
      ),
    },
    {
      id: 'status',
      cabecalho: 'Status',
      valor: (i) => i.status,
      celula: (i) => (
        <Badge tom={TOM_PRESTACAO[i.status]} ponto>
          {i.status}
        </Badge>
      ),
    },
    {
      id: 'prazo',
      cabecalho: 'Prazo legal',
      valor: (i) => i.prazo,
      celula: (i) => <span className="num text-[12px] text-muted">{data(i.prazo)}</span>,
    },
    {
      id: 'dias',
      cabecalho: 'Situação do prazo',
      alinhamento: 'direita',
      valor: (i) => i.diasParaPrazo,
      celula: (i) => {
        // Prazo só corre enquanto a entrega não veio: depois disso, o que vale
        // é a data em que o proponente apresentou.
        if (i.dataEntrega) {
          return (
            <span className="num text-[12px] text-teal">entregue em {data(i.dataEntrega)}</span>
          )
        }
        return (
          <span
            className={cn(
              'num text-[12px]',
              i.diasParaPrazo < 0 ? 'text-alert' : i.diasParaPrazo < 30 ? 'text-gold' : 'text-faint',
            )}
          >
            {i.diasParaPrazo < 0
              ? `${Math.abs(i.diasParaPrazo)}d em atraso`
              : `${i.diasParaPrazo}d restantes`}
          </span>
        )
      },
    },
    {
      id: 'ressalvas',
      cabecalho: 'Ressalvas',
      valor: (i) => i.ressalvas.join(' | '),
      celula: (i) =>
        i.ressalvas.length > 0 ? (
          <span className="line-clamp-1 max-w-[280px] text-[11.5px] text-gold">
            {i.ressalvas[0]}
          </span>
        ) : (
          <span className="text-[11.5px] text-faint">—</span>
        ),
    },
    {
      id: 'valor',
      cabecalho: 'Valor global',
      alinhamento: 'direita',
      valor: (i) => i.proposta.valorGlobal,
      celula: (i) => <span className="num text-gold">{moedaCompacta(i.proposta.valorGlobal)}</span>,
    },
  ]

  const lista = aba === 'radar' ? carteira : aba === 'analise' ? emAnalise : bloqueios

  return (
    <div className="mx-auto flex max-w-[1360px] flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="eyebrow mb-2">Encerramento</div>
          <h1 className="text-[26px] leading-tight">Prestação de contas</h1>
          <p className="mt-1.5 max-w-[74ch] text-[13px] text-muted">
            {numero(resumo.total)} convênios do {orgao.sigla} já entraram na fase de comprovação. O
            prazo legal é de 60 dias contados do fim da vigência.
          </p>
        </div>
        <BotaoExportar nome={`prestacao-contas-${orgao.sigla}`} itens={lista} colunas={colunas} />
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr_1fr_1fr] gap-4">
        <Panel className="flex items-center gap-5 px-5 py-4">
          <Anel
            tamanho={112}
            espessura={13}
            centro={{ valor: numero(resumo.total), rotulo: 'convênios' }}
            segmentos={porStatus.map((s) => ({
              rotulo: s.status,
              valor: s.qtd,
              cor: CORES_STATUS[s.status],
            }))}
          />
          <ul className="flex min-w-0 flex-col gap-1.5">
            {porStatus
              .sort((a, b) => b.qtd - a.qtd)
              .map((s) => (
                <li key={s.status} className="flex items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: CORES_STATUS[s.status] }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[11.5px] text-muted">{s.status}</span>
                  <span className="num shrink-0 text-[11.5px] text-ink">{s.qtd}</span>
                </li>
              ))}
          </ul>
        </Panel>

        <Panel className={cn('px-5 py-4', resumo.atrasadas > 0 && 'border-alert/30 bg-alert/[0.04]')}>
          <Numero
            rotulo="Em atraso"
            valor={numero(resumo.atrasadas)}
            tom="alert"
            detalhe="Prazo legal vencido sem apresentação"
          />
        </Panel>
        <Panel className="px-5 py-4">
          <Numero
            rotulo="Aguardando análise"
            valor={numero(resumo.emAnalise)}
            tom="gold"
            detalhe="Apresentadas e ainda não julgadas"
          />
        </Panel>
        <Panel className="px-5 py-4">
          <Numero
            rotulo="Valor travado"
            valor={moedaCompacta(resumo.valorBloqueado)}
            tom="alert"
            detalhe={`${resumo.proponentesBloqueados} proponentes impedidos de receber novo repasse`}
          />
        </Panel>
      </div>

      <Panel className="overflow-hidden">
        <div className="px-5 pt-1">
          <Abas
            ativa={aba}
            aoTrocar={setAba}
            abas={[
              { id: 'radar', rotulo: 'Radar de vencimento', contagem: carteira.length },
              { id: 'analise', rotulo: 'Fila de análise', contagem: emAnalise.length },
              { id: 'bloqueios', rotulo: 'Inadimplência', contagem: bloqueios.length },
            ]}
          />
        </div>

        {aba === 'bloqueios' && (
          <div className="flex items-start gap-3 border-b border-line bg-alert/[0.04] px-5 py-3.5">
            <Ban size={15} className="mt-0.5 shrink-0 text-alert" />
            <p className="text-[12.5px] leading-relaxed text-muted">
              Enquanto a pendência não é sanada, o proponente fica impedido de receber nova
              transferência voluntária do órgão. É a trava que mais gera ligação de prefeitura — e
              a que mais rápido se resolve com uma diligência bem escrita.
            </p>
          </div>
        )}

        <Tabela
          itens={lista}
          colunas={colunas}
          chave={(i) => i.proposta.id}
          aoClicar={(i) => navegar(`/propostas/${i.proposta.id}`)}
          destaque={(i) => i.atrasada}
          ordemInicial={{ coluna: 'dias', direcao: 'asc' }}
          vazio={
            aba === 'bloqueios'
              ? 'Nenhum proponente bloqueado por prestação de contas neste órgão.'
              : 'Nenhum convênio nesta fila.'
          }
        />
      </Panel>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Panel>
          <PanelHeader
            eyebrow="Julgamento"
            titulo="Como termina uma prestação de contas"
            acao={<FileCheck2 size={15} className="text-faint" />}
          />
          <ul className="flex flex-col gap-3 px-5 py-5 text-[12.5px] text-muted">
            <li>
              <span className="text-teal">Aprovada</span> — execução física e financeira
              comprovadas. Encerra o convênio e libera o proponente.
            </li>
            <li>
              <span className="text-gold">Aprovada com ressalva</span> — falha formal sem dano ao
              erário. Encerra o convênio com registro da impropriedade.
            </li>
            <li>
              <span className="text-alert">Rejeitada</span> — dano ou omissão. Abre tomada de contas
              especial e inscreve o responsável nos cadastros de restrição.
            </li>
          </ul>
        </Panel>

        <Panel>
          <PanelHeader
            eyebrow="Ressalvas mais frequentes"
            titulo="O que trava a aprovação"
            acao={<ShieldAlert size={15} className="text-faint" />}
          />
          <ul className="flex flex-col gap-2.5 px-5 py-5">
            {[...new Set(carteira.flatMap((i) => i.ressalvas))].slice(0, 5).map((r) => (
              <li key={r} className="flex items-start gap-2.5">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gold" />
                <span className="text-[12.5px] leading-relaxed text-muted">{r}</span>
              </li>
            ))}
            {carteira.every((i) => i.ressalvas.length === 0) && (
              <li className="text-[12.5px] text-muted">
                Nenhuma ressalva registrada nas prestações analisadas.
              </li>
            )}
          </ul>
        </Panel>
      </div>
    </div>
  )
}
