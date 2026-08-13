import { useCallback, useMemo } from 'react'
import { useApp } from '@/store/app'
import {
  avaliar,
  PERFIL_POR_ID,
  permissoesDe,
  type Permissao,
  type Usuario,
  type Veredito,
} from './permissoes'

/**
 * O ponto único por onde a interface pergunta "posso?".
 *
 * Toda tela consulta daqui — o mesmo veredito que bloqueia o botão é o que
 * explica por que ele está bloqueado e a quem o pedido sobe. Regra escondida
 * vira sistema arbitrário; regra visível vira confiança.
 */
export function usePermissao() {
  const { usuarios, usuarioAtualId, permissoesDoPerfil } = useApp()

  const eu = useMemo<Usuario>(
    () => usuarios.find((u) => u.id === usuarioAtualId) ?? usuarios[0],
    [usuarios, usuarioAtualId],
  )

  // Perfis com as permissões editadas na tela de configuração
  const meuConjunto = useMemo(() => {
    const custom = permissoesDoPerfil[eu?.perfil]
    if (!custom) return permissoesDe(eu)
    return new Set<Permissao>([...custom, ...(eu?.extras ?? [])])
  }, [eu, permissoesDoPerfil])

  const pode = useCallback((p: Permissao) => !!eu?.ativo && meuConjunto.has(p), [eu, meuConjunto])

  const checar = useCallback(
    (p: Permissao, valor?: number): Veredito => avaliar(eu, p, valor, usuarios),
    [eu, usuarios],
  )

  const alcada = PERFIL_POR_ID.get(eu?.perfil)?.alcada ?? 0
  const perfil = PERFIL_POR_ID.get(eu?.perfil)

  return { eu, perfil, alcada, pode, checar }
}
