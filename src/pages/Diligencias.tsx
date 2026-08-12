import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Inbox, MailWarning, Repeat2, Send } from 'lucide-react'
import { useApp } from '@/store/app'
import { diligenciasDoOrgao, getAnalista, getOrgao, getProponente, getProposta } from '@/data/repo'
import { diasAte, diasDesde } from '@/dominio/ciclo'
import { cn, data, numero } from '@/lib/format'
import { Badge, Botao, Panel, PanelHeader } from '@/components/ui'
import { BotaoExportar, Numero, Tabela, type Coluna } from '@/components/dados'
import type { Diligencia } from '@/data/types'

/**
 * Diligências.
 *
 * O ping-pong que trava convênio: a casa pede documento, o proponente demora, e
 * o processo dorme. A tela separa as duas filas que travam por motivos
 * diferentes — o que não voltou e o que voltou e ninguém olhou.
 */
export function Diligencias() {
  const { orgaoId, abrirLote, notificar } = useApp()
  const navegar = useNavigate()
  const orgao = getOrgao(orgaoId)!
  const [selecionadas, setSelecionadas] = useState<string[]>([])

  const todas = useMemo(() => diligenciasDoOrgao(orgaoId), [orgaoId])

  const aguardando = useMemo(() => todas.filter((d) => !d.respondidaEm), [todas])
  const vencidas = useMemo(() => aguardando.filter((d) => diasAte(d.prazo) < 0), [aguardando])
  const respondidas = useMemo(
    () => todas.filter((d) => d.respondidaEm).sort((a, b) => (b.respondidaEm ?? '').localeCompare(a.respondidaEm ?? '')),
    [todas],
  )

  const tempoMedioResposta = useMemo(() => {
    if (respondidas.length === 0) return 0
    const soma = respondidas.reduce(
      (s, d) =>
        s + Math.max((new Date(d.respondidaEm!).getTime() - new Date(d.criadaEm).getTime()) / 86_400_000, 0),
      0,
    )
    return soma / respondidas.length
  }, [respondidas])

  function alternar(id: string) {
    setSelecionadas((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function reiterar(ids: string[]) {
    const propostaIds = [
      ...new Set(ids.map((id) => todas.find((d) => d.id === id)?.propostaId).filter(Boolean)),
    ] as string[]
    if (propostaIds.length === 0) return
    notificar({
      tipo: 'automacao',
      titulo: `${propostaIds.length} ofício(s) de reiteração em preparo`,
      detalhe: 'Cada ofício lista os itens que continuam pendentes e o novo prazo.',
      href: '/diligencias',
    })
    abrirLote({
      ritoId: 'rt-reiteracao',
      titulo: 'Reiteração de diligência vencida',
      propostaIds,
    })
    setSelecionadas([])
  }

  const colunasAguardando: Coluna<Diligencia>[] = [
    {
      id: 'selecao',
      cabecalho: '',
      largura: '34px',
      celula: (d) => (
        <input
          type="checkbox"
          checked={selecionadas.includes(d.id)}
          onChange={() => alternar(d.id)}
          onClick={(e) => e.stopPropagation()}
          className="size-3.5 accent-[var(--color-gold)]"
          aria-label={`Selecionar diligência ${d.assunto}`}
        />
      ),
    },
    {
      id: 'proposta',
      cabecalho: 'Proposta',
      valor: (d) => getProposta(d.propostaId)?.numero ?? '',
      celula: (d) => {
        const p = getProposta(d.propostaId)
        return (
          <div className="min-w-0">
            <div className="num text-[12.5px] text-ink">{p?.numero}</div>
            <div className="truncate text-[11px] text-faint">
              {p && getProponente(p.proponenteId)?.nome}
            </div>
          </div>
        )
      },
    },
    {
      id: 'assunto',
      cabecalho: 'Assunto',
      valor: (d) => d.assunto,
      celula: (d) => (
        <div className="min-w-0">
          <div className="text-[12.5px] text-ink">{d.assunto}</div>
          <div className="truncate text-[11px] text-muted">
            {d.itens.slice(0, 2).join(' · ')}
            {d.itens.length > 2 && <span className="text-faint"> +{d.itens.length - 2}</span>}
          </div>
        </div>
      ),
    },
    {
      id: 'itens',
      cabecalho: 'Itens',
      alinhamento: 'direita',
      valor: (d) => d.itens.length,
      celula: (d) => <span className="num text-muted">{d.itens.length}</span>,
    },
    {
      id: 'aberta',
      cabecalho: 'Aberta em',
      valor: (d) => d.criadaEm,
      celula: (d) => (
        <span className="num text-[12px] text-muted">
          {data(d.criadaEm)}
          <span className="ml-1.5 text-faint">({diasDesde(d.criadaEm)}d)</span>
        </span>
      ),
    },
    {
      id: 'prazo',
      cabecalho: 'Prazo',
      alinhamento: 'direita',
      valor: (d) => diasAte(d.prazo),
      celula: (d) => {
        const dias = diasAte(d.prazo)
        return (
          <span className={cn('num text-[12px]', dias < 0 ? 'text-alert' : 'text-teal')}>
            {dias < 0 ? `${Math.abs(dias)}d vencido` : `${dias}d`}
          </span>
        )
      },
    },
    {
      id: 'reiteracoes',
      cabecalho: 'Reiterações',
      alinhamento: 'direita',
      valor: (d) => d.reiteracoes,
      celula: (d) =>
        d.reiteracoes > 0 ? (
          <Badge tom="gold">{d.reiteracoes}ª</Badge>
        ) : (
          <span className="num text-faint">—</span>
        ),
    },
    {
      id: 'acao',
      cabecalho: '',
      largura: '110px',
      celula: (d) =>
        diasAte(d.prazo) < 0 ? (
          <Botao
            tamanho="sm"
            onClick={(e) => {
              e.stopPropagation()
              reiterar([d.id])
            }}
          >
            <Repeat2 size={11} /> Reiterar
          </Botao>
        ) : null,
    },
  ]

  const colunasRespondidas: Coluna<Diligencia>[] = [
    {
      id: 'proposta',
      cabecalho: 'Proposta',
      valor: (d) => getProposta(d.propostaId)?.numero ?? '',
      celula: (d) => {
        const p = getProposta(d.propostaId)
        return (
          <div className="min-w-0">
            <div className="num text-[12.5px] text-ink">{p?.numero}</div>
            <div className="truncate text-[11px] text-faint">
              {p && getProponente(p.proponenteId)?.nome}
            </div>
          </div>
        )
      },
    },
    {
      id: 'assunto',
      cabecalho: 'Assunto',
      valor: (d) => d.assunto,
      celula: (d) => <span className="text-[12.5px] text-ink">{d.assunto}</span>,
    },
    {
      id: 'autor',
      cabecalho: 'Aberta por',
      valor: (d) => getAnalista(d.autorId)?.nome ?? '',
      celula: (d) => (
        <span className="text-[12px] text-muted">{getAnalista(d.autorId)?.nome ?? '—'}</span>
      ),
    },
    {
      id: 'respondida',
      cabecalho: 'Respondida em',
      valor: (d) => d.respondidaEm ?? '',
      celula: (d) => (
        <span className="num text-[12px] text-teal">{d.respondidaEm ? data(d.respondidaEm) : '—'}</span>
      ),
    },
    {
      id: 'espera',
      cabecalho: 'Aguardando análise há',
      alinhamento: 'direita',
      valor: (d) => (d.respondidaEm ? diasDesde(d.respondidaEm) : 0),
      celula: (d) => {
        const dias = d.respondidaEm ? diasDesde(d.respondidaEm) : 0
        return (
          <span className={cn('num text-[12px]', dias > 15 ? 'text-alert' : 'text-muted')}>
            {dias}d
          </span>
        )
      },
    },
  ]

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="eyebrow mb-2">Comunicação com o proponente</div>
          <h1 className="text-[26px] leading-tight">Diligências</h1>
          <p className="mt-1.5 max-w-[74ch] text-[13px] text-muted">
            {numero(todas.length)} pedidos de complementação abertos pelo {orgao.sigla}. Metade da
            demora de um convênio mora aqui — e boa parte dela é ofício que ninguém reiterou.
          </p>
        </div>
        <BotaoExportar nome={`diligencias-${orgao.sigla}`} itens={todas} colunas={colunasAguardando} />
      </header>

      <div className="grid grid-cols-4 gap-4">
        <Panel className="px-5 py-4">
          <Numero
            rotulo="Aguardando resposta"
            valor={numero(aguardando.length)}
            tom="gold"
            detalhe="Enviadas e ainda sem retorno do proponente"
          />
        </Panel>
        <Panel className={cn('px-5 py-4', vencidas.length > 0 && 'border-alert/30 bg-alert/[0.04]')}>
          <Numero
            rotulo="Prazo vencido"
            valor={numero(vencidas.length)}
            tom="alert"
            detalhe="Cabíveis de reiteração imediata"
          />
        </Panel>
        <Panel className="px-5 py-4">
          <Numero
            rotulo="Respondidas"
            valor={numero(respondidas.length)}
            tom="teal"
            detalhe="Retorno recebido, aguardando conferência"
          />
        </Panel>
        <Panel className="px-5 py-4">
          <Numero
            rotulo="Tempo médio de resposta"
            valor={`${tempoMedioResposta.toFixed(0)} dias`}
            detalhe="Da abertura da diligência até o retorno"
          />
        </Panel>
      </div>

      {vencidas.length > 0 && (
        <Panel className="flex items-center gap-4 border-alert/25 bg-alert/[0.05] px-5 py-3.5">
          <MailWarning size={16} className="shrink-0 text-alert" />
          <p className="flex-1 text-[12.5px] text-muted">
            <span className="text-ink">{vencidas.length} diligências com prazo vencido.</span> A
            Cleo redige um ofício de reiteração para cada uma, com os itens que continuam pendentes
            e o novo prazo, e envia tudo para o bloco de assinatura.
          </p>
          <Botao variante="primario" onClick={() => reiterar(vencidas.map((d) => d.id))}>
            <Send size={12} /> Reiterar as {vencidas.length}
          </Botao>
        </Panel>
      )}

      {selecionadas.length > 0 && (
        <Panel className="flex items-center gap-4 border-gold/30 bg-gold/[0.06] px-5 py-3">
          <span className="num text-[13px] text-gold">{selecionadas.length} selecionada(s)</span>
          <div className="flex-1" />
          <Botao tamanho="sm" variante="fantasma" onClick={() => setSelecionadas([])}>
            Limpar
          </Botao>
          <Botao tamanho="sm" variante="primario" onClick={() => reiterar(selecionadas)}>
            <Repeat2 size={11} /> Reiterar selecionadas
          </Botao>
        </Panel>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Panel className="overflow-hidden">
          <PanelHeader
            eyebrow="Saiu e não voltou"
            titulo="Aguardando o proponente"
            acao={<span className="num text-[12px] text-muted">{aguardando.length}</span>}
          />
          <Tabela
            compacta
            itens={aguardando}
            colunas={colunasAguardando.filter((c) => c.id !== 'assunto' && c.id !== 'itens')}
            chave={(d) => d.id}
            aoClicar={(d) => navegar(`/propostas/${d.propostaId}`)}
            destaque={(d) => diasAte(d.prazo) < 0}
            ordemInicial={{ coluna: 'prazo', direcao: 'asc' }}
            vazio="Nenhuma diligência aberta aguardando resposta."
          />
        </Panel>

        <Panel className="overflow-hidden">
          <PanelHeader
            eyebrow="Voltou e ninguém olhou"
            titulo="Aguardando a casa"
            acao={<Inbox size={15} className="text-faint" />}
          />
          <Tabela
            compacta
            itens={respondidas.slice(0, 40)}
            colunas={colunasRespondidas}
            chave={(d) => d.id}
            aoClicar={(d) => navegar(`/propostas/${d.propostaId}`)}
            destaque={(d) => (d.respondidaEm ? diasDesde(d.respondidaEm) > 15 : false)}
            ordemInicial={{ coluna: 'espera', direcao: 'desc' }}
            vazio="Nenhuma resposta pendente de análise."
          />
        </Panel>
      </div>

      <Panel className="overflow-hidden">
        <PanelHeader eyebrow="Detalhe" titulo="Todas as diligências abertas" />
        <Tabela
          itens={aguardando}
          colunas={colunasAguardando}
          chave={(d) => d.id}
          aoClicar={(d) => navegar(`/propostas/${d.propostaId}`)}
          destaque={(d) => diasAte(d.prazo) < 0}
          ordemInicial={{ coluna: 'prazo', direcao: 'asc' }}
        />
      </Panel>
    </div>
  )
}
