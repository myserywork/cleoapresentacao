import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  ChevronDown,
  Expand,
  Loader2,
  Maximize2,
  Minimize2,
  Moon,
  Play,
  Sparkles,
  Sun,
  X,
  Zap,
} from 'lucide-react'
import { useApp } from '@/store/app'
import { getEmenda, getParlamentar, getProponente, extensaoDa } from '@/data/repo'
import type { Proposta } from '@/data/types'
import { cn, data as fmtData, moedaExata } from '@/lib/format'
import { Badge, Botao } from '@/components/ui'

/**
 * Modo Tabela — a planilha.
 *
 * O MIDR não opera por telas: opera por planilha. Cada linha é uma proposta,
 * cada coluna é uma etapa do rito, e o trabalho do dia é **descer a coluna
 * marcando "Sim"**. A célula verde é o gatilho; a vermelha ao lado é onde a
 * automação devolve o resultado. É assim que a casa já pensa, e uma plataforma
 * que ignora isso obriga o servidor a traduzir o método dele para o nosso.
 *
 * Então a plataforma fala planilha. Mesma gramática — cabeçalho colorido por
 * natureza da coluna, letra da coluna, número da linha, primeiras colunas
 * congeladas, rolagem horizontal longa — com uma diferença que só um sistema
 * pode dar: o resultado não depende de alguém lembrar de rodar o script, e a
 * execução em lote é marcar a coluna inteira de uma vez.
 *
 * Nada é enviado ao SEI nem ao TransfereGov: a execução é reconstruída aqui.
 */

/* ==================== As colunas ==================== */

type Natureza =
  | 'chave' // identidade da linha — verde forte, congelada
  | 'dado' // veio do TransfereGov
  | 'gatilho' // verde: dispara a automação
  | 'resultado' // vermelho: a automação escreve aqui
  | 'consulta' // azul: a Cleo busca a norma/base e devolve

interface Coluna {
  id: string
  letra: string
  rotulo: string
  natureza: Natureza
  largura: number
  /** Para gatilho: a coluna que recebe o resultado e o que a Cleo faz. */
  destino?: string
  rito?: string
  /** Passos mostrados enquanto executa — o mesmo contrato do modal. */
  passos?: string[]
  /** Como o resultado é escrito de volta. */
  escreve?: (p: Proposta, seq: number) => string
}

/** Sufixo de protocolo, estável por proposta — número inventado a cada render mentiria. */
function selo(p: Proposta, base: number): string {
  const n = Number(p.numero.replace(/\D/g, '').slice(-5) || '0')
  return String(((n * 7 + base) % 900000) + 100000)
}

const COLUNAS: Coluna[] = [
  { id: 'data', letra: 'A', rotulo: 'Data', natureza: 'chave', largura: 96 },
  { id: 'proposta', letra: 'B', rotulo: 'Proposta', natureza: 'chave', largura: 132 },
  { id: 'rp', letra: 'D', rotulo: 'RP', natureza: 'dado', largura: 58 },
  { id: 'proponente', letra: 'AR', rotulo: 'Proponente', natureza: 'dado', largura: 210 },
  { id: 'uf', letra: 'AS', rotulo: 'UF', natureza: 'dado', largura: 48 },
  { id: 'modalidade', letra: 'N', rotulo: 'Modalidade', natureza: 'dado', largura: 132 },
  { id: 'acao', letra: 'Q', rotulo: 'Ação', natureza: 'dado', largura: 104 },
  { id: 'vglobal', letra: 'F', rotulo: 'Valor Global (Espelho)', natureza: 'dado', largura: 128 },
  { id: 'vrepasse', letra: 'G', rotulo: 'Valor de Repasse (Espelho)', natureza: 'dado', largura: 128 },
  {
    id: 'vcontrap',
    letra: 'H',
    rotulo: 'Valor de Contrapartida (Espelho)',
    natureza: 'dado',
    largura: 128,
  },
  { id: 'situacao', letra: 'AH', rotulo: 'Situação da Proposta', natureza: 'dado', largura: 132 },

  {
    id: 'g_sei',
    letra: 'AC',
    rotulo: 'Criar Processo SEI',
    natureza: 'gatilho',
    largura: 118,
    destino: 'r_sei',
    rito: 'Autuação no SEI',
    passos: [
      'Abrindo o SEI na sessão do servidor',
      'Iniciando processo do tipo Convênios: Formalização',
      'Preenchendo especificação e interessado',
      'Salvando e capturando o número autuado',
    ],
    escreve: (p) => (p.numProcessoSei ? p.numProcessoSei : `59000.${selo(p, 11)}/2026-${selo(p, 3).slice(0, 2)}`),
  },
  { id: 'r_sei', letra: 'AD', rotulo: 'Processo SEI', natureza: 'resultado', largura: 176 },

  {
    id: 'g_bloco',
    letra: 'AE',
    rotulo: 'Anexar Processo no Bloco Interno',
    natureza: 'gatilho',
    largura: 128,
    destino: 'r_bloco',
    rito: 'Inclusão em bloco interno',
    passos: ['Localizando o processo no SEI', 'Incluindo no bloco interno da unidade'],
    escreve: () => 'Incluído no bloco 12/2026',
  },
  { id: 'r_bloco', letra: 'AE', rotulo: 'Bloco Interno', natureza: 'resultado', largura: 150 },

  {
    id: 'g_extrato',
    letra: 'AF',
    rotulo: 'Anexar Extrato da Proposta',
    natureza: 'gatilho',
    largura: 122,
    destino: 'r_extrato',
    rito: 'Extrato do TransfereGov',
    passos: [
      'Localizando a proposta no TransfereGov',
      'Gerando o extrato e os demonstrativos',
      'Anexando ao processo no SEI',
    ],
    escreve: () => 'Extrato anexado (3 documentos)',
  },
  { id: 'r_extrato', letra: 'AF', rotulo: 'Extrato da Proposta', natureza: 'resultado', largura: 176 },

  {
    id: 'g_aprovar',
    letra: 'BK',
    rotulo: 'Aprovar Proposta?',
    natureza: 'gatilho',
    largura: 112,
    destino: 'r_aprovar',
    rito: 'Aprovação da proposta',
    passos: [
      'Conferindo checklist de habilitação',
      'Redigindo o parecer de aprovação',
      'Registrando a aprovação no TransfereGov',
    ],
    escreve: (p) => `Aprovada — parecer ${selo(p, 21)}`,
  },
  { id: 'r_aprovar', letra: 'BL', rotulo: 'Aprovação da Proposta', natureza: 'resultado', largura: 176 },

  {
    id: 'g_empenho',
    letra: 'BO',
    rotulo: 'Elaborar Despacho de Empenho?',
    natureza: 'gatilho',
    largura: 128,
    destino: 'r_empenho',
    rito: 'Despacho de empenho',
    passos: [
      'Lendo a nota de empenho e o saldo da ação',
      'Gerando o despacho a partir da minuta',
      'Incluindo no bloco de assinatura',
    ],
    escreve: (p) => `Despacho ${selo(p, 33)} criado com sucesso!`,
  },
  { id: 'r_empenho', letra: 'BP', rotulo: 'Despacho de Empenho', natureza: 'resultado', largura: 176 },

  {
    id: 'g_pt',
    letra: 'BR',
    rotulo: 'Elaborar Despacho de PT?',
    natureza: 'gatilho',
    largura: 122,
    destino: 'r_pt',
    rito: 'Despacho de plano de trabalho',
    passos: ['Lendo o plano de trabalho da proposta', 'Gerando o despacho e assinando'],
    escreve: () => 'Criado com sucesso!',
  },
  { id: 'r_pt', letra: 'BS', rotulo: 'Despacho de PT', natureza: 'resultado', largura: 164 },

  {
    id: 'g_nt2',
    letra: 'BT',
    rotulo: 'Elaborar NT de Aprovação Proposta - RP2',
    natureza: 'gatilho',
    largura: 138,
    destino: 'r_nt2',
    rito: 'Nota técnica RP2',
    passos: [
      'Verificando o enquadramento em RP2',
      'Montando a nota técnica pela minuta',
      'Anexando ao processo',
    ],
    escreve: () => 'Criada com sucesso!',
  },
  {
    id: 'r_nt2',
    letra: 'BU',
    rotulo: 'NT de Aprovação Proposta - RP2',
    natureza: 'resultado',
    largura: 176,
  },

  {
    id: 'c_portaria',
    letra: 'BV',
    rotulo: 'Consulta (Portaria + Ação)',
    natureza: 'consulta',
    largura: 186,
  },

  {
    id: 'g_ntpt',
    letra: 'BW',
    rotulo: 'Elaborar NT de Plano de Trabalho?',
    natureza: 'gatilho',
    largura: 128,
    destino: 'r_ntpt',
    rito: 'Nota técnica de plano de trabalho',
    passos: [
      'Escolhendo o modelo pela modalidade',
      'Preenchendo metas e cronograma',
      'Gerando a nota técnica',
    ],
    escreve: (p) => `NT ${selo(p, 47)} criada com sucesso!`,
  },
  {
    id: 'r_ntpt',
    letra: 'BY',
    rotulo: 'NT de Plano de Trabalho',
    natureza: 'resultado',
    largura: 176,
  },

  {
    id: 'g_aprovarpt',
    letra: 'BZ',
    rotulo: 'Aprovar Plano de Trabalho?',
    natureza: 'gatilho',
    largura: 122,
    destino: 'r_aprovarpt',
    rito: 'Aprovação do plano de trabalho',
    passos: ['Conferindo metas e cronograma', 'Registrando a aprovação no TransfereGov'],
    escreve: () => 'Plano de trabalho aprovado',
  },
  {
    id: 'r_aprovarpt',
    letra: 'CA',
    rotulo: 'Aprovação do Plano de Trabalho',
    natureza: 'resultado',
    largura: 176,
  },

  {
    id: 'g_termo',
    letra: 'CH',
    rotulo: 'Elaborar Termo de Convênio?',
    natureza: 'gatilho',
    largura: 126,
    destino: 'r_termo',
    rito: 'Termo de convênio',
    passos: [
      'Consultando a portaria e a ação orçamentária',
      'Escolhendo o modelo do termo',
      'Calculando a vigência a partir do cronograma',
      'Gerando o termo e enviando para assinatura',
    ],
    escreve: (p) => `Termo ${selo(p, 59)} — vigência 24 meses`,
  },
  { id: 'r_termo', letra: 'CL', rotulo: 'Termo de Convênio', natureza: 'resultado', largura: 176 },

  { id: 'cauc', letra: 'CE', rotulo: 'CAUC', natureza: 'consulta', largura: 108 },
  { id: 'tgov', letra: 'BF', rotulo: 'TGOV - Última Atualização', natureza: 'dado', largura: 128 },
]

const GATILHOS = COLUNAS.filter((c) => c.natureza === 'gatilho')

/**
 * Duas peles para a mesma grade.
 *
 * O modo claro não é um tema alternativo: é **o** ambiente em que essa
 * planilha vive. O servidor abre o Sheets o dia inteiro, e uma grade escura
 * com as mesmas colunas causa exatamente o estranhamento que estamos tentando
 * evitar. Então o claro copia a paleta do Sheets — fundo branco, linha
 * #e0e0e0, cabeçalho #f8f9fa, seleção azul #0b57d0 — e as cores das colunas
 * são as da planilha do MIDR: verde de gatilho, vermelho de resultado, azul de
 * consulta.
 */
interface Paleta {
  fundo: string
  linha: string
  linhaForte: string
  cabecalho: string
  cabecalhoTexto: string
  cabecalhoAtivo: string
  cabecalhoAtivoTexto: string
  texto: string
  textoFraco: string
  selecao: string
  celula: (congelada: boolean, selecionada: boolean, naCruz: boolean) => string
  natureza: Record<Natureza, { background: string; color: string }>
}

const PALETAS: Record<'escuro' | 'claro', Paleta> = {
  escuro: {
    fundo: '#0b1018',
    linha: '#1b2536',
    linhaForte: '#3a4a66',
    cabecalho: '#131d2f',
    cabecalhoTexto: '#5a6a7f',
    cabecalhoAtivo: '#2a3852',
    cabecalhoAtivoTexto: '#dfb552',
    texto: '#8698b3',
    textoFraco: '#5a6a7f',
    selecao: '#dfb552',
    celula: (congelada, selecionada, naCruz) => {
      if (congelada) return selecionada ? '#1c1b14' : naCruz ? '#141d2e' : '#0d1421'
      if (selecionada) return naCruz ? '#191710' : '#15130c'
      return naCruz ? '#101724' : '#0b1018'
    },
    natureza: {
      chave: { background: '#0d8043', color: '#ffffff' },
      dado: { background: '#0d1421', color: '#8698b3' },
      gatilho: { background: '#0d8043', color: '#ffffff' },
      resultado: { background: '#a61c00', color: '#ffffff' },
      consulta: { background: '#1c4587', color: '#ffffff' },
    },
  },
  claro: {
    fundo: '#ffffff',
    linha: '#e0e0e0',
    linhaForte: '#9aa0a6',
    cabecalho: '#f8f9fa',
    cabecalhoTexto: '#444746',
    cabecalhoAtivo: '#d3e3fd',
    cabecalhoAtivoTexto: '#0b57d0',
    texto: '#202124',
    textoFraco: '#5f6368',
    selecao: '#0b57d0',
    celula: (congelada, selecionada, naCruz) => {
      if (selecionada) return naCruz ? '#fce8b2' : '#fef7e0'
      if (naCruz) return '#f1f3f4'
      return congelada ? '#ffffff' : '#ffffff'
    },
    // As cores da planilha do MIDR, como estão lá
    natureza: {
      chave: { background: '#00ff00', color: '#000000' },
      dado: { background: '#ffffff', color: '#202124' },
      gatilho: { background: '#00b050', color: '#000000' },
      resultado: { background: '#ff0000', color: '#ffffff' },
      consulta: { background: '#9fc5e8', color: '#000000' },
    },
  },
}

/* ==================== Estado de execução ==================== */

type Estado = 'vazio' | 'executando' | 'pronto' | 'falha'

interface Celula {
  gatilho: 'Sim' | 'Não' | ''
  estado: Estado
  resultado: string
  passo?: string
}

const CHAVE = (propostaId: string, colId: string) => `${propostaId}|${colId}`

/**
 * Congelamento das primeiras colunas.
 *
 * O deslocamento tem que bater no pixel com a largura declarada, senão o
 * conteúdo rolando por baixo aparece na fresta e a planilha ganha aquele
 * borrão de letras soltas. Com `box-sizing: border-box` a borda já está dentro
 * da largura, então o offset é a soma simples das colunas anteriores.
 */
const LARGURA_LINHA = 40
const CONGELADAS = 2
const ESQUERDA = COLUNAS.slice(0, CONGELADAS).reduce<number[]>(
  (acc, _col, i) => [...acc, (acc[i - 1] ?? LARGURA_LINHA) + (i === 0 ? 0 : COLUNAS[i - 1].largura)],
  [],
)

/** Passos de zoom, como o do Sheets — menos colunas ilegíveis, mais visão. */
const ZOOMS = [0.75, 0.85, 1, 1.15]

export function Planilha({ propostas }: { propostas: Proposta[] }) {
  const { notificar, registrarAuditoria, usuarios, usuarioAtualId } = useApp()
  const eu = usuarios.find((u) => u.id === usuarioAtualId)
  const [celulas, setCelulas] = useState<Record<string, Celula>>({})
  const [aberta, setAberta] = useState<string | null>(null)
  // Foco por índice, não por id: é o que permite andar com as setas.
  const [foco, setFoco] = useState<{ linha: number; coluna: number }>({ linha: 0, coluna: 0 })
  const [selecao, setSelecao] = useState<Set<string>>(new Set())
  const [ancora, setAncora] = useState<number | null>(null)
  const [colunaEmLote, setColunaEmLote] = useState<string | null>(null)
  const [expandido, setExpandido] = useState(false)
  const [zoom, setZoom] = useState(1)
  // Claro por padrao: e o ambiente em que o servidor vive o dia inteiro.
  const [tema, setTema] = useState<'escuro' | 'claro'>('claro')
  const [telaCheia, setTelaCheia] = useState(false)
  const temporizadores = useRef<number[]>([])
  const moldura = useRef<HTMLDivElement>(null)
  const grade = useRef<HTMLDivElement>(null)

  useEffect(
    () => () => {
      temporizadores.current.forEach((t) => window.clearTimeout(t))
    },
    [],
  )

  const lista = useMemo(() => propostas.slice(0, 60), [propostas])

  /* ---------- Modos de tela ---------- */

  const alternarTelaCheia = useCallback(async () => {
    const el = moldura.current
    if (!el) return
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else {
        setExpandido(true)
        await el.requestFullscreen()
      }
    } catch {
      // Navegador ou política de permissão barrou: o modo foco já resolve.
      setExpandido(true)
    }
  }, [])

  useEffect(() => {
    const aoMudar = () => setTelaCheia(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', aoMudar)
    return () => document.removeEventListener('fullscreenchange', aoMudar)
  }, [])

  /* ---------- Teclado ---------- */

  /** Leva a célula em foco para dentro da área visível, sem sacudir a rolagem. */
  useEffect(() => {
    const el = grade.current?.querySelector<HTMLElement>(
      `[data-celula="${foco.linha}-${foco.coluna}"]`,
    )
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [foco])

  function aoTeclar(e: React.KeyboardEvent) {
    const col = COLUNAS[foco.coluna]
    const proposta = lista[foco.linha]
    const mover = (dLinha: number, dColuna: number) => {
      e.preventDefault()
      setAberta(null)
      setFoco((f) => ({
        linha: Math.min(Math.max(f.linha + dLinha, 0), lista.length - 1),
        coluna: Math.min(Math.max(f.coluna + dColuna, 0), COLUNAS.length - 1),
      }))
    }

    switch (e.key) {
      case 'ArrowUp':
        return mover(-1, 0)
      case 'ArrowDown':
        return mover(1, 0)
      case 'ArrowLeft':
        return mover(0, -1)
      case 'ArrowRight':
        return mover(0, 1)
      case 'Tab':
        return mover(0, e.shiftKey ? -1 : 1)
      case 'PageDown':
        return mover(12, 0)
      case 'PageUp':
        return mover(-12, 0)
      case 'Home':
        e.preventDefault()
        return setFoco((f) => ({ linha: e.ctrlKey ? 0 : f.linha, coluna: 0 }))
      case 'End':
        e.preventDefault()
        return setFoco((f) => ({
          linha: e.ctrlKey ? lista.length - 1 : f.linha,
          coluna: COLUNAS.length - 1,
        }))
      case 'Escape':
        e.preventDefault()
        if (aberta) return setAberta(null)
        if (telaCheia) return void document.exitFullscreen().catch(() => {})
        return setExpandido(false)
      case 'Enter':
      case ' ':
        if (col?.natureza === 'gatilho' && proposta) {
          e.preventDefault()
          const chave = CHAVE(proposta.id, col.id)
          setAberta((a) => (a === chave ? null : chave))
        }
        return
      case 's':
      case 'S':
        if (col?.natureza === 'gatilho' && proposta) {
          e.preventDefault()
          marcar(proposta, col, 'Sim')
        }
        return
      case 'n':
      case 'N':
        if (col?.natureza === 'gatilho' && proposta) {
          e.preventDefault()
          marcar(proposta, col, 'Não')
        }
        return
      case 'd':
      case 'D':
        // Ctrl+D é o "preencher para baixo" do Sheets — aqui ele desce a
        // coluna executando, que é exatamente o gesto do dia no MIDR.
        if (e.ctrlKey && col?.natureza === 'gatilho') {
          e.preventDefault()
          preencherParaBaixo(col)
        }
        return
      default:
        return
    }
  }

  /* ---------- Seleção de linhas ---------- */

  function alternarLinha(indice: number, comShift: boolean) {
    const p = lista[indice]
    if (!p) return
    setSelecao((s) => {
      const n = new Set(s)
      if (comShift && ancora !== null) {
        const [de, ate] = ancora < indice ? [ancora, indice] : [indice, ancora]
        for (let i = de; i <= ate; i++) n.add(lista[i].id)
        return n
      }
      if (n.has(p.id)) n.delete(p.id)
      else n.add(p.id)
      return n
    })
    if (!comShift) setAncora(indice)
  }

  /**
   * Dispara a automação de uma célula.
   *
   * O ritmo é o mesmo do modal de execução: um passo por vez, com o texto do
   * passo aparecendo na célula de resultado. Ver a célula trabalhar é o que
   * transforma "a planilha tem fórmula" em "a planilha tem alguém dentro".
   */
  const executar = useCallback(
    (proposta: Proposta, col: Coluna, atrasoInicial = 0) => {
      if (!col.destino || !col.passos) return
      const chaveGatilho = CHAVE(proposta.id, col.id)
      const chaveDestino = CHAVE(proposta.id, col.destino)

      setCelulas((prev) => ({
        ...prev,
        [chaveGatilho]: { gatilho: 'Sim', estado: 'pronto', resultado: '' },
        [chaveDestino]: { gatilho: '', estado: 'executando', resultado: '', passo: col.passos![0] },
      }))

      const porPasso = 620
      col.passos.forEach((texto, i) => {
        const t = window.setTimeout(
          () => {
            setCelulas((prev) => ({
              ...prev,
              [chaveDestino]: { gatilho: '', estado: 'executando', resultado: '', passo: texto },
            }))
          },
          atrasoInicial + i * porPasso,
        )
        temporizadores.current.push(t)
      })

      const fim = window.setTimeout(
        () => {
          setCelulas((prev) => ({
            ...prev,
            [chaveDestino]: {
              gatilho: '',
              estado: 'pronto',
              resultado: col.escreve ? col.escreve(proposta, 0) : 'Concluído',
            },
          }))
        },
        atrasoInicial + col.passos.length * porPasso,
      )
      temporizadores.current.push(fim)
    },
    [],
  )

  /** Preencher para baixo a partir da linha em foco — o Ctrl+D da planilha. */
  function preencherParaBaixo(col: Coluna) {
    const abaixo = lista.slice(foco.linha, foco.linha + 12)
    abaixo.forEach((p, i) => executar(p, col, i * 240))
    notificar({
      tipo: 'automacao',
      titulo: `${col.rotulo.replace('?', '')} — ${abaixo.length} linhas`,
      detalhe: 'Preenchido para baixo a partir da célula em foco.',
      href: '/propostas',
    })
  }

  /** Marcar a coluna inteira: o gesto que o servidor faz na planilha de verdade. */
  function executarColuna(col: Coluna) {
    const alvo = selecao.size > 0 ? lista.filter((p) => selecao.has(p.id)) : lista.slice(0, 12)
    alvo.forEach((p, i) => executar(p, col, i * 260))
    setColunaEmLote(null)
    notificar({
      tipo: 'automacao',
      titulo: `${col.rotulo.replace('?', '')} — ${alvo.length} propostas`,
      detalhe: 'A Cleo está descendo a coluna. Cada linha devolve o resultado na célula ao lado.',
      href: '/propostas',
    })
    registrarAuditoria({
      tipo: 'automacao',
      ator: eu?.nome ?? 'Cleo',
      acao: `Executou "${col.rito}" em lote pela planilha`,
      alvo: `${alvo.length} propostas`,
      detalhe: 'Execução simulada — nada foi enviado ao SEI ou ao TransfereGov.',
    })
  }

  function marcar(proposta: Proposta, col: Coluna, valor: 'Sim' | 'Não') {
    setAberta(null)
    if (valor === 'Não') {
      setCelulas((prev) => ({
        ...prev,
        [CHAVE(proposta.id, col.id)]: { gatilho: 'Não', estado: 'vazio', resultado: '' },
      }))
      return
    }
    executar(proposta, col)
    registrarAuditoria({
      tipo: 'automacao',
      ator: eu?.nome ?? 'Cleo',
      acao: `Executou "${col.rito}" pela planilha`,
      alvo: proposta.numero,
      detalhe: 'Execução simulada — nada foi enviado ao SEI ou ao TransfereGov.',
    })
  }

  const feitas = Object.values(celulas).filter((c) => c.estado === 'pronto' && c.resultado).length
  const rodando = Object.values(celulas).some((c) => c.estado === 'executando')
  const pal = PALETAS[tema]

  const colFoco = COLUNAS[foco.coluna]
  const propostaFoco = lista[foco.linha]
  const claro = tema === 'claro'

  return (
    <div
      ref={moldura}
      className={cn(
        'flex flex-col gap-3',
        // Modo foco: a planilha ocupa a tela e o resto da plataforma sai da
        // frente. Numa planilha, cada pixel gasto com menu é uma coluna a
        // menos — e é a coluna que carrega o trabalho.
        expandido && 'fixed inset-0 z-50 overflow-auto bg-abyss p-4',
      )}
    >
      {expandido && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="eyebrow">Cleopatra · Propostas · planilha</span>
          <span className="num text-[11.5px] text-faint">{lista.length} linhas</span>
        </div>
      )}

      {/* Barra de fórmulas — a régua que diz onde você está */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line bg-raised px-3 py-2">
        <span className="num shrink-0 rounded border border-line bg-abyss/60 px-2 py-1 text-[11.5px] text-ink">
          {colFoco.letra}
          {foco.linha + 2}
        </span>
        <span className="min-w-0 flex-1 truncate text-[12px] text-muted">
          <span className="text-ink">{colFoco.rotulo}</span>
          {propostaFoco && <span className="num text-faint"> · {propostaFoco.numero}</span>}
          {colFoco.natureza === 'gatilho' && (
            <span className="text-teal"> — tecle S para executar, N para dispensar</span>
          )}
        </span>

        {selecao.size > 0 && <Badge tom="gold">{selecao.size} linhas</Badge>}
        {rodando && (
          <span className="flex shrink-0 items-center gap-1.5 text-[11.5px] text-cleo">
            <Loader2 size={11} className="animate-spin" /> executando
          </span>
        )}
        {feitas > 0 && (
          <span className="num shrink-0 text-[11.5px] text-teal">{feitas} preenchidas</span>
        )}

        {/* Zoom, foco e tela cheia */}
        <div className="flex shrink-0 items-center gap-1 border-l border-line pl-3">
          <button
            onClick={() => setZoom(ZOOMS[Math.max(ZOOMS.indexOf(zoom) - 1, 0)])}
            disabled={zoom === ZOOMS[0]}
            className="px-1.5 text-[13px] text-muted transition-colors hover:text-ink disabled:opacity-30"
            title="Afastar"
          >
            −
          </button>
          <span className="num w-9 text-center text-[10.5px] text-faint">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(ZOOMS[Math.min(ZOOMS.indexOf(zoom) + 1, ZOOMS.length - 1)])}
            disabled={zoom === ZOOMS[ZOOMS.length - 1]}
            className="px-1.5 text-[13px] text-muted transition-colors hover:text-ink disabled:opacity-30"
            title="Aproximar"
          >
            +
          </button>
          <button
            onClick={() => setTema(claro ? 'escuro' : 'claro')}
            className={cn(
              'ml-1 flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11.5px] transition-colors',
              claro ? 'border-gold/50 bg-gold/10 text-gold' : 'border-line text-muted hover:text-ink',
            )}
            title="Planilha no branco do Google Sheets"
          >
            {claro ? <Sun size={11} /> : <Moon size={11} />}
            {claro ? 'Claro' : 'Escuro'}
          </button>
          <button
            onClick={() => setExpandido((v) => !v)}
            className={cn(
              'ml-1 flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11.5px] transition-colors',
              expandido
                ? 'border-gold/50 bg-gold/10 text-gold'
                : 'border-line text-muted hover:text-ink',
            )}
            title="Esconder os menus e usar a tela toda (Esc sai)"
          >
            {expandido ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
            {expandido ? 'Sair do foco' : 'Foco'}
          </button>
          <button
            onClick={alternarTelaCheia}
            className={cn(
              'flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11.5px] transition-colors',
              telaCheia
                ? 'border-gold/50 bg-gold/10 text-gold'
                : 'border-line text-muted hover:text-ink',
            )}
            title="Tela cheia do navegador"
          >
            <Expand size={11} />
            Tela cheia
          </button>
        </div>
      </div>

      {/* Régua de gatilhos: descer a coluna é o gesto do dia */}
      <div className="rolagem-discreta -mx-4 flex items-center gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
        <span className="eyebrow shrink-0">Executar na coluna</span>
        {GATILHOS.map((g) => (
          <button
            key={g.id}
            onClick={() => setColunaEmLote(colunaEmLote === g.id ? null : g.id)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11.5px] whitespace-nowrap transition-colors',
              colunaEmLote === g.id
                ? 'border-gold/50 bg-gold/10 text-gold'
                : 'border-line text-muted hover:border-teal/40 hover:text-teal',
            )}
          >
            <Zap size={10} /> {g.rotulo.replace('?', '')}
          </button>
        ))}
      </div>

      {colunaEmLote && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gold/30 bg-gold/[0.06] px-4 py-3">
          <Sparkles size={14} className="shrink-0 text-gold" />
          <p className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-muted">
            A Cleo vai marcar{' '}
            <span className="text-ink">
              {COLUNAS.find((c) => c.id === colunaEmLote)?.rotulo.replace('?', '')}
            </span>{' '}
            em{' '}
            <span className="text-gold">
              {selecao.size > 0 ? `${selecao.size} propostas selecionadas` : 'as 12 primeiras linhas'}
            </span>{' '}
            e escrever o resultado célula a célula. Nada é enviado ao SEI nem ao TransfereGov.
          </p>
          <Botao
            variante="primario"
            tamanho="sm"
            onClick={() => executarColuna(COLUNAS.find((c) => c.id === colunaEmLote)!)}
          >
            <Play size={11} fill="currentColor" /> Descer a coluna
          </Botao>
          <button
            onClick={() => setColunaEmLote(null)}
            className="text-faint hover:text-ink"
            aria-label="Cancelar"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* A grade */}
      <div
        ref={grade}
        tabIndex={0}
        onKeyDown={aoTeclar}
        role="grid"
        aria-label="Planilha de propostas"
        className={cn(
          'rolagem-discreta overflow-auto rounded-lg border outline-none',
          expandido ? 'min-h-0 flex-1' : 'max-h-[68vh]',
        )}
        style={{ zoom, background: pal.fundo, borderColor: pal.linha }}
      >
        <table className="w-max table-fixed border-separate border-spacing-0 text-[11.5px]">
          <colgroup>
            <col style={{ width: LARGURA_LINHA }} />
            {COLUNAS.map((c) => (
              <col key={c.id} style={{ width: c.largura }} />
            ))}
          </colgroup>
          <thead>
            {/* Letras das colunas, como no Sheets */}
            <tr>
              <th
                className="sticky top-0 left-0 z-40 border-r border-b"
                style={{ background: pal.cabecalho, borderColor: pal.linha }}
              />
              {COLUNAS.map((c, i) => (
                <th
                  key={`letra-${c.id}`}
                  className={cn(
                    'sticky top-0 border-r border-b px-2 py-0.5 text-center text-[10px] font-normal',
                    i < CONGELADAS ? 'z-40' : 'z-30',
                  )}
                  style={{
                    left: i < CONGELADAS ? ESQUERDA[i] : undefined,
                    borderColor: pal.linha,
                    // A coluna em foco acende no topo, como a régua do Sheets
                    background: i === foco.coluna ? pal.cabecalhoAtivo : pal.cabecalho,
                    color: i === foco.coluna ? pal.cabecalhoAtivoTexto : pal.cabecalhoTexto,
                    borderRightWidth: i === CONGELADAS - 1 ? 2 : undefined,
                    borderRightColor: i === CONGELADAS - 1 ? pal.linhaForte : undefined,
                  }}
                >
                  {c.letra}
                </th>
              ))}
            </tr>
            {/* Cabeçalho de verdade, colorido pela natureza da coluna */}
            <tr>
              <th
                className="sticky top-[19px] left-0 z-40 border-r border-b"
                style={{ background: pal.cabecalho, borderColor: pal.linha }}
              />
              {COLUNAS.map((c, i) => (
                <th
                  key={c.id}
                  className={cn(
                    'sticky top-[19px] overflow-hidden border-r border-b px-2 py-2 align-middle text-[10.5px] leading-tight font-semibold',
                    i < CONGELADAS ? 'z-40' : 'z-30',
                  )}
                  style={{
                    left: i < CONGELADAS ? ESQUERDA[i] : undefined,
                    borderColor: pal.linha,
                    ...pal.natureza[c.natureza],
                    borderRightWidth: i === CONGELADAS - 1 ? 2 : undefined,
                    borderRightColor: i === CONGELADAS - 1 ? pal.linhaForte : undefined,
                  }}
                >
                  {c.rotulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lista.map((p, linha) => {
              const prop = getProponente(p.proponenteId)
              const ext = extensaoDa(p.id)
              const emenda = ext?.emendaId ? getEmenda(ext.emendaId) : undefined
              const parlamentar = emenda?.parlamentarId
                ? getParlamentar(emenda.parlamentarId)
                : undefined
              const marcada = selecao.has(p.id)

              return (
                <tr key={p.id} className={cn(marcada && 'bg-gold/[0.05]')}>
                  <td
                    onClick={(e) => alternarLinha(linha, e.shiftKey)}
                    title="Clique para selecionar · Shift+clique seleciona o intervalo"
                    className="sticky left-0 z-20 cursor-pointer border-r border-b text-center text-[10px] transition-colors select-none"
                    style={{
                      borderColor: pal.linha,
                      background:
                        marcada || linha === foco.linha ? pal.cabecalhoAtivo : pal.cabecalho,
                      color:
                        marcada || linha === foco.linha
                          ? pal.cabecalhoAtivoTexto
                          : pal.cabecalhoTexto,
                    }}
                  >
                    {linha + 2}
                  </td>

                  {COLUNAS.map((c, i) => {
                    const chave = CHAVE(p.id, c.id)
                    const cel = celulas[chave]
                    const congelada = i < CONGELADAS

                    return (
                      <td
                        key={c.id}
                        data-celula={`${linha}-${i}`}
                        onClick={() => {
                          setFoco({ linha, coluna: i })
                          grade.current?.focus()
                        }}
                        className={cn(
                          'relative border-r border-b px-2 py-1.5 align-middle',
                          congelada && 'sticky z-20',
                        )}
                        // Cor no style, não em classe: duas classes `bg-*` na
                        // mesma célula competem por ordem de folha, não de
                        // escrita — e a congelada perdia o fundo opaco,
                        // deixando o conteúdo rolando por baixo vazar.
                        style={{
                          left: congelada ? ESQUERDA[i] : undefined,
                          borderColor: pal.linha,
                          background: pal.celula(
                            congelada,
                            marcada,
                            linha === foco.linha || i === foco.coluna,
                          ),
                          // A borda do painel congelado, como o Sheets marca
                          borderRightWidth: i === CONGELADAS - 1 ? 2 : undefined,
                          borderRightColor: i === CONGELADAS - 1 ? pal.linhaForte : undefined,
                          boxShadow:
                            linha === foco.linha && i === foco.coluna
                              ? `inset 0 0 0 2px ${pal.selecao}`
                              : undefined,
                        }}
                      >
                        {c.natureza === 'gatilho' ? (
                          <CelulaGatilho
                            valor={cel?.gatilho ?? ''}
                            aberta={aberta === chave}
                            claro={claro}
                            aoAbrir={() => setAberta(aberta === chave ? null : chave)}
                            aoEscolher={(v) => marcar(p, c, v)}
                          />
                        ) : c.natureza === 'resultado' ? (
                          <CelulaResultado celula={cel} claro={claro} />
                        ) : (
                          <span
                            className="block truncate text-[11.5px]"
                            style={{ color: pal.texto }}
                          >
                            {conteudo(c.id, p, prop?.nome, prop?.uf, parlamentar?.nome)}
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Atalhos à vista: teclado que ninguém descobre não existe */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-line bg-raised px-3 py-2 text-[11px] text-faint">
        <span className="eyebrow">Teclado</span>
        {[
          ['↑ ↓ ← →', 'andar pelas células'],
          ['S', 'executar nesta célula'],
          ['N', 'dispensar'],
          ['Ctrl + D', 'preencher para baixo'],
          ['Enter', 'abrir a lista'],
          ['Shift + clique', 'selecionar intervalo'],
          ['Esc', 'sair do foco'],
        ].map(([tecla, oque]) => (
          <span key={tecla} className="flex items-center gap-1.5">
            <kbd className="num rounded border border-line bg-abyss/60 px-1.5 py-0.5 text-[10px] text-muted">
              {tecla}
            </kbd>
            {oque}
          </span>
        ))}
      </div>

      {!expandido && (
        <p className="text-[11.5px] leading-relaxed text-faint">
          É a planilha que o órgão já usa — mesma gramática de colunas, com a diferença de que o
          resultado não depende de alguém lembrar de rodar o script. Clique numa célula{' '}
          <span className="text-teal">verde</span> e a Cleo executa aquela etapa nesta proposta,
          devolvendo na célula <span className="text-alert">vermelha</span> ao lado. Toda execução
          aqui é reconstruída na plataforma —{' '}
          <span className="text-ink">nada é enviado ao SEI nem ao TransfereGov</span>.
        </p>
      )}
    </div>
  )
}

/* ==================== Células ==================== */

function CelulaGatilho({
  valor,
  aberta,
  claro,
  aoAbrir,
  aoEscolher,
}: {
  valor: string
  aberta: boolean
  claro: boolean
  aoAbrir: () => void
  aoEscolher: (v: 'Sim' | 'Não') => void
}) {
  // No claro a ficha imita o chip de validação de dados do Sheets: fundo
  // cinza claro, borda fina, e verde só quando o valor está posto.
  const estilo =
    valor === 'Sim'
      ? claro
        ? { background: '#e6f4ea', borderColor: '#34a853', color: '#137333' }
        : undefined
      : claro
        ? { background: '#f1f3f4', borderColor: '#dadce0', color: '#5f6368' }
        : undefined

  return (
    <div className="relative">
      <button
        onClick={aoAbrir}
        style={estilo}
        className={cn(
          'flex h-[22px] w-full items-center justify-between rounded-[3px] border px-2 text-[11px] transition-colors',
          !claro &&
            (valor === 'Sim'
              ? 'border-teal/45 bg-teal/20 text-teal'
              : valor === 'Não'
                ? 'border-line bg-white/[0.04] text-faint'
                : 'border-transparent bg-white/[0.07] text-faint hover:bg-white/[0.11]'),
        )}
      >
        <span>{valor}</span>
        <ChevronDown size={10} className="shrink-0 opacity-70" />
      </button>
      {aberta && (
        <div
          className={cn(
            'absolute top-[24px] left-0 z-40 w-full min-w-[86px] overflow-hidden rounded-md border shadow-2xl',
            claro ? 'border-[#dadce0] bg-white' : 'border-line bg-surface',
          )}
        >
          {(['Sim', 'Não'] as const).map((v) => (
            <button
              key={v}
              onClick={() => aoEscolher(v)}
              className={cn(
                'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11.5px] transition-colors',
                claro
                  ? 'text-[#202124] hover:bg-[#f1f3f4]'
                  : 'text-ink hover:bg-white/[0.06]',
              )}
            >
              {v === 'Sim' ? (
                <Check size={10} className={claro ? 'text-[#137333]' : 'text-teal'} />
              ) : (
                <X size={10} className={claro ? 'text-[#5f6368]' : 'text-faint'} />
              )}
              {v}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CelulaResultado({ celula, claro }: { celula?: Celula; claro: boolean }) {
  if (!celula || celula.estado === 'vazio') return null
  if (celula.estado === 'executando') {
    return (
      <span
        className="flex items-center gap-1.5 text-[11px]"
        style={{ color: claro ? '#7b1fa2' : undefined }}
      >
        <Loader2
          size={10}
          className={cn('shrink-0 animate-spin', !claro && 'text-cleo')}
        />
        <span className={cn('truncate', !claro && 'text-cleo')}>{celula.passo}</span>
      </span>
    )
  }
  return (
    <span
      className={cn('flex items-center gap-1.5 text-[11px]', !claro && 'text-teal')}
      style={{ color: claro ? '#137333' : undefined }}
    >
      <Check size={10} className="shrink-0" />
      <span className="truncate">{celula.resultado}</span>
    </span>
  )
}

/* ==================== Conteúdo das colunas de dado ==================== */

function conteudo(
  id: string,
  p: Proposta,
  proponente?: string,
  uf?: string,
  parlamentar?: string,
): string {
  switch (id) {
    case 'data':
      return fmtData(p.dataCadastro)
    case 'proposta':
      return p.numero
    case 'rp':
      return parlamentar ? 'RP6' : 'RP2'
    case 'proponente':
      return proponente ?? ''
    case 'uf':
      return uf ?? ''
    case 'modalidade':
      return p.modalidade
    case 'acao':
      return p.programa.slice(0, 18)
    case 'vglobal':
      return moedaExata(p.valorGlobal)
    case 'vrepasse':
      return moedaExata(p.valorRepasse)
    case 'vcontrap':
      return moedaExata(p.valorContrapartida)
    case 'situacao':
      return p.situacao
    case 'c_portaria':
      return 'Portaria Interministerial nº 424/2016'
    case 'cauc':
      return 'Regular'
    case 'tgov':
      return fmtData(p.dataUltimaSincronizacao)
    default:
      return ''
  }
}
