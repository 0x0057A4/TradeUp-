// Prüft die tatsächlichen Lager-/Band-/Armfunktionen und native DnD-Ereignisse.
// DOM-/WebGL-Darstellung wird zusätzlich im Browser geprüft.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = process.argv[2] || path.join(__dirname, 'lager-prioritaet.html');
const html = fs.readFileSync(source, 'utf8');
const results = [];
const plain = x => JSON.parse(JSON.stringify(x));
const array = x => Array.from(x);
function fn(name) {
  const m = html.match(new RegExp('^function ' + name + '\\([^]*?^\\}', 'm'));
  assert(m, 'Originalfunktion fehlt: ' + name); return m[0];
}
function test(name, run) { run(); results.push({name, passed:true}); }
function world() {
  const c = {
    spiel: {gebaeude:new Map(), baender:new Map(), version:0, naechsteId:1, depot:{items:{}, gebaeude:{},baender:{}}},
    istHauptlager:g=>g?.typ==='hauptlager', istZwischenlager:g=>g?.typ==='kiste',
    istStation:g=>g?.typ==='werkbank', istImportzone:g=>g?.typ==='importzone',
    typVon:g=>({art:g.typ}),
    regelZeilenIds:g=>[...new Set([...Object.keys(g.bestand),...Object.keys(g.regeln),...(g.bedarf||[])])],
    reservierungen:()=>({}),
    verfuegbar:(g,i)=>Math.max(0,(g.bestand[i]||0)-(g.reserviert?.[i]||0)),
    hlGibtAb:(g,i)=>g.regeln[i]?.exp!==false,
    abholbar:g=>Object.fromEntries(Object.entries(g.bestand).filter(([i,n])=>g.regeln[i]?.exp!==false && n>(g.reserviert?.[i]||0)+(g.soll?.[i]||0))),
    darfArbeiterEntnehmen:(g,i)=>g.regeln[i]?.arbeiter!==false,
    aendereBestand(g,i,n) {g.bestand[i]=(g.bestand[i]||0)+n; if(!g.bestand[i])delete g.bestand[i];g.version++;},
    meldeStruktur(){c.spiel.version++;},
    armQuelle:a=>a.quelle, armZiel:a=>a.ziel,
    armZielNimmt:(z,i)=>!z.gesperrt && (!z.nimmt || z.nimmt.includes(i)),
    wareFalschGeroutet:(g,i)=>g.nimmt && !g.nimmt.includes(i),
    bandInventar:a=>({anzahl:a.reserve?.length||0}), warenFlags:x=>x||{},
    gebaeudeGeometrie:(typ,x,z)=>({zellen:[{x,z}],mitte:{x,z},zugang:{x,z:z+1}}),
    freieNummer:()=>1, STANDARD_LAGER_MODUS:'gemischt', regelnAusFixierung:()=>({}),
    richteZoneEin(){}, setzeBlockade(){}, meldeEreignis(){},
    mitarbeiter:[], PRODUKTION:{spielstandVersion:15}, level:{name:'probe'},
    gebaeudeListe:()=>[...c.spiel.gebaeude.values()], forschungSpeicherDaten:()=>({}), bandteilDaten:x=>x,
    bucheItems(z,items,f=1){for(const[i,n]of Object.entries(items))z[i]=(z[i]||0)+n*f;},
    summe:x=>Object.values(x||{}).reduce((a,n)=>a+n,0),
    reisseAb:id=>c.spiel.gebaeude.delete(id), entferneBandteil(){}, hatPuffer:()=>false,
    aktualisiereVerknuepft(){}, baueBandteil:()=>({ok:true}), weiseZu(){},
    htmlSicher:x=>String(x), itemInfo:i=>({name:i}),
    regelZeile:z=>({item:z.item,html:`<tr><td>${z.item}</td><td>${z.ist||0}</td></tr>`}),
    sollbestand:g=>g.soll||{}, regelVon:(g,i)=>({imp:false,exp:g.regeln[i]?.exp!==false}), maxErreicht:()=>false,
    PERSONAL:{autoZuweisung:true}, ladeKomponenten(){},ladeWirtschaft(){},ladeForschung(){},
    setzeHallenStufe(){},baueBandTopologie(){},nimmDuAuf(){},figur:{},
    gebaeudeTypNach:new Map(['hauptlager','kiste','werkbank'].map(i=>[i,{}])),
    bandTypNach:new Map(), istBegehbar:()=>true,bucheInsLager(){},
    zwischenablage:null, aktuelleAuswahl:()=>({gebaeude:[...c.spiel.gebaeude.keys()],baender:[]}),
    raeumeDepotInsHauptlager(){},verknuepfeAutomatisch(){},planeLaufendeNeu(){}, bucheGeld(){},
  };
  vm.createContext(c);
  for(const n of ['normalisiereLagerAusgabeReihenfolge','hatLagerAusgabeReihenfolge','lagerAusgabeSichtbareItems','lagerAusgabeItems',
    'verschiebeLagerAusgabe','verschiebeLagerAusgabePosition','hauptlagerRegelIds','gebaeudeGibAb','armKandidaten','armGreife',
    'stelleGebaeudeAuf','spielstandDaten','wendeSpielstandAn','halleBereinigen','stelleAufbauWiederHer',
    'kopiereAuswahl','fuegeEin','lagerAusgabeZeile','lagerAusgabeTabelle','lagerZeilen','hauptlagerZeilen']) vm.runInContext(fn(n),c);
  c.baueGebaeude=(typ,x,z,d,extra)=>({ok:true,gebaeude:c.stelleGebaeudeAuf(typ,x,z,d,extra)});
  return c;
}
function store(c, typ='hauptlager', extra={}) {
  return c.stelleGebaeudeAuf(typ,2,3,0,{bestand:{eisen:3,kupfer:2},...extra});
}
test('Ungültige und doppelte gespeicherte Reihenfolge wird bereinigt',()=>{
  const c=world();assert.deepEqual(array(c.normalisiereLagerAusgabeReihenfolge(['eisen',null,'eisen',4,'','kupfer'])),['eisen','kupfer']);
  assert.deepEqual(array(c.normalisiereLagerAusgabeReihenfolge({eisen:1})),[]);
});
test('Rendern und neue Bestände aktivieren niemals ungefilterte Hauptlager-Ausgabe',()=>{
  const c=world(),g=store(c);c.hauptlagerZeilen(g);g.bestand.holz=2;c.lagerAusgabeItems(g,['holz']);
  assert.equal(g.lagerAusgabePrioritaetAktiv,false);assert.equal(c.gebaeudeGibAb(g,{ablaufFilter:[]}),null);
});
test('Drop vor/hinter einer Zeile ändert Reihenfolge und aktiviert die Ausgabe',()=>{
  const c=world(),g=store(c);assert.equal(c.verschiebeLagerAusgabe(g.id,'kupfer','eisen'),true);
  assert.deepEqual(array(g.lagerAusgabeReihenfolge),['kupfer','eisen']);assert.equal(g.lagerAusgabePrioritaetAktiv,true);
  c.verschiebeLagerAusgabe(g.id,'kupfer','eisen',true);assert.deepEqual(array(g.lagerAusgabeReihenfolge),['eisen','kupfer']);
});
test('Unveränderter Drop und fremde Ziele aktivieren keine Ausgabe',()=>{
  const c=world(),g=store(c);assert.equal(c.verschiebeLagerAusgabe(g.id,'eisen','kupfer'),false);
  assert.equal(c.verschiebeLagerAusgabe(g.id,'eisen','eisen'),false);assert.equal(c.verschiebeLagerAusgabe(g.id,'eisen','fremd'),false);
  assert.equal(g.lagerAusgabePrioritaetAktiv,false);assert.equal(g.version,0);
});
test('Tastaturhoch/runter nutzt auch leere Bedarfszeilen im Zwischenlager',()=>{
  const c=world(),g=store(c,'kiste');g.bedarf=['holz'];
  assert.equal(c.verschiebeLagerAusgabePosition(g.id,'holz',-1),true);
  assert.deepEqual(array(c.lagerAusgabeItems(g,c.regelZeilenIds(g))),['eisen','holz','kupfer']);
  assert.equal(c.verschiebeLagerAusgabePosition(g.id,'eisen',-1),false);
  assert.equal(c.verschiebeLagerAusgabePosition(g.id,'kupfer',1),false);
});
test('Reihenfolge kann an Maschinen weder gesetzt noch aktiviert werden',()=>{
  const c=world(),g=store(c,'werkbank');assert.equal(c.verschiebeLagerAusgabe(g.id,'kupfer','eisen'),false);
  assert.deepEqual(array(c.lagerAusgabeItems(g,['kupfer','eisen'])),['kupfer','eisen']);
});
test('Hauptlager leert oberste erlaubte Ware vollständig vor der nächsten',()=>{
  const c=world(),g=store(c);c.verschiebeLagerAusgabe(g.id,'kupfer','eisen');
  assert.deepEqual(Array.from({length:6},()=>c.gebaeudeGibAb(g,{ablaufFilter:[]})),['kupfer','kupfer','eisen','eisen','eisen',null]);
});
test('Ausgangsfilter ist auch bei aktiver Priorität immer bindend',()=>{
  const c=world(),g=store(c);c.verschiebeLagerAusgabe(g.id,'kupfer','eisen');
  assert.equal(c.gebaeudeGibAb(g,{ablaufFilter:['eisen']}),'eisen');assert.equal(g.bestand.kupfer,2);
  assert.equal(c.gebaeudeGibAb(g,{ablaufFilter:['holz']}),null);
});
test('Gesperrte und reservierte Waren blockieren nachrangige Ausgabe nicht',()=>{
  const c=world(),g=store(c);c.verschiebeLagerAusgabe(g.id,'kupfer','eisen');
  g.regeln.kupfer={exp:false};assert.equal(c.gebaeudeGibAb(g,{ablaufFilter:[]}),'eisen');
  g.regeln.kupfer={exp:true};g.reserviert={kupfer:2};assert.equal(c.gebaeudeGibAb(g,{ablaufFilter:[]}),'eisen');
  assert.equal(g.bestand.kupfer,2);
});
test('Neue Ware kommt hinten, erneut gelieferte Ware behält ihren Rang',()=>{
  const c=world(),g=store(c);c.verschiebeLagerAusgabe(g.id,'kupfer','eisen');
  delete g.bestand.kupfer;g.bestand.holz=1;c.lagerAusgabeItems(g,Object.keys(g.bestand));g.bestand.kupfer=1;
  assert.deepEqual(array(c.lagerAusgabeItems(g,Object.keys(g.bestand))),['kupfer','eisen','holz']);
});
test('Zwischenlager priorisiert nur abholbare Überschüsse am Bandausgang',()=>{
  const c=world(),g=store(c,'kiste');c.verschiebeLagerAusgabe(g.id,'kupfer','eisen');g.soll={kupfer:2};
  assert.equal(c.gebaeudeGibAb(g,{ablaufFilter:[]}),'eisen');g.soll={};
  assert.equal(c.gebaeudeGibAb(g,{ablaufFilter:[]}),'kupfer');
});
test('Stationen und Importzonen behalten ihre bisherige Auswahl',()=>{
  const c=world();for(const typ of ['werkbank','importzone']){
    const g=store(c,typ,{lagerAusgabeReihenfolge:['kupfer','eisen'],lagerAusgabePrioritaetAktiv:true});
    assert.equal(c.gebaeudeGibAb(g,{ablaufFilter:[]}),'eisen');
  }
});
test('Greifarm nutzt Hauptlager-Priorität bei bewusst aktivierter Ausgabe',()=>{
  const c=world(),g=store(c);c.verschiebeLagerAusgabe(g.id,'kupfer','eisen');
  const a={typ:'greifarm',quelle:{art:'gebaeude',g},ziel:{art:'band'},armFilter:null};
  assert.deepEqual(Array.from({length:5},()=>c.armGreife(a)),['kupfer','kupfer','eisen','eisen','eisen']);
});
test('Greifarm behält Alt-Filterschutz und beachtet expliziten Filter',()=>{
  const c=world(),g=store(c),a={typ:'greifarm',quelle:{art:'gebaeude',g},ziel:{art:'band'},armFilter:null};
  c.hauptlagerZeilen(g);assert.equal(c.armGreife(a),null);
  c.verschiebeLagerAusgabe(g.id,'kupfer','eisen');a.armFilter='eisen';assert.equal(c.armGreife(a),'eisen');assert.equal(g.bestand.kupfer,2);
});
test('Greifarm überspringt ungeeignete Ziele, Sperren und Reservierungen',()=>{
  const c=world(),g=store(c);c.verschiebeLagerAusgabe(g.id,'kupfer','eisen');
  const a={typ:'greifarm',quelle:{art:'gebaeude',g},ziel:{art:'gebaeude',nimmt:['eisen']},armFilter:null};
  assert.equal(c.armGreife(a),'eisen');a.ziel.nimmt=null;g.regeln.kupfer={exp:false};assert.equal(c.armGreife(a),'eisen');
  g.regeln.kupfer={exp:true};g.reserviert={kupfer:2};assert.equal(c.armGreife(a),'eisen');assert.equal(g.bestand.kupfer,2);
});
test('Zwischenlager-Arm sortiert vorhandene zulässige Kandidaten ohne Kurieränderung',()=>{
  const c=world(),g=store(c,'kiste');c.verschiebeLagerAusgabe(g.id,'kupfer','eisen');
  assert.deepEqual(array(c.armKandidaten(g)),['kupfer','eisen']);
  g.regeln.kupfer={exp:false,arbeiter:false};assert.deepEqual(array(c.armKandidaten(g)),['eisen']);
  assert.deepEqual(Object.keys(c.abholbar(g)),['eisen']);
});
test('Speichern und echtes Laden erhalten Reihenfolge und Aktivierung',()=>{
  const c=world(),g=store(c);c.verschiebeLagerAusgabe(g.id,'kupfer','eisen');
  const d=plain(c.spielstandDaten());const loaded=world();loaded.wendeSpielstandAn(d);
  const lg=loaded.spiel.gebaeude.get(g.id);assert.deepEqual(array(lg.lagerAusgabeReihenfolge),['kupfer','eisen']);assert.equal(lg.lagerAusgabePrioritaetAktiv,true);
  assert.equal(loaded.gebaeudeGibAb(lg,{ablaufFilter:[]}),'kupfer');
});
test('Alte Spielstände ohne neue Felder laden ohne automatische Freischaltung',()=>{
  const c=world();c.wendeSpielstandAn({version:15,gebaeude:[{id:'alt',typ:'hauptlager',x:2,z:3,drehung:0,bestand:{eisen:2}}]});
  const g=c.spiel.gebaeude.get('alt');assert.deepEqual(array(g.lagerAusgabeReihenfolge),[]);assert.equal(g.lagerAusgabePrioritaetAktiv,false);
  assert.equal(c.gebaeudeGibAb(g,{ablaufFilter:[]}),null);
});
test('Halle-Snapshot und Wiederherstellung erhalten Priorität, keine Bestandsduplikation',()=>{
  const c=world(),g=store(c);c.verschiebeLagerAusgabe(g.id,'kupfer','eisen');c.halleBereinigen();
  const snap=c.spiel.schnappschuss.gebaeude[0];assert.deepEqual(array(snap.lagerAusgabeReihenfolge),['kupfer','eisen']);assert.equal(snap.lagerAusgabePrioritaetAktiv,true);
  c.stelleAufbauWiederHer();const rebuilt=[...c.spiel.gebaeude.values()][0];assert.deepEqual(array(rebuilt.lagerAusgabeReihenfolge),['kupfer','eisen']);
  assert.equal(rebuilt.lagerAusgabePrioritaetAktiv,true);assert.deepEqual(plain(rebuilt.bestand),{});
});
test('Kopieren und tatsächliches Einfügen übernehmen Priorität und Aktivierung',()=>{
  const c=world(),g=store(c);c.verschiebeLagerAusgabe(g.id,'kupfer','eisen');assert.equal(c.kopiereAuswahl(),1);
  const e=c.zwischenablage.gebaeude[0];c.planeEinfuegen=()=>({passt:true,kosten:0,gebaeude:[{e,typ:g.typ,x:5,z:5,drehung:0,kosten:0}],baender:[]});
  const result=c.fuegeEin({x:5,z:5}),g2=result.gebaeude[0];assert.equal(result.ok,true);
  assert.deepEqual(array(g2.lagerAusgabeReihenfolge),['kupfer','eisen']);assert.equal(g2.lagerAusgabePrioritaetAktiv,true);assert.notEqual(g2.lagerAusgabeReihenfolge,g.lagerAusgabeReihenfolge);
});
test('Sichtbare Lagerzeilen spiegeln Ausgabe-Reihenfolge und tastaturfähige Knöpfe',()=>{
  const c=world(),g=store(c);c.verschiebeLagerAusgabe(g.id,'kupfer','eisen');const markup=c.hauptlagerZeilen(g);
  assert(markup.indexOf('data-lager-ausgabe-item="kupfer"')<markup.indexOf('data-lager-ausgabe-item="eisen"'));
  assert.match(markup,/draggable="true"/);assert.match(markup,/data-aktion="lager-ausgabe-hoch"/);
  assert.match(markup,/Ohne Ausgangsfilter werden alle freigegebenen Waren ausgegeben/);
});
function dragWorld() {
  const c=world(),g=store(c),listeners={},classes=new Set();
  const table={dataset:{lagerAusgabe:g.id},querySelectorAll:()=>rows};
  const rows=['eisen','kupfer'].map(item=>({dataset:{lagerAusgabeItem:item},closest:()=>table,
    getBoundingClientRect:()=>({top:100,height:40}),classList:{add:x=>classes.add(item+':'+x),remove:(...xs)=>xs.forEach(x=>classes.delete(item+':'+x))}}));
  const grip={dataset:{lagerSortGriff:'kupfer'},closest:q=>q==='tr'?rows[1]:table};
  c.ob={infoInhalt:{addEventListener:(n,f)=>listeners[n]=f,querySelectorAll:()=>rows}};
  c.zeigeMeldung=()=>{};c.sofortAktualisieren=()=>{};
  const begin=html.indexOf('let lagerAusgabeZiehen = null;'),end=html.indexOf('$("info-schliessen")',begin);
  assert(begin>0&&end>begin);vm.runInContext(html.slice(begin,end),c);
  return{c,g,listeners,rows,grip,classes};
}
test('Native DnD nutzt untere/obere Zeilenhälfte und räumt Dragzustand auf',()=>{
  const {c,g,listeners,rows,grip,classes}=dragWorld(),dt={setData(){}};
  listeners.dragstart({target:{closest:()=>grip},dataTransfer:dt});assert.equal(dt.effectAllowed,'move');
  let prevented=0;listeners.dragover({target:{closest:()=>rows[0]},clientY:105,dataTransfer:dt,preventDefault:()=>prevented++});
  assert(classes.has('eisen:lager-sort-davor'));assert.equal(prevented,1);
  listeners.drop({target:{closest:()=>rows[0]},clientY:105,preventDefault:()=>prevented++});
  assert.deepEqual(array(g.lagerAusgabeReihenfolge),['kupfer','eisen']);assert.equal(g.lagerAusgabePrioritaetAktiv,true);assert.equal(classes.size,0);
  assert.equal(vm.runInContext('lagerAusgabeZiehen',c),null);
});
test('Native DnD lehnt fremdes Lager ab; Escape beendet Geste ohne Änderung',()=>{
  const {c,g,listeners,grip,classes}=dragWorld();listeners.dragstart({target:{closest:()=>grip},dataTransfer:{setData(){}}});
  const foreign={closest:()=>({dataset:{lagerAusgabe:'anderes'}})};let prevented=false;
  listeners.drop({target:{closest:()=>foreign},preventDefault:()=>prevented=true});assert.equal(prevented,false);
  listeners.keydown({key:'Escape'});assert.equal(vm.runInContext('lagerAusgabeZiehen',c),null);assert.equal(classes.size,0);assert.equal(g.lagerAusgabePrioritaetAktiv,false);
});
test('Live-Aktualisierung friert den Griff und die Zeilen während nativer DnD ein',()=>{
  const {c,listeners,grip}=dragWorld();c.document={activeElement:null};c.performance={now:()=>1};c.infoFormSperre=0;
  c.HTMLInputElement=class{};c.HTMLSelectElement=class{};vm.runInContext(fn('infoFormularAktiv'),c);
  assert.equal(c.infoFormularAktiv(),false);listeners.dragstart({target:{closest:()=>grip},dataTransfer:{setData(){}}});
  assert.equal(c.infoFormularAktiv(),true);listeners.dragend();assert.equal(c.infoFormularAktiv(),false);
});
const report={source:path.resolve(source),total:results.length,passed:results.length,tests:results};
fs.writeFileSync(path.join(__dirname,'pruefung-lager-prioritaet.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed}));
