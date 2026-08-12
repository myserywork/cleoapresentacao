import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRightLeft, Check, Scale, Users } from 'lucide-react'
import { useApp } from '@/store/app'
import { getOrgao, getProponente } from '@/data/repo'
import { cargaDaEquipe, resumoEquipe, sugerirRedistribuicao, type CargaAnalista } from '@/dominio/equipe'
import { prioridade } from '@/dominio/riscos'
import { cn, moedaCompacta, numero } from '@/lib/format'
import { Badge, Botao, Panel, PanelHeader, SituacaoBadge, type Tom } from '@/components/ui'
import { Avatar, BotaoExportar, Medidor, Numero, Tabela, type Coluna } from '@/components/dados'

const TOM_FAIXA: Record<CargaAnalista['faixa'], Tom> = {
  ociosa: 'inert',
  saudavel: 'teal',
  cheia: 'gold',
  sobrecarregada: 'alert',
}

const ROTULO_FAIXA: Record<CargaAnalista['faixa'], string> = {
  ociosa: 'Com folga',
  saudavel: 'Saudável',
  cheia: 'No limite',
  sobrecarregada: 'Sobrecarregado',
}

/**
 * Carteira da equipe.
 *
 * Carga não é contagem de processo: vinte propostas em dia dão menos trabalho
 * que cinco travadas. Por isso a tela mostra ocupação e peso lado a lado — e
 * sugere o movimento que equilibra as duas pontas.
 */
export function Equipe() {
  const { orgaoId } = useApp()
  const navegar = useNavigate()
  const orgao = getOrgao(orgaoId)!
  const [aberto, setAberto] = useState<string | null>(null)
  const [aplicadas, setAplicadas] = useState<number[]>([])

  const carga = useMemo(() => cargaDaEquipe(orgaoId), [orgaoId])
  const resumo = useMemo(() => resumoEquipe(orgaoId), [orgaoId])
  const sugestoes = useMemo(() => sugerirRedistribuicao(orgaoId), [orgaoId])

  const pesoMaximo = Math.max(...carga.map((c) => c.peso), 1)

  const colunas: Coluna<CargaAnalista>[] = [
    {
      id: 'nome',
      cabecalho: 'Analista',
      valor: (c) => c.analista.nome,
      celula: (c) => (
        <div className="flex items-center gap-2.5">
          <Avatar iniciais={c.analista.iniciais} tom={TOM_FAIXA[c.faixa]} />
          <div className="min-w-0">
            <div className="truncate text-[12.5px] text-ink">{c.analista.nome}</div>
            <div className="text-[11px] text-faint">{c.analista.cargo}</div>
          </div>
        </div>
      ),
    },
    {
      id: 'qtd',
      cabecalho: 'Propostas',
      alinhamento: 'direita',
      valor: (c) => c.qtd,
      celula: (c) => (
        <span className="num text-[12.5px] text-ink">
          {c.qtd}
          <span className="ml-1 text-faint">/{c.analista.capacidade}</span>
        </span>
      ),
    },
    {
      id: 'ocupacao',
      cabecalho: 'Ocupação',
      largura: '190px',
      valor: (c) => c.ocupacao,
      celula: (c) => (
        <div className="flex items-center gap-2.5">
          <Medidor valor={Math.min(c.ocupacao, 1)} tom={TOM_FAIXA[c.faixa]} />
          <span className="num w-10 shrink-0 text-right text-[11.5px] text-muted">
            {(c.ocupacao * 100).toFixed(0)}%
          </span>
        </div>
      ),
    },
    {
      id: 'peso',
      cabecalho: 'Peso da carteira',
      largura: '150px',
      valor: (c) => c.peso,
      celula: (c) => (
        <div className="flex items-center gap-2.5">
          <Medidor valor={c.peso / pesoMaximo} tom="cleo" />
          <span className="num w-10 shrink-0 text-right text-[11.5px] text-faint">{c.peso}</span>
        </div>
      ),
    },
    {
      id: 'risco',
      cabecalho: 'Em risco',
      alinhamento: 'direita',
      valor: (c) => c.emRisco,
      celula: (c) =>
        c.emRisco > 0 ? <Badge tom="alert">{c.emRisco}</Badge> : <span className="num text-faint">—</span>,
    },
    {
      id: 'valor',
      cabecalho: 'Valor sob gestão',
      alinhamento: 'direita',
      valor: (c) => c.valor,
      celula: (c) => <span className="num text-gold">{moedaCompacta(c.valor)}</span>,
    },
    {
      id: 'faixa',
      cabecalho: 'Situação',
      valor: (c) => ROTULO_FAIXA[c.faixa],
      celula: (c) => (
        <Badge tom={TOM_FAIXA[c.faixa]} ponto>
          {ROTULO_FAIXA[c.faixa]}
        </Badge>
      ),
    },
  ]

  const detalhe = carga.find((c) => c.analista.id === aberto)

  return (
    <div className="mx-auto flex max-w-[1360px] flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="eyebrow mb-2">Coordenação</div>
          <h1 className="text-[26px] leading-tight">Equipe</h1>
          <p className="mt-1.5 max-w-[74ch] text-[13px] text-muted">
            {resumo.pessoas} analistas do {orgao.sigla} respondem por{' '}
            {numero(resumo.atribuidas)} propostas. A média esconde desequilíbrio — por isso a tela
            mostra a distância entre a ponta mais cheia e a mais folgada.
          </p>
        </div>
        <BotaoExportar nome={`equipe-${orgao.sigla}`} itens={carga} colunas={colunas} />
      </header>

      <div className="grid grid-cols-4 gap-4">
        <Panel className="px-5 py-4">
          <Numero
            rotulo="Ocupação média"
            valor={`${(resumo.ocupacaoMedia * 100).toFixed(0)}%`}
            tom={resumo.ocupacaoMedia > 1 ? 'alert' : resumo.ocupacaoMedia > 0.85 ? 'gold' : 'teal'}
            detalhe={`${numero(resumo.atribuidas)} propostas para capacidade de ${numero(resumo.capacidadeTotal)}`}
          />
        </Panel>
        <Panel className={cn('px-5 py-4', resumo.desequilibrio > 0.5 && 'border-gold/30 bg-gold/[0.04]')}>
          <Numero
            rotulo="Desequilíbrio"
            valor={`${(resumo.desequilibrio * 100).toFixed(0)} p.p.`}
            tom={resumo.desequilibrio > 0.5 ? 'alert' : 'gold'}
            detalhe="Distância entre a maior e a menor ocupação"
          />
        </Panel>
        <Panel className="px-5 py-4">
          <Numero
            rotulo="Sobrecarregados"
            valor={numero(carga.filter((c) => c.faixa === 'sobrecarregada').length)}
            tom="alert"
            detalhe="Acima de 115% da capacidade declarada"
          />
        </Panel>
        <Panel className="px-5 py-4">
          <Numero
            rotulo="Propostas em risco"
            valor={numero(carga.reduce((s, c) => s + c.emRisco, 0))}
            tom="gold"
            detalhe="Com pelo menos um alerta crítico aberto"
          />
        </Panel>
      </div>

      {sugestoes.length > 0 && (
        <Panel className="overflow-hidden border-cleo/25">
          <PanelHeader
            eyebrow="Sugestão da Cleo"
            titulo="Movimentos que equilibram a carga"
            acao={<Scale size={15} className="text-cleo" />}
          />
          <ul className="divide-y divide-line-soft">
            {sugestoes.map((s, i) => (
              <li key={`${s.de.id}-${s.para.id}-${i}`} className="flex items-center gap-4 px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <Avatar iniciais={s.de.iniciais} tom="alert" />
                  <ArrowRightLeft size={13} className="text-faint" />
                  <Avatar iniciais={s.para.iniciais} tom="teal" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] text-ink">
                    Mover {s.propostas.length} proposta(s) de{' '}
                    <span className="text-alert">{s.de.nome}</span> para{' '}
                    <span className="text-teal">{s.para.nome}</span>
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-muted">{s.motivo}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {s.propostas.slice(0, 3).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => navegar(`/propostas/${p.id}`)}
                      className="num rounded border border-line bg-raised px-2 py-1 text-[10.5px] text-muted hover:text-ink"
                    >
                      {p.numero}
                    </button>
                  ))}
                  {s.propostas.length > 3 && (
                    <span className="num text-[11px] text-faint">+{s.propostas.length - 3}</span>
                  )}
                </div>
                <Botao
                  tamanho="sm"
                  variante={aplicadas.includes(i) ? 'fantasma' : 'secundario'}
                  disabled={aplicadas.includes(i)}
                  onClick={() => setAplicadas((a) => [...a, i])}
                >
                  {aplicadas.includes(i) ? (
                    <>
                      <Check size={11} /> Aplicado
                    </>
                  ) : (
                    'Aplicar'
                  )}
                </Botao>
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-5 py-3 text-[11px] text-faint">
            A redistribuição vale para esta sessão de demonstração — a atribuição real de carteira
            continua na coordenação.
          </p>
        </Panel>
      )}

      <Panel className="overflow-hidden">
        <PanelHeader
          eyebrow="Carga"
          titulo="Quem responde pelo quê"
          acao={<Users size={15} className="text-faint" />}
        />
        <Tabela
          itens={carga}
          colunas={colunas}
          chave={(c) => c.analista.id}
          aoClicar={(c) => setAberto(aberto === c.analista.id ? null : c.analista.id)}
          ordemInicial={{ coluna: 'ocupacao', direcao: 'desc' }}
          destaque={(c) => c.faixa === 'sobrecarregada'}
        />
      </Panel>

      {detalhe && (
        <Panel className="overflow-hidden">
          <PanelHeader
            eyebrow={`Carteira de ${detalhe.analista.nome}`}
            titulo={`${detalhe.qtd} propostas, ${moedaCompacta(detalhe.valor)} sob gestão`}
            acao={
              <Botao tamanho="sm" variante="fantasma" onClick={() => setAberto(null)}>
                Fechar
              </Botao>
            }
          />
          <ul className="max-h-[420px] divide-y divide-line-soft overflow-y-auto">
            {[...detalhe.propostas]
              .sort((a, b) => prioridade(b) - prioridade(a))
              .map((p) => (
                <li
                  key={p.id}
                  onClick={() => navegar(`/propostas/${p.id}`)}
                  className="flex cursor-pointer items-center gap-4 px-5 py-3 hover:bg-white/[0.03]"
                >
                  <span className="num w-10 shrink-0 text-[11.5px] text-cleo">
                    {prioridade(p)}
                  </span>
                  <span className="num shrink-0 text-[12.5px] text-ink">{p.numero}</span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-muted">
                    {getProponente(p.proponenteId)?.nome}
                  </span>
                  <SituacaoBadge situacao={p.situacao} />
                  <span className="num w-20 shrink-0 text-right text-[12px] text-gold">
                    {moedaCompacta(p.valorGlobal)}
                  </span>
                </li>
              ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}
