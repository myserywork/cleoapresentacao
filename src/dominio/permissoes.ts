import { EQUIPE, ORGAOS, propostasDoAnalista, propostasDoOrgao } from '@/data/repo'
import type { Analista, Proposta } from '@/data/types'

/**
 * Perfis, permissões e alçada.
 *
 * O que dá sossego a um gestor não é a automação — é saber que ela obedece à
 * mesma hierarquia que a casa já tem. Aqui cada ação da plataforma vira uma
 * permissão nomeada, cada perfil recebe um conjunto, e o valor da proposta
 * passa por uma alçada: acima do limite, a decisão sobe.
 *
 * A Cleo herda a alçada de quem a acionou. Ela nunca faz o que a pessoa não
 * poderia fazer sozinha — é o que separa assistente de procurador.
 */

/* ---------- Permissões ---------- */

export type Permissao =
  // Carteira
  | 'proposta.ver'
  | 'proposta.comentar'
  | 'proposta.editar'
  // Automação
  | 'rito.executar'
  | 'rito.executar_lote'
  | 'rito.criar'
  | 'rito.publicar'
  | 'regra.publicar'
  // Documento
  | 'documento.gerar'
  | 'documento.assinar'
  | 'minuta.editar'
  // Decisão
  | 'aprovacao.decidir'
  | 'aprovacao.decidir_alto_valor'
  | 'empenho.autorizar'
  | 'aditivo.assinar'
  // Casa
  | 'equipe.redistribuir'
  | 'usuario.gerenciar'
  | 'permissao.configurar'
  | 'sessao.capturar'
  | 'sessao.usar_autonomo'
  | 'auditoria.ver'
  | 'auditoria.exportar'

export interface DefinicaoPermissao {
  id: Permissao
  rotulo: string
  grupo: 'Carteira' | 'Automação' | 'Documento' | 'Decisão' | 'Casa'
  descricao: string
  /** Permissão sensível: exige registro reforçado na trilha. */
  sensivel?: boolean
}

export const PERMISSOES: DefinicaoPermissao[] = [
  { id: 'proposta.ver', grupo: 'Carteira', rotulo: 'Ver propostas', descricao: 'Abrir o dossiê e consultar a carteira do órgão.' },
  { id: 'proposta.comentar', grupo: 'Carteira', rotulo: 'Comentar', descricao: 'Registrar observações no dossiê da proposta.' },
  { id: 'proposta.editar', grupo: 'Carteira', rotulo: 'Editar cadastro', descricao: 'Alterar dados sincronizados da proposta.', sensivel: true },

  { id: 'rito.executar', grupo: 'Automação', rotulo: 'Executar rito', descricao: 'Disparar uma automação sobre uma proposta.' },
  { id: 'rito.executar_lote', grupo: 'Automação', rotulo: 'Executar em lote', descricao: 'Rodar o mesmo rito sobre várias propostas.', sensivel: true },
  { id: 'rito.criar', grupo: 'Automação', rotulo: 'Criar rito', descricao: 'Montar automações no estúdio visual.' },
  { id: 'rito.publicar', grupo: 'Automação', rotulo: 'Publicar rito', descricao: 'Tornar um rito disponível para a casa inteira.', sensivel: true },
  { id: 'regra.publicar', grupo: 'Automação', rotulo: 'Publicar regra', descricao: 'Criar gatilhos que disparam ritos sozinhos.', sensivel: true },

  { id: 'documento.gerar', grupo: 'Documento', rotulo: 'Gerar documento', descricao: 'Produzir documento a partir de minuta no SEI.' },
  { id: 'documento.assinar', grupo: 'Documento', rotulo: 'Assinar', descricao: 'Assinar eletronicamente documentos do processo.', sensivel: true },
  { id: 'minuta.editar', grupo: 'Documento', rotulo: 'Editar minutas', descricao: 'Alterar os modelos que a casa usa.' },

  { id: 'aprovacao.decidir', grupo: 'Decisão', rotulo: 'Decidir aprovações', descricao: 'Aprovar ou recusar pedidos na fila.' },
  { id: 'aprovacao.decidir_alto_valor', grupo: 'Decisão', rotulo: 'Decidir alto valor', descricao: 'Decidir acima do limite de alçada do perfil.', sensivel: true },
  { id: 'empenho.autorizar', grupo: 'Decisão', rotulo: 'Autorizar empenho', descricao: 'Comprometer dotação orçamentária.', sensivel: true },
  { id: 'aditivo.assinar', grupo: 'Decisão', rotulo: 'Assinar aditivo', descricao: 'Prorrogar vigência ou alterar valor do instrumento.', sensivel: true },

  { id: 'equipe.redistribuir', grupo: 'Casa', rotulo: 'Redistribuir carteira', descricao: 'Mover propostas entre analistas.' },
  { id: 'usuario.gerenciar', grupo: 'Casa', rotulo: 'Gerenciar usuários', descricao: 'Convidar, desativar e trocar perfil de pessoas.', sensivel: true },
  { id: 'permissao.configurar', grupo: 'Casa', rotulo: 'Configurar permissões', descricao: 'Alterar o que cada perfil pode fazer.', sensivel: true },
  { id: 'sessao.capturar', grupo: 'Casa', rotulo: 'Capturar sessão', descricao: 'Levar a própria sessão autenticada para a Cleo.' },
  { id: 'sessao.usar_autonomo', grupo: 'Casa', rotulo: 'Operação autônoma', descricao: 'Deixar a Cleo operar sem a pessoa presente.', sensivel: true },
  { id: 'auditoria.ver', grupo: 'Casa', rotulo: 'Ver auditoria', descricao: 'Consultar a trilha de eventos do órgão.' },
  { id: 'auditoria.exportar', grupo: 'Casa', rotulo: 'Exportar auditoria', descricao: 'Baixar a trilha para fora da plataforma.', sensivel: true },
]

export const GRUPOS_PERMISSAO = ['Carteira', 'Automação', 'Documento', 'Decisão', 'Casa'] as const

/* ---------- Perfis ---------- */

export type PerfilId = 'leitor' | 'tecnico' | 'coordenador' | 'ordenador' | 'admin'

export interface Perfil {
  id: PerfilId
  nome: string
  descricao: string
  /** Teto de valor que o perfil decide sozinho; acima disso, sobe. */
  alcada: number
  permissoes: Permissao[]
  tom: 'inert' | 'teal' | 'gold' | 'cleo' | 'alert'
}

const TODAS = PERMISSOES.map((p) => p.id)

export const PERFIS: Perfil[] = [
  {
    id: 'leitor',
    nome: 'Leitor',
    descricao: 'Consulta a carteira e acompanha. Não movimenta nada.',
    alcada: 0,
    tom: 'inert',
    permissoes: ['proposta.ver', 'auditoria.ver'],
  },
  {
    id: 'tecnico',
    nome: 'Analista técnico',
    descricao: 'Instrui processos: executa ritos, gera documento, abre diligência.',
    alcada: 500_000,
    tom: 'teal',
    permissoes: [
      'proposta.ver',
      'proposta.comentar',
      'rito.executar',
      'documento.gerar',
      'sessao.capturar',
      'auditoria.ver',
    ],
  },
  {
    id: 'coordenador',
    nome: 'Coordenador',
    descricao: 'Decide a fila, distribui carteira e roda automação em lote.',
    alcada: 5_000_000,
    tom: 'gold',
    permissoes: [
      'proposta.ver',
      'proposta.comentar',
      'proposta.editar',
      'rito.executar',
      'rito.executar_lote',
      'rito.criar',
      'documento.gerar',
      'minuta.editar',
      'aprovacao.decidir',
      'equipe.redistribuir',
      'sessao.capturar',
      'sessao.usar_autonomo',
      'auditoria.ver',
      'auditoria.exportar',
    ],
  },
  {
    id: 'ordenador',
    nome: 'Ordenador de despesa',
    descricao: 'Assina, empenha e decide sem teto. É a autoridade do recurso.',
    alcada: Number.POSITIVE_INFINITY,
    tom: 'cleo',
    permissoes: [
      'proposta.ver',
      'proposta.comentar',
      'rito.executar',
      'documento.gerar',
      'documento.assinar',
      'aprovacao.decidir',
      'aprovacao.decidir_alto_valor',
      'empenho.autorizar',
      'aditivo.assinar',
      'sessao.capturar',
      'auditoria.ver',
      'auditoria.exportar',
    ],
  },
  {
    id: 'admin',
    nome: 'Administrador',
    descricao: 'Configura a plataforma, os perfis e quem entra. Não decide processo.',
    alcada: 0,
    tom: 'alert',
    permissoes: TODAS.filter(
      (p) => !['aprovacao.decidir', 'aprovacao.decidir_alto_valor', 'empenho.autorizar', 'aditivo.assinar'].includes(p),
    ),
  },
]

export const PERFIL_POR_ID = new Map(PERFIS.map((p) => [p.id, p]))

/* ---------- Usuários ---------- */

export interface Usuario {
  id: string
  nome: string
  iniciais: string
  cargo: string
  orgaoId: string
  perfil: PerfilId
  ativo: boolean
  /** Permissões concedidas além do perfil, caso a caso. */
  extras: Permissao[]
  ultimoAcesso: string
}

/**
 * A equipe já existente vira base de usuários — cada analista com o perfil que
 * o cargo sugere. A coordenação de cada órgão ganha um ordenador e um admin.
 */
export function usuariosIniciais(): Usuario[] {
  const lista: Usuario[] = []
  const hoje = Date.now()

  EQUIPE.forEach((a: Analista, i) => {
    const perfil: PerfilId = a.perfil === 'gestor' ? 'coordenador' : 'tecnico'
    lista.push({
      id: a.id,
      nome: a.nome,
      iniciais: a.iniciais,
      cargo: a.cargo,
      orgaoId: a.orgaoId,
      perfil,
      ativo: true,
      extras: [],
      ultimoAcesso: new Date(hoje - i * 3_600_000).toISOString(),
    })
  })

  for (const orgao of ORGAOS) {
    lista.push({
      id: `ord-${orgao.id}`,
      nome: orgao.representante,
      iniciais: orgao.representante
        .split(' ')
        .filter((p) => p.length > 2)
        .map((p) => p[0])
        .slice(0, 2)
        .join(''),
      cargo: 'Secretário-Nacional · ordenador de despesa',
      orgaoId: orgao.id,
      perfil: 'ordenador',
      ativo: true,
      extras: [],
      ultimoAcesso: new Date(hoje - 5 * 3_600_000).toISOString(),
    })
    lista.push({
      id: `adm-${orgao.id}`,
      nome: 'Coordenação de TI',
      iniciais: 'TI',
      cargo: 'Administrador da plataforma',
      orgaoId: orgao.id,
      perfil: 'admin',
      ativo: true,
      extras: [],
      ultimoAcesso: new Date(hoje - 26 * 3_600_000).toISOString(),
    })
  }

  return lista
}

/* ---------- Avaliação ---------- */

export function permissoesDe(usuario: Usuario): Set<Permissao> {
  const perfil = PERFIL_POR_ID.get(usuario.perfil)
  return new Set([...(perfil?.permissoes ?? []), ...usuario.extras])
}

export function pode(usuario: Usuario, permissao: Permissao): boolean {
  if (!usuario.ativo) return false
  return permissoesDe(usuario).has(permissao)
}

export interface Veredito {
  permitido: boolean
  /** Verdadeiro quando falta só alçada — o pedido pode subir a quem tem. */
  precisaSubir: boolean
  motivo: string
  /** Quem na casa poderia decidir, quando precisa subir. */
  quemPode?: Usuario[]
}

/**
 * A pergunta que a plataforma faz antes de qualquer ação com valor: esta pessoa
 * pode fazer isto, com este valor? A resposta nunca é só "não" — quando falta
 * alçada, diz a quem o pedido sobe.
 */
export function avaliar(
  usuario: Usuario,
  permissao: Permissao,
  valor: number | undefined,
  todos: Usuario[],
): Veredito {
  const def = PERMISSOES.find((p) => p.id === permissao)
  const rotulo = def?.rotulo ?? permissao

  if (!usuario.ativo) {
    return { permitido: false, precisaSubir: false, motivo: 'Usuário desativado.' }
  }
  if (!permissoesDe(usuario).has(permissao)) {
    const quemPode = todos.filter((u) => u.ativo && u.orgaoId === usuario.orgaoId && permissoesDe(u).has(permissao))
    return {
      permitido: false,
      precisaSubir: quemPode.length > 0,
      motivo: `O perfil ${PERFIL_POR_ID.get(usuario.perfil)?.nome} não tem "${rotulo}".`,
      quemPode,
    }
  }

  const alcada = PERFIL_POR_ID.get(usuario.perfil)?.alcada ?? 0
  if (valor !== undefined && valor > alcada) {
    const quemPode = todos.filter(
      (u) =>
        u.ativo &&
        u.orgaoId === usuario.orgaoId &&
        permissoesDe(u).has(permissao) &&
        (PERFIL_POR_ID.get(u.perfil)?.alcada ?? 0) >= valor,
    )
    return {
      permitido: false,
      precisaSubir: quemPode.length > 0,
      motivo: `Valor acima da alçada do perfil ${PERFIL_POR_ID.get(usuario.perfil)?.nome}.`,
      quemPode,
    }
  }

  return { permitido: true, precisaSubir: false, motivo: 'Dentro do perfil e da alçada.' }
}

/* ---------- Cruzamentos com o sistema ---------- */

export interface ImpactoUsuario {
  usuario: Usuario
  propostas: Proposta[]
  valorSobGestao: number
  acimaDaAlcada: number
  permissoesSensiveis: number
}

/** O que muda na prática quando este perfil é o desta pessoa. */
export function impacto(usuario: Usuario): ImpactoUsuario {
  const propostas = propostasDoAnalista(usuario.id)
  const alcada = PERFIL_POR_ID.get(usuario.perfil)?.alcada ?? 0
  const sensiveis = [...permissoesDe(usuario)].filter(
    (p) => PERMISSOES.find((d) => d.id === p)?.sensivel,
  ).length
  return {
    usuario,
    propostas,
    valorSobGestao: propostas.reduce((s, p) => s + p.valorGlobal, 0),
    acimaDaAlcada: propostas.filter((p) => p.valorGlobal > alcada).length,
    permissoesSensiveis: sensiveis,
  }
}

/** Fila de aprovação por alçada: quanto da carteira sobe de cada perfil. */
export function distribuicaoPorAlcada(orgaoId: string) {
  const propostas = propostasDoOrgao(orgaoId)
  return PERFIS.filter((p) => p.alcada > 0).map((perfil) => {
    const dentro = propostas.filter((p) => p.valorGlobal <= perfil.alcada)
    return {
      perfil,
      qtd: dentro.length,
      fracao: propostas.length > 0 ? dentro.length / propostas.length : 0,
      valor: dentro.reduce((s, p) => s + p.valorGlobal, 0),
    }
  })
}
