/**
 * Descrição de uma execução de automação.
 *
 * O runner reproduz esta lista de passos com cronometragem realista e emite os
 * mesmos eventos que um worker emitiria. Substituir a simulação por execução
 * real significa trocar quem produz os eventos, não quem os consome.
 */

export type Sistema = 'SEI' | 'TransfereGov'

export interface CampoTela {
  rotulo: string
  valor: string
  /** Campo digitado pela Cleo neste passo — anima caractere a caractere. */
  digitando?: boolean
  largura?: 'cheia' | 'meia' | 'terco'
}

export interface LinhaTabela {
  celulas: string[]
  destacada?: boolean
}

export type Corpo =
  | { tipo: 'login'; usuario: string; senhaMascarada: string }
  | { tipo: 'formulario'; campos: CampoTela[]; botao: string }
  | { tipo: 'tabela'; colunas: string[]; linhas: LinhaTabela[] }
  | { tipo: 'documento'; titulo: string; paragrafos: string[]; assinatura?: string }
  | { tipo: 'upload'; arquivo: string; progresso: number; tamanho: string }
  | { tipo: 'arvore'; itens: { rotulo: string; nivel: number; ativo?: boolean }[] }
  | { tipo: 'confirmacao'; titulo: string; mensagem: string; destaque: string }

export interface Cena {
  sistema: Sistema
  url: string
  breadcrumb: string[]
  /** Item do menu lateral em foco. */
  menuAtivo: string
  corpo: Corpo
  /** Posição do cursor em % da área de conteúdo; dispara clique ao final do passo. */
  cursor?: { x: number; y: number; clique?: boolean }
}

export interface Passo {
  id: string
  rotulo: string
  detalhe: string
  duracaoMs: number
  cena: Cena
  logs: string[]
}

export interface RoteiroSimulacao {
  gatilho: string
  titulo: string
  passos: Passo[]
  /** Frase de fecho exibida ao final, com o resultado concreto. */
  resultado: (ctx: Record<string, string>) => string
}
