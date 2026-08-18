import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCopiloto, useBridgeExtensao, type EventoPasso, type Passo } from './useCopiloto'
import { getProponente, propostasDoOrgao } from '@/data/repo'
import { CursorFantasma, EtiquetaCleo, HintExtensao } from './pecas'
import { MarcaSei } from './marcas'

/**
 * Nosso SEI.
 *
 * Reconstrução fiel do SEI como página inteira — não um modal dentro da
 * Cleopatra, mas "outro site" que a extensão da Cleo controla. Os campos são
 * reais e a árvore de processos cresce quando a autuação termina. É o alvo que
 * a extensão dirige com a sessão do próprio usuário.
 */

/**
 * O menu do SEI 4.0, na ordem alfabética em que ele aparece — com os itens que
 * abrem submenu marcados. A ordem importa: um servidor procura "Iniciar
 * Processo" pela posição na lista, não pelo texto.
 */
const MENU: { rotulo: string; icone: string; submenu?: boolean; recuado?: boolean }[] = [
  { rotulo: 'Acompanhamento Especial', icone: '◉' },
  { rotulo: 'Administração', icone: '⚙', submenu: true },
  { rotulo: 'Base de Conhecimento', icone: '≡' },
  { rotulo: 'Blocos', icone: '▣', submenu: true },
  { rotulo: 'Boletim de Serviço Eletrônico', icone: '', recuado: true },
  { rotulo: 'Contatos', icone: '☷' },
  { rotulo: 'Controle de Prazos', icone: '◷' },
  { rotulo: 'Controle de Processos', icone: '☰' },
  { rotulo: 'Estatísticas', icone: '◪', submenu: true },
  { rotulo: 'Favoritos', icone: '★' },
  { rotulo: 'Grupos', icone: '◍', submenu: true },
  { rotulo: 'Iniciar Processo', icone: '▤' },
  { rotulo: 'Manual do usuário SEI 4.0', icone: '', recuado: true },
  { rotulo: 'Marcadores', icone: '⬗' },
  { rotulo: 'PGD Petrvs (Programa de Gestão)', icone: '', recuado: true },
  { rotulo: 'Painel de Controle', icone: '⊞' },
  { rotulo: 'Pesquisa', icone: '⌕' },
  { rotulo: 'Pontos de Controle', icone: '❙❙' },
  { rotulo: 'Processos Sobrestados', icone: '❙❙' },
  { rotulo: 'Reabertura Programada', icone: '↻' },
  { rotulo: 'Relatórios', icone: '▤', submenu: true },
]

/** A barra de ferramentas do Controle de Processos — só as pastas coloridas. */
const FERRAMENTAS: { cor: string; titulo: string }[] = [
  { cor: '#f0ad2e', titulo: 'Reabrir processos' },
  { cor: '#f0ad2e', titulo: 'Ver informações' },
  { cor: '#f0ad2e', titulo: 'Atribuir processos' },
  { cor: '#c0392b', titulo: 'Adicionar aos favoritos' },
  { cor: '#f0ad2e', titulo: 'Sobrestar processos' },
  { cor: '#c0392b', titulo: 'Excluir' },
  { cor: '#e8b530', titulo: 'Gerar bloco' },
  { cor: '#2f80c1', titulo: 'Acompanhamento especial' },
  { cor: '#e8b530', titulo: 'Marcadores' },
  { cor: '#2f80c1', titulo: 'Enviar processos' },
  { cor: '#2f9e63', titulo: 'Controle de prazos' },
]

interface Processo {
  numero: string
  tipo: string
  interessado: string
  documentos: { nome: string; assinado: boolean; novo?: boolean }[]
  novo?: boolean
  /** Marcas que o SEI mostra na listagem, e que dão textura à caixa. */
  atribuido?: string
  aviso?: boolean
  atrasado?: boolean
}

const TIPO_PROCESSO = 'Convênios e Congêneres: Formalização'

/**
 * A árvore de um convênio já formalizado.
 *
 * É a sequência que um processo real acumula: os extratos do TransfereGov, as
 * declarações do proponente, a nota técnica, os despachos de cada unidade, o
 * empenho, o termo assinado e a publicação no DOU. Um processo com um
 * documento só não convence ninguém que já abriu o SEI.
 */
const DOCUMENTOS_DE_UM_CONVENIO = [
  { nome: 'Extrato da Proposta', assinado: true },
  { nome: 'Extrato da Proposta Aprovada', assinado: true },
  { nome: 'Declaração de Capacidade Técnica', assinado: true },
  { nome: 'Declaração de Contrapartida', assinado: true },
  { nome: 'Nota Técnica 211', assinado: false },
  { nome: 'Despacho 6590281', assinado: false },
  { nome: 'Despacho 6590276', assinado: false },
  { nome: 'Despacho 6720278', assinado: false },
  { nome: 'Extrato Plano de Trabalho Atualizado', assinado: true },
  { nome: 'Parecer 871', assinado: false },
  { nome: 'NC - Nota de Crédito 2026NC001319', assinado: true },
  { nome: 'Empenho 2026NE000851 2026RO002247', assinado: true },
  { nome: 'Empenho 2026NE000851', assinado: true },
  { nome: 'Despacho 6749363', assinado: false },
  { nome: 'Declaração Atestado de Conformidade', assinado: false },
  { nome: 'Documento Parecer Referencial', assinado: true },
  { nome: 'Convênio 1284', assinado: false },
  { nome: 'Termo de convênio assinado - 994546', assinado: true },
  { nome: 'Publicação 994546 DOU', assinado: true },
]

/**
 * A fila de fundo.
 *
 * Números derivados de uma sequência fixa — nada de sorteio, para a tela ser a
 * mesma em toda apresentação. Alguns vêm marcados: atribuído a alguém, com
 * aviso de prazo, ou em vermelho (sobrestado), que é o que dá textura à caixa
 * de entrada de quem usa o SEI de verdade.
 */
const FILA_INICIAL: Processo[] = Array.from({ length: 22 }, (_, i) => {
  const seq = 3993 + i * 617
  const dv = 10 + ((i * 7) % 80)
  return {
    numero: `59000.${String(seq).padStart(6, '0')}/2026-${dv}`,
    tipo: 'Convênios e Congêneres: Formalização',
    interessado: 'Município',
    documentos: [],
    atribuido: i === 3 ? 'rita.santos' : i === 6 ? 'carlos.souza' : undefined,
    aviso: i === 6 || i === 8 || i === 13,
    atrasado: i === 7 || i === 8 || i === 13,
  }
})

export function SeiPage() {
  const palco = useRef<HTMLDivElement>(null)
  const { cursor, alvoDestacado, rodando, rodar, parar } = useCopiloto(palco)

  const proposta = useMemo(() => {
    const lista = propostasDoOrgao('midr').filter((p) => !p.numProcessoSei)
    return lista[3] ?? propostasDoOrgao('midr')[0]
  }, [])
  const proponente = getProponente(proposta.proponenteId)

  // Estado do formulário e da árvore — dirigidos pela Cleo
  const [tela, setTela] = useState<'inicio' | 'form' | 'processo'>('inicio')
  const [tipo, setTipo] = useState('')
  const [espec, setEspec] = useState('')
  const [interessado, setInteressado] = useState('')
  const [processos, setProcessos] = useState<Processo[]>([
    {
      numero: '59000.201144/2026-07',
      tipo: 'Convênios e Congêneres: Prestação de Contas',
      interessado: 'Município de Petrópolis',
      documentos: DOCUMENTOS_DE_UM_CONVENIO,
    },
    {
      numero: '59000.198233/2026-45',
      tipo: 'Convênios e Congêneres: Acompanhamento',
      interessado: 'Consórcio Intermunicipal do Vale',
      documentos: [{ nome: 'Despacho 2984411', assinado: true }],
    },
    // A caixa de um servidor do MIDR tem dezenas de linhas, não duas. Sem
    // volume a tela não passa por SEI — passa por maquete de SEI.
    ...FILA_INICIAL,
  ])
  const [processoAtivo, setProcessoAtivo] = useState<string | null>(null)

  const numeroNovo = useMemo(
    () => `59000.${String(Math.floor(400000 + proposta.id.length * 9137)).padStart(6, '0')}/2026-${String(30 + (proposta.numero.length % 60)).padStart(2, '0')}`,
    [proposta],
  )

  const { extensaoPresente, emitir } = useBridgeExtensao('sei', (rito) => executar(rito))

  const executar = useCallback(
    async (rito: string) => {
      if (rodando) return
      setTela('form')
      setTipo('')
      setEspec('')
      setInteressado('')

      const passos: Passo[] =
        rito === 'documento'
          ? montarRitoDocumento()
          : montarRitoAutuar()

      await rodar(passos, (e: EventoPasso) => emitir('passo', { passo: e, rito }))
      emitir('fim', { rito })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rodando, rodar],
  )

  function montarRitoAutuar(): Passo[] {
    return [
      { alvo: 'menu-iniciar', acao: 'clicar', rotulo: 'Abrir "Iniciar Processo"', aoAplicar: () => setTela('form'), duracao: 500 },
      { alvo: 'campo-tipo', acao: 'selecionar', valor: TIPO_PROCESSO, rotulo: 'Escolher o tipo de processo', aoAplicar: (v) => setTipo(v) },
      { alvo: 'campo-espec', acao: 'digitar', valor: `Proposta ${proposta.numero} — ${proposta.objeto.slice(0, 46)}`, rotulo: 'Preencher a especificação', aoAplicar: (v) => setEspec(v) },
      { alvo: 'campo-interessado', acao: 'digitar', valor: proponente?.nome ?? 'Município', rotulo: 'Preencher o interessado', aoAplicar: (v) => setInteressado(v) },
      { alvo: 'botao-salvar', acao: 'clicar', rotulo: 'Salvar e autuar o processo', duracao: 700, aoAplicar: () => {
          setProcessos((prev) => [
            {
              numero: numeroNovo,
              tipo: TIPO_PROCESSO,
              interessado: proponente?.nome ?? 'Município',
              documentos: [],
              novo: true,
            },
            ...prev,
          ])
          setProcessoAtivo(numeroNovo)
          setTela('processo')
        } },
    ]
  }

  function montarRitoDocumento(): Passo[] {
    // Garante um processo aberto para receber o documento
    setProcessos((prev) => {
      if (prev.some((p) => p.numero === numeroNovo)) return prev
      return [
        { numero: numeroNovo, tipo: TIPO_PROCESSO, interessado: proponente?.nome ?? 'Município', documentos: [] },
        ...prev,
      ]
    })
    setProcessoAtivo(numeroNovo)
    setTela('processo')
    return [
      { alvo: 'no-processo', acao: 'clicar', rotulo: 'Abrir o processo no SEI', duracao: 500 },
      { alvo: 'acao-incluir', acao: 'clicar', rotulo: 'Incluir documento a partir do modelo', duracao: 600, aoAplicar: () => {
          setProcessos((prev) => prev.map((p) => p.numero === numeroNovo ? { ...p, documentos: [...p.documentos, { nome: 'Termo de Análise', assinado: false, novo: true }] } : p))
        } },
      { alvo: 'doc-novo', acao: 'aguardar', rotulo: 'Preencher os campos calculados da minuta', duracao: 900 },
      { alvo: 'acao-bloco', acao: 'clicar', rotulo: 'Incluir no bloco de assinatura', duracao: 600 },
    ]
  }

  useEffect(() => {
    document.title = 'SEI · Sistema Eletrônico de Informações'
    document.documentElement.dataset.cleoSistema = 'sei'
    document.documentElement.dataset.cleoUsuario = 'SNPDC · usuário de serviço'
    // Cookie de sessão autenticada — é o que a extensão captura e leva para a
    // Cleopatra. Simula o SESSIONID que o SEI grava ao logar.
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36)
    document.cookie = `SEI_SESSAO=${token}; path=/; SameSite=Lax; max-age=7200`
    document.cookie = `SEI_USUARIO=servico.midr; path=/; SameSite=Lax; max-age=7200`
    return () => {
      delete document.documentElement.dataset.cleoSistema
      delete document.documentElement.dataset.cleoUsuario
    }
  }, [])

  const destaqueClasse = (alvo: string) =>
    alvoDestacado === alvo ? 'outline outline-2 outline-offset-2 outline-[#f5a623]' : ''

  const procAtivo = processos.find((p) => p.numero === processoAtivo)

  return (
    <div ref={palco} className="relative min-h-screen bg-white font-sans text-[#333]">
      {/* Faixa do órgão: no SEI real ela é a primeira linha da página */}
      <div className="bg-[#15497b] px-2 py-[3px] text-[9.5px] font-semibold tracking-wide text-white">
        MINISTÉRIO DA INTEGRAÇÃO E DO DESENVOLVIMENTO REGIONAL
      </div>

      {/* Barra do SEI */}
      <div className="flex items-center justify-between bg-[#2f80c1] px-4 py-1.5 text-white">
        <MarcaSei altura={32} />
        <div className="flex items-center gap-3">
          <span className="text-[12.5px] font-semibold">Menu</span>
          <div className="flex h-[22px] w-[180px] items-center gap-1 rounded-sm bg-white px-2">
            <span className="flex-1 text-[11px] text-[#999]">Pesquisar...</span>
            <span className="text-[11px] text-[#2f80c1]">⌕</span>
          </div>
          <span className="rounded-sm border border-white/60 px-2 py-[2px] text-[11px]">
            CGAP DIRP
          </span>
          <div className="flex items-center gap-2 text-[13px] opacity-90">
            {['☰', '⌸', '◑', 'A', '✕', '☻', '⏻'].map((i, n) => (
              <span key={n}>{i}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Menu lateral */}
        <nav className="w-[240px] shrink-0 border-r border-[#d5dde4] bg-white">
          <div className="border-b border-[#e3e8ed] p-2">
            <div className="h-[26px] w-full rounded-sm border border-[#c9d2db] px-2 text-[11.5px] leading-[24px] text-[#8a8a8a]">
              Pesquisar no Menu
            </div>
          </div>
          {MENU.map((item) => {
            const ativo = item.rotulo === 'Iniciar Processo' && tela === 'form'
            const alvo = item.rotulo === 'Iniciar Processo' ? 'menu-iniciar' : undefined
            return (
              <button
                key={item.rotulo}
                data-alvo={alvo}
                onClick={() => item.rotulo === 'Iniciar Processo' && setTela('form')}
                className={`flex w-full items-center gap-2.5 px-3 py-[6px] text-left text-[12.5px] text-[#1c1c1c] hover:bg-[#eaf2f8] ${ativo ? 'bg-[#e3eff8] font-semibold' : ''} ${item.recuado ? 'pl-[38px]' : ''} ${alvo ? destaqueClasse('menu-iniciar') : ''}`}
              >
                {!item.recuado && (
                  <span className="w-[14px] shrink-0 text-center text-[12px] text-[#2f80c1]">
                    {item.icone}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate">{item.rotulo}</span>
                {item.submenu && <span className="text-[9px] text-[#777]">▾</span>}
              </button>
            )
          })}
        </nav>

        {/* Área de conteúdo */}
        <main className="min-h-[calc(100vh-42px)] flex-1 p-6">
          {tela === 'inicio' && (
            <div>
              <h1 className="mb-3 text-[21px] font-semibold text-[#1c1c1c]">
                Controle de Processos
              </h1>

              {/* A barra de pastas coloridas — a assinatura visual da tela */}
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-sm border border-[#d5dde4] bg-[#fafbfc] px-2 py-1.5">
                {FERRAMENTAS.map((f, i) => (
                  <span
                    key={i}
                    title={f.titulo}
                    className="flex h-[26px] w-[26px] items-center justify-center rounded-[3px] text-[15px] leading-none"
                    style={{ color: f.cor }}
                  >
                    ▉
                  </span>
                ))}
              </div>
              <div className="mb-4 flex gap-5 text-[12px] text-[#1c1c1c]">
                {['Ver atribuídos a mim', 'Ver por marcadores', 'Ver por tipo', 'Ver por prioridade'].map(
                  (t) => (
                    <span key={t}>{t}</span>
                  ),
                )}
              </div>

              {/* Duas colunas: Recebidos e Gerados, como no SEI */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {(['Recebidos', 'Gerados'] as const).map((coluna) => {
                  const daColuna =
                    coluna === 'Recebidos' ? processos : processos.slice().reverse()
                  return (
                    <div key={coluna}>
                      <div className="mb-1 text-right text-[11px] text-[#555]">
                        Processos {coluna === 'Recebidos' ? 'recebidos' : 'gerados'} (
                        {daColuna.length} registros - 1 a {daColuna.length}):
                      </div>
                      <table className="w-full border-collapse text-left text-[12.5px]">
                        <thead>
                          <tr className="bg-[#2e5c8a] text-white">
                            <th className="w-8 border border-[#1f4467] px-2 py-1.5 text-center">
                              ☑
                            </th>
                            <th className="border border-[#1f4467] px-2 py-1.5 text-center font-normal">
                              {coluna}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {daColuna.map((p, i) => (
                            <tr
                              key={p.numero}
                              data-alvo={
                                coluna === 'Recebidos' && p.numero === numeroNovo
                                  ? 'no-processo'
                                  : undefined
                              }
                              onClick={() => {
                                setProcessoAtivo(p.numero)
                                setTela('processo')
                              }}
                              className={`cursor-pointer ${p.novo ? 'bg-[#fff8e6]' : i % 2 ? 'bg-[#f0f0f0]' : 'bg-white'} hover:bg-[#e8f0f8]`}
                            >
                              <td className="border border-[#d5dde4] px-2 py-1 text-center text-[#999]">
                                ☐
                              </td>
                              <td className="border border-[#d5dde4] px-2 py-1">
                                <div className="grid grid-cols-[52px_1fr_86px] items-center">
                                  <span className="text-left text-[12px] leading-none">
                                    {p.aviso && <span className="text-[#e8b530]">⚠</span>}
                                    {p.atrasado && <span className="ml-1 text-[#c0392b]">⚠</span>}
                                  </span>
                                  <span
                                    className={`num text-center ${p.atrasado ? 'text-[#c0392b]' : 'text-[#1b5a8c]'}`}
                                  >
                                    {p.numero}
                                  </span>
                                  <span className="text-right text-[11.5px] text-[#555]">
                                    {p.atribuido && `(${p.atribuido})`}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {tela === 'form' && (
            <div>
              <h1 className="mb-4 text-[19px] font-normal text-[#2b5c82]">Iniciar Processo</h1>
              <div className="max-w-[680px] rounded border border-[#c9d2db] bg-white p-6">
                <label className="mb-1 block text-[12px] text-[#c0392b]">
                  Tipo do Processo: <span className="text-[#c0392b]">*</span>
                </label>
                <select
                  data-alvo="campo-tipo"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  className={`mb-4 h-8 w-full rounded border border-[#b8c2cc] bg-white px-2 text-[12.5px] ${destaqueClasse('campo-tipo')}`}
                >
                  <option value="">Selecione…</option>
                  <option value={TIPO_PROCESSO}>{TIPO_PROCESSO}</option>
                  <option>Convênios e Congêneres: Prestação de Contas</option>
                  <option>Convênios e Congêneres: Acompanhamento</option>
                </select>

                <label className="mb-1 block text-[12px] text-[#555]">Especificação:</label>
                <input
                  data-alvo="campo-espec"
                  value={espec}
                  onChange={(e) => setEspec(e.target.value)}
                  className={`mb-4 h-8 w-full rounded border border-[#b8c2cc] px-2 text-[12.5px] ${destaqueClasse('campo-espec')}`}
                />

                <label className="mb-1 block text-[12px] text-[#c0392b]">
                  Interessado: <span>*</span>
                </label>
                <input
                  data-alvo="campo-interessado"
                  value={interessado}
                  onChange={(e) => setInteressado(e.target.value)}
                  className={`mb-6 h-8 w-full rounded border border-[#b8c2cc] px-2 text-[12.5px] ${destaqueClasse('campo-interessado')}`}
                />

                <button
                  data-alvo="botao-salvar"
                  className={`rounded bg-linear-to-b from-[#4a90d9] to-[#357abd] px-5 py-1.5 text-[12.5px] font-medium text-white shadow-sm ${destaqueClasse('botao-salvar')}`}
                >
                  Salvar
                </button>
              </div>
            </div>
          )}

          {/* A tela do processo aberto: árvore à esquerda, barra de ícones e o
              quadro "Processo aberto nas unidades" à direita — que é
              literalmente tudo o que o SEI mostra aqui. */}
          {tela === 'processo' && procAtivo && (
            <div className="-mx-6 -mt-6 flex min-h-[calc(100vh-90px)]">
              <div className="w-[430px] shrink-0 border-r border-[#c9d2db] bg-white p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[11px] text-[#555]">☰</span>
                  <span className="num rounded-sm bg-[#2e5c8a] px-2 py-[3px] text-[12px] text-white">
                    {procAtivo.numero}
                  </span>
                  <span className="text-[12px] text-[#2f80c1]">◉◉</span>
                  <span className="text-[12px] text-[#e8b530]">👍</span>
                </div>

                <ul className="ml-3 flex flex-col">
                  {procAtivo.documentos.length === 0 && (
                    <li className="py-1 text-[11px] text-[#999]">nenhum documento ainda</li>
                  )}
                  {procAtivo.documentos.map((d, i) => {
                    const pdf = i % 3 !== 1
                    return (
                      <li
                        key={d.nome}
                        data-alvo={d.novo || (i === 0 && !procAtivo.documentos.some((x) => x.novo)) ? 'doc-novo' : undefined}
                        className={`flex items-center gap-1.5 py-[3px] text-[11.5px] ${d.novo ? 'bg-[#fff8e6]' : ''}`}
                      >
                        <span
                          className={`inline-flex h-[13px] w-[11px] shrink-0 items-center justify-center rounded-[1px] text-[7px] font-bold text-white ${pdf ? 'bg-[#c0392b]' : 'bg-[#5b9bd5]'}`}
                        >
                          {pdf ? 'P' : 'D'}
                        </span>
                        <span
                          className={`truncate text-[#1b5a8c] ${d.assinado ? '' : 'underline'}`}
                        >
                          {d.nome} ({6590257 + i * 37})
                        </span>
                        <span className="shrink-0 rounded-[2px] border border-[#c9d2db] bg-[#f0f0f0] px-1 text-[8.5px] text-[#555]">
                          CGAP DIRP
                        </span>
                        {!d.assinado && <span className="shrink-0 text-[10px]">✎</span>}
                      </li>
                    )
                  })}
                </ul>

                <div className="mt-4 flex items-center gap-1.5 border-t border-[#e3e8ed] pt-3 text-[12px] text-[#1b5a8c]">
                  <span>⌕</span> Consultar Andamento
                </div>
              </div>

              <div className="min-w-0 flex-1 p-3">
                {/* A barra de ícones do processo */}
                <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-sm border border-[#d5dde4] bg-white px-2 py-2">
                  {[
                    '#e8b530', '#f0ad2e', '#2f80c1', '#2f80c1', '#e8b530', '#2f80c1',
                    '#f0ad2e', '#2f80c1', '#e8b530', '#c0392b', '#2f9e63', '#c0392b',
                    '#2f80c1', '#e8b530', '#f0ad2e', '#c0392b', '#e8b530', '#2f9e63',
                    '#2f80c1', '#e8b530',
                  ].map((cor, i) => (
                    <span
                      key={i}
                      data-alvo={i === 0 ? 'acao-incluir' : i === 8 ? 'acao-bloco' : undefined}
                      className={`flex h-[26px] w-[26px] items-center justify-center rounded-[3px] text-[15px] leading-none ${i === 0 ? destaqueClasse('acao-incluir') : i === 8 ? destaqueClasse('acao-bloco') : ''}`}
                      style={{ color: cor }}
                    >
                      ▉
                    </span>
                  ))}
                </div>

                <div className="border border-[#d5dde4] bg-white px-4 py-3 text-[12.5px]">
                  <div className="mb-1.5">Processo aberto nas unidades:</div>
                  <div>CGAP DIRP</div>
                  <div>CGEO DORT (atribuído para leticia.marques)</div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <CursorFantasma cursor={cursor} />
      {extensaoPresente ? (
        <EtiquetaCleo rodando={rodando} />
      ) : (
        <HintExtensao
          sistema="SEI"
          rodando={rodando}
          onExecutar={() => executar('autuar')}
          onDocumento={() => executar('documento')}
          onParar={parar}
        />
      )}
    </div>
  )
}
