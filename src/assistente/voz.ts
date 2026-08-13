import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Voz da Cleo — ouvir e falar.
 *
 * Usa o que o navegador já tem: SpeechRecognition para ouvir e
 * speechSynthesis para falar. Nada sai da máquina no caso da síntese; o
 * reconhecimento, no Chrome, passa pelo serviço do navegador — e por isso a
 * interface sempre mostra quando o microfone está aberto. Microfone que escuta
 * sem avisar é o tipo de coisa que destrói a confiança de uma casa pública.
 */

/* ---------- Ouvir ---------- */

type Reconhecimento = {
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: any) => void) | null
  onerror: ((e: any) => void) | null
  onend: (() => void) | null
  continuous: boolean
  interimResults: boolean
  lang: string
}

function criarReconhecimento(): Reconhecimento | null {
  const w = window as any
  const Klass = w.SpeechRecognition || w.webkitSpeechRecognition
  if (!Klass) return null
  const r: Reconhecimento = new Klass()
  r.lang = 'pt-BR'
  r.continuous = false
  r.interimResults = true
  return r
}

export interface EstadoEscuta {
  suportado: boolean
  ouvindo: boolean
  /** O que já foi entendido, ainda provisório. */
  parcial: string
  erro: string | null
}

export function useEscuta(aoFinalizar: (texto: string) => void) {
  const [estado, setEstado] = useState<EstadoEscuta>({
    suportado: typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition),
    ouvindo: false,
    parcial: '',
    erro: null,
  })
  const ref = useRef<Reconhecimento | null>(null)
  const finalRef = useRef(aoFinalizar)
  finalRef.current = aoFinalizar

  const parar = useCallback(() => {
    ref.current?.stop()
    setEstado((e) => ({ ...e, ouvindo: false }))
  }, [])

  const ouvir = useCallback(() => {
    const r = criarReconhecimento()
    if (!r) {
      setEstado((e) => ({ ...e, suportado: false, erro: 'Este navegador não reconhece voz.' }))
      return
    }
    ref.current = r
    setEstado((e) => ({ ...e, ouvindo: true, parcial: '', erro: null }))

    r.onresult = (ev: any) => {
      let texto = ''
      let definitivo = false
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        texto += ev.results[i][0].transcript
        if (ev.results[i].isFinal) definitivo = true
      }
      setEstado((e) => ({ ...e, parcial: texto }))
      if (definitivo && texto.trim()) {
        setEstado((e) => ({ ...e, ouvindo: false, parcial: '' }))
        finalRef.current(texto.trim())
      }
    }
    r.onerror = (ev: any) => {
      const mapa: Record<string, string> = {
        'not-allowed': 'Permissão de microfone negada pelo navegador.',
        'no-speech': 'Não ouvi nada — tente de novo.',
        'audio-capture': 'Nenhum microfone encontrado.',
      }
      setEstado((e) => ({ ...e, ouvindo: false, erro: mapa[ev.error] ?? 'Falha ao ouvir.' }))
    }
    r.onend = () => setEstado((e) => ({ ...e, ouvindo: false }))

    try {
      r.start()
    } catch {
      /* start duplo lança; ignorar é o comportamento certo */
    }
  }, [])

  useEffect(() => () => ref.current?.abort(), [])

  return { ...estado, ouvir, parar }
}

/* ---------- Falar ---------- */

/** Escolhe a voz brasileira mais natural disponível no sistema. */
function melhorVoz(): SpeechSynthesisVoice | undefined {
  const vozes = window.speechSynthesis?.getVoices() ?? []
  const brasileiras = vozes.filter((v) => v.lang?.toLowerCase().startsWith('pt-br'))
  const preferidas = ['Francisca', 'Maria', 'Luciana', 'Camila', 'Google português', 'Microsoft Maria']
  for (const nome of preferidas) {
    const achou = brasileiras.find((v) => v.name.includes(nome))
    if (achou) return achou
  }
  return brasileiras[0] ?? vozes.find((v) => v.lang?.toLowerCase().startsWith('pt'))
}

export function useFala() {
  const [falando, setFalando] = useState(false)
  const [vozPronta, setVozPronta] = useState(false)

  useEffect(() => {
    if (!window.speechSynthesis) return
    const carregar = () => setVozPronta(true)
    carregar()
    window.speechSynthesis.addEventListener('voiceschanged', carregar)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', carregar)
  }, [])

  const falar = useCallback((texto: string) => {
    if (!window.speechSynthesis || !texto) return
    window.speechSynthesis.cancel()
    // Números e siglas soam melhor com pausas: a Cleo não é leitora de planilha
    const limpo = texto
      .replace(/R\$\s?/g, 'reais ')
      .replace(/(\d),(\d)/g, '$1 vírgula $2')
      .replace(/\bmi\b/g, 'milhões')
      .replace(/\bSEI\b/g, 'S E I')
    const u = new SpeechSynthesisUtterance(limpo)
    u.lang = 'pt-BR'
    u.rate = 1.04
    u.pitch = 1.02
    const v = melhorVoz()
    if (v) u.voice = v
    u.onstart = () => setFalando(true)
    u.onend = () => setFalando(false)
    u.onerror = () => setFalando(false)
    window.speechSynthesis.speak(u)
  }, [])

  const calar = useCallback(() => {
    window.speechSynthesis?.cancel()
    setFalando(false)
  }, [])

  return { falar, calar, falando, vozPronta }
}
