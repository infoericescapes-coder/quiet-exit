import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

// Serves synthetic consent interfaces only. The installed extension supplies
// its own content scripts, storage and popup; this page never injects the engine.
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--lan' && !/^--port=\d+$/.test(arg))) {
  console.error('Usage: node scripts/manual-fixtures.mjs [--lan] [--port=8765]');
  process.exit(1);
}
const port = Number(args.find(arg => arg.startsWith('--port='))?.slice(7) ?? 8765);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port');
const host = args.includes('--lan') ? '0.0.0.0' : '127.0.0.1';
const page = String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Quiet Exit manual fixtures</title><style>
@font-face{font-family:Space Grotesk;src:url('/fonts/space-grotesk.ttf')}
@font-face{font-family:IBM Plex Mono;src:url('/fonts/ibm-plex-mono.ttf')}
:root{--ee-canvas:#050605;--ee-panel:#0b0d0b;--ee-text:#f2efe6;--ee-muted:#8b8f86;--ee-accent:#5fb53c;--ee-hairline-strong:rgba(242,239,230,.13);--ee-hairline-rest:rgba(242,239,230,.35)}
*{box-sizing:border-box}body{background:var(--ee-canvas);color:var(--ee-text);font:16px/1.7 system-ui,sans-serif;margin:0;padding:24px}main{max-width:760px;margin:auto}
h1,h2{font-family:'Space Grotesk',Arial,sans-serif;text-transform:uppercase;line-height:1.2;text-align:left}h1{font-size:clamp(24px,6vw,38px)}
.meta,footer{font:12px/1.7 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.08em;color:var(--ee-muted)}
section,pre{padding:18px;border:1px solid var(--ee-hairline-strong);background:var(--ee-panel)}
button,select{font:inherit;color:var(--ee-text);background:var(--ee-panel);border:1px solid var(--ee-hairline-rest);padding:10px;max-width:100%;margin:4px 4px 4px 0;border-radius:0}
a{color:var(--ee-accent)}:focus-visible{outline:2px solid var(--ee-accent);outline-offset:3px}label{display:block}input{margin-right:12px;accent-color:var(--ee-muted)}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.6 'IBM Plex Mono',monospace}footer{border-top:1px solid var(--ee-hairline-strong);padding-top:16px}
</style></head><body><main>
<p class="meta">Demo / Eric Escapes / Test fixture</p><h1>Quiet Exit manual fixtures</h1>
<p>Use the installed Safari extension. This page records consent-control clicks and saved checkbox states. The popup count is separate. Reload for a clean run.</p>
<label for="scenario">Scenario</label><select id="scenario">
<option value="direct">Direct rejection</option><option value="late">Late banner (5 seconds)</option>
<option value="preferences">Complete Cookiebot preferences</option><option value="unknown">Unknown optional control</option>
<option value="indeterminate">Unreadable optional state</option><option value="disabled">Disabled optional-on</option>
<option value="hidden">Hidden optional control</option><option value="missing">Missing optional category</option>
<option value="vendors">Hidden vendor section</option><option value="interest">Legitimate interest</option>
<option value="collapsed">Collapsed categories</option><option value="failed">Reject leaves banner open</option>
<option value="replacement">Reject opens preferences</option></select>
<button id="show">Insert fixture</button><button id="queue">Insert selected in 5 seconds</button>
<p><a href="/away">Navigate away, then use Safari Back</a></p>
<button id="unrelated">Reject</button><p>This unrelated control must remain untouched.</p>
<div id="mount"></div><h2>Page evidence</h2><pre id="evidence" aria-live="polite"></pre>
<footer>Manual testing / Synthetic interfaces / No production consent</footer></main>
<script>
const evidence={accept:0,reject:0,save:0,optionalClicks:0,unrelated:0,savedStates:[],pageshowPersisted:false};
const mount=document.getElementById('mount');let timer;
function report(){document.getElementById('evidence').textContent=JSON.stringify(evidence,null,2)}
window.addEventListener('pageshow',event=>{evidence.pageshowPersisted=event.persisted;report()});
document.getElementById('unrelated').onclick=()=>{evidence.unrelated++;report()};
function insert(kind){
 mount.replaceChildren();
 if(['direct','late','failed','replacement'].includes(kind)){
  mount.innerHTML='<section id="onetrust-banner-sdk" role="dialog" aria-label="Cookie consent"><h2>We use cookies</h2><button id="onetrust-accept-btn-handler">Accept all</button><button id="onetrust-reject-all-handler">Reject all</button></section>';
  const banner=mount.firstElementChild;
  banner.querySelector('#onetrust-accept-btn-handler').onclick=()=>{evidence.accept++;report()};
  banner.querySelector('#onetrust-reject-all-handler').onclick=()=>{
   evidence.reject++;
   if(kind==='replacement')mount.innerHTML='<section id="onetrust-pc-sdk">Cookie privacy preferences are still open</section>';
   else if(kind!=='failed')banner.remove();
   report();
  };
 }else{
  const categories=['Necessary','Preferences','Statistics','Marketing'];
  mount.innerHTML='<section id="CybotCookiebotDialog" role="dialog" aria-label="Cookie preferences"><h2>Cookie preferences</h2>'+categories.map(name=>'<label>'+name+'<input type="checkbox" checked '+(name==='Necessary'?'disabled ':'')+'id="CybotCookiebotDialogBodyLevelButton'+name+'"></label>').join('')+'<button id="CybotCookiebotDialogBodyLevelButtonLevelOptinAllowallSelection">Allow selection</button><button id="accept">Accept all</button></section>';
  const panel=mount.firstElementChild;
  const marketing=panel.querySelector('#CybotCookiebotDialogBodyLevelButtonMarketing');
  if(kind==='unknown')panel.insertAdjacentHTML('beforeend','<label>Unknown purpose<input type="checkbox" checked></label>');
  if(kind==='indeterminate')marketing.indeterminate=true;
  if(kind==='disabled')marketing.disabled=true;
  if(kind==='hidden')marketing.parentElement.hidden=true;
  if(kind==='missing')marketing.parentElement.remove();
  if(kind==='vendors')panel.insertAdjacentHTML('beforeend','<section id="vendor-options" hidden>Vendors</section>');
  if(kind==='interest')panel.insertAdjacentHTML('beforeend','<p>Legitimate interest purposes</p>');
  if(kind==='collapsed')panel.insertAdjacentHTML('beforeend','<button aria-expanded="false">More categories</button>');
  panel.querySelectorAll('input').forEach(input=>input.addEventListener('click',()=>{evidence.optionalClicks++;report()}));
  panel.querySelector('#accept').onclick=()=>{evidence.accept++;report()};
  panel.querySelector('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowallSelection').onclick=()=>{
   evidence.save++;evidence.savedStates.push(Object.fromEntries([...panel.querySelectorAll('input')].map(input=>[input.id||'unknown',input.checked])));panel.remove();report();
  };
 }
 report();
}
function queue(kind){clearTimeout(timer);timer=setTimeout(()=>insert(kind),5000)}
document.getElementById('show').onclick=()=>{clearTimeout(timer);const kind=document.getElementById('scenario').value;if(kind==='late')queue(kind);else insert(kind)};
document.getElementById('queue').onclick=()=>queue(document.getElementById('scenario').value);
report();
</script></body></html>`;
const away = page.replace(/<script>[\s\S]*?<\/script>/, '').replace(/<main>[\s\S]*?<\/main>/,
  '<main><p class="meta">Demo / Eric Escapes</p><h1>History test</h1><p>Use Safari Back to restore the fixture page. Check pageshowPersisted before recording a bfcache result.</p></main>');
const fonts = new Map(['space-grotesk.ttf', 'ibm-plex-mono.ttf'].map(name =>
  [`/fonts/${name}`, new URL(`../extension/assets/fonts/${name}`, import.meta.url)]));
const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
  const pathname = new URL(request.url, 'http://localhost').pathname;
  let content;
  if (pathname === '/' || pathname === '/away') {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    content = pathname === '/' ? page : away;
  } else if (fonts.has(pathname)) {
    try { content = await readFile(fonts.get(pathname)); }
    catch { response.writeHead(404).end(); return; }
    response.setHeader('Content-Type', 'font/ttf');
  } else { response.writeHead(404).end(); return; }
  response.end(request.method === 'HEAD' ? undefined : content);
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, host, () => {
  console.log(`Manual fixtures: http://127.0.0.1:${server.address().port}/`);
  if (host === '0.0.0.0') console.log(`LAN enabled: open http://<MacminiM4-LAN-IP>:${server.address().port}/ on the same Wi-Fi. Only fixtures and two fonts are served.`);
});
