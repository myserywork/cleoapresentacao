import { getOrgao, getProponente } from '@/data/repo'
import type { Proposta } from '@/data/types'
import { data, moedaExata } from '@/lib/format'

/**
 * O motor das minutas.
 *
 * Uma minuta é texto com variáveis. O que a torna inteligente é a origem de
 * cada variável: as internas a Cleo calcula do cadastro — valor por extenso,
 * percentual de contrapartida, prazo — e as de usuário ficam marcadas no
 * documento até alguém preencher. Redigitar valor é onde o erro mora; aqui,
 * valor não se digita.
 */

/* ---------- Valor por extenso ---------- */

const UNIDADES = [
  '', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
  'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete',
  'dezoito', 'dezenove',
]
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

function ateMil(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cem'
  const c = Math.floor(n / 100)
  const resto = n % 100
  const partes: string[] = []
  if (c > 0) partes.push(CENTENAS[c])
  if (resto > 0) {
    if (resto < 20) partes.push(UNIDADES[resto])
    else {
      const d = Math.floor(resto / 10)
      const u = resto % 10
      partes.push(u > 0 ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d])
    }
  }
  return partes.join(' e ')
}

/** 14.237.000 → "quatorze milhões, duzentos e trinta e sete mil reais" */
export function valorPorExtenso(valor: number): string {
  const inteiro = Math.floor(Math.abs(valor))
  if (inteiro === 0) return 'zero reais'

  const bilhoes = Math.floor(inteiro / 1_000_000_000)
  const milhoes = Math.floor((inteiro % 1_000_000_000) / 1_000_000)
  const milhares = Math.floor((inteiro % 1_000_000) / 1000)
  const resto = inteiro % 1000

  const partes: string[] = []
  if (bilhoes > 0) partes.push(`${ateMil(bilhoes)} ${bilhoes === 1 ? 'bilhão' : 'bilhões'}`)
  if (milhoes > 0) partes.push(`${ateMil(milhoes)} ${milhoes === 1 ? 'milhão' : 'milhões'}`)
  if (milhares > 0) partes.push(milhares === 1 ? 'mil' : `${ateMil(milhares)} mil`)
  if (resto > 0) partes.push(ateMil(resto))

  const texto = partes.join(', ').replace(/, ([^,]*)$/, ' e $1')
  const soMilhoesRedondos = resto === 0 && milhares === 0 && (milhoes > 0 || bilhoes > 0)
  return `${texto}${soMilhoesRedondos ? ' de' : ''} ${inteiro === 1 ? 'real' : 'reais'}`
}

/* ---------- Catálogo de variáveis ---------- */

export interface Variavel {
  nome: string
  origem: 'interno' | 'usuario'
  descricao: string
  valor: (p: Proposta) => string
}

const PENDENTE = (rotulo: string) => `⟨${rotulo}⟩`

/**
 * As variáveis que qualquer minuta pode usar. As internas saem do cadastro
 * sincronizado; as de usuário viram lacunas marcadas no documento gerado.
 */
export const VARIAVEIS: Variavel[] = [
  { nome: 'numeroProposta', origem: 'interno', descricao: 'Número da proposta no TransfereGov', valor: (p) => p.numero },
  { nome: 'numeroProcesso', origem: 'interno', descricao: 'Número do processo no SEI', valor: (p) => p.numProcessoSei ?? PENDENTE('processo a autuar') },
  { nome: 'objeto', origem: 'interno', descricao: 'Objeto da proposta', valor: (p) => p.objeto },
  { nome: 'programa', origem: 'interno', descricao: 'Programa do órgão', valor: (p) => p.programa },
  { nome: 'modalidade', origem: 'interno', descricao: 'Instrumento de repasse', valor: (p) => p.modalidade },
  { nome: 'fundamentoLegal', origem: 'interno', descricao: 'Base normativa aplicável', valor: (p) => p.fundamentoLegal },
  { nome: 'proponente', origem: 'interno', descricao: 'Nome do proponente', valor: (p) => getProponente(p.proponenteId)?.nome ?? '—' },
  { nome: 'cnpjProponente', origem: 'interno', descricao: 'CNPJ do proponente', valor: (p) => getProponente(p.proponenteId)?.cnpj ?? '—' },
  { nome: 'municipioUf', origem: 'interno', descricao: 'Município e UF', valor: (p) => { const pr = getProponente(p.proponenteId); return pr ? `${pr.municipio}/${pr.uf}` : '—' } },
  { nome: 'representante', origem: 'interno', descricao: 'Representante legal e cargo', valor: (p) => { const pr = getProponente(p.proponenteId); return pr ? `${pr.representante}, ${pr.cargoRepresentante}` : '—' } },
  { nome: 'concedente', origem: 'interno', descricao: 'Órgão concedente', valor: (p) => getOrgao(p.orgaoId)?.nome ?? '—' },
  { nome: 'unidadeGestora', origem: 'interno', descricao: 'Unidade gestora do concedente', valor: (p) => getOrgao(p.orgaoId)?.unidadeGestora ?? '—' },
  { nome: 'valorGlobal', origem: 'interno', descricao: 'Valor global, em moeda', valor: (p) => moedaExata(p.valorGlobal) },
  { nome: 'valorGlobalExtenso', origem: 'interno', descricao: 'Valor global por extenso', valor: (p) => valorPorExtenso(p.valorGlobal) },
  { nome: 'valorRepasse', origem: 'interno', descricao: 'Valor de repasse, em moeda', valor: (p) => moedaExata(p.valorRepasse) },
  { nome: 'valorRepasseExtenso', origem: 'interno', descricao: 'Valor de repasse por extenso', valor: (p) => valorPorExtenso(p.valorRepasse) },
  { nome: 'valorContrapartida', origem: 'interno', descricao: 'Contrapartida, em moeda', valor: (p) => moedaExata(p.valorContrapartida) },
  { nome: 'percentualContrapartida', origem: 'interno', descricao: 'Contrapartida ÷ valor global', valor: (p) => `${((p.valorContrapartida / p.valorGlobal) * 100).toFixed(2).replace('.', ',')}%` },
  { nome: 'dataCadastro', origem: 'interno', descricao: 'Data de cadastro da proposta', valor: (p) => data(p.dataCadastro) },
  { nome: 'dataHoje', origem: 'interno', descricao: 'Data de geração do documento', valor: () => data(new Date().toISOString()) },
  { nome: 'prazoResposta', origem: 'interno', descricao: 'Hoje + 15 dias úteis', valor: () => { const d = new Date(); let uteis = 0; while (uteis < 15) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) uteis++ } return data(d.toISOString()) } },
  { nome: 'parecer', origem: 'usuario', descricao: 'Parecer do analista', valor: () => PENDENTE('parecer do analista') },
  { nome: 'itensPendentes', origem: 'usuario', descricao: 'Itens a complementar', valor: () => PENDENTE('itens a complementar') },
  { nome: 'unidadeDestino', origem: 'usuario', descricao: 'Unidade de destino do despacho', valor: () => PENDENTE('unidade de destino') },
  { nome: 'recomendacao', origem: 'usuario', descricao: 'Recomendação final', valor: () => PENDENTE('recomendação final') },
]

const POR_NOME = new Map(VARIAVEIS.map((v) => [v.nome, v]))

/* ---------- Preenchimento ---------- */

export interface Trecho {
  texto: string
  tipo: 'texto' | 'interno' | 'usuario' | 'desconhecida'
  variavel?: string
}

/**
 * Divide o corpo em trechos tipados — é o que permite pintar cada variável
 * com a cor da sua origem, tanto no editor quanto no documento final.
 */
export function analisar(corpo: string, proposta?: Proposta): Trecho[] {
  const trechos: Trecho[] = []
  const regex = /\{\{\s*([a-zA-Z]+)\s*\}\}/g
  let ultimo = 0
  let m: RegExpExecArray | null
  while ((m = regex.exec(corpo))) {
    if (m.index > ultimo) trechos.push({ texto: corpo.slice(ultimo, m.index), tipo: 'texto' })
    const variavel = POR_NOME.get(m[1])
    if (!variavel) trechos.push({ texto: m[0], tipo: 'desconhecida', variavel: m[1] })
    else
      trechos.push({
        texto: proposta ? variavel.valor(proposta) : `{{${variavel.nome}}}`,
        tipo: variavel.origem,
        variavel: variavel.nome,
      })
    ultimo = m.index + m[0].length
  }
  if (ultimo < corpo.length) trechos.push({ texto: corpo.slice(ultimo), tipo: 'texto' })
  return trechos
}

export function variaveisUsadas(corpo: string): { internas: string[]; usuario: string[]; desconhecidas: string[] } {
  const internas = new Set<string>()
  const usuario = new Set<string>()
  const desconhecidas = new Set<string>()
  for (const t of analisar(corpo)) {
    if (!t.variavel) continue
    if (t.tipo === 'interno') internas.add(t.variavel)
    else if (t.tipo === 'usuario') usuario.add(t.variavel)
    else desconhecidas.add(t.variavel)
  }
  return { internas: [...internas], usuario: [...usuario], desconhecidas: [...desconhecidas] }
}

/* ---------- Corpos de fábrica ---------- */

export const CORPOS_FABRICA: Record<string, string> = {
  m1: `TERMO DE ANÁLISE DE PROPOSTA

Processo nº {{numeroProcesso}}
Proposta nº {{numeroProposta}} — {{programa}}

1. Trata-se da proposta apresentada por {{proponente}}, CNPJ {{cnpjProponente}}, sediado em {{municipioUf}}, com o objeto: {{objeto}}.

2. O valor global da proposta é de {{valorGlobal}} ({{valorGlobalExtenso}}), sendo {{valorRepasse}} de repasse da União e {{valorContrapartida}} de contrapartida do proponente, correspondente a {{percentualContrapartida}} do valor global — percentual compatível com o exigido.

3. A proposta enquadra-se no programa {{programa}}, com fundamento no {{fundamentoLegal}}, na modalidade {{modalidade}}.

4. Análise técnica: {{parecer}}

{{municipioUf}}, {{dataHoje}}.`,

  m2: `OFÍCIO — SOLICITAÇÃO DE COMPLEMENTAÇÃO

Ao representante legal de {{proponente}}
{{municipioUf}}

Assunto: Complementação de documentação — Proposta nº {{numeroProposta}}

1. Em análise da proposta em referência, objeto "{{objeto}}", verificou-se a ausência dos itens abaixo, indispensáveis ao prosseguimento:

{{itensPendentes}}

2. Solicita-se a apresentação até {{prazoResposta}}, sob pena de arquivamento nos termos da norma de regência.

Atenciosamente,
{{unidadeGestora}}
{{dataHoje}}`,

  m3: `NOTA TÉCNICA DE ENQUADRAMENTO

Proposta nº {{numeroProposta}}
Interessado: {{proponente}} ({{cnpjProponente}})

1. A proposta tem por objeto {{objeto}}, no âmbito do programa {{programa}}.

2. O instrumento adequado é {{modalidade}}, com fundamento no {{fundamentoLegal}}.

3. O valor global de {{valorGlobal}} ({{valorGlobalExtenso}}) é compatível com a mediana do programa, e a contrapartida ofertada de {{percentualContrapartida}} atende ao mínimo regulamentar.

4. Pelo exposto, a proposta está APTA ao prosseguimento da análise.

{{dataHoje}} — {{unidadeGestora}}`,

  m4: `DESPACHO

Processo nº {{numeroProcesso}}

Encaminhe-se o presente processo, referente à proposta nº {{numeroProposta}} de {{proponente}}, à {{unidadeDestino}}, para prosseguimento.

Em {{dataHoje}}.
{{unidadeGestora}}`,

  m5: `PARECER TÉCNICO CONCLUSIVO

Processo nº {{numeroProcesso}}
Proposta nº {{numeroProposta}} — {{programa}}

1. Concluída a instrução, a proposta de {{proponente}}, objeto "{{objeto}}", no valor global de {{valorGlobal}} ({{valorGlobalExtenso}}), reúne os requisitos de habilitação e enquadramento.

2. Recomendação: {{recomendacao}}

É o parecer, que se submete à consideração superior.

{{dataHoje}} — {{unidadeGestora}}`,
}
