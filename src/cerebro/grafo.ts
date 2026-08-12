import {
  MINUTAS,
  emendaDaProposta,
  getParlamentar,
  getProponente,
  propostasDoOrgao,
} from '@/data/repo'
import { moedaCompacta } from '@/lib/format'

/**
 * Grafo de conhecimento do órgão.
 *
 * Os vínculos são os do próprio banco — proposta ↔ proponente, proposta ↔
 * processo, processo ↔ documento, documento ↔ minuta. Nada aqui é inventado
 * para o desenho ficar bonito: o desenho é o que os dados já são.
 */

export type TipoNo =
  | 'programa'
  | 'proponente'
  | 'proposta'
  | 'processo'
  | 'documento'
  | 'minuta'
  | 'emenda'
  | 'parlamentar'
  | 'uf'

export interface No {
  id: string
  tipo: TipoNo
  rotulo: string
  detalhe: string
  /** Rota para abrir o registro correspondente, quando existir. */
  href?: string
  raio: number
  grau: number
  x: number
  y: number
  vx: number
  vy: number
  /** Ordem de "aprendizado" — usada na sequência de acendimento. */
  ordem: number
  /** Quando este registro passou a existir; move a linha do tempo do Cérebro. */
  tempo: string
}

export interface Aresta {
  origem: number
  destino: number
}

export interface Grafo {
  nos: No[]
  arestas: Aresta[]
  porTipo: Record<TipoNo, number>
}

export const CORES_TIPO: Record<TipoNo, string> = {
  programa: '#7d8ca6',
  proponente: '#b8892e',
  proposta: '#2aa891',
  processo: '#8b6cf0',
  documento: '#b49bf7',
  minuta: '#7d8ca6',
  emenda: '#d9a441',
  parlamentar: '#e0c274',
  uf: '#4fb8a4',
}

export const ROTULO_TIPO: Record<TipoNo, string> = {
  programa: 'Programa',
  proponente: 'Proponente',
  proposta: 'Proposta',
  processo: 'Processo SEI',
  documento: 'Documento',
  minuta: 'Minuta',
  emenda: 'Emenda',
  parlamentar: 'Parlamentar',
  uf: 'Unidade da federação',
}

const RAIO: Record<TipoNo, number> = {
  programa: 8,
  proponente: 4.5,
  proposta: 4,
  processo: 3.4,
  documento: 2.4,
  minuta: 7,
  emenda: 3.8,
  parlamentar: 6.5,
  uf: 7,
}

const MAX_DOCS_POR_PROCESSO = 3

export function montarGrafo(orgaoId: string): Grafo {
  const nos: No[] = []
  const arestas: Aresta[] = []
  const indice = new Map<string, number>()
  let ordem = 0

  function addNo(
    id: string,
    tipo: TipoNo,
    rotulo: string,
    detalhe: string,
    tempo: string,
    href?: string,
  ): number {
    const existente = indice.get(id)
    if (existente !== undefined) {
      // Hub compartilhado: vale a data em que apareceu pela primeira vez.
      if (tempo < nos[existente].tempo) nos[existente].tempo = tempo
      return existente
    }
    const i = nos.length
    indice.set(id, i)
    nos.push({
      id,
      tipo,
      rotulo,
      detalhe,
      href,
      raio: RAIO[tipo],
      grau: 0,
      // Disco de Fermat: espalhamento inicial uniforme, sem começar degenerado
      x: Math.cos(i * 2.39996) * Math.sqrt(i) * 26,
      y: Math.sin(i * 2.39996) * Math.sqrt(i) * 26,
      vx: 0,
      vy: 0,
      ordem: ordem++,
      tempo,
    })
    return i
  }

  function ligar(a: number, b: number) {
    arestas.push({ origem: a, destino: b })
    nos[a].grau++
    nos[b].grau++
  }

  const propostas = propostasDoOrgao(orgaoId)

  for (const p of propostas) {
    const iPrograma = addNo(
      `prog:${p.programa}`,
      'programa',
      p.programa,
      'Programa do órgão',
      p.dataCadastro,
    )

    const prop = getProponente(p.proponenteId)
    const iProponente = prop
      ? addNo(
          `prop:${prop.id}`,
          'proponente',
          prop.nome,
          `${prop.municipio} · ${prop.uf} · ${prop.esfera}`,
          p.dataCadastro,
        )
      : undefined

    const iProposta = addNo(
      `pr:${p.id}`,
      'proposta',
      p.numero,
      p.objeto,
      p.dataCadastro,
      `/propostas/${p.id}`,
    )

    ligar(iProposta, iPrograma)
    if (iProponente !== undefined) ligar(iProposta, iProponente)

    // Território: o proponente pendura na UF, e a UF vira o agrupador natural
    // da história geográfica.
    if (prop && iProponente !== undefined) {
      const iUf = addNo(`uf:${prop.uf}`, 'uf', prop.uf, 'Unidade da federação', p.dataCadastro)
      ligar(iProponente, iUf)
    }

    // Origem do recurso: proposta → emenda → parlamentar. É o caminho que liga
    // o gabinete à obra do município.
    const emenda = emendaDaProposta(p.id)
    if (emenda) {
      const iEmenda = addNo(
        `em:${emenda.id}`,
        'emenda',
        emenda.numero,
        `${emenda.tipo} · ${emenda.ano} · ${moedaCompacta(emenda.valorIndicado)}`,
        p.dataCadastro,
        '/emendas',
      )
      ligar(iProposta, iEmenda)

      const parlamentar = emenda.parlamentarId ? getParlamentar(emenda.parlamentarId) : undefined
      if (parlamentar) {
        const iParlamentar = addNo(
          `pl:${parlamentar.id}`,
          'parlamentar',
          parlamentar.nome,
          `${parlamentar.partido}/${parlamentar.uf} · ${parlamentar.casa}`,
          p.dataCadastro,
          `/parlamentares/${parlamentar.id}`,
        )
        ligar(iEmenda, iParlamentar)
      }
    }

    if (p.numProcessoSei) {
      const iProcesso = addNo(
        `sei:${p.numProcessoSei}`,
        'processo',
        p.numProcessoSei,
        'Processo autuado no SEI',
        p.documentos[0]?.data ?? p.dataCadastro,
        `/propostas/${p.id}`,
      )
      ligar(iProposta, iProcesso)

      for (const d of p.documentos.slice(0, MAX_DOCS_POR_PROCESSO)) {
        const iDoc = addNo(
          `doc:${p.id}:${d.id}`,
          'documento',
          `${d.tipo} ${d.numero}`,
          d.geradoPelaCleo ? 'Gerado pela Cleo a partir de minuta' : 'Anexado ao processo',
          d.data,
          `/propostas/${p.id}`,
        )
        ligar(iProcesso, iDoc)

        if (d.minutaId) {
          const minuta = MINUTAS.find((m) => m.id === d.minutaId)
          if (minuta) {
            const iMinuta = addNo(
              `min:${minuta.id}`,
              'minuta',
              minuta.nome,
              `${minuta.tipo} · ${minuta.campos.length} campos`,
              d.data,
            )
            ligar(iDoc, iMinuta)
          }
        }
      }
    }
  }

  const porTipo = nos.reduce(
    (acc, n) => {
      acc[n.tipo]++
      return acc
    },
    {
      programa: 0,
      proponente: 0,
      proposta: 0,
      processo: 0,
      documento: 0,
      minuta: 0,
      emenda: 0,
      parlamentar: 0,
      uf: 0,
    } as Record<TipoNo, number>,
  )

  return { nos, arestas, porTipo }
}

/** Vizinhos diretos de um nó — usado no realce e no painel lateral. */
export function vizinhos(grafo: Grafo, indice: number): Set<number> {
  const conjunto = new Set<number>()
  for (const a of grafo.arestas) {
    if (a.origem === indice) conjunto.add(a.destino)
    else if (a.destino === indice) conjunto.add(a.origem)
  }
  return conjunto
}
