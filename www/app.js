/* Xoriguer Soci — interfície. La lògica de llenguatge és a interpret.js. */
'use strict';
const VERSIO = '1.0.0';
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
};
let D = { entrades: [], ajustos: { ...AJUSTOS_DEF } };

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
      D = { entrades: Array.isArray(x.entrades) ? x.entrades : [], ajustos: { ...AJUSTOS_DEF, ...(x.ajustos || {}) } };
    } catch (e) { console.warn('dades malmeses', e); }
  }
}

/** Prepara les frases que Android dirà sol (sense la web) i desa. */
async function desa() {
  const L = I18N.llengua;
  for (const e of D.entrades) {
    e.frase = I.fraseAvis(e, L);
    e.frasePrevia = e.abans ? I.frasePrevia(e, L) : '';
  }
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
  };
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
      const r = await S.escolta({ llengua: VEU() });
      escoltant = false; estatMic('');
      if (r && r.text) { $('#parcial').textContent = '«' + r.text + '»'; processa(r.text); }
    } catch (e) {
      escoltant = false; estatMic('');
      const m = String(e && (e.message || e));
      if (!/cancel/i.test(m)) toast(/no-match|NO_MATCH|7/.test(m) ? T_('No t\'he sentit. Torna-ho a provar.') : T_('No s\'ha pogut escoltar: {e}', { e: m }));
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
    llocs: [...new Set(D.entrades.map((e) => e.lloc).filter(Boolean))],
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
    fet: false, original: text, creat: Date.now(), llengua: I18N.llengua,
  };
  if (!e.text && e.items.length) e.text = e.verb ? cap(e.verb) : T_('Comprar');
  if (!e.text && !e.items.length && e.lloc) e.text = e.lloc;
  D.entrades.push(e);
  darrera = { tipus: 'nova', id: e.id };
  desa();
  const frase = I.fraseConfirma({ ...e, quan: deIso(e.quan) }, I18N.llengua);
  mostraResposta(e.quan ? (e.avis ? '🔔' : '📅') : '📝', frase + (e.rep ? ' ' + repText(e.rep) + '.' : '') + (e.abans ? ' ' + abansText(e.abans) + '.' : ''), text, e.id);
  if (D.ajustos.confirma) parla(frase);
}
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function respon(r) {
  const ara = new Date();
  let llista = [];
  const pend = D.entrades.filter((e) => !e.fet);
  if (r.rang) {
    llista = pend.filter((e) => { const q = deIso(e.quan); return q && q >= r.rang.de && q <= r.rang.a; });
    // les que es repeteixen també surten si toquen dins el rang
    for (const e of pend) if (e.rep && e.quan) {
      let q = deIso(e.quan);
      for (let i = 0; i < 400 && q <= r.rang.a; i++) { if (q >= r.rang.de && !llista.includes(e)) { llista.push(e); break; } q = I.seguent(e.rep, q); }
    }
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
      return (q ? cap(I.quanText(q, L, ara)) + ': ' : '') + x;
    });
    veu = (llista.length === 1 ? '' : T_('Tens {n} coses.', { n: llista.length }) + ' ') + parts.join('. ') + '.';
  }
  mostraResposta(ico, veu, r.original, null, llista);
  parla(veu);
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
  if (e.quan && !opts.senseQuan) subs.push(esc(opts.nomesHora ? horaCurta(deIso(e.quan)) : quanCurt(e)));
  if (e.lloc) subs.push(`<span class="xip-lloc">${esc(e.lloc)}</span>`);
  if (e.rep) subs.push('🔁 ' + esc(repText(e.rep)));
  if (e.quan) subs.push(e.avis ? '🔔' + (e.abans ? ' ' + esc(abansText(e.abans).toLowerCase()) : '') : '🔕');
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
    + grup(T_('Sense data'), D.entrades.filter((e) => !e.fet && !e.quan).slice(-5).reverse());
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
    h += `<div class="targeta llista-lloc"><h2><span>📍 ${esc(nom)}</span></h2><ul class="items">`;
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
function marcaFet(id) {
  const e = D.entrades.find((x) => x.id === id);
  if (!e) return;
  darrera = { tipus: 'fet', id, abans: { fet: e.fet, quan: e.quan, fetA: e.fetA, items: JSON.parse(JSON.stringify(e.items || [])) } };
  if (e.rep && e.quan && !e.fet) {
    // la propera vegada
    let q = I.seguent(e.rep, deIso(e.quan));
    while (q < new Date()) q = I.seguent(e.rep, q);
    e.quan = iso(q);
    toast(T_('Fet. La propera: {q}', { q: quanCurt(e) }), true);
  } else {
    e.fet = !e.fet; e.fetA = e.fet ? Date.now() : null;
    if (e.fet && navigator.vibrate) navigator.vibrate(20);
    if (e.fet) toast(T_('Fet!'), true);
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
  } else { x.quan = null; x.rep = null; x.avis = false; x.abans = 0; }
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
  if (v === 'ajustos') { pintaAjustos(); pintaFets(); revisaPermisos(); }
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
const CAMPS = { 'a-nom': 'nom', 'a-velocitat': 'velocitat', 'a-defecte': 'defecte', 'a-mati': 'mati', 'a-tarda': 'tarda', 'a-vespre': 'vespre', 'a-silenci-de': 'silenciDe', 'a-silenci-a': 'silenciA', 'a-resum-hora': 'resumHora' };
const INTERR = { 'a-confirma': 'confirma', 'a-parla': 'parla', 'a-avis': 'avisDefecte', 'a-silenci': 'silenci', 'a-resum': 'resum' };
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
    for (const k of ['microfon', 'notificacions', 'alarmes', 'bateria']) {
      const li = $('#p-' + k);
      li.classList.toggle('fet', !!p[k]);
      li.querySelector('.punt').className = 'punt ' + (p[k] ? 'ok' : k === 'bateria' ? 'neutre' : '');
    }
    $('#avis-permisos').hidden = !!(p.microfon && p.notificacions && p.alarmes);
  } catch (e) { console.warn(e); }
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
  $('#exemples').innerHTML = [...E.slice(0, 4), Q[0]].map((x) => `<li data-prova="${esc(x)}">«${esc(x)}»</li>`).join('');
  $('#g-apuntar').innerHTML = E.map((x) => `<li>«${esc(x)}»</li>`).join('');
  $('#g-preguntar').innerHTML = Q.map((x) => `<li>«${esc(x)}»</li>`).join('');
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
for (const id of Object.keys(CAMPS)) $('#' + id).addEventListener('change', (ev) => { D.ajustos[CAMPS[id]] = ev.target.type === 'range' ? +ev.target.value : ev.target.value.trim() || AJUSTOS_DEF[CAMPS[id]]; desa(); });
for (const id of Object.keys(INTERR)) $('#' + id).addEventListener('change', (ev) => { D.ajustos[INTERR[id]] = ev.target.checked; desa(); });
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
    try { const r = await S.intencio(); if (r && r.escolta) setTimeout(escolta, 150); } catch (e) { /* res */ }
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
