import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react'
import { useApp, type Publico } from '@/store/app'
import { useExecutor } from '@/comandos/executor'
import { propostasDoOrgao } from '@/data/repo'
import type { Acao } from '@/comandos/tipos'
import { diasParada } from '@/assistente/motor'
import { Botao } from '@/components/ui'
import { cn } from '@/lib/format'

interface Cena {
  titulo: string
  narracao: string
  acoes: Acao[]
  /** Tempo de tela no piloto automático; cenas com automação rodando pedem mais. */
  duracaoMs?: number
}

const DURACAO_PADRAO = 12_000

/**
 * Modo apresentação.
 *
 * O apresentador controla o passo — autopilot cronometrado dessincroniza assim
 * que alguém faz uma pergunta no meio, e aí a demonstração anda sozinha enquanto
 * a sala olha para outra coisa. Aqui cada cena espera o comando.
 */
const ROTULO_PUBLICO: Record<Publico, string> = {
  gestor: 'Gestor',
  tecnico: 'Técnico',
  parlamentar: 'Gabinete',
}

const EXPLICA_PUBLICO: Record<Publico, string> = {
  gestor: 'Números, risco e decisão',
  tecnico: 'Automação, integração e auditoria',
  parlamentar: 'Emenda, execução e território',
}

export function ModoApresentacao() {
  const [params, setParams] = useSearchParams()
  const { orgaoId, apresentando, setApresentando, publico, setPublico } = useApp()
  const { executar } = useExecutor()
  const [cena, setCena] = useState(0)
  const [auto, setAuto] = useState(false)

  const roteiro = useMemo<Cena[]>(() => {
    const propostas = propostasDoOrgao(orgaoId)
    const paradas = [...propostas].sort((a, b) => diasParada(b) - diasParada(a))
    const alvo = paradas.find((p) => !p.numProcessoSei) ?? paradas[0]

    // Cada público entra por uma porta diferente: o gestor quer saber onde está
    // o risco, o técnico quer ver a máquina por dentro, e o gabinete quer saber
    // onde parou a emenda dele.
    if (publico === 'tecnico') {
      return [
        {
          titulo: 'A carteira sincronizada',
          narracao:
            'Tudo que se vê aqui vem do TransfereGov e do SEI. O acesso a dado está isolado num módulo só — trocar a origem não mexe em nenhuma tela.',
          acoes: [{ tipo: 'navegar', para: '/' }],
        },
        {
          titulo: 'Um rito por dentro',
          narracao:
            'Automação é uma sequência de passos montada na tela, sem código. Abrir sistema, autenticar, localizar, preencher, anexar, assinar.',
          acoes: [{ tipo: 'navegar', para: '/ritos' }],
        },
        {
          titulo: 'A execução, passo a passo',
          narracao:
            'A janela reconstrói o SEI e o TransfereGov ao vivo: cursor, digitação, clique e o resultado de cada passo. Falha isola o item e retoma do ponto exato.',
          duracaoMs: 40_000,
          acoes: [
            {
              tipo: 'executar-rito',
              propostaId: alvo.id,
              gatilhos: [
                'criar_processo',
                'anexar_extrato_proposta',
                'anexar_contrapartidas',
                'criar_documento',
              ],
            },
          ],
        },
        {
          titulo: 'Regra dispara rito',
          narracao:
            '"Quando a proposta entrar em análise e não tiver processo, autue." A pré-visualização mostra quantas propostas a regra pegaria hoje, antes de publicar.',
          acoes: [{ tipo: 'navegar', para: '/ritos' }],
        },
        {
          titulo: 'Tudo auditável',
          narracao:
            'Quem fez, quando, em quê e com qual justificativa. Automação que não se explica não passa em controle — esta explica.',
          acoes: [{ tipo: 'navegar', para: '/auditoria' }],
        },
        {
          titulo: 'Verificação, não torcida',
          narracao:
            'O estúdio tem nós que confirmam se a ação deu certo no próprio sistema, e nós que repensam a rota antes de chamar uma pessoa. Automação séria não é "executou, acabou".',
          acoes: [{ tipo: 'navegar', para: '/ritos' }],
        },
        {
          titulo: 'A extensão e o cofre de sessões',
          narracao:
            'A extensão opera na sessão do próprio usuário — inclusive lendo cookies httpOnly que a página não enxerga — e leva a sessão para a Cleo trabalhar sem a aba aberta.',
          acoes: [{ tipo: 'navegar', para: '/cofre' }],
        },
        {
          titulo: 'Permissão e alçada no código',
          narracao:
            '22 permissões nomeadas, 5 perfis com teto de valor. O botão que a pessoa não pode usar não some: explica o motivo e a quem o pedido sobe.',
          acoes: [{ tipo: 'navegar', para: '/usuarios' }],
        },
        {
          titulo: 'O grafo do conhecimento',
          narracao:
            'Órgão, programa, proponente, proposta, processo, documento, emenda e parlamentar no mesmo modelo. Os vínculos são os do próprio banco.',
          acoes: [{ tipo: 'navegar', para: '/cerebro' }],
        },
      ]
    }

    if (publico === 'parlamentar') {
      return [
        {
          titulo: 'A carteira do órgão',
          narracao:
            'Onde está cada proposta, quanto vale e o que já foi empenhado — a foto da casa antes de falar de emenda.',
          acoes: [{ tipo: 'navegar', para: '/' }],
        },
        {
          titulo: 'De quem é o recurso',
          narracao:
            'A carteira organizada por quem indicou: valor apontado, valor empenhado e quantas propostas estão sem andamento em cada gabinete.',
          acoes: [{ tipo: 'navegar', para: '/emendas' }],
        },
        {
          titulo: 'Onde a emenda virou obra',
          narracao:
            'Do gabinete ao município: cada proposta apoiada, em que fase está e quanto já saiu do papel.',
          acoes: [{ tipo: 'navegar', para: '/emendas' }],
        },
        {
          titulo: 'O relógio de dezembro',
          narracao:
            'Quanto ainda dá para empenhar, em quantos dias úteis e em que ritmo. É a conta que decide se o recurso vira obra ou volta ao Tesouro.',
          acoes: [{ tipo: 'navegar', para: '/orcamento' }],
        },
        {
          titulo: 'Onde o dinheiro cai',
          narracao:
            'A distribuição territorial da carteira, do estado ao município — e a cadeia inteira que liga a indicação à obra.',
          acoes: [{ tipo: 'navegar', para: '/cerebro' }],
        },
        {
          titulo: 'O município do outro lado',
          narracao:
            'O módulo Prefeitura mostra como o pedido nasce: a Cleo acha o programa certo e escreve o ofício na linguagem que o ministério exige — menos devolução, mais obra.',
          acoes: [{ tipo: 'navegar', para: '/prefeitura' }],
        },
        {
          titulo: 'Uma página para levar',
          narracao:
            'O relatório executivo sai pronto, em linguagem de ofício, com os números que sustentam qualquer conversa.',
          acoes: [{ tipo: 'navegar', para: '/relatorio' }],
        },
      ]
    }

    return [
      {
        titulo: 'O órgão numa tela',
        narracao:
          'Toda a carteira de convênios em um lugar só: onde cada proposta está agora, quanto vale, o que já foi empenhado — e os quatro sinais que mudam a semana da coordenação.',
        acoes: [{ tipo: 'navegar', para: '/' }],
      },
      {
        titulo: 'Por onde começar hoje',
        narracao:
          'A fila do dia, ordenada por risco, prazo consumido e valor. Cada proposta já vem com a próxima ação pronta para executar.',
        acoes: [{ tipo: 'navegar', para: '/meu-dia' }],
      },
      {
        titulo: 'O que está parado',
        narracao:
          'A Cleo sabe o que não anda. Estas propostas estão sem movimento há mais de trinta dias — e é aqui que o dinheiro fica retido.',
        acoes: [
          { tipo: 'filtrar-propostas', filtro: { paradaHaDias: 30, ordenarPor: 'parada' } },
        ],
      },
      {
        titulo: 'Uma proposta por dentro',
        narracao:
          'Ciclo de vida, saúde da instrução, conformidade com a regra à vista, emenda de origem, prazos legais com base normativa e previsão de celebração.',
        acoes: [{ tipo: 'abrir-proposta', propostaId: alvo.id }],
      },
      {
        titulo: 'A Cleo trabalhando',
        narracao:
          'Um clique instrui o processo inteiro: autua no SEI, anexa os documentos do TransfereGov e redige o termo de análise. Acompanhe pela janela.',
        duracaoMs: 40_000,
        acoes: [
          {
            tipo: 'executar-rito',
            propostaId: alvo.id,
            gatilhos: [
              'criar_processo',
              'anexar_extrato_proposta',
              'anexar_contrapartidas',
              'criar_documento',
            ],
          },
        ],
      },
      {
        titulo: 'A decisão continua sua',
        narracao:
          'Cada pedido chega com a recomendação da Cleo, os fatos que a sustentam e o grau de confiança. E respeita a alçada: acima do teto do perfil, sobe para quem pode.',
        acoes: [{ tipo: 'navegar', para: '/aprovacoes' }],
      },
      {
        titulo: 'De quem é o dinheiro',
        narracao:
          'A carteira organizada por quem cobra: valor indicado, valor empenhado e quantas propostas estão paradas em cada gabinete.',
        acoes: [{ tipo: 'navegar', para: '/emendas' }],
      },
      {
        titulo: 'O relógio de dezembro',
        narracao:
          'Dotação, empenho, liquidação e pagamento — com o nome do que sobra em cada degrau e o ritmo necessário para não devolver recurso ao Tesouro.',
        acoes: [{ tipo: 'navegar', para: '/orcamento' }],
      },
      {
        titulo: 'O que vence antes do fim do trimestre',
        narracao:
          'Convênio é contrato com data para morrer. A régua mostra o que vence em 30, 60 e 90 dias, e o que ainda dá para prorrogar.',
        acoes: [{ tipo: 'navegar', para: '/vigencias' }],
      },
      {
        titulo: 'Quem está travado',
        narracao:
          'Prestação de contas em atraso bloqueia o proponente para qualquer transferência nova. Aqui está quanto da carteira isso trava.',
        acoes: [{ tipo: 'navegar', para: '/contas' }],
      },
      {
        titulo: 'Qualquer automação, sem código',
        narracao:
          'O estúdio visual: nós ligados por fios, caminho de sucesso e de falha, variáveis passando entre passos e nós que confirmam se a ação deu certo.',
        acoes: [{ tipo: 'navegar', para: '/ritos' }],
      },
      {
        titulo: 'O documento se escreve sozinho',
        narracao:
          'A minuta é um documento com variáveis vivas: verde é o que a Cleo calcula do cadastro, dourado é a lacuna que espera julgamento humano.',
        acoes: [{ tipo: 'navegar', para: '/minutas' }],
      },
      {
        titulo: 'A hierarquia da casa vira regra da máquina',
        narracao:
          'Cada ação é uma permissão nomeada, cada perfil tem alçada, e a Cleo herda a alçada de quem a acionou. Ela nunca faz o que a pessoa não poderia fazer sozinha.',
        acoes: [{ tipo: 'navegar', para: '/usuarios' }],
      },
      {
        titulo: 'A Cleo dentro do navegador',
        narracao:
          'Uma extensão real opera o SEI e o TransfereGov na sessão do próprio servidor — e pode levar a sessão autenticada para a Cleo trabalhar a madrugada sozinha.',
        acoes: [{ tipo: 'navegar', para: '/extensao' }],
      },
      {
        titulo: 'Tudo auditável',
        narracao:
          'Quem fez, quando, em quê, com qual perfil e sob qual alçada. Automação que não se explica não passa em controle — esta explica.',
        acoes: [{ tipo: 'navegar', para: '/auditoria' }],
      },
      {
        titulo: 'Pergunte em português',
        narracao:
          'Ela consulta, responde e executa. E quando mostra algo, abre um painel sobre a tela em vez de tirar você do lugar onde estava.',
        acoes: [{ tipo: 'navegar', para: '/cleo' }],
      },
      {
        titulo: 'Tudo que a Cleo sabe',
        narracao:
          'Cada ponto é um registro do órgão; cada linha, uma relação real. Sete histórias guiadas e a linha do tempo do conhecimento sendo aprendido.',
        acoes: [{ tipo: 'navegar', para: '/cerebro' }],
      },
      {
        titulo: 'O outro lado do balcão',
        narracao:
          'O módulo Prefeitura: a Cleo trabalhando para quem pede o recurso. Acha o programa que aceita o projeto e escreve o ofício na linguagem que o ministério exige.',
        acoes: [{ tipo: 'navegar', para: '/prefeitura' }],
      },
      {
        titulo: 'O que isso devolve',
        narracao:
          'Ponha o tempo que o seu órgão gasta hoje e veja a conta. O trabalho continua o mesmo — muda quem faz.',
        acoes: [{ tipo: 'navegar', para: '/ganho' }],
      },
    ]
  }, [orgaoId, publico])

  const irPara = useCallback(
    (indice: number) => {
      const alvo = Math.max(0, Math.min(indice, roteiro.length - 1))
      setCena(alvo)
      void executar(roteiro[alvo].acoes, { silencioso: true })
    },
    [roteiro, executar],
  )

  const sair = useCallback(() => {
    setApresentando(false)
    setCena(0)
    setAuto(false)
    if (params.has('apresentar')) {
      params.delete('apresentar')
      setParams(params, { replace: true })
    }
  }, [setApresentando, params, setParams])

  // Piloto automático: avança no ritmo da cena e desliga ao chegar ao fim.
  // Qualquer navegação manual reinicia o cronômetro — o efeito depende da cena.
  useEffect(() => {
    if (!auto || !apresentando) return
    if (cena >= roteiro.length - 1) {
      const fim = window.setTimeout(() => setAuto(false), roteiro[cena]?.duracaoMs ?? DURACAO_PADRAO)
      return () => window.clearTimeout(fim)
    }
    const t = window.setTimeout(
      () => irPara(cena + 1),
      roteiro[cena]?.duracaoMs ?? DURACAO_PADRAO,
    )
    return () => window.clearTimeout(t)
  }, [auto, apresentando, cena, roteiro, irPara])

  // Entrada pelo endereço (?apresentar=1), pelo botão ou por Ctrl+Shift+P.
  // A trava impede que a primeira cena seja reexecutada a cada renderização.
  const iniciado = useRef(false)
  useEffect(() => {
    if (params.get('apresentar') === '1' && !apresentando) {
      setApresentando(true)
      return
    }
    if (apresentando && !iniciado.current) {
      iniciado.current = true
      irPara(0)
    }
    if (!apresentando) iniciado.current = false
  }, [params, apresentando, setApresentando, irPara])

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        setApresentando(true)
        irPara(0)
        return
      }
      if (!apresentando) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') irPara(cena + 1)
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') irPara(cena - 1)
      if (e.key === 'Escape') sair()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [apresentando, cena, irPara, sair, setApresentando])

  if (!apresentando) return null

  const atual = roteiro[cena]

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[55] flex justify-center p-6">
      <div className="pointer-events-auto w-[min(920px,96vw)] rounded-2xl border border-gold/25 bg-surface/96 px-6 py-4 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-5">
          {/* A chave pela cena reanima o texto: a narração entra, não troca */}
          <div key={cena} className="pagina-entra min-w-0 flex-1">
            <div className="mb-1.5 flex items-center gap-3">
              <span className="eyebrow text-gold">
                {String(cena + 1).padStart(2, '0')} / {String(roteiro.length).padStart(2, '0')}
              </span>
              <span className="text-[14px] text-ink">{atual.titulo}</span>
            </div>
            <p className="text-[13px] leading-relaxed text-muted">{atual.narracao}</p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Botao
              tamanho="sm"
              onClick={() => setAuto((v) => !v)}
              className={cn(auto && 'border-gold/50 text-gold')}
              title={auto ? 'Pausar o piloto automático' : 'A apresentação avança sozinha'}
              aria-label="Piloto automático"
            >
              {auto ? <Pause size={13} /> : <Play size={13} fill="currentColor" />}
              {auto ? 'Pausar' : 'Auto'}
            </Botao>
            <Botao
              tamanho="sm"
              onClick={() => irPara(cena - 1)}
              disabled={cena === 0}
              aria-label="Cena anterior"
            >
              <ChevronLeft size={14} />
            </Botao>
            <Botao
              tamanho="sm"
              variante="primario"
              onClick={() => irPara(cena + 1)}
              disabled={cena === roteiro.length - 1}
            >
              Próximo <ChevronRight size={14} />
            </Botao>
            <Botao tamanho="sm" variante="fantasma" onClick={sair} aria-label="Sair da apresentação">
              <X size={14} />
            </Botao>
          </div>
        </div>

        {/* Escolher o público troca a sequência inteira, sem sair do modo */}
        <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
          <span className="eyebrow">Roteiro para</span>
          {(['gestor', 'tecnico', 'parlamentar'] as Publico[]).map((p) => (
            <button
              key={p}
              onClick={() => {
                setPublico(p)
                setCena(0)
              }}
              title={EXPLICA_PUBLICO[p]}
              className={cn(
                'rounded-md px-2.5 py-1 text-[11.5px] transition-colors',
                publico === p ? 'bg-gold/15 text-gold' : 'text-muted hover:text-ink',
              )}
            >
              {ROTULO_PUBLICO[p]}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-faint">{EXPLICA_PUBLICO[publico]}</span>
        </div>

        {/* Trilha das cenas — a plateia vê quanto falta; no piloto automático,
            a cena atual se preenche no tempo real dela */}
        <div className="mt-3 flex gap-1">
          {roteiro.map((c, i) => (
            <button
              key={c.titulo}
              onClick={() => irPara(i)}
              aria-label={c.titulo}
              className={cn(
                'h-1 flex-1 overflow-hidden rounded-full transition-colors',
                i < cena ? 'bg-gold/50' : i === cena && !auto ? 'bg-gold' : 'bg-line',
              )}
            >
              {i === cena && auto && (
                <span
                  key={`${cena}-auto`}
                  className="block h-full rounded-full bg-gold"
                  style={{ animation: `cresce-x ${c.duracaoMs ?? DURACAO_PADRAO}ms linear forwards` }}
                />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Botão de entrada, disponível no rodapé da navegação. */
export function BotaoApresentar() {
  const { setApresentando } = useApp()
  return (
    <button
      onClick={() => setApresentando(true)}
      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[12px] text-muted transition-colors hover:bg-white/5 hover:text-gold"
    >
      <Play size={12} className="shrink-0 text-gold" />
      Apresentação
      <kbd className="num ml-auto shrink-0 text-[9.5px] text-faint">⇧⌃P</kbd>
    </button>
  )
}
