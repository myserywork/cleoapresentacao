import { Route, Routes, useLocation } from 'react-router-dom'
import { Shell } from '@/components/Shell'
import { ModalAutomacao } from '@/components/simulacao/ModalAutomacao'
import { ModalLote } from '@/components/simulacao/ModalLote'
import { PaletaComando } from '@/components/PaletaComando'
import { RastroCopiloto } from '@/components/RastroCopiloto'
import { ModoApresentacao } from '@/components/ModoApresentacao'
import { Tour } from '@/components/Tour'
import { PalcoWidget } from '@/components/PalcoWidget'
import { Painel } from '@/pages/Painel'
import { Propostas } from '@/pages/Propostas'
import { PropostaDetalhe } from '@/pages/PropostaDetalhe'
import { Aprovacoes } from '@/pages/Aprovacoes'
import { Cerebro } from '@/pages/Cerebro'
import { Assistente } from '@/pages/Assistente'
import { MeusPaineis } from '@/pages/MeusPaineis'
import { Ganho } from '@/pages/Ganho'
import { MeuDia } from '@/pages/MeuDia'
import { Minutas } from '@/pages/Minutas'
import { Emendas } from '@/pages/Emendas'
import { ParlamentarFicha } from '@/pages/Parlamentar'
import { Orcamento } from '@/pages/Orcamento'
import { Vigencias } from '@/pages/Vigencias'
import { PrestacaoContas } from '@/pages/PrestacaoContas'
import { Equipe } from '@/pages/Equipe'
import { Diligencias } from '@/pages/Diligencias'
import { Ritos } from '@/pages/Ritos'
import { Auditoria } from '@/pages/Auditoria'
import { Padroes } from '@/pages/Padroes'
import { ProponenteFicha } from '@/pages/Proponente'
import { SalaSituacao } from '@/pages/SalaSituacao'
import { Documentos } from '@/pages/Documentos'
import { Cleo } from '@/pages/Cleo'
import { Relatorio } from '@/pages/Relatorio'
import { Comparar } from '@/pages/Comparar'
import { Extensao } from '@/pages/Extensao'
import { Cofre } from '@/pages/Cofre'
import { Usuarios } from '@/pages/Usuarios'
import { SeiPage } from '@/sistemas/SeiPage'
import { TgovPage } from '@/sistemas/TgovPage'

export function App() {
  const { pathname } = useLocation()

  // As páginas de sistema são "outros sites": renderizam sem o shell da
  // Cleopatra, para a extensão do Chrome injetar seu painel sobre elas — como
  // faria no SEI e no TransfereGov de verdade.
  if (pathname.startsWith('/sistemas/')) {
    return (
      <Routes>
        <Route path="/sistemas/sei" element={<SeiPage />} />
        <Route path="/sistemas/tgov" element={<TgovPage />} />
      </Routes>
    )
  }

  return (
    <>
      <Shell>
        <Routes>
          <Route path="/" element={<Painel />} />
          <Route path="/meu-dia" element={<MeuDia />} />
          <Route path="/propostas" element={<Propostas />} />
          <Route path="/propostas/:id" element={<PropostaDetalhe />} />
          <Route path="/proponentes/:id" element={<ProponenteFicha />} />
          <Route path="/aprovacoes" element={<Aprovacoes />} />

          <Route path="/emendas" element={<Emendas />} />
          <Route path="/parlamentares/:id" element={<ParlamentarFicha />} />
          <Route path="/orcamento" element={<Orcamento />} />

          <Route path="/vigencias" element={<Vigencias />} />
          <Route path="/contas" element={<PrestacaoContas />} />
          <Route path="/diligencias" element={<Diligencias />} />

          <Route path="/equipe" element={<Equipe />} />
          <Route path="/ritos" element={<Ritos />} />
          <Route path="/minutas" element={<Minutas />} />
          <Route path="/documentos" element={<Documentos />} />
          <Route path="/extensao" element={<Extensao />} />
          <Route path="/cofre" element={<Cofre />} />
          <Route path="/usuarios" element={<Usuarios />} />
          <Route path="/auditoria" element={<Auditoria />} />

          <Route path="/cleo" element={<Cleo />} />
          <Route path="/cerebro" element={<Cerebro />} />
          <Route path="/assistente" element={<Assistente />} />
          <Route path="/padroes" element={<Padroes />} />

          <Route path="/situacao" element={<SalaSituacao />} />
          <Route path="/relatorio" element={<Relatorio />} />
          <Route path="/comparar" element={<Comparar />} />
          <Route path="/paineis" element={<MeusPaineis />} />
          <Route path="/ganho" element={<Ganho />} />
        </Routes>
      </Shell>

      {/* Camadas que atravessam a aplicação inteira */}
      <ModalAutomacao />
      <ModalLote />
      <PalcoWidget />
      <PaletaComando />
      <RastroCopiloto />
      <ModoApresentacao />
      <Tour />
    </>
  )
}
