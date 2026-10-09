const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const path = require('path');
const sourcePath = process.argv[2] || path.join(__dirname, 'index.html');
const html = fs.readFileSync(sourcePath, 'utf8').replace(/\r\n/g, '\n');
const spielModul = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
fs.writeFileSync(path.join(__dirname, 'grafik-syntax.mjs'), spielModul);
function definition(name) {
  const start = html.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name);
  const end = html.indexOf('\n}', start);
  return html.slice(start, end + 2);
}
function fixture() {
  const W=12, H=12;
  const grid=Array.from({length:W},()=>Array.from({length:H},()=>({objekt:null,band:null,hochband:null,begehbar:true,kosten:1,belegt:false})));
  const types=new Map([
    ['band',{begehbar:false,spur:true}],['uebergang',{begehbar:true,spur:true}],
    ['splitter',{begehbar:false}],['smartZusammen',{begehbar:false}],
    ['rampeHoch',{begehbar:false}],['hochband',{begehbar:true,hoch:true}],['rampeRunter',{begehbar:false}],
    ['untergrundEin',{begehbar:true}],['untergrundAus',{begehbar:true}]
  ]);
  for (const t of types.values()) t.preis = 0;
  const buildings=new Map([['werkbank',{breite:1,tiefe:1,zugang:[0,1],freigeschaltet:true,kategorie:'station'}],
    ['lager',{breite:1,tiefe:1,zugang:[0,1],freigeschaltet:true,kategorie:'lager'}]]);
  for (const t of buildings.values()) t.preis = 0;
  const ctx={level:{breite:W,tiefe:H},rasterDaten:grid,spiel:{gebaeude:new Map(),baender:new Map(),depot:{gebaeude:{},baender:{}}},
    bandTypNach:types,gebaeudeTypNach:buildings,BAENDER:{untergrundReichweite:7},KACHEL_GROESSE:1,
    RICHTUNGEN:[{x:0,z:1},{x:-1,z:0},{x:0,z:-1},{x:1,z:0}],mitarbeiter:[],events:[],updates:0,
    istImRaster:(x,z)=>x>=0&&x<W&&z>=0&&z<H,
    holeKachel:(x,z)=>grid[x]?.[z]||null,
    istBegehbar:(x,z)=>!!grid[x]?.[z]?.begehbar,
    allePersonen:()=>[],personBeruehrtKachel:()=>false,bauSperre:()=>null,stehtAnWand:()=>true,kannBezahlen:()=>true,
    istStationsZugang:()=>false,
    markiereBaender:()=>ctx.updates++,planeLaufendeNeu:()=>{},meldeStruktur:()=>{},
    meldeEreignis:(name,e)=>ctx.events.push({name,e,positionen:[...ctx.spiel.baender.values()].map(t=>[t.id,t.x,t.z])}),
  };
  ctx.bandTyp=(t)=>types.get(t.typ);
  ctx.typVon=(g)=>buildings.get(g.typ);
  ctx.gebaeudeListe=(filter=()=>true)=>[...ctx.spiel.gebaeude.values()].filter(filter);
  ctx.anzahlTyp=(type)=>ctx.gebaeudeListe(g=>g.typ===type).length;
  ctx.bandteilAn=(x,z,ebene)=>ctx.spiel.baender.get(ebene?grid[x]?.[z]?.hochband:grid[x]?.[z]?.band)||null;
  vm.createContext(ctx);
  for(const name of ['zugangGesperrt','arbeitsZugangBei','gebaeudeGeometrie','bleibtAllesErreichbar','passtGebaeude',
    'bleibtErreichbarMit','pruefeBandteil','brueckeVon','untergrundPartner','bandVersatzGruppe','pruefeBandVersatz','verschiebeBandteil',
    'setzeBlockade','verschiebeGebaeude','dreheUm','planeEinfuegen','bandteilAufKachel']) {
    vm.runInContext(definition(name),ctx);
  }
  ctx.addBand=(t)=>{
    ctx.spiel.baender.set(t.id,t);
    const k=grid[t.x][t.z], info=types.get(t.typ);
    if(info.hoch) k.hochband=t.id; else {k.band=t.id;k.begehbar=!!info.begehbar;}
    return t;
  };
  ctx.addBuilding=(typ,x,z,id='g1')=>{
    const g={id,typ,x,z,drehung:0,version:0,...ctx.gebaeudeGeometrie(typ,x,z,0)};
    ctx.spiel.gebaeude.set(id,g);
    for(const p of g.zellen)Object.assign(grid[p.x][p.z],{objekt:id,belegt:true,begehbar:false});
    return g;
  };
  return ctx;
}
let tests=0;
function test(name, fn){fn();tests++;console.log('OK '+name);}
test('Alle Bandebenen respektieren den Lager-Arbeitszugang',()=>{
  const c=fixture();c.addBuilding('lager',4,4);
  for(const type of c.bandTypNach.keys())assert.equal(c.pruefeBandteil(type,4,5,0).passt,false,type);
  assert.equal(c.passtGebaeude('werkbank',4,5,0).passt,false);
  assert.equal(c.passtGebaeude('lager',3,5,0).passt,true);
});
test('Neue Gebäude-Arbeitsflächen sind auch unter Hochbändern unzulässig',()=>{
  const c=fixture();c.addBand({id:'b1',typ:'hochband',x:4,z:5,richtung:0});
  assert.equal(c.passtGebaeude('werkbank',4,4,0).passt,false);
  assert.equal(c.passtGebaeude('lager',4,4,0).passt,false);
});
test('Laden erhält bisherige Banddaten auf gesperrtem Zugang',()=>{
  const c=fixture();c.addBuilding('lager',4,4);
  assert.equal(c.pruefeBandteil('band',4,5,0,{laden:true}).passt,true);
  assert.equal(c.pruefeBandteil('band',4,5,0).passt,false);
});
test('Einzelband bewahrt Datenobjekt, ID, Waren, Puffer, Richtung und Filter',()=>{
  const c=fixture();
  const t=c.addBand({id:'b1',typ:'smartZusammen',x:2,z:2,richtung:3,items:[{item:'stahl',pos:0.7,von:2}],puffer:['kupfer'],haelt:'holz',seiten:{links:{filter:{stahl:true}}}});
  const items=t.items,puffer=t.puffer,seiten=t.seiten;
  assert.equal(c.verschiebeBandteil('b1',5,5).ok,true);
  assert.equal(c.spiel.baender.get('b1'),t);assert.equal(t.items,items);assert.equal(t.puffer,puffer);assert.equal(t.seiten,seiten);
  assert.equal(t.richtung,3);assert.equal(t.haelt,'holz');assert.equal(c.holeKachel(2,2).band,null);assert.equal(c.holeKachel(5,5).band,'b1');
});
test('Ungültiges Einzelziel ändert weder Raster noch Waren',()=>{
  const c=fixture();c.addBuilding('werkbank',5,4);
  c.addBand({id:'b1',typ:'band',x:2,z:2,richtung:1,items:[{item:'stahl',pos:0.2}]});
  const before=JSON.stringify({bands:[...c.spiel.baender],grid:c.rasterDaten});
  assert.equal(c.verschiebeBandteil('b1',5,5).ok,false);
  assert.equal(JSON.stringify({bands:[...c.spiel.baender],grid:c.rasterDaten}),before);assert.equal(c.events.length,0);
});
function bridge(c){return [
  c.addBand({id:'b1',typ:'rampeHoch',x:3,z:2,richtung:0,bruecke:'b1',items:[{item:'stahl',pos:0.3}]}),
  c.addBand({id:'b2',typ:'hochband',x:3,z:3,richtung:0,bruecke:'b1',items:[{item:'kupfer',pos:0.6}]}),
  c.addBand({id:'b3',typ:'rampeRunter',x:3,z:4,richtung:0,bruecke:'b1',items:[]})];}
test('Brücke wird vollständig verschoben; erst danach erscheinen Rasterereignisse',()=>{
  const c=fixture(),bs=bridge(c),items=bs.map(b=>b.items);
  const r=c.verschiebeBandteil('b2',6,6);assert.equal(r.ok,true);assert.equal(r.anzahl,3);
  bs.forEach((b,i)=>{assert.equal(b.x,6);assert.equal(b.z,5+i);assert.equal(b.items,items[i]);assert.equal(b.bruecke,'b1');});
  assert.equal(c.holeKachel(3,3).hochband,null);assert.equal(c.holeKachel(6,6).hochband,'b2');
  for(const event of c.events)assert.ok(event.positionen.every(p=>p[1]===6));
});
test('Brücken-Zielkollision rollt die gesamte Gruppe ohne Datenänderung zurück',()=>{
  const c=fixture();bridge(c);c.addBuilding('lager',6,5);
  const before=JSON.stringify({bands:[...c.spiel.baender],grid:c.rasterDaten});
  assert.equal(c.verschiebeBandteil('b2',6,6).ok,false);
  assert.equal(JSON.stringify({bands:[...c.spiel.baender],grid:c.rasterDaten}),before);
});
test('Tunnelpaar verschiebt sich ausgehend vom Ausgang gemeinsam',()=>{
  const c=fixture();
  const a=c.addBand({id:'b1',typ:'untergrundEin',x:2,z:2,richtung:0,items:[{item:'holz',pos:0.8}]});
  const b=c.addBand({id:'b2',typ:'untergrundAus',x:2,z:6,richtung:0,items:[{item:'stahl',pos:0.2}]});
  assert.equal(c.verschiebeBandteil('b2',5,7).ok,true);assert.equal(a.x,5);assert.equal(a.z,3);assert.equal(b.x,5);assert.equal(b.z,7);
  assert.equal(c.untergrundPartner(a),b);
});
test('Tunnelpaar wird bei fremdem Portal oder ungültigem Endpunkt vollständig abgewiesen',()=>{
  const c=fixture();
  c.addBand({id:'b1',typ:'untergrundEin',x:2,z:2,richtung:0,items:[{item:'holz',pos:0.8}]});
  c.addBand({id:'b2',typ:'untergrundAus',x:2,z:6,richtung:0,items:[]});
  c.addBand({id:'b3',typ:'untergrundAus',x:5,z:4,richtung:0,items:[]});
  const before=JSON.stringify({bands:[...c.spiel.baender],grid:c.rasterDaten});
  assert.equal(c.verschiebeBandteil('b1',5,2).ok,false);assert.equal(c.verschiebeBandteil('b1',10,9).ok,false);
  assert.equal(JSON.stringify({bands:[...c.spiel.baender],grid:c.rasterDaten}),before);
});
test('Arbeitszugänge bleiben auch bei Pfadtrennung erreichbar',()=>{
  const c=fixture();c.addBuilding('lager',2,2);c.addBuilding('werkbank',9,2,'g2');
  const wall=Array.from({length:12},(_,z)=>({x:6,z}));
  assert.equal(c.bleibtErreichbarMit(wall),false);
});
test('Mehrfachkopie darf weder Hochband noch Gebäude auf neuen Pfeil legen',()=>{
  const c=fixture();
  const b={typ:'werkbank',drehung:0,mx:0,mz:0};
  c.zwischenablage={gebaeude:[b],baender:[{typ:'hochband',dx:0,dz:1,richtung:0}]};
  assert.equal(c.planeEinfuegen({x:5,z:5},0).passt,false);
  c.zwischenablage={gebaeude:[b,{typ:'lager',drehung:0,mx:0,mz:1}],baender:[]};
  assert.equal(c.planeEinfuegen({x:5,z:5},0).passt,false);
});
function dragFixture() {
  const c=fixture();
  Object.assign(c,{
    bau:{werkzeug:null},verknuepfModus:null,mehrfachAktiv:()=>false,GRAFIK:{klickToleranz:4},
    zeichenflaeche:{style:{}},maus:{linksUnten:true,rahmenMoeglich:false},preview:null,messages:[],
    kachelUnterMaus:(x,y)=>c.istImRaster(Math.floor(x/10),Math.floor(y/10))?{x:Math.floor(x/10),z:Math.floor(y/10)}:null,
    setzeHover:()=>{},zeigeBauVorschau:(info)=>c.preview=info,zeigeBandVorschau:(list)=>c.preview=list,
    waehleGebaeude:()=>{},zeigeGebaeudeAuswahl:()=>{},waehleBandteil:()=>{},zeigeMeldung:(message)=>c.messages.push(message),
    gebaeudeUnter:(k)=>k&&c.spiel.gebaeude.get(c.holeKachel(k.x,k.z)?.objekt),
    ziehen:()=>{},personZiehenAbbruch:()=>{},rahmenAbbruch:()=>{}
  });
  vm.runInContext('let objektZug = null;',c);
  for(const name of ['objektZiehenStart','objektZiehenBewegt','objektZiehenEnde','objektZiehenAbbruch','breche3dGestenAb'])vm.runInContext(definition(name),c);
  c.pointer=(x,y,extra={})=>({clientX:x,clientY:y,pointerId:1,buttons:1,...extra});
  return c;
}
test('Kurzklick bleibt Auswahlklick und startet keine Verschiebung',()=>{
  const c=dragFixture(),t=c.addBand({id:'b1',typ:'band',x:2,z:2,richtung:3,items:[]});
  assert.equal(c.objektZiehenStart(c.pointer(25,25)),true);
  assert.equal(c.objektZiehenEnde(c.pointer(26,26)),false);
  assert.equal(t.x,2);assert.equal(t.z,2);assert.equal(c.maus.linksUnten,true);
});
test('ESC-/Zeigerabbruch lässt aktives Objekt und sämtliche Ware am Originalort',()=>{
  const c=dragFixture();c.addBand({id:'b1',typ:'band',x:2,z:2,richtung:1,items:[{item:'stahl',pos:0.4}]});
  const before=JSON.stringify({bands:[...c.spiel.baender],grid:c.rasterDaten});
  c.objektZiehenStart(c.pointer(25,25));c.objektZiehenBewegt(c.pointer(65,65));
  assert.ok(c.preview?.length);assert.equal(JSON.stringify({bands:[...c.spiel.baender],grid:c.rasterDaten}),before);
  c.breche3dGestenAb();assert.equal(c.preview,null);assert.equal(c.maus.linksUnten,false);
  assert.equal(c.objektZiehenEnde(c.pointer(65,65)),false);
  assert.equal(JSON.stringify({bands:[...c.spiel.baender],grid:c.rasterDaten}),before);
});
test('Aktives Werkzeug, Strg-/Shift-Auswahl und Mehrfachauswahl verhindern Objekt-DnD',()=>{
  const c=dragFixture();c.addBand({id:'b1',typ:'band',x:2,z:2,richtung:0});
  assert.equal(c.objektZiehenStart(c.pointer(25,25,{ctrlKey:true})),false);
  assert.equal(c.objektZiehenStart(c.pointer(25,25,{shiftKey:true})),false);
  c.bau.werkzeug={art:'abriss'};assert.equal(c.objektZiehenStart(c.pointer(25,25)),false);
  c.bau.werkzeug=null;c.mehrfachAktiv=()=>true;assert.equal(c.objektZiehenStart(c.pointer(25,25)),false);
});
test('Gebäudeziehen verschiebt beim Loslassen dasselbe Produktionsobjekt mit Bestand',()=>{
  const c=dragFixture(),g=c.addBuilding('werkbank',2,2);
  Object.assign(g,{bestand:{stahl:7},rezept:'rezept1',fortschritt:0.6,importVon:['g9']});
  const bestand=g.bestand,verknuepfung=g.importVon;
  assert.equal(c.objektZiehenStart(c.pointer(25,25)),true);c.objektZiehenBewegt(c.pointer(65,65));
  assert.equal(g.x,2);assert.equal(c.objektZiehenEnde(c.pointer(65,65)),true);
  assert.equal(g.x,6);assert.equal(g.z,6);assert.equal(g.bestand,bestand);assert.equal(g.importVon,verknuepfung);assert.equal(g.fortschritt,0.6);
});
console.log(tests+' Grafik-/Versatz-Regressionen bestanden.');
