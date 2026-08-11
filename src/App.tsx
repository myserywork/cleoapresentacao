import { Route, Routes } from 'react-router-dom'
import { Shell } from '@/components/Shell'
import { ModalAutomacao } from '@/components/simulacao/ModalAutomacao'
import { PaletaComando } from '@/components/PaletaComando'
import { RastroCopiloto } from '@/components/RastroCopiloto'
import { ModoApresentacao } from '@/components/ModoApresentacao'
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

export function App() {
  return (
    <>
      <Shell>
        <Routes>
          <Route path="/" element={<Painel />} />
          <Route path="/propostas" element={<Propostas />} />
          <Route path="/propostas/:id" element={<PropostaDetalhe />} />
          <Route path="/aprovacoes" element={<Aprovacoes />} />
          <Route path="/cerebro" element={<Cerebro />} />
          <Route path="/assistente" element={<Assistente />} />
          <Route path="/paineis" element={<MeusPaineis />} />
          <Route path="/ganho" element={<Ganho />} />
          <Route path="/meu-dia" element={<MeuDia />} />
          <Route path="/minutas" element={<Minutas />} />
        </Routes>
      </Shell>

      {/* Camadas que atravessam a aplicação inteira */}
      <ModalAutomacao />
      <PaletaComando />
      <RastroCopiloto />
      <ModoApresentacao />
    </>
  )
}
