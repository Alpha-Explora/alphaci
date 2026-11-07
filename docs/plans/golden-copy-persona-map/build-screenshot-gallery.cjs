'use strict';

const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const authenticated = process.argv.includes('--authenticated');
const root = path.resolve(__dirname, 'screenshots', ...(authenticated ? ['authenticated'] : []));
const packs = ['saas', 'edu', 'enterprise'];
const packNames = { saas: 'SaaS', edu: 'EDU', enterprise: 'Enterprise' };
const galleryTitle = authenticated ? 'AlphaCI · authenticated pack screen captures' : 'AlphaCI pack screen captures';
const captureContext = authenticated
  ? 'Each capture uses a local authenticated API session with seeded, synthetic project data. Workflow-catalog entries are a temporary screenshot fixture. No customer records or external provider calls are used; the annotation is added by the capture script and is not part of AlphaCI. Internal is an organization identity/billing control, not a fourth pack.'
  : 'These are browser captures from this worktree’s current build. There is no live API session or seeded account here, so protected screens show the signed-out, access-required, or session-loading state. The annotation is added by the capture script and is not part of AlphaCI. Internal is an organization identity/billing control, not a fourth pack.';
const records = packs.flatMap((pack) => {
  const manifestPath = path.join(root, pack, 'manifest.json');
  const items = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (items.length !== 28) throw new Error(`${pack} manifest has ${items.length} routes; expected 28.`);
  return items.map((item) => ({ ...item, packName: packNames[pack] }));
});

function xml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
}

async function buildContactSheet(pack) {
  const items = records.filter((item) => item.pack === pack);
  const columns = 4;
  const cellWidth = 480;
  const cellHeight = 320;
  const imageHeight = 268;
  const rows = Math.ceil(items.length / columns);
  const layers = [];
  for (const [index, item] of items.entries()) {
    const left = (index % columns) * cellWidth;
    const top = Math.floor(index / columns) * cellHeight;
    const source = path.join(root, pack, item.screenshot);
    const thumbnail = await sharp(source)
      .resize(cellWidth, imageHeight, { fit: 'cover', position: 'top' })
      .png()
      .toBuffer();
    const state = item.captureState.replaceAll('-', ' ');
    const membership = item.shared ? 'Shared' : `${packNames[pack]} only`;
    const label = `<svg width="${cellWidth}" height="${cellHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#eef1f5"/><text x="12" y="21" fill="#18202b" font-family="Arial, sans-serif" font-size="13" font-weight="700">${xml(item.title.slice(0, 54))}</text><text x="12" y="37" fill="#4f5d70" font-family="Arial, sans-serif" font-size="10">${xml(item.route.slice(0, 70))} · ${xml(membership)} · ${xml(state)}</text></svg>`;
    layers.push({ input: Buffer.from(label), left, top });
    layers.push({ input: thumbnail, left: left, top: top + 42 });
  }
  await sharp({ create: { width: cellWidth * columns, height: cellHeight * rows, channels: 4, background: '#eef1f5' } })
    .composite(layers)
    .png()
    .toFile(path.join(root, pack, 'contact-sheet.png'));
}

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${galleryTitle}</title>
<style>
:root{color-scheme:light dark;font:15px/1.5 system-ui,sans-serif;background:#101721;color:#e9edf4}*{box-sizing:border-box}body{max-width:1280px;margin:0 auto;padding:28px 20px 56px}header{margin-bottom:24px}h1{font-size:clamp(25px,4vw,38px);letter-spacing:-.03em;margin:0 0 8px}p{color:#aeb9ca;margin:7px 0}.note{border:1px solid #465264;background:#1a2533;padding:14px 16px;border-radius:10px;margin:16px 0 22px}.sheets{display:flex;flex-wrap:wrap;gap:10px;margin:10px 0 22px}.sheets a{color:#d8e8ff;background:#202d3d;border:1px solid #43536a;padding:8px 11px;border-radius:8px;text-decoration:none}.filters{display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px;margin:18px 0 8px}input,select{font:inherit;color:inherit;background:#151e2a;border:1px solid #49576b;border-radius:8px;padding:10px 12px}.count{color:#aeb9ca;margin-bottom:12px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,350px),1fr));gap:14px}.card{min-width:0;overflow:hidden;border:1px solid #354255;border-radius:11px;background:#182230}.card img{display:block;width:100%;height:300px;object-fit:contain;background:#0d141d}.meta{padding:12px 14px}.meta h2{font-size:16px;margin:0 0 3px}.route,.owner{font:12px/1.5 ui-monospace,monospace;color:#aeb9ca;overflow-wrap:anywhere}.desc{font-size:13px;color:#d4dbe6;margin:8px 0}.persona{font-size:12px;color:#d4dbe6;margin:7px 0}.persona p{margin:4px 0}.pill{display:inline-block;background:#263950;color:#dce9fa;border-radius:999px;padding:3px 8px;font-size:11px;margin:3px 4px 0 0}.state-restricted{background:#553b31}.state-waiting-for-session{background:#48412e}.state-redirected{background:#393653}.state-rendered{background:#27433c}.screen-link{display:block;color:inherit;text-decoration:none}.screen-link:hover{outline:2px solid #81b6ff;outline-offset:-2px}@media(max-width:680px){body{padding:18px 12px 36px}.filters{grid-template-columns:1fr}.card img{height:250px}}
</style>
</head>
<body>
<header>
<h1>${galleryTitle}</h1>
<p>28 mapped routes per pack. Each screenshot identifies the feature owner, screen contents, shared or pack-specific membership, capture state, and the mapped actions for Product owner, QA, Developer, and Admin.</p>
<div class="note"><strong>Capture context:</strong> ${captureContext}</div>
<div class="sheets"><a href="./saas/contact-sheet.png">SaaS contact sheet</a><a href="./edu/contact-sheet.png">EDU contact sheet</a><a href="./enterprise/contact-sheet.png">Enterprise contact sheet</a></div>
<div class="filters"><input id="query" type="search" placeholder="Search routes, features, screen contents…"><select id="pack"><option value="all">All packs</option><option value="saas">SaaS</option><option value="edu">EDU</option><option value="enterprise">Enterprise</option></select><select id="state"><option value="all">All capture states</option><option value="rendered">Rendered</option><option value="restricted">Sign-in or role required</option><option value="waiting-for-session">Waiting for API/session</option><option value="redirected">Redirected</option></select></div>
<div class="count" id="count"></div>
</header>
<main class="grid" id="screens"></main>
<script>
const screens = __RECORDS__;
const packNames = {saas:'SaaS',edu:'EDU',enterprise:'Enterprise'};
const packSelect = document.getElementById('pack');
const stateSelect = document.getElementById('state');
const query = document.getElementById('query');
const grid = document.getElementById('screens');
const count = document.getElementById('count');
function appendText(parent, tag, text, className) { const node=document.createElement(tag); node.textContent=text; if(className) node.className=className; parent.appendChild(node); return node; }
function render() {
 const term=query.value.trim().toLowerCase();
 const filtered=screens.filter((item)=> (packSelect.value==='all'||item.pack===packSelect.value) && (stateSelect.value==='all'||item.captureState===stateSelect.value) && (!term||[item.title,item.route,item.featureOwners.join(' '),item.featureDescriptions,item.includes,Object.values(item.personaActions||{}).join(' ')].join(' ').toLowerCase().includes(term)));
 grid.replaceChildren(); count.textContent=filtered.length+' of '+screens.length+' route captures shown';
 for(const item of filtered){
  const card=document.createElement('article'); card.className='card';
  const link=document.createElement('a'); link.className='screen-link'; link.href='./'+item.pack+'/'+item.screenshot; link.target='_blank'; link.rel='noreferrer'; link.title='Open full screenshot';
  const image=document.createElement('img'); image.loading='lazy'; image.src='./'+item.pack+'/'+item.screenshot; image.alt=packNames[item.pack]+' screenshot: '+item.title+' at '+item.route; link.appendChild(image); card.appendChild(link);
  const meta=document.createElement('div'); meta.className='meta';
  appendText(meta,'h2',packNames[item.pack]+' · '+item.title);
  appendText(meta,'div',item.route+(item.finalRoute!==item.route?' → '+item.finalRoute:''),'route');
  appendText(meta,'div','Feature owner: '+item.featureDescriptions,'owner');
  appendText(meta,'p','Includes: '+item.includes,'desc');
  if(item.authenticated){
   appendText(meta,'p','Authenticated API session: '+item.sessionLogin+' · app '+item.appRole+' · platform '+item.platformRole,'desc');
   appendText(meta,'p','Fixture data: '+item.dataset,'desc');
   if(item.apiErrors?.length) appendText(meta,'p','API errors: '+item.apiErrors.map((error)=>error.status+' '+error.route).join('; '),'persona');
  }
  const shared=document.createElement('span'); shared.className='pill'; shared.textContent=item.shared?'Shared · '+item.sharedPacks.map((pack)=>packNames[pack]).join(', '):packNames[item.pack]+' only'; meta.appendChild(shared);
 const persona=document.createElement('details'); persona.className='persona'; const summary=appendText(persona,'summary','Persona actions');
 const roleLabels={lead:'Product owner',qa:'QA',member:'Developer',admin:'Admin'};
 for(const [role,action] of Object.entries(item.personaActions||{})) appendText(persona,'p',(roleLabels[role]||role)+': '+action);
 meta.appendChild(persona);
 const state=document.createElement('span'); state.className='pill state-'+item.captureState; state.textContent=item.captureState.replaceAll('-',' '); meta.appendChild(state);
  card.appendChild(meta); grid.appendChild(card);
 }
}
for(const control of [packSelect,stateSelect,query]) control.addEventListener('input',render);
render();
</script>
</body>
</html>`;

const overview = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AlphaCI · ${authenticated ? 'authenticated ' : ''}all pack contact sheets</title>
<style>
:root{font:15px/1.45 system-ui,sans-serif}*{box-sizing:border-box}body{margin:0;color:var(--foreground,#17202b)}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}figure{margin:0;min-width:0;padding:12px;border-radius:var(--radius,12px);background:var(--card,#eff2f6)}figcaption{font-weight:700;margin:0 0 8px}a{color:inherit}img{display:block;width:100%;height:auto;border-radius:6px}.more{margin:0 0 14px;color:var(--muted-foreground,#526071)}@media(max-width:560px){main{grid-template-columns:1fr}}
</style>
</head>
<body>
<p class="more">All three pack contact sheets, each showing the 28 captured routes${authenticated ? ' captured through authenticated API sessions with synthetic data' : ''}. <a href="./index.html">Open the searchable gallery for full screenshots and persona actions.</a></p>
<main>
<figure><figcaption>SaaS · 28 routes</figcaption><a href="./saas/contact-sheet.png"><img src="./saas/contact-sheet.png" alt="SaaS pack contact sheet of 28 annotated route screenshots"></a></figure>
<figure><figcaption>EDU · 28 routes</figcaption><a href="./edu/contact-sheet.png"><img src="./edu/contact-sheet.png" alt="EDU pack contact sheet of 28 annotated route screenshots"></a></figure>
<figure><figcaption>Enterprise · 28 routes</figcaption><a href="./enterprise/contact-sheet.png"><img src="./enterprise/contact-sheet.png" alt="Enterprise pack contact sheet of 28 annotated route screenshots"></a></figure>
</main>
</body>
</html>`;

async function main() {
  for (const pack of packs) await buildContactSheet(pack);
  fs.writeFileSync(path.join(root, 'index.html'), html.replace('__RECORDS__', JSON.stringify(records).replaceAll('<', '\\u003c')));
  fs.writeFileSync(path.join(root, 'overview.html'), overview);
  console.log(`Generated ${authenticated ? 'authenticated ' : ''}gallery for ${records.length} captures and 3 contact sheets at ${root}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
