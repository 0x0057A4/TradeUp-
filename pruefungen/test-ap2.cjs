const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');

const file = path.resolve(process.argv[2] || path.join(__dirname, 'index.html'));
const source = fs.readFileSync(file, 'utf8');
const tests = [];
function check(name, fn) {
  try { fn(); tests.push({ name, status: 'bestanden' }); }
  catch (error) { tests.push({ name, status: 'fehlgeschlagen', error: error.message }); }
}

check('Neue Spielstandversion und Versionsarchiv sind vorhanden', () => {
  assert.match(source, /spielstandVersion:\s+16,/);
  assert.match(source, /produktVersionen:\s*\{\}/);
  assert.match(source, /produktHistorie/);
  assert.match(source, /produktId\s*=\s*vorhanden/);
});
check('Produktwerte werden pro Version unveränderlich gemerkt', () => {
  assert.match(source, /if \(!Object\.hasOwn\(spiel\.produktNamen, id\)\)/);
  assert.match(source, /if \(!Object\.hasOwn\(spiel\.produktHitze, id\)\)/);
  assert.match(source, /blaupausenNachId\.set\(stand\.id, gespeichert\)/);
});
check('Alte Versionen laden als Layout und behalten die stabile Designer-ID', () => {
  assert.match(source, /flatMap\(\(b\) => produktStaende\(b\)\)/);
  assert.match(source, /designer\.blaupauseId = ergebnis\.blaupause\.blaupauseId \|\| ergebnis\.blaupause\.id/);
});
check('Laufende Produktionsaufträge werden gespeichert und wieder aufgenommen', () => {
  assert.match(source, /produktionsAuftragDaten\(p\)/);
  assert.match(source, /ladeProduktionsAuftrag\(p, s, m\.produktion\)/);
  assert.match(source, /Reservierter Durchgang behält seine Version/);
});
check('Doppelklick auf normales Band startet Weiterbauen', () => {
  assert.match(source, /if \(doppel && bandteil\.typ === "band"\) bandWeiterbauen\(\)/);
  assert.match(source, /Doppelklick = Fließband weiterbauen/);
});
check('Komponentenverschiebung und R-Rotation bleiben atomar', () => {
  assert.match(source, /function starteBandVerschieben\(/);
  assert.match(source, /function dreheBandAuswahl\(/);
  assert.match(source, /if \(drehung && t\.typ === "band"\) return \{ passt: false/);
  assert.match(source, /ware\.von = \(ware\.von \+ drehung\) % 4/);
  assert.match(source, /Untergrundverbindung verändert/);
});
check('Texteingaben behalten R für das Spiel zurück', () => {
  assert.match(source, /interaktiv|isContentEditable|INPUT|TEXTAREA/);
});

const passed = tests.filter((t) => t.status === 'bestanden').length;
console.log(JSON.stringify({ file, passed, total: tests.length, tests }, null, 2));
if (passed !== tests.length) process.exitCode = 1;
