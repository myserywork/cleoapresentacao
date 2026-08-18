/**
 * As marcas dos sistemas oficiais.
 *
 * Ficam num módulo só porque aparecem em três lugares — a página do sistema, o
 * modal de execução e o painel da extensão — e marca redesenhada em cada lugar
 * é a primeira coisa que denuncia reconstrução. Desenhadas em SVG, e não como
 * imagem, para não depender de arquivo externo e ficarem nítidas no projetor.
 *
 * São reproduções para demonstração de um sistema de apresentação: aproximam a
 * forma para que o servidor reconheça a tela, sem se passar por ativo oficial.
 */

/**
 * SEI — o wordmark "sei!".
 *
 * Minúsculas em itálico pesado, bem apertadas, com a exclamação separada por um
 * respiro. O ponto da exclamação é quadrado, não redondo: é o detalhe que
 * diferencia o logo de um texto qualquer em itálico.
 */
export function MarcaSei({ altura = 30, cor = '#ffffff' }: { altura?: number; cor?: string }) {
  return (
    <svg
      height={altura}
      viewBox="0 0 56 40"
      fill="none"
      role="img"
      aria-label="SEI"
      style={{ display: 'block' }}
    >
      <text
        x="0"
        y="31"
        fill={cor}
        style={{
          fontFamily: "'Times New Roman', Georgia, serif",
          fontSize: '38px',
          fontWeight: 700,
          fontStyle: 'italic',
          letterSpacing: '-2.5px',
        }}
      >
        sei
      </text>
      {/* A exclamação, desenhada: haste inclinada e ponto quadrado */}
      <path d="M45 7 L52 7 L49 24 L43.5 24 Z" fill={cor} />
      <rect x="41.5" y="27" width="6" height="5.5" transform="skewX(-11)" fill={cor} />
    </svg>
  )
}

/**
 * TransfereGov — o símbolo de transferência e a assinatura em duas linhas.
 *
 * O símbolo são quatro setas apontando para fora a partir de um centro: é o
 * desenho de "transferir". O azul é o institucional do gov.br (#1351b4).
 */
export function MarcaTransfereGov({ altura = 44 }: { altura?: number }) {
  return (
    <div className="flex items-center gap-2" role="img" aria-label="Transferegov.br">
      <svg height={altura} viewBox="0 0 44 44" fill="none" style={{ display: 'block' }}>
        {/* Seta para cima */}
        <path d="M22 2 L30 12 L25 12 L25 19 L19 19 L19 12 L14 12 Z" fill="#1351b4" />
        {/* Seta para a direita */}
        <path d="M42 22 L32 30 L32 25 L25 25 L25 19 L32 19 L32 14 Z" fill="#2670cf" />
        {/* Seta para baixo */}
        <path d="M22 42 L14 32 L19 32 L19 25 L25 25 L25 32 L30 32 Z" fill="#1351b4" />
        {/* Seta para a esquerda */}
        <path d="M2 22 L12 14 L12 19 L19 19 L19 25 L12 25 L12 30 Z" fill="#2670cf" />
      </svg>
      <span className="leading-[1.05]">
        <span className="block text-[17px] font-bold text-[#1351b4]">Transfere</span>
        <span className="block text-[15px] font-semibold text-[#1351b4]">
          gov<span className="text-[#168821]">.br</span>
        </span>
      </span>
    </div>
  )
}
