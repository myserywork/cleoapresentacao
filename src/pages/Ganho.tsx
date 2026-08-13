import { useMemo, useState } from 'react'
import { ArrowRight, Check, Clock, Flag, MousePointerClick, RotateCcw, Users } from 'lucide-react'
import { useApp } from '@/store/app'
import { getOrgao, resumoOrgao } from '@/data/repo'
import { numero } from '@/lib/format'
import { Panel } from '@/components/ui'
import { useContagem } from '@/components/charts'
import { cn } from '@/lib/format'

/**
 * Antes × Depois.
 *
 * A premissa de tempo do fluxo manual é editável em vez de afirmada: quem decide
 * põe o número do próprio órgão e vê a própria conta. Vale mais do que uma
 * métrica nossa, e não depende de acreditar em nós.
 */

const PASSOS_MANUAIS = [
  'Abrir o TransfereGov e localizar a proposta',
  'Percorrer as abas e copiar os dados à mão',
  'Gerar e baixar o PDF do extrato',
  'Gerar e baixar o PDF das contrapartidas',
  'Abrir o SEI e autuar o processo',
  'Preencher especificação e interessado',
  'Registrar cada PDF como documento externo',
  'Abrir o editor e redigir o termo de análise',
  'Conferir valores e recalcular a contrapartida',
  'Incluir o processo no bloco de assinatura',
]

const PASSOS_CLEO = [
  'Clicar em "Executar o rito completo"',
  'Acompanhar pelo modal, se quiser',
  'Aprovar o documento gerado',
]

/** Duração real do rito encadeado na plataforma, em segundos. */
const SEGUNDOS_CLEO = 96

/** Quanto tempo de tela a pista inteira da corrida representa. */
const DURACAO_CORRIDA_MS = 14_000

export function Ganho() {
  const { orgaoId } = useApp()
  const orgao = getOrgao(orgaoId)!
  const resumo = useMemo(() => resumoOrgao(orgaoId), [orgaoId])

  const [minutosManuais, setMinutosManuais] = useState(47)
  const [pessoas, setPessoas] = useState(6)
  const [corrida, setCorrida] = useState(0)

  const processos = resumo.processosSei
  const horasManuais = (processos * minutosManuais) / 60
  const horasCleo = (processos * SEGUNDOS_CLEO) / 3600
  const horasDevolvidas = Math.max(horasManuais - horasCleo, 0)
  const diasUteis = horasDevolvidas / 8
  const capacidadeExtra = Math.round((minutosManuais / (SEGUNDOS_CLEO / 60)) * 10) / 10

  const animHoras = useContagem(horasDevolvidas)
  const animDias = useContagem(diasUteis)

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-5">
      <header>
        <div className="eyebrow mb-2">O ganho</div>
        <h1 className="text-[26px] leading-tight">O mesmo processo, dos dois jeitos</h1>
        <p className="mt-1.5 max-w-[680px] text-[13px] leading-relaxed text-muted">
          Instruir uma proposta é sempre o mesmo trabalho: buscar no TransfereGov, autuar no SEI,
          anexar os documentos e redigir o termo. Muda quem faz.
        </p>
      </header>

      {/* A corrida: os dois fluxos no mesmo relógio, em escala proporcional real.
          A barra da Cleo termina quando a manual mal saiu do lugar — nenhum
          número diz isso tão rápido quanto ver. */}
      <Panel className="p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <div className="eyebrow mb-1">A corrida</div>
            <h2 className="text-[15px]">Os dois fluxos largando juntos, em escala real</h2>
          </div>
          <button
            onClick={() => setCorrida((c) => c + 1)}
            className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12px] text-muted transition-colors hover:text-ink"
          >
            <RotateCcw size={12} /> Largar de novo
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-[12.5px] text-muted">Fluxo manual</span>
              <span className="num text-[12px] text-inert">{minutosManuais} min</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/5">
              <div
                key={`m-${corrida}-${minutosManuais}`}
                className="h-full rounded-full bg-inert/70"
                style={{ animation: `cresce-x ${DURACAO_CORRIDA_MS}ms linear forwards` }}
              />
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="flex items-center gap-1.5 text-[12.5px] text-cleo">
                Cleo <Flag size={11} />
              </span>
              <span className="num text-[12px] text-cleo">{SEGUNDOS_CLEO}s</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/5">
              <div
                key={`c-${corrida}-${minutosManuais}`}
                className="h-full rounded-full bg-cleo"
                style={{
                  animation: `cresce-x ${Math.max(
                    (DURACAO_CORRIDA_MS * SEGUNDOS_CLEO) / (minutosManuais * 60),
                    350,
                  )}ms linear forwards`,
                }}
              />
            </div>
          </div>
        </div>

        <p className="mt-4 text-[11.5px] text-faint">
          A pista inteira representa os {minutosManuais} minutos do fluxo manual. A Cleo cruza a
          linha em {((SEGUNDOS_CLEO / (minutosManuais * 60)) * 100).toFixed(1)}% do percurso —{' '}
          {Math.round((minutosManuais * 60) / SEGUNDOS_CLEO)} vezes mais rápido.
        </p>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] items-stretch gap-4">
        <Panel className="flex flex-col p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="eyebrow mb-1">Sem a Cleo</div>
              <h2 className="text-[15px] text-muted">O servidor faz tudo</h2>
            </div>
            <div className="text-right">
              <div className="num text-[24px] text-inert">{minutosManuais} min</div>
              <div className="text-[11px] text-faint">por processo</div>
            </div>
          </div>

          <ol className="flex flex-1 flex-col gap-0.5">
            {PASSOS_MANUAIS.map((passo, i) => (
              <li key={passo} className="flex items-start gap-2.5 py-1">
                <span className="num mt-px w-4 shrink-0 text-[10.5px] text-faint">{i + 1}</span>
                <span className="text-[12.5px] leading-snug text-muted">{passo}</span>
              </li>
            ))}
          </ol>

          <div className="mt-4 flex items-center gap-4 border-t border-line pt-4 text-[11.5px] text-faint">
            <span className="flex items-center gap-1.5">
              <MousePointerClick size={12} /> 10 etapas
            </span>
            <span>2 sistemas</span>
            <span>sujeito a erro de digitação</span>
          </div>
        </Panel>

        <div className="flex items-center">
          <span className="flex size-9 items-center justify-center rounded-full border border-line bg-raised text-muted">
            <ArrowRight size={16} />
          </span>
        </div>

        <Panel className="flex flex-col border-cleo/25 bg-cleo/[0.035] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="eyebrow mb-1">Com a Cleo</div>
              <h2 className="text-[15px]">A Cleo faz, você decide</h2>
            </div>
            <div className="text-right">
              <div className="num text-[24px] text-cleo">{SEGUNDOS_CLEO}s</div>
              <div className="text-[11px] text-faint">por processo</div>
            </div>
          </div>

          <ol className="flex flex-1 flex-col gap-0.5">
            {PASSOS_CLEO.map((passo) => (
              <li key={passo} className="flex items-start gap-2.5 py-1">
                <Check size={13} className="mt-0.5 shrink-0 text-teal" />
                <span className="text-[12.5px] leading-snug text-ink">{passo}</span>
              </li>
            ))}
            <li className="mt-2 rounded-lg border border-line bg-abyss/40 p-3">
              <p className="text-[11.5px] leading-relaxed text-muted">
                As dez etapas da esquerda continuam acontecendo — nos mesmos sistemas oficiais, na
                mesma ordem. A diferença é que quem navega é a Cleo, e você acompanha.
              </p>
            </li>
          </ol>

          <div className="mt-4 flex items-center gap-4 border-t border-line pt-4 text-[11.5px] text-faint">
            <span className="flex items-center gap-1.5">
              <MousePointerClick size={12} /> 1 clique
            </span>
            <span>sem digitação</span>
            <span>rastro completo no log</span>
          </div>
        </Panel>
      </div>

      {/* A premissa é do órgão, não nossa */}
      <Panel className="p-5">
        <div className="mb-4">
          <div className="eyebrow mb-1">A conta com os seus números</div>
          <h2 className="text-[15px]">Ajuste a premissa e veja o resultado do {orgao.sigla}</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_2fr] items-center gap-8">
          <div>
            <label className="mb-2 flex items-center gap-2 text-[12.5px] text-muted">
              <Clock size={13} className="text-faint" />
              Minutos por processo no fluxo manual
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={15}
                max={120}
                step={1}
                value={minutosManuais}
                onChange={(e) => setMinutosManuais(Number(e.target.value))}
                className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-line accent-[#dfb552]"
                aria-label="Minutos por processo no fluxo manual"
              />
              <span className="num w-14 text-right text-[15px] text-ink">{minutosManuais}</span>
            </div>
          </div>

          <div>
            <label className="mb-2 flex items-center gap-2 text-[12.5px] text-muted">
              <Users size={13} className="text-faint" />
              Pessoas na equipe de análise
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={30}
                step={1}
                value={pessoas}
                onChange={(e) => setPessoas(Number(e.target.value))}
                className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-line accent-[#dfb552]"
                aria-label="Pessoas na equipe de análise"
              />
              <span className="num w-14 text-right text-[15px] text-ink">{pessoas}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 border-l border-line pl-8">
            <div>
              <div className="eyebrow mb-1.5">Horas devolvidas</div>
              <div className="num text-[26px] leading-none text-gold">
                {numero(Math.round(animHoras))}
              </div>
              <div className="mt-1.5 text-[11px] text-faint">
                nos {numero(processos)} processos já instruídos
              </div>
            </div>
            <div>
              <div className="eyebrow mb-1.5">Dias úteis</div>
              <div className="num text-[26px] leading-none text-ink">
                {numero(Math.round(animDias))}
              </div>
              <div className="mt-1.5 text-[11px] text-faint">
                ≈ {(diasUteis / pessoas).toFixed(0)} dias por pessoa
              </div>
            </div>
            <div>
              <div className="eyebrow mb-1.5">Capacidade</div>
              <div className="num text-[26px] leading-none text-cleo">
                {capacidadeExtra.toFixed(1).replace('.', ',')}×
              </div>
              <div className="mt-1.5 text-[11px] text-faint">processos com a mesma equipe</div>
            </div>
          </div>
        </div>

        <p className="mt-5 border-t border-line pt-4 text-[11.5px] leading-relaxed text-faint">
          O tempo da Cleo ({SEGUNDOS_CLEO}s) é a duração real do rito completo nesta plataforma. O
          tempo manual é a sua premissa — troque pelo número que o {orgao.sigla} observa e a conta se
          refaz.
        </p>
      </Panel>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          {
            titulo: 'O erro sai da conta',
            texto:
              'Nenhum valor é redigitado. Número de proposta, CNPJ, repasse e contrapartida vêm do cadastro sincronizado.',
          },
          {
            titulo: 'O rastro fica',
            texto:
              'Cada passo executado guarda log, horário e resultado. Auditar é ler uma lista, não reconstituir memória.',
          },
          {
            titulo: 'A decisão continua sua',
            texto:
              'A Cleo instrui; aprovar, corrigir valor ou recusar segue sendo ato do gestor, registrado como tal.',
          },
        ].map((c) => (
          <Panel key={c.titulo} className="p-5">
            <h3 className={cn('mb-2 text-[14px]')}>{c.titulo}</h3>
            <p className="text-[12.5px] leading-relaxed text-muted">{c.texto}</p>
          </Panel>
        ))}
      </div>
    </div>
  )
}
