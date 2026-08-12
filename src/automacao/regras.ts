import { getProponente, propostasDoOrgao } from '@/data/repo'
import type { CondicaoRegra, Proposta, RegraGatilho, TipoPasso } from '@/data/types'
import { diasParada } from '@/dominio/tempo'

/**
 * Regras de gatilho.
 *
 * "Quando a proposta entrar em análise e o valor passar de um milhão, execute o
 * rito X." A regra vale tanto quanto a pré-visualização: criar sem ver quantas
 * propostas ela pegaria hoje é assinar em branco.
 */

export const CAMPOS: { id: CondicaoRegra['campo']; rotulo: string; tipo: 'texto' | 'numero' | 'booleano' }[] = [
  { id: 'situacao', rotulo: 'Situação da proposta', tipo: 'texto' },
  { id: 'valorGlobal', rotulo: 'Valor global (R$)', tipo: 'numero' },
  { id: 'programa', rotulo: 'Programa', tipo: 'texto' },
  { id: 'uf', rotulo: 'UF do proponente', tipo: 'texto' },
  { id: 'diasParada', rotulo: 'Dias sem movimento', tipo: 'numero' },
  { id: 'temProcesso', rotulo: 'Tem processo no SEI', tipo: 'booleano' },
]

export const OPERADORES: { id: CondicaoRegra['operador']; rotulo: string }[] = [
  { id: 'igual', rotulo: 'é igual a' },
  { id: 'diferente', rotulo: 'é diferente de' },
  { id: 'maior', rotulo: 'é maior que' },
  { id: 'menor', rotulo: 'é menor que' },
  { id: 'contem', rotulo: 'contém' },
]

function valorDoCampo(p: Proposta, campo: CondicaoRegra['campo']): string | number | boolean {
  switch (campo) {
    case 'situacao':
      return p.situacao
    case 'valorGlobal':
      return p.valorGlobal
    case 'programa':
      return p.programa
    case 'uf':
      return getProponente(p.proponenteId)?.uf ?? ''
    case 'diasParada':
      return diasParada(p)
    case 'temProcesso':
      return !!p.numProcessoSei
  }
}

function atende(p: Proposta, c: CondicaoRegra): boolean {
  const atual = valorDoCampo(p, c.campo)
  const esperado = c.valor.trim()

  if (typeof atual === 'boolean') {
    const alvo = /^(sim|true|1)$/i.test(esperado)
    return c.operador === 'diferente' ? atual !== alvo : atual === alvo
  }

  if (typeof atual === 'number') {
    const alvo = Number(esperado.replace(/[^\d.-]/g, ''))
    if (Number.isNaN(alvo)) return false
    switch (c.operador) {
      case 'maior':
        return atual > alvo
      case 'menor':
        return atual < alvo
      case 'diferente':
        return atual !== alvo
      default:
        return atual === alvo
    }
  }

  const texto = atual.toLowerCase()
  const alvo = esperado.toLowerCase()
  switch (c.operador) {
    case 'contem':
      return texto.includes(alvo)
    case 'diferente':
      return texto !== alvo
    case 'maior':
      return texto > alvo
    case 'menor':
      return texto < alvo
    default:
      return texto === alvo
  }
}

/** Propostas que a regra pegaria se rodasse agora. */
export function avaliarRegra(regra: RegraGatilho, orgaoId: string): Proposta[] {
  const condicoes = regra.condicoes.filter((c) => c.valor.trim().length > 0)
  if (condicoes.length === 0) return []
  return propostasDoOrgao(orgaoId).filter((p) =>
    regra.juncao === 'todas'
      ? condicoes.every((c) => atende(p, c))
      : condicoes.some((c) => atende(p, c)),
  )
}

export function descreverRegra(regra: RegraGatilho): string {
  const juncao = regra.juncao === 'todas' ? ' e ' : ' ou '
  const partes = regra.condicoes
    .filter((c) => c.valor.trim().length > 0)
    .map((c) => {
      const campo = CAMPOS.find((x) => x.id === c.campo)?.rotulo ?? c.campo
      const operador = OPERADORES.find((x) => x.id === c.operador)?.rotulo ?? c.operador
      return `${campo.toLowerCase()} ${operador} ${c.valor}`
    })
  return partes.length ? `Quando ${partes.join(juncao)}` : 'Sem condição definida'
}

/* ---------- Agendamento ---------- */

const MS_DIA = 86_400_000

/**
 * Próxima execução da regra, em milissegundos a partir de agora.
 *
 * Usa o relógio do navegador de propósito: o contador precisa andar na tela
 * durante a apresentação, e a data de referência do dado é fixa.
 */
export function proximaExecucao(regra: RegraGatilho): number | undefined {
  if (regra.recorrencia === 'nenhuma' || !regra.ativa) return undefined
  const [hora, minuto] = regra.horario.split(':').map(Number)
  const agora = new Date()
  const alvo = new Date(agora)
  alvo.setHours(hora || 0, minuto || 0, 0, 0)

  if (regra.recorrencia === 'diaria') {
    if (alvo <= agora) alvo.setDate(alvo.getDate() + 1)
  } else if (regra.recorrencia === 'semanal') {
    // Segunda-feira: a fila da semana é montada no começo dela.
    const diasAteSegunda = (8 - alvo.getDay()) % 7 || 7
    if (alvo <= agora) alvo.setDate(alvo.getDate() + diasAteSegunda)
  } else {
    alvo.setDate(25)
    if (alvo <= agora) alvo.setMonth(alvo.getMonth() + 1)
  }

  return alvo.getTime() - agora.getTime()
}

export function formatarEspera(ms: number): string {
  const horas = Math.floor(ms / 3_600_000)
  const minutos = Math.floor((ms % 3_600_000) / 60_000)
  const segundos = Math.floor((ms % 60_000) / 1000)
  if (ms >= MS_DIA) return `${Math.floor(ms / MS_DIA)}d ${horas % 24}h`
  if (horas > 0) return `${horas}h ${String(minutos).padStart(2, '0')}min`
  return `${minutos}min ${String(segundos).padStart(2, '0')}s`
}

export const ROTULO_RECORRENCIA: Record<RegraGatilho['recorrencia'], string> = {
  nenhuma: 'Manual',
  diaria: 'Todo dia',
  semanal: 'Toda segunda',
  mensal: 'Todo dia 25',
}

/* ---------- Paleta do editor de ritos ---------- */

export const PASSOS_DISPONIVEIS: {
  tipo: TipoPasso
  rotulo: string
  descricao: string
  sistema: 'SEI' | 'TransfereGov' | 'Ambos'
  pedeParametro?: string
}[] = [
  {
    tipo: 'abrir_sistema',
    rotulo: 'Abrir sistema',
    descricao: 'Abre o sistema oficial no navegador da automação.',
    sistema: 'Ambos',
    pedeParametro: 'Sistema (SEI ou TransfereGov)',
  },
  {
    tipo: 'autenticar',
    rotulo: 'Autenticar',
    descricao: 'Entra com o usuário de serviço da unidade.',
    sistema: 'Ambos',
  },
  {
    tipo: 'buscar_processo',
    rotulo: 'Buscar processo',
    descricao: 'Localiza o processo ou a proposta pelo número.',
    sistema: 'Ambos',
  },
  {
    tipo: 'criar_processo',
    rotulo: 'Autuar processo',
    descricao: 'Inicia processo novo no SEI com o tipo escolhido.',
    sistema: 'SEI',
    pedeParametro: 'Tipo de processo',
  },
  {
    tipo: 'preencher_formulario',
    rotulo: 'Preencher formulário',
    descricao: 'Digita os campos a partir dos dados da proposta.',
    sistema: 'Ambos',
    pedeParametro: 'Campos a preencher',
  },
  {
    tipo: 'anexar_documento',
    rotulo: 'Anexar documento',
    descricao: 'Registra arquivo como documento externo do processo.',
    sistema: 'SEI',
    pedeParametro: 'Documento',
  },
  {
    tipo: 'gerar_documento',
    rotulo: 'Gerar documento de minuta',
    descricao: 'Cria o documento a partir de um modelo e preenche os campos calculados.',
    sistema: 'SEI',
    pedeParametro: 'Minuta',
  },
  {
    tipo: 'incluir_bloco',
    rotulo: 'Incluir em bloco',
    descricao: 'Coloca os documentos no bloco de assinatura da unidade.',
    sistema: 'SEI',
    pedeParametro: 'Bloco',
  },
  {
    tipo: 'assinar',
    rotulo: 'Assinar',
    descricao: 'Assina eletronicamente com o certificado da unidade.',
    sistema: 'SEI',
  },
  {
    tipo: 'notificar',
    rotulo: 'Notificar',
    descricao: 'Avisa a pessoa responsável dentro da Cleopatra.',
    sistema: 'Ambos',
    pedeParametro: 'Destinatário',
  },
  {
    tipo: 'aguardar',
    rotulo: 'Aguardar',
    descricao: 'Espera o tempo definido antes do passo seguinte.',
    sistema: 'Ambos',
    pedeParametro: 'Tempo de espera',
  },
]

/** Gatilhos que a simulação reproduz para um conjunto de passos montado na tela. */
export function inferirFila(tipos: TipoPasso[]) {
  const fila: string[] = []
  for (const t of tipos) {
    if (t === 'criar_processo') fila.push('criar_processo')
    else if (t === 'anexar_documento') fila.push('anexar_extrato_proposta')
    else if (t === 'gerar_documento') fila.push('criar_documento')
    else if (t === 'incluir_bloco') fila.push('adicionar_bloco_interno')
  }
  return (fila.length ? [...new Set(fila)] : ['criar_documento']) as import('@/data/types').Gatilho[]
}
