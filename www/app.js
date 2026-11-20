/* Xoriguer Soci — interfície. La lògica de llenguatge és a interpret.js. */
'use strict';
const VERSIO = '1.2.1';
const T_ = (s, v) => (typeof I18N !== 'undefined' ? I18N.t(s, v) : s);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const I = window.Interpret;

const natiu = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const S = natiu ? window.Capacitor.registerPlugin('Soci') : null;

const AJUSTOS_DEF = {
  idioma: '', llengua: 'ca', nom: 'soci', confirma: true, parla: true, velocitat: 1,
  defecte: '09:00', mati: '09:00', tarda: '17:00', vespre: '21:00', avisDefecte: true,
  silenci: true, silenciDe: '23:00', silenciA: '08:00', resum: false, resumHora: '08:30',
  insisteix: false, insisteixMin: 10, calendari: false, senseXarxa: false,
  avisLlocs: true, responVeu: true,
};
let D = { entrades: [], ajustos: { ...AJUSTOS_DEF }, llocs: [] };

// ------------------------------------------------------------------ dades
const LOC = () => ({ ca: 'ca', es: 'es', fr: 'fr', en: 'en-GB' }[I18N.llengua] || 'ca');
const VEU = () => ({ ca: 'ca-ES', es: 'es-ES', fr: 'fr-FR', en: 'en-GB' }[I18N.llengua] || 'ca-ES');
const nouId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const iso = (d) => { d = new Date(d); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const deIso = (s) => (s ? new Date(s) : null);
const D0 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const hm = (s) => { const [h, m] = String(s || '09:00').split(':').map(Number); return { h: h || 0, m: m || 0 }; };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function carrega() {
  let txt = null;
  try { txt = natiu ? (await S.carrega()).dades : localStorage.getItem('soci'); } catch (e) { console.warn(e); }
  if (txt) {
    try {
      const x = JSON.parse(txt);
      D = { entrades: Array.isArray(x.entrades) ? x.entrades : [], ajustos: { ...AJUSTOS_DEF, ...(x.ajustos || {}) }, llocs: Array.isArray(x.llocs) ? x.llocs : [], cotxe: x.cotxe || null };
    } catch (e) { console.warn('dades malmeses', e); }
  }
}

/** Prepara les frases que Android dirà sol (sense la web) i desa. */
async function desa() {
  const L = I18N.llengua;
  for (const e of D.entrades) {
    e.frase = I.fraseAvis(e, L);
    e.frasePrevia = e.abans ? I.frasePrevia(e, L) : '';
    // per als avisos per lloc (Android compara llocClau amb el lloc desat)
    e.llocClau = e.lloc ? I.plana(e.lloc).trim() : '';
    e.llistaOberta = !!(e.lloc && !e.fet && !e.quan && !e.on && ((e.items || []).some((x) => !x.fet) || I.plana(e.text || '') !== e.llocClau));
    e.fraseLloc = e.on || e.llistaOberta ? fraseLloc(e, L) : '';
  }
  for (const l of D.llocs) l.clau = I.plana(l.nom).trim();
  D.ajustos.llengua = L;
  D.ajustos.textos = textosNatius();
  const txt = JSON.stringify(D);
  try { if (natiu) await S.desa({ dades: txt }); else localStorage.setItem('soci', txt); } catch (e) { console.warn(e); toast(T_('No s\'ha pogut desar')); }
  pinta();
}
/** Textos que fa servir Android (notificacions, resum, giny) en l'idioma actual */
function textosNatius() {
  return {
    fet: T_('Fet'), m10: T_('+10 min'), h1: T_('+1 h'), dema: T_('Demà'), canal: T_('Recordatoris'), canalResum: T_('Resum del matí'),
    resumCap: T_('Bon dia! Avui no tens res apuntat.'), resumN: T_('Bon dia! Avui tens {n} coses:'), resum1: T_('Bon dia! Avui tens una cosa:'),
    apunta: T_('Apunta'), res: T_('Res pendent'), previ: T_('Avís previ'),
    respon: T_('Respon'), responAjuda: T_("Digues «fet», «d'aquí 10 minuts» o «demà»."), escoltant: T_("T'escolto…"),
    noEntesResp: T_("No t'he entès. Digues «fet», «d'aquí 10 minuts» o «demà»."), respFet: T_('Fet!'),
    respDema: T_("D'acord, t'ho recordo demà."), respPosposa: T_("D'acord, d'aquí {n} minuts."), tanca: T_('Tanca'),
    crida: T_("M'has cridat? Toca per parlar"), canalEscolta: T_('Escolta «hey soci»'), escoltaNot: T_("Soci t'escolta: digues «hey soci»"),
    escoltaNot2: T_('Sense connexió: res no surt del mòbil.'), atura: T_('Atura'), reactiva: T_('Toca per tornar a activar «hey soci»'),
  };
}
/** Què diu en arribar al lloc (o en sortir-ne): «Ets al Mercadona: comprar llet i ous.» */
function fraseLloc(e, L) {
  const que = I.queText({ ...e, lloc: '' }, L) || I.queText(e, L);
  const ll = I.llocText(e, L) || e.lloc;
  if (e.on && e.on.t === 'sortir') return T_('Abans de marxar {lloc}: {x}.', { lloc: I.llocDe(e, L), x: que });
  return T_('Ets {lloc}: {x}.', { lloc: ll, x: que });
}

// ------------------------------------------------------------------ veu
let escoltant = false;
async function parla(text) {
  if (!text) return;
  try {
    if (natiu) await S.parla({ text, llengua: VEU(), velocitat: +D.ajustos.velocitat || 1 });
    else if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = VEU(); u.rate = +D.ajustos.velocitat || 1;
      speechSynthesis.speak(u);
    }
  } catch (e) { console.warn(e); }
}

function estatMic(s) {
  $('#mic').classList.toggle('escolta', s === 'escolta');
  $('#mic-estat').textContent = { escolta: T_('T\'escolto…'), pensa: T_('Un moment…'), '': T_('Toca i parla') }[s] ?? s;
}

let recWeb = null;
async function escolta() {
  if (escoltant) { atura(); return; }
  ves('inici');
  $('#parcial').textContent = '';
  if (natiu) {
    try {
      const p = await S.permisos();
      if (!p.microfon) { const r = await S.demanaPermis({ quin: 'microfon' }); if (!r.microfon) { toast(T_('Cal el permís del micròfon')); return; } }
      escoltant = true; estatMic('escolta');
      const r = await S.escolta({ llengua: VEU(), offline: !!D.ajustos.senseXarxa });
      escoltant = false; estatMic('');
      if (r && r.text) { $('#parcial').textContent = '«' + r.text + '»'; processa(r.text); }
    } catch (e) {
      escoltant = false; estatMic('');
      const m = String(e && (e.message || e));
      if (/cancel/i.test(m)) return;
      if (/no-match|NO_MATCH|7/.test(m)) toast(T_('No t\'he sentit. Torna-ho a provar.'));
      else if (/idioma|xarxa/.test(m) && D.ajustos.senseXarxa) toast(T_('Per dictar sense connexió cal descarregar l\'idioma a Google (Veu → Idiomes sense connexió).'));
      else toast(T_('No s\'ha pogut escoltar: {e}', { e: m }));
    }
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast(T_('Aquest navegador no pot escoltar: escriu l\'ordre.')); $('#ordre').focus(); return; }
  recWeb = new SR();
  recWeb.lang = VEU(); recWeb.interimResults = true; recWeb.maxAlternatives = 1;
  let final = '';
  recWeb.onresult = (ev) => {
    let t = '';
    for (const r of ev.results) { t += r[0].transcript; if (r.isFinal) final = t; }
    $('#parcial').textContent = t;
  };
  recWeb.onerror = (ev) => { if (ev.error !== 'aborted') toast(T_('No t\'he sentit. Torna-ho a provar.')); };
  recWeb.onend = () => { escoltant = false; estatMic(''); if (final) { $('#parcial').textContent = '«' + final + '»'; processa(final); } };
  escoltant = true; estatMic('escolta');
  recWeb.start();
}
function atura() {
  escoltant = false; estatMic('');
  if (natiu) S.atura().catch(() => {}); else if (recWeb) recWeb.stop();
}

// ------------------------------------------------------------------ ordres
function opcions() {
  const a = D.ajustos;
  return {
    L: I18N.llengua, nom: a.nom || 'soci', avisDefecte: a.avisDefecte,
    llocs: [...new Set([...D.llocs.map((l) => l.nom), ...D.entrades.map((e) => e.lloc)].filter(Boolean))],
    hores: { defecte: hm(a.defecte).h + hm(a.defecte).m / 60, mati: hm(a.mati).h, tarda: hm(a.tarda).h, vespre: hm(a.vespre).h },
  };
}

let darrera = null; // per desfer
function processa(text) {
  text = String(text || '').trim();
  if (!text) return;
  const r = I.analitza(text, opcions());
  // hora per defecte amb minuts (p. ex. 08:30)
  if (r.quan && !r.horaExplicita && !r.rep) {
    const { h, m } = hm(D.ajustos.defecte);
    if (r.quan.getHours() === h && r.quan.getMinutes() === 0) r.quan.setMinutes(m);
  }
  if (r.tipus === 'pregunta') return respon(r);
  if (r.tipus === 'accio') return accio(r, text);
  if (r.tipus === 'lloc') return desaLloc(r.nom, text);
  if (r.tipus === 'aparca') return aparca(r.nota, text);
  if (r.tipus === 'onCotxe') return onCotxe(text);
  afegeix(r, text);
}

/** Diu i ensenya la resposta d'una ordre. */
function contesta(ico, msg, text, id) {
  mostraResposta(ico, msg, text, id);
  if (D.ajustos.confirma) parla(msg);
}

/** Apunta una cosa nova (o l'afegeix a la llista oberta del mateix lloc). */
function afegeix(r, text) {
  if (r.tipus === 'buit') {
    mostraResposta('🤔', T_('No t\'he entès. Prova: «apunta dijous comprar patates al Macro, avisa\'m».'), text);
    parla(T_('No t\'he entès.'));
    return;
  }
  // «apunta al Macro llet»: si ja hi ha una cosa pendent al mateix lloc sense data nova, s'hi afegeix
  const curt = r.text && r.text.split(/\s+/).length <= 4;
  if (!r.quan && r.lloc && (r.items.length || r.esLlista || curt)) {
    const ja = D.entrades.find((e) => !e.fet && !e.rep && e.lloc && I.plana(e.lloc) === I.plana(r.lloc) && ((e.items || []).length || r.items.length || r.esLlista));
    if (ja) {
      const nous = r.items.length ? r.items : [r.text.charAt(0).toLowerCase() + r.text.slice(1)];
      ja.items = ja.items || [];
      for (const n of nous) if (!ja.items.some((x) => I.plana(x.t) === I.plana(n))) ja.items.push({ t: n, fet: false });
      darrera = { tipus: 'afegits', id: ja.id, n: nous.length };
      desa();
      const msg = T_('Afegit a {lloc}: {x}.', { lloc: ja.lloc, x: I.unir(nous, I18N.llengua) });
      mostraResposta('🛒', msg, text, ja.id);
      if (D.ajustos.confirma) parla(msg);
      return;
    }
  }
  const e = {
    id: nouId(), text: r.text, lloc: r.lloc, prep: r.prep, verb: r.verb,
    items: (r.items || []).map((t) => ({ t, fet: false })),
    quan: r.quan ? iso(r.quan) : null, horaExplicita: r.horaExplicita, rep: r.rep, avis: r.avis, abans: r.abans,
    insisteix: !!r.insisteix, on: r.on || null, fet: false, original: text, creat: Date.now(), llengua: I18N.llengua,
  };
  if (!e.text && e.items.length) e.text = e.verb ? cap(e.verb) : T_('Comprar');
  if (!e.text && !e.items.length && e.lloc) e.text = e.lloc;
  D.entrades.push(e);
  darrera = { tipus: 'nova', id: e.id };
  desa();
  let frase = I.fraseConfirma({ ...e, quan: deIso(e.quan) }, I18N.llengua);
  if (e.insisteix) frase += ' ' + T_('Insistiré fins que ho marquis com a fet.');
  if (e.on) frase = fraseConfirmaLloc(e);
  mostraResposta(e.on ? '📍' : e.quan ? (e.avis ? '🔔' : '📅') : '📝', frase + (e.rep ? ' ' + repText(e.rep) + '.' : '') + (e.abans ? ' ' + abansText(e.abans) + '.' : ''), text, e.id);
  if (D.ajustos.confirma) parla(frase);
}
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// ------------------------------------------------------------------ llocs (1.2)
const llocDesat = (nom) => D.llocs.find((l) => I.plana(l.nom).trim() === I.plana(nom || '').trim());
function fraseConfirmaLloc(e) {
  const L = I18N.llengua;
  const que = I.queText({ ...e, lloc: '' }, L);
  let f = e.on.t === 'sortir' ? T_("Apuntat: {x}. T'avisaré quan surtis {lloc}.", { x: que, lloc: I.llocDe(e, L) })
    : T_("Apuntat: {x}. T'avisaré quan arribis {lloc}.", { x: que, lloc: I.llocText(e, L) });
  if (!llocDesat(e.lloc)) f += ' ' + T_('Encara no sé on és {nom}: quan hi siguis, digues «sóc {lloc}».', { nom: e.lloc, lloc: I.llocText(e, L) });
  else if (natiu && !permisos.ubicacioSempre) f += ' ' + T_('Cal permetre la ubicació «sempre» a Ajustos.');
  return f;
}
let permisos = {};
/** On sóc ara (natiu: GPS del mòbil; web: el navegador). */
async function posicioAra() {
  if (natiu) {
    let p = await S.permisos();
    if (!p.ubicacio) { p = await S.demanaPermis({ quin: 'ubicacio' }); if (!p.ubicacio) throw new Error(T_('Cal el permís d\'ubicació')); }
    return S.posicio();
  }
  return new Promise((ok, ko) => {
    if (!navigator.geolocation) { ko(new Error(T_('Aquest navegador no sap on ets.'))); return; }
    navigator.geolocation.getCurrentPosition((x) => ok({ lat: x.coords.latitude, lon: x.coords.longitude, precisio: x.coords.accuracy }),
      () => ko(new Error(T_('Cal el permís d\'ubicació'))), { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 });
  });
}
/** «Sóc al Mercadona»: desa on sóc amb aquest nom (n'hi pot haver més d'un amb el mateix nom). */
async function desaLloc(nom, text) {
  nom = cap(String(nom || '').trim());
  if (!nom) return;
  mostraResposta('📍', T_('Un moment, miro on ets…'), text);
  try {
    const p = await posicioAra();
    const a = D.llocs.find((l) => I.plana(l.nom) === I.plana(nom) && distancia(l, p) < 300);
    if (a) Object.assign(a, { lat: p.lat, lon: p.lon });
    else D.llocs.push({ id: nouId(), nom, lat: p.lat, lon: p.lon, radi: 150, creat: Date.now() });
    await desa();
    const pend = D.entrades.filter((e) => !e.fet && e.lloc && I.plana(e.lloc) === I.plana(nom)).length;
    contesta('📍', T_('Desat: ja sé on és {lloc}.', { lloc: nom }) + (pend > 1 ? ' ' + T_("T'avisaré de les {n} coses d'aquí quan hi tornis.", { n: pend }) : pend ? ' ' + T_("T'avisaré de la cosa d'aquí quan hi tornis.") : ''), text);
    if (natiu && !permisos.ubicacioSempre) toast(T_('Perquè t\'avisi en arribar, permet la ubicació «sempre» a Ajustos.'));
  } catch (e) { contesta('🤷', T_('No he pogut saber on ets: {e}', { e: e.message || e }), text); }
}
/** Distància en metres (aprox.) */
function distancia(a, b) {
  const R = 6371000, r = Math.PI / 180;
  const x = (b.lon - a.lon) * r * Math.cos(((a.lat + b.lat) / 2) * r), y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * R;
}
/** «He aparcat a la planta -2»: desa on és el cotxe (i la nota). */
async function aparca(nota, text) {
  mostraResposta('🚗', T_('Un moment, miro on ets…'), text);
  let p = null;
  try { p = await posicioAra(); } catch (e) { /* sense posició: només la nota */ }
  D.cotxe = { nota: nota || '', lat: p && p.lat, lon: p && p.lon, quan: Date.now() };
  // també com a nota, que surti a «Notes» i a les preguntes
  D.entrades = D.entrades.filter((e) => !e.cotxe);
  D.entrades.push({ id: nouId(), cotxe: true, text: T_('Cotxe') + (nota ? ': ' + nota : ''), lloc: '', items: [], quan: null, avis: false, fet: false, original: text, creat: Date.now() });
  await desa();
  contesta('🚗', T_('Apuntat on has aparcat') + (nota ? ': ' + nota : '') + '.' + (p ? '' : ' ' + T_('(Sense ubicació: no t\'hi podré portar.)')), text);
}
function onCotxe(text) {
  const c = D.cotxe;
  if (!c) { contesta('🤷', T_('No m\'has dit on has aparcat.'), text); return; }
  const fa = Math.round((Date.now() - c.quan) / 60000);
  const quan = fa < 2 ? T_('ara mateix') : fa < 60 ? T_('fa {n} minuts', { n: fa }) : fa < 1440 ? T_('fa {n} hores', { n: Math.round(fa / 60) }) : T_('fa {n} dies', { n: Math.round(fa / 1440) });
  const msg = T_('Has aparcat {quan}', { quan }) + (c.nota ? ': ' + c.nota : '') + '.';
  mostraResposta('🚗', msg, text);
  if (c.lat != null) $('#resposta').insertAdjacentHTML('beforeend', `<div class="botons"><button class="primari" data-mapa="cotxe">${esc(T_('Porta-m\'hi'))}</button></div>`);
  parla(msg);
}
function obreMapa(lat, lon, nom) {
  if (natiu) S.obreMapa({ lat, lon, nom }).catch(() => toast(T_('No hi ha cap app de mapes.')));
  else window.open(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=18/${lat}/${lon}`, '_blank', 'noopener');
}

// ------------------------------------------------------------------ accions per veu (1.1)
/** La darrera cosa apuntada o tocada (per a «esborra-ho», «posposa-ho una hora»...). */
function laDarrera() {
  const d = darrera && (darrera.id || (darrera.e && darrera.e.id));
  return (d && D.entrades.find((e) => e.id === d && !e.fet)) || D.entrades.filter((e) => !e.fet).sort((a, b) => (b.tocat || b.creat) - (a.tocat || a.creat))[0] || null;
}
/** Quina cosa pendent vol dir? Per paraules i lloc; sense res, la darrera. */
function buscaObjectiu(r) {
  if (!r.termes.length && !r.lloc) return laDarrera();
  const arrel = (t) => t.slice(0, Math.max(4, t.length - 2));
  const punts = (e) => {
    const tot = I.plana([e.text, e.lloc, (e.items || []).map((x) => x.t).join(' '), e.original].join(' '));
    let p = 0;
    for (const t of r.termes) if (tot.includes(arrel(t))) p += 1;
    if (r.lloc && (I.plana(e.lloc || '') === I.plana(r.lloc) || tot.includes(I.plana(r.lloc)))) p += 2;
    return p;
  };
  // amb paraules: almenys la meitat; només amb lloc: que hi sigui
  const cal = Math.max(1, r.termes.length ? Math.ceil(r.termes.length / 2) : 2);
  let millor = null, mp = 0;
  for (const e of D.entrades.filter((x) => !x.fet)) {
    const p = punts(e);
    if (p > mp || (p === mp && millor && String(e.quan || '9') < String(millor.quan || '9'))) { mp = p; millor = e; }
  }
  return millor && mp >= cal ? millor : null;
}
function copiaEstat(e) {
  return { fet: e.fet, fetA: e.fetA, quan: e.quan, avis: e.avis, posposa: e.posposa, insistits: e.insistits, sonat: e.sonat, insisteix: e.insisteix,
    horaExplicita: e.horaExplicita, text: e.text, items: JSON.parse(JSON.stringify(e.items || [])) };
}

function accio(r, text) {
  const L = I18N.llengua;
  if (r.accio === 'desfes') {
    if (!darrera) { contesta('🤷', T_('No hi ha res per desfer.'), text); return; }
    desfes(); contesta('↩️', T_('Desfet.'), text); return;
  }
  if (r.accio === 'afegeix') {
    const e = r.lloc ? D.entrades.find((x) => !x.fet && x.lloc && I.plana(x.lloc) === I.plana(r.lloc)) : laDarrera();
    if (!r.items.length) { contesta('🤔', T_('Què hi vols afegir?'), text); return; }
    if (!e) { afegeix(I.analitza(T_('apunta') + ' ' + I.unir(r.items, L), opcions()), text); return; }
    e.items = e.items || [];
    // «comprar llet» + «i també ous» → Comprar: llet, ous
    if (!e.items.length && e.verb && I.plana(e.text).startsWith(I.plana(e.verb) + ' ')) { e.items.push({ t: e.text.slice(e.verb.length).trim(), fet: false }); e.text = cap(e.verb); }
    const nous = r.items.filter((n) => !e.items.some((x) => I.plana(x.t) === I.plana(n)));
    for (const n of nous) e.items.push({ t: n, fet: false });
    e.tocat = Date.now();
    darrera = { tipus: 'afegits', id: e.id, n: nous.length };
    desa();
    contesta('🛒', T_('Afegit a «{x}»: {y}.', { x: cap(I.queText({ ...e, items: [] }, L)), y: I.unir(r.items, L) }), text, e.id);
    return;
  }
  const e = buscaObjectiu(r);
  if (!e) {
    // «canvia l'oli del cotxe dijous», «cancel·la la subscripció el dia 30»: no hi ha res així → és una cosa nova
    if (r.alternativa && r.alternativa.tipus === 'afegeix' && (r.accio === 'esborra' ? r.alternativa.quan : true)) { afegeix(r.alternativa, text); return; }
    contesta('🤷', T_('No he trobat res pendent sobre això.'), text);
    return;
  }
  const nom = cap(I.queText(e, L));
  if (r.accio === 'esborra') {
    darrera = { tipus: 'esborra', e };
    D.entrades = D.entrades.filter((x) => x !== e);
    desa();
    contesta('🗑️', T_('Esborrat: {x}.', { x: nom }), text);
    return;
  }
  if (r.accio === 'fet') {
    // «ja he comprat les patates»: si són articles d'una llista, només aquests
    const arrel = (t) => t.slice(0, Math.max(4, t.length - 2));
    const its = (e.items || []).filter((x) => !x.fet && r.termes.some((t) => I.plana(x.t).includes(arrel(t))));
    if (its.length && its.length < (e.items || []).filter((x) => !x.fet).length) {
      darrera = { tipus: 'fet', id: e.id, abans: copiaEstat(e) };
      its.forEach((x) => { x.fet = true; });
      e.tocat = Date.now();
      desa();
      contesta('✅', T_('Fet: {x}.', { x: I.unir(its.map((x) => x.t), L) }), text, e.id);
      return;
    }
    marcaFet(e.id, true);
    contesta('✅', e.rep ? T_('Fet: {x}. La propera: {q}.', { x: nom, q: I.quanText(deIso(e.quan), L) }) : T_('Fet: {x}.', { x: nom }), text, e.id);
    return;
  }
  if (r.accio === 'mou') {
    const m = r.mou || {};
    const ara = new Date();
    const vell = deIso(e.quan);
    let q = null;
    if (m.exacta) q = new Date(m.exacta);
    else if (m.durada) q = new Date(Math.max(vell ? vell.getTime() : 0, ara.getTime()) + m.durada * 60000);
    else if (m.dia || m.h != null) {
      const base = m.dia ? new Date(m.dia) : (vell ? D0(vell) : D0(ara));
      const hh = m.h != null ? m.h : (vell ? vell.getHours() : hm(D.ajustos.defecte).h);
      const mm = m.h != null ? m.m : (vell ? vell.getMinutes() : hm(D.ajustos.defecte).m);
      q = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hh, mm);
      if (q <= ara && !m.dia) q.setDate(q.getDate() + 1);
      else if (q <= ara && m.dia && D0(q).getTime() === D0(ara).getTime() && r.mou.h == null) q = new Date(ara.getTime() + 3600000);
      else if (q <= ara) q.setDate(q.getDate() + 7);
    }
    if (!q) {
      if (r.alternativa && r.alternativa.tipus === 'afegeix' && r.alternativa.quan) { afegeix(r.alternativa, text); return; }
      contesta('🤔', T_('No he entès quan ho vols.'), text);
      return;
    }
    darrera = { tipus: 'fet', id: e.id, abans: copiaEstat(e) };
    e.quan = iso(q); e.horaExplicita = true; e.posposa = null; e.insistits = 0; e.tocat = Date.now();
    if (!vell) e.avis = D.ajustos.avisDefecte !== false;
    if (r.insisteix) { e.insisteix = true; e.avis = true; }
    desa();
    contesta(e.avis ? '🔔' : '📅', T_('Canviat: {x}, {q}.', { x: nom, q: I.quanText(q, L) }), text, e.id);
  }
}

/** Esdeveniments del calendari del mòbil (Google Calendar...) entre dues dates, com a entrades de només lectura. */
async function delCalendari(de, a) {
  if (!natiu || !D.ajustos.calendari) return [];
  try {
    const r = await S.calendari({ de: de.getTime(), a: a.getTime() });
    return (r.events || []).map((x, i) => ({ id: 'cal-' + i, cal: true, text: x.titol, lloc: '', quan: iso(new Date(x.inici)), totDia: !!x.totDia, items: [] }));
  } catch (e) { return []; }
}

async function respon(r) {
  const ara = new Date();
  if (r.compte) return compteEnrere(r);
  let llista = [];
  const pend = D.entrades.filter((e) => !e.fet);
  if (r.rang) {
    llista = pend.filter((e) => { const q = deIso(e.quan); return q && q >= r.rang.de && q <= r.rang.a; });
    // les que es repeteixen també surten si toquen dins el rang
    for (const e of pend) if (e.rep && e.quan) {
      let q = deIso(e.quan);
      for (let i = 0; i < 400 && q <= r.rang.a; i++) { if (q >= r.rang.de && !llista.includes(e)) { llista.push(e); break; } q = I.seguent(e.rep, q); }
    }
    llista.push(...await delCalendari(r.rang.de, r.rang.a));
  } else if (r.pendents && !r.termes.length && !r.lloc) {
    llista = pend;
  } else {
    const termes = r.termes;
    const punts = (e) => {
      const tot = I.plana([e.text, e.lloc, (e.items || []).map((x) => x.t).join(' '), e.original].join(' '));
      let p = 0;
      for (const t of termes) if (tot.includes(t.slice(0, Math.max(4, t.length - 2)))) p += 1;
      if (r.lloc && e.lloc && I.plana(e.lloc) === I.plana(r.lloc)) p += 2;
      return p;
    };
    llista = D.entrades.filter((e) => !e.fet || !e.quan).map((e) => [punts(e), e]).filter(([p]) => p > 0).sort((a, b) => b[0] - a[0]).map(([, e]) => e);
    const millor = llista.length ? punts(llista[0]) : 0;
    llista = llista.filter((e) => punts(e) >= millor);
  }
  llista.sort((a, b) => String(a.quan || '9').localeCompare(String(b.quan || '9')));
  const L = I18N.llengua;
  let veu, ico = '💬';
  if (!llista.length) {
    veu = r.rang ? T_('No tens res apuntat per aquests dies.') : T_('No he trobat res apuntat sobre això.');
    ico = '🤷';
  } else {
    const parts = llista.slice(0, 6).map((e) => {
      const q = deIso(e.quan);
      const x = cap(I.queText(e, L));
      return (q ? cap(I.quanText(q, L, ara, !e.totDia)) + ': ' : '') + x;
    });
    veu = (llista.length === 1 ? '' : T_('Tens {n} coses.', { n: llista.length }) + ' ') + parts.join('. ') + '.';
  }
  mostraResposta(ico, veu, r.original, null, llista);
  parla(veu);
}

/** «Quants dies falten per les vacances?» */
function compteEnrere(r) {
  const L = I18N.llengua;
  const arrel = (t) => t.slice(0, Math.max(4, t.length - 2));
  const amb = D.entrades.filter((e) => !e.fet && e.quan);
  const punts = (e) => { const tot = I.plana([e.text, e.lloc, e.original].join(' ')); return r.termes.filter((t) => tot.includes(arrel(t))).length + (r.lloc && e.lloc && I.plana(e.lloc) === I.plana(r.lloc) ? 2 : 0); };
  let millor = null, mp = 0;
  for (const e of amb) { const p = punts(e); if (p > mp || (p === mp && p && e.quan < millor.quan)) { mp = p; millor = e; } }
  if (!millor) {
    // «quants dies falten per Nadal?» sense res apuntat: alguns dies coneguts
    const FIXES = { nadal: [11, 25], navidad: [11, 25], noel: [11, 25], christmas: [11, 25], 'sant joan': [5, 24], 'san juan': [5, 24], 'cap d\'any': [11, 31], nochevieja: [11, 31], 'reveillon': [11, 31], 'new year': [0, 1], 'sant jordi': [3, 23], diada: [8, 11] };
    const t = I.plana(r.original);
    const k = Object.keys(FIXES).find((x) => t.includes(x));
    if (!k) { contesta('🤷', T_('No sé de quina data parles. Apunta-la primer: «el 20 de desembre vacances».'), r.original); return; }
    const ara = new Date(); let d = new Date(ara.getFullYear(), FIXES[k][0], FIXES[k][1]);
    if (d < D0(ara)) d = new Date(ara.getFullYear() + 1, FIXES[k][0], FIXES[k][1]);
    millor = { text: cap(k), quan: iso(d), lloc: '', fix: true };
  }
  const q = deIso(millor.quan);
  const dies = Math.round((D0(q) - D0(new Date())) / 86400000);
  const x = millor.fix ? millor.text : cap(I.queText({ ...millor, items: [] }, L));
  const msg = dies <= 0 ? T_('{x} és avui!', { x }) : dies === 1 ? T_('{x} és demà!', { x }) : T_('Falten {n} dies per a {x} ({q}).', { n: dies, x: millor.fix ? x : x.charAt(0).toLowerCase() + x.slice(1), q: I.quanText(q, L, new Date(), false) });
  mostraResposta('⏳', msg, r.original);
  parla(msg);
}

function mostraResposta(ico, text, dit, id, llista) {
  const el = $('#resposta');
  el.hidden = false;
  el.innerHTML = `<div class="r-cap"><div class="r-ico">${ico}</div><div class="r-text"><div>${esc(text)}</div>
    ${dit ? `<div class="r-dit">«${esc(dit)}»</div>` : ''}</div></div>
    ${llista && llista.length ? '<ul class="entrades" style="margin-top:10px">' + llista.slice(0, 20).map(filaEntrada).join('') + '</ul>' : ''}
    ${id ? `<div class="botons"><button data-edita="${id}">${T_('Corregeix')}</button><button class="discret" data-desfes>${T_('Desfés')}</button></div>` : ''}`;
}

function desfes() {
  if (!darrera) return;
  if (darrera.tipus === 'nova') D.entrades = D.entrades.filter((e) => e.id !== darrera.id);
  else if (darrera.tipus === 'afegits') { const e = D.entrades.find((x) => x.id === darrera.id); if (e) e.items.splice(-darrera.n); }
  else if (darrera.tipus === 'esborra') D.entrades.push(darrera.e);
  else if (darrera.tipus === 'fet') { const e = D.entrades.find((x) => x.id === darrera.id); if (e) Object.assign(e, darrera.abans); }
  darrera = null;
  $('#resposta').hidden = true;
  desa();
  toast(T_('Desfet'));
}

// ------------------------------------------------------------------ textos
const DIES_C = () => ({ ca: ['dl', 'dt', 'dc', 'dj', 'dv', 'ds', 'dg'], es: ['L', 'M', 'X', 'J', 'V', 'S', 'D'], fr: ['lu', 'ma', 'me', 'je', 've', 'sa', 'di'], en: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] }[I18N.llengua]);
function repText(rep) {
  if (!rep) return '';
  if (rep.n > 1) {
    const u = { dia: T_('dies'), setmana: T_('setmanes'), mes: T_('mesos'), any: T_('anys') }[rep.t];
    return T_('Cada {n} {u}', { n: rep.n, u });
  }
  if (rep.t === 'mes' && rep.nth) {
    const ord = rep.nth === -1 ? T_("L'últim") : [T_('El primer'), T_('El segon'), T_('El tercer'), T_('El quart')][rep.nth - 1];
    return T_('{o} {d} de cada mes', { o: ord, d: I.TXT[I18N.llengua].dies[rep.dsem - 1] });
  }
  if (rep.t === 'mes' && rep.dia === 31) return T_("L'últim dia de cada mes");
  if (rep.t === 'dia') return T_('Cada dia');
  if (rep.t === 'setmana') {
    const d = rep.dies || [];
    if (d.join() === '1,2,3,4,5') return T_('Entre setmana');
    if (d.join() === '6,7') return T_('Caps de setmana');
    return T_('Cada setmana') + (d.length ? ' (' + d.map((x) => I.TXT[I18N.llengua].dies[x - 1]).join(', ') + ')' : '');
  }
  if (rep.t === 'mes') return rep.dia ? T_('El dia {d} de cada mes', { d: rep.dia }) : T_('Cada mes');
  if (rep.t === 'any') return T_('Cada any');
  return '';
}
function abansText(n) {
  if (!n) return '';
  if (n === 1440) return T_('Avís el dia abans');
  if (n === 10080) return T_('Avís una setmana abans');
  if (n % 1440 === 0) return T_('Avís {n} dies abans', { n: n / 1440 });
  if (n % 60 === 0) return n === 60 ? T_('Avís una hora abans') : T_('Avís {n} hores abans', { n: n / 60 });
  return T_('Avís {n} minuts abans', { n });
}
function horaCurta(d) { return d.toLocaleTimeString(LOC(), { hour: '2-digit', minute: '2-digit' }); }
function quanCurt(e) {
  const q = deIso(e.quan);
  if (!q) return '';
  const ara = new Date();
  const dif = Math.round((D0(q) - D0(ara)) / 86400000);
  let s;
  if (dif === 0) s = T_('avui');
  else if (dif === 1) s = T_('demà');
  else if (dif === -1) s = T_('ahir');
  else if (dif > 1 && dif < 7) s = q.toLocaleDateString(LOC(), { weekday: 'long' });
  else s = q.toLocaleDateString(LOC(), { weekday: 'short', day: 'numeric', month: 'short', year: q.getFullYear() !== ara.getFullYear() ? 'numeric' : undefined });
  return s + ' · ' + horaCurta(q);
}

const ICO_CHECK = '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function filaEntrada(e, opts = {}) {
  const items = (e.items || []);
  const subs = [];
  if (e.cal) {
    const q = deIso(e.quan);
    return `<li class="entrada cal"><span class="check cal" aria-hidden="true">📆</span><div class="cos"><div class="tit">${esc(e.text)}</div>
      <div class="sub">${esc(e.totDia ? q.toLocaleDateString(LOC(), { weekday: 'long', day: 'numeric', month: 'short' }) : quanCurt(e))} · ${esc(T_('Calendari'))}</div></div></li>`;
  }
  if (e.quan && !opts.senseQuan) subs.push(esc(opts.nomesHora ? horaCurta(deIso(e.quan)) : quanCurt(e)));
  if (e.lloc) subs.push(`<span class="xip-lloc">${esc(e.lloc)}</span>`);
  if (e.rep) subs.push('🔁 ' + esc(repText(e.rep)));
  if (e.on) subs.push('📍 ' + esc(e.on.t === 'sortir' ? T_('en sortir de {lloc}', { lloc: e.lloc }) : T_('en arribar a {lloc}', { lloc: e.lloc })) + (llocDesat(e.lloc) ? '' : ' ⚠️'));
  if (e.quan) subs.push(e.avis ? (e.insisteix ? '📣' : '🔔') + (e.abans ? ' ' + esc(abansText(e.abans).toLowerCase()) : '') : '🔕');
  return `<li class="entrada${e.fet ? ' fet' : ''}" data-id="${e.id}">
    <button class="check" data-fet="${e.id}" aria-label="${esc(T_('Fet'))}">${ICO_CHECK}</button>
    <div class="cos" data-edita="${e.id}"><div class="tit">${esc(e.text || e.lloc || '…')}</div>
      ${subs.length ? `<div class="sub">${subs.join(' ')}</div>` : ''}
      ${items.length ? `<ul class="mini-items">${items.map((i) => `<li class="${i.fet ? 'fet' : ''}">${esc(i.t)}</li>`).join('')}</ul>` : ''}
    </div></li>`;
}
function grup(titol, llista, cls = '', opts) {
  if (!llista.length) return '';
  return `<div class="grup ${cls}"><h3>${esc(titol)}</h3><ul class="entrades">${llista.map((e) => filaEntrada(e, opts)).join('')}</ul></div>`;
}

// ------------------------------------------------------------------ pintar
function ordenaQuan(a, b) { return String(a.quan).localeCompare(String(b.quan)); }
function pinta() {
  pintaInici();
  if ($('#v-agenda').classList.contains('activa')) pintaAgenda();
  if ($('#v-llistes').classList.contains('activa')) pintaLlistes();
  if ($('#v-notes').classList.contains('activa')) pintaNotes();
  if ($('#v-ajustos').classList.contains('activa')) pintaFets();
}

function pintaInici() {
  const ara = new Date(), avui = D0(ara);
  const dema = new Date(avui); dema.setDate(dema.getDate() + 1);
  const passat = new Date(avui); passat.setDate(passat.getDate() + 2);
  const set = new Date(avui); set.setDate(set.getDate() + 8);
  const amb = D.entrades.filter((e) => !e.fet && e.quan).sort(ordenaQuan);
  const g = (a, b) => amb.filter((e) => { const q = deIso(e.quan); return q >= a && q < b; });
  const endarrerits = amb.filter((e) => deIso(e.quan) < ara && D0(deIso(e.quan)) < avui);
  const html = grup(T_('Endarrerit'), endarrerits, 'endarrerit')
    + grup(T_('Avui'), g(avui, dema).filter((e) => !endarrerits.includes(e)), '', { nomesHora: true })
    + grup(T_('Demà'), g(dema, passat), '', { nomesHora: true })
    + grup(T_('Aquests dies'), g(passat, set))
    + grup(T_('En arribar a un lloc'), D.entrades.filter((e) => !e.fet && e.on))
    + grup(T_('Sense data'), D.entrades.filter((e) => !e.fet && !e.quan && !e.on).slice(-5).reverse());
  $('#llista-inici').innerHTML = html;
  $('#buit-inici').hidden = !!D.entrades.length;
}

let mesVist = D0(new Date()); mesVist.setDate(1);
let diaSel = D0(new Date());
function ocurrencies(desDe, finsA, ambFets) {
  // [data, entrada] de totes les entrades (amb repeticions) dins l'interval
  const out = [];
  for (const e of D.entrades) {
    if (!e.quan || (e.fet && !ambFets)) continue;
    let q = deIso(e.quan);
    if (!e.rep) { if (q >= desDe && q < finsA) out.push([q, e]); continue; }
    for (let i = 0; i < 400 && q < finsA; i++) { if (q >= desDe) out.push([q, e]); q = I.seguent(e.rep, q); }
  }
  return out.sort((a, b) => a[0] - b[0]);
}
function pintaAgenda() {
  const ambFets = $('#mostra-fets').checked;
  $('#mes-nom').textContent = mesVist.toLocaleDateString(LOC(), { month: 'long', year: 'numeric' });
  const primer = new Date(mesVist);
  const inici = new Date(primer); inici.setDate(1 - (I.diaSet(primer) - 1));
  const fi = new Date(inici); fi.setDate(fi.getDate() + 42);
  const oc = ocurrencies(inici, fi, ambFets);
  const perDia = {};
  for (const [q] of oc) { const k = D0(q).getTime(); perDia[k] = (perDia[k] || 0) + 1; }
  const avui = D0(new Date()).getTime();
  let h = DIES_C().map((d) => `<div class="dc">${d}</div>`).join('');
  for (let i = 0; i < 42; i++) {
    const d = new Date(inici); d.setDate(d.getDate() + i);
    const k = d.getTime();
    const n = Math.min(perDia[k] || 0, 3);
    h += `<button data-dia="${k}" class="${d.getMonth() !== mesVist.getMonth() ? 'fora' : ''}${k === avui ? ' avui' : ''}${k === diaSel.getTime() ? ' sel' : ''}">${d.getDate()}${n ? `<span class="punts-dia">${'<i></i>'.repeat(n)}</span>` : ''}</button>`;
  }
  $('#calendari').innerHTML = h;
  const fiSel = new Date(diaSel); fiSel.setDate(fiSel.getDate() + 1);
  const delDia = ocurrencies(diaSel, fiSel, ambFets).map(([q, e]) => (e.rep ? { ...e, quan: iso(q) } : e));
  const titol = diaSel.toLocaleDateString(LOC(), { weekday: 'long', day: 'numeric', month: 'long' });
  $('#agenda-dia').innerHTML = delDia.length ? grup(titol, delDia, '', { nomesHora: true }) : `<div class="grup"><h3>${esc(titol)}</h3><p class="buit">${esc(T_('Res apuntat aquest dia.'))}</p></div>`;
}

function pintaLlistes() {
  const perLloc = new Map();
  for (const e of D.entrades) {
    if (!e.lloc || (e.fet && !(e.items || []).length)) continue;
    if (e.fet) continue;
    if (!(e.items || []).length && I.plana(e.text || '') === I.plana(e.lloc)) continue; // «dentista» sol: ja surt a l'agenda
    const k = I.plana(e.lloc);
    if (!perLloc.has(k)) perLloc.set(k, { nom: cap(e.lloc), entrades: [] });
    perLloc.get(k).entrades.push(e);
  }
  if (!perLloc.size) { $('#llistes').innerHTML = `<p class="buit">${esc(T_('Encara no hi ha res per comprar ni per fer enlloc.'))}</p>`; return; }
  let h = '';
  for (const { nom, entrades } of perLloc.values()) {
    h += `<div class="targeta llista-lloc"><h2><span>📍 ${esc(nom)}</span><button class="discret petit" data-comparteix="${esc(nom)}" aria-label="${esc(T_('Comparteix'))}">${ICO_COMPARTEIX} ${esc(T_('Comparteix'))}</button></h2><ul class="items">`;
    for (const e of entrades) {
      const items = e.items || [];
      if (items.length) {
        items.forEach((it, i) => {
          h += `<li class="item${it.fet ? ' fet' : ''}"><button class="check" data-item="${e.id}:${i}">${ICO_CHECK}</button><span class="nom">${esc(it.t)}</span>${e.quan ? `<span class="quan">${esc(quanCurt(e))}</span>` : ''}</li>`;
        });
      } else {
        h += `<li class="item"><button class="check" data-fet="${e.id}">${ICO_CHECK}</button><span class="nom" data-edita="${e.id}">${esc(e.text)}</span>${e.quan ? `<span class="quan">${esc(quanCurt(e))}</span>` : ''}</li>`;
      }
    }
    h += `</ul><form class="afegeix-item" data-lloc="${esc(nom)}"><input type="text" placeholder="${esc(T_('Afegeix…'))}"><button class="primari">+</button></form></div>`;
  }
  $('#llistes').innerHTML = h;
}

const ICO_COMPARTEIX = '<svg viewBox="0 0 24 24" width="16" height="16"><circle cx="6" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="6" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="18" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="m8.2 10.9 7.6-3.8M8.2 13.1l7.6 3.8" stroke="currentColor" stroke-width="2"/></svg>';
/** Text d'una llista per enviar-la per WhatsApp, correu... (sense Internet a l'app: l'envia l'app que triïs). */
function textLlista(lloc) {
  const k = I.plana(lloc);
  const linies = [];
  for (const e of D.entrades) {
    if (e.fet || !e.lloc || I.plana(e.lloc) !== k) continue;
    const its = (e.items || []).filter((x) => !x.fet).map((x) => x.t);
    if (its.length) its.forEach((t) => linies.push('• ' + t));
    else if (I.plana(e.text || '') !== k) linies.push('• ' + e.text + (e.quan ? ' (' + quanCurt(e) + ')' : ''));
  }
  return '📍 ' + cap(lloc) + '\n' + linies.join('\n');
}
async function comparteix(text, titol) {
  try {
    if (natiu) { await S.comparteix({ text, titol }); return; }
    if (navigator.share) { await navigator.share({ title: titol, text }); return; }
    await navigator.clipboard.writeText(text);
    toast(T_('Copiat: enganxa-ho on vulguis.'));
  } catch (e) { if (!/abort|cancel/i.test(String(e && (e.name || e.message)))) toast(String(e.message || e)); }
}

function pintaNotes() {
  const q = I.plana($('#cerca').value.trim());
  let l = D.entrades.filter((e) => (q ? true : !e.quan));
  if (q) l = l.filter((e) => I.plana([e.text, e.lloc, (e.items || []).map((x) => x.t).join(' '), e.original].join(' ')).includes(q));
  l.sort((a, b) => b.creat - a.creat);
  $('#notes').innerHTML = l.length ? `<ul class="entrades">${l.map((e) => filaEntrada(e)).join('')}</ul>`
    : `<p class="buit">${esc(q ? T_('No hi ha res que hi coincideixi.') : T_('Les coses que apuntes sense data surten aquí. Prova: «apunta el codi de la porta és 4521».'))}</p>`;
}

function pintaFets() {
  const n = D.entrades.filter((e) => e.fet).length;
  $('#fets-info').textContent = n ? T_('Tens {n} coses marcades com a fetes.', { n }) : T_('No n\'hi ha cap.');
  $('#b-esborra-fets').hidden = !n;
}

// ------------------------------------------------------------------ accions
function marcaFet(id, callat) {
  const e = D.entrades.find((x) => x.id === id);
  if (!e) return;
  darrera = { tipus: 'fet', id, abans: copiaEstat(e) };
  e.posposa = null; e.insistits = 0; e.tocat = Date.now();
  if (e.rep && e.quan && !e.fet) {
    // la propera vegada; si acaba de sonar, Android ja l'ha avançada (e.sonat) i no se n'ha de saltar cap
    const jaAvancada = e.sonat && Date.now() - e.sonat < 20 * 3600000;
    let q = deIso(e.quan);
    if (!jaAvancada) q = I.seguent(e.rep, q);
    while (q < new Date()) q = I.seguent(e.rep, q);
    e.quan = iso(q); e.sonat = 0;
    if (!callat) toast(T_('Fet. La propera: {q}', { q: quanCurt(e) }), true);
  } else {
    e.fet = !e.fet; e.fetA = e.fet ? Date.now() : null;
    if (e.fet && navigator.vibrate) navigator.vibrate(20);
    if (e.fet && !callat) toast(T_('Fet!'), true);
  }
  desa();
}
function marcaItem(id, i) {
  const e = D.entrades.find((x) => x.id === id);
  if (!e || !e.items[i]) return;
  e.items[i].fet = !e.items[i].fet;
  if (e.items.every((x) => x.fet)) { e.fet = true; e.fetA = Date.now(); toast(T_('Llista acabada!')); }
  desa();
}

// ------------------------------------------------------------------ editor
let editant = null;
function obreEditor(id) {
  const e = id ? D.entrades.find((x) => x.id === id) : null;
  if (id && !e) return;
  editant = e || { id: nouId(), text: '', lloc: '', items: [], quan: null, avis: D.ajustos.avisDefecte, abans: 0, rep: null, fet: false, original: '', creat: Date.now() };
  const x = editant;
  $('#ed-titol').textContent = e ? T_('Edita') : T_('Nou');
  $('#ed-text').value = x.text || '';
  $('#ed-lloc').value = x.lloc || '';
  $('#ed-items').value = (x.items || []).map((i) => i.t).join('\n');
  const q = deIso(x.quan);
  $('#ed-te-data').checked = !!q;
  const def = new Date(); def.setDate(def.getDate() + 1);
  const d = q || def;
  $('#ed-dia').value = iso(d).slice(0, 10);
  $('#ed-hora').value = q ? iso(q).slice(11) : D.ajustos.defecte;
  $('#ed-rep').value = x.rep ? x.rep.t : '';
  pintaDiesEditor(x.rep && x.rep.dies ? x.rep.dies : [I.diaSet(d)]);
  $('#ed-avis').checked = !!x.avis;
  $('#ed-insisteix').checked = !!x.insisteix;
  $('#ed-abans').value = String(x.abans || 0);
  if (![...$('#ed-abans').options].some((o) => o.value === String(x.abans || 0))) $('#ed-abans').add(new Option(abansText(x.abans), String(x.abans)));
  $('#ed-original-bloc').hidden = !x.original;
  $('#ed-original').textContent = x.original || '';
  $('#ed-esborra').hidden = !e;
  $('#llocs-coneguts').innerHTML = [...new Set(D.entrades.map((y) => y.lloc).filter(Boolean))].map((l) => `<option value="${esc(l)}">`).join('');
  actualitzaEditor();
  $('#editor').showModal();
}
function pintaDiesEditor(sel) {
  $('#ed-dies').innerHTML = I.TXT[I18N.llengua].dies.map((n, i) => `<button type="button" class="xip${sel.includes(i + 1) ? ' on' : ''}" data-ddia="${i + 1}">${esc(n.slice(0, 3))}</button>`).join('');
}
function actualitzaEditor() {
  $('#ed-data-bloc').hidden = !$('#ed-te-data').checked;
  $('#ed-dies').hidden = $('#ed-rep').value !== 'setmana';
}
function desaEditor() {
  const x = editant;
  x.text = $('#ed-text').value.trim();
  x.lloc = $('#ed-lloc').value.trim();
  const vells = x.items || [];
  x.items = $('#ed-items').value.split('\n').map((s) => s.trim()).filter(Boolean).map((t) => ({ t, fet: !!(vells.find((v) => v.t === t) || {}).fet }));
  if (x.lloc && x.prep && !I.plana(x.lloc).length) x.prep = '';
  if ($('#ed-te-data').checked) {
    const q = new Date($('#ed-dia').value + 'T' + ($('#ed-hora').value || D.ajustos.defecte));
    x.quan = isNaN(q) ? null : iso(q);
    x.horaExplicita = true;
    const t = $('#ed-rep').value;
    x.rep = t ? { t } : null;
    if (t === 'setmana') x.rep.dies = $$('#ed-dies .xip.on').map((b) => +b.dataset.ddia).sort();
    if (t === 'setmana' && !x.rep.dies.length) x.rep.dies = [I.diaSet(q)];
    if (t === 'mes') x.rep.dia = q.getDate();
    x.avis = $('#ed-avis').checked;
    x.abans = x.avis ? +$('#ed-abans').value : 0;
    x.insisteix = x.avis && $('#ed-insisteix').checked;
  } else { x.quan = null; x.rep = null; x.avis = false; x.abans = 0; x.insisteix = false; }
  x.insistits = 0; x.tocat = Date.now();
  if (!x.text && !x.items.length && !x.lloc) return;
  if (!x.text) x.text = x.items.length ? T_('Comprar') : x.lloc;
  // si el lloc ha canviat, la preposició dita ja no val
  if (x._llocVell !== undefined && x._llocVell !== x.lloc) x.prep = '';
  if (!D.entrades.includes(x)) D.entrades.push(x);
  x.posposa = null;
  desa();
}

// ------------------------------------------------------------------ navegació
function ves(v) {
  $$('.vista').forEach((s) => s.classList.toggle('activa', s.id === 'v-' + v));
  $$('.barra button').forEach((b) => b.classList.toggle('activa', b.dataset.ves === v));
  if (v === 'agenda') pintaAgenda();
  if (v === 'llistes') pintaLlistes();
  if (v === 'notes') pintaNotes();
  if (v === 'ajustos') { pintaAjustos(); pintaFets(); pintaLlocs(); revisaPermisos(); }
  if (v === 'inici') pintaInici();
  window.scrollTo(0, 0);
}

let tToast;
function toast(msg, ambDesfer) {
  const t = $('#avis-toast');
  t.innerHTML = `<span>${esc(msg)}</span>${ambDesfer ? `<button data-desfes>${esc(T_('Desfés'))}</button>` : ''}`;
  t.hidden = false;
  clearTimeout(tToast);
  tToast = setTimeout(() => { t.hidden = true; }, ambDesfer ? 5000 : 3000);
}

// ------------------------------------------------------------------ ajustos
const CAMPS = { 'a-nom': 'nom', 'a-velocitat': 'velocitat', 'a-defecte': 'defecte', 'a-mati': 'mati', 'a-tarda': 'tarda', 'a-vespre': 'vespre', 'a-silenci-de': 'silenciDe', 'a-silenci-a': 'silenciA', 'a-resum-hora': 'resumHora', 'a-insisteix-min': 'insisteixMin' };
const INTERR = { 'a-confirma': 'confirma', 'a-parla': 'parla', 'a-avis': 'avisDefecte', 'a-silenci': 'silenci', 'a-resum': 'resum', 'a-insisteix': 'insisteix', 'a-sense-xarxa': 'senseXarxa', 'a-calendari': 'calendari', 'a-avis-llocs': 'avisLlocs', 'a-respon': 'responVeu' };
function pintaAjustos() {
  const a = D.ajustos;
  $('#a-idioma').value = a.idioma || '';
  for (const [id, k] of Object.entries(CAMPS)) $('#' + id).value = a[k];
  for (const [id, k] of Object.entries(INTERR)) $('#' + id).checked = !!a[k];
}
async function revisaPermisos() {
  if (!natiu) return;
  try {
    const p = await S.permisos();
    permisos = p;
    pintaAvancat(p);
    for (const k of ['microfon', 'notificacions', 'alarmes', 'bateria']) {
      const li = $('#p-' + k);
      li.classList.toggle('fet', !!p[k]);
      li.querySelector('.punt').className = 'punt ' + (p[k] ? 'ok' : k === 'bateria' ? 'neutre' : '');
    }
    $('#avis-permisos').hidden = !!(p.microfon && p.notificacions && p.alarmes);
    $('#assistent-estat').textContent = p.assistent ? T_('Soci ja és l\'assistent del mòbil.') : '';
    $('#b-assistent').classList.toggle('primari', !p.assistent);
    if (D.ajustos.calendari && !p.calendari) { D.ajustos.calendari = false; $('#a-calendari').checked = false; desa(); }
  } catch (e) { console.warn(e); }
}

/** Llocs desats (Ajustos → Llocs) */
function pintaLlocs() {
  const ul = $('#llista-llocs');
  if (!ul) return;
  ul.innerHTML = D.llocs.length ? D.llocs.map((l) => {
    const n = D.entrades.filter((e) => !e.fet && e.lloc && I.plana(e.lloc) === I.plana(l.nom)).length;
    return `<li><span class="punt ok"></span><div><b>${esc(l.nom)}</b><small>${n > 1 ? esc(T_('{n} coses pendents', { n })) : n ? esc(T_('Una cosa pendent')) : esc(T_('Res pendent'))}</small></div>
      <button class="discret petit" data-mapa="${l.id}" aria-label="${esc(T_('Mapa'))}">🗺️</button><button class="discret petit" data-treu-lloc="${l.id}" aria-label="${esc(T_('Oblida'))}">✕</button></li>`;
  }).join('') : `<li class="buit">${esc(T_('Encara no has desat cap lloc. Quan siguis al Mercadona, digues «sóc al Mercadona».'))}</li>`;
}
/** Estat de «hey soci», ubicació «sempre», bombolla i pantalla completa */
function pintaAvancat(p) {
  $('#a-hey').checked = !!p.heySoci;
  $('#hey-estat').textContent = p.heySoci ? (p.heySociEnMarxa ? T_('Escoltant ara. Digues «hey soci» i parla.') : T_('S\'activarà quan obris l\'app.')) : '';
  for (const [k, ok] of [['ubicacio-sempre', p.ubicacioSempre], ['superposar', p.superposar], ['pantalla', p.pantalla]]) {
    const li = $('#p-' + k);
    if (!li) continue;
    li.classList.toggle('fet', !!ok);
    li.querySelector('.punt').className = 'punt ' + (ok ? 'ok' : 'neutre');
  }
  $('#avis-google').hidden = p.google !== false;
}

// ------------------------------------------------------------------ còpia
async function exporta() {
  const nom = 'soci-' + iso(new Date()).slice(0, 10) + '.json';
  const txt = JSON.stringify({ app: 'xoriguer-soci', versio: VERSIO, ...D }, null, 1);
  if (natiu) {
    try { const r = await S.exporta({ nom, text: txt }); toast(T_('Desat a {c}', { c: r.cami })); } catch (e) { toast(String(e.message || e)); }
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' }));
  a.download = nom; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
async function importa(f) {
  try {
    const x = JSON.parse(await f.text());
    if (!Array.isArray(x.entrades)) throw new Error('format');
    if (!confirm(T_('Vols substituir el que hi ha ara per la còpia ({n} coses)?', { n: x.entrades.length }))) return;
    D.entrades = x.entrades;
    if (x.ajustos) D.ajustos = { ...AJUSTOS_DEF, ...x.ajustos };
    if (Array.isArray(x.llocs)) D.llocs = x.llocs;
    if (x.cotxe) D.cotxe = x.cotxe;
    await desa();
    aplicaIdioma();
    toast(T_('Còpia recuperada'));
  } catch (e) { toast(T_('Aquest fitxer no és una còpia de Soci')); }
}

// ------------------------------------------------------------------ idioma
function aplicaIdioma() {
  I18N.posa(D.ajustos.idioma);
  try { localStorage.setItem('soci-idioma', D.ajustos.idioma || ''); } catch (e) { /* res */ }
  document.documentElement.lang = I18N.llengua;
  location.reload();
}
function exemples() {
  const E = {
    ca: ["Hey soci, apunta: Macro, comprar patates el dijous, avisa'm", "Recorda'm demà a les 5 trucar al lampista", "Apunta al Mercadona llet, ous i oli", "Cada dilluns a les 8 treure les escombraries", "Dentista el 15 de desembre a les 10, avisa'm el dia abans", "Apunta: el codi de la porta és 4521"],
    es: ['Oye socio, apunta: Macro, comprar patatas el jueves, avísame', 'Recuérdame mañana a las 5 llamar al fontanero', 'Apunta en Mercadona leche, huevos y aceite', 'Cada lunes a las 8 sacar la basura', 'Dentista el 15 de diciembre a las 10, avísame el día antes', 'Apunta: el código de la puerta es 4521'],
    fr: ['Hé soci, note : Macro, acheter des pommes de terre jeudi, préviens-moi', 'Rappelle-moi demain à 17 h d’appeler le plombier', 'Note chez Lidl du lait, des œufs et de l’huile', 'Tous les lundis à 8 h sortir les poubelles', 'Dentiste le 15 décembre à 10 h, préviens-moi la veille', 'Note : le code de la porte est 4521'],
    en: ['Hey soci, note: Macro, buy potatoes on Thursday, remind me', 'Remind me tomorrow at 5pm to call the plumber', 'Add milk, eggs and oil at Mercadona', 'Every Monday at 8am take out the trash', 'Dentist on December 15th at 10am, remind me the day before', 'Note: the door code is 4521'],
  }[I18N.llengua] || [];
  const Q = {
    ca: ['Què tinc demà?', 'Què tinc aquesta setmana?', 'Què havia de comprar al Macro?', 'Quin era el codi de la porta?'],
    es: ['¿Qué tengo mañana?', '¿Qué tengo esta semana?', '¿Qué tenía que comprar en el Macro?', '¿Cuál era el código de la puerta?'],
    fr: ['Qu’est-ce que j’ai demain ?', 'Qu’est-ce que j’ai cette semaine ?', 'Qu’est-ce que je devais acheter chez Macro ?', 'Quel était le code de la porte ?'],
    en: ['What do I have tomorrow?', 'What do I have this week?', 'What did I have to buy at Macro?', 'What was the door code?'],
  }[I18N.llengua] || [];
  const G = {
    ca: ['Fet el del Macro', 'Ja he comprat les patates', 'Mou el dentista a divendres a les 6', 'Posposa-ho una hora', 'Esborra la del lampista', 'I també ous i formatge', 'Desfés', "Recorda'm la pastilla cada dia a les 9 fins que ho faci", "Demà després de dinar trucar a l'Anna"],
    es: ['Hecho lo del Macro', 'Ya he comprado las patatas', 'Mueve el dentista al viernes a las 6', 'Pospónlo una hora', 'Borra lo del fontanero', 'Y también huevos y queso', 'Deshaz', 'Recuérdame la pastilla cada día a las 9 hasta que lo haga', 'Mañana después de comer llamar a Ana'],
    fr: ['C’est fait pour Macro', 'J’ai déjà acheté les pommes de terre', 'Déplace le dentiste à vendredi à 18 h', 'Repousse-le d’une heure', 'Supprime le plombier', 'Ajoute aussi des œufs et du fromage', 'Défais', 'Rappelle-moi le médicament tous les jours à 9 h jusqu’à ce que je le fasse', 'Demain après le déjeuner appeler Anne'],
    en: ['Done with Macro', 'I already bought the potatoes', 'Move the dentist to Friday at 6pm', 'Postpone it an hour', 'Delete the plumber', 'Also eggs and cheese', 'Undo', 'Remind me to take my pill every day at 9am and keep reminding me', 'Tomorrow after lunch call Anna'],
  }[I18N.llengua] || [];
  $('#exemples').innerHTML = [...E.slice(0, 3), G[2], Q[0]].map((x) => `<li data-prova="${esc(x)}">«${esc(x)}»</li>`).join('');
  $('#g-apuntar').innerHTML = E.map((x) => `<li>«${esc(x)}»</li>`).join('');
  $('#g-preguntar').innerHTML = Q.map((x) => `<li>«${esc(x)}»</li>`).join('');
  $('#g-canviar').innerHTML = G.map((x) => `<li>«${esc(x)}»</li>`).join('');
  const LL = {
    ca: ['Sóc al Mercadona', 'Quan arribi al Mercadona compra llet i ous', 'Quan surti de la feina trucar a la mare', 'He aparcat a la planta -2', 'On he aparcat?', 'Cada 2 setmanes regar el bonsai', 'El primer dilluns de cada mes reunió de veïns', 'Quants dies falten per les vacances?'],
    es: ['Estoy en el Mercadona', 'Cuando llegue al Mercadona compra leche y huevos', 'Cuando salga del trabajo llamar a mamá', 'He aparcado en la planta -2', '¿Dónde he aparcado?', 'Cada 2 semanas regar el bonsái', 'El primer lunes de cada mes reunión de vecinos', '¿Cuántos días faltan para las vacaciones?'],
    fr: ['Je suis chez Lidl', 'Quand j’arrive chez Lidl, achète du lait et des œufs', 'Quand je sors du travail appeler maman', 'J’ai garé au niveau -2', 'Où est ma voiture ?', 'Toutes les 2 semaines arroser le bonsaï', 'Le premier lundi de chaque mois réunion', 'Combien de jours avant les vacances ?'],
    en: ['I’m at Tesco', 'When I get to Tesco buy milk and eggs', 'When I leave work call mum', 'I parked on level -2', 'Where did I park?', 'Every other week water the bonsai', 'The first Monday of every month residents’ meeting', 'How many days until the holidays?'],
  }[I18N.llengua] || [];
  $('#g-llocs').innerHTML = LL.map((x) => `<li>«${esc(x)}»</li>`).join('');
}

// ------------------------------------------------------------------ esdeveniments
document.addEventListener('click', (ev) => {
  const b = ev.target.closest('button, [data-edita], [data-prova], [data-dia]');
  if (!b) return;
  if (b.dataset.ves) { ves(b.dataset.ves); if (b.dataset.ancora) setTimeout(() => document.getElementById(b.dataset.ancora)?.scrollIntoView({ behavior: 'smooth' }), 50); return; }
  if (b.dataset.fet) { ev.stopPropagation(); marcaFet(b.dataset.fet); return; }
  if (b.dataset.item) { const [id, i] = b.dataset.item.split(':'); marcaItem(id, +i); return; }
  if (b.dataset.edita) { obreEditor(b.dataset.edita); return; }
  if ('desfes' in b.dataset) { desfes(); $('#avis-toast').hidden = true; return; }
  if (b.dataset.prova) { processa(b.dataset.prova.replace(/^«|»$/g, '')); return; }
  if (b.dataset.dia) { diaSel = new Date(+b.dataset.dia); if (diaSel.getMonth() !== mesVist.getMonth()) { mesVist = new Date(diaSel); mesVist.setDate(1); } pintaAgenda(); return; }
  if (b.dataset.ddia) { b.classList.toggle('on'); return; }
  if (b.dataset.comparteix) { comparteix(textLlista(b.dataset.comparteix), b.dataset.comparteix); return; }
  if (b.dataset.mapa) {
    const l = b.dataset.mapa === 'cotxe' ? { ...D.cotxe, nom: T_('Cotxe') } : D.llocs.find((x) => x.id === b.dataset.mapa);
    if (l && l.lat != null) obreMapa(l.lat, l.lon, l.nom);
    return;
  }
  if (b.dataset.treuLloc) {
    const l = D.llocs.find((x) => x.id === b.dataset.treuLloc);
    if (l && confirm(T_('Oblidar el lloc «{lloc}»?', { lloc: l.nom }))) { D.llocs = D.llocs.filter((x) => x !== l); desa().then(pintaLlocs); }
    return;
  }
  if (b.dataset.permis) {
    S.demanaPermis({ quin: b.dataset.permis }).then(revisaPermisos).catch((e) => toast(String(e.message || e)));
  }
});
$('#mic').addEventListener('click', escolta);
$('#f-ordre').addEventListener('submit', (ev) => { ev.preventDefault(); const v = $('#ordre').value; $('#ordre').value = ''; $('#parcial').textContent = ''; processa(v); });
$('#mes-ant').addEventListener('click', () => { mesVist.setMonth(mesVist.getMonth() - 1); pintaAgenda(); });
$('#mes-seg').addEventListener('click', () => { mesVist.setMonth(mesVist.getMonth() + 1); pintaAgenda(); });
$('#mostra-fets').addEventListener('change', pintaAgenda);
$('#cerca').addEventListener('input', pintaNotes);
$('#llistes').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const f = ev.target, v = f.querySelector('input').value.trim();
  if (!v) return;
  processa(T_('apunta') + ' ' + v + ' ' + (I18N.llengua === 'en' ? 'at ' : I18N.llengua === 'fr' ? 'chez ' : I18N.llengua === 'es' ? 'en ' : 'a ') + f.dataset.lloc);
  setTimeout(pintaLlistes, 50);
});
$('#ed-te-data').addEventListener('change', actualitzaEditor);
$('#ed-rep').addEventListener('change', actualitzaEditor);
$('#ed-lloc').addEventListener('focus', () => { if (editant) editant._llocVell = editant.lloc; });
$('#f-editor').addEventListener('submit', (ev) => {
  const v = ev.submitter && ev.submitter.value;
  if (v === 'desa') desaEditor();
  else if (v === 'esborra' && editant) {
    darrera = { tipus: 'esborra', e: editant };
    D.entrades = D.entrades.filter((x) => x !== editant);
    desa(); toast(T_('Esborrat'), true);
  }
  if (editant) delete editant._llocVell;
  editant = null;
});
for (const id of Object.keys(CAMPS)) $('#' + id).addEventListener('change', (ev) => { D.ajustos[CAMPS[id]] = ['range', 'number'].includes(ev.target.type) ? (+ev.target.value || AJUSTOS_DEF[CAMPS[id]]) : ev.target.value.trim() || AJUSTOS_DEF[CAMPS[id]]; desa(); });
for (const id of Object.keys(INTERR)) $('#' + id).addEventListener('change', async (ev) => {
  if (id === 'a-calendari' && ev.target.checked && natiu) {
    // demana el permís de llegir el calendari; sense permís, es queda apagat
    try { const p = await S.demanaPermis({ quin: 'calendari' }); if (!p.calendari) { ev.target.checked = false; toast(T_('Cal el permís del calendari')); return; } }
    catch (e) { ev.target.checked = false; return; }
  }
  D.ajustos[INTERR[id]] = ev.target.checked; desa();
});
$('#a-hey').addEventListener('change', async (ev) => {
  try { const p = await S.heySoci({ on: ev.target.checked }); permisos = p; pintaAvancat(p); if (ev.target.checked && !p.superposar) toast(T_('Consell: permet «Mostra sobre altres apps» perquè Soci s\'obri sol quan el cridis.')); }
  catch (e) { ev.target.checked = false; toast(String(e.message || e)); }
});
$('#b-desa-lloc').addEventListener('click', () => {
  const nom = $('#nou-lloc').value.trim();
  if (!nom) { $('#nou-lloc').focus(); return; }
  $('#nou-lloc').value = '';
  desaLloc(nom, '').then(pintaLlocs);
});
$('#b-actualitza').addEventListener('click', () => {
  if (natiu) S.actualitza().catch(() => {});
  else window.open('https://xoriguer.dev/#soci', '_blank', 'noopener');
});
$('#b-assistent').addEventListener('click', () => S.obreAssistent().catch(() => toast(T_('Aquest mòbil no ho permet des d\'aquí: Ajustos → Aplicacions → Aplicacions predeterminades → Assistent digital.'))));
$('#a-idioma').addEventListener('change', async (ev) => { D.ajustos.idioma = ev.target.value; I18N.posa(D.ajustos.idioma); await desa(); aplicaIdioma(); });
$('#b-prova-veu').addEventListener('click', () => parla(T_('Hola! Sóc el teu soci. Digues-me què vols que apunti.')));
$('#b-exporta').addEventListener('click', exporta);
$('#b-importa').addEventListener('click', () => $('#f-importa').click());
$('#f-importa').addEventListener('change', (ev) => { const f = ev.target.files[0]; if (f) importa(f); ev.target.value = ''; });
$('#b-esborra-fets').addEventListener('click', () => {
  const n = D.entrades.filter((e) => e.fet).length;
  if (!confirm(T_('Esborrar {n} coses fetes? No es pot desfer.', { n }))) return;
  D.entrades = D.entrades.filter((e) => !e.fet); desa();
});
$('#b-giny').addEventListener('click', () => S.afegeixGiny().catch(() => toast(T_('Aquest mòbil no ho permet: afegeix-lo des de la pantalla d\'inici.'))));
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && natiu) { await carrega(); pinta(); revisaPermisos(); }
});

/** Text compartit des d'una altra app (WhatsApp, correu, navegador...): s'apunta tal qual, amb la data si en porta. */
function rebutCompartit(text) {
  text = String(text || '').trim().slice(0, 1000);
  if (!text) return;
  ves('inici');
  $('#parcial').textContent = '«' + text + '»';
  processa(T_('apunta') + ' ' + text);
}

// ------------------------------------------------------------------ inici
(async function inici() {
  let pref = '';
  try { pref = localStorage.getItem('soci-idioma') || ''; } catch (e) { /* res */ }
  I18N.posa(pref);
  await carrega();
  if ((D.ajustos.idioma || '') !== pref) I18N.posa(D.ajustos.idioma);
  document.documentElement.lang = I18N.llengua;
  I18N.tradueix(document.body);
  $('#versio').textContent = VERSIO;
  $$('[data-nomes-natiu]').forEach((x) => { x.hidden = !natiu; });
  $('#avis-web').hidden = natiu;
  if (!natiu) $('#copia-info').textContent = T_('Desa una còpia de tot el que has apuntat en un fitxer.');
  exemples();
  estatMic('');
  if (D.ajustos.llengua !== I18N.llengua) await desa(); else pinta();
  if (natiu) {
    revisaPermisos();
    S.addListener('canvi', async () => { await carrega(); pinta(); });
    S.addListener('escolta', () => escolta());
    S.addListener('parcial', (x) => { $('#parcial').textContent = x.text || ''; });
    S.addListener('text', (x) => rebutCompartit(x.text));
    try {
      const r = await S.intencio();
      if (r && r.text) rebutCompartit(r.text);
      else if (r && r.escolta) setTimeout(escolta, 150);
    } catch (e) { /* res */ }
    // primer cop: demana els permisos bàsics
    if (!localStorage.getItem('soci-benvinguda')) {
      localStorage.setItem('soci-benvinguda', '1');
      try { await S.demanaPermis({ quin: 'notificacions' }); } catch (e) { /* res */ }
      revisaPermisos();
    }
  } else if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
