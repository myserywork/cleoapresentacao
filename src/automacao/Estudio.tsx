import { useCallback, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Braces,
  CheckCircle2,
  Play,
  Plus,
  Save,
  Square,
  Trash2,
  Zap,
} from 'lucide-react'
import { useApp } from '@/store/app'
import { PASSOS_DISPONIVEIS, inferirFila } from '@/automacao/regras'
import type { PassoRito, Rito, TipoPasso } from '@/data/types'
import { cn, duracao } from '@/lib/format'
import { Badge, Botao, Campo, Panel } from '@/components/ui'

/**
 * Estúdio de ritos.
 *
 * O editor em lista diz o que acontece; o estúdio mostra o fluxo — nós ligados
 * por fios, com dois caminhos saindo de cada passo: o verde do sucesso e o
 * vermelho da falha. Automação de produção não é uma lista, é um grafo com
 * plano B. E cada passo publica variáveis que os seguintes consomem: o número
 * do processo que a autuação devolve é o mesmo que a anexação usa.
 */

type TipoNo = TipoPasso | 'inicio' | 'confirmar' | 'repensar'

interface NoFluxo {
  id: string
  tipo: TipoNo
  rotulo: string
  parametro: string
  x: number
  y: number
}

/**
 * Nós de verificação.
 *
 * Automação séria não é "executou, acabou": é "executou, confere se deu certo,
 * e se não deu, repensa". O nó de confirmação lê o resultado no próprio
 * sistema — o processo existe mesmo? o documento entrou na árvore? — e abre
 * dois caminhos. O de repensar é onde a Cleo tenta outra rota antes de
 * desistir e chamar gente.
 */
const NOS_ESPECIAIS: { tipo: TipoNo; rotulo: string; descricao: string }[] = [
  {
    tipo: 'confirmar',
    rotulo: 'Confirmar resultado',
    descricao: 'Volta ao sistema e verifica se a ação anterior realmente aconteceu.',
  },
  {
    tipo: 'repensar',
    rotulo: 'Repensar rota',
    descricao: 'Não deu certo: tenta caminho alternativo antes de chamar uma pessoa.',
  },
]

interface Ligacao {
  de: string
  para: string
  porta: 'sucesso' | 'falha'
}

/** O que cada tipo de passo publica para os passos seguintes. */
const SAIDAS: Partial<Record<TipoPasso, { nome: string; descricao: string }[]>> = {
  abrir_sistema: [{ nome: 'sessao.sistema', descricao: 'Sistema aberto na sessão' }],
  autenticar: [{ nome: 'sessao.usuario', descricao: 'Usuário de serviço autenticado' }],
  buscar_processo: [
    { nome: 'proposta.numero', descricao: 'Número da proposta localizada' },
    { nome: 'proposta.valorGlobal', descricao: 'Valor global do cadastro' },
    { nome: 'proposta.proponente', descricao: 'Nome do proponente' },
  ],
  criar_processo: [
    { nome: 'processo.numero', descricao: 'Número autuado devolvido pelo SEI' },
    { nome: 'processo.link', descricao: 'Endereço direto do processo' },
  ],
  gerar_documento: [
    { nome: 'documento.numero', descricao: 'Número do documento gerado' },
  ],
  anexar_documento: [{ nome: 'anexo.numero', descricao: 'Registro do documento externo' }],
  incluir_bloco: [{ nome: 'bloco.id', descricao: 'Bloco em que o processo entrou' }],
}

/** O que a confirmação publica para quem vem depois dela. */
const SAIDA_CONFIRMACAO = [
  { nome: 'confirmacao.ok', descricao: 'Verdadeiro se o sistema confirmou a ação' },
  { nome: 'confirmacao.evidencia', descricao: 'O que foi encontrado na verificação' },
]

const LARGURA_NO = 190
const ALTURA_NO = 64

/** Fluxo de partida: a instrução completa, já com o plano B desenhado. */
function fluxoInicial(): { nos: NoFluxo[]; ligacoes: Ligacao[] } {
  const nos: NoFluxo[] = [
    { id: 'inicio', tipo: 'inicio', rotulo: 'Gatilho', parametro: 'Proposta entra em análise', x: 30, y: 220 },
    { id: 'n1', tipo: 'abrir_sistema', rotulo: 'Abrir o SEI', parametro: 'SEI', x: 280, y: 120 },
    { id: 'n2', tipo: 'autenticar', rotulo: 'Autenticar', parametro: 'Usuário de serviço', x: 530, y: 120 },
    { id: 'n3', tipo: 'criar_processo', rotulo: 'Autuar processo', parametro: 'Convênios: Formalização', x: 780, y: 120 },
    { id: 'n4', tipo: 'anexar_documento', rotulo: 'Anexar extrato', parametro: 'Extrato de {{proposta.numero}}', x: 1030, y: 120 },
    { id: 'n5', tipo: 'gerar_documento', rotulo: 'Termo de análise', parametro: 'Minuta m1 em {{processo.numero}}', x: 1280, y: 120 },
    { id: 'n6', tipo: 'incluir_bloco', rotulo: 'Bloco de assinatura', parametro: 'Bloco da unidade', x: 1530, y: 120 },
    { id: 'n7', tipo: 'notificar', rotulo: 'Avisar analista', parametro: 'Instrução concluída', x: 1780, y: 220 },
    { id: 'n8', tipo: 'aguardar', rotulo: 'Esperar 5 min', parametro: 'Sessão instável', x: 780, y: 360 },
    { id: 'n9', tipo: 'repensar', rotulo: 'Repensar rota', parametro: 'Tentar pela busca de processo', x: 1030, y: 360 },
    { id: 'nc', tipo: 'confirmar', rotulo: 'Confirmar autuação', parametro: 'Processo existe na árvore?', x: 1030, y: 20 },
    { id: 'nx', tipo: 'notificar', rotulo: 'Chamar o analista', parametro: 'Duas tentativas sem sucesso', x: 1280, y: 360 },
  ]
  const ligacoes: Ligacao[] = [
    { de: 'inicio', para: 'n1', porta: 'sucesso' },
    { de: 'n1', para: 'n2', porta: 'sucesso' },
    { de: 'n2', para: 'n3', porta: 'sucesso' },
    { de: 'n3', para: 'nc', porta: 'sucesso' },
    { de: 'nc', para: 'n4', porta: 'sucesso' },
    { de: 'nc', para: 'n9', porta: 'falha' },
    { de: 'n4', para: 'n5', porta: 'sucesso' },
    { de: 'n5', para: 'n6', porta: 'sucesso' },
    { de: 'n6', para: 'n7', porta: 'sucesso' },
    { de: 'n3', para: 'n8', porta: 'falha' },
    { de: 'n8', para: 'n9', porta: 'sucesso' },
    { de: 'n9', para: 'n3', porta: 'sucesso' },
    { de: 'n9', para: 'nx', porta: 'falha' },
  ]
  return { nos, ligacoes }
}

export function Estudio() {
  const { salvarRito, notificar, registrarAuditoria } = useApp()
  const inicial = useMemo(fluxoInicial, [])
  const [nos, setNos] = useState<NoFluxo[]>(inicial.nos)
  const [ligacoes, setLigacoes] = useState<Ligacao[]>(inicial.ligacoes)
  const [selecionado, setSelecionado] = useState<string | null>('n3')
  const [nome, setNome] = useState('Instrução completa com plano B')

  // Execução simulada: os nós acendem na ordem do caminho de sucesso
  const [rodando, setRodando] = useState(false)
  const [acesos, setAcesos] = useState<Set<string>>(new Set())
  const [logs, setLogs] = useState<string[]>([])

  const palco = useRef<HTMLDivElement>(null)
  const arrastando = useRef<{ id: string; dx: number; dy: number } | null>(null)
  // Câmera do palco: arrastar o fundo move tudo, a roda dá zoom no ponteiro
  const [cam, setCam] = useState({ x: -20, y: -10, z: 0.66 })
  const panRef = useRef<{ x: number; y: number; camX: number; camY: number } | null>(null)
  const [fioAtivo, setFioAtivo] = useState<{
    de: string
    porta: 'sucesso' | 'falha'
    x: number
    y: number
  } | null>(null)

  /** Converte a posição do ponteiro para coordenadas do mundo do fluxo. */
  const posDoPalco = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const r = palco.current?.getBoundingClientRect()
      if (!r) return { x: 0, y: 0 }
      return {
        x: (e.clientX - r.left - cam.x) / cam.z,
        y: (e.clientY - r.top - cam.y) / cam.z,
      }
    },
    [cam],
  )

  function enquadrarTudo() {
    const r = palco.current?.getBoundingClientRect()
    if (!r || nos.length === 0) return
    const minX = Math.min(...nos.map((n) => n.x))
    const maxX = Math.max(...nos.map((n) => n.x + LARGURA_NO))
    const minY = Math.min(...nos.map((n) => n.y))
    const maxY = Math.max(...nos.map((n) => n.y + ALTURA_NO))
    // Piso de 55%: enquadrar não pode transformar o fluxo em formiga
    const z = Math.max(
      Math.min((r.width - 40) / (maxX - minX), (r.height - 40) / (maxY - minY), 1.4),
      0.55,
    )
    setCam({
      z,
      x: r.width / 2 - ((minX + maxX) / 2) * z,
      y: r.height / 2 - ((minY + maxY) / 2) * z,
    })
  }

  /* ---------- Variáveis disponíveis no nó selecionado ---------- */

  const anteriores = useCallback(
    (id: string): string[] => {
      const vistos = new Set<string>()
      let fronteira = [id]
      while (fronteira.length) {
        const proxima: string[] = []
        for (const alvo of fronteira) {
          for (const l of ligacoes) {
            if (l.para === alvo && !vistos.has(l.de)) {
              vistos.add(l.de)
              proxima.push(l.de)
            }
          }
        }
        fronteira = proxima
      }
      return [...vistos]
    },
    [ligacoes],
  )

  const noSelecionado = nos.find((n) => n.id === selecionado)
  const variaveisDisponiveis = useMemo(() => {
    if (!noSelecionado) return []
    const lista: { nome: string; descricao: string; origem: string }[] = [
      { nome: 'proposta.numero', descricao: 'Da proposta que disparou o gatilho', origem: 'Gatilho' },
    ]
    for (const idAnterior of anteriores(noSelecionado.id)) {
      const n = nos.find((x) => x.id === idAnterior)
      if (!n || n.tipo === 'inicio') continue
      const saidas = n.tipo === 'confirmar' ? SAIDA_CONFIRMACAO : (SAIDAS[n.tipo as TipoPasso] ?? [])
      for (const s of saidas) {
        if (!lista.some((x) => x.nome === s.nome)) lista.push({ ...s, origem: n.rotulo })
      }
    }
    return lista
  }, [noSelecionado, anteriores, nos])

  /* ---------- Avisos ---------- */

  const avisos = useMemo(() => {
    const lista: string[] = []
    const ligados = new Set(ligacoes.flatMap((l) => [l.de, l.para]))
    const soltos = nos.filter((n) => n.tipo !== 'inicio' && !ligados.has(n.id))
    if (soltos.length > 0)
      lista.push(`${soltos.length} passo(s) sem fio — não entram na execução.`)
    const criticos = nos.filter((n) =>
      ['criar_processo', 'gerar_documento', 'anexar_documento'].includes(n.tipo),
    )
    for (const c of criticos) {
      if (!ligacoes.some((l) => l.de === c.id && l.porta === 'falha'))
        lista.push(`"${c.rotulo}" não tem caminho de falha — se a sessão cair, o rito morre ali.`)
    }
    return lista
  }, [nos, ligacoes])

  /* ---------- Interação ---------- */

  function aoMover(e: React.PointerEvent) {
    if (panRef.current) {
      setCam((c) => ({
        ...c,
        x: panRef.current!.camX + (e.clientX - panRef.current!.x),
        y: panRef.current!.camY + (e.clientY - panRef.current!.y),
      }))
      return
    }
    if (arrastando.current) {
      const p = posDoPalco(e)
      const { id, dx, dy } = arrastando.current
      setNos((prev) =>
        prev.map((n) => (n.id === id ? { ...n, x: Math.max(p.x - dx, 0), y: Math.max(p.y - dy, 0) } : n)),
      )
    }
    if (fioAtivo) {
      const p = posDoPalco(e)
      setFioAtivo({ ...fioAtivo, x: p.x, y: p.y })
    }
  }

  function soltarFioEm(paraId: string) {
    if (!fioAtivo || fioAtivo.de === paraId) {
      setFioAtivo(null)
      return
    }
    setLigacoes((prev) => [
      ...prev.filter((l) => !(l.de === fioAtivo.de && l.porta === fioAtivo.porta)),
      { de: fioAtivo.de, para: paraId, porta: fioAtivo.porta },
    ])
    setFioAtivo(null)
  }

  function adicionarNo(tipo: TipoNo) {
    const especial = NOS_ESPECIAIS.find((n) => n.tipo === tipo)
    const modelo = especial ?? PASSOS_DISPONIVEIS.find((p) => p.tipo === tipo)!
    const id = `n-${Date.now()}`
    setNos((prev) => [
      ...prev,
      {
        id,
        tipo,
        rotulo: modelo.rotulo,
        parametro: '',
        x: 120 + (prev.length % 4) * 60,
        y: 420 + (prev.length % 3) * 40,
      },
    ])
    setSelecionado(id)
  }

  function removerNo(id: string) {
    setNos((prev) => prev.filter((n) => n.id !== id))
    setLigacoes((prev) => prev.filter((l) => l.de !== id && l.para !== id))
    if (selecionado === id) setSelecionado(null)
  }

  /* ---------- Execução simulada ---------- */

  function testar() {
    if (rodando) return
    // Percorre o caminho de sucesso a partir do gatilho
    const caminho: string[] = []
    let atual: string | undefined = 'inicio'
    const visitados = new Set<string>()
    while (atual && !visitados.has(atual)) {
      visitados.add(atual)
      caminho.push(atual)
      atual = ligacoes.find((l) => l.de === atual && l.porta === 'sucesso')?.para
    }
    setRodando(true)
    setAcesos(new Set())
    setLogs([])
    caminho.forEach((id, i) => {
      window.setTimeout(() => {
        setAcesos((prev) => new Set([...prev, id]))
        const n = nos.find((x) => x.id === id)
        if (n)
          setLogs((prev) => [
            ...prev,
            n.tipo === 'inicio'
              ? '▸ Gatilho disparado — proposta 0713672-79/2026'
              : n.tipo === 'confirmar'
              ? `🔎 ${n.rotulo} — confirmado: processo 59000.412877/2026-31 existe na árvore`
              : n.tipo === 'repensar'
                ? `↻ ${n.rotulo} — tentando caminho alternativo`
                : `✓ ${n.rotulo}${n.parametro ? ` · ${n.parametro.replace('{{proposta.numero}}', '0713672-79/2026').replace('{{processo.numero}}', '59000.412877/2026-31')}` : ''}`,
          ])
        if (i === caminho.length - 1) {
          window.setTimeout(() => setRodando(false), 900)
          setLogs((prev) => [...prev, `● Fluxo concluído em ${duracao(caminho.length * 7400)} (simulado)`])
        }
      }, i * 850)
    })
  }

  function publicar() {
    const caminho: string[] = []
    let atual: string | undefined = ligacoes.find((l) => l.de === 'inicio' && l.porta === 'sucesso')?.para
    const visitados = new Set<string>()
    while (atual && !visitados.has(atual)) {
      visitados.add(atual)
      caminho.push(atual)
      atual = ligacoes.find((l) => l.de === atual && l.porta === 'sucesso')?.para
    }
    const passos: PassoRito[] = caminho
      .map((id) => nos.find((n) => n.id === id))
      .filter((n): n is NoFluxo => !!n && n.tipo !== 'inicio' && n.tipo !== 'confirmar' && n.tipo !== 'repensar')
      .map((n, i) => ({ id: `p${i}`, tipo: n.tipo as TipoPasso, rotulo: n.rotulo, parametro: n.parametro }))

    const rito: Rito = {
      id: `rt-${Date.now()}`,
      nome,
      descricao: 'Desenhado no estúdio visual, com caminho de falha próprio.',
      sistema: 'Ambos',
      passos,
      fila: inferirFila(passos.map((p) => p.tipo)),
      execucoes: 0,
      taxaSucesso: 1,
      duracaoMediaMs: passos.length * 7400,
      publicado: true,
      autor: 'Você',
      criadoEm: new Date().toISOString(),
      deFabrica: false,
    }
    salvarRito(rito)
    registrarAuditoria({
      tipo: 'regra',
      ator: 'Você',
      acao: 'Publicou rito do estúdio visual',
      alvo: nome,
      detalhe: `${passos.length} passos no caminho de sucesso, ${ligacoes.filter((l) => l.porta === 'falha').length} desvio(s) de falha.`,
    })
    notificar({
      tipo: 'automacao',
      titulo: `Rito "${nome}" publicado`,
      detalhe: 'Disponível na biblioteca, nas regras e na execução em lote.',
      href: '/ritos',
    })
  }

  /* ---------- Desenho dos fios ---------- */

  function curva(x1: number, y1: number, x2: number, y2: number) {
    const folga = Math.max(Math.abs(x2 - x1) * 0.45, 40)
    return `M ${x1} ${y1} C ${x1 + folga} ${y1}, ${x2 - folga} ${y2}, ${x2} ${y2}`
  }

  const portaSaida = (n: NoFluxo, porta: 'sucesso' | 'falha') => ({
    x: n.x + LARGURA_NO,
    y: n.y + (porta === 'sucesso' ? 22 : 44),
  })
  const portaEntrada = (n: NoFluxo) => ({ x: n.x, y: n.y + ALTURA_NO / 2 })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_290px] items-start gap-4">
      {/* Paleta */}
      <Panel className="overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <div className="eyebrow">Paleta</div>
        </div>
        <ul className="max-h-[300px] divide-y divide-line-soft overflow-y-auto">
          {PASSOS_DISPONIVEIS.map((p) => (
            <li key={p.tipo}>
              <button
                onClick={() => adicionarNo(p.tipo)}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
              >
                <Plus size={11} className="shrink-0 text-cleo" />
                <span className="text-[12px] text-ink">{p.rotulo}</span>
              </button>
            </li>
          ))}
        </ul>

        {/* Verificação: o que separa automação séria de "executou e torceu" */}
        <div className="border-t border-line px-4 py-2.5">
          <div className="eyebrow mb-1.5">Verificação</div>
          {NOS_ESPECIAIS.map((n) => (
            <button
              key={n.tipo}
              onClick={() => adicionarNo(n.tipo)}
              className="mb-1 w-full rounded-lg border border-line px-2.5 py-2 text-left transition-colors hover:border-teal/40 hover:bg-teal/[0.05]"
            >
              <div className="flex items-center gap-1.5">
                <Plus size={10} className="shrink-0 text-teal" />
                <span className="text-[11.5px] text-ink">{n.rotulo}</span>
              </div>
              <p className="mt-0.5 pl-[16px] text-[10px] leading-snug text-faint">{n.descricao}</p>
            </button>
          ))}
        </div>
        <p className="border-t border-line px-4 py-3 text-[10.5px] leading-relaxed text-faint">
          Clique para pôr no palco; arraste pelo título; puxe um fio da porta{' '}
          <span className="text-teal">verde</span> (sucesso) ou{' '}
          <span className="text-alert">vermelha</span> (falha) até o próximo passo.
        </p>
      </Panel>

      {/* Palco */}
      <Panel className="overflow-hidden">
        <div className="flex items-center gap-3 border-b border-line px-4 py-2.5">
          <Zap size={13} className="shrink-0 text-gold" />
          <Campo
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="h-8 max-w-[340px] text-[13px]"
            aria-label="Nome do rito"
          />
          <div className="ml-auto flex items-center gap-2">
            <Botao tamanho="sm" onClick={testar} disabled={rodando}>
              {rodando ? <Square size={11} /> : <Play size={11} fill="currentColor" />}
              {rodando ? 'Rodando…' : 'Testar'}
            </Botao>
            <Botao tamanho="sm" variante="primario" onClick={publicar}>
              <Save size={11} /> Publicar
            </Botao>
          </div>
        </div>

        <div
          ref={palco}
          onPointerMove={aoMover}
          onPointerDown={(e) => {
            // Arrastar o fundo move a câmera; sobre um nó, quem manda é o nó
            if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.fundo) {
              panRef.current = { x: e.clientX, y: e.clientY, camX: cam.x, camY: cam.y }
            }
          }}
          onPointerUp={() => {
            arrastando.current = null
            panRef.current = null
            setFioAtivo(null)
          }}
          onPointerLeave={() => {
            panRef.current = null
          }}
          onWheel={(e) => {
            e.preventDefault()
            const r = palco.current!.getBoundingClientRect()
            const mx = e.clientX - r.left
            const my = e.clientY - r.top
            const fator = e.deltaY < 0 ? 1.12 : 1 / 1.12
            setCam((c) => {
              const z = Math.min(Math.max(c.z * fator, 0.3), 2.4)
              // Zoom ancorado no ponteiro: o ponto sob o cursor não escapa
              return { z, x: mx - ((mx - c.x) / c.z) * z, y: my - ((my - c.y) / c.z) * z }
            })
          }}
          className={cn(
            'relative h-[520px] overflow-hidden',
            panRef.current ? 'cursor-grabbing' : 'cursor-grab',
          )}
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(125,140,166,0.13) 1px, transparent 1px)',
            backgroundSize: `${22 * cam.z}px ${22 * cam.z}px`,
            backgroundPosition: `${cam.x}px ${cam.y}px`,
          }}
          data-fundo="1"
        >
          {/* Controles da câmera */}
          <div className="absolute right-3 bottom-3 z-20 flex items-center gap-1 rounded-lg border border-line bg-surface/95 px-1.5 py-1 backdrop-blur">
            <button
              onClick={() => setCam((c) => ({ ...c, z: Math.max(c.z / 1.2, 0.3) }))}
              className="px-2 py-0.5 text-[13px] text-muted hover:text-ink"
              title="Afastar"
            >
              −
            </button>
            <span className="num w-10 text-center text-[10.5px] text-faint">
              {Math.round(cam.z * 100)}%
            </span>
            <button
              onClick={() => setCam((c) => ({ ...c, z: Math.min(c.z * 1.2, 2.4) }))}
              className="px-2 py-0.5 text-[13px] text-muted hover:text-ink"
              title="Aproximar"
            >
              +
            </button>
            <button
              onClick={enquadrarTudo}
              className="ml-1 border-l border-line px-2 py-0.5 text-[10.5px] text-muted hover:text-ink"
              title="Enquadrar o fluxo inteiro"
            >
              ajustar
            </button>
          </div>

          <div
            className="absolute origin-top-left"
            style={{
              transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.z})`,
              width: 2200,
              height: 760,
            }}
            data-fundo="1"
          >
            <svg className="pointer-events-none absolute inset-0" width={2050} height={700}>
              {ligacoes.map((l, i) => {
                const de = nos.find((n) => n.id === l.de)
                const para = nos.find((n) => n.id === l.para)
                if (!de || !para) return null
                const a = portaSaida(de, l.porta)
                const b = portaEntrada(para)
                const aceso = acesos.has(l.de) && acesos.has(l.para)
                return (
                  <path
                    key={i}
                    d={curva(a.x, a.y, b.x, b.y)}
                    fill="none"
                    stroke={
                      l.porta === 'falha'
                        ? aceso
                          ? 'var(--color-alert)'
                          : 'rgba(226,86,77,0.5)'
                        : aceso
                          ? 'var(--color-teal)'
                          : 'rgba(53,195,167,0.45)'
                    }
                    strokeWidth={aceso ? 2.4 : 1.6}
                    strokeDasharray={l.porta === 'falha' ? '5 4' : undefined}
                  />
                )
              })}
              {fioAtivo &&
                (() => {
                  const de = nos.find((n) => n.id === fioAtivo.de)
                  if (!de) return null
                  const a = portaSaida(de, fioAtivo.porta)
                  return (
                    <path
                      d={curva(a.x, a.y, fioAtivo.x, fioAtivo.y)}
                      fill="none"
                      stroke="var(--color-gold)"
                      strokeWidth="1.8"
                      strokeDasharray="4 4"
                    />
                  )
                })()}
            </svg>

            {nos.map((n) => {
              const aceso = acesos.has(n.id)
              const inicio = n.tipo === 'inicio'
              const confirma = n.tipo === 'confirmar'
              const repensa = n.tipo === 'repensar'
              return (
                <div
                  key={n.id}
                  className={cn(
                    'absolute border transition-shadow select-none',
                    // A confirmação é losangular no espírito: cantos mais suaves
                    // e cor própria, para o olho separar "fazer" de "conferir"
                    confirma ? 'rounded-2xl border-teal/50 bg-teal/[0.07]' : repensa ? 'rounded-2xl border-gold/50 bg-gold/[0.07]' : 'rounded-xl',
                    inicio && 'border-gold/55 bg-gold/[0.1]',
                    !inicio && !confirma && !repensa && 'border-line bg-surface',
                    selecionado === n.id && 'ring-1 ring-gold/60',
                    aceso && 'border-teal/60 shadow-[0_0_18px_rgba(53,195,167,0.35)]',
                  )}
                  style={{ left: n.x, top: n.y, width: LARGURA_NO, height: ALTURA_NO }}
                  onClick={() => setSelecionado(n.id)}
                >
                  <div
                    className="flex cursor-grab items-center gap-1.5 px-3 pt-2 active:cursor-grabbing"
                    onPointerDown={(e) => {
                      const p = posDoPalco(e)
                      arrastando.current = { id: n.id, dx: p.x - n.x, dy: p.y - n.y }
                    }}
                  >
                    {aceso ? (
                      <CheckCircle2 size={11} className="shrink-0 text-teal" />
                    ) : (
                      <span
                        className={cn(
                          'size-1.5 shrink-0 rounded-full',
                          inicio ? 'bg-gold' : confirma ? 'bg-teal' : repensa ? 'bg-gold' : 'bg-cleo',
                        )}
                      />
                    )}
                    <span className="truncate text-[11.5px] font-medium text-ink">{n.rotulo}</span>
                    {!inicio && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          removerNo(n.id)
                        }}
                        className="ml-auto text-faint hover:text-alert"
                        aria-label="Remover passo"
                      >
                        <Trash2 size={10} />
                      </button>
                    )}
                  </div>
                  <div className="truncate px-3 pt-0.5 text-[10px] text-faint">
                    {n.parametro || '—'}
                  </div>

                  {/* Porta de entrada */}
                  {!inicio && (
                    <button
                      onPointerUp={() => soltarFioEm(n.id)}
                      aria-label="Porta de entrada"
                      className="absolute top-1/2 -left-[7px] size-3.5 -translate-y-1/2 rounded-full border-2 border-surface bg-inert transition-transform hover:scale-125"
                    />
                  )}
                  {/* Portas de saída: sucesso e falha */}
                  <button
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      const p = posDoPalco(e)
                      setFioAtivo({ de: n.id, porta: 'sucesso', x: p.x, y: p.y })
                    }}
                    aria-label="Saída de sucesso"
                    title="Sucesso"
                    className="absolute top-[22px] -right-[7px] size-3.5 -translate-y-1/2 rounded-full border-2 border-surface bg-teal transition-transform hover:scale-125"
                  />
                  {!inicio && n.tipo !== 'notificar' && (
                    <button
                      onPointerDown={(e) => {
                        e.stopPropagation()
                        const p = posDoPalco(e)
                        setFioAtivo({ de: n.id, porta: 'falha', x: p.x, y: p.y })
                      }}
                      aria-label="Saída de falha"
                      title="Falha"
                      className="absolute top-[44px] -right-[7px] size-3.5 -translate-y-1/2 rounded-full border-2 border-surface bg-alert transition-transform hover:scale-125"
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Log da execução simulada */}
        {logs.length > 0 && (
          <div className="max-h-[130px] overflow-y-auto border-t border-line bg-abyss/40 px-4 py-2.5">
            {logs.map((l, i) => (
              <div key={i} className="num py-0.5 text-[11px] text-muted">
                {l}
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Inspetor */}
      <div className="flex flex-col gap-4">
        <Panel className="overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <div className="eyebrow">{noSelecionado ? noSelecionado.rotulo : 'Inspetor'}</div>
          </div>
          {noSelecionado && noSelecionado.tipo !== 'inicio' ? (
            <div className="flex flex-col gap-3 px-4 py-4">
              <div>
                <div className="eyebrow mb-1.5">Parâmetro do passo</div>
                <Campo
                  value={noSelecionado.parametro}
                  onChange={(e) =>
                    setNos((prev) =>
                      prev.map((n) =>
                        n.id === noSelecionado.id ? { ...n, parametro: e.target.value } : n,
                      ),
                    )
                  }
                  placeholder="Use {{variáveis}} dos passos anteriores"
                />
              </div>
              <div>
                <div className="eyebrow mb-1.5 flex items-center gap-1.5">
                  <Braces size={10} /> Variáveis que chegam até aqui
                </div>
                <ul className="flex flex-col">
                  {variaveisDisponiveis.map((v) => (
                    <li key={v.nome}>
                      <button
                        onClick={() =>
                          setNos((prev) =>
                            prev.map((n) =>
                              n.id === noSelecionado.id
                                ? { ...n, parametro: `${n.parametro}{{${v.nome}}}` }
                                : n,
                            ),
                          )
                        }
                        className="w-full rounded px-1.5 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
                      >
                        <span className="num block text-[11px] text-teal">{`{{${v.nome}}}`}</span>
                        <span className="block text-[10px] text-faint">
                          {v.descricao} · de "{v.origem}"
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 border-t border-line-soft pt-2 text-[10.5px] leading-relaxed text-faint">
                  Um passo só enxerga o que os anteriores publicaram — ligar os fios é o que dá
                  acesso ao dado.
                </p>
              </div>
            </div>
          ) : (
            <p className="px-4 py-5 text-[12px] leading-relaxed text-muted">
              {noSelecionado
                ? 'O gatilho é a condição que dispara o fluxo — defina-a nas Regras.'
                : 'Selecione um passo no palco para editar o parâmetro e ver as variáveis disponíveis.'}
            </p>
          )}
        </Panel>

        <Panel className="overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <div className="eyebrow">Leitura da Cleo</div>
          </div>
          <div className="flex flex-col gap-2 px-4 py-3.5">
            {avisos.length === 0 ? (
              <div className="flex items-start gap-2 text-[12px] text-muted">
                <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-teal" />
                Fluxo íntegro: todo passo crítico tem caminho de falha e nenhum nó está solto.
              </div>
            ) : (
              avisos.map((a) => (
                <div key={a} className="flex items-start gap-2 text-[12px] text-muted">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0 text-gold" />
                  {a}
                </div>
              ))
            )}
            <div className="mt-1 flex items-center gap-2 border-t border-line-soft pt-2.5">
              <Badge tom="teal">{ligacoes.filter((l) => l.porta === 'sucesso').length} fios</Badge>
              <Badge tom="alert">
                {ligacoes.filter((l) => l.porta === 'falha').length} desvios de falha
              </Badge>
              <Badge tom="inert">{nos.length - 1} passos</Badge>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}
