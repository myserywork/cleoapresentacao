import { MINUTAS, getProponente, propostasDoOrgao } from '@/data/repo'

/**
 * Grafo de conhecimento do órgão.
 *
 * Os vínculos são os do próprio banco — proposta ↔ proponente, proposta ↔
 * processo, processo ↔ documento, documento ↔ minuta. Nada aqui é inventado
 * para o desenho ficar bonito: o desenho é o que os dados já são.
 */

export type TipoNo = 'programa' | 'proponente' | 'proposta' | 'processo' | 'documento' | 'minuta'

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
}

export const ROTULO_TIPO: Record<TipoNo, string> = {
  programa: 'Programa',
  proponente: 'Proponente',
  proposta: 'Proposta',
  processo: 'Processo SEI',
  documento: 'Documento',
  minuta: 'Minuta',
}

const RAIO: Record<TipoNo, number> = {
  programa: 8,
  proponente: 4.5,
  proposta: 4,
  processo: 3.4,
  documento: 2.4,
  minuta: 7,
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
