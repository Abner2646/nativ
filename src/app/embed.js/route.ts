import { NextRequest, NextResponse } from 'next/server'
import { getAppDomain } from '@/lib/domain'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tenant = searchParams.get('tenant')
  const color  = searchParams.get('color')  || '#000000'
  const text   = searchParams.get('text')   || 'Reserve a table'

  if (!tenant) {
    return new NextResponse('// Nativ embed: missing ?tenant= parameter\n', {
      status: 400,
      headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
    })
  }

  // Derive the /reserve URL.
  // embed.js is always served from the main app domain, so we use the request host
  // to auto-detect dev/preview vs production without relying on NODE_ENV.
  const host      = req.headers.get('host') || ''
  const isLocal   = host.includes('localhost') || host.includes('127.0.0.1')
  const proto     = isLocal ? 'http' : 'https'
  const appDomain = getAppDomain()
  const isMain    = appDomain ? (host === appDomain || host === `www.${appDomain}`) : false

  const reserveUrl = isMain
    ? `https://${tenant}.${appDomain}/reserve`
    : `${proto}://${host}/reserve?tenant=${tenant}`

  const js = buildEmbedScript({ tenant, reserveUrl, color, text })

  return new NextResponse(js, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')
}

function buildEmbedScript({ tenant, reserveUrl, color, text }: {
  tenant: string
  reserveUrl: string
  color: string
  text: string
}): string {
  return `
/* Nativ reservation widget — tenant: ${tenant} */
(function () {
  if (document.getElementById('nativ-widget-overlay')) return; // idempotent

  var COLOR  = '${esc(color)}';
  var TEXT   = '${esc(text)}';
  var IFRAME = '${esc(reserveUrl)}';

  /* ── Styles ─────────────────────────────────────────────────── */
  var style = document.createElement('style');
  style.textContent = [
    '#nativ-widget-btn{',
      'position:fixed;bottom:24px;right:24px;z-index:2147483646;',
      'background:' + COLOR + ';color:#fff;border:none;',
      'padding:14px 26px;border-radius:50px;',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
      'font-size:15px;font-weight:600;letter-spacing:-.01em;cursor:pointer;',
      'box-shadow:0 4px 20px rgba(0,0,0,.28);',
      'transition:transform .15s ease,box-shadow .15s ease;',
    '}',
    '#nativ-widget-btn:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(0,0,0,.35);}',
    '#nativ-widget-overlay{',
      'display:none;position:fixed;inset:0;z-index:2147483647;',
      'background:rgba(0,0,0,.55);',
      'align-items:center;justify-content:center;padding:16px;',
      'animation:nativFadeIn .2s ease;',
    '}',
    '#nativ-widget-overlay.nativ-open{display:flex;}',
    '@keyframes nativFadeIn{from{opacity:0}to{opacity:1}}',
    '#nativ-widget-modal{',
      'position:relative;width:100%;max-width:460px;',
      'height:min(90vh,720px);',
      'background:#000;border-radius:16px;overflow:hidden;',
      'box-shadow:0 32px 80px rgba(0,0,0,.6);',
      'animation:nativSlideUp .25s cubic-bezier(.16,1,.3,1);',
    '}',
    '@keyframes nativSlideUp{from{transform:translateY(24px);opacity:0}to{transform:translateY(0);opacity:1}}',
    '#nativ-widget-iframe{width:100%;height:100%;border:none;display:block;}',
    '#nativ-widget-close{',
      'position:absolute;top:12px;right:12px;z-index:10;',
      'background:rgba(255,255,255,.15);backdrop-filter:blur(4px);',
      'color:#fff;border:none;width:32px;height:32px;border-radius:50%;',
      'font-size:20px;line-height:1;cursor:pointer;',
      'display:flex;align-items:center;justify-content:center;',
      'transition:background .15s;',
    '}',
    '#nativ-widget-close:hover{background:rgba(255,255,255,.28);}',
    '@media(max-width:520px){',
      '#nativ-widget-modal{height:100svh;max-height:100svh;border-radius:0;animation:nativFadeIn .2s ease;}',
      '#nativ-widget-overlay{padding:0;}',
    '}',
  ].join('');
  document.head.appendChild(style);

  /* ── Button ──────────────────────────────────────────────────── */
  var btn = document.createElement('button');
  btn.id = 'nativ-widget-btn';
  btn.setAttribute('aria-label', TEXT);
  btn.textContent = TEXT;
  document.body.appendChild(btn);

  /* ── Overlay + modal ─────────────────────────────────────────── */
  var overlay = document.createElement('div');
  overlay.id = 'nativ-widget-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Reservation');

  var modal = document.createElement('div');
  modal.id = 'nativ-widget-modal';

  var closeBtn = document.createElement('button');
  closeBtn.id = 'nativ-widget-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = '&times;';

  var iframe = document.createElement('iframe');
  iframe.id = 'nativ-widget-iframe';
  iframe.title = 'Make a reservation';
  iframe.setAttribute('loading', 'lazy');
  // src set on open so the page doesn't load until the user clicks
  iframe.setAttribute('data-src', IFRAME);

  modal.appendChild(closeBtn);
  modal.appendChild(iframe);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  /* ── Logic ───────────────────────────────────────────────────── */
  function open() {
    // Lazy-load the iframe on first open
    if (!iframe.src) iframe.src = iframe.getAttribute('data-src') || '';
    overlay.classList.add('nativ-open');
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  }

  function close() {
    overlay.classList.remove('nativ-open');
    document.body.style.overflow = '';
    btn.focus();
  }

  btn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('nativ-open')) close();
  });

  /* ── Expose global API (optional) ───────────────────────────── */
  window.Nativ = { open: open, close: close };
})();
`.trimStart()
}
