// Isolierte Regressionen an den tatsächlichen Funktionen der Arbeitskopie.
// Keine DOM-/WebGL-Probe; die vollständige Browserabnahme bleibt erforderlich.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const sourcePath = process.argv[2] || path.join(__dirname, 'logik.html');
const source = fs.readFileSync(sourcePath, 'utf8');
const results = [];
function extract(name) {
  const re = new RegExp('^function ' + name + '\\([^]*?^}', 'm');
  const m = source.match(re);
  assert(m, 'Funktion fehlt: ' + name);
  return m[0];
}
const names = ['bandInventar','loescheBandInventar','bandQuellItems','warenFlags','pufferWare',
  'hatPuffer','pufferVon','hatPlatz','hatPhysischPlatz','entladeBandReserve','legeAufBand','bewegeItems','seiteEinstellung','hatNurFilter','seiteLaesstDurch',
  'wartetVor','zusammenLaesstDurch','smartZusammenLaesstDurch','smartZusammenZielPlatz',
  'nimmAufBand','splitterFilterPasst','splitterGibWeiter','legeAufAusgang','smartGibWeiter',
  'ventilGibWeiter','legeInPuffer','verteilerSchritt','gibWeiter','omniSchritt',
  'armGreife','armGreifeWare','armLegeAb','greifarmSchritt','bandteilDaten','setzeBandteil','entferneBandteil','halleBereinigen','zaehleHalle',
  'seiteVonFahrt','absRichtung','nachbarKachel','vorKachel','hinterKachel',
  'untergrundPartner','untergrundZiel','zielVon','nimmtVonSeite','leseSpielstand','wendeSpielstandAn'];
function world() {
  const buildings = new Map();
  const bands = new Map();
  const ctx = {
    spiel: { baender: bands, gebaeude: buildings, statistik: {}, zeit: 0, version: 0, naechsteBandId: 1 },
    BAENDER: { mindestAbstand: 0.5, knotenTempo: 2.5, verteilerPuffer: 25, omniPuffer: 25, greifZyklus: 1.2, untergrundReichweite: 3 },
    PUFFER_GROESSE: 25, VERTEILER_TYPEN: ['splitter','smartVerteiler','ventil'],
    RICHTUNGEN: [{x:0,z:1},{x:-1,z:0},{x:0,z:-1},{x:1,z:0}],
    SEITEN_DREHUNG: { vorn:0,rechts:1,hinten:2,links:3 },
    bandTypNach: new Map(['band','pruefband','aussweiche','untergrundEin','untergrundAus','zusammen','smartZusammen','omniMerger','splitter','smartVerteiler','ventil','greifarm','greifGeber'].map(typ => [typ,{typ,spur:['band','pruefband','aussweiche','untergrundEin','untergrundAus'].includes(typ),ebeneEin:0,ebeneAus:0,begehbar:true}])),
    bandTyp(t) { return ctx.bandTypNach.get(t.typ); },
    istSpur(t) { return !!ctx.bandTyp(t).spur; },
    istVerteiler(t) { return !!t && ctx.VERTEILER_TYPEN.includes(t.typ); },
    istGreifarm(t) { return !!t && ['greifarm','greifGeber'].includes(t.typ); },
    istStation(g) { return !!g && g.art === 'station'; },
    rezeptVon(g) { return g.rezeptDaten || null; },
    itemInfo(id) { return {name:id}; }, itemVolumen() { return 1; },
    reservierungen() { return {rein:new Map(),raus:new Map()}; },
    fachSchluessel(id,fach) { return fach==='eingang'?id+':ein':id; },
    verfuegbar(g,i) { return Math.max(0,(g.bestand[i]||0)-(g.reserviert?.[i]||0)); },
    armKandidaten(g) { return Object.keys(g.bestand).filter(i => ctx.verfuegbar(g,i)>0); },
    zielHatPlatz(g,item,unterwegs,stueck,vol) { return !g.gesperrt && (g.nimmt || []).includes(item) && Object.values(g.bestand).reduce((a,n)=>a+n,0)+stueck<g.kapazitaet; },
    gebaeudeNimmtVomBand(g,item) { if(!ctx.zielHatPlatz(g,item,0,0,0))return false;g.bestand[item]=(g.bestand[item]||0)+1;return true; },
    taktFrei() { return true; }, verbraucheTakt() {}, meldeStruktur() {}, markiereBaender() {}, meldeEreignis() {},
    warnleuchtenAktiv() { return false; }, forschungsWirkung() { return 1; },
    ausgangHatPlatz(a,item) { return ctx.smartZusammenZielPlatz(a.ziel,item); },
    rasterDaten: Array.from({length:20},()=>Array.from({length:20},()=>({}))),
    seitenAusDaten(d) { return d.seiten || {}; },
    bandTopologieAlt: false,
    bandteilAn(x,z) { return [...bands.values()].find(b=>b.x===x&&b.z===z)||null; },
    gebaeudeAufKachel(k) { return [...buildings.values()].find(g=>g.x===k.x&&g.z===k.z)||null; },
    armQuelle(a) { return a.quelle || null; }, armZiel(a) { return a.ziel || null; },
    armZielNimmt(z,i) { return z.art==='band'?ctx.hatPlatz(z.teil,0.5):ctx.zielHatPlatz(z.g,i,0,0,0); },
    wareFalschGeroutet(g,i) { return !(g.nimmt||[]).includes(i); },
    typVon(g) { return {art:g.art}; }, aendereBestand(g,i,n) { g.bestand[i]=(g.bestand[i]||0)+n; },
    bucheItems(z,items,f=1) { for(const[i,n]of Object.entries(items)){z[i]=(z[i]||0)+n*f;if(z[i]<=0)delete z[i];} },
    bucheInsLager(items) { ctx.bucheItems(ctx.spiel.depot.items,items); },
    bucheGeld() {}, summe(items) { return Object.values(items||{}).reduce((a,n)=>a+n,0); },
    gebaeudeListe() { return [...buildings.values()]; },
    mitarbeiter: [], aktualisiereVerknuepft() {}, reisseAb() {}, haltePersonAn() {}
  };
  ctx.spiel.depot={items:{},baender:{},gebaeude:{}};
  vm.createContext(ctx);
  vm.runInContext(names.map(extract).join('\n'),ctx);
  return ctx;
}
function band(c,id,typ='band',extra={}) {
  const t={id,typ,x:c.spiel.baender.size,z:1,richtung:0,items:[],vorgaenger:[],seiten:{},ablaufFilter:[],...extra};
  c.spiel.baender.set(id,t); return t;
}
function dest(c,extra={}) { const g={id:'g',art:'lager',bestand:{},nimmt:['eisen','kupfer'],kapazitaet:100,...extra};c.spiel.gebaeude.set(g.id,g);return {art:'gebaeude',g}; }
function check(name,fn) { fn();results.push({name,status:'bestanden'}); }

check('Syntax aller Inline-Skripte',()=>{
  for(const m of source.replace(/<!--[^]*?-->/g,'').matchAll(/<script\b([^>]*)>([^]*?)<\/script>/gi)) {
    if(/\bsrc\s*=/.test(m[1])||!m[2].trim())continue;
    if(/importmap/.test(m[1]))JSON.parse(m[2]);
    else new vm.Script(m[2].replace(/^import .*;$/gm,''));
  }
});
check('Speicherformat 15 liest 14 und 15, aber keine unbekannte Folgeversion',()=>{
  const c=world();c.PRODUKTION={spielstandVersion:15};c.window={localStorage:{getItem:()=>''}};
  for(const version of [14,15,16]){c.window.localStorage.getItem=()=>JSON.stringify({version,gebaeude:[]});assert.equal(!!c.leseSpielstand(),version!==16);}
  assert.match(source,/spielstandVersion:\s+15,/);
});
check('Inventar zählt echte Ware in Spur, Puffer und Arm genau einmal',()=>{
  const c=world(),t=band(c,'b','splitter',{items:[{item:'eisen'}],puffer:['eisen','kupfer'],haelt:'kupfer'});
  const inv=c.bandInventar(t);assert.equal(inv.anzahl,4);assert.equal(inv.kapazitaet,25);assert.equal(inv.bestand.eisen,2);assert.equal(inv.bestand.kupfer,2);
});
check('25 ist Annahmegrenze; alte 30 werden ohne Verlust geladen und entladen',()=>{
  const c=world();const t=c.setzeBandteil('splitter',1,1,0,{id:'old',puffer:Array(30).fill('eisen')});
  assert.equal(c.bandInventar(t).anzahl,30);assert.equal(c.legeInPuffer(t,'kupfer'),false);
  t.ausgaenge=[{seite:'vorn',richtung:0,ziel:dest(c)}];t.naechster=0;
  for(let i=0;i<6;i++)c.verteilerSchritt(t,1);
  assert.equal(c.bandInventar(t).anzahl,24);assert.equal(t.ausgaenge[0].ziel.g.bestand.eisen,6);
  assert.equal(c.legeInPuffer(t,'kupfer'),true);assert.equal(c.legeInPuffer(t,'kupfer'),false);
  const saved=c.bandteilDaten(t);assert.equal(saved.puffer.length,25);
});
check('Spur-/Arm-Gesamtbestand sperrt Annahme oberhalb25',()=>{
  const c=world(),t=band(c,'spur','band',{items:Array.from({length:25},(_,i)=>({item:'eisen',pos:10+i}))});
  assert.equal(c.hatPlatz(t),false);assert.equal(c.nimmAufBand(t,'kupfer',0),false);
  const arm=band(c,'arm','greifGeber',{haelt:'eisen'});assert.equal(c.bandInventar(arm).anzahl,1);
});
check('Echte Spurreserve25, Annahme26 gesperrt, FIFO-Abfluss mit Abstand und einmaligem Takt',()=>{
  const c=world(),t=band(c,'fifo');let takte=0;c.verbraucheTakt=()=>takte++;
  for(let i=0;i<25;i++)assert.equal(c.nimmAufBand(t,'ware'+i,0,null,{geprueft:true,defekt:i===0}),true);
  assert.equal(c.bandInventar(t).anzahl,25);assert.equal(t.reserve.length,24);assert.equal(c.nimmAufBand(t,'zuViel',0),false);assert.equal(takte,25);
  const out=[];
  for(let frame=0;frame<300&&c.bandInventar(t).anzahl;frame++){
    c.bewegeItems(t,0.25);
    if(t.items[0]?.pos>=1){out.push(t.items.shift());}
    c.entladeBandReserve(t);
    for(let i=1;i<t.items.length;i++)assert(t.items[i-1].pos-t.items[i].pos>=0.5-1e-9);
  }
  assert.equal(c.bandInventar(t).anzahl,0);assert.deepEqual(out.map(w=>w.item),Array.from({length:25},(_,i)=>'ware'+i));
  assert.equal(out[0].defekt,true);assert(out.every(w=>w.geprueft===true));assert.equal(takte,25);
});
check('Arm füllt tatsächliche Reserve bei blockiertem Ziel bis Gesamt25 und entlädt danach',()=>{
  const c=world(),q={id:'armQuelle',art:'lager',bestand:{eisen:50}},ziel=dest(c,{kapazitaet:0});
  const a=band(c,'armFIFO','greifarm',{quelle:{art:'gebaeude',g:q},ziel});
  for(let i=0;i<60;i++)c.greifarmSchritt(a,1.2);
  assert.equal(c.bandInventar(a).anzahl,25);assert.equal(a.reserve.length,24);assert.equal(a.haelt,'eisen');assert.equal(q.bestand.eisen,25);
  c.greifarmSchritt(a,1.2);assert.equal(q.bestand.eisen,25);
  a.armFilter='kupfer';ziel.g.kapazitaet=100;
  for(let i=0;i<100;i++)c.greifarmSchritt(a,1.2);
  assert.equal(c.bandInventar(a).anzahl,0);assert.equal(ziel.g.bestand.eisen,25);assert.equal(q.bestand.eisen,25);
});
check('Spur- und Armreserven behalten Flags bei Speichern/Laden und gezielter Löschung',()=>{
  const c=world(),t=band(c,'saveFIFO');for(let i=0;i<25;i++)c.nimmAufBand(t,i%2?'kupfer':'eisen',0,null,{geprueft:true,defekt:i%2===0});
  const saved=c.bandteilDaten(t),restored=c.setzeBandteil('band',8,8,0,saved);
  assert.equal(c.bandInventar(restored).anzahl,25);assert.equal(restored.reserve.length,24);assert.equal(restored.reserve[1].defekt,true);
  assert.equal(c.loescheBandInventar(restored.id,'eisen',3).menge,3);assert.equal(c.bandInventar(restored).anzahl,22);assert(restored.reserve.every(w=>w.geprueft));
  const arm=band(c,'armSave','greifGeber',{haelt:'eisen',haeltFlags:{defekt:true},reserve:Array.from({length:24},()=>({item:'kupfer',geprueft:true}))});
  const arm2=c.setzeBandteil('greifGeber',9,9,0,c.bandteilDaten(arm));assert.equal(c.bandInventar(arm2).anzahl,25);assert.equal(arm2.haeltFlags.defekt,true);assert(arm2.reserve.every(w=>w.geprueft));
  assert.equal(c.nimmAufBand(arm2,'eisen',0),false);assert.equal(c.loescheBandInventar(arm2.id,'kupfer',24).menge,24);assert.equal(c.bandInventar(arm2).anzahl,1);
});
check('Aufbau-Snapshot und Abriss buchen Reserveware genau einmal ins Depot',()=>{
  const c=world(),t=band(c,'cleanup');for(let i=0;i<25;i++)c.nimmAufBand(t,'eisen',0,null,{defekt:true});
  assert.equal(c.zaehleHalle().items,25);const result=c.halleBereinigen();assert.equal(result.items,25);assert.equal(c.spiel.depot.items.eisen,25);assert.equal(c.spiel.baender.size,0);
  const snapshot=c.spiel.schnappschuss.baender[0];assert.equal(snapshot.reserve.length,0);assert.equal(snapshot.items.length,0);
  const rebuilt=c.setzeBandteil('band',4,4,0,snapshot);assert.equal(c.bandInventar(rebuilt).anzahl,0);assert.equal(c.spiel.depot.items.eisen,25);
});
check('Nicht mehr platzierbare gespeicherte Bänder behalten alle Reservemengen im Depot',()=>{
  const c=world();Object.assign(c,{PERSONAL:{autoZuweisung:true},ladeKomponenten(){},ladeWirtschaft(){},ladeForschung(){},setzeHallenStufe(){},baueBandTopologie(){},nimmDuAuf(){},figur:{},pruefeBandteil(){return{passt:false};}});
  c.wendeSpielstandAn({version:15,gebaeude:[],baender:[{id:'unplatzierbar',typ:'band',x:0,z:0,richtung:0,items:[{item:'eisen',pos:1}],reserve:Array.from({length:24},()=>({item:'eisen',defekt:true}))}]});
  assert.equal(c.spiel.depot.items.eisen,25);assert.equal(c.spiel.depot.baender.band,1);assert.equal(c.spiel.baender.size,0);
});
check('Smart-Zusammenführung sperrt Filter, volle Ziele und Ringe',()=>{
  const c=world(),t=band(c,'smart','smartZusammen',{ziel:dest(c,{kapazitaet:1,bestand:{eisen:1}})});
  assert.equal(c.nimmAufBand(t,'eisen',0),false);t.ziel.g.bestand={};
  t.seiten.hinten={gesperrt:true,filter:{}};assert.equal(c.nimmAufBand(t,'eisen',0),false);
  t.seiten.hinten={gesperrt:false,filter:{eisen:false}};assert.equal(c.nimmAufBand(t,'eisen',0),false);
  t.seiten={};const ring=band(c,'ring');ring.ziel={art:'band',teil:ring};t.ziel={art:'band',teil:ring};assert.equal(c.nimmAufBand(t,'eisen',0),false);
  t.ziel=dest(c);assert.equal(c.nimmAufBand(t,'eisen',0),true);
});
check('Drei dauerhaft wartende Eingänge erhalten fairen Umlauf',()=>{
  const c=world(),t=band(c,'s','smartZusammen',{ziel:dest(c)});
  const sides=[['links',1],['hinten',0],['rechts',3]];
  for(const [side,richtung]of sides)t.vorgaenger.push({teil:band(c,side,'band',{items:[{item:'eisen',pos:1}]}),richtung});
  const accepted=[];
  for(let n=0;n<9;n++)for(const [side,richtung]of sides){if(c.nimmAufBand(t,'eisen',richtung)){accepted.push(side);c.omniSchritt(t,1);break;}}
  assert.deepEqual(accepted,['links','hinten','rechts','links','hinten','rechts','links','hinten','rechts']);
  t.vorrang='rechts';assert.equal(c.nimmAufBand(t,'eisen',1),false);assert.equal(c.nimmAufBand(t,'eisen',3),true);
});
check('Zusammenführungen besitzen echten Puffer25 und migrieren Spurware nur einmal',()=>{
  const c=world();const t=c.setzeBandteil('zusammen',3,3,0,{id:'alt',items:[{item:'eisen',pos:1,defekt:true},{item:'kupfer',pos:0.5}],puffer:['eisen']});
  assert.equal(t.items.length,0);assert.equal(c.bandInventar(t).anzahl,3);assert.equal(c.pufferWare(t,1).defekt,true);
  const wieder=c.setzeBandteil('zusammen',4,4,0,c.bandteilDaten(t));assert.equal(c.bandInventar(wieder).anzahl,3);
  wieder.ziel=dest(c);for(let i=0;i<22;i++)assert.equal(c.nimmAufBand(wieder,'eisen',0),true);
  assert.equal(c.nimmAufBand(wieder,'eisen',0),false);assert.equal(c.bandInventar(wieder).anzahl,25);
  c.omniSchritt(wieder,1);assert.equal(c.bandInventar(wieder).anzahl,24);assert.equal(wieder.ziel.g.bestand.eisen,1);
  const smart=band(c,'smartP','smartZusammen',{ziel:dest(c)});assert.equal(c.nimmAufBand(smart,'eisen',0),true);assert.equal(smart.puffer.length,1);
  smart.ziel.g.gesperrt=true;c.omniSchritt(smart,1);assert.equal(smart.puffer.length,1);assert.equal(smart.gehalten,true);smart.ziel.g.gesperrt=false;c.omniSchritt(smart,1);assert.equal(smart.puffer.length,0);assert.equal(smart.gehalten,false);
});
check('Omni behält vier Eingänge und respektiert Filter, Sperren und Vorrang',()=>{
  const c=world(),t=band(c,'omniF','omniMerger');
  assert.equal(c.nimmtVonSeite(t,2,0),true);assert.equal(c.nimmAufBand(t,'eisen',2),true);
  t.seiten.vorn={gesperrt:true,filter:{}};assert.equal(c.nimmAufBand(t,'eisen',2),false);
  t.seiten.vorn={gesperrt:false,filter:{eisen:false}};assert.equal(c.nimmAufBand(t,'eisen',2),false);
  t.seiten={};t.vorrang='vorn';t.vorgaenger=[{teil:band(c,'prior','band',{items:[{item:'eisen',pos:1}]}),richtung:2}];
  assert.equal(c.nimmAufBand(t,'eisen',0),false);assert.equal(c.nimmAufBand(t,'eisen',2),true);
});
check('Vorgelagerte Filter verwenden den richtigen Verteiler-Ausgang',()=>{
  const c=world(),lager={id:'quelle',art:'lager',bestand:{eisen:5,kupfer:2,holz:0},reserviert:{kupfer:2}};c.spiel.gebaeude.set(lager.id,lager);
  const src=band(c,'src','band',{ablaufVon:lager.id});const split=band(c,'split','splitter',{vorgaenger:[{teil:src,richtung:0}],seiten:{links:{filter:{eisen:true},gesperrt:false}}});
  const left=band(c,'left','band',{vorgaenger:[{teil:split,richtung:3}]});const front=band(c,'front','band',{vorgaenger:[{teil:split,richtung:0}]});
  split.ausgaenge=[{seite:'links',richtung:3,ziel:{art:'band',teil:left}},{seite:'vorn',richtung:0,ziel:{art:'band',teil:front}}];
  assert.deepEqual(Array.from(c.bandQuellItems(left)),['eisen']);assert.deepEqual(Array.from(c.bandQuellItems(front)),[]);
});
check('Untergrundquellen und zyklische Topologie terminieren mit passenden Kandidaten',()=>{
  const c=world(),q={id:'q',art:'station',bestand:{},rezeptDaten:{ausgabe:'kupfer'}};c.spiel.gebaeude.set(q.id,q);
  const input=band(c,'in','untergrundEin',{x:1,z:1,ablaufVon:q.id});const output=band(c,'out','untergrundAus',{x:1,z:4});
  const z=c.zielVon(input);assert.equal(z.teil,output);output.vorgaenger=[{teil:input,richtung:0}];
  const ring=band(c,'r','band',{vorgaenger:[{teil:output,richtung:0}]});output.vorgaenger.push({teil:ring,richtung:0});
  assert.deepEqual(Array.from(c.bandQuellItems(ring)),['kupfer']);
});
check('500 rückwärts angeordnete Bandteile propagieren Quellen ohne Vollgraph-Runden',()=>{
  const c=world(),teile=Array.from({length:500},(_,i)=>band(c,'lang'+i));
  const q={id:'langQuelle',art:'lager',bestand:{eisen:4}};c.spiel.gebaeude.set(q.id,q);teile[0].ablaufVon=q.id;
  for(let i=1;i<teile.length;i++)teile[i].vorgaenger=[{teil:teile[i-1],richtung:0}];
  c.spiel.baender=new Map([...c.spiel.baender].reverse());
  assert.deepEqual(Array.from(c.bandQuellItems(teile.at(-1))),['eisen']);
  teile[0].vorgaenger=[{teil:teile.at(-1),richtung:0}];
  assert.deepEqual(Array.from(c.bandQuellItems(teile.at(-1))),['eisen']);
});
check('Smart berücksichtigt bereits reservierten Zielplatz und seine eigenen Wartestücke',()=>{
  const c=world(),ziel=dest(c,{kapazitaet:1}),t=band(c,'smartReserved','smartZusammen',{ziel});
  c.reservierungen=()=>({rein:new Map([['g',{kupfer:1}]]),raus:new Map()});assert.equal(c.nimmAufBand(t,'eisen',0),false);
  c.reservierungen=()=>({rein:new Map(),raus:new Map()});assert.equal(c.nimmAufBand(t,'eisen',0),true);assert.equal(c.nimmAufBand(t,'eisen',0),false);
});
check('Eigener Filter bleibt bearbeitbar; Seiten zeigen jeweils nur ihre Quellen',()=>{
  const c=world(),a=band(c,'a','band',{items:[{item:'eisen',pos:1}]}),b=band(c,'b','band',{items:[{item:'kupfer',pos:1}]});
  const s=band(c,'s','smartZusammen',{vorgaenger:[{teil:a,richtung:1},{teil:b,richtung:3}],seiten:{links:{gesperrt:true,filter:{eisen:false}}}});
  assert.deepEqual(Array.from(c.bandQuellItems(s,'links')),['eisen']);assert.deepEqual(Array.from(c.bandQuellItems(s,'rechts')),['kupfer']);
});
check('QA-/Defektflags überleben Spur, Verteiler, Omni, Arm und Speichern/Laden',()=>{
  const c=world(),a=band(c,'a'),s=band(c,'s','splitter'),b=band(c,'b');
  a.ziel={art:'band',teil:s};s.ausgaenge=[{seite:'vorn',richtung:0,ziel:{art:'band',teil:b}}];s.naechster=0;
  const it={item:'eisen',pos:1,geprueft:true,defekt:true};a.items=[it];assert.equal(c.gibWeiter(a,it),true);a.items.shift();
  c.verteilerSchritt(s,1);assert.equal(b.items[0].geprueft,true);assert.equal(b.items[0].defekt,true);
  const saved=c.bandteilDaten(b),restored=c.setzeBandteil('band',8,8,0,saved);assert.equal(restored.items[0].defekt,true);
  const omni=band(c,'omni','omniMerger',{ziel:{art:'band',teil:band(c,'out')}});c.legeInPuffer(omni,'kupfer',it);c.omniSchritt(omni,1);assert.equal(omni.ziel.teil.items[0].defekt,true);
  const arm=band(c,'arm','greifGeber',{quelle:{art:'band',teil:restored},ziel:{art:'band',teil:band(c,'armOut')}});restored.items[0].pos=1;
  arm.haelt=c.armGreife(arm);assert.equal(arm.haeltFlags.geprueft,true);const armSaved=c.bandteilDaten(arm);assert.equal(armSaved.haeltFlags.defekt,true);
  assert.equal(c.armLegeAb(arm,arm.haelt),true);assert.equal(arm.ziel.teil.items[0].defekt,true);
  assert.equal(c.bandInventar(a).anzahl+c.bandInventar(s).anzahl+c.bandInventar(b).anzahl,1);
});
check('Löschen entfernt exakt angeforderte echte Ware und synchronisiert Flags',()=>{
  const c=world(),t=band(c,'del','splitter',{items:[{item:'eisen'}],puffer:['eisen','kupfer','eisen'],pufferFlags:[{defekt:true},{geprueft:true},{}],haelt:'eisen',haeltFlags:{defekt:true}});
  assert.equal(c.loescheBandInventar('del','eisen',2).menge,2);assert.equal(c.bandInventar(t).anzahl,3);assert.equal(t.pufferFlags.length,t.puffer.length);
  assert.equal(c.loescheBandInventar('del','eisen',99).menge,2);assert.equal(c.bandInventar(t).anzahl,1);assert.equal(t.haelt,null);assert.equal(c.spiel.statistik.ausschuss,4);
  assert.equal(c.loescheBandInventar('del','kupfer',-1).ok,false);assert.equal(c.loescheBandInventar('del','kupfer',1.5).ok,false);
});
console.log(JSON.stringify({source:sourcePath,browserVerification:'ausstehend',results},null,2));
