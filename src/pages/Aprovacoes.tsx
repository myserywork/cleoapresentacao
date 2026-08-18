import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  CircleDashed,
  Keyboard,
  ShieldCheck,
  Sparkles,
  Undo2,
  X,
  Zap,
} from 'lucide-react'
import { useApp } from '@/store/app'
import { aprovacoesDoOrgao, automacoesDaProposta, getProponente, getProposta } from '@/data/repo'
import type { Aprovacao, TipoAprovacao } from '@/data/types'
import { avaliar } from '@/dominio/saude'
import { recomendar, type Decisao } from '@/dominio/recomendacao'
import { cn, data, desde, moeda, moedaCompacta, numero } from '@/lib/format'
import { Badge, Botao, Panel, SituacaoBadge, Vazio, type Tom } from '@/components/ui'
import { Medidor } from '@/components/dados'
import { Autorizado } from '@/components/Autorizacao'

const ROTULO_TIPO: Record<TipoAprovacao, string> = {
  aprovar_proposta: 'Aprovar proposta',
  corrigir_repasse: 'Corrigir valor de repasse',
  alterar_situacao: 'Alterar situação',
  liberar_documento: 'Liberar documento',
}

const TOM_TIPO: Record<TipoAprovacao, 'teal' | 'gold' | 'cleo' | 'inert'> = {
  aprovar_proposta: 'teal',
  corrigir_repasse: 'gold',
  alterar_situacao: 'inert',
  liberar_documento: 'cleo',
}

/** Acima deste valor a decisão deixa de ser rotina e vira ato de peso. */
const LIMITE_BAIXO_IMPACTO = 3_000_000
const SAUDE_MINIMA_LOTE = 70

export function Aprovacoes() {
  const { orgaoId, aprovacoes, decidir, reverter } = useApp()
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState<{
    decisao: 'aprovada' | 'recusada'
    ids: string[]
    rotulo: string
  } | null>(null)
  const [desfazer, setDesfazer] = useState<{ ids: string[]; rotulo: string } | null>(null)
  const [mostrarAtalhos, setMostrarAtalhos] = useState(false)

  const doOrgao = useMemo(() => new Set(aprovacoesDoOrgao(orgaoId).map((a) => a.id)), [orgaoId])
  const pendentes = useMemo(
    () => aprovacoes.filter((a) => doOrgao.has(a.id) && a.decidida === 'pendente'),
    [aprovacoes, doOrgao],
  )
  const decididas = useMemo(
    () => aprovacoes.filter((a) => doOrgao.has(a.id) && a.decidida !== 'pendente'),
    [aprovacoes, doOrgao],
  )

  // Mantém sempre um item em foco: cabine sem seleção é painel vazio.
  useEffect(() => {
    if (pendentes.length === 0) {
      setSelecionado(null)
      return
    }
    if (!selecionado || !pendentes.some((a) => a.id === selecionado)) {
      setSelecionado(pendentes[0].id)
    }
  }, [pendentes, selecionado])

  const indice = pendentes.findIndex((a) => a.id === selecionado)
  const atual = indice >= 0 ? pendentes[indice] : null

  const aplicar = useCallback(
    (ids: string[], decisao: 'aprovada' | 'recusada', rotulo: string) => {
      decidir(ids, decisao)
      setDesfazer({ ids, rotulo })
      window.setTimeout(() => setDesfazer(null), 7000)
    },
    [decidir],
  )

  const baixoImpacto = useMemo(
    () =>
      pendentes.filter((a) => {
        const p = getProposta(a.propostaId)
        if (!p) return false
        if (p.valorGlobal > LIMITE_BAIXO_IMPACTO) return false
        const feitos = new Set(
          automacoesDaProposta(p.id)
            .filter((x) => x.status === 'SUCESSO')
            .map((x) => x.gatilho),
        )
        return avaliar(p, feitos).pontos >= SAUDE_MINIMA_LOTE
      }),
    [pendentes],
  )

  /* Teclado: a cabine é para decidir rápido, não para caçar botão com o mouse. */
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement
      if (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || confirmando) return

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault()
        setSelecionado(pendentes[Math.min(indice + 1, pendentes.length - 1)]?.id ?? null)
      }
      if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault()
        setSelecionado(pendentes[Math.max(indice - 1, 0)]?.id ?? null)
      }
      if (e.key === 'a' && atual) aplicar([atual.id], 'aprovada', ROTULO_TIPO[atual.tipo])
      if (e.key === 'r' && atual) aplicar([atual.id], 'recusada', ROTULO_TIPO[atual.tipo])
      if (e.key === '?') setMostrarAtalhos((v) => !v)
      if (e.key === 'u' && desfazer) {
        reverter(desfazer.ids)
        setDesfazer(null)
      }
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [pendentes, indice, atual, aplicar, confirmando, desfazer, reverter])

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-96px)] max-w-[1320px] flex-col gap-4 md:h-[calc(100dvh-56px)] md:min-h-0">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <div className="eyebrow mb-2">Decisão do gestor</div>
          <h1 className="text-[26px] leading-tight">Aprovações</h1>
          <p className="mt-1.5 text-[13px] text-muted">
            Nada é executado sem o seu aval. Use <kbd className="num text-gold">J</kbd> e{' '}
            <kbd className="num text-gold">K</kbd> para percorrer,{' '}
            <kbd className="num text-gold">A</kbd> para aprovar,{' '}
            <kbd className="num text-gold">R</kbd> para recusar.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setMostrarAtalhos((v) => !v)}
            className="flex items-center gap-1.5 text-[12px] text-muted hover:text-ink"
          >
            <Keyboard size={14} /> Atalhos
          </button>
          <div className="flex items-center gap-2 text-[13px]">
            <ShieldCheck size={16} className="text-gold" />
            <span className="num text-ink">{pendentes.length}</span>
            <span className="text-muted">aguardando você</span>
          </div>
        </div>
      </header>

      {/* Lote inteligente: o critério fica escrito, não escondido atrás do botão */}
      {baixoImpacto.length > 1 && (
        <Panel className="flex items-center gap-4 border-teal/25 bg-teal/[0.04] px-5 py-3">
          <Zap size={15} className="shrink-0 text-teal" />
          <p className="flex-1 text-[12.5px] text-muted">
            <span className="text-ink">{baixoImpacto.length} solicitações de baixo impacto</span> —
            propostas abaixo de {moedaCompacta(LIMITE_BAIXO_IMPACTO)} e com instrução em dia
            (saúde ≥ {SAUDE_MINIMA_LOTE}).
          </p>
          <Botao
            tamanho="sm"
            onClick={() =>
              setConfirmando({
                decisao: 'aprovada',
                ids: baixoImpacto.map((a) => a.id),
                rotulo: `${baixoImpacto.length} solicitações de baixo impacto`,
              })
            }
          >
            <Check size={13} /> Aprovar as {baixoImpacto.length}
          </Botao>
        </Panel>
      )}

      {pendentes.length === 0 ? (
        <Panel className="flex-1">
          <Vazio titulo="Nenhuma solicitação pendente. A fila está limpa." />
        </Panel>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
          {/* Fila */}
          <Panel className="flex min-h-0 flex-col overflow-hidden">
            <div className="border-b border-line px-4 py-2.5">
              <span className="eyebrow">Fila · {pendentes.length}</span>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {pendentes.map((a) => {
                const proposta = getProposta(a.propostaId)
                const proponente = proposta ? getProponente(proposta.proponenteId) : undefined
                const ativo = a.id === selecionado
                return (
                  <li key={a.id}>
                    <button
                      onClick={() => setSelecionado(a.id)}
                      className={cn(
                        'flex w-full items-start gap-3 border-b border-line-soft px-4 py-3 text-left transition-colors',
                        ativo ? 'bg-gold/[0.07]' : 'hover:bg-white/[0.025]',
                      )}
                    >
                      {ativo && <span className="absolute left-0 h-9 w-0.5 rounded-r bg-gold" />}
                      <span className="min-w-0 flex-1">
                        <span className="mb-1 flex items-center gap-2">
                          <Badge tom={TOM_TIPO[a.tipo]}>{ROTULO_TIPO[a.tipo]}</Badge>
                        </span>
                        <span className="num block text-[12px] text-ink">{proposta?.numero}</span>
                        <span className="mt-0.5 block truncate text-[11.5px] text-muted">
                          {proponente?.nome}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="num block text-[12px] text-gold">
                          {moedaCompacta(proposta?.valorGlobal ?? 0)}
                        </span>
                        <span className="mt-0.5 block text-[10.5px] text-faint">
                          {desde(a.solicitadoEm)}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </Panel>

          {/* Contexto da decisão */}
          {atual && (
            <ContextoDecisao
              aprovacao={atual}
              posicao={indice + 1}
              total={pendentes.length}
              aoDecidir={(d) => aplicar([atual.id], d, ROTULO_TIPO[atual.tipo])}
            />
          )}
        </div>
      )}

      {decididas.length > 0 && (
        <div className="flex items-center gap-3 text-[12px] text-muted">
          <span className="eyebrow">Nesta sessão</span>
          <span className="num text-teal">
            {decididas.filter((a) => a.decidida === 'aprovada').length} aprovadas
          </span>
          <span className="num text-alert">
            {decididas.filter((a) => a.decidida === 'recusada').length} recusadas
          </span>
        </div>
      )}

      {/* Desfazer: decisão em lote sem volta é armadilha, não eficiência */}
      {desfazer && (
        <div className="fixed bottom-7 left-1/2 z-50 -translate-x-1/2">
          <div className="flex items-center gap-4 rounded-full border border-line bg-surface/97 py-2.5 pr-3 pl-5 shadow-2xl backdrop-blur-xl">
            <span className="text-[12.5px] text-ink">
              {desfazer.ids.length > 1
                ? `${desfazer.ids.length} decisões registradas`
                : `${desfazer.rotulo} — decidida`}
            </span>
            <Botao
              tamanho="sm"
              onClick={() => {
                reverter(desfazer.ids)
                setDesfazer(null)
              }}
            >
              <Undo2 size={13} /> Desfazer
              <kbd className="num ml-1 text-[9.5px] text-faint">U</kbd>
            </Botao>
          </div>
        </div>
      )}

      {confirmando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-abyss/85 p-6 backdrop-blur-sm">
          <div className="panel w-full max-w-[440px] bg-surface p-5 sm:p-6">
            <h3 className="text-[16px]">
              {confirmando.decisao === 'aprovada' ? 'Aprovar' : 'Recusar'} {confirmando.rotulo}?
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              {confirmando.decisao === 'aprovada'
                ? 'As propostas seguem para a próxima fase e as automações vinculadas ficam liberadas. Você pode desfazer logo em seguida.'
                : 'As solicitações voltam para o analista, com registro da recusa.'}
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <Botao onClick={() => setConfirmando(null)}>Cancelar</Botao>
              <Botao
                variante={confirmando.decisao === 'aprovada' ? 'primario' : 'perigo'}
                onClick={() => {
                  aplicar(confirmando.ids, confirmando.decisao, confirmando.rotulo)
                  setConfirmando(null)
                }}
              >
                Confirmar
              </Botao>
            </div>
          </div>
        </div>
      )}

      {mostrarAtalhos && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-abyss/85 p-6 backdrop-blur-sm"
          onClick={() => setMostrarAtalhos(false)}
        >
          <div
            className="panel w-full max-w-[380px] bg-surface p-5 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-[16px]">Atalhos</h3>
            <ul className="flex flex-col gap-2.5">
              {[
                ['J / ↓', 'Próxima solicitação'],
                ['K / ↑', 'Solicitação anterior'],
                ['A', 'Aprovar a solicitação em foco'],
                ['R', 'Recusar a solicitação em foco'],
                ['U', 'Desfazer a última decisão'],
                ['?', 'Abrir e fechar esta lista'],
              ].map(([tecla, acao]) => (
                <li key={tecla} className="flex items-center gap-3">
                  <kbd className="num w-16 rounded border border-line bg-raised px-2 py-1 text-center text-[11px] text-gold">
                    {tecla}
                  </kbd>
                  <span className="text-[12.5px] text-muted">{acao}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Painel de contexto.
 *
 * O gestor não decide sobre um item de lista: decide sobre uma proposta. Aqui
 * está tudo que ele precisaria abrir em outra tela para decidir com segurança.
 */
const TOM_DECISAO: Record<Decisao, { texto: string; fundo: string; borda: string }> = {
  aprovar: { texto: 'text-teal', fundo: 'bg-teal/[0.05]', borda: 'border-teal/25' },
  verificar: { texto: 'text-gold', fundo: 'bg-gold/[0.05]', borda: 'border-gold/25' },
  recusar: { texto: 'text-alert', fundo: 'bg-alert/[0.05]', borda: 'border-alert/25' },
}

const TOM_FATO: Record<Tom, string> = {
  teal: 'text-teal',
  gold: 'text-gold',
  cleo: 'text-cleo',
  inert: 'text-muted',
  alert: 'text-alert',
}

function ContextoDecisao({
  aprovacao,
  posicao,
  total,
  aoDecidir,
}: {
  aprovacao: Aprovacao
  posicao: number
  total: number
  aoDecidir: (d: 'aprovada' | 'recusada') => void
}) {
  const proposta = getProposta(aprovacao.propostaId)
  if (!proposta) return null
  const proponente = getProponente(proposta.proponenteId)

  const feitos = new Set(
    automacoesDaProposta(proposta.id)
      .filter((a) => a.status === 'SUCESSO')
      .map((a) => a.gatilho),
  )
  const saude = avaliar(proposta, feitos)
  const altoImpacto = proposta.valorGlobal > LIMITE_BAIXO_IMPACTO
  const recomendacao = recomendar(aprovacao)

  return (
    <Panel className="flex min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <div className="flex items-center gap-2.5">
          <Badge tom={TOM_TIPO[aprovacao.tipo]}>{ROTULO_TIPO[aprovacao.tipo]}</Badge>
          {altoImpacto && <Badge tom="alert">alto impacto</Badge>}
        </div>
        <span className="num text-[11.5px] text-faint">
          {posicao} de {total}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <Link
              to={`/propostas/${proposta.id}`}
              className="num text-[18px] text-ink hover:text-gold"
            >
              {proposta.numero}
            </Link>
            <p className="mt-1.5 max-w-[560px] text-[13px] leading-relaxed text-muted">
              {proposta.objeto}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted">
              <span className="text-ink">{proponente?.nome}</span>
              <span>
                {proponente?.municipio} · {proponente?.uf}
              </span>
              <SituacaoBadge situacao={proposta.situacao} />
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="eyebrow mb-1">Valor global</div>
            <div className="num text-[20px] text-gold">{moeda(proposta.valorGlobal)}</div>
          </div>
        </div>

        {/* O pedido em si */}
        <div className="mt-5 rounded-xl border border-line bg-abyss/40 p-4">
          <div className="eyebrow mb-2">O que está sendo pedido</div>
          <p className="text-[13px] leading-relaxed text-ink">{aprovacao.justificativa}</p>

          {aprovacao.tipo === 'corrigir_repasse' &&
            aprovacao.valorAtual &&
            aprovacao.valorSugerido && (
              <div className="mt-3.5 flex items-center gap-4 border-t border-line pt-3.5">
                <div>
                  <div className="eyebrow mb-1">Cadastrado</div>
                  <div className="num text-[15px] text-muted line-through">
                    {moeda(aprovacao.valorAtual)}
                  </div>
                </div>
                <ArrowRight size={16} className="mt-4 text-faint" />
                <div>
                  <div className="eyebrow mb-1">Proposto</div>
                  <div className="num text-[15px] text-gold">{moeda(aprovacao.valorSugerido)}</div>
                </div>
                <div className="mt-4 ml-auto">
                  <span
                    className={cn(
                      'num text-[13px]',
                      aprovacao.valorSugerido > aprovacao.valorAtual ? 'text-teal' : 'text-alert',
                    )}
                  >
                    {aprovacao.valorSugerido > aprovacao.valorAtual ? '+' : '−'}
                    {moeda(Math.abs(aprovacao.valorSugerido - aprovacao.valorAtual))}
                  </span>
                </div>
              </div>
            )}

          {aprovacao.documentoSugerido && (
            <div className="mt-3.5 border-t border-line pt-3.5 text-[12.5px] text-muted">
              Documento: <span className="text-ink">{aprovacao.documentoSugerido}</span>
            </div>
          )}

          <div className="mt-3.5 border-t border-line pt-3 text-[11.5px] text-faint">
            Pedido por {aprovacao.solicitadoPor} em {data(aprovacao.solicitadoEm)} ·{' '}
            {desde(aprovacao.solicitadoEm)}
          </div>
        </div>

        {/* A recomendação nunca aparece sozinha: vem com os fatos que a
            produziram e o grau de convergência entre eles. */}
        {recomendacao && (
          <div
            className={cn(
              'mt-5 rounded-xl border p-4',
              TOM_DECISAO[recomendacao.decisao].borda,
              TOM_DECISAO[recomendacao.decisao].fundo,
            )}
          >
            <div className="mb-2.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Sparkles size={13} className={TOM_DECISAO[recomendacao.decisao].texto} />
                <span className={cn('text-[13px]', TOM_DECISAO[recomendacao.decisao].texto)}>
                  {recomendacao.rotulo}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="eyebrow">confiança</span>
                <div className="w-16">
                  <Medidor
                    valor={recomendacao.confianca}
                    tom={recomendacao.confianca > 0.85 ? 'teal' : 'gold'}
                    altura={4}
                  />
                </div>
                <span className="num text-[11.5px] text-muted">
                  {(recomendacao.confianca * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            <p className="text-[12.5px] leading-relaxed text-muted">{recomendacao.frase}</p>

            <ul className="mt-3.5 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-3">
              {recomendacao.fatos.map((f) => (
                <li key={f.rotulo} className="min-w-0">
                  <div className="eyebrow mb-0.5">{f.rotulo}</div>
                  <div className={cn('text-[12px]', TOM_FATO[f.tom])}>{f.valor}</div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Contexto que sustenta a decisão */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="eyebrow mb-2.5">Instrução da proposta</div>
            <ul className="flex flex-col gap-2">
              {saude.pendencias.map((p) => (
                <li key={p.rotulo} className="flex items-center gap-2.5">
                  {p.resolvida ? (
                    <CheckCircle2 size={14} className="shrink-0 text-teal" />
                  ) : (
                    <CircleDashed size={14} className="shrink-0 text-gold" />
                  )}
                  <span
                    className={cn('text-[12px]', p.resolvida ? 'text-muted' : 'text-ink')}
                  >
                    {p.rotulo}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="eyebrow mb-2.5">Números</div>
            <dl className="flex flex-col gap-2 text-[12.5px]">
              {[
                ['Repasse', moeda(proposta.valorRepasse)],
                ['Contrapartida', moeda(proposta.valorContrapartida)],
                ['Empenhado', moeda(proposta.empenhos.reduce((s, e) => s + e.valor, 0))],
                ['Documentos no processo', numero(proposta.documentos.length)],
                ['Sem movimento há', `${saude.diasParada} dias`],
                ['Processo SEI', proposta.numProcessoSei ?? 'não autuado'],
              ].map(([r, v]) => (
                <div key={r} className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted">{r}</dt>
                  <dd className="num text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-line px-5 py-4">
        <Link
          to={`/propostas/${proposta.id}`}
          className="text-[12.5px] text-muted hover:text-gold"
        >
          Abrir a proposta inteira
        </Link>
        {/* A decisão respeita a alçada: acima do teto do perfil, o botão explica
            a quem o pedido sobe em vez de simplesmente sumir. */}
        <div className="ml-auto flex gap-2.5">
          <Autorizado permissao="aprovacao.decidir" valor={proposta.valorGlobal}>
            <Botao variante="perigo" onClick={() => aoDecidir('recusada')}>
              <X size={14} /> Recusar
              <kbd className="num ml-1 text-[9.5px] opacity-60">R</kbd>
            </Botao>
          </Autorizado>
          <Autorizado permissao="aprovacao.decidir" valor={proposta.valorGlobal}>
            <Botao variante="primario" onClick={() => aoDecidir('aprovada')}>
              <Check size={14} /> Aprovar
              <kbd className="num ml-1 text-[9.5px] opacity-60">A</kbd>
            </Botao>
          </Autorizado>
        </div>
      </div>
    </Panel>
  )
}
