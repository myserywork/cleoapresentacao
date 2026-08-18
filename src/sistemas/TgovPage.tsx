import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useBridgeExtensao, useCopiloto, type EventoPasso, type Passo } from './useCopiloto'
import { getProponente, propostasDoOrgao } from '@/data/repo'
import { moedaExata } from '@/lib/format'
import { CursorFantasma, EtiquetaCleo, HintExtensao } from './pecas'
import { MarcaTransfereGov } from './marcas'

/**
 * Nosso TransfereGov.
 *
 * A outra ponta que a extensão dirige: localizar a proposta, abrir as abas e
 * baixar o extrato e as contrapartidas — o material que o SEI vai receber. Os
 * passos aqui espelham o que o RPA faz hoje por fora, feito por dentro da
 * sessão do usuário.
 */

/** O menu real do TransfereGov, na ordem em que aparece nas duas fileiras. */
const MENU = [
  'Cadastramento',
  'Programas',
  'Propostas',
  'Execução',
  'Inf. Gerenciais',
  'Cadastros',
  'Acomp. e Fiscalização',
  'Prestação de Contas',
  'Administração',
  'TCE',
  'Verificação de Regularidade',
  'CPS',
]

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

  // O cronômetro de sessão que fica piscando no alto do TransfereGov. Conta
  // para trás de 30 minutos — é o detalhe que qualquer usuário reconhece.
  const [restante, setRestante] = useState(29 * 60 + 56)
  useEffect(() => {
    const t = setInterval(() => setRestante((r) => (r > 0 ? r - 1 : 30 * 60)), 1000)
    return () => clearInterval(t)
  }, [])
  const relogio = `${String(Math.floor(restante / 60)).padStart(2, '0')}:${String(restante % 60).padStart(2, '0')}`

  const pctContrapartida = ((proposta.valorContrapartida / proposta.valorGlobal) * 100).toFixed(2)

  return (
    <div ref={palco} className="relative min-h-screen bg-white font-sans text-[#2c3e50]">
      {/* Faixa preta com o cronômetro de sessão — a marca do TransfereGov */}
      <div className="flex items-center justify-between bg-black px-3 py-1 text-[11px] text-white">
        <span className="num">{relogio}</span>
        <span className="rounded-sm bg-[#ffcd07] px-2 py-[1px] text-[10.5px] font-semibold text-black">
          Acesso à Informação
        </span>
      </div>

      {/* Cabeçalho: logo, usuário e saída */}
      <div className="flex items-start justify-between border-b border-[#d3dce6] bg-white px-4 py-2">
        <div className="flex items-start gap-4">
          <MarcaTransfereGov altura={40} />
          <div className="pt-1 text-[11.5px]">
            <div>
              <span className="font-semibold text-[#333]">Usuário:</span> RENATA SILVA DE OLIVEIRA
            </div>
            <div className="num">
              <span className="font-semibold text-[#333]">CPF:</span> 669.696.971-34
            </div>
          </div>
        </div>
        <div className="text-right text-[11px]">
          <div className="font-semibold text-[#c0392b]">
            Sair do Sistema <span className="rounded-sm bg-[#c0392b] px-1 text-white">✕</span>
          </div>
          <div className="num mt-1 text-[10.5px] text-[#555]">
            13/08/2026 10:58 - v.3.10.18-b30442951
          </div>
        </div>
      </div>

      {/* Menu: fichas creme com seta laranja, em duas fileiras */}
      <nav className="flex flex-wrap gap-[3px] bg-white px-3 py-2">
        {MENU.map((item) => {
          const ativo = item === 'Propostas'
          const alvo = item === 'Propostas' ? 'menu-propostas' : undefined
          return (
            <button
              key={item}
              data-alvo={alvo}
              className={`flex min-w-[150px] flex-1 items-center gap-1.5 border px-2 py-[3px] text-left text-[11.5px] ${
                ativo
                  ? 'border-[#e8a33d] bg-[#fdf0d5] font-semibold text-[#1c1c1c]'
                  : 'border-[#e8d9b0] bg-[#fffaf0] text-[#1c1c1c] hover:bg-[#fdf0d5]'
              } ${destaque('menu-propostas')}`}
            >
              <span className="text-[9px] text-[#e8a33d]">▶</span>
              {item}
            </button>
          )
        })}
      </nav>

      <div className="px-4 pb-6">
        {/* Trilha */}
        <div className="py-2 text-[11.5px] text-[#1351b4]">
          <span className="mr-1">›</span>Principal <span className="mx-1">›</span>
          {aberta ? 'Consultar Proposta' : 'Propostas'}
        </div>

        {/* Aba azul do título + órgão à direita, como no sistema */}
        <div className="mb-1 flex items-end justify-between border-b-2 border-[#1351b4]">
          <span className="rounded-t-md bg-linear-to-b from-[#4a7fc1] to-[#1351b4] px-5 py-1.5 text-[14px] font-semibold text-white">
            {aberta ? 'Consultar Proposta' : 'Propostas'}
          </span>
          <span className="pb-1 text-[11.5px] font-semibold text-[#c0651c]">
            53000 - MINISTÉRIO DA INTEGRAÇÃO E DO DESENVOLVIMENTO REGIONAL
          </span>
        </div>
        {aberta && (
          <div className="mb-3 text-right text-[11px] text-[#555]">
            <span className="mr-1">›</span>Instrumento{' '}
            <span className="num text-[#1351b4]">994546</span>
          </div>
        )}

        {!aberta ? (
          <>
            {/* Filtro */}
            <div className="mb-3 border border-[#d9d9d9] bg-[#f6f6f6] p-3">
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
          <div className="bg-white">
            <div className="border-b border-[#d9d9d9] py-2">
              <div className="num text-[14px] font-semibold text-[#1351b4]">{proposta.numero}</div>
              <div className="text-[12px] text-[#333]">{proposta.objeto}</div>
            </div>

            {/* Abas */}
            {/* Fichas creme arredondadas, como as abas do TransfereGov */}
            <div className="flex flex-wrap gap-1.5 border-b border-[#d9d9d9] py-2.5">
              {ABAS.map((a) => {
                const alvo =
                  a === 'Contrapartida'
                    ? 'aba-contrapartida'
                    : a === 'Capacidade Técnica'
                      ? 'aba-capacidade'
                      : undefined
                return (
                  <button
                    key={a}
                    data-alvo={alvo}
                    onClick={() => setAba(a)}
                    className={`rounded-full border px-3.5 py-1 text-[11.5px] ${
                      aba === a
                        ? 'border-[#e8a33d] bg-[#fdf0d5] font-semibold text-[#1c1c1c]'
                        : 'border-[#e8d9b0] bg-[#fffaf0] text-[#1c1c1c] hover:bg-[#fdf0d5]'
                    } ${alvo ? destaque(alvo) : ''}`}
                  >
                    {a}
                  </button>
                )
              })}
            </div>

            <div className="pt-3">
              {aba === 'Contrapartida' && (
                <div>
                  <div className="mb-4 grid grid-cols-3 gap-4 text-[12.5px]">
                    <Campo rotulo="Valor global" valor={moedaExata(proposta.valorGlobal)} />
                    <Campo rotulo="Repasse da União" valor={moedaExata(proposta.valorRepasse)} />
                    <Campo rotulo="Contrapartida" valor={`${moedaExata(proposta.valorContrapartida)} (${pctContrapartida}%)`} />
                  </div>
                  <div className="flex gap-2">
                    <button data-alvo="baixar-extrato" className={`rounded-[2px] bg-[#2f6fb5] px-2.5 py-[3px] text-[11px] text-white ${destaque('baixar-extrato')}`}>
                      Gerar extrato da proposta
                    </button>
                    <button data-alvo="baixar-contrapartida" className={`rounded-[2px] bg-[#2f6fb5] px-2.5 py-[3px] text-[11px] text-white ${destaque('baixar-contrapartida')}`}>
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
                  <button data-alvo="baixar-capacidade" className={`rounded-[2px] bg-[#2f6fb5] px-2.5 py-[3px] text-[11px] text-white ${destaque('baixar-capacidade')}`}>
                    Baixar comprovantes
                  </button>
                </div>
              )}

              {/* A tela "Dados da Proposta" do TransfereGov: linhas planas de
                  rótulo e valor, separadas por fio, com seções em laranja.
                  Nada de cartão arredondado — o sistema não tem nenhum. */}
              {aba !== 'Contrapartida' && aba !== 'Capacidade Técnica' && (
                <div className="text-[12.5px]">
                  <Linha rotulo="Modalidade" valor={proposta.modalidade}>
                    <Par rotulo="Situação no SIAFI" valor="Enviado para o SIAFI - 2026NS003106" />
                  </Linha>
                  <Linha rotulo="Subtipo do Instrumento" valor="Não possui subtipo" />
                  <Linha rotulo="Situação de Contratação Atual" valor="Cláusula Suspensiva">
                    <div className="flex gap-1.5">
                      <BotaoTgov>Detalhar Cláusula Suspensiva/Liminar Judicial</BotaoTgov>
                      <BotaoTgov>Atualizar Cláusula Suspensiva/Liminar Judicial</BotaoTgov>
                    </div>
                  </Linha>
                  <Linha rotulo="Situação" valor={proposta.situacao}>
                    <div className="flex gap-12">
                      <Par rotulo="Empenhado" valor="sim" />
                      <Par rotulo="Publicação" valor="Publicado" />
                    </div>
                  </Linha>
                  <Linha rotulo="Código do Instrumento" valor="994546">
                    <Par rotulo="Número da Proposta" valor={proposta.numero} />
                  </Linha>
                  <Linha rotulo="Número Interno do Órgão" valor={proposta.numero.slice(0, 5)} />
                  <Linha rotulo="Número do Processo" valor={proposta.numProcessoSei ?? '59000.005307/2026-97'} />

                  <div className="border-b border-[#d9d9d9] py-2">
                    <div className="text-[#333]">Lista de Documentos Digitalizados</div>
                  </div>
                  <table className="w-full border-collapse text-[11.5px]">
                    <thead>
                      <tr className="bg-[#1f4e79] text-white">
                        <th className="px-2 py-1 text-left font-normal">Nome Arquivo</th>
                        <th className="px-2 py-1 text-left font-normal">Data Upload</th>
                        <th className="w-20 px-2 py-1" />
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['Termo de convênio assinado - 994546.pdf', '13/08/2026'],
                        ['DOU - 994546.pdf', '20/07/2026'],
                      ].map(([nome, quando]) => (
                        <tr key={nome} className="bg-[#dce6f1]">
                          <td className="px-2 py-1">{nome}</td>
                          <td className="num px-2 py-1">{quando}</td>
                          <td className="px-2 py-1 text-right">
                            <BotaoTgov>Baixar</BotaoTgov>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <Linha rotulo="Proponente" valor={`${proponente?.cnpj} - ${proponente?.nome?.toUpperCase()}`}>
                    <BotaoTgov>Detalhar</BotaoTgov>
                  </Linha>

                  <Secao>Executores</Secao>
                  <div className="border-b border-[#d9d9d9] py-2 text-[#333]">
                    Nenhum registro foi encontrado.
                  </div>

                  <Linha rotulo="Fundamento Legal" valor={proposta.fundamentoLegal} />
                  <Linha
                    rotulo="Órgão"
                    valor="53000 - MINISTÉRIO DA INTEGRAÇÃO E DO DESENVOLVIMENTO REGIONAL"
                  />

                  <Secao>Justificativa</Secao>
                  <div className="grid grid-cols-[220px_1fr] gap-4 border-b border-[#d9d9d9] py-2">
                    <span className="text-[#333]">Caracterização dos interesses recíprocos</span>
                    <span className="font-semibold text-[#1351b4]">{proposta.objeto}</span>
                  </div>
                </div>
              )}

              {baixados.length > 0 && (
                <div className="mt-4 border border-[#b6d7a8] bg-[#e9f4e4] px-3 py-2">
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

/**
 * Par rotulo/valor no padrao do TransfereGov: rotulo em cinza escuro, valor em
 * azul negrito. E o contraste que faz a tela ser reconhecida antes de ser lida.
 */
/**
 * Uma linha do formulário do TransfereGov.
 *
 * Rótulo à esquerda em coluna fixa, valor em azul negrito, fio embaixo, e um
 * espaço à direita para o par extra ou o botão — que é como o sistema resolve
 * duas informações na mesma linha.
 */
function Linha({
  rotulo,
  valor,
  children,
}: {
  rotulo: string
  valor: string
  children?: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[220px_minmax(0,1fr)_auto] items-center gap-4 border-b border-[#d9d9d9] py-2">
      <span className="text-[#333]">{rotulo}</span>
      <span className="font-semibold text-[#1351b4]">{valor}</span>
      <span className="text-right">{children}</span>
    </div>
  )
}

/** Par rótulo/valor solto, usado dentro de uma linha. */
function Par({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <span className="flex items-baseline gap-3 whitespace-nowrap">
      <span className="text-[#333]">{rotulo}</span>
      <span className="font-semibold text-[#1351b4]">{valor}</span>
    </span>
  )
}

/** Título de seção: laranja e sublinhado, a divisão do formulário. */
function Secao({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-[#d9d9d9] pt-3 pb-1 text-[13px] font-bold text-[#c0651c]">
      {children}
    </div>
  )
}

/** O botãozinho azul do TransfereGov — pequeno, chapado, canto reto. */
function BotaoTgov({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-[2px] bg-[#2f6fb5] px-2 py-[2px] text-[10.5px] whitespace-nowrap text-white">
      {children}
    </span>
  )
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <div className="mb-0.5 text-[11.5px] text-[#333]">{rotulo}</div>
      <div className="num text-[12.5px] font-semibold text-[#1351b4]">{valor}</div>
    </div>
  )
}
