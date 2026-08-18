import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Lock, RotateCw, Search, Shield, Star } from 'lucide-react'
import type { Cena, Corpo } from '@/simulacao/tipos'
import { cn } from '@/lib/format'

/**
 * Reconstrução das telas do SEI e do TransfereGov.
 *
 * Renderizada, não capturada: nítida em projetor, anima cursor e digitação, e
 * não depende de nenhum sistema externo. O cromo de cada sistema é próprio —
 * um servidor que usa SEI todo dia reconhece a tela em meio segundo, e é essa
 * familiaridade que faz a simulação passar por real.
 */

/* ============================ SEI ============================ */

const MENU_SEI = [
  'Controle de Processos',
  'Iniciar Processo',
  'Retorno Programado',
  'Pesquisa',
  'Base de Conhecimento',
  'Textos Padrão',
  'Modelos Favoritos',
  'Blocos de Assinatura',
  'Blocos de Reunião',
  'Blocos Internos',
  'Contatos',
  'Processos Sobrestados',
  'Acompanhamento Especial',
  'Marcadores',
  'Pontos de Controle',
  'Estatísticas',
  'Grupos',
  'Relatórios',
]

function useDigitacao(texto: string, ativo: boolean, duracaoMs: number) {
  const [visivel, setVisivel] = useState(ativo ? '' : texto)

  useEffect(() => {
    if (!ativo) {
      setVisivel(texto)
      return
    }
    setVisivel('')
    const porChar = Math.max(duracaoMs / Math.max(texto.length, 1), 12)
    let i = 0
    const id = window.setInterval(() => {
      i++
      setVisivel(texto.slice(0, i))
      if (i >= texto.length) window.clearInterval(id)
    }, porChar)
    return () => window.clearInterval(id)
  }, [texto, ativo, duracaoMs])

  return visivel
}

/** Botão do SEI: caixa clara com borda, cantos retos, texto pequeno. */
function BotaoSei({ children, primario }: { children: React.ReactNode; primario?: boolean }) {
  return (
    <span
      className={cn(
        'inline-block border px-2.5 py-[3px] text-[10.5px] leading-[15px]',
        primario
          ? 'border-[#8fa8bd] bg-linear-to-b from-[#f2f6fa] to-[#dce6ef] text-[#0d3f66]'
          : 'border-[#b9c4ce] bg-linear-to-b from-white to-[#eaeef2] text-[#33475b]',
      )}
    >
      {children}
    </span>
  )
}

function CampoSei({
  rotulo,
  valor,
  digitando,
  largura = 'cheia',
  duracaoMs,
  obrigatorio,
}: {
  rotulo: string
  valor: string
  digitando?: boolean
  largura?: 'cheia' | 'meia' | 'terco'
  duracaoMs: number
  obrigatorio?: boolean
}) {
  const texto = useDigitacao(valor, !!digitando, duracaoMs * 0.6)
  const spans = { cheia: 'col-span-6', meia: 'col-span-3', terco: 'col-span-2' }

  return (
    <div className={spans[largura]}>
      <div className="mb-[3px] text-[10.5px] leading-tight text-[#2b3d4f]">
        {rotulo}
        {obrigatorio && <span className="ml-0.5 text-[#c00]">*</span>}:
      </div>
      <div
        className={cn(
          'flex h-[22px] items-center border bg-white px-1.5 text-[11px] text-[#111]',
          digitando ? 'border-[#3a7bbf] ring-1 ring-[#3a7bbf]/30' : 'border-[#7f9db9]',
        )}
      >
        <span className="truncate">{texto}</span>
        {digitando && texto.length < valor.length && (
          <span className="ml-px inline-block h-[12px] w-px animate-pulse bg-[#111]" />
        )}
      </div>
    </div>
  )
}

function CorpoSei({ corpo, duracaoMs }: { corpo: Corpo; duracaoMs: number }) {
  switch (corpo.tipo) {
    case 'login':
      return (
        <div className="flex h-full items-center justify-center bg-[#eef1f4]">
          <div className="w-[268px] border border-[#c3ced8] bg-white">
            <div className="border-b border-[#c3ced8] bg-linear-to-b from-[#f7f9fb] to-[#e9eef3] px-3 py-2">
              <span className="text-[11.5px] font-bold text-[#0d3f66]">Acesso ao Sistema</span>
            </div>
            <div className="px-3 py-3">
              <div className="mb-2">
                <div className="mb-[3px] text-[10.5px] text-[#2b3d4f]">Usuário:</div>
                <div className="flex h-[22px] items-center border border-[#7f9db9] bg-white px-1.5 text-[11px] text-[#111]">
                  {corpo.usuario}
                </div>
              </div>
              <div className="mb-2">
                <div className="mb-[3px] text-[10.5px] text-[#2b3d4f]">Senha:</div>
                <div className="flex h-[22px] items-center border border-[#7f9db9] bg-white px-1.5 text-[11px] tracking-[0.15em] text-[#111]">
                  {corpo.senhaMascarada}
                </div>
              </div>
              <div className="mb-3">
                <div className="mb-[3px] text-[10.5px] text-[#2b3d4f]">Órgão:</div>
                <div className="flex h-[22px] items-center justify-between border border-[#7f9db9] bg-white px-1.5 text-[11px] text-[#111]">
                  <span>MIDR</span>
                  <span className="text-[8px] text-[#556]">▼</span>
                </div>
              </div>
              <div className="text-center">
                <BotaoSei primario>Acessar</BotaoSei>
              </div>
            </div>
          </div>
        </div>
      )

    case 'formulario':
      return (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-end gap-1.5 border-b border-[#d5dde4] bg-[#f6f8fa] px-3 py-1.5">
            <BotaoSei primario>{corpo.botao}</BotaoSei>
            <BotaoSei>Cancelar</BotaoSei>
          </div>
          <div className="flex-1 px-3 py-3">
            <div className="grid grid-cols-6 gap-x-3 gap-y-2.5">
              {corpo.campos.map((campo, i) => (
                <CampoSei key={campo.rotulo} {...campo} obrigatorio={i < 2} duracaoMs={duracaoMs} />
              ))}
            </div>
            <div className="mt-4 border-t border-[#e2e8ed] pt-3">
              <div className="mb-1.5 text-[10.5px] font-bold text-[#2b3d4f]">Nível de Acesso</div>
              <div className="flex gap-4 text-[10.5px] text-[#2b3d4f]">
                {['Sigiloso', 'Restrito', 'Público'].map((n) => (
                  <label key={n} className="flex items-center gap-1">
                    <span
                      className={cn(
                        'inline-block size-[10px] rounded-full border',
                        n === 'Público'
                          ? 'border-[#3a7bbf] bg-[#3a7bbf] ring-1 ring-white ring-inset'
                          : 'border-[#7f9db9] bg-white',
                      )}
                    />
                    {n}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )

    case 'tabela':
      return (
        <div className="px-3 py-3">
          <table className="w-full border-collapse text-[10.5px]">
            <thead>
              <tr>
                {corpo.colunas.map((col) => (
                  <th
                    key={col}
                    className="border border-[#c3ced8] bg-linear-to-b from-[#f4f7fa] to-[#e4ebf1] px-1.5 py-1 text-left font-bold text-[#2b3d4f]"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {corpo.linhas.map((linha, i) => (
                <tr key={i} className={linha.destacada ? 'bg-[#fff8d5]' : i % 2 ? 'bg-[#f7f9fb]' : ''}>
                  {linha.celulas.map((cel, j) => (
                    <td key={j} className="border border-[#dbe2e8] px-1.5 py-1 text-[#111]">
                      {j === 0 ? (
                        <span className="text-[#1b4f8a] underline">{cel}</span>
                      ) : (
                        cel
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 text-[10px] text-[#5c6b7a]">
            {corpo.linhas.length} registro(s) encontrado(s)
          </div>
        </div>
      )

    case 'arvore':
      return (
        <div className="flex h-full">
          {/* Árvore do processo — a marca visual do SEI */}
          <div className="w-[188px] shrink-0 border-r border-[#d5dde4] bg-[#f7f9fb] px-2 py-2">
            <ul className="flex flex-col gap-[3px]">
              {corpo.itens.map((item, i) => (
                <li
                  key={i}
                  style={{ paddingLeft: item.nivel * 14 }}
                  className={cn(
                    'flex items-center gap-1.5 px-1 py-[2px] text-[10.5px] leading-tight',
                    item.ativo ? 'bg-[#c9def0] text-[#0d3f66]' : 'text-[#1b4f8a]',
                  )}
                >
                  <span
                    className={cn(
                      'inline-block size-[9px] shrink-0 rounded-[1px]',
                      item.nivel === 0 ? 'bg-[#e0b040]' : 'bg-[#9fb8cc]',
                    )}
                  />
                  <span className="truncate underline">{item.rotulo}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-1 items-center justify-center bg-white">
            <span className="text-[10.5px] text-[#8a97a4]">
              Selecione um documento na árvore para visualizá-lo
            </span>
          </div>
        </div>
      )

    case 'documento':
      return (
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-1.5 border-b border-[#d5dde4] bg-[#f6f8fa] px-3 py-1.5">
            {['Salvar', 'Assinar', 'Fechar'].map((b) => (
              <BotaoSei key={b} primario={b === 'Salvar'}>
                {b}
              </BotaoSei>
            ))}
            <span className="ml-auto text-[10px] text-[#5c6b7a]">Editor de documentos</span>
          </div>
          <div className="flex-1 overflow-hidden bg-[#e9edf1] p-3">
            <div className="mx-auto h-full w-full max-w-[430px] bg-white px-7 py-5 shadow-[0_1px_4px_rgba(0,0,0,0.18)]">
              <div className="mb-3 flex items-center justify-center gap-2 border-b border-[#e2e2e2] pb-2">
                <span className="size-4 rounded-full bg-[#1b4f8a]/15" />
                <span className="text-[7.5px] leading-tight text-[#444]">
                  MINISTÉRIO DA INTEGRAÇÃO E DO DESENVOLVIMENTO REGIONAL
                </span>
              </div>
              <div className="mb-3 text-center text-[10px] font-bold tracking-wide text-[#111]">
                {corpo.titulo}
              </div>
              <div className="flex flex-col gap-1.5">
                {corpo.paragrafos.map((p, i) => (
                  <p key={i} className="text-justify text-[8px] leading-[1.6] text-[#222]">
                    {p}
                  </p>
                ))}
              </div>
              {corpo.assinatura && (
                <div className="mt-5 border-t border-dashed border-[#c8c8c8] pt-2">
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded-sm bg-[#1b4f8a]/10">
                      <Shield size={10} className="text-[#1b4f8a]" />
                    </span>
                    <div>
                      <div className="text-[7.5px] leading-tight text-[#1b4f8a]">
                        Documento assinado eletronicamente por{' '}
                        <strong>{corpo.assinatura}</strong>
                      </div>
                      <div className="text-[7px] text-[#666]">
                        em 11/08/2026, às 14:32, conforme o art. 6º do Decreto nº 8.539/2015
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )

    case 'upload':
      return (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-end gap-1.5 border-b border-[#d5dde4] bg-[#f6f8fa] px-3 py-1.5">
            <BotaoSei primario>Confirmar Dados</BotaoSei>
            <BotaoSei>Voltar</BotaoSei>
          </div>
          <div className="flex-1 px-3 py-3">
            <div className="mb-3 grid grid-cols-6 gap-x-3 gap-y-2.5">
              <div className="col-span-3">
                <div className="mb-[3px] text-[10.5px] text-[#2b3d4f]">
                  Tipo do Documento<span className="text-[#c00]">*</span>:
                </div>
                <div className="flex h-[22px] items-center border border-[#7f9db9] bg-white px-1.5 text-[11px]">
                  Documento Externo
                </div>
              </div>
              <div className="col-span-3">
                <div className="mb-[3px] text-[10.5px] text-[#2b3d4f]">
                  Data do Documento<span className="text-[#c00]">*</span>:
                </div>
                <div className="flex h-[22px] items-center border border-[#7f9db9] bg-white px-1.5 text-[11px]">
                  11/08/2026
                </div>
              </div>
            </div>
            <div className="border border-dashed border-[#a9bccd] bg-[#f7fafc] p-3">
              <div className="mb-1.5 text-[10.5px] font-bold text-[#2b3d4f]">Anexar Arquivo</div>
              <div className="mb-2 flex items-center justify-between text-[10.5px] text-[#111]">
                <span className="truncate">{corpo.arquivo}</span>
                <span className="text-[#5c6b7a]">{corpo.tamanho}</span>
              </div>
              <div className="h-[6px] overflow-hidden rounded-full bg-[#dde4ea]">
                <div
                  className="h-full rounded-full bg-[#3a7bbf] transition-[width] duration-1000 ease-out"
                  style={{ width: `${corpo.progresso}%` }}
                />
              </div>
              <div className="mt-1.5 text-[10px] text-[#2b7a3d]">
                Upload concluído · arquivo pronto para registro
              </div>
            </div>
          </div>
        </div>
      )

    case 'confirmacao':
      return (
        <div className="flex h-full flex-col">
          <div className="border-b border-[#d5dde4] bg-[#f6f8fa] px-3 py-1.5">
            <span className="text-[10px] text-[#5c6b7a]">Processo aberto na unidade</span>
          </div>
          <div className="flex flex-1 items-center justify-center px-4">
            <div className="w-full max-w-[340px] border border-[#a8ceac] bg-[#eef8ef] p-3">
              <div className="mb-1 text-[11.5px] font-bold text-[#1f5c2a]">{corpo.titulo}</div>
              <div className="mb-2.5 text-[10.5px] text-[#2f6b39]">{corpo.mensagem}</div>
              <div className="border border-[#c9dccb] bg-white px-2.5 py-2 font-mono text-[12px] font-medium text-[#111]">
                {corpo.destaque}
              </div>
            </div>
          </div>
        </div>
      )
  }
}

function TelaSei({ cena, duracaoMs }: { cena: Cena; duracaoMs: number }) {
  return (
    <div className="flex h-full flex-col bg-white">
      {/* Faixa institucional do SEI */}
      <div className="flex items-center justify-between bg-linear-to-b from-[#1c5a8c] to-[#134a76] px-3 py-1.5">
        <span className="font-display text-[15px] leading-none font-bold tracking-tight text-white italic">
          sei<span className="text-[#8fc4e8]">!</span>
        </span>
        <div className="flex items-center gap-3 text-[9px] text-white/85">
          <span>MIDR</span>
          <span className="text-white/40">|</span>
          <span>{cena.corpo.tipo === 'login' ? 'Não autenticado' : 'cleopatra.rpa'}</span>
          <span className="text-white/40">|</span>
          <span>Sair</span>
        </div>
      </div>

      {/* Barra de pesquisa e ferramentas */}
      <div className="flex items-center gap-2 border-b border-[#c3ced8] bg-linear-to-b from-[#eef3f7] to-[#dfe7ee] px-3 py-1">
        <div className="flex h-[19px] w-[150px] items-center gap-1 border border-[#a7b7c5] bg-white px-1.5">
          <Search size={9} className="text-[#7b8794]" />
          <span className="text-[9.5px] text-[#98a4b0]">Pesquisar no menu</span>
        </div>
        <span className="ml-auto text-[9px] text-[#54687c]">
          {cena.corpo.tipo === 'login' ? '' : 'Secretaria Nacional de Proteção e Defesa Civil'}
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Menu do SEI: lista longa de links azuis, como no original */}
        <aside className="w-[132px] shrink-0 overflow-hidden border-r border-[#c3ced8] bg-[#f2f5f8] py-1.5">
          {MENU_SEI.map((m) => (
            <div
              key={m}
              className={cn(
                'px-2 py-[3px] text-[9.5px] leading-[1.25]',
                m === cena.menuAtivo
                  ? 'border-l-[3px] border-[#1c5a8c] bg-[#dceaf5] pl-[5px] font-bold text-[#0d3f66]'
                  : 'text-[#1b4f8a]',
              )}
            >
              {m}
            </div>
          ))}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Título da operação, com a trilha à direita como no SEI */}
          <div className="flex items-center justify-between border-b border-[#d5dde4] px-3 py-1.5">
            <span className="text-[11.5px] font-bold text-[#0d3f66]">
              {cena.breadcrumb.at(-1)}
            </span>
            <span className="text-[9px] text-[#7b8794]">{cena.breadcrumb.join(' / ')}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <CorpoSei corpo={cena.corpo} duracaoMs={duracaoMs} />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ============================ TransfereGov ============================ */

const MENU_TG = [
  'Painel de Controle',
  'Propostas',
  'Execução',
  'Prestação de Contas',
  'Cadastros',
  'Relatórios',
]

function CampoGov({
  rotulo,
  valor,
  digitando,
  largura = 'cheia',
  duracaoMs,
}: {
  rotulo: string
  valor: string
  digitando?: boolean
  largura?: 'cheia' | 'meia' | 'terco'
  duracaoMs: number
}) {
  const texto = useDigitacao(valor, !!digitando, duracaoMs * 0.6)
  const spans = { cheia: 'col-span-6', meia: 'col-span-3', terco: 'col-span-2' }

  return (
    <div className={spans[largura]}>
      <div className="mb-1 text-[10px] font-semibold text-[#333]">{rotulo}</div>
      <div
        className={cn(
          'flex h-[28px] items-center rounded-[4px] border bg-white px-2.5 text-[11px] text-[#1c1c1c]',
          digitando ? 'border-[#1351b4] ring-2 ring-[#1351b4]/20' : 'border-[#888]',
        )}
      >
        <span className="truncate">{texto}</span>
        {digitando && texto.length < valor.length && (
          <span className="ml-px inline-block h-[13px] w-px animate-pulse bg-[#1c1c1c]" />
        )}
      </div>
    </div>
  )
}

function CorpoGov({ corpo, duracaoMs }: { corpo: Corpo; duracaoMs: number }) {
  switch (corpo.tipo) {
    case 'tabela':
      return (
        <div className="px-4 py-3">
          <div className="mb-3 rounded-[6px] border border-[#e0e0e0] bg-[#f8f8f8] p-3">
            <div className="mb-2 text-[10px] font-semibold tracking-wide text-[#555] uppercase">
              Filtros de consulta
            </div>
            <div className="grid grid-cols-4 gap-2">
              {['Nº da proposta', 'CNPJ do proponente', 'UF', 'Situação'].map((f, i) => (
                <div key={f}>
                  <div className="mb-1 text-[9.5px] text-[#555]">{f}</div>
                  <div className="flex h-[24px] items-center rounded-[4px] border border-[#888] bg-white px-2 text-[10px] text-[#1c1c1c]">
                    {i === 0 ? corpo.linhas[0]?.celulas[0] : ''}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2.5 flex justify-end gap-2">
              <span className="rounded-full border border-[#1351b4] px-3 py-[3px] text-[10px] font-semibold text-[#1351b4]">
                Limpar
              </span>
              <span className="rounded-full bg-[#1351b4] px-3 py-[3px] text-[10px] font-semibold text-white">
                Consultar
              </span>
            </div>
          </div>

          <table className="w-full border-collapse text-[10.5px]">
            <thead>
              <tr className="border-b-2 border-[#1351b4]">
                {corpo.colunas.map((col) => (
                  <th key={col} className="px-2 py-1.5 text-left font-semibold text-[#1351b4]">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {corpo.linhas.map((linha, i) => (
                <tr
                  key={i}
                  className={cn(
                    'border-b border-[#e6e6e6]',
                    linha.destacada ? 'bg-[#e8f0fb]' : i % 2 ? 'bg-[#fafafa]' : '',
                  )}
                >
                  {linha.celulas.map((cel, j) => (
                    <td key={j} className="px-2 py-1.5 text-[#1c1c1c]">
                      {j === 0 ? (
                        <span className="font-semibold text-[#1351b4] underline">{cel}</span>
                      ) : (
                        cel
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-2.5 flex items-center justify-between text-[9.5px] text-[#555]">
            <span>Exibindo {corpo.linhas.length} de {corpo.linhas.length} registros</span>
            <div className="flex items-center gap-1">
              {['‹', '1', '›'].map((p) => (
                <span
                  key={p}
                  className={cn(
                    'flex size-[18px] items-center justify-center rounded-[3px] border',
                    p === '1'
                      ? 'border-[#1351b4] bg-[#1351b4] text-white'
                      : 'border-[#ccc] text-[#555]',
                  )}
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>
      )

    case 'formulario':
      return (
        <div className="px-4 py-3">
          <div className="mb-3 flex gap-0 border-b border-[#ccc]">
            {['Dados da Proposta', 'Plano de Trabalho', 'Contrapartida', 'Capacidade Técnica'].map(
              (t, i) => (
                <span
                  key={t}
                  className={cn(
                    'border-b-[3px] px-3 py-1.5 text-[10px]',
                    i === 0
                      ? 'border-[#1351b4] font-semibold text-[#1351b4]'
                      : 'border-transparent text-[#555]',
                  )}
                >
                  {t}
                </span>
              ),
            )}
          </div>
          <div className="grid grid-cols-6 gap-x-3 gap-y-3">
            {corpo.campos.map((campo) => (
              <CampoGov key={campo.rotulo} {...campo} duracaoMs={duracaoMs} />
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <span className="rounded-full bg-[#1351b4] px-4 py-1.5 text-[10.5px] font-semibold text-white">
              {corpo.botao}
            </span>
          </div>
        </div>
      )

    case 'upload':
      return (
        <div className="flex h-full items-center justify-center px-4">
          <div className="w-full max-w-[330px] rounded-[6px] border border-[#e0e0e0] bg-white p-4 shadow-sm">
            <div className="mb-2.5 flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-[4px] bg-[#e8f0fb]">
                <span className="text-[9px] font-bold text-[#1351b4]">PDF</span>
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[10.5px] font-semibold text-[#1c1c1c]">
                  {corpo.arquivo}
                </div>
                <div className="text-[9.5px] text-[#555]">{corpo.tamanho}</div>
              </div>
            </div>
            <div className="h-[6px] overflow-hidden rounded-full bg-[#e6e6e6]">
              <div
                className="h-full rounded-full bg-[#168821] transition-[width] duration-1000 ease-out"
                style={{ width: `${corpo.progresso}%` }}
              />
            </div>
            <div className="mt-2 text-[9.5px] font-semibold text-[#168821]">
              Documento gerado com sucesso
            </div>
          </div>
        </div>
      )

    default:
      return (
        <div className="flex h-full items-center justify-center">
          <span className="text-[10.5px] text-[#888]">Carregando…</span>
        </div>
      )
  }
}

function TelaTransfereGov({ cena, duracaoMs }: { cena: Cena; duracaoMs: number }) {
  return (
    <div className="flex h-full flex-col bg-white">
      {/* Barra gov.br */}
      <div className="flex items-center justify-between bg-[#071d41] px-3 py-1">
        <span className="text-[10px] font-bold tracking-tight text-white">
          gov<span className="text-[#ffcd07]">.</span>br
        </span>
        <div className="flex items-center gap-2.5 text-[8.5px] text-white/75">
          <span>Órgãos do Governo</span>
          <span>Acesso à Informação</span>
          <span>Legislação</span>
        </div>
      </div>

      {/* Cabeçalho do sistema */}
      <div className="flex items-center justify-between border-b border-[#e0e0e0] bg-white px-3 py-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[13px] font-bold tracking-tight text-[#1351b4]">
            Transferegov
            <span className="text-[#168821]">.br</span>
          </span>
          <span className="text-[8.5px] text-[#555]">Transferências Voluntárias</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex size-5 items-center justify-center rounded-full bg-[#e8f0fb]">
            <Search size={10} className="text-[#1351b4]" />
          </span>
          <span className="text-[9px] text-[#555]">Visitante</span>
        </div>
      </div>

      {/* Menu horizontal */}
      <div className="flex items-center gap-0 border-b border-[#e0e0e0] bg-[#f8f8f8] px-3">
        {MENU_TG.map((m) => (
          <span
            key={m}
            className={cn(
              'border-b-[3px] px-2.5 py-1.5 text-[9.5px]',
              m === cena.menuAtivo
                ? 'border-[#1351b4] font-semibold text-[#1351b4]'
                : 'border-transparent text-[#555]',
            )}
          >
            {m}
          </span>
        ))}
      </div>

      {/* Trilha de navegação */}
      <div className="flex items-center gap-1.5 border-b border-[#eee] px-3 py-1.5 text-[9px] text-[#555]">
        <span>Início</span>
        {cena.breadcrumb.map((b) => (
          <span key={b} className="flex items-center gap-1.5">
            <span className="text-[#bbb]">›</span>
            <span className={b === cena.breadcrumb.at(-1) ? 'font-semibold text-[#1c1c1c]' : ''}>
              {b}
            </span>
          </span>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <CorpoGov corpo={cena.corpo} duracaoMs={duracaoMs} />
      </div>
    </div>
  )
}

/* ============================ Moldura ============================ */

/** Largura para a qual o SEI e o TransfereGov foram desenhados. */
const LARGURA_BASE = 880

/**
 * Zoom, não reflow.
 *
 * O SEI e o TransfereGov nunca foram responsivos. Espremer os elementos para
 * caberem num celular descaracterizaria a tela — e é justamente a
 * familiaridade dela que faz a simulação passar por real. Então, quando não
 * cabe, a página inteira encolhe em escala, como o zoom do navegador faria.
 * Acima da largura de projeto nada muda: o layout volta a ser fluido.
 */
function Escala({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [escala, setEscala] = useState(1)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const medir = () => setEscala(Math.min(1, el.clientWidth / LARGURA_BASE))
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(el)
    return () => observador.disconnect()
  }, [])

  if (escala >= 1) {
    return (
      <div ref={ref} className="h-full">
        {children}
      </div>
    )
  }

  return (
    <div ref={ref} className="h-full overflow-hidden">
      <div
        style={{
          width: LARGURA_BASE,
          height: `${100 / escala}%`,
          transform: `scale(${escala})`,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </div>
  )
}

export function TelaSimulada({ cena, duracaoMs }: { cena: Cena; duracaoMs: number }) {
  return (
    <Escala>
      <TelaSimuladaInterna cena={cena} duracaoMs={duracaoMs} />
    </Escala>
  )
}

function TelaSimuladaInterna({ cena, duracaoMs }: { cena: Cena; duracaoMs: number }) {
  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-lg border border-line bg-[#dfe4ea]">
      {/* Cromo do navegador */}
      <div className="flex items-center gap-2 border-b border-[#c3ccd5] bg-[#dfe4ea] px-3 py-2">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
        </div>
        <RotateCw size={10} className="ml-1.5 text-[#7b8794]" />
        <div className="flex h-6 flex-1 items-center gap-1.5 rounded-full bg-white px-2.5">
          <Lock size={9} className="text-[#2b7a3d]" />
          <span className="truncate font-mono text-[10px] text-[#4a5568]">{cena.url}</span>
          <Star size={9} className="ml-auto text-[#c3ccd5]" />
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {cena.sistema === 'SEI' ? (
          <TelaSei cena={cena} duracaoMs={duracaoMs} />
        ) : (
          <TelaTransfereGov cena={cena} duracaoMs={duracaoMs} />
        )}
      </div>

      {cena.cursor && <Cursor x={cena.cursor.x} y={cena.cursor.y} clique={cena.cursor.clique} />}
    </div>
  )
}

function Cursor({ x, y, clique }: { x: number; y: number; clique?: boolean }) {
  return (
    <div
      className="pointer-events-none absolute z-10 transition-all duration-[900ms] ease-out"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {clique && (
        <span className="absolute -top-2 -left-2 size-8 animate-ping rounded-full border-2 border-gold/70" />
      )}
      <svg width="17" height="21" viewBox="0 0 17 21" className="drop-shadow-md">
        <path
          d="M1 1 L1 16 L5 12.5 L8 19 L11 17.5 L8 11.5 L13.5 11.5 Z"
          fill="#101828"
          stroke="#fff"
          strokeWidth="1.3"
        />
      </svg>
    </div>
  )
}
