import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Compass, X } from 'lucide-react'
import { useApp } from '@/store/app'
import { cn } from '@/lib/format'
import { Botao, Panel } from '@/components/ui'

interface Parada {
  rota: string
  titulo: string
  texto: string
}

/**
 * Tour guiado.
 *
 * Existe para o caso em que ninguém está apresentando: alguém abre o link, e a
 * plataforma se explica. Aparece uma vez, é saltável e volta com Ctrl+Shift+T.
 */
const PARADAS: Parada[] = [
  {
    rota: '/',
    titulo: 'O painel é a carteira inteira',
    texto:
      'Valor, trâmite, empenho e território do órgão em uma tela. Tudo aqui vem do que foi sincronizado do TransfereGov e do SEI.',
  },
  {
    rota: '/meu-dia',
    titulo: 'A fila responde "por onde começo"',
    texto:
      'Doze propostas ordenadas por risco, prazo consumido e valor — nessa ordem de peso. Cada uma já vem com a próxima ação pronta para executar.',
  },
  {
    rota: '/propostas/pr1',
    titulo: 'A proposta é um dossiê, não um formulário',
    texto:
      'Saúde da instrução, alertas de conformidade com a regra à vista, emenda de origem, prazos legais e o histórico completo.',
  },
  {
    rota: '/emendas',
    titulo: 'O dinheiro tem autor',
    texto:
      'A carteira organizada por quem cobra: quanto foi indicado, quanto virou empenho e quantas propostas estão paradas em cada gabinete.',
  },
  {
    rota: '/orcamento',
    titulo: 'O funil e o relógio de dezembro',
    texto:
      'Dotação, empenho, liquidação e pagamento — com o nome do que sobra em cada degrau e o ritmo necessário para não devolver recurso.',
  },
  {
    rota: '/ritos',
    titulo: 'Qualquer automação, sem código',
    texto:
      'Ritos são montados arrastando passos, viram regra ("quando X, faça Y") e rodam em lote ou agendados. Tudo simulado nesta plataforma.',
  },
  {
    rota: '/cerebro',
    titulo: 'O Cérebro liga tudo',
    texto:
      'Órgão, programa, proponente, proposta e documento no mesmo grafo. As histórias guiadas explicam cada recorte sozinhas.',
  },
  {
    rota: '/assistente',
    titulo: 'O assistente opera a interface',
    texto:
      'Pergunte em português. Ele responde com número, tabela e gráfico — e executa a ação na tela, em vez de descrever o que faria.',
  },
]

export function Tour() {
  const { tourVisto, marcarTourVisto } = useApp()
  const navegar = useNavigate()
  const { pathname } = useLocation()
  const [aberto, setAberto] = useState(false)
  const [passo, setPasso] = useState(0)

  useEffect(() => {
    // Só se oferece na entrada pela porta da frente. Quem chegou por link
    // direto veio buscar aquela tela — arrastá-lo para o começo seria rude.
    if (!tourVisto && pathname === '/') {
      const t = setTimeout(() => setAberto(true), 1400)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourVisto])

  useEffect(() => {
    function atalho(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault()
        setPasso(0)
        setAberto(true)
      }
    }
    window.addEventListener('keydown', atalho)
    return () => window.removeEventListener('keydown', atalho)
  }, [])

  const encerrar = useCallback(() => {
    setAberto(false)
    marcarTourVisto()
  }, [marcarTourVisto])

  useEffect(() => {
    if (aberto) navegar(PARADAS[passo].rota)
  }, [aberto, passo, navegar])

  if (!aberto) return null
  const parada = PARADAS[passo]
  const ultimo = passo === PARADAS.length - 1

  return (
    <div className="nao-imprimir fixed right-6 bottom-6 z-40 w-[380px]">
      <Panel className="overflow-hidden bg-surface shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Compass size={14} className="text-cleo" />
            <span className="eyebrow">
              Tour · {passo + 1} de {PARADAS.length}
            </span>
          </div>
          <button onClick={encerrar} className="text-faint hover:text-ink" aria-label="Fechar tour">
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4">
          <h3 className="mb-2 text-[15px]">{parada.titulo}</h3>
          <p className="text-[12.5px] leading-relaxed text-muted">{parada.texto}</p>
        </div>

        <div className="flex items-center gap-1.5 px-5 pb-3">
          {PARADAS.map((_, i) => (
            <button
              key={i}
              onClick={() => setPasso(i)}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                i === passo ? 'bg-cleo' : i < passo ? 'bg-cleo/35' : 'bg-line',
              )}
              aria-label={`Ir para a parada ${i + 1}`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3">
          <button onClick={encerrar} className="text-[12px] text-faint hover:text-muted">
            Pular tour
          </button>
          <div className="flex gap-2">
            {passo > 0 && (
              <Botao tamanho="sm" variante="fantasma" onClick={() => setPasso((p) => p - 1)}>
                Voltar
              </Botao>
            )}
            <Botao
              tamanho="sm"
              variante="primario"
              onClick={() => (ultimo ? encerrar() : setPasso((p) => p + 1))}
            >
              {ultimo ? 'Concluir' : 'Próxima'} <ArrowRight size={11} />
            </Botao>
          </div>
        </div>
      </Panel>
      <p className="mt-2 text-right text-[10.5px] text-faint">Ctrl+Shift+T reabre o tour</p>
    </div>
  )
}
