import {
  automacoesDoOrgao,
  buscarPropostas,
  diligenciasDoOrgao,
  getProponente,
  propostasDoOrgao,
  resumoOrgao,
} from '@/data/repo'
import type { Gatilho, Proposta, SituacaoProposta } from '@/data/types'
import { data, moeda, moedaCompacta, numero } from '@/lib/format'
import type { Acao, FiltroPropostas } from '@/comandos/tipos'
import { carteirasPorParlamentar, resumoEmendas } from '@/dominio/emendas'
import { fimDeExercicio, funilDoOrgao, riscoRestosAPagar } from '@/dominio/orcamento'
import { carteiraDeVigencias, resumoPrestacoes } from '@/dominio/ciclo'
import { diasAte, diasParada } from '@/dominio/tempo'
import { cargaDaEquipe, resumoEquipe } from '@/dominio/equipe'
import { detectarAnomalias } from '@/dominio/anomalias'
import { rankingProponentes } from '@/dominio/proponentes'

/**
 * Motor de intenção.
 *
 * Recebe uma frase, consulta os dados reais e devolve — além da resposta — as
 * AÇÕES que a interface deve executar. É o que transforma o assistente de
 * "responde perguntas" em "opera a plataforma".
 */

export interface Tabela {
  colunas: string[]
  linhas: string[][]
}

export interface Grafico {
  titulo: string
  itens: { rotulo: string; valor: number }[]
  formato: 'moeda' | 'numero'
}

export interface OfertaAcao {
  rotulo: string
  acoes: Acao[]
  destacada?: boolean
}

export interface Resposta {
  texto: string
  destaque?: { rotulo: string; valor: string }[]
  tabela?: Tabela
  grafico?: Grafico
  /** Executadas imediatamente: a tela se move junto com a resposta. */
  acoes?: Acao[]
  /** Oferecidas como botão: a pessoa decide se dispara. */
  oferecidas?: OfertaAcao[]
  seguintes?: string[]
}

/** Recorte herdado da pergunta anterior, para "e no Pará?" continuar a conversa. */
export interface ContextoConversa {
  uf?: string
  situacao?: SituacaoProposta
  ultimasPropostas?: string[]
}

const SITUACOES: SituacaoProposta[] = [
  'Cadastrada',
  'Em análise',
  'Em complementação',
  'Aprovada',
  'Convênio celebrado',
  'Em execução',
  'Prestação de contas',
  'Rejeitada',
]

const UFS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
]

const NOME_UF: Record<string, string> = {
  AC: 'acre', AL: 'alagoas', AM: 'amazonas', AP: 'amapa', BA: 'bahia', CE: 'ceara',
  DF: 'distrito federal', ES: 'espirito santo', GO: 'goias', MA: 'maranhao',
  MG: 'minas gerais', MS: 'mato grosso do sul', MT: 'mato grosso', PA: 'para',
  PB: 'paraiba', PE: 'pernambuco', PI: 'piaui', PR: 'parana', RJ: 'rio de janeiro',
  RN: 'rio grande do norte', RO: 'rondonia', RR: 'roraima', RS: 'rio grande do sul',
  SC: 'santa catarina', SE: 'sergipe', SP: 'sao paulo', TO: 'tocantins',
}

const RITO_COMPLETO: Gatilho[] = [
  'criar_processo',
  'anexar_extrato_proposta',
  'anexar_contrapartidas',
  'criar_documento',
]

function normalizar(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export { diasParada }

/** Converte o recorte detectado na frase para o formato do filtro da listagem. */
function recorteDoFiltro(
  uf?: string,
  situacao?: SituacaoProposta,
  paradaHaDias?: number,
): FiltroPropostas {
  return {
    uf: uf ? [uf] : undefined,
    situacao: situacao ? [situacao] : undefined,
    paradaHaDias,
  }
}

function tabelaDePropostas(propostas: Proposta[], limite = 15): Tabela {
  return {
    colunas: ['Proposta', 'Proponente', 'UF', 'Situação', 'Valor global'],
    linhas: propostas.slice(0, limite).map((p) => {
      const prop = getProponente(p.proponenteId)
      return [p.numero, prop?.nome ?? '—', prop?.uf ?? '—', p.situacao, moeda(p.valorGlobal)]
    }),
  }
}

function detectarUf(q: string, contexto?: ContextoConversa): string | undefined {
  const porSigla = UFS.find((u) => new RegExp(`\\b${u.toLowerCase()}\\b`).test(q))
  if (porSigla) return porSigla
  // Limite de palavra também no nome: sem isso "paradas" casa com "pará"
  // e a pergunta ganha um recorte territorial que ninguém pediu.
  const porNome = Object.entries(NOME_UF).find(([, nome]) =>
    new RegExp(`\\b${nome}\\b`).test(q),
  )
  if (porNome) return porNome[0]
  // "e no Pará?" sem sujeito: herda o recorte anterior
  if (/^(e |e no |e na |e em )/.test(q) && contexto?.uf) return contexto.uf
  return undefined
}

function ofertasParaProposta(p: Proposta): OfertaAcao[] {
  const ofertas: OfertaAcao[] = [
    {
      rotulo: 'Abrir a proposta',
      acoes: [{ tipo: 'abrir-proposta', propostaId: p.id }],
    },
  ]
  if (!p.numProcessoSei) {
    ofertas.push({
      rotulo: 'Criar o processo no SEI',
      destacada: true,
      acoes: [{ tipo: 'executar-automacao', propostaId: p.id, gatilho: 'criar_processo' }],
    })
  } else {
    ofertas.push({
      rotulo: 'Gerar o documento',
      destacada: true,
      acoes: [{ tipo: 'executar-automacao', propostaId: p.id, gatilho: 'criar_documento' }],
    })
  }
  ofertas.push({
    rotulo: 'Ver no Cérebro',
    acoes: [{ tipo: 'focar-no-cerebro', noId: `pr:${p.id}` }],
  })
  return ofertas
}

export function responder(
  pergunta: string,
  orgaoId: string,
  contexto: ContextoConversa = {},
): { resposta: Resposta; contexto: ContextoConversa } {
  const q = normalizar(pergunta)
  const resumo = resumoOrgao(orgaoId)
  const propostas = propostasDoOrgao(orgaoId)

  const uf = detectarUf(q, contexto)
  const situacao =
    SITUACOES.find((s) => q.includes(normalizar(s))) ??
    (/^(e |e no |e na )/.test(q) ? contexto.situacao : undefined)

  const pedeParadas = /(parad|travad|sem andament|encalhad|atrasad)/.test(q)
  const diasNoTexto = q.match(/(\d+)\s*dias?/)
  const limiteParada = pedeParadas ? Number(diasNoTexto?.[1] ?? 30) : undefined

  const novoContexto: ContextoConversa = { uf, situacao }

  /* ---------- Intenções de AÇÃO ---------- */

  // Rito completo sobre a proposta em foco
  if (/(rito|processo inteiro|tudo|instru(c|ç)(a|ã)o completa|do come(c|ç)o ao fim)/.test(q) &&
      /(rod|execut|faz|toca)/.test(q)) {
    const alvo = propostas.find((p) => !p.numProcessoSei) ?? propostas[0]
    const prop = getProponente(alvo.proponenteId)
    return {
      contexto: novoContexto,
      resposta: {
        texto: `Posso instruir a proposta ${alvo.numero}, de ${prop?.nome}, do começo ao fim: autuo o processo no SEI, anexo o extrato e as contrapartidas, e gero o termo de análise. São quatro automações na ordem certa.`,
        oferecidas: [
          {
            rotulo: 'Executar o rito completo',
            destacada: true,
            acoes: [{ tipo: 'executar-rito', propostaId: alvo.id, gatilhos: RITO_COMPLETO }],
          },
          { rotulo: 'Abrir a proposta antes', acoes: [{ tipo: 'abrir-proposta', propostaId: alvo.id }] },
        ],
      },
    }
  }

  // Gerar documento / criar processo sobre "a primeira" ou uma proposta citada
  if (/(gera|gere|cria|crie|emite|emita)/.test(q) && /(oficio|documento|termo|processo|minuta)/.test(q)) {
    const candidatas = filtrar(propostas, recorteDoFiltro(uf, situacao, limiteParada))
    const alvo =
      candidatas[0] ??
      buscarPropostas(orgaoId, pergunta)[0] ??
      propostas[0]
    const prop = getProponente(alvo.proponenteId)
    const querProcesso = /processo/.test(q) && !/documento|oficio|termo|minuta/.test(q)
    const gatilho: Gatilho = querProcesso ? 'criar_processo' : 'criar_documento'

    return {
      contexto: { ...novoContexto, ultimasPropostas: [alvo.id] },
      resposta: {
        texto: querProcesso
          ? `Vou autuar o processo no SEI para a proposta ${alvo.numero}, de ${prop?.nome}.`
          : `Vou gerar o Termo de Análise de Proposta para a ${alvo.numero}, de ${prop?.nome}, já preenchido com os dados do processo.`,
        acoes: [
          { tipo: 'abrir-proposta', propostaId: alvo.id, aba: 'Automações', motivo: `Abrindo a proposta ${alvo.numero}` },
          { tipo: 'executar-automacao', propostaId: alvo.id, gatilho, motivo: 'Disparando a automação' },
        ],
      },
    }
  }

  // Abrir uma proposta específica
  if (/(abr[ea]|mostra a proposta|ver a proposta|detalh)/.test(q)) {
    const alvo = buscarPropostas(orgaoId, pergunta.replace(/(abr[ea]|mostrar?|ver|proposta|a|o)/g, ' '))[0]
    if (alvo) {
      const prop = getProponente(alvo.proponenteId)
      return {
        contexto: { ...novoContexto, ultimasPropostas: [alvo.id] },
        resposta: {
          texto: `Abrindo a proposta ${alvo.numero}, de ${prop?.nome}.`,
          acoes: [{ tipo: 'abrir-proposta', propostaId: alvo.id, motivo: 'Abrindo a proposta' }],
        },
      }
    }
  }

  /* ---------- Emendas e parlamentares ---------- */

  if (/(emenda|parlamentar|deputad|senador|gabinete|bancada|rp6|rp7)/.test(q)) {
    const resumoEm = resumoEmendas(orgaoId)
    const carteiras = carteirasPorParlamentar(orgaoId)
    const topo = carteiras[0]

    return {
      contexto: novoContexto,
      resposta: {
        texto: `${numero(resumoEm.totalEmendas)} emendas de ${numero(resumoEm.parlamentares)} parlamentares apontam para este órgão, somando ${moeda(resumoEm.valorIndicado)} indicados. ${(resumoEm.execucao * 100).toFixed(0)}% já viraram empenho.${topo ? ` A carteira com maior pressão é a de ${topo.parlamentar.nome} (${topo.parlamentar.partido}/${topo.parlamentar.uf}), com ${topo.paradas} proposta(s) sem andamento.` : ''}`,
        destaque: [
          { rotulo: 'Indicado', valor: moedaCompacta(resumoEm.valorIndicado) },
          { rotulo: 'Empenhado', valor: moedaCompacta(resumoEm.valorEmpenhado) },
          { rotulo: 'Execução', valor: `${(resumoEm.execucao * 100).toFixed(0)}%` },
        ],
        tabela: {
          colunas: ['Parlamentar', 'Emendas', 'Propostas', 'Indicado', 'Execução', 'Paradas'],
          linhas: carteiras.slice(0, 10).map((c) => [
            `${c.parlamentar.nome} (${c.parlamentar.partido}/${c.parlamentar.uf})`,
            numero(c.emendas.length),
            numero(c.propostas.length),
            moeda(c.valorIndicado),
            `${(c.execucao * 100).toFixed(0)}%`,
            numero(c.paradas),
          ]),
        },
        oferecidas: [
          { rotulo: 'Abrir a carteira de emendas', acoes: [{ tipo: 'navegar', para: '/emendas' }] },
          ...(topo
            ? [
                {
                  rotulo: `Abrir a ficha de ${topo.parlamentar.nome.split(' ')[0]}`,
                  destacada: true,
                  acoes: [
                    { tipo: 'navegar' as const, para: `/parlamentares/${topo.parlamentar.id}` },
                  ],
                },
              ]
            : []),
        ],
        seguintes: ['Quanto falta empenhar até dezembro?', 'Quais convênios vencem em 30 dias?'],
      },
    }
  }

  /* ---------- Orçamento e fim de exercício ---------- */

  if (/(orcamento|dotacao|liquidad|pago|restos a pagar|fim de exercicio|empenhar|dezembro|saldo)/.test(q)) {
    const funil = funilDoOrgao(orgaoId)
    const fim = fimDeExercicio(orgaoId)
    const restos = riscoRestosAPagar(orgaoId)

    return {
      contexto: novoContexto,
      resposta: {
        texto: `Da dotação de ${moeda(funil.dotacao)}, ${moeda(funil.empenhado)} foram empenhados e ${moeda(funil.pago)} efetivamente pagos. Restam ${fim.diasUteis} dias úteis e ${moeda(fim.saldoAEmpenhar)} a empenhar — ${moedaCompacta(fim.ritmoNecessario)} por dia útil. ${fim.emRisco ? 'O ritmo praticado no ano não fecha essa conta.' : 'O ritmo praticado no ano dá conta desse saldo.'}`,
        destaque: [
          { rotulo: 'Saldo a empenhar', valor: moedaCompacta(fim.saldoAEmpenhar) },
          { rotulo: 'Dias úteis', valor: numero(fim.diasUteis) },
          { rotulo: 'A liquidar', valor: moedaCompacta(restos.total) },
        ],
        grafico: {
          titulo: 'Funil de execução orçamentária',
          formato: 'moeda',
          itens: funil.degraus.map((d) => ({ rotulo: d.rotulo, valor: d.valor })),
        },
        oferecidas: [
          {
            rotulo: 'Abrir a execução orçamentária',
            destacada: true,
            acoes: [{ tipo: 'navegar', para: '/orcamento' }],
          },
        ],
        seguintes: ['Simular empenho das maiores', 'Quanto vira restos a pagar?'],
      },
    }
  }

  /* ---------- Vigência ---------- */

  if (/(vigencia|vencend|vence|prorrog|aditiv|expira)/.test(q)) {
    const carteira = carteiraDeVigencias(orgaoId)
    const vencidas = carteira.filter((v) => v.situacao.diasRestantes < 0)
    const em30 = carteira.filter(
      (v) => v.situacao.diasRestantes >= 0 && v.situacao.diasRestantes <= 30,
    )

    return {
      contexto: novoContexto,
      resposta: {
        texto: `${numero(em30.length)} convênios vencem nos próximos 30 dias e ${numero(vencidas.length)} já estão com a vigência encerrada. Prorrogar depois da data exige processo próprio — a decisão precisa sair antes.`,
        destaque: [
          { rotulo: 'Vencem em 30 dias', valor: numero(em30.length) },
          { rotulo: 'Já vencidos', valor: numero(vencidas.length) },
          { rotulo: 'Com vigência', valor: numero(carteira.length) },
        ],
        tabela: {
          colunas: ['Proposta', 'Proponente', 'Fim da vigência', 'Prazo', 'Meta física'],
          linhas: [...em30, ...vencidas].slice(0, 12).map((v) => [
            v.proposta.numero,
            getProponente(v.proposta.proponenteId)?.nome ?? '—',
            data(v.situacao.vigencia.fim),
            v.situacao.diasRestantes < 0
              ? `${Math.abs(v.situacao.diasRestantes)} dias vencida`
              : `${v.situacao.diasRestantes} dias`,
            `${(v.execucaoFisica * 100).toFixed(0)}%`,
          ]),
        },
        oferecidas: [
          {
            rotulo: 'Abrir a régua de vencimento',
            destacada: true,
            acoes: [{ tipo: 'navegar', para: '/vigencias' }],
          },
        ],
        seguintes: ['Quais estão com prestação de contas atrasada?'],
      },
    }
  }

  /* ---------- Prestação de contas ---------- */

  if (/(prestacao|prestacoes|contas|inadimpl|bloquead|comprovac)/.test(q)) {
    const contas = resumoPrestacoes(orgaoId)
    return {
      contexto: novoContexto,
      resposta: {
        texto: `${numero(contas.atrasadas)} prestações de contas estão com o prazo legal vencido e ${numero(contas.emAnalise)} aguardam análise da casa. A inadimplência impede ${numero(contas.proponentesBloqueados)} proponentes de receber nova transferência, o que trava ${moeda(contas.valorBloqueado)}.`,
        destaque: [
          { rotulo: 'Em atraso', valor: numero(contas.atrasadas) },
          { rotulo: 'Proponentes travados', valor: numero(contas.proponentesBloqueados) },
          { rotulo: 'Valor bloqueado', valor: moedaCompacta(contas.valorBloqueado) },
        ],
        oferecidas: [
          {
            rotulo: 'Abrir a prestação de contas',
            destacada: true,
            acoes: [{ tipo: 'navegar', para: '/contas' }],
          },
        ],
        seguintes: ['Quais convênios vencem em 30 dias?', 'Quem são os proponentes com pior histórico?'],
      },
    }
  }

  /* ---------- Equipe ---------- */

  if (/(equipe|analista|carga|carteira de quem|sobrecarr|distribu|quem cuida)/.test(q)) {
    const carga = cargaDaEquipe(orgaoId)
    const resumoEq = resumoEquipe(orgaoId)
    const cheio = carga[0]

    return {
      contexto: novoContexto,
      resposta: {
        texto: `A equipe tem ${resumoEq.pessoas} analistas com ocupação média de ${(resumoEq.ocupacaoMedia * 100).toFixed(0)}%.${cheio ? ` ${cheio.analista.nome} está com ${cheio.qtd} propostas — ${(cheio.ocupacao * 100).toFixed(0)}% da capacidade declarada.` : ''} A distância entre a ponta mais cheia e a mais folgada é de ${(resumoEq.desequilibrio * 100).toFixed(0)} pontos.`,
        destaque: [
          { rotulo: 'Ocupação média', valor: `${(resumoEq.ocupacaoMedia * 100).toFixed(0)}%` },
          { rotulo: 'Desequilíbrio', valor: `${(resumoEq.desequilibrio * 100).toFixed(0)} p.p.` },
          { rotulo: 'Propostas atribuídas', valor: numero(resumoEq.atribuidas) },
        ],
        grafico: {
          titulo: 'Propostas por analista',
          formato: 'numero',
          itens: carga.map((c) => ({ rotulo: c.analista.nome, valor: c.qtd })),
        },
        oferecidas: [
          {
            rotulo: 'Abrir a carga da equipe',
            destacada: true,
            acoes: [{ tipo: 'navegar', para: '/equipe' }],
          },
        ],
        seguintes: ['Como redistribuir a carteira?'],
      },
    }
  }

  /* ---------- Diligências ---------- */

  if (/(diligencia|oficio|complementac|cobrar|reiterar|respondeu)/.test(q)) {
    const todas = diligenciasDoOrgao(orgaoId)
    const abertas = todas.filter((d) => !d.respondidaEm)
    const vencidas = abertas.filter((d) => diasAte(d.prazo) < 0)

    return {
      contexto: novoContexto,
      resposta: {
        texto: `${numero(abertas.length)} diligências aguardam resposta do proponente, e ${numero(vencidas.length)} já passaram do prazo de 15 dias. Posso redigir o ofício de reiteração de todas as vencidas de uma vez.`,
        destaque: [
          { rotulo: 'Aguardando resposta', valor: numero(abertas.length) },
          { rotulo: 'Prazo vencido', valor: numero(vencidas.length) },
          { rotulo: 'Respondidas', valor: numero(todas.length - abertas.length) },
        ],
        oferecidas: [
          {
            rotulo: 'Abrir a caixa de diligências',
            destacada: true,
            acoes: [{ tipo: 'navegar', para: '/diligencias' }],
          },
        ],
        seguintes: ['Reiterar as diligências vencidas'],
      },
    }
  }

  /* ---------- Padrões e anomalias ---------- */

  if (/(padrao|padroes|anomalia|irregular|suspeit|repetid|fracionament|concentrac)/.test(q)) {
    const achados = detectarAnomalias(orgaoId)
    return {
      contexto: novoContexto,
      resposta: {
        texto:
          achados.length > 0
            ? `Encontrei ${achados.length} padrões na carteira que pedem conferência. O mais relevante: ${achados[0].titulo.toLowerCase()} — ${achados[0].descricao}`
            : 'Não encontrei padrão relevante na carteira deste órgão com as regras atuais.',
        tabela:
          achados.length > 0
            ? {
                colunas: ['Padrão', 'Propostas', 'Valor', 'Severidade'],
                linhas: achados
                  .slice(0, 8)
                  .map((a) => [
                    a.titulo,
                    numero(a.propostas.length),
                    moeda(a.valor),
                    a.severidade,
                  ]),
              }
            : undefined,
        oferecidas: [
          {
            rotulo: 'Examinar os padrões',
            destacada: true,
            acoes: [{ tipo: 'navegar', para: '/padroes' }],
          },
        ],
      },
    }
  }

  /* ---------- Proponentes ---------- */

  if (/(proponente|municipio consegue|capacidade|historico do|confiavel|inadimplente)/.test(q)) {
    const ranking = rankingProponentes(orgaoId, 10)
    return {
      contexto: novoContexto,
      resposta: {
        texto: `Os dez proponentes com maior valor pactuado neste órgão. A nota de capacidade combina execução física, pontualidade em prestação de contas, inadimplência, resposta a diligência e experiência — com os pesos à vista na ficha.`,
        tabela: {
          colunas: ['Proponente', 'Município', 'Propostas', 'Valor', 'Capacidade'],
          linhas: ranking.map((r) => [
            r.proponente.nome,
            `${r.proponente.municipio}/${r.proponente.uf}`,
            numero(r.qtd),
            moeda(r.valor),
            `${r.score}/100${r.inadimplente ? ' · inadimplente' : ''}`,
          ]),
        },
        oferecidas: ranking[0]
          ? [
              {
                rotulo: 'Abrir a ficha do primeiro',
                destacada: true,
                acoes: [{ tipo: 'navegar', para: `/proponentes/${ranking[0].proponente.id}` }],
              },
            ]
          : undefined,
      },
    }
  }

  /* ---------- Propostas paradas ---------- */

  if (limiteParada !== undefined) {
    const paradas = filtrar(propostas, recorteDoFiltro(uf, situacao, limiteParada)).sort(
      (a, b) => diasParada(b) - diasParada(a),
    )
    const recorte = uf ? ` no ${uf}` : ''
    const alvo = paradas[0]

    return {
      contexto: { ...novoContexto, ultimasPropostas: paradas.slice(0, 5).map((p) => p.id) },
      resposta: {
        texto: `${numero(paradas.length)} propostas${recorte} estão sem movimento há mais de ${limiteParada} dias, somando ${moeda(paradas.reduce((s, p) => s + p.valorGlobal, 0))}. A mais antiga parou há ${alvo ? diasParada(alvo) : 0} dias.`,
        destaque: [
          { rotulo: 'Paradas', valor: numero(paradas.length) },
          { rotulo: 'Valor retido', valor: moedaCompacta(paradas.reduce((s, p) => s + p.valorGlobal, 0)) },
          { rotulo: 'Mais antiga', valor: `${alvo ? diasParada(alvo) : 0} dias` },
        ],
        tabela: {
          colunas: ['Proposta', 'Proponente', 'UF', 'Situação', 'Parada há'],
          linhas: paradas.slice(0, 12).map((p) => {
            const prop = getProponente(p.proponenteId)
            return [p.numero, prop?.nome ?? '—', prop?.uf ?? '—', p.situacao, `${diasParada(p)} dias`]
          }),
        },
        acoes: [
          {
            tipo: 'filtrar-propostas',
            filtro: { uf: uf ? [uf] : undefined, paradaHaDias: limiteParada, ordenarPor: 'parada' },
            motivo: 'Filtrando a listagem pelas propostas paradas',
          },
        ],
        oferecidas: alvo ? ofertasParaProposta(alvo) : undefined,
        seguintes: [
          'Executar o rito completo na mais antiga',
          uf ? 'E nas outras UFs?' : 'Quais UFs concentram isso?',
        ],
      },
    }
  }

  /* ---------- Automações e ganho de tempo ---------- */

  if (/(automa|robo|cleo fez|executou|economi|tempo|hora)/.test(q)) {
    const automacoes = automacoesDoOrgao(orgaoId)
    const sucesso = automacoes.filter((a) => a.status === 'SUCESSO').length
    return {
      contexto: novoContexto,
      resposta: {
        texto: `Executei ${numero(sucesso)} automações neste órgão e gerei ${numero(resumo.documentosGerados)} documentos a partir de minutas. São cerca de ${numero(resumo.horasEconomizadas)} horas de trabalho manual devolvidas à equipe.`,
        destaque: [
          { rotulo: 'Automações concluídas', valor: numero(sucesso) },
          { rotulo: 'Documentos gerados', valor: numero(resumo.documentosGerados) },
          { rotulo: 'Horas devolvidas', valor: `${numero(resumo.horasEconomizadas)} h` },
        ],
        seguintes: ['Mostre o antes e depois', 'Quais propostas estão paradas há 30 dias?'],
      },
    }
  }

  /* ---------- Empenhos ---------- */

  if (/(empenh)/.test(q)) {
    return {
      contexto: novoContexto,
      resposta: {
        texto: `Foram emitidos ${numero(resumo.qtdEmpenhos)} empenhos, somando ${moeda(resumo.totalEmpenhado)} — ${((resumo.totalEmpenhado / resumo.valorRepasse) * 100).toFixed(1)}% do repasse previsto.`,
        destaque: [
          { rotulo: 'Total empenhado', valor: moedaCompacta(resumo.totalEmpenhado) },
          { rotulo: 'Repasse previsto', valor: moedaCompacta(resumo.valorRepasse) },
          { rotulo: 'Empenhos', valor: numero(resumo.qtdEmpenhos) },
        ],
      },
    }
  }

  /* ---------- Rankings ---------- */

  if (/(por uf|por estado|estados|uf|onde|regi|territ)/.test(q) && !uf) {
    return {
      contexto: novoContexto,
      resposta: {
        texto: 'As UFs com maior volume financeiro:',
        grafico: {
          titulo: 'Valor global por UF',
          formato: 'moeda',
          itens: resumo.porUf.slice(0, 10).map((u) => ({ rotulo: u.uf, valor: u.valor })),
        },
        tabela: {
          colunas: ['UF', 'Propostas', 'Valor global'],
          linhas: resumo.porUf.slice(0, 10).map((u) => [u.uf, numero(u.qtd), moeda(u.valor)]),
        },
        seguintes: ['Mostre no mapa', 'E as propostas paradas há 30 dias?'],
      },
    }
  }

  if (/(programa)/.test(q)) {
    return {
      contexto: novoContexto,
      resposta: {
        texto: 'Distribuição por programa:',
        grafico: {
          titulo: 'Valor global por programa',
          formato: 'moeda',
          itens: resumo.porPrograma.map((p) => ({ rotulo: p.programa, valor: p.valor })),
        },
      },
    }
  }

  if (/(maior|maiores|top|ranking|caras)/.test(q)) {
    const ordenadas = filtrar(propostas, recorteDoFiltro(uf, situacao)).sort((a, b) => b.valorGlobal - a.valorGlobal)
    return {
      contexto: { ...novoContexto, ultimasPropostas: ordenadas.slice(0, 5).map((p) => p.id) },
      resposta: {
        texto: `As dez propostas de maior valor global${uf ? ` no ${uf}` : ''}:`,
        tabela: tabelaDePropostas(ordenadas, 10),
        acoes: [
          {
            tipo: 'filtrar-propostas',
            filtro: { uf: uf ? [uf] : undefined, ordenarPor: 'valor' },
            motivo: 'Ordenando a listagem por valor',
          },
        ],
        oferecidas: ordenadas[0] ? ofertasParaProposta(ordenadas[0]) : undefined,
      },
    }
  }

  /* ---------- Contagem e valor ---------- */

  if (situacao || uf || /(quantas|quantos|total|valor|soma|carteira)/.test(q)) {
    const filtradas = filtrar(propostas, recorteDoFiltro(uf, situacao))
    const valor = filtradas.reduce((s, p) => s + p.valorGlobal, 0)
    const repasse = filtradas.reduce((s, p) => s + p.valorRepasse, 0)
    const recorte = [situacao && `em "${situacao}"`, uf && `no ${uf}`].filter(Boolean).join(' ')

    return {
      contexto: { ...novoContexto, ultimasPropostas: filtradas.slice(0, 5).map((p) => p.id) },
      resposta: {
        texto: `${numero(filtradas.length)} propostas${recorte ? ` ${recorte}` : ''}, somando ${moeda(valor)} em valor global.`,
        destaque: [
          { rotulo: 'Propostas', valor: numero(filtradas.length) },
          { rotulo: 'Valor global', valor: moedaCompacta(valor) },
          { rotulo: 'Repasse', valor: moedaCompacta(repasse) },
        ],
        tabela: filtradas.length > 0 ? tabelaDePropostas(filtradas) : undefined,
        acoes: [
          {
            tipo: 'filtrar-propostas',
            filtro: { uf: uf ? [uf] : undefined, situacao: situacao ? [situacao] : undefined },
            motivo: 'Aplicando o recorte na listagem',
          },
        ],
        seguintes: [
          uf ? `Quais estão paradas há 30 dias no ${uf}?` : 'Quais estão paradas há 30 dias?',
          'Mostre as dez maiores',
        ],
      },
    }
  }

  /* ---------- Busca livre ---------- */

  const encontradas = buscarPropostas(orgaoId, pergunta)
  if (encontradas.length > 0) {
    return {
      contexto: { ...novoContexto, ultimasPropostas: encontradas.slice(0, 5).map((p) => p.id) },
      resposta: {
        texto: `${numero(encontradas.length)} propostas relacionadas a "${pergunta.trim()}".`,
        tabela: tabelaDePropostas(encontradas),
        oferecidas: ofertasParaProposta(encontradas[0]),
      },
    }
  }

  return {
    contexto: novoContexto,
    resposta: {
      texto:
        'Não consegui montar essa resposta. Posso mostrar volume e valor da carteira, recortes por situação e UF, propostas paradas, empenhos e rankings — e também executar automações para você.',
      seguintes: [
        'Quais propostas estão paradas há 30 dias?',
        'Mostre as dez maiores',
        'O que você já automatizou?',
      ],
    },
  }
}

export function filtrar(propostas: Proposta[], filtro: FiltroPropostas): Proposta[] {
  let lista = propostas.filter((p) => {
    if (filtro.situacao?.length && !filtro.situacao.includes(p.situacao)) return false
    if (filtro.uf?.length) {
      const prop = getProponente(p.proponenteId)
      if (!prop || !filtro.uf.includes(prop.uf)) return false
    }
    if (filtro.paradaHaDias !== undefined && diasParada(p) < filtro.paradaHaDias) return false
    return true
  })

  if (filtro.ordenarPor === 'valor') lista = [...lista].sort((a, b) => b.valorGlobal - a.valorGlobal)
  if (filtro.ordenarPor === 'parada') lista = [...lista].sort((a, b) => diasParada(b) - diasParada(a))
  if (filtro.ordenarPor === 'recencia')
    lista = [...lista].sort((a, b) => b.dataCadastro.localeCompare(a.dataCadastro))

  return lista
}

export function paraCsv(tabela: Tabela): string {
  const escapar = (v: string) => `"${v.replace(/"/g, '""')}"`
  return [tabela.colunas, ...tabela.linhas].map((l) => l.map(escapar).join(';')).join('\n')
}
