import { ORGAOS } from '@/data/catalogs'
import { HOJE } from '@/data/extensoes'

/**
 * Módulo Prefeitura — a versão cliente da Cleopatra.
 *
 * A Cleopatra dos ministérios analisa o que foi pedido. Esta olha do outro
 * lado do balcão: ela ajuda quem pede. É a diferença entre um sistema de
 * análise e um sistema de acesso.
 *
 * O que ela resolve, na ordem em que dói:
 *  1. O município não sabe qual programa aceita o projeto dele.
 *  2. Quando sabe, não escreve na língua que o ministério exige — e volta.
 *  3. Quando escreve, não acompanha o que travou nem por quê.
 *
 * A consultoria que hoje cobra para intermediar isso faz exatamente as três
 * coisas à mão. Aqui elas viram software.
 */

/* ---------- Oportunidades ---------- */

export type StatusOportunidade = 'aberta' | 'encerrando' | 'encerrada'

export interface Oportunidade {
  id: string
  programa: string
  orgaoId: string
  orgaoSigla: string
  objetoTipico: string
  /** Faixa de valor que o programa costuma aceitar. */
  faixaMin: number
  faixaMax: number
  contrapartidaMinima: number
  prazoFinal: string
  status: StatusOportunidade
  /** 0..1 — quanto o perfil do município combina com o programa. */
  aderencia: number
  porqueCombina: string[]
  exigencias: string[]
}

/* ---------- Perfil do município ---------- */

export interface PerfilMunicipio {
  nome: string
  uf: string
  populacao: number
  /** Capacidade de contrapartida, em reais, declarada no orçamento. */
  contrapartidaDisponivel: number
  /** Situação nos cadastros de regularidade. */
  regular: boolean
  pendencias: string[]
  convenios: { ativos: number; concluidos: number; valorTotal: number }
}

export const MUNICIPIO_DEMO: PerfilMunicipio = {
  nome: 'Petrópolis',
  uf: 'RJ',
  populacao: 306_678,
  contrapartidaDisponivel: 1_850_000,
  regular: true,
  pendencias: ['Certidão de regularidade do FGTS vence em 22 dias'],
  convenios: { ativos: 4, concluidos: 11, valorTotal: 38_400_000 },
}

/* ---------- Catálogo de oportunidades ---------- */

function dias(n: number): string {
  const d = new Date(HOJE)
  d.setDate(d.getDate() + n)
  return d.toISOString()
}

export function oportunidades(perfil: PerfilMunicipio): Oportunidade[] {
  const lista: Oportunidade[] = []
  let n = 0

  const modelos: {
    orgaoId: string
    programa: string
    objeto: string
    min: number
    max: number
    contra: number
    prazo: number
    combina: string[]
    exige: string[]
  }[] = [
    {
      orgaoId: 'midr',
      programa: 'Contenção de Encostas em Áreas de Risco',
      objeto: 'Obras de contenção de encostas em áreas de risco cadastradas',
      min: 800_000,
      max: 12_000_000,
      contra: 0.02,
      prazo: 34,
      combina: [
        'Município com áreas de risco mapeadas pela Defesa Civil',
        'Histórico de eventos extremos nos últimos 5 anos',
        'Contrapartida disponível cobre o mínimo exigido',
      ],
      exige: [
        'Projeto básico de engenharia com ART',
        'Mapeamento de risco da Defesa Civil municipal',
        'Declaração de titularidade da área',
        'Licença ambiental ou dispensa formal',
      ],
    },
    {
      orgaoId: 'midr',
      programa: 'Drenagem Urbana Sustentável',
      objeto: 'Implantação de sistema de drenagem em bacia urbana',
      min: 1_200_000,
      max: 18_000_000,
      contra: 0.03,
      prazo: 61,
      combina: [
        'Bacia urbana com histórico de alagamento',
        'Plano diretor de drenagem aprovado',
      ],
      exige: [
        'Plano diretor de drenagem ou estudo hidrológico',
        'Projeto básico com planilha orçamentária',
        'Comprovante de capacidade técnica da equipe',
      ],
    },
    {
      orgaoId: 'mapa',
      programa: 'Patrulha Agrícola Mecanizada',
      objeto: 'Aquisição de patrulha agrícola para a agricultura familiar',
      min: 300_000,
      max: 2_400_000,
      contra: 0.02,
      prazo: 12,
      combina: [
        'Agricultura familiar registrada no município',
        'Valor cabe na contrapartida disponível',
        'Aquisição de bens: instrução mais simples que obra',
      ],
      exige: [
        'Relação de agricultores familiares beneficiados',
        'Três orçamentos ou registro de preços vigente',
        'Declaração de guarda e manutenção dos equipamentos',
      ],
    },
    {
      orgaoId: 'mapa',
      programa: 'Recuperação de Estradas Vicinais',
      objeto: 'Recuperação de estradas vicinais de escoamento da produção',
      min: 500_000,
      max: 6_000_000,
      contra: 0.02,
      prazo: 88,
      combina: ['Zona rural com produção escoada por vicinais'],
      exige: ['Projeto de recuperação com extensão em km', 'Declaração de domínio das vias'],
    },
    {
      orgaoId: 'mpa',
      programa: 'Aquicultura Familiar e Cooperativismo',
      objeto: 'Implantação de tanques-rede para aquicultura familiar',
      min: 200_000,
      max: 1_800_000,
      contra: 0.02,
      prazo: 5,
      combina: ['Colônia de pescadores ou cooperativa ativa no município'],
      exige: ['Cadastro da colônia ou cooperativa', 'Licença ambiental para aquicultura'],
    },
  ]

  for (const m of modelos) {
    const orgao = ORGAOS.find((o) => o.id === m.orgaoId)!
    const cabeNaContrapartida = perfil.contrapartidaDisponivel >= m.min * m.contra
    // A aderência é o que a consultoria cobra para dizer — e aqui é conta aberta
    const base = m.combina.length / 3
    const aderencia = Math.min(
      base * 0.6 + (cabeNaContrapartida ? 0.28 : 0) + (perfil.regular ? 0.12 : 0),
      0.98,
    )
    lista.push({
      id: `op${++n}`,
      programa: m.programa,
      orgaoId: m.orgaoId,
      orgaoSigla: orgao.sigla,
      objetoTipico: m.objeto,
      faixaMin: m.min,
      faixaMax: m.max,
      contrapartidaMinima: m.contra,
      prazoFinal: dias(m.prazo),
      status: m.prazo <= 7 ? 'encerrando' : m.prazo <= 0 ? 'encerrada' : 'aberta',
      aderencia,
      porqueCombina: m.combina,
      exigencias: m.exige,
    })
  }

  return lista.sort((a, b) => b.aderencia - a.aderencia)
}

/* ---------- Pedidos do município ---------- */

export type EstagioPedido =
  | 'rascunho'
  | 'documentacao'
  | 'enviado'
  | 'em_analise'
  | 'diligencia'
  | 'aprovado'
  | 'recusado'

export const ESTAGIOS: { id: EstagioPedido; rotulo: string; explica: string }[] = [
  { id: 'rascunho', rotulo: 'Rascunho', explica: 'A Cleo montou o pedido; falta você revisar.' },
  { id: 'documentacao', rotulo: 'Documentação', explica: 'Reunindo os anexos exigidos pelo programa.' },
  { id: 'enviado', rotulo: 'Enviado', explica: 'Protocolado no TransfereGov, aguardando distribuição.' },
  { id: 'em_analise', rotulo: 'Em análise', explica: 'Um analista do ministério está avaliando.' },
  { id: 'diligencia', rotulo: 'Diligência', explica: 'O ministério pediu complementação — o relógio corre.' },
  { id: 'aprovado', rotulo: 'Aprovado', explica: 'Enquadrado. Segue para celebração do instrumento.' },
  { id: 'recusado', rotulo: 'Recusado', explica: 'Não enquadrou. A Cleo explica o motivo e o que fazer.' },
]

export interface Pedido {
  id: string
  objeto: string
  programa: string
  orgaoSigla: string
  valor: number
  contrapartida: number
  estagio: EstagioPedido
  criadoEm: string
  atualizadoEm: string
  /** Itens de documentação, com o que já foi reunido. */
  checklist: { item: string; ok: boolean }[]
  /** Quando em diligência: o que o ministério pediu e até quando. */
  diligencia?: { itens: string[]; prazo: string }
  /** Diagnóstico da Cleo sobre a chance de aprovação. */
  chance: number
  observacao: string
}

export function pedidosDemo(): Pedido[] {
  return [
    {
      id: 'pd1',
      objeto: 'Execução de obras de contenção de encostas no bairro Alto da Serra',
      programa: 'Contenção de Encostas em Áreas de Risco',
      orgaoSigla: 'MIDR',
      valor: 4_820_000,
      contrapartida: 96_400,
      estagio: 'diligencia',
      criadoEm: dias(-64),
      atualizadoEm: dias(-6),
      checklist: [
        { item: 'Plano de trabalho', ok: true },
        { item: 'Projeto básico com ART', ok: true },
        { item: 'Mapeamento de risco da Defesa Civil', ok: true },
        { item: 'Licença ambiental', ok: false },
        { item: 'Declaração de titularidade da área', ok: true },
      ],
      diligencia: {
        itens: [
          'Licença ambiental prévia ou declaração de dispensa',
          'Planilha orçamentária com composição de custos unitários',
        ],
        prazo: dias(9),
      },
      chance: 0.78,
      observacao:
        'A diligência é padrão para obra em encosta. Respondendo nos 9 dias, a análise retoma sem perder a fila.',
    },
    {
      id: 'pd2',
      objeto: 'Aquisição de patrulha agrícola mecanizada para a agricultura familiar',
      programa: 'Patrulha Agrícola Mecanizada',
      orgaoSigla: 'MAPA',
      valor: 1_340_000,
      contrapartida: 26_800,
      estagio: 'em_analise',
      criadoEm: dias(-28),
      atualizadoEm: dias(-11),
      checklist: [
        { item: 'Plano de trabalho', ok: true },
        { item: 'Relação de agricultores beneficiados', ok: true },
        { item: 'Três orçamentos', ok: true },
        { item: 'Declaração de guarda e manutenção', ok: true },
      ],
      chance: 0.86,
      observacao:
        'Aquisição de bens tem instrução mais simples que obra. Documentação completa, valor dentro da faixa do programa.',
    },
    {
      id: 'pd3',
      objeto: 'Implantação de sistema de drenagem urbana na região Vila Esperança',
      programa: 'Drenagem Urbana Sustentável',
      orgaoSigla: 'MIDR',
      valor: 7_200_000,
      contrapartida: 216_000,
      estagio: 'documentacao',
      criadoEm: dias(-9),
      atualizadoEm: dias(-1),
      checklist: [
        { item: 'Plano de trabalho', ok: true },
        { item: 'Estudo hidrológico', ok: true },
        { item: 'Projeto básico com planilha', ok: false },
        { item: 'Capacidade técnica da equipe', ok: false },
      ],
      chance: 0.64,
      observacao:
        'Faltam dois anexos. Sem o projeto básico, o pedido volta na primeira triagem — vale segurar até completar.',
    },
  ]
}

/* ---------- Diagnóstico ---------- */

export interface Diagnostico {
  prontos: number
  incompletos: number
  emDiligencia: number
  valorPleiteado: number
  chanceMedia: number
  proximoPrazo?: { pedido: Pedido; dias: number }
}

export function diagnosticar(pedidos: Pedido[]): Diagnostico {
  const emDiligencia = pedidos.filter((p) => p.estagio === 'diligencia')
  const proximo = emDiligencia
    .map((p) => ({
      pedido: p,
      dias: Math.ceil((new Date(p.diligencia!.prazo).getTime() - HOJE.getTime()) / 86_400_000),
    }))
    .sort((a, b) => a.dias - b.dias)[0]

  return {
    prontos: pedidos.filter((p) => p.checklist.every((c) => c.ok)).length,
    incompletos: pedidos.filter((p) => p.checklist.some((c) => !c.ok)).length,
    emDiligencia: emDiligencia.length,
    valorPleiteado: pedidos.reduce((s, p) => s + p.valor, 0),
    chanceMedia: pedidos.length ? pedidos.reduce((s, p) => s + p.chance, 0) / pedidos.length : 0,
    proximoPrazo: proximo,
  }
}

/* ---------- Redação do ofício ---------- */

/**
 * O ofício na linguagem que o ministério exige.
 *
 * É aqui que mora a promessa central do módulo: a Cleo conhece a norma e
 * escreve como o analista do outro lado espera ler. Menos retrabalho, mais
 * taxa de aceitação — e o consultor que cobrava por isso vira dispensável.
 */
export function redigirOficio(pedido: Pedido, perfil: PerfilMunicipio, oportunidade?: Oportunidade): string {
  const pct = ((pedido.contrapartida / pedido.valor) * 100).toFixed(2).replace('.', ',')
  return `OFÍCIO Nº ___/2026 — GABINETE DO PREFEITO

Ao Senhor
Secretário-Nacional
${pedido.orgaoSigla}

Assunto: Apresentação de proposta — ${pedido.programa}

Senhor Secretário,

1. O Município de ${perfil.nome}/${perfil.uf}, inscrito no CNPJ sob o nº __.___.___/0001-__, no uso de suas atribuições e com fundamento na Portaria Interministerial nº 424/2016 e no Decreto nº 6.170/2007, vem apresentar proposta para celebração de instrumento de repasse no âmbito do programa ${pedido.programa}.

2. O objeto pretendido é a ${pedido.objeto.toLowerCase()}, com valor global de R$ ${pedido.valor.toLocaleString('pt-BR')}, dos quais R$ ${(pedido.valor - pedido.contrapartida).toLocaleString('pt-BR')} correspondem ao repasse pleiteado e R$ ${pedido.contrapartida.toLocaleString('pt-BR')} à contrapartida municipal, equivalente a ${pct}% do valor global — percentual ${oportunidade && pedido.contrapartida / pedido.valor >= oportunidade.contrapartidaMinima ? 'superior ao mínimo exigido' : 'a ser confirmado'} pelo normativo vigente.

3. A intervenção justifica-se pelo interesse público local, atendendo população estimada de ${perfil.populacao.toLocaleString('pt-BR')} habitantes, e encontra-se compatível com as diretrizes do programa.

4. Declara-se que o Município mantém-se regular perante os cadastros exigidos e que dispõe de capacidade técnica e financeira para a execução do objeto e para o aporte da contrapartida.

5. Seguem anexos os documentos exigidos pelo normativo do programa.

Respeitosamente,

_______________________________
Prefeito Municipal de ${perfil.nome}`
}
