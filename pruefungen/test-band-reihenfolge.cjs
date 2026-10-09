const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const target = process.argv[2] || path.join(__dirname, 'band-reihenfolge.html');
const source = fs.readFileSync(target, 'utf8'), results = [];
const helpers = ['normalisiereBandInventarReihenfolge','bandInventarItems','ordneBandInventar','verschiebeBandInventar','verschiebeBandInventarSchritt'];
// Die bestehenden Transport-Proben liefern Welt/Transportadapter, keine kopierte Implementierung.
let harness = fs.readFileSync(path.join(__dirname,'logik-regressionen.cjs'),'utf8').split("check('Syntax aller Inline-Skripte'")[0];
const box = { require, __dirname, process: {argv:['node','test',target]} };
vm.runInNewContext(harness+'\nthis.world=world;this.band=band;this.dest=dest;',box);
const world = box.world, band = box.band, dest = box.dest;
const plain = v => JSON.parse(JSON.stringify(v));
function check(name, fn) { fn(); results.push({name,status:'bestanden'}); }
function cargo(t) {return [...t.items||[], ...(t.puffer||[]).map((item,i)=>({item,...t.pufferFlags?.[i]})), ...(t.haelt?[{item:t.haelt,...t.haeltFlags}]:[]), ...t.reserve||[]];}
function signature(t) {return cargo(t).map(w=>JSON.stringify({item:w.item,...(w.geprueft!==undefined?{geprueft:w.geprueft}:{}),...(w.defekt!==undefined?{defekt:w.defekt}:{})})).sort();}
check('Vollständige Inline-Skripte sind syntaktisch gültig',()=>{
 for(const m of source.replace(/<!--[^]*?-->/g,'').matchAll(/<script\b([^>]*)>([^]*?)<\/script>/gi)) {
  if(/\bsrc\s*=/.test(m[1])||!m[2].trim())continue;
  if(/importmap/.test(m[1]))JSON.parse(m[2]);else new vm.Script(m[2].replace(/^import .*;$/gm,''));
 }
});
check('Ohne bewusste Sortierung bleiben Spur, Reserve und Alt-Puffer FIFO',()=>{
 const c=world();for(const typ of ['band','splitter','zusammen','smartZusammen','omniMerger','greifarm','greifGeber']) {
  const t=band(c,typ,typ,{items:typ==='band'?[{item:'kupfer',pos:1},{item:'eisen',pos:.5}]:[],puffer:['kupfer','eisen'],reserve:[{item:'kupfer'},{item:'eisen'}],haelt:typ.startsWith('greif')?'kupfer':null});
  const before=JSON.stringify(t);c.ordneBandInventar(t);assert.equal(JSON.stringify(t),before);
 }
});
check('Sortierung priorisiert alle 25 Waren vor der Reserve und bewahrt Abstände / Kennzeichen',()=>{
 const c=world(),t=band(c,'b','band',{items:[{item:'kupfer',pos:1,von:2,geprueft:true,defekt:false},{item:'eisen',pos:.5,von:1,defekt:true}],reserve:Array.from({length:23},(_,i)=>({item:i%2?'kupfer':'eisen',pos:i%2?.5:0,geprueft:i%3===0,defekt:i%4===0}))});
 const before=signature(t),positions=t.items.map(w=>[w.pos,w.von]);
 assert.equal(c.verschiebeBandInventar('b','eisen','kupfer'),true);
 assert.deepEqual(signature(t),before);assert.deepEqual(t.items.map(w=>[w.pos,w.von]),positions);assert.equal(t.items[0].item,'eisen');
 assert.equal(c.bandInventar(t).anzahl,25);assert.equal(c.nimmAufBand(t,'eisen',0),false);
 const ids=cargo(t).map(w=>w.item);assert.equal(ids.lastIndexOf('eisen') < ids.indexOf('kupfer'),true);
});
check('Neue priorisierte Waren überholen in vorhandenen Slots ohne zusätzlichen Segmenttakt',()=>{
 const c=world(),t=band(c,'b','band',{items:[{item:'kupfer',pos:1},{item:'kupfer',pos:.5},{item:'kupfer',pos:0}],inventarReihenfolge:['eisen','kupfer']});
 let takte=0;c.verbraucheTakt=()=>takte++;
 assert.equal(c.nimmAufBand(t,'eisen',2,null,{defekt:true}),true);assert.equal(takte,1);assert.equal(t.items[0].item,'eisen');assert.equal(t.items[0].defekt,true);
 assert.deepEqual(t.items.map(w=>w.pos),[1,.5,0]);assert.equal(c.bandInventar(t).anzahl,4);
});
check('Alle Knotentypen sortieren Puffer + parallele Flags; Ausgabetakt bleibt gleich',()=>{
 for(const typ of ['splitter','smartVerteiler','ventil','zusammen','smartZusammen','omniMerger']) {
  const c=world(),t=band(c,'b',typ,{puffer:['kupfer','eisen','kupfer'],pufferFlags:[{geprueft:true},{defekt:true},{defekt:false}],takt:.75});
  const before=signature(t);assert.equal(c.verschiebeBandInventar('b','eisen','kupfer'),true);
  assert.deepEqual(signature(t),before);assert.deepEqual(plain(t.puffer),['eisen','kupfer','kupfer']);assert.equal(t.pufferFlags[0].defekt,true);assert.equal(t.takt,.75);
  c.legeInPuffer(t,'eisen',{geprueft:true});assert.deepEqual(plain(t.puffer),['eisen','eisen','kupfer','kupfer']);assert.equal(t.pufferFlags[1].geprueft,true);
 }
});
check('Merger gibt oberste Ware wirklich ab und überträgt Kennzeichen',()=>{
 const c=world(),ziel=band(c,'z','band'),t=band(c,'b','zusammen',{puffer:['kupfer','eisen','eisen'],pufferFlags:[{}, {defekt:true},{geprueft:true}],ziel:{art:'band',teil:ziel},takt:1});
 c.verschiebeBandInventar('b','eisen','kupfer');c.omniSchritt(t,0);assert.equal(ziel.items[0].item,'eisen');assert.equal(ziel.items[0].defekt,true);assert.deepEqual(plain(t.puffer),['eisen','kupfer']);assert.equal(t.takt,0);
});
check('Beide Greifer sortieren Hand + Reserve gemeinsam, ohne Kennzeichenverlust oder Zyklusüberspringen',()=>{
 for(const typ of ['greifarm','greifGeber']) {
  const c=world(),t=band(c,'b',typ,{haelt:'kupfer',haeltFlags:{geprueft:true},timer:1.1,winkel:3,wartet:7,reserve:Array.from({length:24},(_,i)=>({item:i%2?'kupfer':'eisen',defekt:i===0}))});
  const before=signature(t);assert.equal(c.verschiebeBandInventar('b','eisen','kupfer'),true);
  assert.deepEqual(signature(t),before);assert.equal(t.haelt,'eisen');assert.equal(t.haeltFlags.defekt,true);assert.equal(t.timer,0);assert.equal(t.winkel,0);assert.equal(c.bandInventar(t).anzahl,25);
  t.timer=.7;t.winkel=1.5;c.ordneBandInventar(t);assert.equal(t.timer,.7);assert.equal(t.winkel,1.5);
  assert.equal(c.nimmAufBand(t,'eisen',0),false);
 }
});
check('Greifer gibt priorisierte Hand erst nach vollständigem neuen Schwenkzyklus ab',()=>{
 const c=world(),z=dest(c),t=band(c,'b','greifGeber',{haelt:'kupfer',haeltFlags:{},timer:1.1,reserve:[{item:'eisen',geprueft:true}],ziel:z});
 c.verschiebeBandInventar('b','eisen','kupfer');c.greifarmSchritt(t,.2);assert.equal(z.g.bestand.eisen||0,0);c.greifarmSchritt(t,1);assert.equal(z.g.bestand.eisen,1);assert.equal(t.haelt,null);assert.equal(t.reserve[0].item,'kupfer');
});
check('Spurtypvarianten behalten Position, Einfallsrichtung und Warenmenge',()=>{
 for(const typ of ['band','pruefband','aussweiche','untergrundEin','untergrundAus']) {
  const c=world(),t=band(c,'b',typ,{items:[{item:'kupfer',pos:.9,von:1},{item:'eisen',pos:.4,von:2}],reserve:[{item:'kupfer',pos:0}],inventarReihenfolge:[]});
  c.verschiebeBandInventar('b','eisen','kupfer');assert.deepEqual(t.items.map(w=>[w.pos,w.von]),[[.9,1],[.4,2]]);assert.equal(t.items[0].item,'eisen');assert.equal(c.bandInventar(t).anzahl,3);
 }
});
check('Save/Load erhalten Rang, vollständige Waren und unabhängige Reihenfolgearrays',()=>{
 for(const typ of ['band','splitter','zusammen','smartZusammen','omniMerger','greifarm','greifGeber']) {
  const c=world(),t=band(c,'b',typ,{items:typ==='band'?[{item:'kupfer',pos:1,geprueft:true},{item:'eisen',pos:.5,defekt:true}]:[],puffer:!typ.startsWith('greif')&&typ!=='band'?['kupfer','eisen']:[],pufferFlags:[{}, {defekt:true}],haelt:typ.startsWith('greif')?'kupfer':null,haeltFlags:{defekt:true},reserve:[{item:'eisen',defekt:false}]});
  c.verschiebeBandInventar('b','eisen','kupfer');const saved=c.bandteilDaten(t),before=signature(t),loaded=c.setzeBandteil(typ,3,3,0,saved);
  assert.deepEqual(signature(loaded),before);assert.deepEqual(plain(loaded.inventarReihenfolge),['eisen','kupfer']);saved.inventarReihenfolge.push('test');assert.equal(loaded.inventarReihenfolge.includes('test'),false);
 }
});
check('Alte 30er-Puffer bleiben beim Sortieren und Laden verlustfrei',()=>{
 const c=world(),t=c.setzeBandteil('splitter',1,1,0,{id:'b',puffer:[...Array(29).fill('kupfer'),'eisen']});
 assert.equal(c.verschiebeBandInventar('b','eisen','kupfer'),true);assert.equal(c.bandInventar(t).anzahl,30);assert.equal(t.puffer[0],'eisen');assert.equal(c.legeInPuffer(t,'eisen'),false);
});
check('Löschen nach Sortierung betrifft exakt Waren und zugehörige Kennzeichen',()=>{
 const c=world(),t=band(c,'b','splitter',{puffer:['kupfer','eisen','eisen'],pufferFlags:[{geprueft:true},{defekt:true},{defekt:false}]});
 c.verschiebeBandInventar('b','eisen','kupfer');assert.equal(c.loescheBandInventar('b','eisen',1).menge,1);assert.deepEqual(plain(t.puffer),['eisen','kupfer']);assert.equal(t.pufferFlags[0].defekt,true);assert.equal(t.pufferFlags[1].geprueft,true);
});
check('Noop, fehlende / verschwundene Waren und ungültige Richtung aktivieren keinen Rang',()=>{
 const c=world(),t=band(c,'b','band',{items:[{item:'eisen',pos:1},{item:'kupfer',pos:0}],inventarReihenfolge:[]}),before=JSON.stringify(t);
 for(const args of [['none','eisen','kupfer'],['b','eisen','eisen'],['b','holz','eisen'],['b','eisen','kupfer',false]])assert.equal(c.verschiebeBandInventar(...args),false);
 assert.equal(c.verschiebeBandInventarSchritt('b','eisen',-1),false);assert.equal(c.verschiebeBandInventarSchritt('b','eisen',0),false);assert.equal(JSON.stringify(t),before);
});
check('Sortierpfeile ändern dieselbe Ausgabe und behalten unsichtbare gespeicherte Warenränge',()=>{
 const c=world(),t=band(c,'b','band',{items:[{item:'eisen',pos:1},{item:'kupfer',pos:0}],inventarReihenfolge:['holz','eisen','kupfer']});
 assert.equal(c.verschiebeBandInventarSchritt('b','kupfer',-1),true);assert.deepEqual(plain(t.inventarReihenfolge),['holz','kupfer','eisen']);assert.equal(t.items[0].item,'kupfer');
});
check('Mengenknopf zeigt X, fünf Spalten und Lager-Sortierung bleiben erhalten',()=>{
 const fn=source.match(/^function bandInventarHtml\([^]*?^}/m)[0];assert.match(fn,/Menge bestätigen und löschen">X<\/button>/);assert.doesNotMatch(fn,/\[ENTER\]/);assert.equal((fn.match(/scope="col"/g)||[]).length,5);assert.match(fn,/draggable="true" data-band-sort-griff/);assert.match(source,/function verschiebeLagerAusgabe\(/);assert.match(source,/data-lager-sort-griff=/);
});
check('Drag-Drop validiert ausgewähltes Bauteil, Abbruch und Live-Refresh-Sperre',()=>{
 const listeners={},c=world(),t=band(c,'b','band',{items:[{item:'eisen',pos:1},{item:'kupfer',pos:.5}]}),classes=()=>({add(){},remove(){}});
 const table={dataset:{bandInventarSort:'b'},querySelectorAll:()=>[iron,copper]},other={dataset:{bandInventarSort:'anderes'},querySelectorAll:()=>[]};
 const row=(item,tabelle=table)=>({dataset:{bandInventarItem:item},classList:classes(),getBoundingClientRect:()=>({top:10,height:20}),closest:s=>s==='[data-band-inventar-item]'?null:s==='[data-band-inventar-sort]'?tabelle:null});
 const iron=row('eisen'),copper=row('kupfer');for(const tr of [iron,copper]) { const old=tr.closest;tr.closest=s=>s==='[data-band-inventar-item]'?tr:old(s); }
 const grip=(item,tr)=>({dataset:{bandSortGriff:item},closest:s=>s==='[data-band-sort-griff]'?null:s==='[data-band-inventar-sort]'?table:s==='tr'?tr:null});
 const copperGrip=grip('kupfer',copper);copperGrip.closest=s=>s==='[data-band-sort-griff]'?copperGrip:s==='[data-band-inventar-sort]'?table:s==='tr'?copper:null;
 c.ob={infoInhalt:{querySelectorAll:()=>[iron,copper],addEventListener(type,fn){(listeners[type]??=[]).push(fn);}}};c.auswahlBandId='b';c.zeigeMeldung=()=>{};let drawings=0;c.zeichneBandInfo=()=>drawings++;
 const begin=source.indexOf('// Nur ein echter Griff-Drag'),end=source.indexOf('// Mengen pro Bauteil/Item bleiben',begin);
 vm.runInContext('let bandInventarZiehen = null;\n'+source.slice(begin,end),c);
 const event=target=>({target,clientY:10,dataTransfer:{effectAllowed:'',dropEffect:'',setData(){},getData:()=> 'kupfer'},preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;}});
 const emit=(type,e)=>{for(const fn of listeners[type]||[])fn(e);return e;};
 // Text aus einem fremden Drag reicht nicht aus, um eine Spielmutation auszulösen.
 const initial=JSON.stringify(t);emit('drop',event(iron));assert.equal(JSON.stringify(t),initial);
 // Eigener Griff-Drag, aber Drop in einer anderen Bauteiltabelle: keine Mutation.
 emit('dragstart',event(copperGrip));const fremd=row('eisen',other);fremd.closest=s=>s==='[data-band-inventar-item]'?fremd:s==='[data-band-inventar-sort]'?other:null;emit('drop',event(fremd));assert.equal(JSON.stringify(t),initial);emit('dragend',{});
 // Ein zwischenzeitlicher Auswahlwechsel kann ebenfalls nicht das neue Bauteil verändern.
 emit('dragstart',event(copperGrip));c.auswahlBandId='anderes';emit('drop',event(iron));assert.equal(JSON.stringify(t),initial);emit('dragend',{});c.auswahlBandId='b';
 // Escape und dragend widerrufen die laufende Geste, auch bei späterem Drop.
 emit('dragstart',event(copperGrip));emit('keydown',{key:'Escape',preventDefault(){},stopPropagation(){}});emit('drop',event(iron));assert.equal(JSON.stringify(t),initial);
 emit('dragstart',event(copperGrip));emit('dragend',{});emit('drop',event(iron));assert.equal(JSON.stringify(t),initial);
 // Ein gültiger lokaler Drop verändert reale Warenreihenfolge genau einmal.
 emit('dragstart',event(copperGrip));const over=emit('dragover',event(iron));assert.equal(over.prevented,true);emit('drop',event(iron));assert.equal(t.items[0].item,'kupfer');assert.deepEqual(plain(t.inventarReihenfolge),['kupfer','eisen']);assert.equal(drawings,1);assert.equal(c.bandInventar(t).anzahl,2);
 assert.match(source,/function zeichneBandInfo\(\) \{\s*if \(bandInventarZiehen && bandInventarZiehen.id === auswahlBandId\) return;/);
 assert.match(source,/inventar && !bandInventarZiehen/);assert.match(source,/auswahlBandId !== bandInventarZiehen.id/);assert.match(source,/"dragend", beendeBandInventarZiehen/);assert.match(source,/e.key === "Escape" && bandInventarZiehen/);
 assert.match(source,/function waehleGebaeude\(id\) \{\s*beendeBandInventarZiehen\(\);/);
});
check('Schnappschuss und Kopie tragen Rang mit, keine Waren werden durch Kopie dupliziert',()=>{
 assert.match(source,/baender: \[\.\.\.spiel.baender.values\(\)\].map\(\(t\) => \(\{ \.\.\.bandteilDaten\(t\), items: \[\], reserve: \[\]/);
 assert.match(source,/ablaufFilter: \[\.\.\.\(t.ablaufFilter \|\| \[\]\)\], inventarReihenfolge: normalisiereBandInventarReihenfolge\(t.inventarReihenfolge\)/);
});
fs.writeFileSync(path.join(__dirname,'pruefung-band-reihenfolge.json'),JSON.stringify({date:'2026-10-09',target,results},null,2));
console.log(`${results.length} Prüfungen bestanden`);
