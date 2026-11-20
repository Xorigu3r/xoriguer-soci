// Proves de l'intèrpret: node test.mjs
import './www/interpret.js';
const I = globalThis.Interpret;
const ARA = new Date(2026, 10, 20, 10, 0); // divendres 20/11/2026 10:00
let ok = 0, ko = 0;
const dt = (d) => d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : null;

function prova(L, frase, esperat) {
  const r = I.analitza(frase, { L, ara: ARA, llocs: ['Can Pere'] });
  const obt = { tipus: r.tipus, text: r.text, lloc: r.lloc || '', quan: dt(r.quan), avis: r.avis, abans: r.abans || 0, rep: r.rep ? JSON.stringify(r.rep) : null, items: (r.items || []).join('|'), termes: (r.termes || []).join(' '), rang: r.rang ? dt(r.rang.de) + '..' + dt(r.rang.a) : null,
    accio: r.accio || '', insisteix: !!r.insisteix, alt: r.alternativa ? r.alternativa.tipus + ':' + r.alternativa.text : '',
    mou: r.mou ? [r.mou.exacta ? dt(r.mou.exacta) : '-', r.mou.dia ? dt(r.mou.dia).slice(0, 10) : '-', r.mou.h != null ? r.mou.h + ':' + r.mou.m : '-', r.mou.durada].join(' ') : '' };
  const errors = [];
  for (const [k, v] of Object.entries(esperat)) if (obt[k] !== v) errors.push(`${k}: «${obt[k]}» (esperat «${v}»)`);
  if (errors.length) { ko++; console.log(`✗ [${L}] ${frase}\n    ${errors.join('\n    ')}`); }
  else ok++;
}

// ---- català
prova('ca', "hey soci, apunta, macro comprar patates el dijous, avisa'm", { tipus: 'afegeix', text: 'Comprar patates', lloc: 'Macro', quan: '2026-11-26 09:00', avis: true });
prova('ca', 'hey soci apunta macro comprar patates el dijous avisam', { text: 'Comprar patates', lloc: 'Macro', quan: '2026-11-26 09:00', avis: true });
prova('ca', 'soci apunta trucar al lampista demà a les 5', { text: 'Trucar al lampista', quan: '2026-11-21 17:00', avis: true });
prova('ca', "recorda'm que he de portar el cotxe al taller dilluns a les 8 del matí", { text: 'Portar el cotxe', lloc: 'taller', quan: '2026-11-23 08:00', avis: true });
prova('ca', "apunta dentista el 15 de desembre a dos quarts de sis de la tarda i avisa'm el dia abans", { text: '', lloc: 'dentista', quan: '2026-12-15 17:30', abans: 1440, tipus: 'afegeix' });
prova('ca', "d'aquí 20 minuts treure el pa del forn", { text: 'Treure el pa', lloc: 'forn', quan: '2026-11-20 10:20' });
prova('ca', "apunta d'aquí mitja hora mirar la rentadora", { text: 'Mirar la rentadora', quan: '2026-11-20 10:30' });
prova('ca', 'apunta cada dilluns a les 8 treure les escombraries', { text: 'Treure les escombraries', quan: '2026-11-23 08:00', rep: '{"t":"setmana","dies":[1]}' });
prova('ca', 'apunta prendre la pastilla cada dia a les 10 de la nit', { text: 'Prendre la pastilla', quan: '2026-11-20 22:00', rep: '{"t":"dia"}' });
prova('ca', 'el dia 1 de cada mes pagar el lloguer', { text: 'Pagar el lloguer', quan: '2026-12-01 09:00', rep: '{"t":"mes","dia":1}' });
prova('ca', 'apunta al mercadona comprar llet, ous i oli', { text: 'Comprar llet, ous i oli', lloc: 'Mercadona', items: 'llet|ous|oli', quan: null, avis: false });
prova('ca', 'apunta el codi de la porta és 4521', { text: 'El codi de la porta és 4521', quan: null, avis: false });
prova('ca', 'aquesta tarda trucar a la mare', { text: 'Trucar a la mare', quan: '2026-11-20 17:00' });
prova('ca', 'demà al matí anar a correus', { lloc: 'Correus', quan: '2026-11-21 09:00' });
prova('ca', 'a les 11 i quart reunió', { text: 'Reunió', quan: '2026-11-20 11:15' });
prova('ca', 'divendres que ve sopar a can pere', { text: 'Sopar', lloc: 'Can Pere', quan: '2026-11-27 09:00' });
prova('ca', 'dijous de la setmana que ve revisió', { text: 'Revisió', quan: '2026-11-26 09:00' });
prova('ca', "apunta comprar pa sense avisar demà", { text: 'Comprar pa', avis: false, quan: '2026-11-21 09:00' });
prova('ca', 'soci què tinc demà', { tipus: 'pregunta', rang: '2026-11-21 00:00..2026-11-21 23:59' });
prova('ca', 'què havia de comprar al macro', { tipus: 'pregunta', lloc: 'Macro', termes: 'comprar' });
prova('ca', 'quin era el codi de la porta', { tipus: 'pregunta', termes: 'codi porta' });
prova('ca', 'què tinc aquesta setmana', { tipus: 'pregunta', rang: '2026-11-20 00:00..2026-11-22 23:59' });
prova('ca', 'a les 17:45 recollir el nen', { quan: '2026-11-20 17:45', text: 'Recollir el nen' });
prova('ca', 'entre setmana a les 7 del matí gimnàs', { lloc: 'gimnàs', quan: '2026-11-23 07:00', rep: '{"t":"setmana","dies":[1,2,3,4,5]}' });
prova('ca', "apunta a la llista del macro paper de vàter", { lloc: 'Macro', items: 'paper de vàter' });

// ---- castellano
prova('es', 'oye socio apunta comprar patatas en el macro el jueves y avísame', { text: 'Comprar patatas', lloc: 'Macro', quan: '2026-11-26 09:00', avis: true });
prova('es', 'recuérdame llamar a mi madre mañana a las 8 de la tarde', { text: 'Llamar a mi madre', quan: '2026-11-21 20:00', avis: true });
prova('es', 'mañana por la mañana ir al banco', { lloc: 'banco', quan: '2026-11-21 09:00' });
prova('es', 'dentro de 2 horas sacar la ropa', { text: 'Sacar la ropa', quan: '2026-11-20 12:00' });
prova('es', 'todos los lunes y miércoles a las 7 y media de la tarde pádel', { text: 'Pádel', quan: '2026-11-23 19:30', rep: '{"t":"setmana","dies":[1,3]}' });
prova('es', 'qué tengo mañana', { tipus: 'pregunta', rang: '2026-11-21 00:00..2026-11-21 23:59' });
prova('es', 'el 3 de enero a las 10 menos cuarto médico', { lloc: 'médico', quan: '2027-01-03 09:45' });

// ---- français
prova('fr', "hé soci, note acheter des pommes de terre chez macro jeudi, préviens-moi", { text: 'Acheter des pommes de terre', lloc: 'Macro', quan: '2026-11-26 09:00', avis: true });
prova('fr', 'rappelle-moi d\'appeler le plombier demain à 17h30', { text: 'Appeler le plombier', quan: '2026-11-21 17:30', avis: true });
prova('fr', 'dans 10 minutes sortir le gâteau', { text: 'Sortir le gâteau', quan: '2026-11-20 10:10' });
prova('fr', 'tous les jours à 8 h prendre le médicament', { quan: '2026-11-21 08:00', rep: '{"t":"dia"}' });
prova('fr', "qu'est-ce que j'ai demain", { tipus: 'pregunta', rang: '2026-11-21 00:00..2026-11-21 23:59' });

// ---- English
prova('en', 'hey soci, note buy potatoes at macro on thursday, remind me', { text: 'Buy potatoes', lloc: 'Macro', quan: '2026-11-26 09:00', avis: true });
prova('en', 'remind me to call John tomorrow at 5pm', { text: 'Call John', quan: '2026-11-21 17:00', avis: true });
prova('en', 'in 15 minutes check the oven', { text: 'Check the oven', quan: '2026-11-20 10:15' });
prova('en', 'every monday at 8 am take out the trash', { quan: '2026-11-23 08:00', rep: '{"t":"setmana","dies":[1]}' });
prova('en', 'dentist on december 15th at half past 4', { lloc: 'dentist', quan: '2026-12-15 16:30' });
prova('en', 'what do i have tomorrow', { tipus: 'pregunta', rang: '2026-11-21 00:00..2026-11-21 23:59' });
prova('en', 'buy milk, eggs and bread at mercadona', { lloc: 'Mercadona', items: 'milk|eggs|bread' });

// ---- 1.1: accions sobre el que ja hi ha, insistència i moments del dia
prova('ca', 'fet el del macro', { tipus: 'accio', accio: 'fet', lloc: 'Macro', termes: '' });
prova('ca', 'ja he comprat les patates', { tipus: 'accio', accio: 'fet', termes: 'comprat patates' });
prova('ca', 'marca el dentista com a fet', { accio: 'fet', lloc: 'dentista', termes: '' });
prova('ca', 'esborra la del lampista', { accio: 'esborra', termes: 'lampista' });
prova('ca', 'hey soci, esborra-ho', { accio: 'esborra', termes: '', lloc: '' });
prova('ca', 'mou el dentista a divendres a les 6', { accio: 'mou', lloc: 'dentista', mou: '- 2026-11-20 18:0 0' });
prova('ca', 'posposa-ho una hora', { accio: 'mou', termes: '', mou: '- - - 60' });
prova('ca', "canvia l'oli del cotxe dijous", { accio: 'mou', alt: "afegeix:Canvia l'oli del cotxe" });
prova('ca', 'passa la reunió a demà', { accio: 'mou', termes: 'reunio', mou: '- 2026-11-21 - 0' });
prova('ca', 'i també ous i formatge', { accio: 'afegeix', items: 'ous|formatge' });
prova('ca', 'desfés', { tipus: 'accio', accio: 'desfes' });
prova('ca', 'treure les escombraries cada dilluns', { tipus: 'afegeix', accio: '' });
prova('ca', "recorda'm prendre la pastilla cada dia a les 9 fins que ho faci", { text: 'Prendre la pastilla', insisteix: true, avis: true, rep: '{"t":"dia"}' });
prova('ca', "demà després de dinar trucar a l'Anna", { text: "Trucar a l'Anna", quan: '2026-11-21 15:00' });
prova('ca', 'avui abans de sopar regar les plantes', { text: 'Regar les plantes', quan: '2026-11-20 20:00' });
prova('ca', 'he de comprar pa demà', { tipus: 'afegeix', accio: '', text: 'Comprar pa' });
prova('es', 'ya he comprado el pan', { accio: 'fet', termes: 'comprado pan' });
prova('es', 'mueve el dentista al jueves a las 5', { accio: 'mou', lloc: 'dentista', mou: '- 2026-11-26 17:0 0' });
prova('es', 'bórralo', { accio: 'esborra', termes: '' });
prova('es', 'mañana después de comer llamar al banco y no pares de avisarme', { lloc: 'banco', quan: '2026-11-21 15:00', insisteix: true });
prova('fr', "c'est fait", { accio: 'fet', termes: '' });
prova('fr', 'déplace le dentiste à jeudi', { accio: 'mou', lloc: 'dentiste', mou: '- 2026-11-26 - 0' });
prova('en', 'done', { accio: 'fet' });
prova('en', 'postpone it by half an hour', { accio: 'mou', mou: '- - - 30' });
prova('en', 'delete the plumber', { accio: 'esborra', termes: 'plumber' });
prova('en', 'take my pills after dinner every day and keep reminding me', { insisteix: true, quan: '2026-11-20 22:00', rep: '{"t":"dia"}' });

// ---- 1.2: llocs, aparcar, repeticions amb interval, compte enrere
const pr2 = (L, f, esp) => {
  const r = I.analitza(f, { L, ara: ARA, llocs: ['Can Pere'] });
  const obt = { tipus: r.tipus, nom: r.nom || '', nota: r.nota || '', on: r.on ? r.on.t : '', lloc: r.lloc || '', text: r.text || '', items: (r.items || []).join('|'), compte: !!r.compte, termes: (r.termes || []).join(' '), rep: r.rep ? JSON.stringify(r.rep) : null, quan: dt(r.quan) };
  const errors = Object.entries(esp).filter(([k, v]) => obt[k] !== v).map(([k, v]) => `${k}: «${obt[k]}» (esperat «${v}»)`);
  if (errors.length) { ko++; console.log(`✗ [${L}] ${f}\n    ${errors.join('\n    ')}`); } else ok++;
};
pr2('ca', 'sóc al Mercadona', { tipus: 'lloc', nom: 'Mercadona' });
pr2('ca', 'hey soci, estic a casa', { tipus: 'lloc', nom: 'Casa' });
pr2('ca', 'desa aquest lloc com a la feina', { tipus: 'lloc', nom: 'La feina' });
pr2('ca', 'estic a punt de sortir de casa ara mateix ja', { tipus: 'afegeix' });
pr2('ca', 'he aparcat a la planta -2 plaça 45', { tipus: 'aparca', nota: 'a la planta -2 plaça 45' });
pr2('ca', 'on he aparcat?', { tipus: 'onCotxe' });
pr2('ca', 'quan arribi a casa trucar a la mare', { tipus: 'afegeix', on: 'arribar', lloc: 'casa', text: 'Trucar a la mare', quan: null });
pr2('ca', 'quan arribi al mercadona compra llet i ous', { on: 'arribar', lloc: 'Mercadona', items: 'llet|ous' });
pr2('ca', 'recorda\'m quan surti de la feina passar per la farmàcia', { on: 'sortir', lloc: 'feina', text: 'Passar per la farmàcia' });
pr2('ca', 'quan passi per can pere tornar-li el llibre', { on: 'arribar', lloc: 'Can Pere' });
pr2('ca', 'quan arribi a Sabadell comprar torrons', { on: 'arribar', lloc: 'Sabadell', text: 'Comprar torrons' });
pr2('ca', 'cada 2 setmanes regar el bonsai', { rep: '{"t":"setmana","n":2,"dies":[5]}', quan: '2026-11-27 09:00' });
pr2('ca', 'cada quinze dies canviar els llençols', { rep: '{"t":"dia","n":15}', quan: '2026-11-21 09:00' });
pr2('ca', 'el primer dilluns de cada mes reunió de veïns a les 8 del vespre', { rep: '{"t":"mes","nth":1,"dsem":1}', quan: '2026-12-07 20:00' });
pr2('ca', "l'últim divendres de cada mes sopar", { rep: '{"t":"mes","nth":-1,"dsem":5}', quan: '2026-11-27 09:00' });
pr2('ca', "l'últim dia de cada mes pagar la quota", { rep: '{"t":"mes","dia":31}', quan: '2026-11-30 09:00' });
pr2('ca', 'quants dies falten per les vacances?', { tipus: 'pregunta', compte: true, termes: 'vacances' });
pr2('es', 'estoy en el Mercadona', { tipus: 'lloc', nom: 'Mercadona' });
pr2('es', 'cuando llegue a casa llamar a mamá', { on: 'arribar', lloc: 'casa', text: 'Llamar a mamá' });
pr2('es', 'cuando salga del trabajo comprar pan', { on: 'sortir', lloc: 'trabajo' });
pr2('es', 'he aparcado en la planta 3', { tipus: 'aparca' });
pr2('es', '¿dónde he aparcado?', { tipus: 'onCotxe' });
pr2('es', 'cuántos días faltan para mi cumpleaños', { compte: true, termes: 'cumpleanos' });
pr2('es', 'cada 3 meses revisar la caldera', { rep: '{"t":"mes","n":3}' });
pr2('fr', 'je suis chez Lidl', { tipus: 'lloc', nom: 'Lidl' });
pr2('fr', 'quand j\'arrive à la maison appeler maman', { on: 'arribar', lloc: 'maison' });
pr2('fr', 'où est ma voiture', { tipus: 'onCotxe' });
pr2('en', "i'm at the gym", { tipus: 'lloc', nom: 'Gym' });
pr2('en', 'when i get home call mum', { on: 'arribar', lloc: 'home', text: 'Call mum' });
pr2('en', 'when i leave work buy flowers', { on: 'sortir', lloc: 'work' });
pr2('en', 'every other week water the plants', { rep: '{"t":"setmana","n":2,"dies":[5]}' });
pr2('en', 'where did i park', { tipus: 'onCotxe' });
pr2('en', 'how many days until christmas', { compte: true, termes: 'christmas' });
const s2 = I.seguent({ t: 'mes', nth: 1, dsem: 1 }, new Date(2026, 11, 7, 20)); // 1r dilluns: 7/12 → 4/1
if (dt(s2) !== '2027-01-04 20:00') { ko++; console.log('✗ seguent nth', dt(s2)); } else ok++;

// ---- repeticions
const s = I.seguent({ t: 'setmana', dies: [1, 4] }, new Date(2026, 10, 23, 8)); // dl → dj
if (dt(s) !== '2026-11-26 08:00') { ko++; console.log('✗ seguent setmana', dt(s)); } else ok++;
const m = I.seguent({ t: 'mes', dia: 31 }, new Date(2027, 0, 31, 9)); // 31 gen → 28 feb
if (dt(m) !== '2027-02-28 09:00') { ko++; console.log('✗ seguent mes', dt(m)); } else ok++;

// ---- frases
const e = I.analitza("apunta macro comprar patates el dijous avisa'm", { L: 'ca', ara: ARA });
const fa = I.fraseAvis(e, 'ca');
if (fa !== 'Recorda: comprar patates al Macro.') { ko++; console.log('✗ fraseAvis', fa); } else ok++;
const fc = I.fraseConfirma(e, 'ca', ARA);
if (fc !== "Apuntat: comprar patates al Macro, dijous a les 9. T'avisaré.") { ko++; console.log('✗ fraseConfirma', fc); } else ok++;

console.log(`\n${ok} bé, ${ko} malament`);
process.exit(ko ? 1 : 0);
