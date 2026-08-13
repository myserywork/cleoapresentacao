import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCopiloto, useBridgeExtensao, type EventoPasso, type Passo } from './useCopiloto'
import { getProponente, propostasDoOrgao } from '@/data/repo'
import { CursorFantasma, EtiquetaCleo, HintExtensao } from './pecas'

/**
 * Nosso SEI.
 *
 * Reconstrução fiel do SEI como página inteira — não um modal dentro da
 * Cleopatra, mas "outro site" que a extensão da Cleo controla. Os campos são
 * reais e a árvore de processos cresce quando a autuação termina. É o alvo que
 * a extensão dirige com a sessão do próprio usuário.
 */

const MENU = [
  'Controle de Processos',
  'Iniciar Processo',
  'Retorno Programado',
  'Pesquisa',
  'Base de Conhecimento',
  'Blocos de Assinatura',
  'Blocos Internos',
  'Contatos',
  'Favoritos',
  'Marcadores',
  'Pontos de Controle',
  'Estatísticas',
  'Grupos',
]

interface Processo {
  numero: string
  tipo: string
  interessado: string
  documentos: { nome: string; assinado: boolean }[]
  novo?: boolean
}

const TIPO_PROCESSO = 'Convênios e Congêneres: Formalização'

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
      documentos: [{ nome: 'Ofício 3021144', assinado: true }],
    },
    {
      numero: '59000.198233/2026-45',
      tipo: 'Convênios e Congêneres: Acompanhamento',
      interessado: 'Consórcio Intermunicipal do Vale',
      documentos: [{ nome: 'Despacho 2984411', assinado: true }],
    },
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
          setProcessos((prev) => prev.map((p) => p.numero === numeroNovo ? { ...p, documentos: [...p.documentos, { nome: 'Termo de Análise 44231907', assinado: false }] } : p))
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
    <div ref={palco} className="relative min-h-screen bg-[#eef1f4] font-sans text-[#333]">
      {/* Barra superior azul do SEI */}
      <div className="flex items-center justify-between bg-linear-to-r from-[#1c5a8c] to-[#134a76] px-4 py-2 text-white">
        <div className="flex items-center gap-3">
          <span className="font-serif text-[26px] leading-none font-bold italic tracking-tight">sei!</span>
          <span className="text-[11px] opacity-80">Sistema Eletrônico de Informações</span>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span>MINISTÉRIO DA INTEGRAÇÃO E DO DESENVOLVIMENTO REGIONAL</span>
          <span className="rounded bg-white/15 px-2 py-0.5">SNPDC · usuário de serviço</span>
        </div>
      </div>

      <div className="flex">
        {/* Menu lateral */}
        <nav className="w-[210px] shrink-0 border-r border-[#c9d2db] bg-white">
          {MENU.map((item) => {
            const ativo = item === 'Iniciar Processo' && tela === 'form'
            const alvo = item === 'Iniciar Processo' ? 'menu-iniciar' : undefined
            return (
              <button
                key={item}
                data-alvo={alvo}
                onClick={() => item === 'Iniciar Processo' && setTela('form')}
                className={`block w-full border-b border-[#eef1f4] px-4 py-[7px] text-left text-[12.5px] text-[#1b5a8c] hover:bg-[#f0f6fb] ${ativo ? 'bg-[#e3eff8] font-semibold' : ''} ${destaqueClasse('menu-iniciar') && alvo ? destaqueClasse('menu-iniciar') : ''}`}
              >
                {item}
              </button>
            )
          })}
        </nav>

        {/* Área de conteúdo */}
        <main className="min-h-[calc(100vh-42px)] flex-1 p-6">
          {tela === 'inicio' && (
            <div>
              <h1 className="mb-4 text-[19px] font-normal text-[#2b5c82]">Controle de Processos</h1>
              <div className="overflow-hidden rounded border border-[#c9d2db] bg-white">
                <div className="flex items-center justify-between border-b border-[#c9d2db] bg-[#f6f8fa] px-4 py-2 text-[12px] text-[#555]">
                  <span>Processos recebidos e gerados</span>
                  <span className="num">{processos.length} processos</span>
                </div>
                <table className="w-full text-left text-[12.5px]">
                  <thead className="bg-[#fafbfc] text-[#777]">
                    <tr>
                      <th className="px-4 py-2 font-medium">Processo</th>
                      <th className="px-4 py-2 font-medium">Tipo</th>
                      <th className="px-4 py-2 font-medium">Interessado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processos.map((p) => (
                      <tr
                        key={p.numero}
                        data-alvo={p.numero === numeroNovo ? 'no-processo' : undefined}
                        onClick={() => {
                          setProcessoAtivo(p.numero)
                          setTela('processo')
                        }}
                        className={`cursor-pointer border-t border-[#eef1f4] hover:bg-[#f0f6fb] ${p.novo ? 'bg-[#fff8e6]' : ''}`}
                      >
                        <td className="num px-4 py-2 text-[#1b5a8c] underline">{p.numero}</td>
                        <td className="px-4 py-2 text-[#555]">{p.tipo}</td>
                        <td className="px-4 py-2 text-[#555]">{p.interessado}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

          {tela === 'processo' && procAtivo && (
            <div className="flex gap-5">
              <div className="w-[260px] shrink-0 rounded border border-[#c9d2db] bg-white p-3">
                <div className="mb-2 text-[11px] font-semibold text-[#555]">Árvore do processo</div>
                <div className="num mb-2 flex items-center gap-1.5 text-[12px] text-[#1b5a8c]">
                  <span className="inline-block size-3 rounded-[2px] bg-[#f5c518]" />
                  {procAtivo.numero}
                </div>
                <ul className="ml-4 flex flex-col gap-1">
                  {procAtivo.documentos.map((d) => (
                    <li key={d.nome} data-alvo="doc-novo" className="flex items-center gap-1.5 text-[11.5px] text-[#1b5a8c]">
                      <span className="inline-block size-2.5 rounded-[1px] bg-[#8bb7dd]" />
                      {d.nome}
                      {!d.assinado && <span className="text-[9px] text-[#c0392b]">(sem assinatura)</span>}
                    </li>
                  ))}
                  {procAtivo.documentos.length === 0 && (
                    <li className="text-[11px] text-[#999]">nenhum documento ainda</li>
                  )}
                </ul>
              </div>

              <div className="flex-1 rounded border border-[#c9d2db] bg-white p-5">
                <div className="mb-4 flex items-center gap-2">
                  <button data-alvo="acao-incluir" className={`rounded border border-[#b8c2cc] bg-[#f6f8fa] px-3 py-1.5 text-[11.5px] text-[#1b5a8c] ${destaqueClasse('acao-incluir')}`}>
                    Incluir Documento
                  </button>
                  <button data-alvo="acao-bloco" className={`rounded border border-[#b8c2cc] bg-[#f6f8fa] px-3 py-1.5 text-[11.5px] text-[#1b5a8c] ${destaqueClasse('acao-bloco')}`}>
                    Incluir em Bloco
                  </button>
                </div>
                <div className="rounded border border-dashed border-[#c9d2db] bg-[#fafbfc] px-4 py-8 text-center text-[12px] text-[#888]">
                  {procAtivo.documentos.length === 0
                    ? 'Processo autuado. Aguardando inclusão de documentos.'
                    : `Processo com ${procAtivo.documentos.length} documento(s). Nos termos do Decreto nº 8.539/2015, os documentos são assinados eletronicamente.`}
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
