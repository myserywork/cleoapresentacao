import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Fingerprint, Search } from 'lucide-react'
import { useApp } from '@/store/app'
import { getOrgao, getProponente } from '@/data/repo'
import { detectarAnomalias, type Anomalia } from '@/dominio/anomalias'
import { TOM_SEVERIDADE } from '@/dominio/riscos'
import { cn, moedaCompacta, numero } from '@/lib/format'
import { Badge, Botao, Panel, PanelHeader, SituacaoBadge } from '@/components/ui'
import { Numero } from '@/components/dados'

const ROTULO_TIPO: Record<Anomalia['tipo'], string> = {
  'propostas-irmas': 'Propostas irmãs',
  'valor-repetido': 'Valor repetido',
  'contrapartida-no-limite': 'Contrapartida no limite',
  concentracao: 'Concentração',
  fracionamento: 'Fracionamento',
}

/**
 * Padrões da carteira.
 *
 * Alerta de conformidade olha uma proposta por vez; aqui a leitura é do
 * conjunto. Nada nesta tela acusa: cada achado é um padrão a conferir, com a
 * regra que o encontrou e as propostas que o formaram à mão.
 */
export function Padroes() {
  const { orgaoId, alternarComparacao, comparacao } = useApp()
  const navegar = useNavigate()
  const orgao = getOrgao(orgaoId)!
  const [aberto, setAberto] = useState<string | null>(null)
  const [tipo, setTipo] = useState<Anomalia['tipo'] | 'todos'>('todos')

  const achados = useMemo(() => detectarAnomalias(orgaoId), [orgaoId])
  const filtrados = useMemo(
    () => (tipo === 'todos' ? achados : achados.filter((a) => a.tipo === tipo)),
    [achados, tipo],
  )

  const criticos = achados.filter((a) => a.severidade === 'critico').length
  const atencao = achados.filter((a) => a.severidade === 'atencao').length
  const propostasEnvolvidas = new Set(achados.flatMap((a) => a.propostas.map((p) => p.id))).size
  const valorEnvolvido = achados.reduce((s, a) => s + a.valor, 0)

  const tipos = [...new Set(achados.map((a) => a.tipo))]

  return (
    <div className="mx-auto flex max-w-[1300px] flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="eyebrow mb-2">Leitura do conjunto</div>
          <h1 className="text-[26px] leading-tight">Padrões da carteira</h1>
          <p className="mt-1.5 max-w-[76ch] text-[13px] text-muted">
            O que se repete, o que se concentra e o que encosta exatamente no limite na carteira do{' '}
            {orgao.sigla}. São pontos de conferência, não acusações — cada um mostra a regra que o
            encontrou.
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setTipo('todos')}
            className={cn(
              'rounded-md px-2.5 py-1.5 text-[11.5px]',
              tipo === 'todos' ? 'bg-gold/15 text-gold' : 'text-muted hover:text-ink',
            )}
          >
            Todos
          </button>
          {tipos.map((t) => (
            <button
              key={t}
              onClick={() => setTipo(t)}
              className={cn(
                'rounded-md px-2.5 py-1.5 text-[11.5px]',
                tipo === t ? 'bg-gold/15 text-gold' : 'text-muted hover:text-ink',
              )}
            >
              {ROTULO_TIPO[t]}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-4 gap-4">
        <Panel className="px-5 py-4">
          <Numero rotulo="Padrões encontrados" valor={numero(achados.length)} tom="cleo" />
        </Panel>
        <Panel className="px-5 py-4">
          <Numero
            rotulo="Pedem conferência"
            valor={numero(criticos + atencao)}
            tom="gold"
            detalhe={`os outros ${achados.length - criticos - atencao} são informativos`}
          />
        </Panel>
        <Panel className="px-5 py-4">
          <Numero
            rotulo="Propostas envolvidas"
            valor={numero(propostasEnvolvidas)}
            detalhe="Sem repetição entre padrões"
          />
        </Panel>
        <Panel className="px-5 py-4">
          <Numero rotulo="Valor sob o recorte" valor={moedaCompacta(valorEnvolvido)} tom="gold" />
        </Panel>
      </div>

      <div className="flex flex-col gap-4">
        {filtrados.map((achado) => {
          const expandido = aberto === achado.id
          return (
            <Panel key={achado.id} className="overflow-hidden">
              <div
                className="flex cursor-pointer items-start gap-4 px-5 py-4 transition-colors hover:bg-white/[0.02]"
                onClick={() => setAberto(expandido ? null : achado.id)}
              >
                <Fingerprint
                  size={16}
                  className={cn(
                    'mt-0.5 shrink-0',
                    achado.severidade === 'critico'
                      ? 'text-alert'
                      : achado.severidade === 'atencao'
                        ? 'text-gold'
                        : 'text-inert',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <h3 className="text-[14.5px]">{achado.titulo}</h3>
                    <Badge tom={TOM_SEVERIDADE[achado.severidade]}>{ROTULO_TIPO[achado.tipo]}</Badge>
                    <span className="num text-[11.5px] text-faint">
                      {achado.propostas.length} propostas · {moedaCompacta(achado.valor)}
                    </span>
                  </div>
                  <p className="text-[12.5px] leading-relaxed text-muted">{achado.descricao}</p>
                </div>
                <Botao tamanho="sm" variante="fantasma">
                  {expandido ? 'Fechar' : 'Examinar'}
                </Botao>
              </div>

              {expandido && (
                <>
                  <div className="border-y border-line bg-abyss/30 px-5 py-3.5">
                    <div className="eyebrow mb-1.5 flex items-center gap-1.5">
                      <Search size={10} /> O que verificar
                    </div>
                    <p className="max-w-[92ch] text-[12.5px] leading-relaxed text-muted">
                      {achado.oQueVerificar}
                    </p>
                  </div>

                  <ul className="divide-y divide-line-soft">
                    {achado.propostas.map((p) => {
                      const proponente = getProponente(p.proponenteId)
                      return (
                        <li key={p.id} className="flex items-center gap-4 px-5 py-2.5">
                          <button
                            onClick={() => navegar(`/propostas/${p.id}`)}
                            className="num shrink-0 text-[12px] text-ink hover:text-gold"
                          >
                            {p.numero}
                          </button>
                          <span className="w-[220px] shrink-0 truncate text-[12px] text-muted">
                            {proponente?.nome}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[11.5px] text-faint">
                            {p.objeto}
                          </span>
                          <SituacaoBadge situacao={p.situacao} />
                          <span className="num w-[86px] shrink-0 text-right text-[12px] text-gold">
                            {moedaCompacta(p.valorGlobal)}
                          </span>
                          <button
                            onClick={() => alternarComparacao(p.id)}
                            className={cn(
                              'shrink-0 rounded border px-2 py-1 text-[10.5px] transition-colors',
                              comparacao.includes(p.id)
                                ? 'border-gold/40 bg-gold/10 text-gold'
                                : 'border-line text-faint hover:text-ink',
                            )}
                          >
                            comparar
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
            </Panel>
          )
        })}

        {filtrados.length === 0 && (
          <Panel>
            <PanelHeader eyebrow="Nada aqui" titulo="Nenhum padrão deste tipo na carteira" />
            <p className="px-5 py-8 text-center text-[13px] text-muted">
              Troque o recorte acima ou o órgão na barra lateral.
            </p>
          </Panel>
        )}
      </div>
    </div>
  )
}
