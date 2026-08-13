import { useMemo } from 'react'
import {
  ArrowUpRight,
  Globe,
  Download,
  KeyRound,
  MousePointerClick,
  Puzzle,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react'
import { Botao, Panel, PanelHeader } from '@/components/ui'

/**
 * Extensão do Chrome.
 *
 * A ponte entre a Cleopatra e os sistemas oficiais: uma extensão real que opera
 * o SEI e o TransfereGov dentro da sessão do próprio usuário. Aqui ela é
 * baixável, com as instruções de instalação e os botões para ver o copiloto em
 * ação nos nossos sistemas de demonstração.
 */
export function Extensao() {
  // O host atual — para os links funcionarem no localhost e no túnel
  const base = useMemo(() => window.location.origin, [])

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="eyebrow mb-2">A ponte</div>
          <h1 className="text-[26px] leading-tight">Extensão do Chrome</h1>
          <p className="mt-1.5 max-w-[74ch] text-[13px] text-muted">
            A Cleo dentro do navegador: uma extensão real que opera o SEI e o TransfereGov na sua
            própria sessão, com a sua autorização. Nenhuma senha sai daqui.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/cleo-extensao.zip" download>
            <Botao variante="primario">
              <Download size={14} /> Baixar a extensão
            </Botao>
          </a>
        </div>
      </header>

      {/* O herói: núcleo + dois sistemas */}
      <Panel className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_360px_at_50%_-10%,rgba(139,108,240,0.14),transparent_70%)]" />
        <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-8 px-8 py-9">
          <a
            href={`${base}/sistemas/sei`}
            target="_blank"
            rel="noreferrer"
            className="group rounded-xl border border-line bg-abyss/40 p-5 transition-colors hover:border-cleo/40"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="font-serif text-[22px] font-bold text-[#4a90d9] italic">sei!</span>
              <ArrowUpRight size={14} className="text-faint transition-colors group-hover:text-cleo" />
            </div>
            <div className="text-[13px] text-ink">Nosso SEI</div>
            <p className="mt-1 text-[11.5px] text-muted">
              Autuar processo, redigir termo, incluir no bloco de assinatura.
            </p>
          </a>

          <div className="flex flex-col items-center gap-2">
            <span className="flex size-14 items-center justify-center rounded-full border border-cleo/40 bg-cleo/10">
              <Sparkles size={22} className="text-cleo" />
            </span>
            <span className="text-[11px] text-muted">Cleo</span>
          </div>

          <a
            href={`${base}/sistemas/tgov`}
            target="_blank"
            rel="noreferrer"
            className="group rounded-xl border border-line bg-abyss/40 p-5 transition-colors hover:border-cleo/40"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[18px] font-bold text-[#1351b4]">
                Transferegov<span className="text-[#168821]">.br</span>
              </span>
              <ArrowUpRight size={14} className="text-faint transition-colors group-hover:text-cleo" />
            </div>
            <div className="text-[13px] text-ink">Nosso TransfereGov</div>
            <p className="mt-1 text-[11.5px] text-muted">
              Localizar proposta, baixar extrato e contrapartidas para o SEI.
            </p>
          </a>
        </div>
        <p className="relative border-t border-line px-8 py-3 text-center text-[11.5px] text-muted">
          Abrem em <span className="num text-ink">{base}</span> — o mesmo endereço desta demonstração.
          Com a extensão instalada, o copiloto aparece sozinho e opera a página; sem ela, um painel
          de reserva demonstra o mesmo no modo local.
        </p>
      </Panel>

      <div className="grid grid-cols-[1.3fr_1fr] gap-4">
        {/* Instalação */}
        <Panel>
          <PanelHeader
            eyebrow="Instalar"
            titulo="Três passos, um minuto"
            acao={<Globe size={15} className="text-faint" />}
          />
          <ol className="flex flex-col gap-3.5 px-5 py-5">
            {[
              ['Baixe e descompacte', 'O arquivo cleo-extensao.zip abre numa pasta com o manifesto e os scripts.'],
              ['Abra chrome://extensions', 'No Chrome ou no Edge, ligue o "Modo do desenvolvedor" no canto superior direito.'],
              ['Carregar sem compactação', 'Aponte para a pasta descompactada. A Cleo aparece na barra de extensões.'],
              ['Abra um sistema por aqui', 'Volte a esta página e clique em "Nosso SEI" ou "Nosso TransfereGov" — eles abrem neste mesmo endereço. Não digite localhost à mão numa máquina remota.'],
            ].map(([titulo, texto], i) => (
              <li key={titulo} className="flex items-start gap-3.5">
                <span className="num mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-cleo/40 bg-cleo/10 text-[11px] text-cleo">
                  {i + 1}
                </span>
                <div>
                  <div className="text-[13px] text-ink">{titulo}</div>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">{texto}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="border-t border-line px-5 py-3.5">
            <a href="/cleo-extensao.zip" download>
              <Botao variante="primario">
                <Download size={13} /> Baixar cleo-extensao.zip
              </Botao>
            </a>
          </div>
        </Panel>

        {/* Por que é seguro */}
        <Panel>
          <PanelHeader
            eyebrow="Por que é seguro"
            titulo="A sessão é sua"
            acao={<ShieldCheck size={15} className="text-teal" />}
          />
          <ul className="flex flex-col gap-4 px-5 py-5">
            {[
              [KeyRound, 'Nenhuma senha sai do navegador', 'A extensão opera com a sessão que você já abriu — seu login, seu certificado, seu gov.br. A Cleo nunca vê nem guarda credencial.'],
              [MousePointerClick, 'Consentimento por ação', 'Cada rito é disparado por um clique seu. A extensão mostra o que vai fazer antes de fazer.'],
              [Workflow, 'Mesmo contrato de eventos', 'A página devolve o progresso de cada passo — o mesmo contrato que a Cleopatra já consome dos workers. Trocar a simulação por execução real é mudar a fonte, não a plataforma.'],
              [Puzzle, 'Só os sistemas de teste', 'Nesta demonstração, a extensão só age nos nossos SEI e TransfereGov. Um domínio real entraria no manifesto do mesmo jeito.'],
            ].map(([Icone, titulo, texto]) => {
              const I = Icone as typeof KeyRound
              return (
                <li key={titulo as string} className="flex items-start gap-3">
                  <I size={15} className="mt-0.5 shrink-0 text-teal" />
                  <div>
                    <div className="text-[12.5px] text-ink">{titulo as string}</div>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">{texto as string}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </Panel>
      </div>

      {/* Como funciona por dentro */}
      <Panel>
        <PanelHeader eyebrow="Por dentro" titulo="A arquitetura, sem mistério" />
        <div className="grid grid-cols-3 gap-6 px-5 py-6">
          {[
            ['1 · A extensão injeta', 'Ao abrir o SEI ou o TransfereGov, o content script reconhece a página e injeta o painel da Cleo sobre ela.'],
            ['2 · Você autoriza e dispara', 'O painel mostra os ritos disponíveis. Você clica; a extensão manda a ordem para a página pela ponte de mensagens.'],
            ['3 · A página executa e relata', 'A página opera na sua sessão — cursor, digitação, cliques — e devolve o progresso de cada passo, que o painel exibe ao vivo.'],
          ].map(([titulo, texto]) => (
            <div key={titulo}>
              <div className="mb-2 text-[13px] text-cleo">{titulo}</div>
              <p className="text-[12px] leading-relaxed text-muted">{texto}</p>
            </div>
          ))}
        </div>
        <div className="border-t border-line px-5 py-3.5 text-[11.5px] leading-relaxed text-faint">
          Em produção, o service worker da extensão manteria uma conexão viva com a Cleopatra,
          recebendo as intenções e devolvendo os eventos — o RPA de servidor continua para a carga
          noturna com usuário de serviço, e a regra de gatilho decide qual via usar. O híbrido é o
          desenho final.
        </div>
      </Panel>
    </div>
  )
}
