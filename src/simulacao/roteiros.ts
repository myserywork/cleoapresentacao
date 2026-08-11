import type { Gatilho } from '@/data/types'
import type { Passo, RoteiroSimulacao } from './tipos'

export interface ContextoSimulacao {
  numeroProposta: string
  proponente: string
  uf: string
  objeto: string
  programa: string
  numProcesso: string
  orgaoSigla: string
  unidade: string
  valorRepasse: string
  valorGlobal: string
  contrapartida: string
  minuta: string
  bloco: string
  usuarioSei: string
  documentoGerado: string
}

const MENU_SEI = 'Iniciar Processo'

/** Passos de abertura, comuns a toda automação que entra no SEI. */
function entradaNoSei(ctx: ContextoSimulacao): Passo[] {
  return [
    {
      id: 'abrir',
      rotulo: 'Abrindo o navegador',
      detalhe: 'Sessão isolada, sem rastro no perfil do servidor',
      duracaoMs: 2200,
      logs: [
        'browser.launch(headless=false, stealth=true)',
        'contexto criado — user-agent Chrome/126',
        `GET https://sei.${ctx.orgaoSigla.toLowerCase()}.gov.br/`,
      ],
      cena: {
        sistema: 'SEI',
        url: `sei.${ctx.orgaoSigla.toLowerCase()}.gov.br/sip/login.php`,
        breadcrumb: ['Acesso ao sistema'],
        menuAtivo: '',
        corpo: { tipo: 'login', usuario: '', senhaMascarada: '' },
      },
    },
    {
      id: 'login',
      rotulo: 'Autenticando no SEI',
      detalhe: `Usuário ${ctx.usuarioSei} · unidade ${ctx.unidade}`,
      duracaoMs: 3000,
      logs: [
        'fill("#txtUsuario") → ' + ctx.usuarioSei,
        'fill("#pwdSenha") → ••••••••••',
        'click("#sbmLogin")',
        'sessão autenticada — cookie SEI_SID recebido',
      ],
      cena: {
        sistema: 'SEI',
        url: `sei.${ctx.orgaoSigla.toLowerCase()}.gov.br/sip/login.php`,
        breadcrumb: ['Acesso ao sistema'],
        menuAtivo: '',
        corpo: { tipo: 'login', usuario: ctx.usuarioSei, senhaMascarada: '••••••••••' },
        cursor: { x: 50, y: 74, clique: true },
      },
    },
  ]
}

function criarProcesso(ctx: ContextoSimulacao): RoteiroSimulacao {
  return {
    gatilho: 'criar_processo',
    titulo: 'Criar processo no SEI',
    resultado: (c) => `Processo ${c.numProcesso} autuado na unidade ${ctx.unidade}.`,
    passos: [
      ...entradaNoSei(ctx),
      {
        id: 'menu',
        rotulo: 'Escolhendo o tipo de processo',
        detalhe: 'Convênios, Repasses e Transferências Voluntárias',
        duracaoMs: 2800,
        logs: [
          'click("Iniciar Processo")',
          'click("Exibir todos os tipos")',
          'select → "Convênios: Transferência Voluntária"',
        ],
        cena: {
          sistema: 'SEI',
          url: `sei.${ctx.orgaoSigla.toLowerCase()}.gov.br/sei/controlador.php?acao=procedimento_escolher_tipo`,
          breadcrumb: ['Iniciar Processo', 'Escolha o Tipo do Processo'],
          menuAtivo: MENU_SEI,
          corpo: {
            tipo: 'arvore',
            itens: [
              { rotulo: 'Administração Geral', nivel: 0 },
              { rotulo: 'Contratos e Convênios', nivel: 0 },
              { rotulo: 'Convênios: Prestação de Contas', nivel: 1 },
              { rotulo: 'Convênios: Transferência Voluntária', nivel: 1, ativo: true },
              { rotulo: 'Gestão Orçamentária', nivel: 0 },
            ],
          },
          cursor: { x: 34, y: 55, clique: true },
        },
      },
      {
        id: 'form',
        rotulo: 'Preenchendo os dados do processo',
        detalhe: 'Especificação, interessado e nível de acesso',
        duracaoMs: 5200,
        logs: [
          `fill("#txtDescricao") → Proposta ${ctx.numeroProposta} — ${ctx.proponente}`,
          `fill("#txtInteressado") → ${ctx.proponente}`,
          'check("#optPublico") → Público',
          'dados obtidos do cadastro sincronizado, sem digitação humana',
        ],
        cena: {
          sistema: 'SEI',
          url: `sei.${ctx.orgaoSigla.toLowerCase()}.gov.br/sei/controlador.php?acao=procedimento_cadastrar`,
          breadcrumb: ['Iniciar Processo', 'Convênios: Transferência Voluntária'],
          menuAtivo: MENU_SEI,
          corpo: {
            tipo: 'formulario',
            botao: 'Salvar',
            campos: [
              { rotulo: 'Tipo do processo', valor: 'Convênios: Transferência Voluntária' },
              {
                rotulo: 'Especificação',
                valor: `Proposta ${ctx.numeroProposta} — ${ctx.proponente}`,
                digitando: true,
              },
              { rotulo: 'Interessado', valor: ctx.proponente, largura: 'meia' },
              { rotulo: 'Unidade', valor: ctx.unidade, largura: 'meia' },
              { rotulo: 'Nível de acesso', valor: 'Público', largura: 'terco' },
            ],
          },
        },
      },
      {
        id: 'salvar',
        rotulo: 'Salvando',
        detalhe: 'Confirmando a autuação',
        duracaoMs: 2400,
        logs: ['click("#btnSalvar")', 'aguardando redirecionamento…'],
        cena: {
          sistema: 'SEI',
          url: `sei.${ctx.orgaoSigla.toLowerCase()}.gov.br/sei/controlador.php?acao=procedimento_cadastrar`,
          breadcrumb: ['Iniciar Processo', 'Convênios: Transferência Voluntária'],
          menuAtivo: MENU_SEI,
          corpo: {
            tipo: 'formulario',
            botao: 'Salvar',
            campos: [
              { rotulo: 'Tipo do processo', valor: 'Convênios: Transferência Voluntária' },
              { rotulo: 'Especificação', valor: `Proposta ${ctx.numeroProposta} — ${ctx.proponente}` },
              { rotulo: 'Interessado', valor: ctx.proponente, largura: 'meia' },
              { rotulo: 'Unidade', valor: ctx.unidade, largura: 'meia' },
              { rotulo: 'Nível de acesso', valor: 'Público', largura: 'terco' },
            ],
          },
          cursor: { x: 12, y: 88, clique: true },
        },
      },
      {
        id: 'ok',
        rotulo: 'Processo autuado',
        detalhe: `Número ${ctx.numProcesso}`,
        duracaoMs: 2200,
        logs: [
          `processo criado: ${ctx.numProcesso}`,
          'número gravado no cadastro da proposta',
        ],
        cena: {
          sistema: 'SEI',
          url: `sei.${ctx.orgaoSigla.toLowerCase()}.gov.br/sei/controlador.php?acao=procedimento_visualizar`,
          breadcrumb: ['Controle de Processos', ctx.numProcesso],
          menuAtivo: 'Controle de Processos',
          corpo: {
            tipo: 'confirmacao',
            titulo: 'Processo autuado',
            mensagem: `Proposta ${ctx.numeroProposta} — ${ctx.proponente}`,
            destaque: ctx.numProcesso,
          },
        },
      },
    ],
  }
}

function anexarPdf(
  ctx: ContextoSimulacao,
  cfg: { gatilho: Gatilho; titulo: string; aba: string; arquivo: string; tamanho: string; tipoDoc: string },
): RoteiroSimulacao {
  return {
    gatilho: cfg.gatilho,
    titulo: cfg.titulo,
    resultado: () => `${cfg.tipoDoc} anexado ao processo ${ctx.numProcesso}.`,
    passos: [
      {
        id: 'tg-abrir',
        rotulo: 'Abrindo o TransfereGov',
        detalhe: `Consultando a proposta ${ctx.numeroProposta}`,
        duracaoMs: 2600,
        logs: [
          'GET https://transferegov.sistema.gov.br/voluntarias/',
          `busca por proposta ${ctx.numeroProposta}`,
        ],
        cena: {
          sistema: 'TransfereGov',
          url: 'transferegov.sistema.gov.br/voluntarias/consultarproposta',
          breadcrumb: ['Transferências Voluntárias', 'Consultar Proposta'],
          menuAtivo: 'Propostas',
          corpo: {
            tipo: 'tabela',
            colunas: ['Nº da proposta', 'Proponente', 'UF', 'Programa', 'Situação'],
            linhas: [
              {
                celulas: [ctx.numeroProposta, ctx.proponente, ctx.uf, ctx.programa, 'Em análise'],
                destacada: true,
              },
            ],
          },
          cursor: { x: 22, y: 58, clique: true },
        },
      },
      {
        id: 'tg-aba',
        rotulo: `Abrindo a aba ${cfg.aba}`,
        detalhe: 'Localizando o documento para download',
        duracaoMs: 2800,
        logs: [`click("${cfg.aba}")`, 'aguardando carregamento do quadro'],
        cena: {
          sistema: 'TransfereGov',
          url: 'transferegov.sistema.gov.br/voluntarias/proposta/detalhar',
          breadcrumb: ['Proposta', ctx.numeroProposta, cfg.aba],
          menuAtivo: 'Propostas',
          corpo: {
            tipo: 'formulario',
            botao: 'Gerar PDF',
            campos: [
              { rotulo: 'Proposta', valor: ctx.numeroProposta, largura: 'meia' },
              { rotulo: 'Proponente', valor: ctx.proponente, largura: 'meia' },
              { rotulo: 'Valor global', valor: ctx.valorGlobal, largura: 'terco' },
              { rotulo: 'Repasse', valor: ctx.valorRepasse, largura: 'terco' },
              { rotulo: 'Contrapartida', valor: ctx.contrapartida, largura: 'terco' },
            ],
          },
          cursor: { x: 16, y: 86, clique: true },
        },
      },
      {
        id: 'tg-download',
        rotulo: 'Baixando o PDF',
        detalhe: `${cfg.arquivo} · ${cfg.tamanho}`,
        duracaoMs: 3400,
        logs: [
          'download iniciado',
          `arquivo salvo: ${cfg.arquivo}`,
          `tamanho ${cfg.tamanho} · checksum conferido`,
        ],
        cena: {
          sistema: 'TransfereGov',
          url: 'transferegov.sistema.gov.br/voluntarias/proposta/relatorio',
          breadcrumb: ['Proposta', ctx.numeroProposta, cfg.aba],
          menuAtivo: 'Propostas',
          corpo: { tipo: 'upload', arquivo: cfg.arquivo, progresso: 100, tamanho: cfg.tamanho },
        },
      },
      ...entradaNoSei(ctx),
      {
        id: 'sei-processo',
        rotulo: 'Abrindo o processo',
        detalhe: ctx.numProcesso,
        duracaoMs: 2600,
        logs: [`pesquisa por ${ctx.numProcesso}`, 'processo aberto na árvore'],
        cena: {
          sistema: 'SEI',
          url: `sei.${ctx.orgaoSigla.toLowerCase()}.gov.br/sei/controlador.php?acao=procedimento_visualizar`,
          breadcrumb: ['Controle de Processos', ctx.numProcesso],
          menuAtivo: 'Controle de Processos',
          corpo: {
            tipo: 'arvore',
            itens: [
              { rotulo: ctx.numProcesso, nivel: 0 },
              { rotulo: 'Ofício 3421789', nivel: 1 },
              { rotulo: 'Nota Técnica 3421802', nivel: 1 },
              { rotulo: 'Incluir Documento', nivel: 1, ativo: true },
            ],
          },
          cursor: { x: 30, y: 62, clique: true },
        },
      },
      {
        id: 'sei-upload',
        rotulo: 'Anexando ao processo',
        detalhe: `${cfg.tipoDoc} — documento externo`,
        duracaoMs: 4000,
        logs: [
          'select tipo → "Documento Externo"',
          `fill("#txtDataElaboracao") → hoje`,
          `upload → ${cfg.arquivo}`,
          'click("#btnSalvar")',
        ],
        cena: {
          sistema: 'SEI',
          url: `sei.${ctx.orgaoSigla.toLowerCase()}.gov.br/sei/controlador.php?acao=documento_receber`,
          breadcrumb: ['Processo', ctx.numProcesso, 'Registrar Documento Externo'],
          menuAtivo: 'Controle de Processos',
          corpo: { tipo: 'upload', arquivo: cfg.arquivo, progresso: 100, tamanho: cfg.tamanho },
          cursor: { x: 14, y: 84, clique: true },
        },
      },
      {
        id: 'ok',
        rotulo: 'Documento anexado',
        detalhe: `${cfg.tipoDoc} disponível no processo`,
        duracaoMs: 2000,
        logs: ['documento registrado na árvore do processo'],
        cena: {
          sistema: 'SEI',
          url: `sei.${ctx.orgaoSigla.toLowerCase()}.gov.br/sei/controlador.php?acao=procedimento_visualizar`,
          breadcrumb: ['Controle de Processos', ctx.numProcesso],
          menuAtivo: 'Controle de Processos',
          corpo: {
            tipo: 'confirmacao',
            titulo: 'Documento anexado',
            mensagem: `${cfg.tipoDoc} — ${cfg.arquivo}`,
            destaque: ctx.numProcesso,
          },
        },
      },
    ],
  }
}

function criarDocumento(ctx: ContextoSimulacao): RoteiroSimulacao {
  return {
    gatilho: 'criar_documento',
    titulo: 'Gerar documento a partir de minuta',
    resultado: () => `${ctx.minuta} ${ctx.documentoGerado} criado e pronto para assinatura.`,
    passos: [
      ...entradaNoSei(ctx),
      {
        id: 'processo',
        rotulo: 'Abrindo o processo',
        detalhe: ctx.numProcesso,
        duracaoMs: 2400,
        logs: [`pesquisa por ${ctx.numProcesso}`],
        cena: {
          sistema: 'SEI',
          url: `sei.${ctx.orgaoSigla.toLowerCase()}.gov.br/sei/controlador.php?acao=procedimento_visualizar`,
          breadcrumb: ['Controle de Processos', ctx.numProcesso],
          menuAtivo: 'Controle de Processos',
          corpo: {
            tipo: 'arvore',
            itens: [
              { rotulo: ctx.numProcesso, nivel: 0 },
              { rotulo: 'Extrato da Proposta 3421755', nivel: 1 },
              { rotulo: 'Incluir Documento', nivel: 1, ativo: true },
            ],
          },
          cursor: { x: 28, y: 56, clique: true },
        },
      },
      {
        id: 'campos',
        rotulo: 'Resolvendo os campos da minuta',
        detalhe: 'Dados da proposta e cálculos internos',
        duracaoMs: 4200,
        logs: [
          `minuta: ${ctx.minuta}`,
          `campo interno percentualContrapartida = contrapartida ÷ global`,
          `campo interno valorRepasseExtenso resolvido`,
          'campos preenchidos sem intervenção humana',
        ],
        cena: {
          sistema: 'SEI',
          url: `sei.${ctx.orgaoSigla.toLowerCase()}.gov.br/sei/controlador.php?acao=documento_escolher_tipo`,
          breadcrumb: ['Processo', ctx.numProcesso, 'Gerar Documento'],
          menuAtivo: 'Controle de Processos',
          corpo: {
            tipo: 'formulario',
            botao: 'Confirmar Dados',
            campos: [
              { rotulo: 'Modelo', valor: ctx.minuta, digitando: true },
              { rotulo: 'Interessado', valor: ctx.proponente, largura: 'meia' },
              { rotulo: 'Proposta', valor: ctx.numeroProposta, largura: 'meia' },
              { rotulo: 'Valor do repasse', valor: ctx.valorRepasse, largura: 'terco' },
              { rotulo: 'Contrapartida', valor: ctx.contrapartida, largura: 'terco' },
              { rotulo: 'Nível de acesso', valor: 'Público', largura: 'terco' },
            ],
          },
        },
      },
      {
        id: 'editor',
        rotulo: 'Escrevendo o documento',
        detalhe: 'Texto montado com os dados do processo',
        duracaoMs: 5000,
        logs: [
          'editor do SEI aberto',
          'conteúdo HTML da minuta injetado',
          'click("Salvar")',
        ],
        cena: {
          sistema: 'SEI',
          url: `sei.${ctx.orgaoSigla.toLowerCase()}.gov.br/sei/controlador.php?acao=editor_montar`,
          breadcrumb: ['Processo', ctx.numProcesso, ctx.minuta],
          menuAtivo: 'Controle de Processos',
          corpo: {
            tipo: 'documento',
            titulo: ctx.minuta.toUpperCase(),
            paragrafos: [
              `Referência: Proposta nº ${ctx.numeroProposta}, apresentada por ${ctx.proponente} (${ctx.uf}), no âmbito do programa ${ctx.programa}.`,
              `Objeto: ${ctx.objeto}.`,
              `O valor global pactuado é de ${ctx.valorGlobal}, dos quais ${ctx.valorRepasse} correspondem ao repasse da União e ${ctx.contrapartida} à contrapartida do proponente.`,
              'Analisada a documentação apresentada, verifica-se o atendimento aos requisitos de habilitação e a compatibilidade do objeto com a finalidade do programa.',
            ],
            assinatura: ctx.usuarioSei,
          },
        },
      },
      {
        id: 'bloco',
        rotulo: 'Incluindo no bloco de assinatura',
        detalhe: ctx.bloco,
        duracaoMs: 2800,
        logs: [`bloco de assinatura: ${ctx.bloco}`, 'documento disponibilizado para o gestor'],
        cena: {
          sistema: 'SEI',
          url: `sei.${ctx.orgaoSigla.toLowerCase()}.gov.br/sei/controlador.php?acao=bloco_assinatura_listar`,
          breadcrumb: ['Blocos de Assinatura', ctx.bloco],
          menuAtivo: 'Blocos de Assinatura',
          corpo: {
            tipo: 'tabela',
            colunas: ['Documento', 'Tipo', 'Processo', 'Situação'],
            linhas: [
              {
                celulas: [ctx.documentoGerado, ctx.minuta, ctx.numProcesso, 'Aguardando assinatura'],
                destacada: true,
              },
            ],
          },
          cursor: { x: 20, y: 52, clique: true },
        },
      },
      {
        id: 'ok',
        rotulo: 'Documento pronto',
        detalhe: 'Aguardando assinatura do gestor',
        duracaoMs: 2000,
        logs: [`documento ${ctx.documentoGerado} criado`],
        cena: {
          sistema: 'SEI',
          url: `sei.${ctx.orgaoSigla.toLowerCase()}.gov.br/sei/controlador.php?acao=procedimento_visualizar`,
          breadcrumb: ['Controle de Processos', ctx.numProcesso],
          menuAtivo: 'Controle de Processos',
          corpo: {
            tipo: 'confirmacao',
            titulo: 'Documento criado',
            mensagem: `${ctx.minuta} — pronto para assinatura`,
            destaque: ctx.documentoGerado,
          },
        },
      },
    ],
  }
}

function adicionarBloco(ctx: ContextoSimulacao): RoteiroSimulacao {
  return {
    gatilho: 'adicionar_bloco_interno',
    titulo: 'Adicionar a bloco interno',
    resultado: () => `Processo ${ctx.numProcesso} incluído no bloco ${ctx.bloco}.`,
    passos: [
      ...entradaNoSei(ctx),
      {
        id: 'blocos',
        rotulo: 'Abrindo os blocos internos',
        detalhe: 'Localizando o bloco da unidade',
        duracaoMs: 2600,
        logs: ['click("Blocos Internos")', 'lista de blocos carregada'],
        cena: {
          sistema: 'SEI',
          url: `sei.${ctx.orgaoSigla.toLowerCase()}.gov.br/sei/controlador.php?acao=bloco_interno_listar`,
          breadcrumb: ['Blocos Internos'],
          menuAtivo: 'Blocos Internos',
          corpo: {
            tipo: 'tabela',
            colunas: ['Nº', 'Descrição', 'Unidade', 'Processos'],
            linhas: [
              { celulas: ['4471', 'Análise de propostas — 2026', ctx.unidade, '38'], destacada: true },
              { celulas: ['4402', 'Prestação de contas', ctx.unidade, '17'] },
            ],
          },
          cursor: { x: 24, y: 50, clique: true },
        },
      },
      {
        id: 'incluir',
        rotulo: 'Incluindo o processo',
        detalhe: ctx.numProcesso,
        duracaoMs: 3200,
        logs: [`fill("#txtProcesso") → ${ctx.numProcesso}`, 'click("#btnIncluir")'],
        cena: {
          sistema: 'SEI',
          url: `sei.${ctx.orgaoSigla.toLowerCase()}.gov.br/sei/controlador.php?acao=bloco_interno_incluir`,
          breadcrumb: ['Blocos Internos', ctx.bloco],
          menuAtivo: 'Blocos Internos',
          corpo: {
            tipo: 'formulario',
            botao: 'Incluir',
            campos: [
              { rotulo: 'Bloco', valor: ctx.bloco, largura: 'meia' },
              { rotulo: 'Processo', valor: ctx.numProcesso, digitando: true, largura: 'meia' },
            ],
          },
          cursor: { x: 12, y: 80, clique: true },
        },
      },
      {
        id: 'ok',
        rotulo: 'Processo incluído',
        detalhe: ctx.bloco,
        duracaoMs: 1800,
        logs: ['processo vinculado ao bloco'],
        cena: {
          sistema: 'SEI',
          url: `sei.${ctx.orgaoSigla.toLowerCase()}.gov.br/sei/controlador.php?acao=bloco_interno_listar`,
          breadcrumb: ['Blocos Internos', ctx.bloco],
          menuAtivo: 'Blocos Internos',
          corpo: {
            tipo: 'confirmacao',
            titulo: 'Processo incluído no bloco',
            mensagem: ctx.bloco,
            destaque: ctx.numProcesso,
          },
        },
      },
    ],
  }
}

export function montarRoteiro(gatilho: Gatilho, ctx: ContextoSimulacao): RoteiroSimulacao {
  switch (gatilho) {
    case 'criar_processo':
      return criarProcesso(ctx)
    case 'criar_documento':
      return criarDocumento(ctx)
    case 'adicionar_bloco_interno':
      return adicionarBloco(ctx)
    case 'anexar_extrato_proposta':
      return anexarPdf(ctx, {
        gatilho,
        titulo: 'Anexar extrato da proposta',
        aba: 'Dados da Proposta',
        arquivo: `extrato-${ctx.numeroProposta.replace(/[^\d]/g, '')}.pdf`,
        tamanho: '412 KB',
        tipoDoc: 'Extrato da Proposta',
      })
    case 'anexar_contrapartidas':
      return anexarPdf(ctx, {
        gatilho,
        titulo: 'Anexar contrapartidas',
        aba: 'Contrapartida',
        arquivo: `contrapartidas-${ctx.numeroProposta.replace(/[^\d]/g, '')}.pdf`,
        tamanho: '286 KB',
        tipoDoc: 'Relatório de Contrapartidas',
      })
    case 'anexar_capacidades_tecnicas':
      return anexarPdf(ctx, {
        gatilho,
        titulo: 'Anexar capacidade técnica',
        aba: 'Capacidade Técnica',
        arquivo: `capacidade-tecnica-${ctx.numeroProposta.replace(/[^\d]/g, '')}.pdf`,
        tamanho: '531 KB',
        tipoDoc: 'Comprovante de Capacidade Técnica',
      })
  }
}

export const ROTULO_GATILHO: Record<Gatilho, string> = {
  criar_processo: 'Criar processo no SEI',
  adicionar_bloco_interno: 'Adicionar a bloco interno',
  anexar_extrato_proposta: 'Anexar extrato da proposta',
  anexar_contrapartidas: 'Anexar contrapartidas',
  anexar_capacidades_tecnicas: 'Anexar capacidade técnica',
  criar_documento: 'Gerar documento de minuta',
}

export const DESCRICAO_GATILHO: Record<Gatilho, string> = {
  criar_processo: 'Autua o processo no SEI já com a especificação e o interessado da proposta.',
  adicionar_bloco_interno: 'Inclui o processo no bloco interno da unidade para acompanhamento.',
  anexar_extrato_proposta: 'Baixa o extrato no TransfereGov e registra como documento externo no SEI.',
  anexar_contrapartidas: 'Baixa o relatório de contrapartidas e anexa ao processo.',
  anexar_capacidades_tecnicas: 'Baixa o comprovante de capacidade técnica e anexa ao processo.',
  criar_documento: 'Monta um documento a partir de minuta e envia para o bloco de assinatura.',
}
