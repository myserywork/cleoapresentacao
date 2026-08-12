import { MUNICIPIOS, ORGAOS, PRENOMES, PROGRAMAS, SOBRENOMES } from './catalogs'
import { AUTOMACOES, MINUTAS, PROPOSTAS } from './generate'
import type {
  AcaoOrcamentaria,
  Aditivo,
  Analista,
  Diligencia,
  Emenda,
  EventoAuditoria,
  Extensao,
  MetaFisica,
  Parlamentar,
  PrestacaoContas,
  RegraGatilho,
  Rito,
  SituacaoProposta,
  StatusPrestacao,
  Vigencia,
} from './types'

/**
 * Segunda camada do gerador.
 *
 * O que a primeira versão não modelava — emenda parlamentar, execução
 * orçamentária, vigência, prestação de contas, equipe e diligência — nasce aqui,
 * derivado das propostas que já existem. Semente própria e independente: mexer
 * nesta camada não desloca nenhum dado da camada anterior.
 */

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(31415926)
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]
const between = (min: number, max: number) => min + rand() * (max - min)
const intBetween = (min: number, max: number) => Math.floor(between(min, max + 1))
const chance = (p: number) => rand() < p

/** Data de referência da demonstração — a mesma da primeira camada. */
export const HOJE = new Date('2026-08-11T12:00:00')

function deslocar(base: Date, dias: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() + dias)
  return d.toISOString()
}

const diasAtras = (dias: number) => deslocar(HOJE, -dias)
const diasAFrente = (dias: number) => deslocar(HOJE, dias)

const nomePessoa = () => `${pick(PRENOMES)} ${pick(SOBRENOMES)}`

const UFS = [...new Set(MUNICIPIOS.map((m) => m.uf))].sort()

/* ==================== Equipe ==================== */

const CARGOS_EQUIPE = [
  'Analista Técnico',
  'Analista Técnica',
  'Analista de Convênios',
  'Coordenador de Análise',
  'Coordenadora de Análise',
]

function iniciaisDe(nome: string) {
  const partes = nome.split(' ').filter((p) => p.length > 2)
  return ((partes[0]?.[0] ?? '') + (partes[partes.length - 1]?.[0] ?? '')).toUpperCase()
}

function geraEquipe(): Analista[] {
  const equipe: Analista[] = []
  for (const orgao of ORGAOS) {
    // Um gestor e quatro analistas por órgão: tamanho de coordenação real.
    const gestor = nomePessoa()
    equipe.push({
      id: `an-${orgao.id}-0`,
      nome: gestor,
      iniciais: iniciaisDe(gestor),
      cargo: 'Coordenador-Geral',
      perfil: 'gestor',
      orgaoId: orgao.id,
      capacidade: 20,
    })
    for (let i = 1; i <= 4; i++) {
      const nome = nomePessoa()
      equipe.push({
        id: `an-${orgao.id}-${i}`,
        nome,
        iniciais: iniciaisDe(nome),
        cargo: pick(CARGOS_EQUIPE),
        perfil: 'técnico',
        orgaoId: orgao.id,
        capacidade: intBetween(28, 46),
      })
    }
  }
  return equipe
}

export const EQUIPE: Analista[] = geraEquipe()

/* ==================== Parlamentares e emendas ==================== */

const PARTIDOS = [
  'PT',
  'PL',
  'MDB',
  'PSD',
  'União',
  'PP',
  'Republicanos',
  'PSDB',
  'PDT',
  'PSB',
  'Podemos',
  'PCdoB',
]

function geraParlamentares(qtd: number): Parlamentar[] {
  const lista: Parlamentar[] = []
  const usados = new Set<string>()
  let tentativas = 0
  while (lista.length < qtd && tentativas < qtd * 8) {
    tentativas++
    const nome = nomePessoa()
    if (usados.has(nome)) continue
    usados.add(nome)
    lista.push({
      id: `pl${lista.length + 1}`,
      nome,
      partido: pick(PARTIDOS),
      uf: pick(UFS),
      casa: chance(0.78) ? 'Câmara' : 'Senado',
    })
  }
  return lista
}

export const PARLAMENTARES: Parlamentar[] = geraParlamentares(52)

function geraEmendas(): Emenda[] {
  const lista: Emenda[] = []
  let n = 0
  for (const orgao of ORGAOS) {
    for (let i = 0; i < 26; i++) {
      const discricionaria = chance(0.18)
      const bancada = !discricionaria && chance(0.24)
      const parlamentar = discricionaria
        ? undefined
        : bancada
          ? // Emenda de bancada tem relator, não autor individual — usamos o
            // parlamentar como referência de UF da bancada.
            pick(PARLAMENTARES)
          : pick(PARLAMENTARES)
      lista.push({
        id: `em${++n}`,
        numero: `${String(intBetween(10000, 99999))}${String(intBetween(1000, 9999))}`,
        ano: 2025 + (chance(0.6) ? 1 : 0),
        tipo: discricionaria
          ? 'Discricionária (RP2)'
          : bancada
            ? 'Bancada (RP7)'
            : 'Individual (RP6)',
        orgaoId: orgao.id,
        parlamentarId: parlamentar?.id,
        valorIndicado: Math.round(between(400_000, 28_000_000) / 10_000) * 10_000,
      })
    }
  }
  return lista
}

export const EMENDAS: Emenda[] = geraEmendas()

/* ==================== Ações orçamentárias ==================== */

/** Código no formato do orçamento federal: 21C0, 10SG, 8865… */
function codigoAcao() {
  const letras = 'ABCDEFGHJKLMNPQRSTUV'
  return `${intBetween(1, 9)}${intBetween(0, 9)}${letras[intBetween(0, letras.length - 1)]}${intBetween(0, 9)}`
}

function geraAcoes(): AcaoOrcamentaria[] {
  const lista: AcaoOrcamentaria[] = []
  let n = 0
  for (const orgao of ORGAOS) {
    for (const programa of PROGRAMAS[orgao.id]) {
      // A dotação nasce do que as propostas do programa pedem, com folga —
      // assim o funil fecha com o dado que já está na tela.
      const doPrograma = PROPOSTAS.filter(
        (p) => p.orgaoId === orgao.id && p.programa === programa,
      )
      const demanda = doPrograma.reduce((s, p) => s + p.valorRepasse, 0)
      const dotacao = Math.round((demanda * between(0.55, 0.95)) / 100_000) * 100_000
      const empenhado = Math.round(dotacao * between(0.42, 0.88))
      const liquidado = Math.round(empenhado * between(0.5, 0.9))
      const pago = Math.round(liquidado * between(0.72, 0.98))
      lista.push({
        id: `ac${++n}`,
        codigo: codigoAcao(),
        nome: programa,
        orgaoId: orgao.id,
        programa,
        dotacao,
        empenhado,
        liquidado,
        pago,
      })
    }
  }
  return lista
}

export const ACOES: AcaoOrcamentaria[] = geraAcoes()

/* ==================== Extensões da proposta ==================== */

const COM_VIGENCIA: SituacaoProposta[] = ['Convênio celebrado', 'Em execução', 'Prestação de contas']

const DESCRICOES_META = [
  { descricao: 'Extensão de via recuperada', unidade: 'km' },
  { descricao: 'Área de contenção executada', unidade: 'm²' },
  { descricao: 'Equipamentos adquiridos', unidade: 'un' },
  { descricao: 'Famílias beneficiadas', unidade: 'famílias' },
  { descricao: 'Rede de drenagem implantada', unidade: 'm' },
  { descricao: 'Capacidade de armazenamento instalada', unidade: 't' },
  { descricao: 'Produtores atendidos', unidade: 'produtores' },
]

function geraMetas(qtd: number): MetaFisica[] {
  const metas: MetaFisica[] = []
  for (let i = 0; i < qtd; i++) {
    const base = pick(DESCRICOES_META)
    const previsto = intBetween(4, 320)
    metas.push({
      id: `mt${i}`,
      descricao: base.descricao,
      unidade: base.unidade,
      previsto,
      realizado: Math.round(previsto * between(0, 1.02)),
    })
  }
  return metas
}

/**
 * A data de fim segue a fase, não o acaso.
 *
 * Convênio em prestação de contas já venceu; em execução, uma parte relevante
 * está no fio do prazo — que é justamente a carteira que a coordenação precisa
 * enxergar. Sortear a data solta produziria uma tela de vigências vazia, o que
 * não é o que acontece em nenhum órgão real em agosto.
 */
function geraVigencia(situacao: SituacaoProposta): Vigencia {
  const duracaoMeses = intBetween(12, 36)

  let fimBase: Date
  if (situacao === 'Prestação de contas') {
    fimBase = new Date(diasAtras(intBetween(20, 300)))
  } else if (situacao === 'Em execução') {
    // A carteira em execução se distribui em três faixas: a que vence agora — a
    // que a coordenação precisa ver —, a de médio prazo e a folgada.
    fimBase = chance(0.28)
      ? new Date(deslocar(HOJE, intBetween(-40, 30)))
      : chance(0.3)
        ? new Date(deslocar(HOJE, intBetween(31, 120)))
        : new Date(deslocar(HOJE, intBetween(150, 900)))
  } else {
    fimBase = new Date(deslocar(HOJE, intBetween(150, 1000)))
  }

  const inicioDate = new Date(fimBase)
  inicioDate.setMonth(inicioDate.getMonth() - duracaoMeses)
  const inicio = inicioDate.toISOString()

  const fim = fimBase.toISOString()
  const aditivos: Aditivo[] = []

  /**
   * Os aditivos são retroativos: a data de fim acima já é a vigente, e o
   * aditivo de prazo é o que a trouxe até aqui. Gerar na ordem inversa —
   * empurrando o fim a cada aditivo — desmontaria a faixa de vencimento que a
   * fase acabou de definir.
   */
  const qtdAditivos = situacao === 'Cadastrada' ? 0 : chance(0.46) ? intBetween(1, 2) : 0
  for (let i = 0; i < qtdAditivos; i++) {
    const podePrazo = situacao !== 'Prestação de contas'
    const tipo = (podePrazo && chance(0.68) ? 'Prazo' : chance(0.6) ? 'Valor' : 'Meta') as Aditivo['tipo']
    aditivos.push({
      id: `ad${i}`,
      numero: `${i + 1}º Termo Aditivo`,
      tipo,
      // Assinado antes do fim anterior, como manda a regra de prorrogação.
      data: deslocar(fimBase, -intBetween(150, 420)),
      descricao:
        tipo === 'Prazo'
          ? 'Prorrogação do prazo de vigência por atraso na execução da etapa principal.'
          : tipo === 'Valor'
            ? 'Acréscimo de valor por revisão do projeto executivo.'
            : 'Ajuste de metas físicas sem alteração de valor.',
      novaDataFim: tipo === 'Prazo' ? fim : undefined,
      valorAcrescido: tipo === 'Valor' ? Math.round(between(30_000, 900_000)) : undefined,
    })
  }

  return { inicio, fim, aditivos }
}

const STATUS_ENCERRAMENTO: StatusPrestacao[] = [
  'Apresentada',
  'Em análise',
  'Aprovada',
  'Aprovada com ressalva',
  'Rejeitada',
]

const RESSALVAS = [
  'Divergência entre o extrato bancário e o relatório de execução financeira.',
  'Ausência de comprovante de contrapartida da terceira parcela.',
  'Nota fiscal sem identificação do número do convênio.',
  'Relatório de cumprimento do objeto sem registro fotográfico da etapa final.',
]

function geraPrestacao(vigencia: Vigencia, situacao: SituacaoProposta): PrestacaoContas | undefined {
  if (!COM_VIGENCIA.includes(situacao)) return undefined
  // Prazo legal de apresentação: 60 dias do fim da vigência.
  const prazo = deslocar(new Date(vigencia.fim), 60)
  const vencida = new Date(prazo) < HOJE

  if (situacao !== 'Prestação de contas') {
    return {
      status: vencida ? 'Aguardando apresentação' : 'Não iniciada',
      prazo,
      ressalvas: [],
      analistaId: undefined,
    }
  }

  // Mudar de fase não garante que o proponente entregou: parte da carteira em
  // prestação de contas está justamente esperando a entrega, já fora do prazo.
  if (chance(0.3)) {
    return {
      status: vencida ? 'Aguardando apresentação' : 'Não iniciada',
      prazo,
      ressalvas: [],
      analistaId: undefined,
    }
  }

  const status = pick(STATUS_ENCERRAMENTO)
  const comRessalva = status === 'Aprovada com ressalva' || status === 'Rejeitada'
  return {
    status,
    prazo,
    dataEntrega: deslocar(new Date(prazo), -intBetween(0, 45)),
    analistaId: undefined,
    ressalvas: comRessalva ? [pick(RESSALVAS)] : [],
  }
}

function geraExtensoes(): Map<string, Extensao> {
  const mapa = new Map<string, Extensao>()
  const acoesPorOrgao = new Map<string, AcaoOrcamentaria[]>()
  for (const a of ACOES) {
    if (!acoesPorOrgao.has(a.orgaoId)) acoesPorOrgao.set(a.orgaoId, [])
    acoesPorOrgao.get(a.orgaoId)!.push(a)
  }
  const emendasPorOrgao = new Map<string, Emenda[]>()
  for (const e of EMENDAS) {
    if (!emendasPorOrgao.has(e.orgaoId)) emendasPorOrgao.set(e.orgaoId, [])
    emendasPorOrgao.get(e.orgaoId)!.push(e)
  }
  const equipePorOrgao = new Map<string, Analista[]>()
  for (const a of EQUIPE.filter((x) => x.perfil === 'técnico')) {
    if (!equipePorOrgao.has(a.orgaoId)) equipePorOrgao.set(a.orgaoId, [])
    equipePorOrgao.get(a.orgaoId)!.push(a)
  }

  for (const p of PROPOSTAS) {
    const acoesDoOrgao = acoesPorOrgao.get(p.orgaoId) ?? []
    const acao =
      acoesDoOrgao.find((a) => a.programa === p.programa) ?? acoesDoOrgao[0] ?? ACOES[0]
    const emendasDoOrgao = emendasPorOrgao.get(p.orgaoId) ?? []
    // Nem toda proposta vem de emenda: o restante é dotação própria do programa.
    const emenda = chance(0.72) ? pick(emendasDoOrgao) : undefined
    const time = equipePorOrgao.get(p.orgaoId) ?? EQUIPE
    const responsavel = time[Math.floor(rand() * time.length)]

    const vigencia = COM_VIGENCIA.includes(p.situacao) ? geraVigencia(p.situacao) : undefined
    const prestacao = vigencia ? geraPrestacao(vigencia, p.situacao) : undefined
    if (prestacao && prestacao.status !== 'Não iniciada') {
      prestacao.analistaId = time[Math.floor(rand() * time.length)]?.id
    }

    mapa.set(p.id, {
      propostaId: p.id,
      emendaId: emenda?.id,
      acaoId: acao.id,
      responsavelId: responsavel.id,
      vigencia,
      prestacao,
      metas: vigencia ? geraMetas(intBetween(1, 3)) : [],
    })
  }
  return mapa
}

export const EXTENSOES: Map<string, Extensao> = geraExtensoes()

/* ==================== Diligências ==================== */

const ITENS_DILIGENCIA = [
  'Plano de trabalho com detalhamento de metas físicas',
  'Certidão negativa de débitos federais atualizada',
  'Declaração de contrapartida assinada pelo representante legal',
  'Projeto básico de engenharia com ART recolhida',
  'Planilha orçamentária com composição de custos unitários',
  'Comprovante de titularidade da área de intervenção',
  'Licença ambiental prévia ou dispensa formal',
  'Comprovante de capacidade técnica da equipe executora',
  'Cronograma físico-financeiro compatível com a vigência',
]

const ASSUNTOS_DILIGENCIA = [
  'Complementação de documentação de habilitação',
  'Ajuste do plano de trabalho',
  'Regularidade fiscal do proponente',
  'Adequação do projeto básico',
  'Compatibilização do cronograma',
]

function geraDiligencias(): Diligencia[] {
  const candidatas = PROPOSTAS.filter((p) =>
    ['Em análise', 'Em complementação', 'Cadastrada', 'Aprovada'].includes(p.situacao),
  )
  const lista: Diligencia[] = []
  for (const p of candidatas) {
    if (!chance(0.42)) continue
    const criadaHa = intBetween(3, 160)
    const prazoDias = 15
    const respondida = chance(0.52)
    const qtdItens = intBetween(1, 4)
    const itens: string[] = []
    while (itens.length < qtdItens) {
      const item = pick(ITENS_DILIGENCIA)
      if (!itens.includes(item)) itens.push(item)
    }
    const vencida = criadaHa > prazoDias && !respondida
    lista.push({
      id: `dl${lista.length + 1}`,
      propostaId: p.id,
      assunto: pick(ASSUNTOS_DILIGENCIA),
      itens,
      criadaEm: diasAtras(criadaHa),
      prazo: diasAtras(criadaHa - prazoDias),
      respondidaEm: respondida ? diasAtras(Math.max(criadaHa - intBetween(2, 30), 0)) : undefined,
      reiteracoes: vencida ? intBetween(0, 2) : 0,
      autorId: pick(EQUIPE.filter((e) => e.orgaoId === p.orgaoId)).id,
    })
  }
  return lista.sort((a, b) => b.criadaEm.localeCompare(a.criadaEm))
}

export const DILIGENCIAS: Diligencia[] = geraDiligencias()

/* ==================== Ritos de fábrica ==================== */

export const RITOS_FABRICA: Rito[] = [
  {
    id: 'rt-autuar',
    nome: 'Autuar processo no SEI',
    descricao:
      'Cria o processo administrativo no SEI a partir dos dados da proposta e devolve o número autuado.',
    sistema: 'SEI',
    passos: [
      { id: 'p1', tipo: 'abrir_sistema', rotulo: 'Abrir o SEI', parametro: 'SEI' },
      { id: 'p2', tipo: 'autenticar', rotulo: 'Autenticar com o usuário de serviço' },
      {
        id: 'p3',
        tipo: 'criar_processo',
        rotulo: 'Iniciar processo',
        parametro: 'Convênios e Congêneres: Formalização',
      },
      { id: 'p4', tipo: 'preencher_formulario', rotulo: 'Preencher especificação e interessado' },
      { id: 'p5', tipo: 'notificar', rotulo: 'Devolver o número do processo à Cleopatra' },
    ],
    fila: ['criar_processo'],
    execucoes: 0,
    taxaSucesso: 0.98,
    duracaoMediaMs: 22_000,
    publicado: true,
    autor: 'Cleopatra',
    criadoEm: diasAtras(420),
    deFabrica: true,
  },
  {
    id: 'rt-extrato',
    nome: 'Anexar extrato da proposta',
    descricao:
      'Baixa o extrato da proposta no TransfereGov e registra como documento externo no processo.',
    sistema: 'Ambos',
    passos: [
      { id: 'p1', tipo: 'abrir_sistema', rotulo: 'Abrir o TransfereGov', parametro: 'TransfereGov' },
      { id: 'p2', tipo: 'buscar_processo', rotulo: 'Localizar a proposta pelo número' },
      { id: 'p3', tipo: 'anexar_documento', rotulo: 'Baixar o extrato em PDF' },
      { id: 'p4', tipo: 'abrir_sistema', rotulo: 'Abrir o SEI', parametro: 'SEI' },
      { id: 'p5', tipo: 'anexar_documento', rotulo: 'Registrar como documento externo' },
    ],
    fila: ['anexar_extrato_proposta'],
    execucoes: 0,
    taxaSucesso: 0.96,
    duracaoMediaMs: 31_000,
    publicado: true,
    autor: 'Cleopatra',
    criadoEm: diasAtras(410),
    deFabrica: true,
  },
  {
    id: 'rt-contrapartida',
    nome: 'Anexar relatório de contrapartidas',
    descricao: 'Extrai o demonstrativo de contrapartidas e anexa ao processo.',
    sistema: 'Ambos',
    passos: [
      { id: 'p1', tipo: 'abrir_sistema', rotulo: 'Abrir o TransfereGov', parametro: 'TransfereGov' },
      { id: 'p2', tipo: 'buscar_processo', rotulo: 'Abrir a aba de contrapartidas' },
      { id: 'p3', tipo: 'anexar_documento', rotulo: 'Gerar o demonstrativo' },
      { id: 'p4', tipo: 'anexar_documento', rotulo: 'Registrar no processo do SEI' },
    ],
    fila: ['anexar_contrapartidas'],
    execucoes: 0,
    taxaSucesso: 0.97,
    duracaoMediaMs: 26_000,
    publicado: true,
    autor: 'Cleopatra',
    criadoEm: diasAtras(400),
    deFabrica: true,
  },
  {
    id: 'rt-capacidade',
    nome: 'Anexar capacidades técnicas',
    descricao: 'Reúne os comprovantes de capacidade técnica do proponente e anexa ao processo.',
    sistema: 'Ambos',
    passos: [
      { id: 'p1', tipo: 'abrir_sistema', rotulo: 'Abrir o TransfereGov', parametro: 'TransfereGov' },
      { id: 'p2', tipo: 'buscar_processo', rotulo: 'Abrir a habilitação do proponente' },
      { id: 'p3', tipo: 'anexar_documento', rotulo: 'Baixar os comprovantes' },
      { id: 'p4', tipo: 'anexar_documento', rotulo: 'Registrar no processo do SEI' },
    ],
    fila: ['anexar_capacidades_tecnicas'],
    execucoes: 0,
    taxaSucesso: 0.95,
    duracaoMediaMs: 28_000,
    publicado: true,
    autor: 'Cleopatra',
    criadoEm: diasAtras(395),
    deFabrica: true,
  },
  {
    id: 'rt-documento',
    nome: 'Redigir documento a partir de minuta',
    descricao:
      'Preenche a minuta com os dados da proposta, gera o documento no SEI e deixa pronto para assinatura.',
    sistema: 'SEI',
    passos: [
      { id: 'p1', tipo: 'abrir_sistema', rotulo: 'Abrir o SEI', parametro: 'SEI' },
      { id: 'p2', tipo: 'buscar_processo', rotulo: 'Localizar o processo da proposta' },
      { id: 'p3', tipo: 'gerar_documento', rotulo: 'Incluir documento a partir do modelo' },
      { id: 'p4', tipo: 'preencher_formulario', rotulo: 'Preencher os campos calculados' },
      { id: 'p5', tipo: 'notificar', rotulo: 'Avisar o responsável pela assinatura' },
    ],
    fila: ['criar_documento'],
    execucoes: 0,
    taxaSucesso: 0.99,
    duracaoMediaMs: 34_000,
    publicado: true,
    autor: 'Cleopatra',
    criadoEm: diasAtras(380),
    deFabrica: true,
  },
  {
    id: 'rt-bloco',
    nome: 'Incluir em bloco de assinatura',
    descricao: 'Inclui os documentos do processo no bloco interno da unidade e disponibiliza.',
    sistema: 'SEI',
    passos: [
      { id: 'p1', tipo: 'abrir_sistema', rotulo: 'Abrir o SEI', parametro: 'SEI' },
      { id: 'p2', tipo: 'buscar_processo', rotulo: 'Localizar o processo' },
      { id: 'p3', tipo: 'incluir_bloco', rotulo: 'Incluir no bloco da unidade' },
      { id: 'p4', tipo: 'notificar', rotulo: 'Disponibilizar para a chefia' },
    ],
    fila: ['adicionar_bloco_interno'],
    execucoes: 0,
    taxaSucesso: 0.98,
    duracaoMediaMs: 18_000,
    publicado: true,
    autor: 'Cleopatra',
    criadoEm: diasAtras(370),
    deFabrica: true,
  },
  {
    id: 'rt-instrucao',
    nome: 'Instrução completa da proposta',
    descricao:
      'Do zero ao termo de análise: autua, anexa extrato e contrapartidas e redige o documento.',
    sistema: 'Ambos',
    passos: [
      { id: 'p1', tipo: 'criar_processo', rotulo: 'Autuar o processo' },
      { id: 'p2', tipo: 'anexar_documento', rotulo: 'Anexar o extrato da proposta' },
      { id: 'p3', tipo: 'anexar_documento', rotulo: 'Anexar o relatório de contrapartidas' },
      { id: 'p4', tipo: 'gerar_documento', rotulo: 'Redigir o termo de análise' },
      { id: 'p5', tipo: 'incluir_bloco', rotulo: 'Incluir no bloco de assinatura' },
    ],
    fila: [
      'criar_processo',
      'anexar_extrato_proposta',
      'anexar_contrapartidas',
      'criar_documento',
      'adicionar_bloco_interno',
    ],
    execucoes: 0,
    taxaSucesso: 0.94,
    duracaoMediaMs: 128_000,
    publicado: true,
    autor: 'Cleopatra',
    criadoEm: diasAtras(300),
    deFabrica: true,
  },
  {
    id: 'rt-reiteracao',
    nome: 'Reiterar diligência vencida',
    descricao:
      'Gera o ofício de reiteração com os itens pendentes e o prazo novo, e envia para assinatura.',
    sistema: 'SEI',
    passos: [
      { id: 'p1', tipo: 'buscar_processo', rotulo: 'Localizar o processo' },
      { id: 'p2', tipo: 'gerar_documento', rotulo: 'Gerar o ofício de reiteração' },
      { id: 'p3', tipo: 'preencher_formulario', rotulo: 'Listar os itens ainda pendentes' },
      { id: 'p4', tipo: 'incluir_bloco', rotulo: 'Incluir no bloco de assinatura' },
    ],
    fila: ['criar_documento', 'adicionar_bloco_interno'],
    execucoes: 0,
    taxaSucesso: 0.97,
    duracaoMediaMs: 41_000,
    publicado: true,
    autor: 'Cleopatra',
    criadoEm: diasAtras(120),
    deFabrica: true,
  },
]

// Uso de cada rito, derivado das automações que já rodaram.
for (const rito of RITOS_FABRICA) {
  const principal = rito.fila[0]
  const doGatilho = AUTOMACOES.filter((a) => a.gatilho === principal)
  rito.execucoes =
    rito.id === 'rt-instrucao'
      ? Math.round(doGatilho.length / 4)
      : rito.id === 'rt-reiteracao'
        ? Math.round(doGatilho.length / 9)
        : doGatilho.length
  const sucessos = doGatilho.filter((a) => a.status === 'SUCESSO').length
  if (doGatilho.length > 0) rito.taxaSucesso = sucessos / doGatilho.length
}

/* ==================== Regras de gatilho ==================== */

export const REGRAS_FABRICA: RegraGatilho[] = [
  {
    id: 'rg1',
    nome: 'Autuar automaticamente proposta que entra em análise',
    ritoId: 'rt-autuar',
    condicoes: [
      { id: 'c1', campo: 'situacao', operador: 'igual', valor: 'Em análise' },
      { id: 'c2', campo: 'temProcesso', operador: 'igual', valor: 'não' },
    ],
    juncao: 'todas',
    ativa: true,
    recorrencia: 'diaria',
    horario: '03:00',
    ultimaExecucao: diasAtras(1),
    disparos: 214,
  },
  {
    id: 'rg2',
    nome: 'Instruir proposta de alto valor assim que autuada',
    ritoId: 'rt-instrucao',
    condicoes: [
      { id: 'c1', campo: 'valorGlobal', operador: 'maior', valor: '5000000' },
      { id: 'c2', campo: 'situacao', operador: 'igual', valor: 'Em análise' },
    ],
    juncao: 'todas',
    ativa: true,
    recorrencia: 'diaria',
    horario: '04:30',
    ultimaExecucao: diasAtras(1),
    disparos: 61,
  },
  {
    id: 'rg3',
    nome: 'Reiterar diligência parada há mais de 15 dias',
    ritoId: 'rt-reiteracao',
    condicoes: [{ id: 'c1', campo: 'diasParada', operador: 'maior', valor: '15' }],
    juncao: 'todas',
    ativa: true,
    recorrencia: 'semanal',
    horario: '08:00',
    ultimaExecucao: diasAtras(4),
    disparos: 87,
  },
  {
    id: 'rg4',
    nome: 'Anexar extrato de proposta em complementação',
    ritoId: 'rt-extrato',
    condicoes: [{ id: 'c1', campo: 'situacao', operador: 'igual', valor: 'Em complementação' }],
    juncao: 'todas',
    ativa: false,
    recorrencia: 'nenhuma',
    horario: '00:00',
    disparos: 0,
  },
]

/* ==================== Trilha de auditoria ==================== */

const ACESSOS = [
  'Consulta à carteira do órgão',
  'Exportação da listagem de propostas',
  'Abertura do painel de aprovações',
  'Consulta ao Cérebro',
]

function geraAuditoria(): EventoAuditoria[] {
  const eventos: EventoAuditoria[] = []
  let n = 0
  const propostaPorId = new Map(PROPOSTAS.map((p) => [p.id, p]))

  for (const a of AUTOMACOES) {
    const p = propostaPorId.get(a.propostaId)
    if (!p) continue
    const rito = RITOS_FABRICA.find((r) => r.fila[0] === a.gatilho)
    eventos.push({
      id: `au${++n}`,
      data: a.criadoEm,
      tipo: 'automacao',
      ator: a.usuario,
      acao: a.status === 'SUCESSO' ? `Executou "${rito?.nome ?? a.gatilho}"` : `Falhou em "${rito?.nome ?? a.gatilho}"`,
      alvo: p.numero,
      propostaId: p.id,
      detalhe:
        a.status === 'SUCESSO'
          ? `Concluído em ${Math.round(a.duracaoMs / 1000)}s no processo ${p.numProcessoSei ?? '—'}.`
          : (a.resultado ?? 'Falha durante a navegação.'),
    })
  }

  for (const p of PROPOSTAS) {
    for (const d of p.documentos.slice(0, 2)) {
      eventos.push({
        id: `au${++n}`,
        data: d.data,
        tipo: 'documento',
        ator: d.geradoPelaCleo ? 'Cleo' : pick(EQUIPE).nome,
        acao: d.geradoPelaCleo ? 'Gerou documento a partir de minuta' : 'Anexou documento',
        alvo: `${d.tipo} ${d.numero}`,
        propostaId: p.id,
        detalhe: d.assinado
          ? 'Documento assinado eletronicamente.'
          : 'Documento aguardando assinatura no bloco da unidade.',
      })
    }
  }

  for (const d of DILIGENCIAS) {
    const autor = EQUIPE.find((e) => e.id === d.autorId)
    const p = propostaPorId.get(d.propostaId)
    eventos.push({
      id: `au${++n}`,
      data: d.criadaEm,
      tipo: 'diligencia',
      ator: autor?.nome ?? 'Equipe',
      acao: 'Abriu diligência ao proponente',
      alvo: p?.numero ?? d.propostaId,
      propostaId: d.propostaId,
      detalhe: `${d.itens.length} item(ns) solicitado(s) — ${d.assunto}.`,
    })
  }

  for (const regra of REGRAS_FABRICA) {
    if (!regra.ultimaExecucao) continue
    eventos.push({
      id: `au${++n}`,
      data: regra.ultimaExecucao,
      tipo: 'regra',
      ator: 'Cleo',
      acao: 'Executou regra automática',
      alvo: regra.nome,
      detalhe: `${regra.disparos} disparos acumulados desde a publicação da regra.`,
    })
  }

  for (let i = 0; i < 40; i++) {
    eventos.push({
      id: `au${++n}`,
      data: diasAtras(intBetween(0, 30)),
      tipo: 'acesso',
      ator: pick(EQUIPE).nome,
      acao: pick(ACESSOS),
      alvo: pick(ORGAOS).sigla,
      detalhe: 'Registro de acesso com o perfil do usuário autenticado.',
    })
  }

  return eventos.sort((a, b) => b.data.localeCompare(a.data))
}

export const AUDITORIA: EventoAuditoria[] = geraAuditoria()

/* ==================== Uso das minutas por reiteração ==================== */

// A minuta de ofício ganha uso proporcional às diligências abertas — é ela que
// materializa a comunicação com o proponente.
const oficio = MINUTAS.find((m) => m.tipo === 'Ofício')
if (oficio) oficio.usos += DILIGENCIAS.length

export { diasAFrente }
