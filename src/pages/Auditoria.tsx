import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileSearch, ShieldCheck } from 'lucide-react'
import { useApp } from '@/store/app'
import { auditoriaDoOrgao, getOrgao } from '@/data/repo'
import { dataHora, numero } from '@/lib/format'
import { Badge, Campo, Panel, type Tom } from '@/components/ui'
import { BotaoExportar, Numero, Segmentado, Tabela, type Coluna } from '@/components/dados'
import type { EventoAuditoria, TipoEventoAuditoria } from '@/data/types'

const TOM_TIPO: Record<TipoEventoAuditoria, Tom> = {
  automacao: 'cleo',
  decisao: 'gold',
  documento: 'teal',
  regra: 'cleo',
  acesso: 'inert',
  comentario: 'inert',
  diligencia: 'alert',
}

const ROTULO_TIPO: Record<TipoEventoAuditoria, string> = {
  automacao: 'Automação',
  decisao: 'Decisão',
  documento: 'Documento',
  regra: 'Regra',
  acesso: 'Acesso',
  comentario: 'Comentário',
  diligencia: 'Diligência',
}

type Periodo = 'tudo' | '7' | '30' | '90'

/**
 * Trilha de auditoria.
 *
 * A pergunta que um órgão de controle faz é sempre a mesma: quem fez, quando,
 * em quê e com qual justificativa. Um sistema que automatiza precisa responder
 * isso melhor que o processo manual que ele substituiu — não pior.
 */
export function Auditoria() {
  const { orgaoId, auditoriaDaSessao } = useApp()
  const navegar = useNavigate()
  const orgao = getOrgao(orgaoId)!

  const [termo, setTermo] = useState('')
  const [tipo, setTipo] = useState<TipoEventoAuditoria | 'todos'>('todos')
  const [periodo, setPeriodo] = useState<Periodo>('30')

  const eventos = useMemo(
    () => [...auditoriaDaSessao, ...auditoriaDoOrgao(orgaoId)],
    [auditoriaDaSessao, orgaoId],
  )

  const filtrados = useMemo(() => {
    const t = termo.trim().toLowerCase()
    const corte =
      periodo === 'tudo' ? 0 : Date.now() - Number(periodo) * 86_400_000
    return eventos.filter((e) => {
      if (tipo !== 'todos' && e.tipo !== tipo) return false
      if (corte && new Date(e.data).getTime() < corte) return false
      if (!t) return true
      return (
        e.ator.toLowerCase().includes(t) ||
        e.acao.toLowerCase().includes(t) ||
        e.alvo.toLowerCase().includes(t) ||
        e.detalhe.toLowerCase().includes(t)
      )
    })
  }, [eventos, termo, tipo, periodo])

  const porTipo = useMemo(() => {
    const mapa = new Map<TipoEventoAuditoria, number>()
    for (const e of filtrados) mapa.set(e.tipo, (mapa.get(e.tipo) ?? 0) + 1)
    return mapa
  }, [filtrados])

  const atores = useMemo(() => new Set(filtrados.map((e) => e.ator)).size, [filtrados])
  const pelaCleo = filtrados.filter((e) => e.ator === 'Cleo' || e.tipo === 'automacao').length

  const colunas: Coluna<EventoAuditoria>[] = [
    {
      id: 'data',
      cabecalho: 'Quando',
      largura: '150px',
      valor: (e) => e.data,
      celula: (e) => <span className="num text-[11.5px] text-muted">{dataHora(e.data)}</span>,
    },
    {
      id: 'tipo',
      cabecalho: 'Tipo',
      largura: '120px',
      valor: (e) => ROTULO_TIPO[e.tipo],
      celula: (e) => <Badge tom={TOM_TIPO[e.tipo]}>{ROTULO_TIPO[e.tipo]}</Badge>,
    },
    {
      id: 'ator',
      cabecalho: 'Quem',
      largura: '190px',
      valor: (e) => e.ator,
      celula: (e) => (
        <span className={e.ator === 'Cleo' ? 'text-[12.5px] text-cleo' : 'text-[12.5px] text-ink'}>
          {e.ator}
        </span>
      ),
    },
    {
      id: 'acao',
      cabecalho: 'O quê',
      valor: (e) => e.acao,
      celula: (e) => <span className="text-[12.5px] text-ink">{e.acao}</span>,
    },
    {
      id: 'alvo',
      cabecalho: 'Em quê',
      largura: '170px',
      valor: (e) => e.alvo,
      celula: (e) => <span className="num text-[12px] text-muted">{e.alvo}</span>,
    },
    {
      id: 'detalhe',
      cabecalho: 'Detalhe',
      valor: (e) => e.detalhe,
      celula: (e) => (
        <span className="line-clamp-1 max-w-[340px] text-[11.5px] text-faint">{e.detalhe}</span>
      ),
    },
  ]

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="eyebrow mb-2">Controle</div>
          <h1 className="text-[26px] leading-tight">Trilha de auditoria</h1>
          <p className="mt-1.5 max-w-[74ch] text-[13px] text-muted">
            Todo evento do {orgao.sigla} — execução, documento, diligência, regra e acesso — em um
            registro só, filtrável e exportável.
          </p>
        </div>
        <BotaoExportar nome={`auditoria-${orgao.sigla}`} itens={filtrados} colunas={colunas} />
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Panel className="px-5 py-4">
          <Numero
            rotulo="Eventos no recorte"
            valor={numero(filtrados.length)}
            detalhe={`de ${numero(eventos.length)} no total`}
          />
        </Panel>
        <Panel className="px-5 py-4">
          <Numero rotulo="Pessoas e sistemas" valor={numero(atores)} tom="teal" detalhe="Atores distintos no período" />
        </Panel>
        <Panel className="px-5 py-4">
          <Numero
            rotulo="Feito pela Cleo"
            valor={`${((pelaCleo / Math.max(filtrados.length, 1)) * 100).toFixed(0)}%`}
            tom="cleo"
            detalhe={`${numero(pelaCleo)} eventos de automação`}
          />
        </Panel>
        <Panel className="px-5 py-4">
          <Numero
            rotulo="Nesta sessão"
            valor={numero(auditoriaDaSessao.length)}
            tom="gold"
            detalhe="Eventos gerados durante a demonstração"
          />
        </Panel>
      </div>

      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3.5">
          <div className="relative min-w-[280px] flex-1">
            <FileSearch size={13} className="absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
            <Campo
              placeholder="Buscar por pessoa, ação, processo ou detalhe"
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              className="pl-8"
            />
          </div>

          <Segmentado
            valor={periodo}
            aoTrocar={setPeriodo}
            opcoes={[
              { id: '7', rotulo: '7 dias' },
              { id: '30', rotulo: '30 dias' },
              { id: '90', rotulo: '90 dias' },
              { id: 'tudo', rotulo: 'Tudo' },
            ]}
          />

          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setTipo('todos')}
              className={`rounded-md px-2.5 py-1 text-[11.5px] ${tipo === 'todos' ? 'bg-gold/15 text-gold' : 'text-muted hover:text-ink'}`}
            >
              Todos
            </button>
            {(Object.keys(ROTULO_TIPO) as TipoEventoAuditoria[])
              .filter((t) => (porTipo.get(t) ?? 0) > 0 || tipo === t)
              .map((t) => (
                <button
                  key={t}
                  onClick={() => setTipo(t)}
                  className={`rounded-md px-2.5 py-1 text-[11.5px] ${tipo === t ? 'bg-gold/15 text-gold' : 'text-muted hover:text-ink'}`}
                >
                  {ROTULO_TIPO[t]}
                  <span className="num ml-1.5 text-faint">{porTipo.get(t) ?? 0}</span>
                </button>
              ))}
          </div>
        </div>

        <Tabela
          compacta
          itens={filtrados.slice(0, 300)}
          colunas={colunas}
          chave={(e) => e.id}
          aoClicar={(e) => e.propostaId && navegar(`/propostas/${e.propostaId}`)}
          vazio="Nenhum evento com esses filtros."
        />

        {filtrados.length > 300 && (
          <div className="border-t border-line px-5 py-3 text-center text-[11.5px] text-faint">
            Mostrando os 300 eventos mais recentes de {numero(filtrados.length)}. A exportação leva
            todos.
          </div>
        )}
      </Panel>

      <Panel className="flex items-start gap-4 px-5 py-4">
        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-teal" />
        <p className="text-[12.5px] leading-relaxed text-muted">
          Cada execução automática registra o rito, o processo, a duração e o resultado. Cada
          decisão registra quem decidiu e a justificativa. É o que permite responder a um pedido de
          informação sem reconstituir histórico à mão — e o que separa automação auditável de
          automação opaca.
        </p>
      </Panel>
    </div>
  )
}
