import { ORGAOS } from '@/data/catalogs'
import { HOJE } from '@/data/extensoes'
import { PARLAMENTARES } from '@/data/repo'

/**
 * Módulo Prefeitura — a versão cliente da Cleopatra.
 *
 * A Cleopatra dos ministérios analisa o que foi pedido. Esta olha do outro lado
 * do balcão: ajuda quem pede. É a diferença entre um sistema de análise e um
 * sistema de acesso.
 *
 * O desenho segue o que a consultoria de captação faz à mão e cobra caro:
 *
 *  1. **Parlamentar com saldo livre** — a pergunta que vale dinheiro. Emenda
 *     autorizada menos empenhada é saldo que ainda pode ser destinado, e quem
 *     chega primeiro com o pedido pronto leva. Toda a indústria de assessoria
 *     política vive de saber isso antes dos outros.
 *  2. **Dinheiro dormindo na própria casa** — convênio com saldo a liberar e
 *     restos a pagar prestes a expirar. É recurso que o município já conquistou
 *     e vai perder por inércia.
 *  3. **Programa que aceita o projeto** — aderência calculada, não palpite.
 *  4. **O ofício na língua certa** — menos devolução, mais obra.
 *  5. **Comparação com pares** — municípios do mesmo porte captam quanto?
 *
 * O ciclo orçamentário fecha em 31 de dezembro. Tudo aqui conta contra essa data.
 */

/* ---------- O relógio do ciclo ---------- */

export function diasAteFimDoCiclo(): { dias: number; rotulo: string } {
  const fim = new Date(HOJE.getFullYear(), 11, 31, 23, 59, 59)
  const dias = Math.max(0, Math.ceil((fim.getTime() - HOJE.getTime()) / 86_400_000))
  return { dias, rotulo: `${dias} dias até 31/dez` }
}

function dias(n: number): string {
  const d = new Date(HOJE)
  d.setDate(d.getDate() + n)
  return d.toISOString()
}

/* ---------- Perfil do município ---------- */

export interface PerfilMunicipio {
  nome: string
  uf: string
  ibge: string
  populacao: number
  idhm: number
  /** Capacidade de contrapartida declarada no orçamento. */
  contrapartidaDisponivel: number
  regular: boolean
  pendencias: { item: string; prazo: number; gravidade: 'alta' | 'media' }[]
  convenios: { ativos: number; concluidos: number; valorTotal: number }
}

export const MUNICIPIO_DEMO: PerfilMunicipio = {
  nome: 'Petrópolis',
  uf: 'RJ',
  ibge: '3303906',
  populacao: 306_678,
  idhm: 0.745,
  contrapartidaDisponivel: 1_850_000,
  regular: true,
  pendencias: [
    { item: 'Certidão de regularidade do FGTS', prazo: 22, gravidade: 'alta' },
    { item: 'Prestação de contas do convênio 0231890-98/2024', prazo: 47, gravidade: 'media' },
  ],
  convenios: { ativos: 4, concluidos: 11, valorTotal: 38_400_000 },
}

/* ---------- 1. Parlamentares com saldo livre ---------- */

export interface ParlamentarLivre {
  id: string
  nome: string
  partido: string
  uf: string
  casa: 'Câmara' | 'Senado'
  valorAutorizado: number
  valorEmpenhado: number
  valorPago: number
  /** Autorizado − empenhado: o que ainda dá para destinar. */
  saldoLivre: number
  pctExecutado: number
  /** Já destinou recurso a este município antes? Muda a conversa. */
  jaAtendeuMunicipio: boolean
  /** Nasceu ou tem base eleitoral na região. */
  baseNaRegiao: boolean
  ultimaDestinacao?: string
}

/**
 * A leitura que vale dinheiro.
 *
 * Saldo livre alto + execução baixa = janela de decisão aberta. Parlamentar que
 * já executou 90% do teto não tem o que destinar, por mais simpático que seja.
 */
export function parlamentaresComSaldo(perfil: PerfilMunicipio): ParlamentarLivre[] {
  // Deriva do elenco já existente para a demonstração ficar coerente com o
  // resto da plataforma — o mesmo parlamentar aparece nos dois módulos.
  //
  // A bancada da própria UF vem inteira: é a lista que o prefeito abre
  // primeiro, porque quem deve voto na região atende o telefone. Os demais
  // entram como segunda linha, até completar a página.
  const daUf = PARLAMENTARES.filter((p) => p.uf === perfil.uf)
  const fora = PARLAMENTARES.filter((p) => p.uf !== perfil.uf)
  const base = [...daUf, ...fora.slice(0, Math.max(4, 18 - daUf.length))]
  return base
    .map((p, i) => {
      const autorizado = 12_500_000 + ((i * 3_700_000) % 21_000_000)
      const pctEmp = 0.18 + ((i * 13) % 70) / 100
      const empenhado = Math.round(autorizado * pctEmp)
      const pago = Math.round(empenhado * (0.5 + ((i * 7) % 40) / 100))
      const mesmaUf = p.uf === perfil.uf
      return {
        id: p.id,
        nome: p.nome,
        partido: p.partido,
        uf: p.uf,
        casa: p.casa,
        valorAutorizado: autorizado,
        valorEmpenhado: empenhado,
        valorPago: pago,
        saldoLivre: autorizado - empenhado,
        pctExecutado: (empenhado / autorizado) * 100,
        jaAtendeuMunicipio: mesmaUf && i % 3 === 0,
        baseNaRegiao: mesmaUf,
        ultimaDestinacao: i % 3 === 0 ? dias(-(40 + i * 11)) : undefined,
      }
    })
    // Quem tem base na UF primeiro; depois, maior saldo livre
    .sort((a, b) => Number(b.baseNaRegiao) - Number(a.baseNaRegiao) || b.saldoLivre - a.saldoLivre)
}

/* ---------- 2. Dinheiro dormindo ---------- */

export type CategoriaOportunidade = 'convenio_saldo' | 'rap_expirando' | 'emenda_livre'

export const ROTULO_CATEGORIA: Record<CategoriaOportunidade, string> = {
  convenio_saldo: 'Convênio com saldo',
  rap_expirando: 'Restos a pagar expirando',
  emenda_livre: 'Emenda com saldo livre',
}

export interface DinheiroDormindo {
  id: string
  categoria: CategoriaOportunidade
  titulo: string
  origem: string
  valor: number
  diasParaVencer: number
  /** O que fazer para não perder. */
  acao: string
  perdeSeNaoAgir: boolean
}

/**
 * O recurso que o município já conquistou e vai perder por inércia.
 *
 * É a categoria mais fácil de vender numa reunião: não depende de convencer
 * ninguém em Brasília — depende só de alguém aqui dentro mexer.
 */
export function dinheiroDormindo(): DinheiroDormindo[] {
  const itens: DinheiroDormindo[] = [
    {
      id: 'dd1',
      categoria: 'rap_expirando',
      titulo: 'Restos a pagar do convênio de drenagem 0231890-98/2024',
      origem: 'MIDR · empenhado em 2024, não liquidado',
      valor: 1_240_000,
      diasParaVencer: 38,
      acao: 'Apresentar medição da etapa executada para liquidar antes do cancelamento.',
      perdeSeNaoAgir: true,
    },
    {
      id: 'dd2',
      categoria: 'convenio_saldo',
      titulo: 'Saldo não liberado do convênio de pavimentação 0189233-11/2025',
      origem: 'MIDR · 2ª parcela pendente de liberação',
      valor: 860_000,
      diasParaVencer: 74,
      acao: 'Prestar contas da 1ª parcela para destravar a liberação da segunda.',
      perdeSeNaoAgir: true,
    },
    {
      id: 'dd3',
      categoria: 'emenda_livre',
      titulo: 'Emenda individual já indicada ao município, sem proposta cadastrada',
      origem: 'Emenda 40120026 · dep. federal da bancada do RJ',
      valor: 2_500_000,
      diasParaVencer: 21,
      acao: 'Cadastrar a proposta no TransfereGov antes do encerramento do prazo de indicação.',
      perdeSeNaoAgir: true,
    },
    {
      id: 'dd4',
      categoria: 'convenio_saldo',
      titulo: 'Rendimento de aplicação do convênio de equipamentos 0177441-02/2024',
      origem: 'MAPA · conta específica',
      valor: 94_300,
      diasParaVencer: 156,
      acao: 'Solicitar aditivo de meta para aplicar o rendimento no próprio objeto.',
      perdeSeNaoAgir: false,
    },
  ]
  return itens.sort((a, b) => a.diasParaVencer - b.diasParaVencer)
}

/* ---------- 3. Oportunidades (programas abertos) ---------- */

export type StatusOportunidade = 'aberta' | 'encerrando' | 'encerrada'

export interface Oportunidade {
  id: string
  programa: string
  orgaoId: string
  orgaoSigla: string
  objetoTipico: string
  faixaMin: number
  faixaMax: number
  contrapartidaMinima: number
  prazoFinal: string
  status: StatusOportunidade
  aderencia: number
  porqueCombina: string[]
  oQueFalta: string[]
  exigencias: string[]
  /** Quantos municípios do mesmo porte já pegaram este programa. */
  paresQueCaptaram: number
}

export function oportunidades(perfil: PerfilMunicipio): Oportunidade[] {
  const modelos = [
    {
      orgaoId: 'midr',
      programa: 'Contenção de Encostas em Áreas de Risco',
      objeto: 'Obras de contenção de encostas em áreas de risco cadastradas',
      min: 800_000,
      max: 12_000_000,
      contra: 0.02,
      prazo: 34,
      pares: 23,
      combina: [
        'Município com áreas de risco mapeadas pela Defesa Civil',
        'Histórico de eventos extremos nos últimos 5 anos',
        'Contrapartida disponível cobre o mínimo exigido',
        'Porte populacional dentro da faixa prioritária do programa',
      ],
      falta: [] as string[],
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
      pares: 17,
      combina: [
        'Bacia urbana com histórico de alagamento',
        'Plano diretor de drenagem aprovado',
      ],
      falta: ['Contrapartida de 3% exige R$ 216 mil — cabe, mas consome 12% da folga'],
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
      pares: 41,
      combina: [
        'Agricultura familiar registrada no município',
        'Valor cabe na contrapartida disponível',
        'Aquisição de bens: instrução mais simples que obra',
      ],
      falta: [],
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
      pares: 29,
      combina: ['Zona rural com produção escoada por vicinais'],
      falta: ['Não há projeto de recuperação com extensão em km levantada'],
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
      pares: 6,
      combina: ['Colônia de pescadores ou cooperativa ativa no município'],
      falta: ['Município sem colônia de pescadores cadastrada — aderência baixa'],
      exige: ['Cadastro da colônia ou cooperativa', 'Licença ambiental para aquicultura'],
    },
  ]

  return modelos
    .map((m, n) => {
      const orgao = ORGAOS.find((o) => o.id === m.orgaoId)!
      const cabeNaContrapartida = perfil.contrapartidaDisponivel >= m.min * m.contra
      const base = Math.min(m.combina.length / 4, 1)
      const aderencia = Math.max(
        Math.min(
          base * 0.58 + (cabeNaContrapartida ? 0.26 : 0) + (perfil.regular ? 0.14 : 0) - m.falta.length * 0.12,
          0.98,
        ),
        0.12,
      )
      return {
        id: `op${n + 1}`,
        programa: m.programa,
        orgaoId: m.orgaoId,
        orgaoSigla: orgao.sigla,
        objetoTipico: m.objeto,
        faixaMin: m.min,
        faixaMax: m.max,
        contrapartidaMinima: m.contra,
        prazoFinal: dias(m.prazo),
        status: (m.prazo <= 7 ? 'encerrando' : 'aberta') as StatusOportunidade,
        aderencia,
        porqueCombina: m.combina,
        oQueFalta: m.falta,
        exigencias: m.exige,
        paresQueCaptaram: m.pares,
      }
    })
    .sort((a, b) => b.aderencia - a.aderencia)
}

/* ---------- 4. Pedidos ---------- */

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
  checklist: { item: string; ok: boolean }[]
  diligencia?: { itens: string[]; prazo: string }
  chance: number
  observacao: string
  /** Parlamentar que padrinha o pedido, quando há. */
  padrinho?: string
  /** Onde está na fila do ministério, quando dá para saber. */
  posicaoFila?: { posicao: number; total: number }
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
      padrinho: 'Emenda individual — bancada do RJ',
      posicaoFila: { posicao: 12, total: 47 },
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
      posicaoFila: { posicao: 4, total: 31 },
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

/* ---------- 5. Comparação com pares ---------- */

export interface Par {
  nome: string
  uf: string
  populacao: number
  captadoNoAno: number
  convenios: number
  /** Posição relativa: quanto o par captou por habitante. */
  porHabitante: number
}

/**
 * Municípios do mesmo porte captam quanto?
 *
 * É a pergunta que muda a conversa com o prefeito. Não adianta dizer "vocês
 * podem captar mais" — adianta mostrar que a cidade vizinha do mesmo tamanho
 * captou o dobro no mesmo período.
 */
export function pares(perfil: PerfilMunicipio): { alvo: Par; pares: Par[]; posicao: number } {
  const alvo: Par = {
    nome: perfil.nome,
    uf: perfil.uf,
    populacao: perfil.populacao,
    captadoNoAno: 6_160_000,
    convenios: perfil.convenios.ativos,
    porHabitante: 6_160_000 / perfil.populacao,
  }
  const lista: Par[] = [
    { nome: 'Nova Friburgo', uf: 'RJ', populacao: 191_000, captadoNoAno: 11_900_000, convenios: 7 },
    { nome: 'Teresópolis', uf: 'RJ', populacao: 186_000, captadoNoAno: 9_400_000, convenios: 6 },
    { nome: 'Barra Mansa', uf: 'RJ', populacao: 184_000, captadoNoAno: 4_100_000, convenios: 3 },
    { nome: 'Cabo Frio', uf: 'RJ', populacao: 232_000, captadoNoAno: 7_800_000, convenios: 5 },
    { nome: 'Angra dos Reis', uf: 'RJ', populacao: 207_000, captadoNoAno: 5_200_000, convenios: 4 },
  ].map((p) => ({ ...p, porHabitante: p.captadoNoAno / p.populacao }))

  const todos = [alvo, ...lista].sort((a, b) => b.porHabitante - a.porHabitante)
  return { alvo, pares: lista, posicao: todos.findIndex((p) => p.nome === alvo.nome) + 1 }
}

/* ---------- Diagnóstico ---------- */

export interface Diagnostico {
  prontos: number
  incompletos: number
  emDiligencia: number
  valorPleiteado: number
  chanceMedia: number
  proximoPrazo?: { pedido: Pedido; dias: number }
  /** Total que pode ser perdido por inércia. */
  dinheiroEmRisco: number
  /** Saldo livre dos parlamentares com base na UF. */
  saldoAoAlcance: number
}

export function diagnosticar(
  pedidos: Pedido[],
  dormindo: DinheiroDormindo[],
  parlamentares: ParlamentarLivre[],
): Diagnostico {
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
    dinheiroEmRisco: dormindo.filter((d) => d.perdeSeNaoAgir).reduce((s, d) => s + d.valor, 0),
    saldoAoAlcance: parlamentares
      .filter((p) => p.baseNaRegiao)
      .reduce((s, p) => s + p.saldoLivre, 0),
  }
}

/* ---------- 6. A base legal ---------- */

export interface Norma {
  id: string
  rotulo: string
  ementa: string
  /** Onde ela aparece no documento e por quê. */
  ondeEntra: string
}

/**
 * A biblioteca de normas que sustenta cada peça.
 *
 * É aqui que o módulo se separa da consultoria: o escritório cobra por saber
 * qual artigo citar, e esse saber envelhece a cada portaria nova. Deixar a
 * norma à vista, ligada ao parágrafo que ela sustenta, transforma o ofício de
 * "texto que alguém escreveu" em "texto que se pode conferir".
 */
export const NORMAS: Record<string, Norma> = {
  pi424: {
    id: 'pi424',
    rotulo: 'Portaria Interministerial nº 424/2016',
    ementa: 'Normas de transferências de recursos da União por convênios e contratos de repasse.',
    ondeEntra: 'Fundamenta a apresentação da proposta e a exigência de plano de trabalho.',
  },
  d6170: {
    id: 'd6170',
    rotulo: 'Decreto nº 6.170/2007',
    ementa: 'Dispõe sobre convênios, contratos de repasse e termos de execução descentralizada.',
    ondeEntra: 'Base do instrumento e da competência do ente para pactuar.',
  },
  lc101: {
    id: 'lc101',
    rotulo: 'Lei Complementar nº 101/2000',
    ementa: 'Lei de Responsabilidade Fiscal — condições para transferência voluntária.',
    ondeEntra: 'Sustenta a declaração de regularidade e a previsão de contrapartida.',
  },
  l14133: {
    id: 'l14133',
    rotulo: 'Lei nº 14.133/2021',
    ementa: 'Lei de Licitações e Contratos Administrativos.',
    ondeEntra: 'Citada quando o objeto envolve obra ou aquisição a ser licitada pelo município.',
  },
  l13019: {
    id: 'l13019',
    rotulo: 'Lei nº 13.019/2014',
    ementa: 'Marco regulatório das organizações da sociedade civil.',
    ondeEntra: 'Aplicável quando o proponente é entidade privada sem fins lucrativos.',
  },
  l9784: {
    id: 'l9784',
    rotulo: 'Lei nº 9.784/1999',
    ementa: 'Regula o processo administrativo no âmbito da Administração Pública Federal.',
    ondeEntra: 'Fundamenta a resposta a diligência e o pedido de reconsideração.',
  },
}

export type TipoPeca = 'proposta' | 'emenda' | 'diligencia' | 'reconsideracao'

export interface Peca {
  id: TipoPeca
  rotulo: string
  destinatario: string
  /** Por que esta peça existe e o que ela resolve. */
  serve: string
  normas: string[]
  /** O que a assessoria costuma cobrar para produzir isso. */
  semACleo: string
}

export const PECAS: Peca[] = [
  {
    id: 'proposta',
    rotulo: 'Apresentação de proposta',
    destinatario: 'Ministério concedente',
    serve: 'Abre o pleito no programa e amarra objeto, valor e contrapartida à norma que o rege.',
    normas: ['pi424', 'd6170', 'lc101'],
    semACleo: 'Assessoria jurídica levanta a norma vigente e redige — de dois a cinco dias.',
  },
  {
    id: 'emenda',
    rotulo: 'Pedido de indicação de emenda',
    destinatario: 'Gabinete parlamentar',
    serve: 'Sensibiliza o gabinete com o pleito já estruturado, pronto para cadastro imediato.',
    normas: ['d6170'],
    semACleo: 'Depende de contato político e de alguém que saiba o formato que o gabinete aceita.',
  },
  {
    id: 'diligencia',
    rotulo: 'Resposta a diligência',
    destinatario: 'Analista do ministério',
    serve: 'Responde item a item o que foi pedido, dentro do prazo, sem perder o lugar na fila.',
    normas: ['l9784', 'pi424'],
    semACleo: 'É onde a maioria dos pleitos morre: prazo curto e ninguém disponível para responder.',
  },
  {
    id: 'reconsideracao',
    rotulo: 'Pedido de reconsideração',
    destinatario: 'Autoridade que decidiu',
    serve: 'Reabre proposta recusada quando o motivo foi sanável, com o vício já corrigido.',
    normas: ['l9784', 'd6170'],
    semACleo: 'Raramente é feito — o município desiste e espera o programa do ano seguinte.',
  },
]

/* ---------- Redação do ofício ---------- */

export function redigirOficio(
  pedido: Pedido,
  perfil: PerfilMunicipio,
  oportunidade?: Oportunidade,
): string {
  const pct = ((pedido.contrapartida / pedido.valor) * 100).toFixed(2).replace('.', ',')
  return `OFÍCIO Nº ___/2026 — GABINETE DO PREFEITO

A Sua Senhoria
Secretário(a)-Nacional
${pedido.orgaoSigla}

Assunto: Apresentação de proposta — ${pedido.programa}

Senhor(a) Secretário(a),

1. O Município de ${perfil.nome}/${perfil.uf}, inscrito no CNPJ sob o nº __.___.___/0001-__, no uso de suas atribuições e com fundamento na Portaria Interministerial nº 424/2016 e no Decreto nº 6.170/2007, vem apresentar proposta para celebração de instrumento de repasse no âmbito do programa ${pedido.programa}.

2. O objeto pretendido é a ${pedido.objeto.toLowerCase()}, com valor global de R$ ${pedido.valor.toLocaleString('pt-BR')}, dos quais R$ ${(pedido.valor - pedido.contrapartida).toLocaleString('pt-BR')} correspondem ao repasse pleiteado e R$ ${pedido.contrapartida.toLocaleString('pt-BR')} à contrapartida municipal, equivalente a ${pct}% do valor global — percentual ${oportunidade && pedido.contrapartida / pedido.valor >= oportunidade.contrapartidaMinima ? 'superior ao mínimo exigido' : 'compatível com o exigido'} pelo normativo vigente.

3. A intervenção justifica-se pelo interesse público local, atendendo população estimada de ${perfil.populacao.toLocaleString('pt-BR')} habitantes, e encontra-se compatível com as diretrizes do programa.

4. Declara-se que o Município mantém-se regular perante os cadastros exigidos para o recebimento de transferências voluntárias e que dispõe de capacidade técnica e financeira para a execução do objeto e para o aporte da contrapartida pactuada.

5. Seguem anexos os documentos exigidos pelo normativo do programa, na ordem estabelecida pelo respectivo checklist de habilitação.

Respeitosamente,

_______________________________
Prefeito Municipal de ${perfil.nome}`
}

/**
 * Resposta a diligência — a peça que mais salva pleito.
 *
 * O ministério devolve com uma lista; o município tem dias contados para
 * responder. Quem responde item a item, na ordem em que foi perguntado, não
 * perde o lugar na fila. Quem manda um ofício genérico volta para o fim dela.
 */
export function redigirRespostaDiligencia(pedido: Pedido, perfil: PerfilMunicipio): string {
  const itens = pedido.diligencia?.itens ?? []
  const corpo = itens
    .map(
      (item, i) =>
        `${i + 2}. Quanto ao item ${i + 1} — ${item}: segue anexo o documento correspondente, produzido pela área técnica municipal e apto a suprir a exigência apontada.`,
    )
    .join('\n\n')

  return `OFÍCIO Nº ___/2026 — GABINETE DO PREFEITO

A Sua Senhoria
Coordenador(a)-Geral de Análise
${pedido.orgaoSigla}

Assunto: Resposta a diligência — proposta ${pedido.programa}

Senhor(a) Coordenador(a),

1. Em atenção à diligência exarada nos autos da proposta em epígrafe, e com fundamento no art. 3º da Lei nº 9.784/1999, o Município de ${perfil.nome}/${perfil.uf} vem, tempestivamente, apresentar os esclarecimentos e documentos a seguir, na ordem em que foram solicitados.

${corpo || '2. Seguem anexos os documentos solicitados na diligência.'}

${itens.length + 2}. Diante do exposto, requer-se o prosseguimento da análise, permanecendo o Município à disposição para quaisquer esclarecimentos adicionais que se façam necessários.

Respeitosamente,

_______________________________
Prefeito Municipal de ${perfil.nome}`
}

/** Pedido de reconsideração — quando o motivo da recusa era sanável. */
export function redigirReconsideracao(pedido: Pedido, perfil: PerfilMunicipio): string {
  return `OFÍCIO Nº ___/2026 — GABINETE DO PREFEITO

À Autoridade Julgadora
${pedido.orgaoSigla}

Assunto: Pedido de reconsideração — proposta ${pedido.programa}

Senhor(a) Autoridade,

1. O Município de ${perfil.nome}/${perfil.uf}, com fundamento no art. 56 da Lei nº 9.784/1999, vem requerer a reconsideração da decisão que não enquadrou a proposta em epígrafe, cujo objeto é a ${pedido.objeto.toLowerCase()}.

2. O motivo apontado para o não enquadramento é de natureza sanável e já foi integralmente corrigido, conforme documentação anexa, não subsistindo o óbice que motivou a decisão.

3. Registre-se que o objeto permanece aderente às diretrizes do programa e que o Município mantém a regularidade cadastral exigida pelo Decreto nº 6.170/2007, bem como a capacidade de aporte da contrapartida no percentual pactuado.

4. Ante o exposto, requer-se a reconsideração da decisão e o retorno da proposta à análise técnica, com o aproveitamento dos atos já praticados.

Respeitosamente,

_______________________________
Prefeito Municipal de ${perfil.nome}`
}

/**
 * Ofício de sensibilização a parlamentar — o pedido de emenda.
 *
 * O tratamento vai na forma flexionável — `Deputado(a)`, `Senhor(a)` — e o
 * corpo usa "Vossa Excelência", que não tem gênero. É a convenção dos modelos
 * oficiais quando quem redige não conhece o destinatário, e evita o erro que
 * um pronome adivinhado cometeria contra uma pessoa real.
 */
export function redigirPedidoEmenda(p: ParlamentarLivre, perfil: PerfilMunicipio, objeto: string): string {
  const cargo = p.casa === 'Senado' ? 'Senador(a)' : 'Deputado(a) Federal'
  const casa = p.casa === 'Senado' ? 'Senado Federal' : 'Câmara dos Deputados'
  return `OFÍCIO Nº ___/2026 — GABINETE DO PREFEITO

A Sua Excelência
${cargo} ${p.nome}
${p.partido}/${p.uf} — ${casa}

Assunto: Solicitação de indicação de emenda parlamentar

Senhor(a) Parlamentar,

1. O Município de ${perfil.nome}/${perfil.uf}, com população estimada de ${perfil.populacao.toLocaleString('pt-BR')} habitantes, vem respeitosamente solicitar a Vossa Excelência a indicação de emenda parlamentar para o custeio de ${objeto.toLowerCase()}.

2. A demanda decorre de necessidade prioritária da população local e encontra-se tecnicamente estruturada, com projeto e documentação de habilitação em ordem, apta ao imediato cadastramento no TransfereGov tão logo haja a indicação.

3. O Município encontra-se regular perante os cadastros exigidos, o que assegura celeridade na celebração do instrumento e na execução do objeto dentro do exercício.

4. Coloca-se à disposição a equipe técnica municipal para prestar quaisquer esclarecimentos e para adequar a proposta ao formato que melhor atenda ao gabinete de Vossa Excelência.

Respeitosamente,

_______________________________
Prefeito Municipal de ${perfil.nome}`
}
