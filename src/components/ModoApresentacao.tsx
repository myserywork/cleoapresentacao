import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Play, X } from 'lucide-react'
import { useApp } from '@/store/app'
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
}

/**
 * Modo apresentação.
 *
 * O apresentador controla o passo — autopilot cronometrado dessincroniza assim
 * que alguém faz uma pergunta no meio, e aí a demonstração anda sozinha enquanto
 * a sala olha para outra coisa. Aqui cada cena espera o comando.
 */
export function ModoApresentacao() {
  const [params, setParams] = useSearchParams()
  const { orgaoId, apresentando, setApresentando } = useApp()
  const { executar } = useExecutor()
  const [cena, setCena] = useState(0)

  const roteiro = useMemo<Cena[]>(() => {
    const propostas = propostasDoOrgao(orgaoId)
    const paradas = [...propostas].sort((a, b) => diasParada(b) - diasParada(a))
    const alvo = paradas.find((p) => !p.numProcessoSei) ?? paradas[0]

    return [
      {
        titulo: 'O órgão numa tela',
        narracao:
          'Toda a carteira de convênios em um lugar só: onde cada proposta está agora, quanto vale e o que já foi empenhado.',
        acoes: [{ tipo: 'navegar', para: '/' }],
      },
      {
        titulo: 'O que está parado',
        narracao:
          'A Cleo sabe o que não anda. Estas propostas estão sem movimento há mais de trinta dias — e é aqui que o dinheiro fica retido.',
        acoes: [
          {
            tipo: 'filtrar-propostas',
            filtro: { paradaHaDias: 30, ordenarPor: 'parada' },
          },
        ],
      },
      {
        titulo: 'Uma proposta por dentro',
        narracao:
          'Empenhos, cronograma, documentos, linha do tempo e o que ainda falta para habilitar. Sem abrir o TransfereGov nem o SEI.',
        acoes: [{ tipo: 'abrir-proposta', propostaId: alvo.id }],
      },
      {
        titulo: 'A Cleo trabalhando',
        narracao:
          'Um clique instrui o processo inteiro: autua no SEI, anexa os documentos do TransfereGov e redige o termo de análise. Acompanhe pela janela.',
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
          'Nada é concluído sem o aval do gestor. Aprove uma a uma ou selecione várias — e o registro de quem decidiu fica.',
        acoes: [{ tipo: 'navegar', para: '/aprovacoes' }],
      },
      {
        titulo: 'Pergunte em português',
        narracao:
          'Não é um relatório para pedir ao setor de TI. É uma pergunta — e a Cleo consulta, responde e ainda executa o que você mandar.',
        acoes: [{ tipo: 'navegar', para: '/assistente' }],
      },
      {
        titulo: 'Tudo que a Cleo sabe',
        narracao:
          'Cada ponto é um registro do órgão; cada linha, uma relação real. Este é o conhecimento acumulado, e ele cresce a cada processo.',
        acoes: [{ tipo: 'navegar', para: '/cerebro' }],
      },
      {
        titulo: 'O que isso devolve',
        narracao:
          'Ponha o tempo que o seu órgão gasta hoje e veja a conta. O trabalho continua o mesmo — muda quem faz.',
        acoes: [{ tipo: 'navegar', para: '/ganho' }],
      },
    ]
  }, [orgaoId])

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
    if (params.has('apresentar')) {
      params.delete('apresentar')
      setParams(params, { replace: true })
    }
  }, [setApresentando, params, setParams])

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
      <div className="pointer-events-auto w-[min(920px,94vw)] rounded-2xl border border-gold/25 bg-surface/96 px-6 py-4 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-5">
          <div className="min-w-0 flex-1">
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

        {/* Trilha das cenas — a plateia vê quanto falta */}
        <div className="mt-3.5 flex gap-1">
          {roteiro.map((c, i) => (
            <button
              key={c.titulo}
              onClick={() => irPara(i)}
              aria-label={c.titulo}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                i < cena ? 'bg-gold/50' : i === cena ? 'bg-gold' : 'bg-line',
              )}
            />
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
