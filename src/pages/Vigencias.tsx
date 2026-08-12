import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarRange, FileSignature, TimerReset, X } from 'lucide-react'
import { useApp } from '@/store/app'
import { getOrgao, getProponente } from '@/data/repo'
import { carteiraDeVigencias, sugerirProrrogacao, type ItemVigencia } from '@/dominio/ciclo'
import { cn, data, moedaCompacta, numero } from '@/lib/format'
import { Badge, Botao, Panel, PanelHeader, SituacaoBadge } from '@/components/ui'
import { BotaoExportar, Medidor, Numero, Segmentado, Tabela, type Coluna } from '@/components/dados'

type Recorte = 'todas' | '30' | '90' | 'vencidas'

/**
 * Vigências e aditivos.
 *
 * Convênio é contrato com data para morrer. A tela ordena pelo que vence antes
 * e, entre iguais, pelo que está mais longe de terminar a obra — porque é esse
 * que prorrogar de fato resolve.
 */
export function Vigencias() {
  const { orgaoId, abrirExecucao, notificar } = useApp()
  const navegar = useNavigate()
  const orgao = getOrgao(orgaoId)!
  const [recorte, setRecorte] = useState<Recorte>('todas')
  const [simulando, setSimulando] = useState<ItemVigencia | null>(null)

  const carteira = useMemo(() => carteiraDeVigencias(orgaoId), [orgaoId])

  const filtrada = useMemo(() => {
    switch (recorte) {
      case '30':
        return carteira.filter((i) => i.situacao.diasRestantes >= 0 && i.situacao.diasRestantes <= 30)
      case '90':
        return carteira.filter((i) => i.situacao.diasRestantes >= 0 && i.situacao.diasRestantes <= 90)
      case 'vencidas':
        return carteira.filter((i) => i.situacao.diasRestantes < 0)
      default:
        return carteira
    }
  }, [carteira, recorte])

  const vencidas = carteira.filter((i) => i.situacao.faixa === 'vencida')
  const criticas = carteira.filter((i) => i.situacao.faixa === 'critica')
  const emRisco = carteira.filter(
    (i) => i.situacao.diasRestantes <= 90 && i.situacao.diasRestantes >= 0 && i.execucaoFisica < 0.7,
  )
  const prorrogadas = carteira.filter((i) => i.situacao.prorrogada)

  const colunas: Coluna<ItemVigencia>[] = [
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
      id: 'situacao',
      cabecalho: 'Situação',
      valor: (i) => i.proposta.situacao,
      celula: (i) => <SituacaoBadge situacao={i.proposta.situacao} />,
    },
    {
      id: 'fim',
      cabecalho: 'Fim da vigência',
      valor: (i) => i.situacao.vigencia.fim,
      celula: (i) => (
        <div>
          <div className="num text-[12px] text-ink">{data(i.situacao.vigencia.fim)}</div>
          <div className="num text-[10.5px] text-faint">
            desde {data(i.situacao.vigencia.inicio)}
          </div>
        </div>
      ),
    },
    {
      id: 'dias',
      cabecalho: 'Prazo',
      alinhamento: 'direita',
      valor: (i) => i.situacao.diasRestantes,
      celula: (i) => (
        <span
          className={cn(
            'num text-[12px]',
            i.situacao.faixa === 'vencida'
              ? 'text-alert'
              : i.situacao.faixa === 'critica'
                ? 'text-alert'
                : i.situacao.faixa === 'atencao'
                  ? 'text-gold'
                  : 'text-faint',
          )}
        >
          {i.situacao.diasRestantes < 0
            ? `${Math.abs(i.situacao.diasRestantes)}d vencida`
            : `${i.situacao.diasRestantes}d`}
        </span>
      ),
    },
    {
      id: 'execucao',
      cabecalho: 'Meta física',
      largura: '150px',
      valor: (i) => i.execucaoFisica,
      celula: (i) => (
        <div className="flex items-center gap-2">
          <Medidor
            valor={i.execucaoFisica}
            tom={i.execucaoFisica > 0.75 ? 'teal' : i.execucaoFisica > 0.4 ? 'gold' : 'alert'}
          />
          <span className="num w-9 shrink-0 text-right text-[11.5px] text-muted">
            {(i.execucaoFisica * 100).toFixed(0)}%
          </span>
        </div>
      ),
    },
    {
      id: 'aditivos',
      cabecalho: 'Aditivos',
      alinhamento: 'direita',
      valor: (i) => i.situacao.vigencia.aditivos.length,
      celula: (i) =>
        i.situacao.vigencia.aditivos.length > 0 ? (
          <Badge tom="cleo">{i.situacao.vigencia.aditivos.length}</Badge>
        ) : (
          <span className="num text-faint">—</span>
        ),
    },
    {
      id: 'valor',
      cabecalho: 'Valor global',
      alinhamento: 'direita',
      valor: (i) => i.proposta.valorGlobal,
      celula: (i) => <span className="num text-gold">{moedaCompacta(i.proposta.valorGlobal)}</span>,
    },
    {
      id: 'acao',
      cabecalho: '',
      largura: '120px',
      celula: (i) => (
        <Botao
          tamanho="sm"
          onClick={(e) => {
            e.stopPropagation()
            setSimulando(i)
          }}
          disabled={!i.situacao.aindaProrrogavel}
          title={
            i.situacao.aindaProrrogavel
              ? 'Simular termo aditivo de prazo'
              : 'Vencida há mais de 30 dias: prorrogação exige processo próprio'
          }
        >
          <TimerReset size={11} /> Prorrogar
        </Botao>
      ),
    },
  ]

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="eyebrow mb-2">Prazo do instrumento</div>
          <h1 className="text-[26px] leading-tight">Vigências</h1>
          <p className="mt-1.5 max-w-[72ch] text-[13px] text-muted">
            {numero(carteira.length)} convênios do {orgao.sigla} com vigência registrada. Vencer
            sem prorrogação encerra o instrumento e devolve o saldo — a decisão precisa sair antes
            da data, não depois.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Segmentado
            valor={recorte}
            aoTrocar={setRecorte}
            opcoes={[
              { id: 'todas', rotulo: 'Todas' },
              { id: '30', rotulo: '30 dias' },
              { id: '90', rotulo: '90 dias' },
              { id: 'vencidas', rotulo: 'Vencidas' },
            ]}
          />
          <BotaoExportar nome={`vigencias-${orgao.sigla}`} itens={filtrada} colunas={colunas} />
        </div>
      </header>

      <div className="grid grid-cols-4 gap-4">
        <Panel className={cn('px-5 py-4', vencidas.length > 0 && 'border-alert/30 bg-alert/[0.04]')}>
          <Numero
            rotulo="Vigência encerrada"
            valor={numero(vencidas.length)}
            tom={vencidas.length > 0 ? 'alert' : 'inert'}
            detalhe="Instrumento sem prazo em curso"
          />
        </Panel>
        <Panel className="px-5 py-4">
          <Numero
            rotulo="Vencem em 30 dias"
            valor={numero(criticas.length)}
            tom="alert"
            detalhe="Aditivo precisa ser assinado antes da data"
          />
        </Panel>
        <Panel className="px-5 py-4">
          <Numero
            rotulo="Risco de não concluir"
            valor={numero(emRisco.length)}
            tom="gold"
            detalhe="Vencem em 90 dias com menos de 70% da meta"
          />
        </Panel>
        <Panel className="px-5 py-4">
          <Numero
            rotulo="Já prorrogados"
            valor={numero(prorrogadas.length)}
            tom="cleo"
            detalhe={`${((prorrogadas.length / Math.max(carteira.length, 1)) * 100).toFixed(0)}% da carteira com aditivo de prazo`}
          />
        </Panel>
      </div>

      <Panel className="overflow-hidden">
        <PanelHeader
          eyebrow="Régua de vencimento"
          titulo={
            recorte === 'todas'
              ? 'Toda a carteira com vigência'
              : recorte === 'vencidas'
                ? 'Convênios com vigência encerrada'
                : `Convênios que vencem em até ${recorte} dias`
          }
          acao={<span className="num text-[12px] text-muted">{filtrada.length} convênios</span>}
        />
        <Tabela
          itens={filtrada}
          colunas={colunas}
          chave={(i) => i.proposta.id}
          aoClicar={(i) => navegar(`/propostas/${i.proposta.id}`)}
          destaque={(i) => i.situacao.diasRestantes < 30}
          vazio="Nenhum convênio nesta faixa de prazo."
        />
      </Panel>

      {simulando && (
        <SimulacaoAditivo
          item={simulando}
          aoFechar={() => setSimulando(null)}
          aoGerar={(meses) => {
            const proposta = simulando.proposta
            setSimulando(null)
            notificar({
              tipo: 'automacao',
              titulo: 'Minuta de termo aditivo em preparo',
              detalhe: `${proposta.numero} — prorrogação de ${meses} meses.`,
              href: `/propostas/${proposta.id}`,
            })
            abrirExecucao({
              propostaId: proposta.id,
              fila: ['criar_documento', 'adicionar_bloco_interno'],
              titulo: `Termo aditivo de prazo — ${meses} meses`,
            })
          }}
        />
      )}
    </div>
  )
}

/* ---------- Simulação do termo aditivo ---------- */

function SimulacaoAditivo({
  item,
  aoFechar,
  aoGerar,
}: {
  item: ItemVigencia
  aoFechar: () => void
  aoGerar: (meses: number) => void
}) {
  const sugestao = useMemo(() => sugerirProrrogacao(item.proposta.id), [item.proposta.id])
  const [meses, setMeses] = useState(sugestao.meses)

  const novaData = useMemo(() => {
    const d = new Date(item.situacao.vigencia.fim)
    d.setMonth(d.getMonth() + meses)
    return d.toISOString()
  }, [item.situacao.vigencia.fim, meses])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-abyss/80 p-6 backdrop-blur-sm"
      onClick={aoFechar}
    >
      <Panel
        className="w-full max-w-[620px] overflow-hidden bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <div className="eyebrow mb-1.5">Simulação de termo aditivo</div>
            <h3 className="text-[16px]">{item.proposta.numero}</h3>
            <p className="mt-1 text-[12px] text-muted">
              {getProponente(item.proposta.proponenteId)?.nome}
            </p>
          </div>
          <button onClick={aoFechar} className="text-faint hover:text-ink" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-5">
          <div className="mb-5 flex items-center gap-4">
            <div className="flex-1 rounded-lg border border-line bg-abyss/40 px-4 py-3">
              <div className="eyebrow mb-1">Vigência atual</div>
              <div className="num text-[14px] text-ink">{data(item.situacao.vigencia.fim)}</div>
              <div className="mt-1 text-[11px] text-faint">
                {item.situacao.diasRestantes < 0
                  ? `Encerrada há ${Math.abs(item.situacao.diasRestantes)} dias`
                  : `${item.situacao.diasRestantes} dias restantes`}
              </div>
            </div>
            <CalendarRange size={18} className="shrink-0 text-cleo" />
            <div className="flex-1 rounded-lg border border-cleo/30 bg-cleo/[0.06] px-4 py-3">
              <div className="eyebrow mb-1">Nova vigência</div>
              <div className="num text-[14px] text-cleo">{data(novaData)}</div>
              <div className="mt-1 text-[11px] text-faint">+{meses} meses</div>
            </div>
          </div>

          <label className="eyebrow mb-2 block">Prazo do aditivo</label>
          <input
            type="range"
            min={3}
            max={24}
            value={meses}
            onChange={(e) => setMeses(Number(e.target.value))}
            className="w-full accent-[var(--color-cleo)]"
          />
          <div className="num mt-1 flex justify-between text-[10.5px] text-faint">
            <span>3 meses</span>
            <span>24 meses</span>
          </div>

          <div className="mt-5 rounded-lg border border-line bg-abyss/40 px-4 py-3.5">
            <div className="eyebrow mb-1.5">Sugestão da Cleo</div>
            <p className="text-[12.5px] leading-relaxed text-muted">{sugestao.porque}</p>
            <div className="mt-2.5 flex items-center gap-2">
              <Medidor valor={item.execucaoFisica} tom="teal" />
              <span className="num shrink-0 text-[11px] text-muted">
                {(item.execucaoFisica * 100).toFixed(0)}% executado
              </span>
            </div>
          </div>

          <p className="mt-4 text-[11.5px] leading-relaxed text-faint">
            A minuta é redigida a partir do modelo de termo aditivo, com o novo prazo e a
            justificativa preenchidos. Nada é assinado nem enviado ao SEI de verdade.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
          <Botao variante="fantasma" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao variante="primario" onClick={() => aoGerar(meses)}>
            <FileSignature size={12} /> Gerar minuta do aditivo
          </Botao>
        </div>
      </Panel>
    </div>
  )
}
