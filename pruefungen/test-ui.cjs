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
  const namen = ['bandFilterZustand', 'bandFilterTreffer', 'bandFilterOptionen', 'bandFilterChip', 'seitenHtml', 'bandInventarMengenZustand', 'pruefeBandInventarMenge', 'bandInventarFokusMerken', 'bandInventarFokusWiederherstellen', 'bandInventarHtml', 'loescheBandInventarBetrag', 'bandInfoZahlenHtml'];
  vm.runInContext('const bandFilterUi = new Map(); const bandInventarUi = new Map();\n' + namen.map(funktion).join('\n'), ctx);
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
  assert(out.includes('>X</button>'));
  assert(out.includes('data-band-aktion="inventarAlle"'));
  assert(out.includes('Alle 2 Einheiten Item item1 löschen'));
  for (const kopf of ['Produkt', 'Menge', '1x Löschen', 'Betrag löschen', 'Alle Löschen']) assert(out.includes(`<th scope="col">${kopf}</th>`));
  assert(out.includes('data-band-aktion="inventarBetrag"'));
  assert(out.includes('>[ENTER]</button>'));
  assert(out.includes('inputmode="numeric"'));
});
pruefe('Löschbetrag akzeptiert ausschließlich positive ganze Zahlen bis zum Livebestand', () => {
  assert.equal(ctx.pruefeBandInventarMenge('1', 2).menge, 1);
  assert.equal(ctx.pruefeBandInventarMenge('2', 2).menge, 2);
  for (const wert of ['', '0', '-1', '1.5', '1,5', '1e1', 'NaN', 'Infinity', '3', '9007199254740993']) assert.equal(ctx.pruefeBandInventarMenge(wert, 2).ok, false, wert);
  assert.equal(ctx.pruefeBandInventarMenge('1', 0).ok, false);
});
pruefe('Ungültiger Betrag löst keine API-Mutation aus; gültiger Betrag löscht exakt die Eingabe', () => {
  const aufrufe = []; ctx.loescheBandInventar = (id, item, menge) => { aufrufe.push({ id, item, menge }); return { ok: true, menge }; }; ctx.zeigeMeldung = () => {};
  const ui = ctx.bandInventarMengenZustand(merger, 'item1');
  ui.wert = '3'; assert.equal(ctx.loescheBandInventarBetrag(merger, 'item1'), false); assert.equal(aufrufe.length, 0); assert(ui.fehler.includes('2'));
  ui.wert = '2'; assert.equal(ctx.loescheBandInventarBetrag(merger, 'item1'), true); assert.equal(aufrufe.length, 1); assert.equal(aufrufe[0].menge, 2); assert.equal(ui.fehler, '');
});
pruefe('Mengen bleiben pro Bauteil und Item getrennt über Rendern und Auswahl erhalten', () => {
  const ui = ctx.bandInventarMengenZustand(merger, 'item1'); ui.wert = '2';
  assert(ctx.bandInventarHtml(merger).includes('value="2"'));
  const anderes = { ...merger, id: 'anderes' }; assert.equal(ctx.bandInventarMengenZustand(anderes, 'item1').wert, '');
  ctx.bandInventarHtml(anderes); assert.equal(ctx.bandInventarMengenZustand(merger, 'item1').wert, '2');
});
pruefe('Fokusmodell erhält Mengenfeld und Textauswahl bei ersetzter Bestandszeile', () => {
  const alt = { dataset: { item: 'item1', bandInventarId: 'b1' }, value: '12', selectionStart: 1, selectionEnd: 2, selectionDirection: 'forward', matches: () => true };
  const doc = { activeElement: alt }, auswahl = [];
  const neu = { dataset: alt.dataset, focus: () => { doc.activeElement = neu; }, setSelectionRange: (...args) => { auswahl.push(args); } };
  ctx.document = doc; ctx.ob = { infoInhalt: { querySelectorAll: () => [neu] } };
  const merker = ctx.bandInventarFokusMerken(); ctx.bandInventarFokusWiederherstellen(merker);
  assert.equal(doc.activeElement, neu); assert.equal(neu.value, '12'); assert.equal(auswahl[0][0], 1); assert.equal(auswahl[0][1], 2);
  doc.activeElement = alt; neu.dataset = { item: 'item1', bandInventarId: 'anderes' }; ctx.bandInventarFokusWiederherstellen(merker); assert.equal(doc.activeElement, alt);
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
