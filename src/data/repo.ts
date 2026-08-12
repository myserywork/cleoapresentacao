import { ORGAOS } from './catalogs'
import { APROVACOES, AUTOMACOES, MINUTAS, PROPONENTES, PROPOSTAS, USUARIOS } from './generate'
import {
  ACOES,
  AUDITORIA,
  DILIGENCIAS,
  EMENDAS,
  EQUIPE,
  EXTENSOES,
  PARLAMENTARES,
  REGRAS_FABRICA,
  RITOS_FABRICA,
} from './extensoes'
import type {
  AcaoOrcamentaria,
  Analista,
  Automacao,
  Diligencia,
  Emenda,
  Extensao,
  Parlamentar,
  Proponente,
  Proposta,
  SituacaoProposta,
} from './types'

/**
 * Ponto único de acesso a dado. Todas as telas leem daqui — trocar a origem por
 * uma API real significa reimplementar este módulo, e mais nada.
 */

export { ORGAOS, MINUTAS, USUARIOS, PROPONENTES, PROPOSTAS, AUTOMACOES, APROVACOES }
export {
  ACOES,
  AUDITORIA,
  DILIGENCIAS,
  EMENDAS,
  EQUIPE,
  EXTENSOES,
  PARLAMENTARES,
  REGRAS_FABRICA,
  RITOS_FABRICA,
}

const proponentePorId = new Map(PROPONENTES.map((p) => [p.id, p]))
const propostaPorId = new Map(PROPOSTAS.map((p) => [p.id, p]))
const parlamentarPorId = new Map(PARLAMENTARES.map((p) => [p.id, p]))
const emendaPorId = new Map(EMENDAS.map((e) => [e.id, e]))
const acaoPorId = new Map(ACOES.map((a) => [a.id, a]))
const analistaPorId = new Map(EQUIPE.map((a) => [a.id, a]))

export function getProponente(id: string): Proponente | undefined {
  return proponentePorId.get(id)
}

export function getProposta(id: string): Proposta | undefined {
  return propostaPorId.get(id)
}

export function getOrgao(id: string) {
  return ORGAOS.find((o) => o.id === id)
}

export function propostasDoOrgao(orgaoId: string): Proposta[] {
  return PROPOSTAS.filter((p) => p.orgaoId === orgaoId)
}

export function automacoesDoOrgao(orgaoId: string): Automacao[] {
  const ids = new Set(propostasDoOrgao(orgaoId).map((p) => p.id))
  return AUTOMACOES.filter((a) => ids.has(a.propostaId))
}

export function aprovacoesDoOrgao(orgaoId: string) {
  const ids = new Set(propostasDoOrgao(orgaoId).map((p) => p.id))
  return APROVACOES.filter((a) => ids.has(a.propostaId))
}

export function automacoesDaProposta(propostaId: string): Automacao[] {
  return AUTOMACOES.filter((a) => a.propostaId === propostaId)
}

/* ---------- Agregações do painel ---------- */

export interface ResumoOrgao {
  totalPropostas: number
  valorGlobal: number
  valorRepasse: number
  valorContrapartida: number
  totalEmpenhado: number
  qtdEmpenhos: number
  processosSei: number
  documentosGerados: number
  automacoesExecutadas: number
  horasEconomizadas: number
  porSituacao: { situacao: SituacaoProposta; qtd: number; valor: number }[]
  porUf: { uf: string; qtd: number; valor: number }[]
  porPrograma: { programa: string; qtd: number; valor: number }[]
  serieMensal: { mes: string; qtd: number; valor: number }[]
}

const ORDEM_SITUACAO: SituacaoProposta[] = [
  'Cadastrada',
  'Em análise',
  'Em complementação',
  'Aprovada',
  'Convênio celebrado',
  'Em execução',
  'Prestação de contas',
  'Rejeitada',
]

/** Minutos de trabalho manual que cada gatilho substitui, medidos com os analistas. */
const MINUTOS_POR_GATILHO: Record<string, number> = {
  criar_processo: 12,
  adicionar_bloco_interno: 5,
  anexar_extrato_proposta: 9,
  anexar_contrapartidas: 9,
  anexar_capacidades_tecnicas: 9,
  criar_documento: 22,
}

/**
 * @param mesesAtras recorte de período pela data de cadastro; ausente = tudo.
 */
export function resumoOrgao(orgaoId: string, mesesAtras?: number): ResumoOrgao {
  const corte = mesesAtras
    ? new Date(Date.now() - mesesAtras * 30 * 86_400_000).toISOString()
    : undefined
  const propostas = propostasDoOrgao(orgaoId).filter(
    (p) => !corte || p.dataCadastro >= corte,
  )
  const idsNoPeriodo = new Set(propostas.map((p) => p.id))
  const automacoes = automacoesDoOrgao(orgaoId).filter(
    (a) => a.status === 'SUCESSO' && idsNoPeriodo.has(a.propostaId),
  )

  const porSituacaoMap = new Map<SituacaoProposta, { qtd: number; valor: number }>()
  const porUfMap = new Map<string, { qtd: number; valor: number }>()
  const porProgramaMap = new Map<string, { qtd: number; valor: number }>()
  const serieMap = new Map<string, { qtd: number; valor: number }>()

  let valorGlobal = 0
  let valorRepasse = 0
  let valorContrapartida = 0
  let totalEmpenhado = 0
  let qtdEmpenhos = 0
  let processosSei = 0
  let documentosGerados = 0

  for (const p of propostas) {
    valorGlobal += p.valorGlobal
    valorRepasse += p.valorRepasse
    valorContrapartida += p.valorContrapartida
    if (p.numProcessoSei) processosSei++
    documentosGerados += p.documentos.filter((d) => d.geradoPelaCleo).length
    for (const e of p.empenhos) {
      totalEmpenhado += e.valor
      qtdEmpenhos++
    }

    const s = porSituacaoMap.get(p.situacao) ?? { qtd: 0, valor: 0 }
    porSituacaoMap.set(p.situacao, { qtd: s.qtd + 1, valor: s.valor + p.valorGlobal })

    const uf = getProponente(p.proponenteId)?.uf ?? '—'
    const u = porUfMap.get(uf) ?? { qtd: 0, valor: 0 }
    porUfMap.set(uf, { qtd: u.qtd + 1, valor: u.valor + p.valorGlobal })

    const pr = porProgramaMap.get(p.programa) ?? { qtd: 0, valor: 0 }
    porProgramaMap.set(p.programa, { qtd: pr.qtd + 1, valor: pr.valor + p.valorGlobal })

    const mes = p.dataCadastro.slice(0, 7)
    const m = serieMap.get(mes) ?? { qtd: 0, valor: 0 }
    serieMap.set(mes, { qtd: m.qtd + 1, valor: m.valor + p.valorGlobal })
  }

  const minutos = automacoes.reduce((s, a) => s + (MINUTOS_POR_GATILHO[a.gatilho] ?? 10), 0)

  return {
    totalPropostas: propostas.length,
    valorGlobal,
    valorRepasse,
    valorContrapartida,
    totalEmpenhado,
    qtdEmpenhos,
    processosSei,
    documentosGerados,
    automacoesExecutadas: automacoes.length,
    horasEconomizadas: Math.round(minutos / 60),
    porSituacao: ORDEM_SITUACAO.map((situacao) => ({
      situacao,
      qtd: porSituacaoMap.get(situacao)?.qtd ?? 0,
      valor: porSituacaoMap.get(situacao)?.valor ?? 0,
    })),
    porUf: [...porUfMap.entries()]
      .map(([uf, v]) => ({ uf, ...v }))
      .sort((a, b) => b.valor - a.valor),
    porPrograma: [...porProgramaMap.entries()]
      .map(([programa, v]) => ({ programa, ...v }))
      .sort((a, b) => b.valor - a.valor),
    serieMensal: [...serieMap.entries()]
      .map(([mes, v]) => ({ mes, ...v }))
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .slice(-18),
  }
}

/* ---------- Segunda camada: emenda, orçamento, equipe, diligência ---------- */

export function extensaoDa(propostaId: string): Extensao | undefined {
  return EXTENSOES.get(propostaId)
}

export function getParlamentar(id: string): Parlamentar | undefined {
  return parlamentarPorId.get(id)
}

export function getEmenda(id: string): Emenda | undefined {
  return emendaPorId.get(id)
}

export function getAcao(id: string): AcaoOrcamentaria | undefined {
  return acaoPorId.get(id)
}

export function getAnalista(id: string): Analista | undefined {
  return analistaPorId.get(id)
}

export function emendaDaProposta(propostaId: string): Emenda | undefined {
  const id = EXTENSOES.get(propostaId)?.emendaId
  return id ? emendaPorId.get(id) : undefined
}

export function parlamentarDaProposta(propostaId: string): Parlamentar | undefined {
  const emenda = emendaDaProposta(propostaId)
  return emenda?.parlamentarId ? parlamentarPorId.get(emenda.parlamentarId) : undefined
}

export function responsavelDaProposta(propostaId: string): Analista | undefined {
  const id = EXTENSOES.get(propostaId)?.responsavelId
  return id ? analistaPorId.get(id) : undefined
}

export function emendasDoOrgao(orgaoId: string): Emenda[] {
  return EMENDAS.filter((e) => e.orgaoId === orgaoId)
}

export function acoesDoOrgao(orgaoId: string): AcaoOrcamentaria[] {
  return ACOES.filter((a) => a.orgaoId === orgaoId)
}

export function equipeDoOrgao(orgaoId: string): Analista[] {
  return EQUIPE.filter((a) => a.orgaoId === orgaoId)
}

/** Índice proposta → emenda montado uma vez; a listagem por emenda é frequente. */
const propostasPorEmenda = (() => {
  const mapa = new Map<string, Proposta[]>()
  for (const p of PROPOSTAS) {
    const id = EXTENSOES.get(p.id)?.emendaId
    if (!id) continue
    if (!mapa.has(id)) mapa.set(id, [])
    mapa.get(id)!.push(p)
  }
  return mapa
})()

export function propostasDaEmenda(emendaId: string): Proposta[] {
  return propostasPorEmenda.get(emendaId) ?? []
}

export function propostasDoParlamentar(parlamentarId: string, orgaoId?: string): Proposta[] {
  const emendas = EMENDAS.filter(
    (e) => e.parlamentarId === parlamentarId && (!orgaoId || e.orgaoId === orgaoId),
  )
  return emendas.flatMap((e) => propostasDaEmenda(e.id))
}

export function propostasDoAnalista(analistaId: string): Proposta[] {
  return PROPOSTAS.filter((p) => EXTENSOES.get(p.id)?.responsavelId === analistaId)
}

export function propostasDoProponente(proponenteId: string): Proposta[] {
  return PROPOSTAS.filter((p) => p.proponenteId === proponenteId)
}

export function diligenciasDaProposta(propostaId: string): Diligencia[] {
  return DILIGENCIAS.filter((d) => d.propostaId === propostaId)
}

export function diligenciasDoOrgao(orgaoId: string): Diligencia[] {
  const ids = new Set(propostasDoOrgao(orgaoId).map((p) => p.id))
  return DILIGENCIAS.filter((d) => ids.has(d.propostaId))
}

export function auditoriaDoOrgao(orgaoId: string) {
  const ids = new Set(propostasDoOrgao(orgaoId).map((p) => p.id))
  return AUDITORIA.filter((e) => !e.propostaId || ids.has(e.propostaId))
}

/* ---------- Busca ---------- */

export function buscarPropostas(
  orgaoId: string,
  termo: string,
  filtros?: { situacao?: SituacaoProposta[]; uf?: string[] },
): Proposta[] {
  const t = termo.trim().toLowerCase()
  return propostasDoOrgao(orgaoId).filter((p) => {
    if (filtros?.situacao?.length && !filtros.situacao.includes(p.situacao)) return false
    const prop = getProponente(p.proponenteId)
    if (filtros?.uf?.length && (!prop || !filtros.uf.includes(prop.uf))) return false
    if (!t) return true
    return (
      p.numero.toLowerCase().includes(t) ||
      p.objeto.toLowerCase().includes(t) ||
      p.programa.toLowerCase().includes(t) ||
      (p.numProcessoSei ?? '').toLowerCase().includes(t) ||
      (prop?.nome ?? '').toLowerCase().includes(t) ||
      (prop?.uf ?? '').toLowerCase() === t
    )
  })
}
