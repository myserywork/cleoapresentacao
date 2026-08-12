import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Columns3, X } from 'lucide-react'
import { useApp } from '@/store/app'
import {
  ORGAOS,
  extensaoDa,
  getEmenda,
  getParlamentar,
  getProponente,
  getProposta,
  resumoOrgao,
  responsavelDaProposta,
} from '@/data/repo'
import { funilDoOrgao } from '@/dominio/orcamento'
import { resumoPrestacoes, situacaoVigencia, execucaoFisica } from '@/dominio/ciclo'
import { resumoEmendas } from '@/dominio/emendas'
import { aderenciaSla, alertas } from '@/dominio/riscos'
import { scoreProponente } from '@/dominio/proponentes'
import { cn, data, moeda, moedaCompacta, numero } from '@/lib/format'
import { Badge, Botao, Panel, PanelHeader, SituacaoBadge, Vazio } from '@/components/ui'
import { Abas, Medidor } from '@/components/dados'

/**
 * Comparação.
 *
 * Dois modos: órgãos lado a lado, para a conversa de patrocínio, e propostas
 * lado a lado, para a conversa de análise. Em ambos, o trabalho da tela é
 * destacar a diferença — o olho não deveria precisar procurar.
 */
export function Comparar() {
  const { comparacao } = useApp()
  const [aba, setAba] = useState<'orgaos' | 'propostas'>('orgaos')

  return (
    <div className="mx-auto flex max-w-[1300px] flex-col gap-5">
      <header>
        <div className="eyebrow mb-2">Lado a lado</div>
        <h1 className="text-[26px] leading-tight">Comparar</h1>
        <p className="mt-1.5 max-w-[72ch] text-[13px] text-muted">
          Comparação entre órgãos, para entender onde a máquina anda melhor, e entre propostas,
          para decidir com o contexto das duas à vista.
        </p>
      </header>

      <Abas
        ativa={aba}
        aoTrocar={setAba}
        abas={[
          { id: 'orgaos', rotulo: 'Órgãos', contagem: ORGAOS.length },
          { id: 'propostas', rotulo: 'Propostas', contagem: comparacao.length },
        ]}
      />

      {aba === 'orgaos' ? <CompararOrgaos /> : <CompararPropostas />}
    </div>
  )
}

/* ==================== Órgãos ==================== */

interface LinhaComparacao {
  rotulo: string
  detalhe: string
  valores: number[]
  formato: (v: number) => string
  /** Verdadeiro quando o maior é o melhor. */
  maiorMelhor: boolean
}

function CompararOrgaos() {
  const { setOrgaoId, orgaoId } = useApp()

  const linhas = useMemo<LinhaComparacao[]>(() => {
    const resumos = ORGAOS.map((o) => resumoOrgao(o.id))
    const funis = ORGAOS.map((o) => funilDoOrgao(o.id))
    const contas = ORGAOS.map((o) => resumoPrestacoes(o.id))
    const emendas = ORGAOS.map((o) => resumoEmendas(o.id))
    const slas = ORGAOS.map((o) => {
      const s = aderenciaSla(o.id)
      const total = s.reduce((acc, x) => acc + x.total, 0)
      const fora = s.reduce((acc, x) => acc + x.fora, 0)
      return total > 0 ? 1 - fora / total : 1
    })

    return [
      {
        rotulo: 'Propostas na carteira',
        detalhe: 'Volume total sob gestão do órgão',
        valores: resumos.map((r) => r.totalPropostas),
        formato: (v) => numero(v),
        maiorMelhor: true,
      },
      {
        rotulo: 'Valor da carteira',
        detalhe: 'Soma do valor global das propostas',
        valores: resumos.map((r) => r.valorGlobal),
        formato: moedaCompacta,
        maiorMelhor: true,
      },
      {
        rotulo: 'Execução orçamentária',
        detalhe: 'Pago ÷ dotação autorizada',
        valores: funis.map((f) => f.execucao),
        formato: (v) => `${(v * 100).toFixed(1)}%`,
        maiorMelhor: true,
      },
      {
        rotulo: 'Saldo a empenhar',
        detalhe: 'Dotação ainda não comprometida',
        valores: funis.map((f) => f.dotacao - f.empenhado),
        formato: moedaCompacta,
        maiorMelhor: false,
      },
      {
        rotulo: 'Aderência ao prazo',
        detalhe: 'Propostas dentro do prazo da fase',
        valores: slas,
        formato: (v) => `${(v * 100).toFixed(0)}%`,
        maiorMelhor: true,
      },
      {
        rotulo: 'Automações executadas',
        detalhe: 'Execuções concluídas com sucesso',
        valores: resumos.map((r) => r.automacoesExecutadas),
        formato: (v) => numero(v),
        maiorMelhor: true,
      },
      {
        rotulo: 'Documentos gerados pela Cleo',
        detalhe: 'A partir de minuta, no SEI',
        valores: resumos.map((r) => r.documentosGerados),
        formato: (v) => numero(v),
        maiorMelhor: true,
      },
      {
        rotulo: 'Horas devolvidas',
        detalhe: 'Tempo manual substituído por automação',
        valores: resumos.map((r) => r.horasEconomizadas),
        formato: (v) => `${numero(v)} h`,
        maiorMelhor: true,
      },
      {
        rotulo: 'Execução de emendas',
        detalhe: 'Indicado que virou empenho',
        valores: emendas.map((e) => e.execucao),
        formato: (v) => `${(v * 100).toFixed(0)}%`,
        maiorMelhor: true,
      },
      {
        rotulo: 'Prestações em atraso',
        detalhe: 'Prazo legal vencido sem apresentação',
        valores: contas.map((c) => c.atrasadas),
        formato: (v) => numero(v),
        maiorMelhor: false,
      },
      {
        rotulo: 'Proponentes bloqueados',
        detalhe: 'Impedidos de receber nova transferência',
        valores: contas.map((c) => c.proponentesBloqueados),
        formato: (v) => numero(v),
        maiorMelhor: false,
      },
    ]
  }, [])

  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        eyebrow="Benchmark"
        titulo="Os três órgãos, mesma régua"
        acao={<Columns3 size={15} className="text-faint" />}
      />

      <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] border-b border-line">
        <div className="px-5 py-3" />
        {ORGAOS.map((o) => (
          <button
            key={o.id}
            onClick={() => setOrgaoId(o.id)}
            className={cn(
              'border-l border-line px-5 py-3 text-left transition-colors hover:bg-white/[0.03]',
              o.id === orgaoId && 'bg-gold/[0.06]',
            )}
          >
            <div className={cn('text-[14px]', o.id === orgaoId ? 'text-gold' : 'text-ink')}>
              {o.sigla}
            </div>
            <div className="mt-0.5 line-clamp-1 text-[10.5px] text-faint">{o.nome}</div>
          </button>
        ))}
      </div>

      <ul>
        {linhas.map((linha) => {
          const melhor = linha.maiorMelhor
            ? Math.max(...linha.valores)
            : Math.min(...linha.valores)
          const pior = linha.maiorMelhor ? Math.min(...linha.valores) : Math.max(...linha.valores)
          const maximo = Math.max(...linha.valores.map(Math.abs), 1)

          return (
            <li
              key={linha.rotulo}
              className="grid grid-cols-[1.5fr_1fr_1fr_1fr] border-b border-line-soft last:border-0"
            >
              <div className="px-5 py-3.5">
                <div className="text-[12.5px] text-ink">{linha.rotulo}</div>
                <div className="mt-0.5 text-[11px] text-faint">{linha.detalhe}</div>
              </div>
              {linha.valores.map((valor, i) => (
                <div key={ORGAOS[i].id} className="border-l border-line-soft px-5 py-3.5">
                  <div className="mb-1.5 flex items-baseline gap-2">
                    <span
                      className={cn(
                        'num text-[14px]',
                        valor === melhor && linha.valores.length > 1
                          ? 'text-teal'
                          : valor === pior && linha.valores.length > 1
                            ? 'text-alert'
                            : 'text-ink',
                      )}
                    >
                      {linha.formato(valor)}
                    </span>
                    {valor === melhor && <Badge tom="teal">melhor</Badge>}
                  </div>
                  <Medidor
                    valor={Math.abs(valor) / maximo}
                    tom={valor === melhor ? 'teal' : valor === pior ? 'alert' : 'inert'}
                    altura={3}
                  />
                </div>
              ))}
            </li>
          )
        })}
      </ul>

      <p className="border-t border-line px-5 py-3.5 text-[11.5px] leading-relaxed text-muted">
        Volume e valor não são mérito: um órgão maior tem carteira maior. O que compara desempenho
        de fato são as linhas de execução, prazo e inadimplência.
      </p>
    </Panel>
  )
}

/* ==================== Propostas ==================== */

function CompararPropostas() {
  const { comparacao, alternarComparacao, limparComparacao } = useApp()
  const navegar = useNavigate()

  const propostas = comparacao.map((id) => getProposta(id)).filter(Boolean)

  if (propostas.length === 0) {
    return (
      <Panel>
        <Vazio
          titulo="Nenhuma proposta na bandeja. Use o botão “comparar” na listagem, na ficha do proponente ou na tela de padrões."
          acao={<Botao onClick={() => navegar('/propostas')}>Ir para as propostas</Botao>}
        />
      </Panel>
    )
  }

  const linhas: { rotulo: string; valor: (p: NonNullable<(typeof propostas)[number]>) => ReactNode; comparar?: (p: NonNullable<(typeof propostas)[number]>) => string }[] = [
    {
      rotulo: 'Proponente',
      valor: (p) => getProponente(p.proponenteId)?.nome ?? '—',
      comparar: (p) => p.proponenteId,
    },
    {
      rotulo: 'Município',
      valor: (p) => {
        const prop = getProponente(p.proponenteId)
        return `${prop?.municipio}/${prop?.uf}`
      },
      comparar: (p) => getProponente(p.proponenteId)?.uf ?? '',
    },
    { rotulo: 'Objeto', valor: (p) => p.objeto, comparar: (p) => p.objeto },
    { rotulo: 'Programa', valor: (p) => p.programa, comparar: (p) => p.programa },
    {
      rotulo: 'Situação',
      valor: (p) => <SituacaoBadge situacao={p.situacao} />,
      comparar: (p) => p.situacao,
    },
    { rotulo: 'Modalidade', valor: (p) => p.modalidade, comparar: (p) => p.modalidade },
    { rotulo: 'Fundamento legal', valor: (p) => p.fundamentoLegal, comparar: (p) => p.fundamentoLegal },
    {
      rotulo: 'Valor global',
      valor: (p) => <span className="num text-gold">{moeda(p.valorGlobal)}</span>,
      comparar: (p) => String(p.valorGlobal),
    },
    {
      rotulo: 'Repasse',
      valor: (p) => <span className="num">{moeda(p.valorRepasse)}</span>,
      comparar: (p) => String(p.valorRepasse),
    },
    {
      rotulo: 'Contrapartida',
      valor: (p) => (
        <span className="num">
          {moeda(p.valorContrapartida)}
          <span className="ml-1.5 text-faint">
            ({((p.valorContrapartida / p.valorGlobal) * 100).toFixed(1)}%)
          </span>
        </span>
      ),
      comparar: (p) => (p.valorContrapartida / p.valorGlobal).toFixed(3),
    },
    {
      rotulo: 'Processo SEI',
      valor: (p) => <span className="num">{p.numProcessoSei ?? '— sem processo'}</span>,
      comparar: (p) => (p.numProcessoSei ? 'sim' : 'não'),
    },
    {
      rotulo: 'Emenda',
      valor: (p) => {
        const emendaId = extensaoDa(p.id)?.emendaId
        const emenda = emendaId ? getEmenda(emendaId) : undefined
        const parlamentar = emenda?.parlamentarId ? getParlamentar(emenda.parlamentarId) : undefined
        return emenda ? (
          <span>
            <span className="num">{emenda.numero}</span>
            {parlamentar && (
              <span className="ml-1.5 text-muted">
                {parlamentar.nome} ({parlamentar.partido}/{parlamentar.uf})
              </span>
            )}
          </span>
        ) : (
          'Dotação própria'
        )
      },
      comparar: (p) => extensaoDa(p.id)?.emendaId ?? 'sem',
    },
    {
      rotulo: 'Responsável',
      valor: (p) => responsavelDaProposta(p.id)?.nome ?? '—',
      comparar: (p) => responsavelDaProposta(p.id)?.id ?? '',
    },
    {
      rotulo: 'Empenhado',
      valor: (p) => {
        const v = p.empenhos.reduce((s, e) => s + e.valor, 0)
        return (
          <span className={cn('num', v > 0 ? 'text-teal' : 'text-faint')}>
            {v > 0 ? moeda(v) : 'sem empenho'}
          </span>
        )
      },
      comparar: (p) => String(p.empenhos.reduce((s, e) => s + e.valor, 0)),
    },
    {
      rotulo: 'Vigência',
      valor: (p) => {
        const v = situacaoVigencia(p.id)
        return v ? (
          <span className="num">
            até {data(v.vigencia.fim)}
            <span className={cn('ml-1.5', v.diasRestantes < 30 ? 'text-alert' : 'text-faint')}>
              ({v.diasRestantes}d)
            </span>
          </span>
        ) : (
          '—'
        )
      },
      comparar: (p) => situacaoVigencia(p.id)?.vigencia.fim ?? '',
    },
    {
      rotulo: 'Meta física',
      valor: (p) => {
        const e = execucaoFisica(p.id)
        return extensaoDa(p.id)?.vigencia ? (
          <div className="flex items-center gap-2">
            <div className="w-20">
              <Medidor valor={e} tom={e > 0.7 ? 'teal' : 'gold'} altura={4} />
            </div>
            <span className="num text-[11.5px]">{(e * 100).toFixed(0)}%</span>
          </div>
        ) : (
          '—'
        )
      },
      comparar: (p) => execucaoFisica(p.id).toFixed(2),
    },
    {
      rotulo: 'Alertas',
      valor: (p) => {
        const lista = alertas(p)
        return lista.length === 0 ? (
          <span className="text-teal">nenhum</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {lista.map((a) => (
              <Badge key={a.id} tom={a.severidade === 'critico' ? 'alert' : 'gold'}>
                {a.rotulo}
              </Badge>
            ))}
          </div>
        )
      },
      comparar: (p) => String(alertas(p).length),
    },
    {
      rotulo: 'Capacidade do proponente',
      valor: (p) => {
        const s = scoreProponente(p.proponenteId)
        return s ? (
          <span
            className={cn(
              'num',
              s.faixa === 'alta' ? 'text-teal' : s.faixa === 'media' ? 'text-gold' : 'text-alert',
            )}
          >
            {s.pontos}/100 · {s.rotulo}
          </span>
        ) : (
          '—'
        )
      },
      comparar: (p) => String(scoreProponente(p.proponenteId)?.pontos ?? 0),
    },
  ]

  const colunas = `1fr repeat(${propostas.length}, 1.3fr)`

  return (
    <Panel className="overflow-hidden">
      <div className="grid border-b border-line" style={{ gridTemplateColumns: colunas }}>
        <div className="flex items-end px-5 py-3">
          <Botao tamanho="sm" variante="fantasma" onClick={limparComparacao}>
            Limpar bandeja
          </Botao>
        </div>
        {propostas.map((p) => (
          <div key={p!.id} className="border-l border-line px-5 py-3">
            <div className="flex items-start justify-between gap-2">
              <button
                onClick={() => navegar(`/propostas/${p!.id}`)}
                className="num text-[13px] text-ink hover:text-gold"
              >
                {p!.numero}
              </button>
              <button
                onClick={() => alternarComparacao(p!.id)}
                className="text-faint hover:text-alert"
                aria-label="Remover da comparação"
              >
                <X size={13} />
              </button>
            </div>
            <div className="mt-1 line-clamp-2 text-[11px] text-faint">{p!.objeto}</div>
          </div>
        ))}
      </div>

      <ul>
        {linhas.map((linha) => {
          const chaves = propostas.map((p) => linha.comparar?.(p!) ?? '')
          const iguais = chaves.every((c) => c === chaves[0])
          return (
            <li
              key={linha.rotulo}
              className={cn(
                'grid border-b border-line-soft last:border-0',
                !iguais && propostas.length > 1 && 'bg-gold/[0.035]',
              )}
              style={{ gridTemplateColumns: colunas }}
            >
              <div className="px-5 py-3 text-[12px] text-muted">{linha.rotulo}</div>
              {propostas.map((p) => (
                <div
                  key={p!.id}
                  className="border-l border-line-soft px-5 py-3 text-[12.5px] text-ink"
                >
                  {linha.valor(p!)}
                </div>
              ))}
            </li>
          )
        })}
      </ul>

      <p className="border-t border-line px-5 py-3.5 text-[11.5px] text-muted">
        As linhas com fundo destacado são as em que as propostas divergem. Até três propostas cabem
        lado a lado sem rolagem.
      </p>
    </Panel>
  )
}
