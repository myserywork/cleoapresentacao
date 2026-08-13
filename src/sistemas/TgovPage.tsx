import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useBridgeExtensao, useCopiloto, type EventoPasso, type Passo } from './useCopiloto'
import { getProponente, propostasDoOrgao } from '@/data/repo'
import { moedaExata } from '@/lib/format'
import { CursorFantasma, EtiquetaCleo, HintExtensao } from './pecas'

/**
 * Nosso TransfereGov.
 *
 * A outra ponta que a extensão dirige: localizar a proposta, abrir as abas e
 * baixar o extrato e as contrapartidas — o material que o SEI vai receber. Os
 * passos aqui espelham o que o RPA faz hoje por fora, feito por dentro da
 * sessão do usuário.
 */

const MENU = ['Início', 'Propostas', 'Execução', 'Prestação de Contas', 'Consultas', 'Cadastros']

const ABAS = ['Dados', 'Plano de Trabalho', 'Contrapartida', 'Capacidade Técnica', 'Documentos']

export function TgovPage() {
  const palco = useRef<HTMLDivElement>(null)
  const { cursor, alvoDestacado, rodando, rodar, parar } = useCopiloto(palco)

  const proposta = useMemo(() => propostasDoOrgao('midr')[3] ?? propostasDoOrgao('midr')[0], [])
  const proponente = getProponente(proposta.proponenteId)

  const [busca, setBusca] = useState('')
  const [aberta, setAberta] = useState(false)
  const [aba, setAba] = useState('Dados')
  const [baixados, setBaixados] = useState<string[]>([])

  const { extensaoPresente, emitir } = useBridgeExtensao('tgov', (rito) => executar(rito))

  const executar = useCallback(
    async (rito: string) => {
      if (rodando) return
      setAberta(false)
      setBusca('')
      setAba('Dados')
      setBaixados([])

      const passos: Passo[] = [
        { alvo: 'menu-propostas', acao: 'clicar', rotulo: 'Abrir "Propostas"', duracao: 400 },
        { alvo: 'campo-busca', acao: 'digitar', valor: proposta.numero, rotulo: 'Localizar a proposta pelo número', aoAplicar: (v) => setBusca(v) },
        { alvo: 'linha-proposta', acao: 'clicar', rotulo: 'Abrir a proposta', duracao: 500, aoAplicar: () => setAberta(true) },
        { alvo: 'aba-contrapartida', acao: 'clicar', rotulo: 'Abrir a aba de contrapartida', duracao: 450, aoAplicar: () => setAba('Contrapartida') },
        { alvo: 'baixar-extrato', acao: 'clicar', rotulo: 'Gerar o extrato da proposta', duracao: 700, aoAplicar: () => setBaixados((b) => [...b, 'Extrato da Proposta.pdf']) },
        { alvo: 'baixar-contrapartida', acao: 'clicar', rotulo: 'Gerar o demonstrativo de contrapartidas', duracao: 700, aoAplicar: () => setBaixados((b) => [...b, 'Demonstrativo de Contrapartidas.pdf']) },
        { alvo: 'aba-capacidade', acao: 'clicar', rotulo: 'Abrir capacidade técnica', duracao: 450, aoAplicar: () => setAba('Capacidade Técnica') },
        { alvo: 'baixar-capacidade', acao: 'clicar', rotulo: 'Baixar os comprovantes de capacidade técnica', duracao: 700, aoAplicar: () => setBaixados((b) => [...b, 'Comprovantes de Capacidade Técnica.pdf']) },
      ]
      await rodar(passos, (e: EventoPasso) => emitir('passo', { passo: e, rito }))
      emitir('fim', { rito })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rodando, rodar, proposta],
  )

  useEffect(() => {
    document.title = 'TransfereGov — Transferências da União'
    document.documentElement.dataset.cleoSistema = 'tgov'
    document.documentElement.dataset.cleoUsuario = 'gov.br · usuário de serviço MIDR'
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36)
    document.cookie = `TGOV_SESSAO=${token}; path=/; SameSite=Lax; max-age=7200`
    document.cookie = `TGOV_GOVBR=selo-prata; path=/; SameSite=Lax; max-age=7200`
    return () => {
      delete document.documentElement.dataset.cleoSistema
      delete document.documentElement.dataset.cleoUsuario
    }
  }, [])

  const destaque = (alvo: string) =>
    alvoDestacado === alvo ? 'outline outline-2 outline-offset-2 outline-[#f5a623]' : ''

  const pctContrapartida = ((proposta.valorContrapartida / proposta.valorGlobal) * 100).toFixed(2)

  return (
    <div ref={palco} className="relative min-h-screen bg-[#f4f6f9] font-sans text-[#2c3e50]">
      {/* Barra gov.br */}
      <div className="flex items-center gap-2 bg-[#071d41] px-4 py-1.5 text-[11px] text-white">
        <span className="flex items-center gap-1 font-bold">
          gov<span className="text-[#ffcd07]">.br</span>
        </span>
        <span className="opacity-60">|</span>
        <span className="opacity-80">Ministério da Gestão e da Inovação em Serviços Públicos</span>
        <span className="ml-auto rounded bg-white/10 px-2 py-0.5">Usuário de serviço · MIDR</span>
      </div>

      {/* Cabeçalho TransfereGov */}
      <div className="border-b-4 border-[#1351b4] bg-white px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[22px] font-bold text-[#1351b4]">
            Transferegov<span className="text-[#168821]">.br</span>
          </span>
          <span className="ml-2 text-[12px] text-[#5c6a7a]">Transferências e Parcerias da União</span>
        </div>
      </div>

      {/* Menu horizontal */}
      <nav className="flex gap-1 border-b border-[#d3dce6] bg-white px-6">
        {MENU.map((item) => {
          const ativo = item === 'Propostas'
          const alvo = item === 'Propostas' ? 'menu-propostas' : undefined
          return (
            <button
              key={item}
              data-alvo={alvo}
              className={`border-b-2 px-3.5 py-2.5 text-[12.5px] ${ativo ? 'border-[#1351b4] font-semibold text-[#1351b4]' : 'border-transparent text-[#5c6a7a] hover:text-[#1351b4]'} ${destaque('menu-propostas')}`}
            >
              {item}
            </button>
          )
        })}
      </nav>

      <div className="p-6">
        {/* Breadcrumb */}
        <div className="mb-3 text-[11.5px] text-[#7a8a9a]">
          Início <span className="mx-1">›</span> Propostas{' '}
          {aberta && (
            <>
              <span className="mx-1">›</span> <span className="num text-[#1351b4]">{proposta.numero}</span>
            </>
          )}
        </div>

        {!aberta ? (
          <>
            {/* Filtro */}
            <div className="mb-4 rounded-lg border border-[#d3dce6] bg-white p-4">
              <label className="mb-1 block text-[11.5px] text-[#5c6a7a]">Número da proposta</label>
              <div className="flex gap-2">
                <input
                  data-alvo="campo-busca"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="0000000-00/0000"
                  className={`num h-9 w-[280px] rounded border border-[#b8c4d0] px-3 text-[13px] ${destaque('campo-busca')}`}
                />
                <button className="rounded bg-[#1351b4] px-4 text-[12.5px] font-medium text-white">
                  Consultar
                </button>
              </div>
            </div>

            {/* Resultado */}
            <div className="overflow-hidden rounded-lg border border-[#d3dce6] bg-white">
              <table className="w-full text-left text-[12.5px]">
                <thead className="bg-[#eef2f7] text-[#5c6a7a]">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Proposta</th>
                    <th className="px-4 py-2.5 font-medium">Proponente</th>
                    <th className="px-4 py-2.5 font-medium">Programa</th>
                    <th className="px-4 py-2.5 text-right font-medium">Valor global</th>
                  </tr>
                </thead>
                <tbody>
                  {busca && proposta.numero.includes(busca.replace(/\s/g, '')) ? (
                    <tr
                      data-alvo="linha-proposta"
                      onClick={() => setAberta(true)}
                      className={`cursor-pointer border-t border-[#eef2f7] hover:bg-[#f0f6ff] ${destaque('linha-proposta')}`}
                    >
                      <td className="num px-4 py-2.5 text-[#1351b4] underline">{proposta.numero}</td>
                      <td className="px-4 py-2.5">{proponente?.nome}</td>
                      <td className="px-4 py-2.5 text-[#5c6a7a]">{proposta.programa}</td>
                      <td className="num px-4 py-2.5 text-right text-[#168821]">{moedaExata(proposta.valorGlobal)}</td>
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-[12px] text-[#9aa7b4]">
                        Informe o número da proposta e consulte.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="overflow-hidden rounded-lg border border-[#d3dce6] bg-white">
            <div className="border-b border-[#d3dce6] bg-[#f8fafc] px-5 py-3">
              <div className="num text-[15px] font-semibold text-[#1351b4]">{proposta.numero}</div>
              <div className="text-[12px] text-[#5c6a7a]">{proposta.objeto}</div>
            </div>

            {/* Abas */}
            <div className="flex gap-1 border-b border-[#d3dce6] px-5">
              {ABAS.map((a) => {
                const alvo =
                  a === 'Contrapartida' ? 'aba-contrapartida' : a === 'Capacidade Técnica' ? 'aba-capacidade' : undefined
                return (
                  <button
                    key={a}
                    data-alvo={alvo}
                    onClick={() => setAba(a)}
                    className={`border-b-2 px-3.5 py-2.5 text-[12px] ${aba === a ? 'border-[#1351b4] font-semibold text-[#1351b4]' : 'border-transparent text-[#5c6a7a]'} ${alvo ? destaque(alvo) : ''}`}
                  >
                    {a}
                  </button>
                )
              })}
            </div>

            <div className="p-5">
              {aba === 'Contrapartida' && (
                <div>
                  <div className="mb-4 grid grid-cols-3 gap-4 text-[12.5px]">
                    <Campo rotulo="Valor global" valor={moedaExata(proposta.valorGlobal)} />
                    <Campo rotulo="Repasse da União" valor={moedaExata(proposta.valorRepasse)} />
                    <Campo rotulo="Contrapartida" valor={`${moedaExata(proposta.valorContrapartida)} (${pctContrapartida}%)`} />
                  </div>
                  <div className="flex gap-2">
                    <button data-alvo="baixar-extrato" className={`rounded border border-[#1351b4] px-3 py-1.5 text-[12px] text-[#1351b4] ${destaque('baixar-extrato')}`}>
                      Gerar extrato da proposta
                    </button>
                    <button data-alvo="baixar-contrapartida" className={`rounded border border-[#1351b4] px-3 py-1.5 text-[12px] text-[#1351b4] ${destaque('baixar-contrapartida')}`}>
                      Gerar demonstrativo de contrapartidas
                    </button>
                  </div>
                </div>
              )}

              {aba === 'Capacidade Técnica' && (
                <div>
                  <p className="mb-4 text-[12.5px] text-[#5c6a7a]">
                    Comprovantes de capacidade técnica do proponente {proponente?.nome}.
                  </p>
                  <button data-alvo="baixar-capacidade" className={`rounded border border-[#1351b4] px-3 py-1.5 text-[12px] text-[#1351b4] ${destaque('baixar-capacidade')}`}>
                    Baixar comprovantes
                  </button>
                </div>
              )}

              {aba !== 'Contrapartida' && aba !== 'Capacidade Técnica' && (
                <div className="grid grid-cols-2 gap-4 text-[12.5px]">
                  <Campo rotulo="Proponente" valor={proponente?.nome ?? '—'} />
                  <Campo rotulo="CNPJ" valor={proponente?.cnpj ?? '—'} />
                  <Campo rotulo="Programa" valor={proposta.programa} />
                  <Campo rotulo="Modalidade" valor={proposta.modalidade} />
                </div>
              )}

              {baixados.length > 0 && (
                <div className="mt-5 rounded-lg border border-[#168821]/30 bg-[#168821]/[0.06] p-3">
                  <div className="mb-1.5 text-[11px] font-semibold text-[#0f5c17]">
                    {baixados.length} arquivo(s) prontos para o SEI
                  </div>
                  <ul className="flex flex-col gap-1">
                    {baixados.map((b) => (
                      <li key={b} className="num flex items-center gap-2 text-[11.5px] text-[#0f5c17]">
                        <span className="inline-block size-1.5 rounded-full bg-[#168821]" /> {b}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <CursorFantasma cursor={cursor} />
      {extensaoPresente ? (
        <EtiquetaCleo rodando={rodando} />
      ) : (
        <HintExtensao
          sistema="TransfereGov"
          rodando={rodando}
          onExecutar={() => executar('extrato')}
          onDocumento={() => executar('extrato')}
          onParar={parar}
        />
      )}
    </div>
  )
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <div className="mb-0.5 text-[10.5px] tracking-wide text-[#9aa7b4] uppercase">{rotulo}</div>
      <div className="num text-[#2c3e50]">{valor}</div>
    </div>
  )
}
