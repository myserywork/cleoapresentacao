import { ORGAOS } from '@/data/catalogs'

/**
 * O roteador de demanda.
 *
 * É a pergunta que trava a prefeitura antes de qualquer ofício: *a quem eu
 * peço?* O servidor sabe o que a cidade precisa — "a encosta do Alto da Serra
 * cedeu de novo" — e não sabe que isso é o programa de Contenção de Encostas do
 * MIDR, acessível por emenda de bancada, instrumentado por contrato de repasse
 * porque passa de R$ 750 mil, e que o projeto básico com ART é o documento que
 * decide se entra ou volta.
 *
 * Esse conhecimento é exatamente o que a consultoria de captação vende. Aqui
 * ele é uma função: entra a necessidade em português, sai a rota com a conta
 * aberta — inclusive as rotas descartadas e o motivo do descarte, que é o que
 * separa recomendação de adivinhação.
 *
 * Nada aqui consulta sistema externo. O léxico e as trilhas são do domínio de
 * transferências voluntárias e ficam à vista, para serem conferidos e corrigidos
 * por quem entende — que é como esse tipo de regra deve envelhecer.
 */

/* ---------- Quem pede ---------- */

export type TipoProponente = 'municipio' | 'consorcio' | 'estado' | 'osc' | 'estatal'

export interface PerfilProponente {
  id: TipoProponente
  rotulo: string
  descricao: string
  /** A norma que rege o repasse para este tipo de proponente. */
  normaBase: string
  /** Instrumentos que este proponente pode celebrar. */
  instrumentos: Instrumento[]
  /** Exigências que só existem para ele. */
  exigenciasProprias: string[]
  quemAssina: string
  /** Faixa usual de contrapartida exigida. */
  contrapartida: string
}

export const PROPONENTES: PerfilProponente[] = [
  {
    id: 'municipio',
    rotulo: 'Município',
    descricao: 'Prefeitura pleiteando recurso federal para obra, aquisição ou custeio.',
    normaBase: 'Portaria Interministerial nº 424/2016 e Decreto nº 6.170/2007',
    instrumentos: ['convenio', 'contrato_repasse'],
    exigenciasProprias: [
      'Regularidade no CAUC e no CADIN',
      'Lei orçamentária com dotação para a contrapartida',
      'Certidão de regularidade do FGTS e da Receita Federal',
    ],
    quemAssina: 'Prefeito ou secretário com delegação expressa',
    contrapartida: '2% a 4% conforme o porte e o IDHM',
  },
  {
    id: 'consorcio',
    rotulo: 'Consórcio público',
    descricao: 'Consórcio intermunicipal captando para o conjunto dos entes.',
    normaBase: 'Lei nº 11.107/2005, com a Portaria Interministerial nº 424/2016',
    instrumentos: ['convenio', 'contrato_repasse'],
    exigenciasProprias: [
      'Contrato de consórcio e protocolo de intenções ratificados por lei',
      'Contrato de rateio vigente com os entes consorciados',
      'Regularidade de todos os entes que se beneficiam do objeto',
    ],
    quemAssina: 'Presidente do consórcio',
    contrapartida: 'Rateada entre os consorciados conforme o contrato',
  },
  {
    id: 'estado',
    rotulo: 'Governo estadual',
    descricao: 'Estado ou autarquia estadual, geralmente em objetos de maior porte.',
    normaBase: 'Portaria Interministerial nº 424/2016 e Decreto nº 6.170/2007',
    instrumentos: ['convenio', 'contrato_repasse'],
    exigenciasProprias: [
      'Autorização legislativa quando o objeto envolve endividamento',
      'Comprovação de capacidade de pagamento (CAPAG) quando exigida',
    ],
    quemAssina: 'Governador ou secretário de estado com delegação',
    contrapartida: '5% a 10% — mais alta que a municipal',
  },
  {
    id: 'osc',
    rotulo: 'Organização da sociedade civil',
    descricao: 'Entidade privada sem fins lucrativos em parceria com o poder público.',
    normaBase: 'Lei nº 13.019/2014 — marco regulatório das OSC',
    instrumentos: ['termo_fomento', 'termo_colaboracao'],
    exigenciasProprias: [
      'Três anos de existência com CNPJ ativo',
      'Experiência prévia comprovada no objeto da parceria',
      'Estatuto compatível com a finalidade e dirigentes sem impedimento',
    ],
    quemAssina: 'Dirigente máximo da entidade',
    contrapartida: 'Não obrigatória — pode ser em bens ou serviços mensuráveis',
  },
  {
    id: 'estatal',
    rotulo: 'Empresa estatal',
    descricao: 'Empresa pública ou sociedade de economia mista, com regime próprio.',
    normaBase: 'Lei nº 13.303/2016 e o regulamento interno de licitações da empresa',
    instrumentos: ['instrumento_proprio', 'convenio'],
    exigenciasProprias: [
      'Aderência ao plano de negócios e à estratégia de longo prazo aprovados',
      'Parecer da área de conformidade e aprovação na alçada estatutária',
      'Enquadramento no regulamento interno de contratações',
    ],
    quemAssina: 'Diretoria colegiada, conforme a alçada do estatuto',
    contrapartida: 'Definida caso a caso pela diretoria',
  },
]

export const PROPONENTE_POR_ID = new Map(PROPONENTES.map((p) => [p.id, p]))

/* ---------- Como se pede ---------- */

export type Instrumento =
  | 'convenio'
  | 'contrato_repasse'
  | 'termo_fomento'
  | 'termo_colaboracao'
  | 'instrumento_proprio'

export const INSTRUMENTOS: Record<Instrumento, { rotulo: string; quando: string }> = {
  convenio: {
    rotulo: 'Convênio',
    quando: 'Repasse direto do órgão ao ente, sem instituição mandatária.',
  },
  contrato_repasse: {
    rotulo: 'Contrato de repasse',
    quando: 'Obra operada por instituição mandatária, que acompanha a execução física.',
  },
  termo_fomento: {
    rotulo: 'Termo de fomento',
    quando: 'Parceria com OSC em plano de trabalho proposto pela própria entidade.',
  },
  termo_colaboracao: {
    rotulo: 'Termo de colaboração',
    quando: 'Parceria com OSC em plano de trabalho proposto pela administração.',
  },
  instrumento_proprio: {
    rotulo: 'Instrumento próprio da estatal',
    quando: 'Contrato regido pelo regulamento interno, fora do regime de convênios.',
  },
}

export type Via = 'emenda' | 'programa_aberto' | 'chamamento' | 'demanda_espontanea'

export const VIAS: Record<Via, { rotulo: string; explica: string }> = {
  emenda: {
    rotulo: 'Emenda parlamentar',
    explica: 'Depende de indicação de um gabinete. É a via mais rápida quando há saldo livre.',
  },
  programa_aberto: {
    rotulo: 'Programa com seleção aberta',
    explica: 'Concorre com os demais proponentes pelo mérito e pela ordem de entrada.',
  },
  chamamento: {
    rotulo: 'Chamamento público',
    explica: 'Seleção formal de OSC, com edital, prazo e comissão julgadora.',
  },
  demanda_espontanea: {
    rotulo: 'Demanda espontânea',
    explica: 'Proposta apresentada fora de seleção, analisada conforme disponibilidade.',
  },
}

/* ---------- O que se pede ---------- */

export type TipoObjeto = 'obra' | 'aquisicao' | 'custeio' | 'estudo'

export const TIPOS_OBJETO: Record<TipoObjeto, { rotulo: string; nota: string }> = {
  obra: {
    rotulo: 'Obra',
    nota: 'Instrução mais pesada: exige projeto básico, ART e licenciamento.',
  },
  aquisicao: {
    rotulo: 'Aquisição de bens',
    nota: 'Instrução mais simples: orçamentos e declaração de guarda resolvem.',
  },
  custeio: {
    rotulo: 'Custeio e serviços',
    nota: 'Exige memória de cálculo detalhada e vedação a despesa continuada.',
  },
  estudo: {
    rotulo: 'Projeto ou estudo',
    nota: 'Costuma ser o degrau que destrava a obra no exercício seguinte.',
  },
}

/**
 * O léxico.
 *
 * As palavras são as que o servidor usa no telefone, não as do edital — é
 * justamente essa tradução que o roteador faz. Fica em texto aberto de
 * propósito: quem entende do assunto precisa conseguir corrigir uma linha sem
 * abrir o resto do sistema.
 */
const LEXICO: { tema: string; palavras: string[] }[] = [
  { tema: 'encosta', palavras: ['encosta', 'deslizamento', 'barreira', 'talude', 'morro', 'desmoronamento', 'contenção'] },
  { tema: 'drenagem', palavras: ['drenagem', 'alagamento', 'enchente', 'galeria', 'bueiro', 'boca de lobo', 'inundação', 'pluvial'] },
  { tema: 'defesa_civil', palavras: ['defesa civil', 'sirene', 'alerta', 'abrigo', 'calamidade', 'emergência', 'desastre'] },
  { tema: 'hidrica', palavras: ['barragem', 'poço', 'adutora', 'abastecimento', 'seca', 'água', 'cisterna', 'reservatório'] },
  { tema: 'regional', palavras: ['desenvolvimento regional', 'polo', 'arranjo produtivo', 'revitalização'] },
  { tema: 'patrulha', palavras: ['trator', 'patrulha', 'retroescavadeira', 'motoniveladora', 'implemento', 'maquinário', 'máquina'] },
  { tema: 'vicinal', palavras: ['vicinal', 'estrada rural', 'cascalhamento', 'escoamento', 'ponte', 'bueiro rural'] },
  { tema: 'agroindustria', palavras: ['agroindústria', 'beneficiamento', 'agregação de valor', 'packing house', 'laticínio'] },
  { tema: 'irrigacao', palavras: ['irrigação', 'irrigar', 'pivô', 'gotejamento'] },
  { tema: 'abastecimento_alimentar', palavras: ['feira', 'alimento', 'merenda', 'segurança alimentar', 'agricultura familiar'] },
  { tema: 'pesca', palavras: ['pescador', 'colônia', 'pesca', 'pescado', 'barco', 'embarcação'] },
  { tema: 'aquicultura', palavras: ['aquicultura', 'tanque-rede', 'piscicultura', 'alevino', 'tilápia'] },
  { tema: 'terminal_pesqueiro', palavras: ['terminal pesqueiro', 'entreposto', 'frigorífico de pescado', 'cais'] },
  { tema: 'ater', palavras: ['assistência técnica', 'extensão rural', 'ater', 'capacitação de produtor'] },
]

const VERBOS_OBJETO: { tipo: TipoObjeto; palavras: string[] }[] = [
  { tipo: 'obra', palavras: ['obra', 'construção', 'construir', 'execução', 'pavimentação', 'reforma', 'implantação', 'implantar', 'recuperação', 'recuperar', 'contenção', 'ampliação'] },
  { tipo: 'aquisicao', palavras: ['aquisição', 'adquirir', 'compra', 'comprar', 'equipamento', 'veículo', 'máquina', 'trator', 'kit', 'mobiliário'] },
  { tipo: 'custeio', palavras: ['capacitação', 'assistência técnica', 'curso', 'formação', 'manutenção', 'custeio', 'oficina'] },
  { tipo: 'estudo', palavras: ['projeto', 'estudo', 'plano diretor', 'levantamento', 'mapeamento', 'diagnóstico'] },
]

/** Trilha: um tema vira um programa concreto de um órgão concreto. */
interface Trilha {
  tema: string
  orgaoId: string
  programa: string
  /** Ação orçamentária — o que o TransfereGov pede no cadastro. */
  acao: string
  faixa: [number, number]
  /** Tipos de objeto que este programa aceita. */
  aceita: TipoObjeto[]
  via: Via
  prazoDias: number
  /** Documento que costuma decidir a entrada. */
  documentoChave: string
}

const TRILHAS: Trilha[] = [
  { tema: 'encosta', orgaoId: 'midr', programa: 'Contenção de Encostas em Áreas de Risco', acao: '2D6R — Apoio a obras de contenção', faixa: [800_000, 12_000_000], aceita: ['obra', 'estudo'], via: 'emenda', prazoDias: 34, documentoChave: 'Projeto básico com ART e mapeamento de risco da Defesa Civil' },
  { tema: 'drenagem', orgaoId: 'midr', programa: 'Drenagem Urbana Sustentável', acao: '10SG — Sistemas de drenagem urbana', faixa: [1_200_000, 18_000_000], aceita: ['obra', 'estudo'], via: 'programa_aberto', prazoDias: 61, documentoChave: 'Plano diretor de drenagem ou estudo hidrológico da bacia' },
  { tema: 'defesa_civil', orgaoId: 'midr', programa: 'Estruturação de Defesa Civil Municipal', acao: '21BM — Estruturação de órgãos de defesa civil', faixa: [150_000, 2_500_000], aceita: ['aquisicao', 'custeio'], via: 'programa_aberto', prazoDias: 45, documentoChave: 'Lei de criação da Coordenadoria Municipal de Defesa Civil' },
  { tema: 'hidrica', orgaoId: 'midr', programa: 'Infraestrutura Hídrica e Abastecimento', acao: '116F — Obras de infraestrutura hídrica', faixa: [900_000, 24_000_000], aceita: ['obra', 'estudo'], via: 'emenda', prazoDias: 52, documentoChave: 'Outorga de uso da água e licença ambiental' },
  { tema: 'regional', orgaoId: 'midr', programa: 'Desenvolvimento Regional Sustentável', acao: '215H — Apoio a projetos de desenvolvimento regional', faixa: [400_000, 8_000_000], aceita: ['obra', 'aquisicao', 'custeio'], via: 'demanda_espontanea', prazoDias: 90, documentoChave: 'Plano de trabalho com indicadores de resultado regional' },
  { tema: 'patrulha', orgaoId: 'mapa', programa: 'Patrulha Agrícola Mecanizada', acao: '20ZV — Aquisição de patrulha mecanizada', faixa: [300_000, 2_400_000], aceita: ['aquisicao'], via: 'emenda', prazoDias: 12, documentoChave: 'Relação de agricultores familiares e três orçamentos' },
  { tema: 'vicinal', orgaoId: 'mapa', programa: 'Recuperação de Estradas Vicinais', acao: '8931 — Recuperação de vicinais', faixa: [500_000, 6_000_000], aceita: ['obra'], via: 'emenda', prazoDias: 88, documentoChave: 'Projeto com extensão em km e declaração de domínio das vias' },
  { tema: 'agroindustria', orgaoId: 'mapa', programa: 'Agroindustrialização e Agregação de Valor', acao: '210T — Apoio à agroindustrialização', faixa: [250_000, 4_000_000], aceita: ['obra', 'aquisicao'], via: 'programa_aberto', prazoDias: 40, documentoChave: 'Projeto técnico com previsão de licenciamento sanitário' },
  { tema: 'irrigacao', orgaoId: 'mapa', programa: 'Irrigação e Uso Eficiente da Água', acao: '12QK — Apoio à agricultura irrigada', faixa: [300_000, 5_000_000], aceita: ['obra', 'aquisicao'], via: 'programa_aberto', prazoDias: 55, documentoChave: 'Outorga de uso da água e projeto de irrigação' },
  { tema: 'abastecimento_alimentar', orgaoId: 'mapa', programa: 'Agricultura Familiar e Abastecimento', acao: '20ZX — Estruturação da agricultura familiar', faixa: [200_000, 3_000_000], aceita: ['obra', 'aquisicao', 'custeio'], via: 'programa_aberto', prazoDias: 38, documentoChave: 'Relação de beneficiários com DAP ou CAF ativa' },
  { tema: 'pesca', orgaoId: 'mpa', programa: 'Assistência Técnica ao Pescador Artesanal', acao: '21C5 — Assistência técnica pesqueira', faixa: [120_000, 1_500_000], aceita: ['custeio', 'aquisicao'], via: 'programa_aberto', prazoDias: 30, documentoChave: 'Cadastro da colônia de pescadores e relação de beneficiários' },
  { tema: 'aquicultura', orgaoId: 'mpa', programa: 'Aquicultura Familiar e Cooperativismo', acao: '20ZY — Fomento à aquicultura familiar', faixa: [200_000, 1_800_000], aceita: ['obra', 'aquisicao'], via: 'programa_aberto', prazoDias: 5, documentoChave: 'Licença ambiental para aquicultura e cadastro da cooperativa' },
  { tema: 'terminal_pesqueiro', orgaoId: 'mpa', programa: 'Modernização de Terminais Pesqueiros', acao: '14XT — Modernização de terminais', faixa: [1_000_000, 15_000_000], aceita: ['obra'], via: 'emenda', prazoDias: 70, documentoChave: 'Projeto executivo e anuência do órgão gestor do terminal' },
  { tema: 'ater', orgaoId: 'mapa', programa: 'Agricultura Familiar e Abastecimento', acao: '210V — Assistência técnica e extensão rural', faixa: [150_000, 1_200_000], aceita: ['custeio'], via: 'programa_aberto', prazoDias: 46, documentoChave: 'Plano de trabalho com metodologia e número de famílias atendidas' },
]

/* ---------- A leitura ---------- */

/** Sem acento e sem caixa: "Contenção" e "contencao" precisam casar. */
function normalizar(t: string): string {
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/** Temas reconhecidos no texto, com as palavras que dispararam cada um. */
export function lerTemas(texto: string): { tema: string; achadas: string[] }[] {
  const t = normalizar(texto)
  return LEXICO.map((l) => ({
    tema: l.tema,
    achadas: l.palavras.filter((p) => t.includes(normalizar(p))),
  })).filter((x) => x.achadas.length > 0)
}

/** Tipo de objeto inferido do verbo usado, com o termo que decidiu. */
export function lerTipoObjeto(texto: string): { tipo: TipoObjeto; termo: string } | null {
  const t = normalizar(texto)
  for (const v of VERBOS_OBJETO) {
    const achou = v.palavras.find((p) => t.includes(normalizar(p)))
    if (achou) return { tipo: v.tipo, termo: achou }
  }
  return null
}

/**
 * Qual instrumento cabe.
 *
 * A regra real: OSC não celebra convênio desde a Lei 13.019; estatal não entra
 * no regime de transferências voluntárias; e obra de ente público acima da
 * faixa costuma ir por contrato de repasse, com mandatária acompanhando a
 * execução física.
 */
export function escolherInstrumento(
  proponente: TipoProponente,
  tipoObjeto: TipoObjeto,
  valor: number,
): { instrumento: Instrumento; porque: string } {
  if (proponente === 'osc') {
    return {
      instrumento: 'termo_fomento',
      porque:
        'OSC não celebra convênio desde a Lei nº 13.019/2014. Como o plano de trabalho parte da própria entidade, o instrumento é o termo de fomento.',
    }
  }
  if (proponente === 'estatal') {
    return {
      instrumento: 'instrumento_proprio',
      porque:
        'Estatal está fora do regime de transferências voluntárias: contrata pelo regulamento interno, sob a Lei nº 13.303/2016.',
    }
  }
  if (tipoObjeto === 'obra' && valor >= 750_000) {
    return {
      instrumento: 'contrato_repasse',
      porque:
        'Obra de ente público nesta faixa vai por contrato de repasse: uma instituição mandatária acompanha a execução física e libera por medição.',
    }
  }
  return {
    instrumento: 'convenio',
    porque:
      'Repasse direto do órgão ao ente, sem mandatária — é o instrumento usual para aquisição, custeio e obra de menor porte.',
  }
}

/* ---------- A rota ---------- */

export interface PassoPedido {
  ordem: number
  titulo: string
  detalhe: string
  /** Quem executa: a Cleo faz sozinha ou depende de uma decisão humana. */
  quem: 'cleo' | 'voce'
}

export interface Rota {
  id: string
  orgaoId: string
  orgaoSigla: string
  orgaoNome: string
  unidadeGestora: string
  programa: string
  acao: string
  faixa: [number, number]
  via: Via
  prazoDias: number
  documentoChave: string
  instrumento: Instrumento
  porqueInstrumento: string
  aderencia: number
  /** Sinais que sustentam a rota, em linguagem de gente. */
  porque: string[]
  /** O que pesa contra — dito antes de alguém descobrir sozinho. */
  contra: string[]
  comoPedir: PassoPedido[]
}

export interface Descartada {
  programa: string
  orgaoSigla: string
  motivo: string
}

export interface Roteamento {
  temasLidos: { tema: string; achadas: string[] }[]
  tipoObjeto: TipoObjeto
  termoQueDecidiu: string | null
  rotas: Rota[]
  descartadas: Descartada[]
}

function montarPassos(
  trilha: Trilha,
  perfil: PerfilProponente,
  instrumento: Instrumento,
  tipoObjeto: TipoObjeto,
): PassoPedido[] {
  const passos: { titulo: string; detalhe: string; quem: 'cleo' | 'voce' }[] = [
    {
      titulo: 'Conferir a regularidade do proponente',
      detalhe: `Consulta de pendências nos cadastros exigidos. Para ${perfil.rotulo.toLowerCase()}: ${perfil.exigenciasProprias[0].toLowerCase()}.`,
      quem: 'cleo',
    },
    {
      titulo: `Cadastrar a proposta no programa ${trilha.programa}`,
      detalhe: `Ação orçamentária ${trilha.acao}, na ${ORGAOS.find((o) => o.id === trilha.orgaoId)?.unidadeGestora}.`,
      quem: 'cleo',
    },
    {
      titulo: 'Montar o plano de trabalho',
      detalhe:
        'Metas físicas, cronograma físico-financeiro e memória de cálculo, no formato que o programa aceita.',
      quem: 'cleo',
    },
  ]

  if (tipoObjeto === 'obra') {
    passos.push({
      titulo: 'Anexar o projeto básico',
      detalhe: `${trilha.documentoChave}. É o documento que decide se a proposta entra na análise ou volta na triagem.`,
      quem: 'voce',
    })
  } else {
    passos.push({
      titulo: 'Anexar a documentação técnica',
      detalhe: trilha.documentoChave,
      quem: 'voce',
    })
  }

  if (trilha.via === 'emenda') {
    passos.push({
      titulo: 'Ofício ao gabinete pedindo a indicação',
      detalhe:
        'A Cleo redige o pedido para os parlamentares da bancada que ainda têm saldo livre, começando por quem já destinou recurso ao proponente.',
      quem: 'cleo',
    })
  }
  if (trilha.via === 'chamamento') {
    passos.push({
      titulo: 'Acompanhar a publicação do edital',
      detalhe: 'A parceria com OSC depende de chamamento público, com prazo e comissão julgadora.',
      quem: 'cleo',
    })
  }

  passos.push(
    {
      titulo: `Assinar e enviar (${perfil.quemAssina.toLowerCase()})`,
      detalhe: `O envio é um ato de quem responde pelo proponente. Nada sai sem essa assinatura — o instrumento será um ${INSTRUMENTOS[instrumento].rotulo.toLowerCase()}.`,
      quem: 'voce',
    },
    {
      titulo: 'Acompanhar a análise e responder diligência',
      detalhe:
        'A Cleo vigia o andamento e redige a resposta item a item assim que a diligência é aberta — o prazo é curto e é onde a maioria dos pleitos morre.',
      quem: 'cleo',
    },
  )

  return passos.map((p, i) => ({ ordem: i + 1, ...p }))
}

/**
 * A rota do pedido.
 *
 * A aderência é conta aberta, não nota de modelo: cada parcela vem de um sinal
 * que o usuário pode conferir na tela — o tema reconhecido, o tipo de objeto
 * aceito, o valor dentro da faixa, o proponente elegível.
 */
export function rotear(
  texto: string,
  proponente: TipoProponente,
  valorEstimado: number,
): Roteamento {
  const temas = lerTemas(texto)
  const leitura = lerTipoObjeto(texto)
  const tipoObjeto = leitura?.tipo ?? 'obra'
  const perfil = PROPONENTE_POR_ID.get(proponente)!

  const rotas: Rota[] = []
  const descartadas: Descartada[] = []

  for (const trilha of TRILHAS) {
    const orgao = ORGAOS.find((o) => o.id === trilha.orgaoId)!
    const match = temas.find((t) => t.tema === trilha.tema)
    if (!match) continue

    const aceitaObjeto = trilha.aceita.includes(tipoObjeto)
    const naFaixa = valorEstimado >= trilha.faixa[0] && valorEstimado <= trilha.faixa[1]
    const abaixoDaFaixa = valorEstimado < trilha.faixa[0]

    // OSC e estatal não acessam por emenda parlamentar do jeito que o ente
    // público acessa — a via muda, e isso desqualifica a trilha.
    const viaIncompativel =
      (proponente === 'osc' && trilha.via === 'emenda') || proponente === 'estatal'

    if (!aceitaObjeto) {
      descartadas.push({
        programa: trilha.programa,
        orgaoSigla: orgao.sigla,
        motivo: `O programa não aceita ${TIPOS_OBJETO[tipoObjeto].rotulo.toLowerCase()} — só ${trilha.aceita
          .map((t) => TIPOS_OBJETO[t].rotulo.toLowerCase())
          .join(' e ')}.`,
      })
      continue
    }
    if (viaIncompativel) {
      descartadas.push({
        programa: trilha.programa,
        orgaoSigla: orgao.sigla,
        motivo:
          proponente === 'estatal'
            ? 'Estatal não pleiteia transferência voluntária: contrata pelo regulamento interno.'
            : 'A via é emenda parlamentar, que se destina a ente público — a OSC entra por chamamento.',
      })
      continue
    }
    if (abaixoDaFaixa) {
      descartadas.push({
        programa: trilha.programa,
        orgaoSigla: orgao.sigla,
        motivo: `O valor estimado está abaixo do piso do programa (${(trilha.faixa[0] / 1_000_000).toFixed(1)} mi).`,
      })
      continue
    }

    const { instrumento, porque: porqueInstrumento } = escolherInstrumento(
      proponente,
      tipoObjeto,
      valorEstimado,
    )

    const porque = [
      `Reconheci "${match.achadas.join('", "')}" no que você descreveu — é o tema do programa.`,
      `O programa aceita ${TIPOS_OBJETO[tipoObjeto].rotulo.toLowerCase()}.`,
      naFaixa
        ? 'O valor estimado cabe na faixa do programa.'
        : 'O valor está acima do teto usual, mas o programa admite objeto de maior porte com justificativa.',
      `${perfil.rotulo} é proponente elegível, sob ${perfil.normaBase}.`,
    ]

    const contra: string[] = []
    if (tipoObjeto === 'obra')
      contra.push(TIPOS_OBJETO.obra.nota)
    if (trilha.prazoDias <= 15)
      contra.push(`Restam ${trilha.prazoDias} dias de prazo — é apertado para reunir os anexos.`)
    if (trilha.via === 'emenda')
      contra.push('Depende de indicação de gabinete: sem padrinho, a rota não anda.')
    if (!naFaixa) contra.push('Acima do teto usual: exige justificativa técnica reforçada.')

    rotas.push({
      id: `${trilha.orgaoId}-${trilha.tema}`,
      orgaoId: trilha.orgaoId,
      orgaoSigla: orgao.sigla,
      orgaoNome: orgao.nome,
      unidadeGestora: orgao.unidadeGestora,
      programa: trilha.programa,
      acao: trilha.acao,
      faixa: trilha.faixa,
      via: proponente === 'osc' ? 'chamamento' : trilha.via,
      prazoDias: trilha.prazoDias,
      documentoChave: trilha.documentoChave,
      instrumento,
      porqueInstrumento,
      aderencia: Math.min(
        0.42 +
          Math.min(match.achadas.length, 3) * 0.13 +
          (naFaixa ? 0.16 : 0.04) +
          (trilha.prazoDias > 20 ? 0.08 : 0),
        0.97,
      ),
      porque,
      contra,
      comoPedir: montarPassos(trilha, perfil, instrumento, tipoObjeto),
    })
  }

  return {
    temasLidos: temas,
    tipoObjeto,
    termoQueDecidiu: leitura?.termo ?? null,
    rotas: rotas.sort((a, b) => b.aderencia - a.aderencia),
    descartadas,
  }
}

/** Exemplos para quem abre a tela sem saber o que digitar. */
export const EXEMPLOS: string[] = [
  'A encosta do bairro Alto da Serra cedeu de novo na última chuva e precisamos de obra de contenção',
  'Queremos comprar trator e implementos para a patrulha agrícola da agricultura familiar',
  'As galerias pluviais do centro não dão conta e alaga toda vez que chove forte',
  'Precisamos recuperar as estradas vicinais que escoam a produção da zona rural',
  'A colônia de pescadores quer implantar tanques-rede para aquicultura',
  'Falta equipamento e sirene para a defesa civil municipal',
]
