import { getProponente, propostasDoOrgao } from '@/data/repo'
import type { Proposta } from '@/data/types'
import { CONTRAPARTIDA_MINIMA } from './riscos'

/**
 * Padrões que só aparecem olhando a carteira inteira.
 *
 * Alerta de conformidade olha uma proposta por vez. Estes olham o conjunto: o
 * que se repete, o que se concentra e o que encosta exatamente no limite. Nada
 * aqui acusa ninguém — cada achado é um padrão a conferir, com as propostas que
 * o formaram à mão.
 */

export type TipoAnomalia =
  | 'propostas-irmas'
  | 'valor-repetido'
  | 'contrapartida-no-limite'
  | 'concentracao'
  | 'fracionamento'

export interface Anomalia {
  id: string
  tipo: TipoAnomalia
  titulo: string
  descricao: string
  /** O que olhar quando o padrão aparece. */
  oQueVerificar: string
  severidade: 'critico' | 'atencao' | 'informativo'
  propostas: Proposta[]
  valor: number
}

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\{[^}]*\}/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
}

export function detectarAnomalias(orgaoId: string): Anomalia[] {
  const propostas = propostasDoOrgao(orgaoId)
  const achados: Anomalia[] = []
  let n = 0

  /* 1. Propostas irmãs: mesmo objeto, valores próximos, proponentes diferentes. */
  const porObjeto = new Map<string, Proposta[]>()
  for (const p of propostas) {
    const chave = normalizar(p.objeto)
    if (!porObjeto.has(chave)) porObjeto.set(chave, [])
    porObjeto.get(chave)!.push(p)
  }
  for (const [, grupo] of porObjeto) {
    if (grupo.length < 3) continue
    const valores = grupo.map((p) => p.valorGlobal)
    const media = valores.reduce((s, v) => s + v, 0) / valores.length
    const proximos = grupo.filter((p) => Math.abs(p.valorGlobal - media) / media < 0.1)
    if (proximos.length < 3) continue
    // Os proponentes contados são os das propostas que de fato formaram o
    // padrão — contar o grupo inteiro infla o número e desmoraliza o achado.
    const proponentes = new Set(proximos.map((p) => p.proponenteId))
    if (proponentes.size < 3) continue
    achados.push({
      id: `an${++n}`,
      tipo: 'propostas-irmas',
      titulo: 'Propostas irmãs em municípios diferentes',
      descricao: `${proximos.length} propostas com o mesmo objeto e valor global dentro de 10% da média, apresentadas por ${proponentes.size} proponentes distintos.`,
      oQueVerificar:
        'Projeto básico replicado costuma indicar o mesmo escritório elaborando para vários municípios. Não é irregular por si; vira problema quando a planilha de custos também é idêntica.',
      severidade: 'atencao',
      propostas: proximos.sort((a, b) => b.valorGlobal - a.valorGlobal).slice(0, 8),
      valor: proximos.reduce((s, p) => s + p.valorGlobal, 0),
    })
  }

  /* 2. Valor global idêntico em propostas distintas. */
  const porValor = new Map<number, Proposta[]>()
  for (const p of propostas) {
    if (!porValor.has(p.valorGlobal)) porValor.set(p.valorGlobal, [])
    porValor.get(p.valorGlobal)!.push(p)
  }
  const repetidos = [...porValor.entries()]
    .filter(([, grupo]) => grupo.length >= 2)
    .sort((a, b) => b[1].length - a[1].length || b[0] - a[0])
    .slice(0, 3)
  for (const [valor, grupo] of repetidos) {
    achados.push({
      id: `an${++n}`,
      tipo: 'valor-repetido',
      titulo: 'Valor global idêntico repetido',
      descricao: `${grupo.length} propostas com exatamente o mesmo valor global de R$ ${valor.toLocaleString('pt-BR')}.`,
      oQueVerificar:
        'Valor redondo repetido em propostas diferentes costuma vir de teto de emenda, não de orçamento de obra. Conferir se a planilha de custos sustenta o valor.',
      severidade: 'informativo',
      propostas: grupo.slice(0, 8),
      valor: valor * grupo.length,
    })
  }

  /* 3. Contrapartida exatamente no mínimo exigido. */
  const noLimite = propostas.filter((p) => {
    const pct = p.valorContrapartida / p.valorGlobal
    return pct >= CONTRAPARTIDA_MINIMA && pct < CONTRAPARTIDA_MINIMA + 0.002
  })
  if (noLimite.length >= 3) {
    achados.push({
      id: `an${++n}`,
      tipo: 'contrapartida-no-limite',
      titulo: 'Contrapartida encostada no mínimo legal',
      descricao: `${noLimite.length} propostas com contrapartida entre ${(CONTRAPARTIDA_MINIMA * 100).toFixed(1)}% e ${((CONTRAPARTIDA_MINIMA + 0.002) * 100).toFixed(1)}% do valor global.`,
      oQueVerificar:
        'Contrapartida calculada de trás para frente, para bater o mínimo, indica capacidade financeira apertada. Vale olhar o histórico de execução do proponente.',
      severidade: 'atencao',
      propostas: noLimite.sort((a, b) => b.valorGlobal - a.valorGlobal).slice(0, 8),
      valor: noLimite.reduce((s, p) => s + p.valorGlobal, 0),
    })
  }

  /* 4. Concentração de valor em um único proponente. */
  const porProponente = new Map<string, Proposta[]>()
  for (const p of propostas) {
    if (!porProponente.has(p.proponenteId)) porProponente.set(p.proponenteId, [])
    porProponente.get(p.proponenteId)!.push(p)
  }
  const totalCarteira = propostas.reduce((s, p) => s + p.valorGlobal, 0)
  for (const [id, grupo] of porProponente) {
    const valor = grupo.reduce((s, p) => s + p.valorGlobal, 0)
    const fatia = totalCarteira > 0 ? valor / totalCarteira : 0
    if (fatia < 0.028 || grupo.length < 3) continue
    const proponente = getProponente(id)
    achados.push({
      id: `an${++n}`,
      tipo: 'concentracao',
      titulo: 'Concentração de recurso em um proponente',
      descricao: `${proponente?.nome ?? 'Proponente'} concentra ${(fatia * 100).toFixed(1)}% do valor da carteira do órgão em ${grupo.length} propostas.`,
      oQueVerificar:
        'Concentração não é vedada, mas pede olhar de capacidade: um mesmo município executando muitas obras ao mesmo tempo costuma atrasar todas.',
      severidade: fatia > 0.08 ? 'atencao' : 'informativo',
      propostas: grupo.sort((a, b) => b.valorGlobal - a.valorGlobal).slice(0, 8),
      valor,
    })
  }

  /* 5. Propostas fatiadas: mesmo proponente, mesmo programa, várias no mesmo período. */
  for (const [id, grupo] of porProponente) {
    const porPrograma = new Map<string, Proposta[]>()
    for (const p of grupo) {
      if (!porPrograma.has(p.programa)) porPrograma.set(p.programa, [])
      porPrograma.get(p.programa)!.push(p)
    }
    for (const [programa, doPrograma] of porPrograma) {
      if (doPrograma.length < 2) continue
      const meses = new Set(doPrograma.map((p) => p.dataCadastro.slice(0, 7)))
      if (meses.size > 3) continue
      const proponente = getProponente(id)
      achados.push({
        id: `an${++n}`,
        tipo: 'fracionamento',
        titulo: 'Propostas fatiadas no mesmo programa',
        descricao: `${doPrograma.length} propostas de ${proponente?.nome ?? 'um proponente'} no programa "${programa}", cadastradas em até três meses, somando ${(doPrograma.reduce((s, p) => s + p.valorGlobal, 0) / 1_000_000).toFixed(1).replace('.', ',')} milhões.`,
        oQueVerificar:
          'Objeto que poderia ser um só, dividido em várias propostas, muda a régua de análise aplicável. Conferir se os objetos são de fato independentes.',
        severidade: 'atencao',
        propostas: doPrograma.sort((a, b) => b.valorGlobal - a.valorGlobal),
        valor: doPrograma.reduce((s, p) => s + p.valorGlobal, 0),
      })
    }
  }

  const ordem: Record<Anomalia['severidade'], number> = { critico: 0, atencao: 1, informativo: 2 }
  return achados.sort((a, b) => ordem[a.severidade] - ordem[b.severidade] || b.valor - a.valor)
}
