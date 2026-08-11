import type { Gatilho, Proposta } from '@/data/types'
import { diasParada } from '@/assistente/motor'

/**
 * Saúde da proposta e próxima ação.
 *
 * O objetivo não é dar nota: é responder a única pergunta que o analista tem ao
 * abrir a tela — "o que falta aqui, e o que eu faço agora?".
 */

export interface Pendencia {
  rotulo: string
  peso: number
  resolvida: boolean
}

export interface Saude {
  pontos: number
  faixa: 'boa' | 'atencao' | 'critica'
  rotulo: string
  pendencias: Pendencia[]
  diasParada: number
}

export function avaliar(proposta: Proposta, gatilhosFeitos: Set<Gatilho>): Saude {
  const obrigatoriosOk = proposta.checklist.filter((c) => c.obrigatorio && c.concluido).length
  const obrigatorios = proposta.checklist.filter((c) => c.obrigatorio).length
  const parada = diasParada(proposta)
  const temProcesso = !!proposta.numProcessoSei || gatilhosFeitos.has('criar_processo')
  const temExtrato =
    proposta.documentos.some((d) => d.tipo.includes('Extrato')) ||
    gatilhosFeitos.has('anexar_extrato_proposta')
  const temAnalise = proposta.documentos.some(
    (d) => d.tipo.includes('Termo') || d.tipo.includes('Parecer'),
  )
  const assinaturaPendente = proposta.documentos.some((d) => !d.assinado)

  const pendencias: Pendencia[] = [
    {
      rotulo: 'Documentação obrigatória completa',
      peso: 28,
      resolvida: obrigatorios > 0 && obrigatoriosOk === obrigatorios,
    },
    { rotulo: 'Processo autuado no SEI', peso: 22, resolvida: temProcesso },
    { rotulo: 'Extrato da proposta anexado', peso: 16, resolvida: temExtrato },
    { rotulo: 'Análise técnica registrada', peso: 18, resolvida: temAnalise },
    { rotulo: 'Sem documento aguardando assinatura', peso: 8, resolvida: !assinaturaPendente },
    { rotulo: 'Movimentada nos últimos 30 dias', peso: 8, resolvida: parada <= 30 },
  ]

  const pontos = Math.round(
    pendencias.reduce((s, p) => s + (p.resolvida ? p.peso : 0), 0),
  )

  const faixa: Saude['faixa'] = pontos >= 78 ? 'boa' : pontos >= 45 ? 'atencao' : 'critica'
  const rotulo =
    faixa === 'boa'
      ? 'Instrução em dia'
      : faixa === 'atencao'
        ? 'Instrução incompleta'
        : 'Instrução parada'

  return { pontos, faixa, rotulo, pendencias, diasParada: parada }
}

export interface ProximaAcao {
  titulo: string
  porque: string
  gatilho?: Gatilho
  rito?: Gatilho[]
}

export function proximaAcao(proposta: Proposta, gatilhosFeitos: Set<Gatilho>): ProximaAcao {
  const temProcesso = !!proposta.numProcessoSei || gatilhosFeitos.has('criar_processo')

  if (!temProcesso) {
    return {
      titulo: 'Instruir a proposta do começo ao fim',
      porque:
        'Ainda não há processo no SEI. A Cleo autua, anexa o extrato e as contrapartidas e redige o termo de análise, na ordem certa.',
      rito: [
        'criar_processo',
        'anexar_extrato_proposta',
        'anexar_contrapartidas',
        'criar_documento',
      ],
    }
  }

  const temExtrato =
    proposta.documentos.some((d) => d.tipo.includes('Extrato')) ||
    gatilhosFeitos.has('anexar_extrato_proposta')
  if (!temExtrato) {
    return {
      titulo: 'Anexar o extrato da proposta',
      porque:
        'O processo existe, mas o extrato do TransfereGov ainda não foi registrado como documento externo.',
      gatilho: 'anexar_extrato_proposta',
    }
  }

  const faltamObrigatorios = proposta.checklist.some((c) => c.obrigatorio && !c.concluido)
  if (faltamObrigatorios) {
    return {
      titulo: 'Solicitar complementação ao proponente',
      porque:
        'Há item obrigatório pendente no checklist de habilitação. A Cleo gera o ofício com os itens que faltam.',
      gatilho: 'criar_documento',
    }
  }

  const temAnalise = proposta.documentos.some(
    (d) => d.tipo.includes('Termo') || d.tipo.includes('Parecer'),
  )
  if (!temAnalise) {
    return {
      titulo: 'Gerar o termo de análise',
      porque:
        'A documentação está completa e o processo instruído. Falta registrar a análise técnica.',
      gatilho: 'criar_documento',
    }
  }

  return {
    titulo: 'Encaminhar para assinatura',
    porque:
      'A instrução está completa. Inclua o processo no bloco de assinatura da unidade para a decisão do gestor.',
    gatilho: 'adicionar_bloco_interno',
  }
}
