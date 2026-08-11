import type { Comando } from './tipos'

/**
 * Comandos fixos da paleta. Propostas e automações entram dinamicamente,
 * a partir do que está sendo digitado.
 */
export const CATALOGO: Comando[] = [
  {
    id: 'ir-painel',
    rotulo: 'Ir para o Painel',
    categoria: 'Ir para',
    sinonimos: ['dashboard', 'inicio', 'home', 'visao geral'],
    acoes: [{ tipo: 'navegar', para: '/' }],
  },
  {
    id: 'ir-propostas',
    rotulo: 'Ir para Propostas',
    categoria: 'Ir para',
    sinonimos: ['carteira', 'convenios', 'lista'],
    acoes: [{ tipo: 'navegar', para: '/propostas' }],
  },
  {
    id: 'ir-aprovacoes',
    rotulo: 'Ir para Aprovações',
    categoria: 'Ir para',
    sinonimos: ['fila', 'decisao', 'aprovar', 'gestor'],
    acoes: [{ tipo: 'navegar', para: '/aprovacoes' }],
  },
  {
    id: 'ir-cerebro',
    rotulo: 'Abrir o Cérebro',
    categoria: 'Ir para',
    sinonimos: ['grafo', 'conhecimento', 'mapa mental', 'rede'],
    acoes: [{ tipo: 'navegar', para: '/cerebro' }],
  },
  {
    id: 'ir-assistente',
    rotulo: 'Falar com a Cleo',
    categoria: 'Ir para',
    sinonimos: ['assistente', 'chat', 'perguntar', 'ia'],
    acoes: [{ tipo: 'navegar', para: '/assistente' }],
  },
  {
    id: 'ir-paineis',
    rotulo: 'Meus painéis',
    categoria: 'Ir para',
    sinonimos: ['montar painel', 'widgets', 'blocos'],
    acoes: [{ tipo: 'navegar', para: '/paineis' }],
  },
  {
    id: 'ir-ganho',
    rotulo: 'Ver o antes e depois',
    categoria: 'Apresentação',
    sinonimos: ['ganho', 'economia', 'comparativo', 'tempo'],
    acoes: [{ tipo: 'navegar', para: '/ganho' }],
  },
  {
    id: 'filtro-paradas',
    rotulo: 'Propostas paradas há mais de 30 dias',
    categoria: 'Propostas',
    sinonimos: ['travadas', 'sem andamento', 'atrasadas'],
    acoes: [
      { tipo: 'filtrar-propostas', filtro: { paradaHaDias: 30, ordenarPor: 'parada' } },
    ],
  },
  {
    id: 'filtro-analise',
    rotulo: 'Propostas em análise',
    categoria: 'Propostas',
    sinonimos: ['analise'],
    acoes: [{ tipo: 'filtrar-propostas', filtro: { situacao: ['Em análise'] } }],
  },
  {
    id: 'filtro-maiores',
    rotulo: 'Maiores propostas por valor',
    categoria: 'Propostas',
    sinonimos: ['top', 'ranking', 'valor'],
    acoes: [{ tipo: 'filtrar-propostas', filtro: { ordenarPor: 'valor' } }],
  },
]
