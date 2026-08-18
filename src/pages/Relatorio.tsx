import { useMemo } from 'react'
import { Printer } from 'lucide-react'
import { useApp } from '@/store/app'
import { getOrgao, getProponente, resumoOrgao } from '@/data/repo'
import { fimDeExercicio, funilDoOrgao, riscoRestosAPagar } from '@/dominio/orcamento'
import { carteiraDeVigencias, resumoPrestacoes } from '@/dominio/ciclo'
import { resumoEmendas, carteirasPorParlamentar } from '@/dominio/emendas'
import { resumoEquipe } from '@/dominio/equipe'
import { aderenciaSla, filaDoDia } from '@/dominio/riscos'
import { detectarAnomalias } from '@/dominio/anomalias'
import { data, moeda, moedaCompacta, numero } from '@/lib/format'
import { Botao, Panel } from '@/components/ui'

/**
 * Relatório executivo.
 *
 * Uma página, linguagem de ofício, pronta para imprimir e anexar. O texto é
 * montado a partir do mesmo dado das telas — não há número aqui que o gestor
 * não consiga abrir e conferir em outra parte da plataforma.
 */
export function Relatorio() {
  const { orgaoId } = useApp()
  const orgao = getOrgao(orgaoId)!
  const hoje = new Date()

  const resumo = useMemo(() => resumoOrgao(orgaoId), [orgaoId])
  const funil = useMemo(() => funilDoOrgao(orgaoId), [orgaoId])
  const fim = useMemo(() => fimDeExercicio(orgaoId), [orgaoId])
  const restos = useMemo(() => riscoRestosAPagar(orgaoId), [orgaoId])
  const contas = useMemo(() => resumoPrestacoes(orgaoId), [orgaoId])
  const emendas = useMemo(() => resumoEmendas(orgaoId), [orgaoId])
  const equipe = useMemo(() => resumoEquipe(orgaoId), [orgaoId])
  const sla = useMemo(() => aderenciaSla(orgaoId), [orgaoId])
  const fila = useMemo(() => filaDoDia(orgaoId, 5), [orgaoId])
  const vigencias = useMemo(() => carteiraDeVigencias(orgaoId), [orgaoId])
  const padroes = useMemo(() => detectarAnomalias(orgaoId), [orgaoId])
  // Só entram no relatório os gabinetes com proposta de fato parada: citar
  // carteira em dia como "demanda de resposta" desmoraliza a lista inteira.
  const gabinetes = useMemo(
    () =>
      carteirasPorParlamentar(orgaoId)
        .filter((c) => c.paradas > 0)
        .slice(0, 3),
    [orgaoId],
  )

  const foraDoPrazo = sla.reduce((s, x) => s + x.fora, 0)
  const comSla = sla.reduce((s, x) => s + x.total, 0)
  const aderencia = comSla > 0 ? 1 - foraDoPrazo / comSla : 1
  const vencendo30 = vigencias.filter(
    (v) => v.situacao.diasRestantes >= 0 && v.situacao.diasRestantes <= 30,
  ).length

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <div className="nao-imprimir flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <div className="eyebrow mb-2">Documento</div>
          <h1 className="text-[26px] leading-tight">Relatório executivo</h1>
          <p className="mt-1.5 text-[13px] text-muted">
            Gerado agora a partir da carteira do {orgao.sigla}. Uma página, pronta para imprimir.
          </p>
        </div>
        <Botao variante="primario" onClick={() => window.print()}>
          <Printer size={13} /> Imprimir
        </Botao>
      </div>

      <Panel className="px-10 py-9 print:border-0 print:px-0 print:py-0">
        <header className="border-b border-line pb-5">
          <div className="eyebrow mb-2">{orgao.nome}</div>
          <h2 className="text-[21px] leading-tight">
            Relatório executivo da carteira de transferências voluntárias
          </h2>
          <p className="mt-2 text-[12px] text-muted">
            {orgao.unidadeGestora} · posição de {data(hoje.toISOString())}
          </p>
        </header>

        <Secao titulo="1. Panorama">
          <p>
            A carteira reúne <Forte>{numero(resumo.totalPropostas)} propostas</Forte>, com valor
            global de <Forte>{moeda(resumo.valorGlobal)}</Forte>, dos quais{' '}
            <Forte>{moeda(resumo.valorRepasse)}</Forte> correspondem a repasse da União e{' '}
            <Forte>{moeda(resumo.valorContrapartida)}</Forte> a contrapartida dos proponentes.
            Há <Forte>{numero(resumo.processosSei)} processos autuados</Forte> no SEI e{' '}
            <Forte>{numero(resumo.qtdEmpenhos)} notas de empenho</Forte> registradas, somando{' '}
            <Forte>{moeda(resumo.totalEmpenhado)}</Forte>.
          </p>
          <p>
            A aderência ao prazo das fases é de{' '}
            <Forte>{(aderencia * 100).toFixed(0)}%</Forte>, com{' '}
            <Forte>{numero(foraDoPrazo)} propostas</Forte> além do prazo previsto para a fase em
            que se encontram.
          </p>
        </Secao>

        <Secao titulo="2. Execução orçamentária">
          <p>
            Da dotação autorizada de <Forte>{moeda(funil.dotacao)}</Forte>, foram empenhados{' '}
            <Forte>{moeda(funil.empenhado)}</Forte>, liquidados{' '}
            <Forte>{moeda(funil.liquidado)}</Forte> e pagos{' '}
            <Forte>{moeda(funil.pago)}</Forte> — execução de{' '}
            <Forte>{(funil.execucao * 100).toFixed(1)}%</Forte>.
          </p>
          <p>
            Restam <Forte>{fim.diasUteis} dias úteis</Forte> até o encerramento do exercício e{' '}
            <Forte>{moeda(fim.saldoAEmpenhar)}</Forte> a empenhar, o que exige ritmo de{' '}
            <Forte>{moedaCompacta(fim.ritmoNecessario)} por dia útil</Forte>.{' '}
            {fim.emRisco
              ? 'O ritmo praticado no exercício está abaixo do necessário; sem aceleração, parte da dotação não será empenhada.'
              : 'O ritmo praticado no exercício é compatível com o saldo remanescente.'}
          </p>
          <p>
            O montante empenhado e não liquidado soma{' '}
            <Forte>{moeda(restos.total)}</Forte>, dos quais{' '}
            <Forte>{moeda(restos.faixas[2].valor)}</Forte> têm mais de 180 dias — candidatos
            diretos a restos a pagar não processados.
          </p>
        </Secao>

        <Secao titulo="3. Emendas parlamentares">
          <p>
            <Forte>{numero(emendas.totalEmendas)} emendas</Forte> de{' '}
            <Forte>{numero(emendas.parlamentares)} parlamentares</Forte> apontam para o órgão,
            totalizando <Forte>{moeda(emendas.valorIndicado)}</Forte> indicados, com{' '}
            <Forte>{(emendas.execucao * 100).toFixed(0)}%</Forte> já convertidos em empenho.
            Outras <Forte>{numero(emendas.semEmenda.qtd)} propostas</Forte>, no valor de{' '}
            <Forte>{moeda(emendas.semEmenda.valor)}</Forte>, decorrem de dotação própria dos
            programas.
          </p>
          {gabinetes.length > 0 && (
            <p>
              As carteiras com maior demanda de resposta são as de{' '}
              {gabinetes.map((g, i) => (
                <span key={g.parlamentar.id}>
                  <Forte>{g.parlamentar.nome}</Forte> ({g.parlamentar.partido}/{g.parlamentar.uf},{' '}
                  {g.paradas} {g.paradas === 1 ? 'proposta' : 'propostas'} sem andamento)
                  {i < gabinetes.length - 1 ? '; ' : '.'}
                </span>
              ))}
            </p>
          )}
        </Secao>

        <Secao titulo="4. Prazos e encerramento">
          <p>
            <Forte>{numero(vencendo30)} convênios</Forte> têm vigência encerrando nos próximos 30
            dias e demandam decisão sobre prorrogação antes da data.
          </p>
          <p>
            Na prestação de contas, <Forte>{numero(contas.atrasadas)}</Forte> convênios estão com
            prazo legal vencido sem apresentação e{' '}
            <Forte>{numero(contas.emAnalise)}</Forte> aguardam análise da casa. A inadimplência
            impede <Forte>{numero(contas.proponentesBloqueados)} proponentes</Forte> de receber
            nova transferência, o que trava <Forte>{moeda(contas.valorBloqueado)}</Forte> em
            propostas vinculadas.
          </p>
        </Secao>

        <Secao titulo="5. Capacidade de análise">
          <p>
            A equipe é composta por <Forte>{equipe.pessoas} analistas</Forte>, com capacidade
            declarada de <Forte>{numero(equipe.capacidadeTotal)} propostas</Forte> e ocupação média
            de <Forte>{(equipe.ocupacaoMedia * 100).toFixed(0)}%</Forte>. A distância entre a maior
            e a menor ocupação é de{' '}
            <Forte>{(equipe.desequilibrio * 100).toFixed(0)} pontos percentuais</Forte>
            {equipe.desequilibrio > 0.5
              ? ', o que recomenda redistribuição de carteira.'
              : ', dentro de faixa aceitável.'}
          </p>
        </Secao>

        <Secao titulo="6. Pontos de atenção">
          <ol className="ml-4 flex list-decimal flex-col gap-1.5">
            {fila.map((item) => (
              <li key={item.proposta.id}>
                <span className="num">{item.proposta.numero}</span> —{' '}
                {getProponente(item.proposta.proponenteId)?.nome}: {item.motivo.toLowerCase()},{' '}
                {moedaCompacta(item.proposta.valorGlobal)}.
              </li>
            ))}
          </ol>
          {padroes.length > 0 && (
            <p className="mt-3">
              A leitura do conjunto identificou <Forte>{padroes.length} padrões</Forte> que pedem
              conferência, entre eles {padroes[0].titulo.toLowerCase()} (
              {padroes[0].propostas.length} propostas).
            </p>
          )}
        </Secao>

        <Secao titulo="7. Ganho de automação">
          <p>
            Foram executadas <Forte>{numero(resumo.automacoesExecutadas)} automações</Forte> sobre
            a carteira, com <Forte>{numero(resumo.documentosGerados)} documentos</Forte> produzidos
            a partir de minuta. Pelo tempo médio medido com os analistas, isso corresponde a{' '}
            <Forte>{numero(resumo.horasEconomizadas)} horas</Forte> de trabalho manual
            redirecionadas para análise.
          </p>
        </Secao>

        <footer className="mt-7 border-t border-line pt-4 text-[10.5px] leading-relaxed text-faint">
          Documento gerado pela Cleopatra a partir dos dados sincronizados do TransfereGov e do
          SEI. Os valores refletem a posição da carteira na data indicada. Esta é uma plataforma de
          apresentação: nenhuma automação foi executada nos sistemas oficiais para produzir este
          relatório.
        </footer>
      </Panel>
    </div>
  )
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="mb-2.5 text-[14px]">{titulo}</h3>
      <div className="flex flex-col gap-2.5 text-[12.5px] leading-relaxed text-muted">
        {children}
      </div>
    </section>
  )
}

function Forte({ children }: { children: React.ReactNode }) {
  return <span className="font-medium text-ink">{children}</span>
}
