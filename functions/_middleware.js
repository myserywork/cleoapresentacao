/**
 * Portão de entrada da apresentação.
 *
 * Roda na borda da Cloudflare, antes de qualquer arquivo ser servido. Sem o
 * cookie de sessão válido, toda rota devolve a tela de login — inclusive os
 * assets, o zip da extensão e as telas do SEI e do TransfereGov. Não existe
 * caminho que escape: uma apresentação com uma porta dos fundos não está
 * fechada.
 *
 * Como funciona:
 *   1. POST /entrar com usuário e senha → confere contra as variáveis de
 *      ambiente do projeto e, se bater, grava um cookie assinado com HMAC.
 *   2. Toda requisição seguinte → valida a assinatura do cookie e deixa passar.
 *   3. GET /sair → apaga o cookie.
 *
 * O que fica no cliente é só o cookie assinado. A senha vive nas variáveis do
 * Pages, e o segredo da assinatura também — nenhum dos dois é entregue ao
 * navegador em momento algum.
 *
 * Variáveis esperadas: ACESSO_USUARIO, ACESSO_SENHA, ACESSO_SEGREDO.
 */

const COOKIE = 'cleo_sessao'
const VALIDADE_S = 60 * 60 * 12 // meio dia: cobre a reunião mais longa

// O que a própria tela de login precisa carregar antes de haver sessão. Só a
// marca e o favicon — nada da aplicação. Sem esta lista a porta apareceria
// sem logotipo, e o portão que se apresenta sem identidade não convence.
const PUBLICOS = new Set(['/marca/mark.png', '/favicon.svg'])

export async function onRequest(context) {
  const { request, env, next } = context
  const url = new URL(request.url)

  // Configuração ausente é falha fechada, não aberta: melhor a tela dizer
  // "portão sem configuração" do que servir tudo sem querer.
  if (!env.ACESSO_USUARIO || !env.ACESSO_SENHA || !env.ACESSO_SEGREDO) {
    return html(paginaLogin({ erro: 'configuracao' }), 500)
  }

  if (PUBLICOS.has(url.pathname)) {
    return next()
  }

  if (url.pathname === '/sair') {
    return redirecionar('/', apagarCookie())
  }

  if (url.pathname === '/entrar') {
    if (request.method !== 'POST') return redirecionar('/')
    const form = await request.formData()
    const usuario = String(form.get('usuario') ?? '')
    const senha = String(form.get('senha') ?? '')
    const destino = sanitizarDestino(form.get('destino'))

    // Comparação em tempo constante: não vaza pelo relógio quantos caracteres
    // acertaram. Num portão de demonstração é zelo, não paranoia — custa nada.
    const ok =
      igualConstante(usuario, env.ACESSO_USUARIO) && igualConstante(senha, env.ACESSO_SENHA)
    if (!ok) {
      // Um respiro contra tentativa em rajada
      await new Promise((r) => setTimeout(r, 600))
      return html(paginaLogin({ erro: 'credenciais', destino, usuario }), 401)
    }

    const token = await assinar(env.ACESSO_SEGREDO, usuario)
    return redirecionar(destino, gravarCookie(token))
  }

  const sessao = lerCookie(request.headers.get('cookie'))
  if (sessao && (await validar(env.ACESSO_SEGREDO, sessao))) {
    const resposta = await next()
    // Só os assets com hash podem ficar em cache — e mesmo assim privado. O
    // resto passa sem cache: o portão só faz sentido se cada acesso passar
    // por ele.
    const cabecalhos = new Headers(resposta.headers)
    if (url.pathname.startsWith('/assets/')) {
      cabecalhos.set('cache-control', 'private, max-age=31536000, immutable')
    } else {
      cabecalhos.set('cache-control', 'private, no-store')
    }
    return new Response(resposta.body, { status: resposta.status, headers: cabecalhos })
  }

  // Sem sessão: a tela de login, guardando para onde a pessoa queria ir
  return html(paginaLogin({ destino: url.pathname + url.search }), 401)
}

/* ---------- Cookie assinado ---------- */

async function chave(segredo) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(segredo),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

async function assinar(segredo, usuario) {
  const expira = Math.floor(Date.now() / 1000) + VALIDADE_S
  const corpo = `${b64url(usuario)}.${expira}`
  const mac = await crypto.subtle.sign(
    'HMAC',
    await chave(segredo),
    new TextEncoder().encode(corpo),
  )
  return `${corpo}.${b64url(new Uint8Array(mac))}`
}

async function validar(segredo, token) {
  const partes = token.split('.')
  if (partes.length !== 3) return false
  const [usuario, expira, mac] = partes
  if (!/^\d+$/.test(expira) || Number(expira) < Math.floor(Date.now() / 1000)) return false
  const corpo = `${usuario}.${expira}`
  try {
    return await crypto.subtle.verify(
      'HMAC',
      await chave(segredo),
      deB64url(mac),
      new TextEncoder().encode(corpo),
    )
  } catch {
    return false
  }
}

function gravarCookie(token) {
  return `${COOKIE}=${token}; Path=/; Max-Age=${VALIDADE_S}; HttpOnly; Secure; SameSite=Lax`
}
function apagarCookie() {
  return `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`
}
function lerCookie(cabecalho) {
  if (!cabecalho) return null
  for (const parte of cabecalho.split(';')) {
    const [nome, ...resto] = parte.trim().split('=')
    if (nome === COOKIE) return resto.join('=')
  }
  return null
}

/* ---------- Utilidades ---------- */

function html(corpo, status) {
  return new Response(corpo, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function redirecionar(para, setCookie) {
  const headers = { location: para, 'cache-control': 'no-store' }
  if (setCookie) headers['set-cookie'] = setCookie
  return new Response(null, { status: 303, headers })
}

/**
 * Só aceita caminho interno: destino externo aqui seria um redirecionamento
 * aberto. Barra invertida entra na conta porque alguns navegadores leem
 * "/\\evil" como "//evil" — e aí o caminho "interno" saía do domínio.
 */
function sanitizarDestino(valor) {
  const s = String(valor ?? '/')
  if (!s.startsWith('/')) return '/'
  // Segundo caractere: barra ou barra invertida saem do domínio
  const segundo = s.charAt(1)
  if (segundo === '/' || segundo === '\\') return '/'
  return s
}

/** Compara sem encurtar pelo primeiro byte diferente — o tempo não denuncia nada. */
function igualConstante(a, b) {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  let diff = x.length ^ y.length
  const n = Math.max(x.length, y.length)
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

function b64url(entrada) {
  const bytes = typeof entrada === 'string' ? new TextEncoder().encode(entrada) : entrada
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function deB64url(s) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function escapar(t) {
  return String(t).replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })
}

/* ---------- A tela ---------- */

/**
 * A porta da apresentação, na identidade da Cleopatra: navy, dourado, a marca.
 * É a primeira coisa que o convidado vê — tem que parecer parte da plataforma,
 * não um formulário de servidor.
 */
function paginaLogin({ erro, destino = '/', usuario = '' } = {}) {
  const mensagem =
    erro === 'credenciais'
      ? 'Usuário ou senha não conferem.'
      : erro === 'configuracao'
        ? 'O portão está sem configuração de acesso. Defina ACESSO_USUARIO, ACESSO_SENHA e ACESSO_SEGREDO no projeto.'
        : ''
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Cleopatra · Acesso</title>
<link rel="icon" href="/favicon.svg">
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { margin: 0; min-height: 100%; }
  body {
    font-family: 'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif;
    color: #e7edf8;
    background:
      radial-gradient(1100px 600px at 78% -8%, #12203a 0%, transparent 62%),
      radial-gradient(800px 500px at 8% 105%, #0f1c30 0%, transparent 58%),
      #070a12;
    min-height: 100vh; display: grid; place-items: center; padding: 24px;
  }
  .caixa {
    width: 100%; max-width: 380px;
    background: linear-gradient(180deg, rgb(255 255 255 / 3.5%), rgb(255 255 255 / 1%));
    border: 1px solid #1d2a41; border-radius: 16px; padding: 28px 26px 24px;
    box-shadow: 0 22px 60px rgb(3 5 12 / 60%);
  }
  .marca { display: flex; align-items: center; gap: 12px; margin-bottom: 22px; }
  .marca img { width: 40px; height: 40px; border-radius: 10px; border: 1px solid rgb(223 181 82 / 40%); }
  .marca b { display: block; font-size: 15px; letter-spacing: .22em; }
  .marca span { display: block; font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: #8698b3; margin-top: 3px; }
  h1 { font-size: 18px; margin: 0 0 6px; font-weight: 600; letter-spacing: -0.01em; }
  p.sub { margin: 0 0 20px; font-size: 12.5px; color: #8698b3; line-height: 1.5; }
  label { display: block; font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: #8698b3; margin: 12px 0 6px; }
  input {
    width: 100%; height: 40px; border-radius: 10px; border: 1px solid #1d2a41;
    background: rgb(7 10 18 / 60%); color: #e7edf8; padding: 0 12px; font-size: 14px; outline: none;
  }
  input:focus { border-color: rgb(223 181 82 / 60%); }
  button {
    width: 100%; height: 42px; margin-top: 18px; border: none; border-radius: 10px;
    background: #dfb552; color: #151003; font-weight: 600; font-size: 13.5px; cursor: pointer;
  }
  button:hover { background: #eecb74; }
  .erro {
    margin: 12px 0 0; padding: 10px 12px; border-radius: 10px; font-size: 12.5px; line-height: 1.45;
    border: 1px solid rgb(226 86 77 / 45%); background: rgb(226 86 77 / 8%); color: #f0958f;
  }
  .rodape { margin-top: 18px; font-size: 10.5px; color: #5a6a7f; line-height: 1.5; }
</style>
</head>
<body>
  <form class="caixa" method="post" action="/entrar" autocomplete="on">
    <div class="marca">
      <img src="/marca/mark.png" alt="">
      <div><b>CLEOPATRA</b><span>Gestão de convênios</span></div>
    </div>
    <h1>Acesso à apresentação</h1>
    <p class="sub">Esta plataforma é uma demonstração privada. Entre com o acesso que você recebeu.</p>
    <input type="hidden" name="destino" value="${escapar(destino)}">
    <label for="usuario">Usuário</label>
    <input id="usuario" name="usuario" value="${escapar(usuario)}" autocomplete="username" autocapitalize="off" spellcheck="false" required autofocus>
    <label for="senha">Senha</label>
    <input id="senha" name="senha" type="password" autocomplete="current-password" required>
    ${mensagem ? `<div class="erro">${escapar(mensagem)}</div>` : ''}
    <button type="submit">Entrar</button>
    <div class="rodape">Nada aqui se conecta ao SEI ou ao TransfereGov reais. Toda execução é reconstruída para demonstração.</div>
  </form>
</body>
</html>`
}
