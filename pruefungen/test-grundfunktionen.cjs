// Gezielte Regressionen führen unveränderte Funktionskörper aus der Arbeitsfassung aus.
// Sie ersetzen keinen vollständigen Browser-/Renderingtest.
const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
const path = require('path');
const source = process.argv[2] || path.join(__dirname, 'index.html');
const html = fs.readFileSync(source, 'utf8');
function fn(name) {
  const match = html.match(new RegExp('^function ' + name + '\\([^]*?^\\}', 'm'));
  if (!match) throw new Error('Originalfunktion fehlt: ' + name);
  return match[0];
}
function context(data, names) {
  vm.createContext(data);
  for (const name of names) vm.runInContext(fn(name), data);
  return data;
}
const tests = [];
function test(name, run) { run(); tests.push({name, passed:true}); }
const stations = context({
  gebaeudeListe: f => [{id:'wb',art:'werkbank'}, {id:'fo',art:'forschung'}, {id:'belegt',art:'forschung',arbeiterId:'p1'}].filter(f),
  istStation: () => true, typVon:g=>g, forscherErlaubt:()=>true,
  istForschungsstation:g=>g.art==='forschung', personKachel:()=>({}), abstand:()=>0,
}, ['freieStationen']);
test('Forschungsaktion ignoriert freie Werkbank und belegten Forschungstisch', () => {
  assert.deepEqual(Array.from(stations.freieStationen('forschung'),g=>g.id), ['fo']);
});
test('Allgemeine Stationssuche behält beide zulässigen Stationstypen', () => {
  assert.deepEqual(Array.from(stations.freieStationen(null),g=>g.id), ['wb','fo']);
});
test('Fehlende Forschungsberechtigung verhindert Forschungsauswahl', () => {
  stations.forscherErlaubt=()=>false;
  assert.equal(stations.freieStationen('forschung').length,0);
});
const save = context({mitarbeiter:[], bucheItems:()=>{}, PRODUKTION:{spielstandVersion:14},
  level:{name:'test'}, gebaeudeListe:()=>[], bandteilDaten:()=>({}), forschungSpeicherDaten:()=>({}),
  spiel:{baender:new Map(), produktHitze:{geloescht:15}, produktMaxHitze:{geloescht:10}},
}, ['spielstandDaten']);
const saved=JSON.parse(JSON.stringify(save.spielstandDaten())).wirtschaft;
test('Spielstand enthält Gesamtwärme und Wärmelimit gelöschter Blaupausen',()=>{
  assert.deepEqual(saved.produktHitze,{geloescht:15});
  assert.deepEqual(saved.produktMaxHitze,{geloescht:10});
});
function loadContext(current={}) {
  const warnings=[];
  const ctx=context({spiel:{produktTeile:{},produktUeberhitzt:{},produktHitze:{},produktMaxHitze:{},produktQa:{},
    produktGehaeuse:{},kiTeile:{},produktKopiert:{},krisen:{liste:[]},...current},
    WIRTSCHAFT:{startKapital:8000}, KONKURRENTEN:[], FORSCHUNG:[], klasseNachId:new Map(),
    setTimeout:fn=>fn(), meldeEreignis:(name,data)=>warnings.push({name,...data}),
  },['ladeWirtschaft']);
  ctx.warnings=warnings; return ctx;
}
test('Gelöschte Blaupause behält Wärmewerte nach Speichern und Laden',()=>{
  const ctx=loadContext();ctx.ladeWirtschaft({...saved,produktTeile:{geloescht:{k001:1}}});
  assert.equal(ctx.spiel.produktHitze.geloescht,15);
  assert.equal(ctx.spiel.produktMaxHitze.geloescht,10);
  assert.equal(ctx.warnings.length,0);
});
test('Alte Spielstände laden mit Hinweis auf unwiederbringlich fehlende Wärme',()=>{
  const ctx=loadContext(); ctx.ladeWirtschaft({produktTeile:{alt:{k001:1}}});
  assert.equal(ctx.warnings.length,1);
  assert.match(ctx.warnings[0].text,/nicht wiederhergestellt/);
});
test('Gespeicherte Produktversionswerte behalten beim Laden Vorrang',()=>{
  const ctx=loadContext({produktHitze:{bp:20},produktMaxHitze:{bp:30}});
  ctx.ladeWirtschaft({produktTeile:{bp:{}},produktHitze:{bp:1},produktMaxHitze:{bp:2}});
  assert.equal(ctx.spiel.produktHitze.bp,1); assert.equal(ctx.spiel.produktMaxHitze.bp,2);
});
function exportContext(copied, inventory, reserved={}) {
  const ctx={spiel:{auftraege:[{menge:1,geliefert:0,bezahlt:100}],produktKopiert:copied,
      statistik:{verkauft:0},zeit:0,version:0},reservierungen:()=>reserved,
    exportModusVon:()=> 'auftrag',passtZuAuftrag:()=>true,
    verfuegbar:(g,item,res)=>(g.bestand[item]||0)-(res[item]||0),
    aendereBestand:(g,item,n)=>g.bestand[item]=(g.bestand[item]||0)+n,
    schliesseAuftragAb:a=>{ctx.completed={...a};ctx.spiel.auftraege=[]},
    rueckrufWurf:()=>({rufe:0}),verbucheRueckruf:()=>{},g:{bestand:inventory}};
  context(ctx,['holeExportAb']);ctx.holeExportAb(ctx.g);return ctx;
}
test('Automatischer Abholwagen setzt Kopierbonus vor Auftragsabschluss',()=>{
  assert.equal(exportContext({bp1:true},{'p:bp1':1}).completed.kopierBonus,true);
});
test('Nicht kopierte Ware erhält keinen Kopierbonus',()=>{
  assert.equal(!!exportContext({},{'p:bp1':1}).completed.kopierBonus,false);
});
test('Nur reservierte kopierte Ware löst keinen Bonus für andere gelieferte Ware aus',()=>{
  assert.equal(!!exportContext({kopie:true},{'p:kopie':1,'p:normal':1},{'p:kopie':1}).completed.kopierBonus,false);
});
const result={source,tests,total:tests.length,passed:tests.every(t=>t.passed),browserVerification:'ausstehend'};
fs.writeFileSync(path.join(__dirname,'pruefung-grundfunktionen.json'), JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
