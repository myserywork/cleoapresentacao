import { automacoesDaProposta, extensaoDa, getProposta, propostasDoOrgao } from '@/data/repo'
import type { Aprovacao, Gatilho, Proposta } from '@/data/types'
import { HOJE } from '@/data/extensoes'
import { alertas, prazo } from './riscos'
import { avaliar } from './saude'
import { scoreProponente } from './proponentes'
import { CICLO, faseAtual } from './ciclo'
import { diasParada } from './tempo'

/**
 * Recomendação da Cleo.
 *
 * Uma recomendação sem os fatos que a produziram é adivinhação com aparência de
 * autoridade. Aqui toda saída carrega a lista de fatos e o grau de confiança, e
 * a decisão continua sendo do gestor — a Cleo só chega com a análise pronta.
 */

export type Decisao = 'aprovar' | 'verificar' | 'recusar'

export interface Fato {
  rotulo: string
  valor: string
  tom: 'teal' | 'gold' | 'alert' | 'inert' | 'cleo'
}

export interface Recomendacao {
  decisao: Decisao
  rotulo: string
  frase: string
  fatos: Fato[]
  /** 0..1 — quanto os fatos convergem. Confiança baixa é convite a olhar. */
  confianca: number
}

const ROTULO: Record<Decisao, string> = {
  aprovar: 'Recomenda aprovar',
  verificar: 'Recomenda verificar antes',
  recusar: 'Recomenda recusar',
}

export function recomendar(aprovacao: Aprovacao): Recomendacao | undefined {
  const proposta = getProposta(aprovacao.propostaId)
  if (!proposta) return undefined

  const lista = alertas(proposta)
  const criticos = lista.filter((a) => a.severidade === 'critico')
  const atencao = lista.filter((a) => a.severidade === 'atencao')
  const p = prazo(proposta)
  const feitos = new Set<Gatilho>(
    automacoesDaProposta(proposta.id)
      .filter((a) => a.status === 'SUCESSO')
      .map((a) => a.gatilho),
  )
  const saude = avaliar(proposta, feitos)
  const score = scoreProponente(proposta.proponenteId)

  const fatos: Fato[] = [
    {
      rotulo: 'Saúde da instrução',
      valor: `${saude.pontos}/100 — ${saude.rotulo.toLowerCase()}`,
      tom: saude.faixa === 'boa' ? 'teal' : saude.faixa === 'atencao' ? 'gold' : 'alert',
    },
    {
      rotulo: 'Alertas de conformidade',
      valor:
        criticos.length > 0
          ? `${criticos.length} crítico(s): ${criticos[0].rotulo.toLowerCase()}`
          : atencao.length > 0
            ? `${atencao.length} de atenção`
            : 'Nenhum',
      tom: criticos.length > 0 ? 'alert' : atencao.length > 0 ? 'gold' : 'teal',
    },
    {
      rotulo: 'Prazo da fase',
      valor: p.estourado
        ? `${p.decorrido - p.limite} dias além do limite de ${p.limite}`
        : `${Math.max(p.restante, 0)} dias restantes`,
      tom: p.estourado ? 'alert' : p.consumo > 0.7 ? 'gold' : 'teal',
    },
  ]

  if (score) {
    fatos.push({
      rotulo: 'Capacidade do proponente',
      valor: `${score.pontos}/100 — ${score.rotulo.toLowerCase()}`,
      tom: score.faixa === 'alta' ? 'teal' : score.faixa === 'media' ? 'gold' : 'alert',
    })
    if (score.historico.inadimplente) {
      fatos.push({
        rotulo: 'Inadimplência',
        valor: `${score.historico.prestacoesAtrasadas} prestação(ões) pendente(s)`,
        tom: 'alert',
      })
    }
  }

  const emenda = extensaoDa(proposta.id)?.emendaId
  if (emenda) {
    fatos.push({
      rotulo: 'Origem do recurso',
      valor: 'Emenda parlamentar vinculada',
      tom: 'cleo',
    })
  }

  // Correção de repasse tem regra própria: o que importa é o tamanho do ajuste.
  if (aprovacao.tipo === 'corrigir_repasse' && aprovacao.valorAtual && aprovacao.valorSugerido) {
    const delta = (aprovacao.valorSugerido - aprovacao.valorAtual) / aprovacao.valorAtual
    fatos.push({
      rotulo: 'Ajuste solicitado',
      valor: `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)}% sobre o repasse atual`,
      tom: Math.abs(delta) > 0.1 ? 'alert' : Math.abs(delta) > 0.05 ? 'gold' : 'teal',
    })
    if (Math.abs(delta) > 0.1) {
      return {
        decisao: 'verificar',
        rotulo: ROTULO.verificar,
        frase:
          'O ajuste passa de 10% do repasse pactuado. Convém conferir o plano de trabalho antes de homologar a correção.',
        fatos,
        confianca: 0.82,
      }
    }
  }

  if (score?.historico.inadimplente) {
    return {
      decisao: 'verificar',
      rotulo: ROTULO.verificar,
      frase:
        'O proponente está inadimplente em prestação de contas. Aprovar agora esbarra na vedação a nova transferência antes da regularização.',
      fatos,
      confianca: 0.9,
    }
  }

  if (criticos.length >= 2) {
    return {
      decisao: 'recusar',
      rotulo: ROTULO.recusar,
      frase: `${criticos.length} alertas críticos abertos ao mesmo tempo — ${criticos
        .map((c) => c.rotulo.toLowerCase())
        .join(' e ')}. Devolver para saneamento custa menos que corrigir depois de celebrado.`,
      fatos,
      confianca: 0.88,
    }
  }

  if (criticos.length === 1) {
    return {
      decisao: 'verificar',
      rotulo: ROTULO.verificar,
      frase: `Um alerta crítico impede a aprovação direta: ${criticos[0].detalhe}`,
      fatos,
      confianca: 0.85,
    }
  }

  if (saude.faixa === 'boa' && !p.estourado) {
    return {
      decisao: 'aprovar',
      rotulo: ROTULO.aprovar,
      frase:
        'Instrução completa, sem alerta crítico e dentro do prazo da fase. É o perfil que a coordenação aprova sem ressalva.',
      fatos,
      confianca: 0.93,
    }
  }

  if (saude.faixa === 'critica') {
    return {
      decisao: 'verificar',
      rotulo: ROTULO.verificar,
      frase: `A instrução está em ${saude.pontos}/100: falta ${saude.pendencias
        .filter((x) => !x.resolvida)
        .slice(0, 2)
        .map((x) => x.rotulo.toLowerCase())
        .join(' e ')}.`,
      fatos,
      confianca: 0.79,
    }
  }

  return {
    decisao: 'aprovar',
    rotulo: ROTULO.aprovar,
    frase:
      'Sem alerta crítico e com a instrução em nível aceitável. Os pontos de atenção não impedem a decisão.',
    fatos,
    confianca: 0.71,
  }
}

/* ---------- Previsão de conclusão ---------- */

export interface Previsao {
  /** Dias medianos até a celebração, no histórico do órgão. */
  diasMediana: number
  diasOtimista: number
  diasPessimista: number
  dataProvavel: string
  fasesRestantes: string[]
  base: string
}

/**
 * Tempo mediano observado em cada fase, por órgão. Vem do dado que está na tela
 * — dias sem movimento das propostas hoje naquela fase — e não de uma constante
 * escolhida a dedo.
 */
const medianasPorOrgao = new Map<string, Map<string, number>>()

function medianaDaFase(orgaoId: string, fase: string): number {
  let cache = medianasPorOrgao.get(orgaoId)
  if (!cache) {
    cache = new Map()
    const porFase = new Map<string, number[]>()
    for (const p of propostasDoOrgao(orgaoId)) {
      const indice = faseAtual(p.situacao)
      if (indice < 0) continue
      const id = CICLO[indice].id
      if (!porFase.has(id)) porFase.set(id, [])
      porFase.get(id)!.push(diasParada(p))
    }
    for (const [id, valores] of porFase) {
      const ordenado = [...valores].sort((a, b) => a - b)
      const meio = Math.floor(ordenado.length / 2)
      cache.set(
        id,
        ordenado.length % 2 ? ordenado[meio] : (ordenado[meio - 1] + ordenado[meio]) / 2,
      )
    }
    medianasPorOrgao.set(orgaoId, cache)
  }
  return cache.get(fase) ?? 30
}

export function preverConclusao(proposta: Proposta): Previsao | undefined {
  const indice = faseAtual(proposta.situacao)
  // Só faz sentido prever antes da celebração: depois disso o prazo é a vigência.
  if (indice < 0 || indice >= 3) return undefined

  const restantes = CICLO.slice(indice, 4)
  const dias = restantes.reduce((s, f) => s + medianaDaFase(proposta.orgaoId, f.id), 0)
  const jaNaFase = diasParada(proposta)
  const mediana = Math.max(Math.round(dias - jaNaFase), 7)

  const provavel = new Date(HOJE)
  provavel.setDate(provavel.getDate() + mediana)

  return {
    diasMediana: mediana,
    diasOtimista: Math.round(mediana * 0.6),
    diasPessimista: Math.round(mediana * 1.8),
    dataProvavel: provavel.toISOString(),
    fasesRestantes: restantes.map((f) => f.rotulo),
    base: `Mediana observada nas ${restantes.length} fases restantes das propostas do órgão hoje.`,
  }
}
