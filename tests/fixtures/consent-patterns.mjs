// Minimal original fixtures derived from observed interface behaviour, not copied CMP code.
export const patterns = [
  'best-desktop', 'best-mobile', 'best-missing-cookie', 'best-accept-cookie', 'best-stays-visible', 'best-replacement-dialog',
  'frandroid-accept-only', 'telerama-accept-only', 'drifted-reject', 'conflicting-label',
  'neutral-notice', 'opaque-replacement', 'opaque-action', 'opacity-label', 'associated-label', 'generated-label', 'shadow-only', 'drifted-manage', 'drifted-save',
];

export function consentPatternPage(kind) {
  if (!patterns.includes(kind)) throw new Error('Unknown consent fixture');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Quiet Exit consent-pattern fixture</title><style>
@font-face{font-family:'Space Grotesk';src:url('/fonts/space-grotesk.ttf')}
@font-face{font-family:'IBM Plex Mono';src:url('/fonts/ibm-plex-mono.ttf')}
body{background:#050605;color:#f2efe6;font:16px/1.7 system-ui,sans-serif;padding:24px;max-width:900px;margin:auto}
h1{font-family:'Space Grotesk',Arial,sans-serif;text-transform:uppercase;text-align:left}
button,section,pre{background:#0b0d0b;color:#f2efe6;border:1px solid rgba(242,239,230,.35);padding:12px;margin:6px 0}
button{font:inherit;margin-right:8px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.6 'IBM Plex Mono',monospace}
:focus-visible{outline:2px solid #5fb53c;outline-offset:3px}
</style><h1>Consent-pattern fixture</h1><p>Demo / ${kind}. Synthetic consent state, no external services. Best Lawyers cases require its exact hostname in the isolated browser harness.</p>
<div id="mount"></div><pre id="pattern-evidence"></pre><script>
const kind=${JSON.stringify(kind)};
window.patternState={accept:0,reject:0,other:0,optionalConsent:false};
const mount=document.getElementById('mount');
function report(){document.getElementById('pattern-evidence').textContent=JSON.stringify({...patternState,choice:document.cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith('bl_cookie_policy_V4='))||null},null,2)}
function accept(){patternState.accept++;patternState.optionalConsent=true;report()}
function other(){patternState.other++;report()}
if(kind.startsWith('best-')){
 mount.innerHTML='<section class="cookie-notice" data-cookie-name="bl_cookie_policy_V4"><h2>Cookie preferences</h2><button id="acceptAllCookies">Accept All Cookies</button><button id="onlyEssentialCookies">Only Use Essential Cookies</button><button id="onlyEssentialCookiesMobile">Only Use Essential Cookies</button></section>';
 const banner=mount.firstElementChild;
 document.getElementById(kind==='best-mobile'?'onlyEssentialCookies':'onlyEssentialCookiesMobile').hidden=true;
 document.getElementById('acceptAllCookies').onclick=()=>{accept();document.cookie='bl_cookie_policy_V4=1; path=/';banner.remove();report()};
 for(const button of banner.querySelectorAll('[id^="onlyEssentialCookies"]'))button.onclick=()=>{
  patternState.reject++;
  if(kind!=='best-missing-cookie')document.cookie='bl_cookie_policy_V4='+(kind==='best-accept-cookie'?'1':'0')+'; path=/';
  if(kind==='best-accept-cookie')patternState.optionalConsent=true;
  if(kind!=='best-stays-visible')banner.remove();
  if(kind==='best-replacement-dialog')mount.innerHTML='<section role="dialog"><h2>Cookie preferences</h2><label>Advertising<input type="checkbox" checked></label></section>';
  report();
 };
}else if(kind==='frandroid-accept-only'){
 mount.innerHTML='<section id="didomi-notice"><h2>Bienvenue chez Frandroid</h2><button id="didomi-notice-agree-button">J’accepte les cookies</button><button id="subscribe">Je rejoins Frandroid+</button></section>';
 document.getElementById('didomi-notice-agree-button').onclick=accept;document.getElementById('subscribe').onclick=other;
}else if(kind==='telerama-accept-only'){
 mount.innerHTML='<section role="dialog" aria-label="Cookie consent"><h2>Cookie consent</h2><button data-gdpr-expression="acceptAll">Accepter et continuer</button><button id="subscribe">Refuser et s’abonner</button></section>';
 mount.querySelector('[data-gdpr-expression]').onclick=accept;document.getElementById('subscribe').onclick=other;
}else if(kind==='shadow-only'){
 mount.innerHTML='<div id="cmpwrapper"></div>';
 const shadow=mount.firstElementChild.attachShadow({mode:'open'});
 shadow.innerHTML='<button class="cmpboxbtnyes">AKZEPTIEREN</button>';shadow.querySelector('button').onclick=accept;
}else if(kind==='opaque-action'){
 mount.innerHTML='<section id="onetrust-banner-sdk"><h2>Cookie consent</h2><div role="button" id="onetrust-reject-all-handler">Reject all</div></section>';
 const action=document.getElementById('onetrust-reject-all-handler');action.attachShadow({mode:'closed'}).innerHTML='<button>Accept all</button>';action.onclick=accept;
}else if(kind==='opacity-label'){
 mount.innerHTML='<section id="onetrust-banner-sdk"><h2>Cookie consent</h2><button id="onetrust-reject-all-handler">Reject all<span style="opacity:0"> Accept all</span></button></section>';mount.querySelector('button').onclick=accept;
}else if(kind==='associated-label'){
 mount.innerHTML='<section id="onetrust-banner-sdk"><h2>Cookie consent</h2><button id="onetrust-reject-all-handler">Reject all</button><label for="onetrust-reject-all-handler">Accept all</label></section>';mount.querySelector('button').onclick=accept;
}else if(kind==='generated-label'){
 mount.innerHTML='<section id="onetrust-banner-sdk"><h2>Cookie consent</h2><button id="onetrust-reject-all-handler">Reject all</button></section><style>#onetrust-reject-all-handler::after{content:" Accept all"}</style>';mount.querySelector('button').onclick=accept;
}else if(kind==='neutral-notice'){
 mount.innerHTML='<div class="klaro"><section class="cookie-notice"><p>Cookie notice</p><button class="cm-btn-decline">OK</button></section></div>';mount.querySelector('button').onclick=accept;
}else if(kind==='drifted-save'){
 mount.innerHTML='<section id="CybotCookiebotDialog">'+['Necessary','Preferences','Statistics','Marketing'].map(x=>'<label>'+x+'<input type="checkbox" checked '+(x==='Necessary'?'disabled ':'')+'id="CybotCookiebotDialogBodyLevelButton'+x+'"></label>').join('')+'<button id="CybotCookiebotDialogBodyLevelButtonLevelOptinAllowallSelection">Accepter et continuer</button></section>';
 mount.querySelector('button').onclick=accept;mount.querySelectorAll('input').forEach(x=>x.onclick=other);
}else{
 const manage=kind==='drifted-manage';
 const text=kind==='drifted-reject'||manage?'Accepter et continuer':kind==='conflicting-label'?'Accept all':'Reject all';
 mount.innerHTML='<section id="onetrust-banner-sdk"><h2>Cookie consent</h2><button id="'+(manage?'onetrust-pc-btn-handler':'onetrust-reject-all-handler')+'" '+(kind==='conflicting-label'?'aria-label="Reject all"':'')+'>'+text+'</button></section>';
 const banner=mount.firstElementChild;
 banner.querySelector('button').onclick=()=>{
  if(kind==='opaque-replacement'){
   patternState.reject++;const host=document.createElement('cookie-settings');banner.replaceChildren(host);
   host.attachShadow({mode:'open'}).innerHTML='<label>Advertising<input type="checkbox" checked></label>';
  }else accept();report();
 };
}
report();
</script></html>`;
}
