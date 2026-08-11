import { useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '@/store/app'
import type { Acao } from './tipos'

/** Pausa entre ações para a plateia acompanhar o que está acontecendo. */
const RESPIRO_MS = 750

/**
 * Executa uma sequência de ações contra a interface real.
 *
 * A pessoa vê a plataforma se mover: a rota muda, o filtro se aplica, a proposta
 * abre, a automação dispara. Nada é descrito em texto — tudo acontece.
 */
export function useExecutor() {
  const navegar = useNavigate()
  const { setFiltroPropostas, abrirExecucao, setFocoCerebro, setRastro } = useApp()
  const cancelado = useRef(false)

  const dormir = (ms: number) =>
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, ms)
    })

  const executar = useCallback(
    async (acoes: Acao[], opcoes?: { silencioso?: boolean }) => {
      cancelado.current = false

      for (const acao of acoes) {
        if (cancelado.current) break

        if (!opcoes?.silencioso && 'motivo' in acao && acao.motivo) {
          setRastro({ rotulo: acao.motivo })
        }

        switch (acao.tipo) {
          case 'navegar':
            navegar(acao.para)
            break

          case 'filtrar-propostas':
            setFiltroPropostas(acao.filtro)
            navegar('/propostas')
            break

          case 'abrir-proposta':
            navegar(`/propostas/${acao.propostaId}${acao.aba ? `?aba=${acao.aba}` : ''}`)
            break

          case 'executar-automacao':
            abrirExecucao({ propostaId: acao.propostaId, fila: [acao.gatilho] })
            break

          case 'executar-rito':
            abrirExecucao({
              propostaId: acao.propostaId,
              fila: acao.gatilhos,
              titulo: 'Rito completo de instrução',
            })
            break

          case 'focar-no-cerebro':
            setFocoCerebro(acao.noId)
            navegar('/cerebro')
            break

          case 'destacar':
            setRastro({ rotulo: acao.rotulo })
            break

          case 'esperar':
            await dormir(acao.ms)
            continue
        }

        await dormir(RESPIRO_MS)
      }

      if (!opcoes?.silencioso) {
        // O rastro some sozinho: ele narra, não permanece.
        window.setTimeout(() => setRastro(null), 2200)
      }
    },
    [navegar, setFiltroPropostas, abrirExecucao, setFocoCerebro, setRastro],
  )

  const cancelar = useCallback(() => {
    cancelado.current = true
    setRastro(null)
  }, [setRastro])

  return { executar, cancelar }
}
