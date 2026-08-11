import {
  BAIRROS,
  CARGOS_REPRESENTANTE,
  FUNDAMENTOS,
  MUNICIPIOS,
  OBJETOS,
  ORGAOS,
  PRENOMES,
  PROGRAMAS,
  SOBRENOMES,
  TIPOS_DOCUMENTO,
} from './catalogs'
import type {
  Aprovacao,
  Automacao,
  DocumentoSei,
  Empenho,
  Esfera,
  EventoTimeline,
  Gatilho,
  ItemChecklist,
  Minuta,
  ParcelaCronograma,
  Proponente,
  Proposta,
  SituacaoProposta,
  Usuario,
} from './types'

/**
 * Gerador determinístico. A mesma semente produz sempre o mesmo conjunto, para
 * que a apresentação seja idêntica em todo ensaio e em toda máquina.
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

const rand = mulberry32(20260811)
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]
const between = (min: number, max: number) => min + rand() * (max - min)
const intBetween = (min: number, max: number) => Math.floor(between(min, max + 1))
const chance = (p: number) => rand() < p

const HOJE = new Date('2026-08-11T12:00:00')

function diasAtras(dias: number): string {
  const d = new Date(HOJE)
  d.setDate(d.getDate() - dias)
  return d.toISOString()
}

function nomePessoa() {
  return `${pick(PRENOMES)} ${pick(SOBRENOMES)}`
}

function cpf() {
  const p = (n: number) => String(intBetween(0, 10 ** n - 1)).padStart(n, '0')
  return `${p(3)}.${p(3)}.${p(3)}-${p(2)}`
}

function cnpj() {
  const p = (n: number) => String(intBetween(0, 10 ** n - 1)).padStart(n, '0')
  return `${p(2)}.${p(3)}.${p(3)}/0001-${p(2)}`
}

/** Número de proposta no formato do TransfereGov: 0123456-78/2025 */
function numeroProposta(ano: number) {
  return `${String(intBetween(100000, 999999)).padStart(7, '0')}-${String(intBetween(10, 99))}/${ano}`
}

/** Número de processo SEI: 71000.012345/2026-99 */
function numeroSei(orgaoPrefixo: string) {
  return `${orgaoPrefixo}.${String(intBetween(100000, 999999))}/2026-${String(intBetween(10, 99))}`
}

const PREFIXO_SEI: Record<string, string> = { midr: '59000', mpa: '00350', mapa: '21000' }

const SITUACOES: { valor: SituacaoProposta; peso: number }[] = [
  { valor: 'Cadastrada', peso: 12 },
  { valor: 'Em análise', peso: 22 },
  { valor: 'Em complementação', peso: 14 },
  { valor: 'Aprovada', peso: 13 },
  { valor: 'Convênio celebrado', peso: 12 },
  { valor: 'Em execução', peso: 15 },
  { valor: 'Prestação de contas', peso: 7 },
  { valor: 'Rejeitada', peso: 5 },
]

function sorteiaSituacao(): SituacaoProposta {
  const total = SITUACOES.reduce((s, x) => s + x.peso, 0)
  let r = rand() * total
  for (const s of SITUACOES) {
    r -= s.peso
    if (r <= 0) return s.valor
  }
  return 'Em análise'
}

/** Situações a partir das quais já existe processo autuado no SEI. */
const COM_PROCESSO: SituacaoProposta[] = [
  'Em análise',
  'Em complementação',
  'Aprovada',
  'Convênio celebrado',
  'Em execução',
  'Prestação de contas',
  'Rejeitada',
]

export const USUARIOS: Usuario[] = [
  { id: 'u1', nome: 'Marisa Andrade Colares', cargo: 'Coordenadora-Geral', perfil: 'gestor' },
  { id: 'u2', nome: 'Diego Vasconcelos', cargo: 'Analista Técnico', perfil: 'técnico' },
  { id: 'u3', nome: 'Renata Furtado', cargo: 'Analista Técnica', perfil: 'técnico' },
  { id: 'u4', nome: 'Paulo Henrique Camargo', cargo: 'Administrador', perfil: 'admin' },
]

export const MINUTAS: Minuta[] = [
  {
    id: 'm1',
    nome: 'Termo de Análise de Proposta',
    tipo: 'Termo',
    descricao: 'Análise técnica de enquadramento da proposta ao programa.',
    campos: [
      { nome: 'parecer', origem: 'usuario', descricao: 'Parecer do analista' },
      { nome: 'percentualContrapartida', origem: 'interno', descricao: 'Contrapartida ÷ global' },
      { nome: 'valorRepasseExtenso', origem: 'interno', descricao: 'Valor por extenso' },
    ],
    usos: 0,
  },
  {
    id: 'm2',
    nome: 'Ofício de Solicitação de Complementação',
    tipo: 'Ofício',
    descricao: 'Solicita ao proponente a complementação de documentação pendente.',
    campos: [
      { nome: 'itensPendentes', origem: 'usuario', descricao: 'Itens a complementar' },
      { nome: 'prazoResposta', origem: 'interno', descricao: 'Hoje + 15 dias úteis' },
    ],
    usos: 0,
  },
  {
    id: 'm3',
    nome: 'Nota Técnica de Enquadramento',
    tipo: 'Nota Técnica',
    descricao: 'Enquadramento da proposta no programa e no fundamento legal.',
    campos: [
      { nome: 'programa', origem: 'interno', descricao: 'Programa da proposta' },
      { nome: 'fundamentoLegal', origem: 'interno', descricao: 'Fundamento legal aplicável' },
    ],
    usos: 0,
  },
  {
    id: 'm4',
    nome: 'Despacho de Encaminhamento',
    tipo: 'Despacho',
    descricao: 'Encaminha o processo à unidade competente.',
    campos: [{ nome: 'unidadeDestino', origem: 'usuario', descricao: 'Unidade de destino' }],
    usos: 0,
  },
  {
    id: 'm5',
    nome: 'Parecer Técnico Conclusivo',
    tipo: 'Parecer',
    descricao: 'Conclusão da análise com recomendação de aprovação ou rejeição.',
    campos: [
      { nome: 'recomendacao', origem: 'usuario', descricao: 'Recomendação final' },
      { nome: 'valorGlobal', origem: 'interno', descricao: 'Valor global da proposta' },
    ],
    usos: 0,
  },
]

const ESFERAS: { valor: Esfera; peso: number }[] = [
  { valor: 'Municipal', peso: 68 },
  { valor: 'Estadual', peso: 14 },
  { valor: 'Consórcio', peso: 9 },
  { valor: 'OSC', peso: 9 },
]

function sorteiaEsfera(): Esfera {
  const total = ESFERAS.reduce((s, x) => s + x.peso, 0)
  let r = rand() * total
  for (const e of ESFERAS) {
    r -= e.peso
    if (r <= 0) return e.valor
  }
  return 'Municipal'
}

function nomeProponente(esfera: Esfera, municipio: string, uf: string) {
  switch (esfera) {
    case 'Municipal':
      return `Município de ${municipio}`
    case 'Estadual':
      return `Governo do Estado — ${uf}`
    case 'Consórcio':
      return `Consórcio Intermunicipal da Região de ${municipio}`
    case 'OSC':
      return `Associação de Desenvolvimento Comunitário de ${municipio}`
  }
}

function geraProponentes(qtd: number): Proponente[] {
  const usados = new Set<string>()
  const lista: Proponente[] = []
  let i = 0
  while (lista.length < qtd && i < qtd * 6) {
    i++
    const mun = pick(MUNICIPIOS)
    const esfera = sorteiaEsfera()
    const nome = nomeProponente(esfera, mun.nome, mun.uf)
    if (usados.has(nome)) continue
    usados.add(nome)
    lista.push({
      id: `p${lista.length + 1}`,
      nome,
      cnpj: cnpj(),
      uf: mun.uf,
      municipio: mun.nome,
      esfera,
      representante: nomePessoa(),
      cpfRepresentante: cpf(),
      cargoRepresentante: pick(CARGOS_REPRESENTANTE),
    })
  }
  return lista
}

function geraEmpenhos(situacao: SituacaoProposta, valorRepasse: number): Empenho[] {
  const empenhavel: SituacaoProposta[] = ['Convênio celebrado', 'Em execução', 'Prestação de contas']
  if (!empenhavel.includes(situacao)) return []
  const qtd = intBetween(1, 3)
  const empenhos: Empenho[] = []
  let restante = valorRepasse * between(0.45, 1)
  for (let i = 0; i < qtd; i++) {
    const ultimo = i === qtd - 1
    const valor = ultimo ? restante : restante * between(0.35, 0.6)
    restante -= valor
    empenhos.push({
      id: `e${i}`,
      numero: `2026NE${String(intBetween(100, 9999)).padStart(6, '0')}`,
      data: diasAtras(intBetween(10, 400)),
      valor: Math.round(valor),
      tipo: pick(['Ordinário', 'Estimativo', 'Global'] as const),
    })
  }
  return empenhos.sort((a, b) => a.data.localeCompare(b.data))
}

function geraCronograma(valorGlobal: number): ParcelaCronograma[] {
  const qtd = intBetween(3, 6)
  const parcelas: ParcelaCronograma[] = []
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  let inicio = intBetween(0, 6)
  for (let i = 0; i < qtd; i++) {
    parcelas.push({
      id: `c${i}`,
      ordem: i + 1,
      descricao: pick([
        'Mobilização e projeto executivo',
        'Serviços preliminares e terraplenagem',
        'Execução da etapa principal',
        'Aquisição de equipamentos',
        'Instalação e testes',
        'Conclusão e recebimento',
      ]),
      mes: `${meses[(inicio + i) % 12]}/${2026 + Math.floor((inicio + i) / 12)}`,
      valor: Math.round(valorGlobal / qtd),
      executado: chance(0.4),
    })
  }
  return parcelas
}

function geraChecklist(situacao: SituacaoProposta): ItemChecklist[] {
  const base = [
    { rotulo: 'Plano de trabalho anexado', obrigatorio: true },
    { rotulo: 'Comprovante de capacidade técnica', obrigatorio: true },
    { rotulo: 'Declaração de contrapartida', obrigatorio: true },
    { rotulo: 'Certidão de regularidade fiscal', obrigatorio: true },
    { rotulo: 'Projeto básico de engenharia', obrigatorio: false },
    { rotulo: 'Licença ambiental', obrigatorio: false },
  ]
  const avancada: SituacaoProposta[] = ['Aprovada', 'Convênio celebrado', 'Em execução', 'Prestação de contas']
  return base.map((b, i) => ({
    id: `k${i}`,
    rotulo: b.rotulo,
    obrigatorio: b.obrigatorio,
    concluido: avancada.includes(situacao) ? chance(0.93) : chance(0.55),
  }))
}

function geraDocumentos(situacao: SituacaoProposta): DocumentoSei[] {
  if (!COM_PROCESSO.includes(situacao)) return []
  const qtd = intBetween(2, 7)
  const docs: DocumentoSei[] = []
  for (let i = 0; i < qtd; i++) {
    const pelaCleo = chance(0.72)
    docs.push({
      id: `d${i}`,
      numero: String(intBetween(30000000, 49999999)),
      tipo: pick(TIPOS_DOCUMENTO),
      data: diasAtras(intBetween(3, 380)),
      assinado: chance(0.68),
      minutaId: pelaCleo ? pick(MINUTAS).id : undefined,
      geradoPelaCleo: pelaCleo,
    })
  }
  return docs.sort((a, b) => a.data.localeCompare(b.data))
}

function geraTimeline(p: {
  situacao: SituacaoProposta
  dataCadastro: string
  numProcessoSei?: string
  documentos: DocumentoSei[]
}): EventoTimeline[] {
  const eventos: EventoTimeline[] = [
    {
      id: 't0',
      data: p.dataCadastro,
      titulo: 'Proposta cadastrada',
      detalhe: 'Recebida do TransfereGov e sincronizada.',
      autor: 'Cleo',
      tipo: 'sistema',
    },
  ]
  if (p.numProcessoSei) {
    eventos.push({
      id: 't1',
      data: diasAtras(intBetween(200, 380)),
      titulo: 'Processo autuado no SEI',
      detalhe: p.numProcessoSei,
      autor: 'Cleo',
      tipo: 'automacao',
    })
  }
  p.documentos.slice(0, 4).forEach((d, i) => {
    eventos.push({
      id: `t${i + 2}`,
      data: d.data,
      titulo: `${d.tipo} ${d.numero}`,
      detalhe: d.geradoPelaCleo ? 'Documento gerado a partir de minuta.' : 'Documento anexado manualmente.',
      autor: d.geradoPelaCleo ? 'Cleo' : pick(USUARIOS).nome,
      tipo: 'documento',
    })
  })
  eventos.push({
    id: 'tf',
    data: diasAtras(intBetween(1, 60)),
    titulo: `Situação: ${p.situacao}`,
    detalhe: 'Atualizada na última sincronização com o TransfereGov.',
    autor: 'Cleo',
    tipo: 'sistema',
  })
  return eventos.sort((a, b) => b.data.localeCompare(a.data))
}

function geraPropostas(proponentes: Proponente[], qtd: number): Proposta[] {
  const propostas: Proposta[] = []
  for (let i = 0; i < qtd; i++) {
    const orgao = pick(ORGAOS)
    const proponente = pick(proponentes)
    const situacao = sorteiaSituacao()
    const valorGlobal = Math.round(between(180_000, 14_500_000) / 1000) * 1000
    const pctContrapartida = between(0.02, 0.2)
    const valorContrapartida = Math.round(valorGlobal * pctContrapartida)
    const valorRepasse = valorGlobal - valorContrapartida
    const dataCadastro = diasAtras(intBetween(20, 620))
    const numProcessoSei = COM_PROCESSO.includes(situacao) ? numeroSei(PREFIXO_SEI[orgao.id]) : undefined
    const documentos = geraDocumentos(situacao)
    const objeto = pick(OBJETOS[orgao.id]).replace('{bairro}', pick(BAIRROS))

    propostas.push({
      id: `pr${i + 1}`,
      numero: numeroProposta(2025 + (chance(0.55) ? 1 : 0)),
      orgaoId: orgao.id,
      proponenteId: proponente.id,
      objeto,
      programa: pick(PROGRAMAS[orgao.id]),
      situacao,
      modalidade: pick(['Convênio', 'Contrato de repasse', 'Termo de fomento', 'Termo de colaboração'] as const),
      fundamentoLegal: pick(FUNDAMENTOS),
      valorGlobal,
      valorRepasse,
      valorContrapartida,
      dataCadastro,
      dataUltimaSincronizacao: diasAtras(intBetween(0, 4)),
      numProcessoSei,
      empenhos: geraEmpenhos(situacao, valorRepasse),
      documentos,
      cronograma: geraCronograma(valorGlobal),
      checklist: geraChecklist(situacao),
      timeline: geraTimeline({ situacao, dataCadastro, numProcessoSei, documentos }),
    })
  }
  return propostas
}

const GATILHOS: Gatilho[] = [
  'criar_processo',
  'adicionar_bloco_interno',
  'anexar_extrato_proposta',
  'anexar_contrapartidas',
  'anexar_capacidades_tecnicas',
  'criar_documento',
]

function geraAutomacoes(propostas: Proposta[]): Automacao[] {
  const automacoes: Automacao[] = []
  let n = 0
  for (const p of propostas) {
    if (!p.numProcessoSei) continue
    const qtd = intBetween(1, 6)
    for (let i = 0; i < qtd; i++) {
      const falhou = chance(0.035)
      automacoes.push({
        id: `a${++n}`,
        gatilho: pick(GATILHOS),
        propostaId: p.id,
        status: falhou ? 'FALHA' : 'SUCESSO',
        criadoEm: diasAtras(intBetween(0, 400)),
        duracaoMs: intBetween(9_000, 52_000),
        usuario: pick(USUARIOS).nome,
        resultado: falhou ? 'Sessão do SEI expirada durante a navegação' : undefined,
      })
    }
  }
  return automacoes.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
}

function geraAprovacoes(propostas: Proposta[]): Aprovacao[] {
  const candidatas = propostas.filter((p) =>
    ['Em análise', 'Em complementação', 'Cadastrada'].includes(p.situacao),
  )
  const aprovacoes: Aprovacao[] = []
  const alvo = Math.min(candidatas.length, 34)
  for (let i = 0; i < alvo; i++) {
    const p = candidatas[i]
    const tipo = pick([
      'aprovar_proposta',
      'corrigir_repasse',
      'alterar_situacao',
      'liberar_documento',
    ] as const)
    aprovacoes.push({
      id: `ap${i + 1}`,
      tipo,
      propostaId: p.id,
      solicitadoEm: diasAtras(intBetween(0, 21)),
      solicitadoPor: pick(USUARIOS.filter((u) => u.perfil === 'técnico')).nome,
      justificativa: {
        aprovar_proposta: 'Análise técnica concluída, proposta enquadrada no programa.',
        corrigir_repasse: 'Divergência entre o valor do plano de trabalho e o repasse cadastrado.',
        alterar_situacao: 'Documentação complementar recebida e conferida.',
        liberar_documento: 'Documento gerado a partir de minuta, aguardando liberação para assinatura.',
      }[tipo],
      valorAtual: tipo === 'corrigir_repasse' ? p.valorRepasse : undefined,
      valorSugerido:
        tipo === 'corrigir_repasse' ? Math.round(p.valorRepasse * between(0.88, 1.12)) : undefined,
      situacaoSugerida: tipo === 'alterar_situacao' ? 'Em análise' : undefined,
      documentoSugerido: tipo === 'liberar_documento' ? pick(MINUTAS).nome : undefined,
      decidida: 'pendente',
    })
  }
  return aprovacoes.sort((a, b) => a.solicitadoEm.localeCompare(b.solicitadoEm))
}

export const PROPONENTES = geraProponentes(190)
export const PROPOSTAS = geraPropostas(PROPONENTES, 438)
export const AUTOMACOES = geraAutomacoes(PROPOSTAS)
export const APROVACOES = geraAprovacoes(PROPOSTAS)

// Contagem de uso das minutas, derivada dos documentos efetivamente gerados.
for (const p of PROPOSTAS) {
  for (const d of p.documentos) {
    if (!d.minutaId) continue
    const m = MINUTAS.find((x) => x.id === d.minutaId)
    if (m) m.usos++
  }
}
