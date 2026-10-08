// Reproduzierbare AP01-UI-Prüfung. Browserfokus und Layout prüft der Supervisor separat.
// Aufruf: node arbeitspaket-01/test-ui.cjs [Pfad/zur/index.html]
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const eingabe = path.resolve(process.argv[2] || path.join(__dirname, 'index.html'));
const html = fs.readFileSync(eingabe, 'utf8');
const ergebnisse = [];

// Funktionskörper dynamisch lesen; Strings, Kommentare und Template-Ausdrücke überspringen.
function endeString(text, start, zeichen) {
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === '\\') { i++; continue; }
    if (text[i] === zeichen) return i;
    if (zeichen === '`' && text[i] === '$' && text[i + 1] === '{') i = endeBlock(text, i + 1);
  }
  throw new Error('Nicht abgeschlossener String');
}
function endeBlock(text, start) {
  let tiefe = 0;
  for (let i = start; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (c === '"' || c === "'" || c === '`') { i = endeString(text, i, c); continue; }
    if (c === '/' && next === '/') { const e = text.indexOf('\n', i + 2); i = e < 0 ? text.length : e; continue; }
    if (c === '/' && next === '*') { const e = text.indexOf('*/', i + 2); assert(e >= 0); i = e + 1; continue; }
    if (c === '{') tiefe++;
    if (c === '}' && --tiefe === 0) return i;
  }
  throw new Error('Nicht abgeschlossener Funktionskörper');
}
function funktion(name) {
  const muster = new RegExp('(?:^|\\n)function ' + name + '\\s*\\(', 'm');
  const treffer = muster.exec(html);
  assert(treffer, `Funktion ${name} fehlt`);
  const start = treffer.index + (treffer[0][0] === '\n' ? 1 : 0);
  const klammer = html.indexOf('{', start);
  return html.slice(start, endeBlock(html, klammer) + 1);
}
function pruefe(name, test) {
  try { test(); ergebnisse.push({ name, bestanden: true }); }
  catch (fehler) { ergebnisse.push({ name, bestanden: false, fehler: fehler.message }); }
}

let ctx;
pruefe('UI-Funktionen dynamisch extrahierbar', () => {
  ctx = {
    Map, Set,
    alleItems: () => Array.from({ length: 400 }, (_, i) => 'item' + i),
    itemInfo: id => ({ name: 'Item ' + id, farbe: '#fff' }),
    htmlSicher: value => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'),
    istVerteiler: t => t.typ === 'smartVerteiler',
    bandQuellItems: (_t, seite) => seite === 'vorn' ? ['item3'] : ['item1', 'item2'],
    seiteEinstellung: () => ({ gesperrt: false, filter: { item399: false } }),
    SEITEN_NAMEN: { links: 'links', rechts: 'rechts', hinten: 'hinten', vorn: 'vorn' },
    seiteVonFahrt: () => 'links',
    bandInventar: () => ({ bestand: { item1: 2 }, anzahl: 2, kapazitaet: 25 }),
  };
  vm.createContext(ctx);
  const namen = ['bandFilterZustand', 'bandFilterTreffer', 'bandFilterOptionen', 'bandFilterChip', 'seitenHtml', 'bandInventarHtml', 'bandInfoZahlenHtml'];
  vm.runInContext('const bandFilterUi = new Map();\n' + namen.map(funktion).join('\n'), ctx);
});
const merger = { id: 'b1', typ: 'smartZusammen', vorgaenger: [] };
pruefe('400 Katalogitems ergeben ohne Suche nur Quellangebot und gespeicherte Ausnahmen', () => {
  const out = ctx.seitenHtml(merger);
  assert.equal((out.match(/data-band-aktion="seiteFilter"/g) || []).length, 9);
  assert.equal((out.match(/<option /g) || []).length, 9);
  assert(!out.includes('data-item="item250"'));
});
pruefe('Gespeicherte Filter bleiben ohne aktuelle Quelle sichtbar', () => {
  const out = ctx.seitenHtml(merger);
  assert(out.includes('data-item="item399"'));
  assert(out.includes('data-zustand="nein"'));
});
pruefe('Suchdropdown begrenzt 400 Treffer auf 25', () => {
  const zustand = ctx.bandFilterZustand(merger, 'links');
  zustand.suche = 'Item';
  assert.equal(ctx.bandFilterTreffer(merger, 'links').length, 25);
  assert.equal((ctx.bandFilterOptionen(merger, 'links').match(/<option /g) || []).length, 25);
  assert.equal(zustand.suche, 'Item');
});
pruefe('Omni-Merger hat vier getrennte Eingangsseiten', () => {
  const out = ctx.seitenHtml({ ...merger, id: 'omni', typ: 'omniMerger' });
  for (const seite of ['links', 'hinten', 'rechts', 'vorn']) assert(out.includes(`id="band-seite-${seite}"`));
  assert.equal((out.match(/id="band-seite-/g) || []).length, 4);
  const vorn = out.slice(out.indexOf('id="band-seite-vorn"'));
  assert(vorn.includes('data-item="item3"'));
  assert(!vorn.includes('data-item="item1"'));
});
pruefe('Verteiler-Ausgänge benutzen dieselbe vorgeschaltete Quelle', () => {
  const vorher = ctx.bandQuellItems, seiten = [];
  ctx.bandQuellItems = (_t, seite) => { seiten.push(seite); return ['item1']; };
  try { ctx.seitenHtml({ id: 'split', typ: 'smartVerteiler', ausgaenge: [] }); assert(seiten.length > 0); assert(seiten.every(s => s === null)); }
  finally { ctx.bandQuellItems = vorher; }
});
pruefe('Inventar zeigt echte Stückzahl, Kapazität und getrennte Löschaktionen', () => {
  const out = ctx.bandInventarHtml(merger);
  assert(out.includes('2 / 25'));
  assert(out.includes('data-band-aktion="inventarEins"'));
  assert(out.includes('aria-label="Eine Einheit Item item1 löschen"'));
  assert(out.includes('✕ 1'));
  assert(out.includes('data-band-aktion="inventarAlle"'));
  assert(out.includes('Alle 2 löschen …'));
});
pruefe('Leeres Inventar zeigt keine Löschknöpfe', () => {
  const vorher = ctx.bandInventar;
  ctx.bandInventar = () => ({ bestand: {}, anzahl: 0, kapazitaet: 25 });
  try { const out = ctx.bandInventarHtml(merger); assert(out.includes('0 / 25')); assert(out.includes('Leer')); assert(!out.includes('data-band-aktion=')); }
  finally { ctx.bandInventar = vorher; }
});
pruefe('Detailzählung zählt Reserve mit statt nur drei sichtbaren Einheiten', () => {
  Object.assign(ctx, { bandAuswahl: { gruppe: false }, istGreifarm: () => false, bandTyp: () => ({ tagesKosten: 0 }), euro: String, BAENDER: { stauWarnung: 3 } });
  const vorher = ctx.bandInventar;
  ctx.bandInventar = () => ({ bestand: { item1: 15 }, anzahl: 15, kapazitaet: 25 });
  try { const out = ctx.bandInfoZahlenHtml({ ...merger, typ: 'band', items: [1, 2, 3], stau: 0 }); assert(out.includes('<dt>Items darin</dt><dd>15</dd>')); }
  finally { ctx.bandInventar = vorher; }
});
pruefe('Segmentzählung summiert Inventar einschließlich Reserve', () => {
  const vorher = ctx.bandInventar;
  ctx.bandInventar = t => ({ bestand: {}, anzahl: t.id === 'a' ? 7 : 4, kapazitaet: 25 });
  Object.assign(ctx, { segmentVon: () => ({ teile: [{ id: 'a' }, { id: 'b' }] }), segmentInfo: () => ({ items: 3, laenge: 2, kostenTag: 0 }), segmentDurchsatz: () => Infinity, istErforscht: () => false });
  ctx.bandAuswahl.gruppe = true;
  try { const out = ctx.bandInfoZahlenHtml(merger); assert(out.includes('<dt>Items im Segment</dt><dd>11</dd>')); }
  finally { ctx.bandInventar = vorher; ctx.bandAuswahl.gruppe = false; }
});
pruefe('Modalmodell sperrt Hintergrund und priorisiert Bestätigungsdialog', () => {
  // Dieses Modell prüft inert und Stapelpriorität. Es simuliert keine Browser-Tabfolge.
  const element = (name, hidden = false) => ({ name, hidden, inert: false, matches: () => name === 'script' });
  const hud = element('hud'), lager = element('lager'), dialog = element('dialog', true), script = element('script');
  const doc = { body: { children: [hud, lager, dialog, script] }, getElementById: () => dialog, querySelectorAll: () => [lager, dialog] };
  const fokus = vm.createContext({ document: doc });
  vm.runInContext(funktion('oberstesModal') + '\n' + funktion('synchronisiereModalFokus'), fokus);
  fokus.synchronisiereModalFokus();
  assert.equal(fokus.oberstesModal(), lager); assert(hud.inert); assert(!lager.inert); assert(!script.inert);
  dialog.hidden = false; fokus.synchronisiereModalFokus();
  assert.equal(fokus.oberstesModal(), dialog); assert(lager.inert); assert(!dialog.inert);
  dialog.hidden = true; lager.hidden = true; fokus.synchronisiereModalFokus();
  assert.equal(fokus.oberstesModal(), null); assert(!hud.inert); assert(!lager.inert);
});

const bericht = { eingabe, bestanden: ergebnisse.every(e => e.bestanden), anzahl: ergebnisse.length,
  grenzen: ['Browser-Tabfolge, Tastaturaktivierung, Zeigergesten und sichtbares Layout prüft der Supervisor im Browser.'], ergebnisse };
const ausgabe = path.join(__dirname, 'pruefung-ui.json');
fs.writeFileSync(ausgabe, JSON.stringify(bericht, null, 2) + '\n');
console.log(JSON.stringify(bericht, null, 2));
if (!bericht.bestanden) process.exitCode = 1;
