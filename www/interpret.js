/* Xoriguer Soci — intèrpret d'ordres de veu (català, castellà, francès, anglès).
 * Lògica pura, sense DOM: es fa servir a la web/APK i a test.mjs.
 *   Interpret.analitza(text, { L, ara, nom, llocs, hores, avisDefecte })
 * retorna { tipus: 'afegeix' | 'pregunta' | 'buit', ... }.
 * Treballa sobre una còpia del text en minúscules i sense accents de la mateixa llargada que l'original:
 * cada tros reconegut (data, hora, lloc, avís...) s'esborra de totes dues i el que queda és el «què». */
'use strict';
(function (g) {
  // ---------------------------------------------------------------- utilitats
  const sense = (c) => c.normalize('NFD')[0] || c;
  /** minúscules, sense accents, apòstrofs unificats; mateixa llargada que l'entrada */
  function plana(s) {
    let r = '';
    for (const c of String(s)) {
      let x = sense(c.toLowerCase());
      if (/[’‘`´]/.test(x)) x = "'";
      if (x.length !== c.length) x = x.padEnd(c.length, ' ').slice(0, c.length);
      r += x;
    }
    return r;
  }
  const P = (s) => new RegExp(s, 'i');
  const alt = (o) => Object.keys(o).sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')).join('|');
  const D0 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const sumaDies = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const ambHora = (d, h, m) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m || 0, 0, 0);
  const diaSet = (d) => ((d.getDay() + 6) % 7) + 1; // 1 = dilluns ... 7 = diumenge
  const diesMes = (a, m) => new Date(a, m + 1, 0).getDate();
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  // ---------------------------------------------------------------- vocabulari
  const NUM = {
    ca: { un: 1, una: 1, dos: 2, dues: 2, tres: 3, quatre: 4, cinc: 5, sis: 6, set: 7, vuit: 8, nou: 9, deu: 10, onze: 11, dotze: 12, quinze: 15, vint: 20, trenta: 30 },
    es: { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, quince: 15, veinte: 20, treinta: 30 },
    fr: { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, quinze: 15, vingt: 20, trente: 30 },
    en: { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30 },
  };
  const MITJA = { ca: 'mitja|mig', es: 'media|medio', fr: 'demi-?\\s?|demie', en: 'half' };
  const DIES = {
    ca: ['dilluns', 'dimarts', 'dimecres', 'dijous', 'divendres', 'dissabtes?', 'diumenges?'],
    es: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabados?', 'domingos?'],
    fr: ['lundis?', 'mardis?', 'mercredis?', 'jeudis?', 'vendredis?', 'samedis?', 'dimanches?'],
    en: ['mondays?', 'tuesdays?', 'wednesdays?', 'thursdays?', 'fridays?', 'saturdays?', 'sundays?'],
  };
  const MESOS = {
    ca: ['gener', 'febrer', 'marc', 'abril', 'maig', 'juny', 'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'],
    es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 's[e]?ptiembre', 'octubre', 'noviembre', 'diciembre'],
    fr: ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'],
    en: ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'],
  };
  const MARQUES = ['macro', 'makro', 'mercadona', 'lidl', 'aldi', 'carrefour', 'caprabo', 'bonpreu', 'bon preu', 'condis', 'consum', 'eroski', 'alcampo', 'ikea', 'leroy merlin', 'decathlon', 'esclat', 'spar', 'coviran', 'ametller', 'primaprix', 'action', 'media markt', 'mediamarkt', 'el corte ingles', 'corte ingles', 'bricomart', 'bauhaus', 'norauto', 'costco', 'tesco', 'auchan', 'leclerc', 'intermarche'];
  // llocs genèrics: [forma plana, nom bonic, preposició per a la frase]
  const LLOCS = {
    ca: [['farmacia', 'farmàcia', 'a la'], ['ferreteria', 'ferreteria', 'a la'], ['supermercat', 'supermercat', 'al'], ['super', 'súper', 'al'], ['mercat', 'mercat', 'al'],
      ['banc', 'banc', 'al'], ['caixer', 'caixer', 'al'], ['correus', 'Correus', 'a'], ['metge', 'metge', 'al'], ['hospital', 'hospital', 'a l\''], ['dentista', 'dentista', 'al'],
      ['taller', 'taller', 'al'], ['gimnas', 'gimnàs', 'al'], ['ajuntament', 'ajuntament', 'a l\''], ['escola', 'escola', 'a l\''], ['forn', 'forn', 'al'], ['fleca', 'fleca', 'a la'],
      ['carnisseria', 'carnisseria', 'a la'], ['peixateria', 'peixateria', 'a la'], ['fruiteria', 'fruiteria', 'a la'], ['gasolinera', 'gasolinera', 'a la'],
      ['perruqueria', 'perruqueria', 'a la'], ['oficina', 'oficina', 'a l\''], ['feina', 'feina', 'a la'], ['veterinari', 'veterinari', 'al'], ['estanc', 'estanc', 'a l\'']],
    es: [['farmacia', 'farmacia', 'en la'], ['ferreteria', 'ferretería', 'en la'], ['supermercado', 'supermercado', 'en el'], ['super', 'súper', 'en el'], ['mercado', 'mercado', 'en el'],
      ['banco', 'banco', 'en el'], ['cajero', 'cajero', 'en el'], ['correos', 'Correos', 'en'], ['medico', 'médico', 'en el'], ['hospital', 'hospital', 'en el'], ['dentista', 'dentista', 'en el'],
      ['taller', 'taller', 'en el'], ['gimnasio', 'gimnasio', 'en el'], ['ayuntamiento', 'ayuntamiento', 'en el'], ['colegio', 'colegio', 'en el'], ['escuela', 'escuela', 'en la'],
      ['panaderia', 'panadería', 'en la'], ['carniceria', 'carnicería', 'en la'], ['pescaderia', 'pescadería', 'en la'], ['fruteria', 'frutería', 'en la'], ['gasolinera', 'gasolinera', 'en la'],
      ['peluqueria', 'peluquería', 'en la'], ['oficina', 'oficina', 'en la'], ['trabajo', 'trabajo', 'en el'], ['veterinario', 'veterinario', 'en el'], ['estanco', 'estanco', 'en el']],
    fr: [['pharmacie', 'pharmacie', 'à la'], ['quincaillerie', 'quincaillerie', 'à la'], ['supermarche', 'supermarché', 'au'], ['marche', 'marché', 'au'], ['banque', 'banque', 'à la'],
      ['distributeur', 'distributeur', 'au'], ['poste', 'poste', 'à la'], ['medecin', 'médecin', 'chez le'], ['hopital', 'hôpital', 'à l\''], ['dentiste', 'dentiste', 'chez le'],
      ['garage', 'garage', 'au'], ['salle de sport', 'salle de sport', 'à la'], ['mairie', 'mairie', 'à la'], ['ecole', 'école', 'à l\''], ['boulangerie', 'boulangerie', 'à la'],
      ['boucherie', 'boucherie', 'à la'], ['poissonnerie', 'poissonnerie', 'à la'], ['station-service', 'station-service', 'à la'], ['coiffeur', 'coiffeur', 'chez le'],
      ['bureau', 'bureau', 'au'], ['travail', 'travail', 'au'], ['veterinaire', 'vétérinaire', 'chez le'], ['tabac', 'tabac', 'au']],
    en: [['pharmacy', 'pharmacy', 'at the'], ['chemist', 'chemist', 'at the'], ['hardware store', 'hardware store', 'at the'], ['supermarket', 'supermarket', 'at the'], ['market', 'market', 'at the'],
      ['bank', 'bank', 'at the'], ['atm', 'ATM', 'at the'], ['post office', 'post office', 'at the'], ['doctor', 'doctor', 'at the'], ['hospital', 'hospital', 'at the'], ['dentist', 'dentist', 'at the'],
      ['garage', 'garage', 'at the'], ['gym', 'gym', 'at the'], ['town hall', 'town hall', 'at the'], ['school', 'school', 'at the'], ['bakery', 'bakery', 'at the'], ['butcher', 'butcher', 'at the'],
      ['greengrocer', 'greengrocer', 'at the'], ['gas station', 'gas station', 'at the'], ['petrol station', 'petrol station', 'at the'], ['hairdresser', 'hairdresser', 'at the'],
      ['office', 'office', 'at the'], ['work', 'work', 'at'], ['vet', 'vet', 'at the']],
  };
  const PREP_MARCA = { ca: { macro: 'al', makro: 'al', lidl: 'al', carrefour: 'al', 'el corte ingles': 'a', 'corte ingles': 'al', ikea: 'a l\'', aldi: 'a l\'', alcampo: 'a l\'', esclat: 'a l\'', ametller: 'a l\'', action: 'a l\'' }, es: { }, fr: { }, en: { } };
  const PREP_DEF = { ca: 'a', es: 'en', fr: 'à', en: 'at' };

  // Expressions per llengua (sobre text pla). NOM = nom de l'assistent.
  const R = {
    ca: {
      salut: "(?:hey|hei|ei|eh|ep|hola|oi|ok|okay|escolta)",
      ordre: "(?:si\\s+us\\s+plau\\s+|sisplau\\s+|siusplau\\s+)?(?:apunta\\s?-?\\s?'?\\s?m(?:e)?|apunta|anota\\s?-?\\s?'?\\s?m|anota|afegeix|guarda(?:\\s?-?\\s?'?\\s?m)?|desa|recorda\\s?-?\\s?'?\\s?m|recorda|apuntar|anotar|pren\\s+nota|nota)(?:\\s+(?:aixo|que))?",
      modal: "^(?:(?:que\\s+)?(?:he\\s+de|haig\\s+de|hauria\\s+de|tinc\\s+de|tinc\\s+que|hem\\s+de|cal|haurem\\s+de))\\s+",
      avisSi: "\\b(?:i\\s+)?(?:avisa\\s?-?\\s?'?\\s?m(?:e)?(?:\\s?-?\\s?'?\\s?ho)?|avisa\\s+me|recorda\\s?-?\\s?'?\\s?m\\s?-?\\s?'?\\s?ho|alerta\\s?-?\\s?'?\\s?m|fes\\s?-?\\s?me\\s+saber|aviseu\\s?-?\\s?me)\\b|\\b(?:i\\s+)?recorda\\s?-?\\s?'?\\s?m\\s*$",
      avisNo: "\\b(?:sense\\s+avis(?:ar)?|no\\s+m'?\\s?avisis|no\\s+cal\\s+(?:que\\s+m'?\\s?avisis|avisar))\\b",
      abansDia: "\\b(?:(?:i\\s+)?(?:avisa\\s?-?\\s?'?\\s?m\\s+)?(?:el\\s+)?dia\\s+(?:d'\\s?)?abans|la\\s+vigilia)\\b",
      abans: "\\b(?:(?:i\\s+)?(?:avisa\\s?-?\\s?'?\\s?m\\s+)?)(NUM)\\s+(minuts?|min|hores?|hora|dies|dia|setmanes|setmana)(?:\\s+i\\s+(?:MITJA))?\\s+abans\\b",
      unitats: { minut: 'min', minuts: 'min', min: 'min', hora: 'h', hores: 'h', dia: 'd', dies: 'd', setmana: 's', setmanes: 's', mes: 'm', mesos: 'm' },
      repDia: "\\b(?:cada\\s+dia|tots\\s+els\\s+dies|diariament)\\b",
      repFeiners: "\\b(?:entre\\s+setmana|els\\s+dies\\s+feiners|cada\\s+dia\\s+feiner|de\\s+dilluns\\s+a\\s+divendres)\\b",
      repCap: "\\b(?:els\\s+caps\\s+de\\s+setmana|cada\\s+cap\\s+de\\s+setmana)\\b",
      repDies: "\\b(?:cada|tots\\s+els|els)\\s+((?:DIA)(?:\\s*(?:,|\\bi\\b)\\s*(?:els?\\s+)?(?:DIA))*)\\b",
      repSetmana: "\\b(?:cada\\s+setmana|setmanalment)\\b",
      repMesDia: "\\b(?:el\\s+)?(?:dia\\s+)?(\\d{1,2})\\s+de\\s+cada\\s+mes\\b|\\bcada\\s+dia\\s+(\\d{1,2})\\b",
      repMes: "\\b(?:cada\\s+mes|mensualment)\\b",
      repAny: "\\b(?:cada\\s+any|anualment)\\b",
      avui: "\\bavui\\b",
      dema: "\\bdema\\b",
      demaPassat: "\\b(?:dema\\s+passat|passat\\s+dema|despres\\s+de\\s+dema)\\b",
      rel: "\\b(?:d'\\s?aqui\\s+(?:a\\s+)?|dins\\s+(?:de\\s+)?|en\\s+)(NUM)\\s+(minuts?|min|hores?|hora|dies|dia|setmanes|setmana|mesos|mes)(?:\\s+i\\s+(MITJA))?\\b",
      relMitja: "\\b(?:d'\\s?aqui\\s+(?:a\\s+)?|dins\\s+(?:de\\s+)?|en\\s+)mitja\\s+hora\\b",
      setmanaVe: "\\b(?:(?:de\\s+)?la\\s+setmana\\s+que\\s+ve|(?:de\\s+)?la\\s+propera\\s+setmana|(?:de\\s+)?la\\s+setmana\\s+vinent)\\b",
      mesVe: "\\b(?:el\\s+mes\\s+que\\s+ve|el\\s+proper\\s+mes|el\\s+mes\\s+vinent)\\b",
      aquestaSetmana: "\\b(?:aquesta\\s+setmana)\\b",
      dia: "\\b(?:(?:el|aquest|aquest|el\\s+proper|proper)\\s+)?(DIA)(?:\\s+(?:que\\s+ve|vinent|proper))?\\b",
      data: "\\b(?:(?:el\\s+)?(?:dia\\s+)?)(\\d{1,2})\\s+(?:de\\s+|d'\\s?)(MES)(?:\\s+(?:de\\s+|del\\s+)?(\\d{4}))?\\b",
      dataEl: "\\b(?:el\\s+dia|el|dia)\\s+(\\d{1,2})\\b(?!\\s*(?:%|€|euros?|litres?|l\\b|kg|quilos?|kilos?|grams?|g\\b|unitats?|minuts?|hores?|cops|vegades|anys?|metres?|cm|persones))",
      hora: "\\b(?:a|cap\\s+a|sobre|vers)\\s+(?:les|la)\\s+(NUM)(?:(?:\\s?[:.h]\\s?|\\s+i\\s+)(\\d{1,2}|mitja|quart|tres\\s+quarts|cinc|deu|quinze|vint|vint-?\\s?i-?\\s?cinc|trenta))?(?:\\s+menys\\s+(quart|cinc|deu|vint|\\d{1,2}))?(?:\\s+en\\s+punt)?(?:\\s+(PER))?\\b",
      quarts: "\\b(?:a\\s+|cap\\s+a\\s+)?(un|dos|tres)\\s+quarts?\\s+(?:de\\s+|d'\\s?)(NUM)(?:\\s+(PER))?\\b",
      migdia: "\\b(?:al|cap\\s+al|a)\\s+migdia\\b",
      per: { 'del mati': 'mati', 'de la matinada': 'mati', 'de la tarda': 'tarda', 'del vespre': 'vespre', 'de la nit': 'vespre', 'del migdia': 'migdia' },
      periodes: [["\\b(?:a\\s+)?primera\\s+hora(?:\\s+del\\s+mati)?\\b", 'primera'], ["\\b(?:aquest|al|pel|el)\\s+mati\\b", 'mati'], ["\\b(?:aquesta|a\\s+la|per\\s+la|la)\\s+tarda\\b", 'tarda'],
        ["\\b(?:aquest|al|pel|el)\\s+vespre\\b", 'vespre'], ["\\b(?:aquesta|a\\s+la|per\\s+la|la)\\s+nit\\b", 'vespre']],
      avuiPer: "\\b(?:aquest|aquesta)\\s+(?:mati|tarda|vespre|nit|migdia)\\b",
      pregunta: "^(?:que|quin|quina|quins|quines|quan|on|com|qui|quant|quanta|quants|quantes|digues(?:\\s?-?\\s?me)?|llegeix(?:\\s?-?\\s?me)?|recordes|saps|em\\s+dius|tinc\\s+(?:alguna\\s+cosa|res)|hi\\s+ha\\s+(?:alguna\\s+cosa|res))\\b",
      pendent: "\\b(?:pendents?|per\\s+fer|que\\s+falta)\\b",
      prepLloc: "(?:(?:al|a\\s+la|a\\s+l'|a\\s+cal|a|del|de\\s+la|de\\s+l'|de|el|la|l')\\s*)?",
      verbs: "(?:comprar|agafar|portar|recollir|buscar|demanar)",
      sep: "\\s*,\\s*|\\s+i\\s+",
      llista: "\\b(?:a\\s+)?la\\s+llista(?:\\s+de\\s+la\\s+compra|\\s+de\\s+l'|\\s+del?)?\\b",
      buits: ['que', 'de', 'i', 'per', 'per a', 'a', 'al', 'un', 'una', 'he de', 'cal', 'tambe', 'tambe que', 'si us plau'],
      stop: 'que tinc tenia tenim tens he haig havia hem de del dels el la els les a al als i o per un una uns unes quin quina quins quines era es son eren apuntat apunta vaig fer cosa coses alguna res hi ha em dius digues me recordes saps on com quan qui quant amb sense meu meva mes',
    },
    es: {
      salut: "(?:hey|oye|eh|ey|hola|ok|okay|escucha)",
      ordre: "(?:por\\s+favor\\s+)?(?:apunta\\s?(?:me)?|anota\\s?(?:me)?|anade|agrega|guarda(?:me)?|recuerdame|recuerda|apuntar|anotar|toma\\s+nota(?:\\s+de)?|nota)(?:\\s+(?:esto|que))?",
      modal: "^(?:(?:que\\s+)?(?:tengo\\s+que|he\\s+de|debo|deberia|hay\\s+que|tenemos\\s+que))\\s+",
      avisSi: "\\b(?:y\\s+)?(?:avisame|avisa\\s+me|recuerdamelo|alertame|notificame|hazme\\s+saber)\\b|\\b(?:y\\s+)?recuerdame\\s*$",
      avisNo: "\\b(?:sin\\s+aviso|sin\\s+avisar|no\\s+me\\s+avises|no\\s+hace\\s+falta\\s+(?:que\\s+me\\s+avises|avisar))\\b",
      abansDia: "\\b(?:(?:y\\s+)?(?:avisame\\s+)?(?:el\\s+)?dia\\s+(?:de\\s+)?antes|la\\s+vispera)\\b",
      abans: "\\b(?:(?:y\\s+)?(?:avisame\\s+)?)(NUM)\\s+(minutos?|min|horas?|dias?|semanas?)(?:\\s+y\\s+(?:MITJA))?\\s+antes\\b",
      unitats: { minuto: 'min', minutos: 'min', min: 'min', hora: 'h', horas: 'h', dia: 'd', dias: 'd', semana: 's', semanas: 's', mes: 'm', meses: 'm' },
      repDia: "\\b(?:cada\\s+dia|todos\\s+los\\s+dias|diariamente|a\\s+diario)\\b",
      repFeiners: "\\b(?:entre\\s+semana|los\\s+dias\\s+laborables|cada\\s+dia\\s+laborable|de\\s+lunes\\s+a\\s+viernes)\\b",
      repCap: "\\b(?:los\\s+fines\\s+de\\s+semana|cada\\s+fin\\s+de\\s+semana)\\b",
      repDies: "\\b(?:cada|todos\\s+los|los)\\s+((?:DIA)(?:\\s*(?:,|\\by\\b)\\s*(?:los?\\s+)?(?:DIA))*)\\b",
      repSetmana: "\\b(?:cada\\s+semana|semanalmente|todas\\s+las\\s+semanas)\\b",
      repMesDia: "\\b(?:el\\s+)?(?:dia\\s+)?(\\d{1,2})\\s+de\\s+cada\\s+mes\\b|\\bcada\\s+dia\\s+(\\d{1,2})\\b",
      repMes: "\\b(?:cada\\s+mes|mensualmente|todos\\s+los\\s+meses)\\b",
      repAny: "\\b(?:cada\\s+ano|anualmente|todos\\s+los\\s+anos)\\b",
      avui: "\\bhoy\\b",
      dema: "\\bmanana\\b(?!\\s+por\\s+la)",
      demaPassat: "\\b(?:pasado\\s+manana)\\b",
      rel: "\\b(?:dentro\\s+de\\s+|de\\s+aqui\\s+a\\s+|en\\s+)(NUM)\\s+(minutos?|min|horas?|dias?|semanas?|mes|meses)(?:\\s+y\\s+(MITJA))?\\b",
      relMitja: "\\b(?:dentro\\s+de\\s+|de\\s+aqui\\s+a\\s+|en\\s+)media\\s+hora\\b",
      setmanaVe: "\\b(?:(?:de\\s+)?la\\s+semana\\s+que\\s+viene|(?:de\\s+)?la\\s+proxima\\s+semana|(?:de\\s+)?la\\s+semana\\s+proxima)\\b",
      mesVe: "\\b(?:el\\s+mes\\s+que\\s+viene|el\\s+proximo\\s+mes|el\\s+mes\\s+proximo)\\b",
      aquestaSetmana: "\\b(?:esta\\s+semana)\\b",
      dia: "\\b(?:(?:el|este|el\\s+proximo|proximo)\\s+)?(DIA)(?:\\s+(?:que\\s+viene|proximo))?\\b",
      data: "\\b(?:(?:el\\s+)?(?:dia\\s+)?)(\\d{1,2})\\s+de\\s+(MES)(?:\\s+(?:de\\s+|del\\s+)?(\\d{4}))?\\b",
      dataEl: "\\b(?:el\\s+dia|el|dia)\\s+(\\d{1,2})\\b(?!\\s*(?:%|€|euros?|litros?|l\\b|kg|kilos?|gramos?|g\\b|unidades?|minutos?|horas?|veces|anos?|metros?|cm|personas))",
      hora: "\\b(?:a|hacia|sobre)\\s+(?:las|la)\\s+(NUM)(?:(?:\\s?[:.h]\\s?|\\s+y\\s+)(\\d{1,2}|media|cuarto|cinco|diez|quince|veinte|veinticinco|treinta))?(?:\\s+menos\\s+(cuarto|cinco|diez|veinte|\\d{1,2}))?(?:\\s+en\\s+punto)?(?:\\s+(PER))?\\b",
      quarts: "(?!x)x",
      migdia: "\\b(?:al|a)\\s+mediodia\\b",
      per: { 'de la manana': 'mati', 'de la madrugada': 'mati', 'de la tarde': 'tarda', 'de la noche': 'vespre', 'del mediodia': 'migdia' },
      periodes: [["\\b(?:a\\s+)?primera\\s+hora(?:\\s+de\\s+la\\s+manana)?\\b", 'primera'], ["\\b(?:esta|por\\s+la|de\\s+la)\\s+manana\\b", 'mati'], ["\\b(?:esta|por\\s+la|de\\s+la|a\\s+la)\\s+tarde\\b", 'tarda'],
        ["\\b(?:esta|por\\s+la|de\\s+la|a\\s+la)\\s+noche\\b", 'vespre']],
      avuiPer: "\\b(?:esta)\\s+(?:manana|tarde|noche)\\b",
      pregunta: "^(?:que|cual|cuales|cuando|donde|como|quien|cuanto|cuanta|cuantos|cuantas|dime|leeme|recuerdas|sabes|tengo\\s+algo|hay\\s+algo)\\b",
      pendent: "\\b(?:pendientes?|por\\s+hacer|que\\s+falta)\\b",
      prepLloc: "(?:(?:al|a\\s+la|a|en\\s+el|en\\s+la|en|del|de\\s+la|de|el|la)\\s*)?",
      verbs: "(?:comprar|coger|traer|llevar|recoger|buscar|pedir)",
      sep: "\\s*,\\s*|\\s+y\\s+|\\s+e\\s+",
      llista: "\\b(?:a\\s+)?la\\s+lista(?:\\s+de\\s+la\\s+compra|\\s+del?)?\\b",
      buits: ['que', 'de', 'y', 'para', 'por', 'a', 'al', 'un', 'una', 'tengo que', 'hay que', 'tambien', 'por favor'],
      stop: 'que tengo tenia tenemos tienes he habia hemos de del el la los las a al y o para por un una unos unas cual cuales era es son eran apunte apuntado hice cosa cosas algo nada hay me dices dime recuerdas sabes donde como cuando quien cuanto con sin mi mis',
    },
    fr: {
      salut: "(?:hey|he|eh|ok|okay|salut|dis|ecoute)",
      ordre: "(?:s'?\\s?il\\s+te\\s+plait\\s+)?(?:note(?:\\s?-?\\s?moi)?|ajoute|enregistre|garde|marque|rappelle\\s?-?\\s?moi|rappelle|prends\\s+note)(?:\\s+(?:ca|que|qu'|de|d'))?",
      modal: "^(?:(?:que\\s+|qu'\\s?)?(?:je\\s+dois|il\\s+faut\\s+que\\s+j'?\\s?|il\\s+faut|je\\s+devrais|on\\s+doit|faut))\\s*",
      avisSi: "\\b(?:et\\s+)?(?:previens\\s?-?\\s?moi|avertis\\s?-?\\s?moi|rappelle\\s?-?\\s?le\\s?-?\\s?moi|alerte\\s?-?\\s?moi|fais\\s?-?\\s?moi\\s+signe)\\b|\\b(?:et\\s+)?rappelle\\s?-?\\s?moi\\s*$",
      avisNo: "\\b(?:sans\\s+(?:alerte|rappel|prevenir)|ne\\s+me\\s+previens\\s+pas|pas\\s+besoin\\s+de\\s+(?:me\\s+)?prevenir)\\b",
      abansDia: "\\b(?:(?:et\\s+)?(?:previens\\s?-?\\s?moi\\s+)?(?:la\\s+veille|le\\s+jour\\s+d'\\s?avant))\\b",
      abans: "\\b(?:(?:et\\s+)?(?:previens\\s?-?\\s?moi\\s+)?)(NUM)\\s+(minutes?|min|heures?|jours?|semaines?)(?:\\s+et\\s+(?:MITJA))?\\s+(?:avant|a\\s+l'\\s?avance|plus\\s+tot)\\b",
      unitats: { minute: 'min', minutes: 'min', min: 'min', heure: 'h', heures: 'h', jour: 'd', jours: 'd', semaine: 's', semaines: 's', mois: 'm' },
      repDia: "\\b(?:tous\\s+les\\s+jours|chaque\\s+jour|quotidiennement)\\b",
      repFeiners: "\\b(?:en\\s+semaine|du\\s+lundi\\s+au\\s+vendredi|les\\s+jours\\s+ouvrables|chaque\\s+jour\\s+ouvrable)\\b",
      repCap: "\\b(?:le\\s+week-?\\s?end|les\\s+week-?\\s?ends|chaque\\s+week-?\\s?end)\\b",
      repDies: "\\b(?:chaque|tous\\s+les|les)\\s+((?:DIA)(?:\\s*(?:,|\\bet\\b)\\s*(?:les?\\s+)?(?:DIA))*)\\b",
      repSetmana: "\\b(?:chaque\\s+semaine|toutes\\s+les\\s+semaines)\\b",
      repMesDia: "\\b(?:le\\s+)?(\\d{1,2})\\s+de\\s+(?:chaque|tous\\s+les)\\s+mois\\b",
      repMes: "\\b(?:chaque\\s+mois|tous\\s+les\\s+mois|mensuellement)\\b",
      repAny: "\\b(?:chaque\\s+annee|tous\\s+les\\s+ans|annuellement)\\b",
      avui: "\\baujourd'?\\s?hui\\b",
      dema: "\\bdemain\\b",
      demaPassat: "\\b(?:apres\\s?-?\\s?demain)\\b",
      rel: "\\b(?:dans\\s+)(NUM)\\s+(minutes?|min|heures?|jours?|semaines?|mois)(?:\\s+et\\s+(MITJA))?\\b",
      relMitja: "\\bdans\\s+une\\s+demi\\s?-?\\s?heure\\b",
      setmanaVe: "\\b(?:la\\s+semaine\\s+prochaine|la\\s+semaine\\s+d'\\s?apres)\\b",
      mesVe: "\\b(?:le\\s+mois\\s+prochain)\\b",
      aquestaSetmana: "\\b(?:cette\\s+semaine)\\b",
      dia: "\\b(?:(?:ce|le)\\s+)?(DIA)(?:\\s+prochain)?\\b",
      data: "\\b(?:le\\s+)?(\\d{1,2}|1er)\\s+(MES)(?:\\s+(\\d{4}))?\\b",
      dataEl: "\\b(?:le)\\s+(\\d{1,2}|1er)\\b(?!\\s*(?:%|€|euros?|litres?|l\\b|kg|kilos?|grammes?|g\\b|minutes?|heures?|fois|ans?|metres?|cm|personnes))",
      hora: "\\b(?:a|vers)\\s+(NUM)\\s*(?:h|heures?)(?:\\s*(\\d{1,2}|et\\s+demie|et\\s+quart|moins\\s+le\\s+quart|moins\\s+(?:\\d{1,2}|cinq|dix|vingt)))?(?:\\s+(PER))?\\b",
      quarts: "(?!x)x",
      migdia: "\\b(?:a|vers)\\s+midi\\b",
      per: { 'du matin': 'mati', "de l'apres-midi": 'tarda', "de l'apres midi": 'tarda', 'du soir': 'vespre', 'de la nuit': 'vespre' },
      periodes: [["\\b(?:a\\s+la\\s+)?premiere\\s+heure\\b|\\b(?:tot\\s+le\\s+matin)\\b", 'primera'], ["\\b(?:ce|le|du|dans\\s+la)\\s+matin(?:ee)?\\b", 'mati'],
        ["\\b(?:cet|l'|dans\\s+l')\\s?apres\\s?-?\\s?midi\\b", 'tarda'], ["\\b(?:ce|le|dans\\s+la)\\s+soir(?:ee)?\\b", 'vespre'], ["\\b(?:cette|la)\\s+nuit\\b", 'vespre']],
      avuiPer: "\\b(?:ce\\s+matin|cet\\s+apres\\s?-?\\s?midi|ce\\s+soir|cette\\s+nuit)\\b",
      pregunta: "^(?:qu'?\\s?est\\s?-?\\s?ce\\s+que|que|quoi|quel|quelle|quels|quelles|quand|ou|comment|qui|combien|dis\\s?-?\\s?moi|lis\\s?-?\\s?moi|est\\s?-?\\s?ce\\s+que\\s+j'?\\s?ai|j'?\\s?ai\\s+quoi|tu\\s+te\\s+souviens)\\b",
      pendent: "\\b(?:en\\s+attente|a\\s+faire|qui\\s+reste)\\b",
      prepLloc: "(?:(?:au|a\\s+la|a\\s+l'|a|chez\\s+le|chez|du|de\\s+la|de\\s+l'|de|le|la|l')\\s*)?",
      verbs: "(?:acheter|prendre|ramener|apporter|chercher|recuperer|commander)",
      sep: "\\s*,\\s*|\\s+et\\s+",
      llista: "\\b(?:sur\\s+|a\\s+)?la\\s+liste(?:\\s+de\\s+courses|\\s+des\\s+courses|\\s+du|\\s+de)?\\b",
      buits: ['que', 'qu\'', 'de', 'd\'', 'et', 'pour', 'a', 'au', 'un', 'une', 'aussi', 's\'il te plait'],
      stop: "que qu quoi est ce j ai avais avons as dois de du des le la les a au aux et ou pour un une quel quelle quels quelles etait c note noter chose choses rien dis moi lis tu te souviens ou comment quand qui combien avec sans mon ma mes",
    },
    en: {
      salut: "(?:hey|hi|ok|okay|yo|listen)",
      ordre: "(?:please\\s+)?(?:note(?:\\s+(?:down|that))?|write\\s+down|jot\\s+down|put\\s+down|add|save|remember(?:\\s+(?:to|that))?|remind\\s+me(?:\\s+(?:to|that|about))?|take\\s+a\\s+note(?:\\s+that)?|make\\s+a\\s+note(?:\\s+that)?)",
      modal: "^(?:(?:that\\s+)?(?:i\\s+(?:have|need|got)\\s+to|i\\s+must|i\\s+should|i\\s+gotta|we\\s+need\\s+to))\\s+",
      avisSi: "\\b(?:and\\s+)?(?:remind\\s+me(?:\\s+about\\s+it)?|alert\\s+me|notify\\s+me|let\\s+me\\s+know|warn\\s+me)\\b",
      avisNo: "\\b(?:no\\s+(?:reminder|alert|notification)|without\\s+(?:a\\s+)?(?:reminder|alert)|don'?\\s?t\\s+remind\\s+me)\\b",
      abansDia: "\\b(?:(?:and\\s+)?(?:remind\\s+me\\s+)?the\\s+day\\s+before)\\b",
      abans: "\\b(?:(?:and\\s+)?(?:remind\\s+me\\s+)?)(NUM)\\s+(minutes?|mins?|hours?|days?|weeks?)(?:\\s+and\\s+a\\s+(?:MITJA))?\\s+(?:before|ahead|earlier|in\\s+advance)\\b",
      unitats: { minute: 'min', minutes: 'min', min: 'min', mins: 'min', hour: 'h', hours: 'h', day: 'd', days: 'd', week: 's', weeks: 's', month: 'm', months: 'm' },
      repDia: "\\b(?:every\\s+day|everyday|daily|each\\s+day)\\b",
      repFeiners: "\\b(?:on\\s+weekdays|every\\s+weekday|monday\\s+to\\s+friday|monday\\s+through\\s+friday)\\b",
      repCap: "\\b(?:on\\s+weekends|every\\s+weekend|at\\s+weekends)\\b",
      repDies: "\\b(?:every|each|on)\\s+((?:DIA)(?:\\s*(?:,|\\band\\b)\\s*(?:DIA))*)\\b",
      repSetmana: "\\b(?:every\\s+week|weekly|each\\s+week)\\b",
      repMesDia: "\\b(?:on\\s+)?the\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s+of\\s+(?:every|each)\\s+month\\b",
      repMes: "\\b(?:every\\s+month|monthly|each\\s+month)\\b",
      repAny: "\\b(?:every\\s+year|yearly|annually|each\\s+year)\\b",
      avui: "\\btoday\\b",
      dema: "\\btomorrow\\b",
      demaPassat: "\\b(?:the\\s+day\\s+after\\s+tomorrow)\\b",
      rel: "\\b(?:in\\s+)(NUM)\\s+(minutes?|mins?|hours?|days?|weeks?|months?)(?:\\s+and\\s+a\\s+(MITJA))?\\b",
      relMitja: "\\bin\\s+half\\s+an\\s+hour\\b",
      setmanaVe: "\\b(?:next\\s+week)\\b",
      mesVe: "\\b(?:next\\s+month)\\b",
      aquestaSetmana: "\\b(?:this\\s+week)\\b",
      dia: "\\b(?:(?:on|this|next|this\\s+coming|on\\s+the\\s+next)\\s+)?(DIA)\\b",
      data: "\\b(?:on\\s+)?(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+of)?\\s+(MES)(?:\\s+(\\d{4}))?\\b|\\b(?:on\\s+)?(MES)\\s+(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*,?\\s*(\\d{4}))?\\b",
      dataEl: "\\b(?:on\\s+the|the)\\s+(\\d{1,2})(?:st|nd|rd|th)\\b",
      hora: "\\b(?:at|around|by)\\s+(NUM)(?:\\s?[:.]\\s?(\\d{2}))?(?:\\s*(a\\.?\\s?m\\.?|p\\.?\\s?m\\.?|o'?\\s?clock))?(?:\\s+(PER))?\\b",
      horaAmPm: "\\b(\\d{1,2})(?::(\\d{2}))?\\s*(a\\.?\\s?m\\.?|p\\.?\\s?m\\.?)(?=\\W|$)",
      quarts: "\\b(?:at\\s+)?(half|(?:a\\s+)?quarter)\\s+(past|to)\\s+(NUM)(?:\\s+(PER))?\\b",
      migdia: "\\b(?:at\\s+)?(?:noon|midday)\\b",
      per: { 'in the morning': 'mati', 'in the afternoon': 'tarda', 'in the evening': 'vespre', 'at night': 'vespre' },
      periodes: [["\\b(?:first\\s+thing(?:\\s+in\\s+the\\s+morning)?)\\b", 'primera'], ["\\b(?:in\\s+the|this)\\s+morning\\b", 'mati'], ["\\b(?:in\\s+the|this)\\s+afternoon\\b", 'tarda'],
        ["\\b(?:in\\s+the|this)\\s+evening\\b|\\btonight\\b|\\bat\\s+night\\b", 'vespre']],
      avuiPer: "\\b(?:this\\s+(?:morning|afternoon|evening)|tonight)\\b",
      pregunta: "^(?:what|what'?\\s?s|whats|which|when|where|how|who|tell\\s+me|read\\s+me|do\\s+i\\s+have|have\\s+i\\s+got|did\\s+i|is\\s+there|are\\s+there)\\b",
      pendent: "\\b(?:pending|to\\s+do|left|outstanding)\\b",
      prepLloc: "(?:(?:at\\s+the|at|to\\s+the|to|from\\s+the|from|in\\s+the|in|the)\\s*)?",
      verbs: "(?:buy|get|pick\\s+up|bring|grab|order)",
      sep: "\\s*,\\s*|\\s+and\\s+",
      llista: "\\b(?:to|on)\\s+(?:the|my)\\s+(?:shopping\\s+)?list\\b",
      buits: ['that', 'to', 'and', 'for', 'at', 'of', 'also', 'please'],
      stop: 'what whats s do does did i have has had got to the a an and or for of at on in which is was are were note noted thing things anything something there tell me read remember where how when who with without my is it',
    },
  };

  // ---------------------------------------------------------------- compilació
  const CACHE = {};
  function regles(L, nom) {
    const k = L + '|' + nom;
    if (CACHE[k]) return CACHE[k];
    const r = R[L];
    const NUMS = '\\d{1,2}|' + alt(NUM[L]);
    const DIA = DIES[L].join('|');
    const MES = MESOS[L].join('|');
    const PER = alt(r.per);
    const sub = (s) => s.replace(/NUM/g, NUMS).replace(/DIA/g, DIA).replace(/MES/g, MES).replace(/PER/g, PER).replace(/MITJA/g, MITJA[L]);
    const noms = ['soci', 'socio', 'socia', 'associe', 'partner'];
    if (nom && !noms.includes(nom)) noms.unshift(nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const c = {};
    for (const [key, v] of Object.entries(r)) {
      if (typeof v === 'string' && !['sep', 'stop'].includes(key)) c[key] = P(sub(v));
    }
    c.inici = P('^[\\s,.:;!¡¿]*(?:' + r.salut + '[\\s,]+)?(?:' + noms.join('|') + ')\\b[\\s,.:;!]*');
    c.salutSol = P('^[\\s,.:;!¡¿]*' + r.salut + '\\b[\\s,.:;!]*');
    c.ordre = P('^[\\s,.:;]*' + sub(r.ordre) + '\\b[\\s,.:;!]*');
    c.periodes = r.periodes.map(([s, n]) => [P(sub(s)), n]);
    c.sep = new RegExp(r.sep, 'i');
    c.stop = new Set(r.stop.split(/\s+/));
    c.r = r;
    c.dies = DIES[L].map((d) => new RegExp('^(?:' + d + ')$'));
    c.mesos = MESOS[L].map((m) => new RegExp('^(?:' + m + ')$'));
    c.numDe = (s) => {
      if (s == null) return null;
      s = String(s).trim();
      if (/^\d+$/.test(s)) return +s;
      if (s === '1er') return 1;
      const x = NUM[L][s.replace(/\s+/g, ' ')];
      return x == null ? null : x;
    };
    c.diaDe = (s) => { const t = s.trim(); for (let i = 0; i < 7; i++) if (c.dies[i].test(t)) return i + 1; return null; };
    c.mesDe = (s) => { const t = s.trim(); for (let i = 0; i < 12; i++) if (c.mesos[i].test(t)) return i; return null; };
    return (CACHE[k] = c);
  }

  // ---------------------------------------------------------------- text amb esborrat
  class Text {
    constructor(s) { this.o = String(s); this.n = plana(s); }
    cerca(re) { const m = re.exec(this.n); return m; }
    treu(m) {
      if (!m) return;
      const a = m.index, b = a + m[0].length;
      const blanc = ' '.repeat(b - a);
      this.n = this.n.slice(0, a) + blanc + this.n.slice(b);
      this.o = this.o.slice(0, a) + blanc + this.o.slice(b);
    }
    /** cerca i treu; retorna el match o null */
    pren(re) { const m = this.cerca(re); if (m) this.treu(m); return m; }
    original(m) { return m ? this.o.substr(m.index, m[0].length) : ''; }
    resta() { return this.o.replace(/\s+/g, ' ').trim(); }
  }

  // ---------------------------------------------------------------- repeticions
  /** Pròxima data estrictament després de `d` (mateixa hora) segons la regla. */
  function seguent(rep, d) {
    if (!rep) return null;
    const x = new Date(d);
    if (rep.t === 'dia') return sumaDies(x, 1);
    if (rep.t === 'setmana') {
      const dies = rep.dies && rep.dies.length ? rep.dies : [diaSet(x)];
      for (let i = 1; i <= 7; i++) { const y = sumaDies(x, i); if (dies.includes(diaSet(y))) return y; }
      return sumaDies(x, 7);
    }
    if (rep.t === 'mes') {
      const dia = rep.dia || x.getDate();
      let a = x.getFullYear(), m = x.getMonth() + 1;
      if (m > 11) { m = 0; a++; }
      return new Date(a, m, Math.min(dia, diesMes(a, m)), x.getHours(), x.getMinutes());
    }
    if (rep.t === 'any') {
      const a = x.getFullYear() + 1, m = x.getMonth();
      return new Date(a, m, Math.min(x.getDate(), diesMes(a, m)), x.getHours(), x.getMinutes());
    }
    return null;
  }
  /** Primera ocurrència a partir d'ara (inclòs avui si encara no ha passat). */
  function primera(rep, ara, h, m, base) {
    let d = ambHora(base || ara, h, m);
    if (rep.t === 'mes' && rep.dia) {
      d = new Date(d.getFullYear(), d.getMonth(), Math.min(rep.dia, diesMes(d.getFullYear(), d.getMonth())), h, m);
      if (d <= ara) d = seguent(rep, d);
      return d;
    }
    if (rep.t === 'setmana' && rep.dies && rep.dies.length && !rep.dies.includes(diaSet(d))) return seguent(rep, d);
    if (d <= ara) d = seguent(rep, d);
    return d;
  }

  // ---------------------------------------------------------------- anàlisi
  const HORES_DEF = { defecte: 9, primera: 8, mati: 9, migdia: 13, tarda: 17, vespre: 21 };

  function analitza(entrada, op) {
    op = op || {};
    const L = R[op.L] ? op.L : 'ca';
    const ara = op.ara ? new Date(op.ara) : new Date();
    const hores = Object.assign({}, HORES_DEF, op.hores || {});
    const c = regles(L, plana(op.nom || 'soci').trim());
    const original = String(entrada || '').trim();
    const t = new Text(original.replace(/[¿¡]/g, ' '));
    const res = { tipus: 'buit', original, llengua: L };

    // 1. salutació + nom de l'assistent
    if (!t.pren(c.inici)) t.pren(c.salutSol);

    // 2. pregunta o ordre?
    const teOrdre = c.ordre.test(t.n.replace(/^\s+/, ''));
    const esPregunta = !teOrdre && (c.pregunta.test(t.n.trim()) || /\?\s*$/.test(original));
    if (teOrdre) {
      const m = t.cerca(c.ordre);
      if (m) {
        // «remind me to / recorda'm» també vol dir avís
        if (/remind|recorda\s?-?\s?'?\s?m|recuerdame|rappelle/.test(m[0])) res.avisOrdre = true;
        t.treu(m);
      }
    }

    // 3. avís sí / no, i avís previ
    let avis = null;
    if (t.pren(c.avisNo)) avis = false;
    let abans = 0;
    let m = t.pren(c.abansDia);
    if (m) { abans = 1440; avis = avis === false ? false : true; }
    else if ((m = t.pren(c.abans))) {
      const n = c.numDe(m[1]) || 1;
      const u = c.r.unitats[m[2].toLowerCase()] || 'min';
      const mitja = /\s(?:i|y|et|and\s+a)\s+/.test(m[0]) && new RegExp(MITJA[L]).test(m[0]) ? 0.5 : 0;
      abans = Math.round((n + mitja) * ({ min: 1, h: 60, d: 1440, s: 10080 }[u] || 1));
      avis = avis === false ? false : true;
    }
    if (avis !== false && (t.pren(c.avisSi) || res.avisOrdre)) avis = true;
    // pot quedar un segon «avisa'm»
    while (t.pren(c.avisSi)) { /* fora */ }

    // 4. repetició
    let rep = null;
    if (t.pren(c.repFeiners)) rep = { t: 'setmana', dies: [1, 2, 3, 4, 5] };
    else if (t.pren(c.repCap)) rep = { t: 'setmana', dies: [6, 7] };
    else if ((m = t.pren(c.repMesDia))) rep = { t: 'mes', dia: +(m[1] || m[2]) };
    else if (t.pren(c.repDia)) rep = { t: 'dia' };
    else if (t.pren(c.repSetmana)) rep = { t: 'setmana' };
    else if (t.pren(c.repMes)) rep = { t: 'mes' };
    else if (t.pren(c.repAny)) rep = { t: 'any' };
    else if ((m = t.cerca(c.repDies))) {
      // «els dilluns» és repetició; en anglès «on monday» (singular) no
      const dies = [];
      for (const p of m[1].split(/\s*(?:,|\bi\b|\by\b|\bet\b|\band\b)\s*/)) {
        const d = c.diaDe(p.replace(/^(?:els?|los?|les?)\s+/, ''));
        if (d && !dies.includes(d)) dies.push(d);
      }
      const prefix = m[0].trim().split(/\s+/)[0];
      const plural = /s\s*$/.test(m[1].trim()) && !/^(?:dilluns|dimarts|dimecres|dijous|divendres|lunes|martes|miercoles|jueves|viernes)$/.test(m[1].trim());
      const esRep = L === 'en' ? (prefix !== 'on' || plural) : (L === 'fr' ? (prefix !== 'les' || plural || dies.length > 1) : true);
      if (dies.length && esRep) { rep = { t: 'setmana', dies: dies.sort() }; t.treu(m); }
    }

    // 5. data
    let dia = null, exacta = null, setmanaVe = false, periodeAvui = false, rang = null;
    if ((m = t.pren(c.relMitja))) exacta = new Date(ara.getTime() + 30 * 60000);
    else if ((m = t.pren(c.rel))) {
      const n = c.numDe(m[1]) || 1;
      const u = c.r.unitats[m[2].toLowerCase()] || 'min';
      const mig = m[3] ? 0.5 : 0;
      if (u === 'min' || u === 'h') exacta = new Date(ara.getTime() + (n + mig) * (u === 'h' ? 3600000 : 60000));
      else if (u === 'd') dia = sumaDies(D0(ara), n);
      else if (u === 's') dia = sumaDies(D0(ara), 7 * n);
      else if (u === 'm') { dia = D0(ara); dia.setMonth(dia.getMonth() + n); }
    }
    if (t.pren(c.setmanaVe)) setmanaVe = true;
    if (t.pren(c.aquestaSetmana)) rang = 'setmana';
    if (!exacta && !dia) {
      if (t.cerca(c.avuiPer)) periodeAvui = true;
      if (t.pren(c.demaPassat)) dia = sumaDies(D0(ara), 2);
      else if (t.pren(c.dema)) dia = sumaDies(D0(ara), 1);
      else if (t.pren(c.avui)) dia = D0(ara);
      else if (t.pren(c.mesVe)) { dia = D0(ara); dia.setMonth(dia.getMonth() + 1); }
    }
    let diaSetmana = null;
    if (!exacta && !dia) {
      if ((m = t.pren(c.data))) {
        let dd, mm, aa;
        if (L === 'en' && m[4]) { mm = c.mesDe(m[4]); dd = +m[5]; aa = m[6] ? +m[6] : null; }
        else { dd = c.numDe(m[1]); mm = c.mesDe(m[2]); aa = m[3] ? +m[3] : null; }
        if (mm != null && dd >= 1 && dd <= 31) {
          let a = aa || ara.getFullYear();
          let x = new Date(a, mm, Math.min(dd, diesMes(a, mm)));
          if (!aa && x < D0(ara)) x = new Date(a + 1, mm, Math.min(dd, diesMes(a + 1, mm)));
          dia = x;
        }
      } else if ((m = t.pren(/\b(\d{1,2})\s?[/-]\s?(\d{1,2})(?:\s?[/-]\s?(\d{2,4}))?\b/))) {
        const dd = +m[1], mm = +m[2] - 1;
        let a = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : ara.getFullYear();
        if (mm >= 0 && mm < 12 && dd >= 1 && dd <= 31) {
          let x = new Date(a, mm, Math.min(dd, diesMes(a, mm)));
          if (!m[3] && x < D0(ara)) x = new Date(a + 1, mm, Math.min(dd, diesMes(a + 1, mm)));
          dia = x;
        }
      } else if (!rep && (m = t.cerca(c.dia))) {
        const d = c.diaDe(m[1]);
        if (d) { diaSetmana = d; t.treu(m); }
      }
    }
    if (!exacta && !dia && !diaSetmana && !(rep && rep.t === 'mes') && (m = t.cerca(c.dataEl))) {
      const dd = c.numDe(m[1]);
      if (dd >= 1 && dd <= 31) {
        t.treu(m);
        let x = new Date(ara.getFullYear(), ara.getMonth(), Math.min(dd, diesMes(ara.getFullYear(), ara.getMonth())));
        if (x < D0(ara)) { const n = new Date(ara.getFullYear(), ara.getMonth() + 1, 1); x = new Date(n.getFullYear(), n.getMonth(), Math.min(dd, diesMes(n.getFullYear(), n.getMonth()))); }
        dia = x;
      }
    }

    // 6. hora
    let h = null, mi = 0, periode = null, horaExplicita = false;
    const perDe = (s) => (s ? c.r.per[plana(s).replace(/\s+/g, ' ').trim()] || null : null);
    const minutsDe = (s) => {
      if (s == null) return 0;
      s = plana(s).replace(/\s+/g, ' ').trim();
      if (/^\d+$/.test(s)) return +s;
      if (/^(?:mitja|media|et demie)$/.test(s)) return 30;
      if (/^(?:quart|cuarto|et quart)$/.test(s)) return 15;
      if (/^tres quarts$/.test(s)) return 45;
      if (/^(?:vint-?\s?i-?\s?cinc|veinticinco)$/.test(s)) return 25;
      if (s === 'moins le quart') return -15;
      const mm = /^moins (.+)$/.exec(s); if (mm) return -(c.numDe(mm[1]) || 0);
      return c.numDe(s) || 0;
    };
    if ((m = t.pren(c.quarts))) {
      if (L === 'en') {
        const n = c.numDe(m[3]);
        if (n != null) { const q = /half/.test(m[1]) ? 30 : 15; if (m[2] === 'past') { h = n; mi = q; } else { h = n - 1; mi = 60 - q; } periode = perDe(m[4]); horaExplicita = true; }
      } else {
        const q = { un: 1, dos: 2, tres: 3 }[m[1]];
        const n = c.numDe(m[2]);
        if (n != null) { h = (n + 11) % 12 || 12; mi = 15 * q; periode = perDe(m[3]); horaExplicita = true; }
      }
    }
    if (h == null && (m = t.pren(c.hora))) {
      h = c.numDe(m[1]);
      if (L === 'en') {
        mi = m[2] ? +m[2] : 0;
        const ap = (m[3] || '').replace(/[\s.]/g, '');
        if (ap === 'pm') periode = 'pm'; else if (ap === 'am') periode = 'am'; else periode = perDe(m[4]);
      } else {
        mi = minutsDe(m[2]);
        if (m[3]) mi -= minutsDe(m[3]);
        periode = perDe(m[4]);
      }
      if (mi < 0) { h -= 1; mi += 60; }
      horaExplicita = h != null;
    }
    if (h == null && c.horaAmPm && (m = t.pren(c.horaAmPm))) {
      h = +m[1]; mi = m[2] ? +m[2] : 0; periode = /p/.test(m[3]) ? 'pm' : 'am'; horaExplicita = true;
    }
    if (h == null && (m = t.pren(/\b(\d{1,2})\s?(?::|h)\s?(\d{2})\b|\b(\d{1,2})\s?h\b/))) {
      h = +(m[1] || m[3]); mi = m[2] ? +m[2] : 0; horaExplicita = true; periode = '24';
    }
    if (h == null && t.pren(c.migdia)) { h = L === 'fr' || L === 'en' ? 12 : hores.migdia; mi = 0; horaExplicita = true; periode = '24'; }
    for (const [re, nom] of c.periodes) {
      const mm = t.cerca(re);
      if (mm) { t.treu(mm); if (h == null) { h = hores[nom]; mi = 0; periode = '24'; } else if (!periode) periode = nom; break; }
    }
    if (periodeAvui && !dia && !exacta) dia = D0(ara);
    if (h != null && h > 24) h = null;
    if (h != null && periode !== '24') {
      if ((periode === 'tarda' || periode === 'vespre' || periode === 'pm') && h < 12) h += 12;
      else if ((periode === 'mati' || periode === 'am') && h === 12) h = 0;
      else if (!periode && h >= 1 && h <= 7) h += 12; // «a les 5» = 17 h
    }

    // 7. lloc (marques, llocs coneguts de l'usuari i genèrics)
    let lloc = '', prep = '';
    const candidats = [];
    for (const x of op.llocs || []) if (x && x.trim()) candidats.push([plana(x).trim(), x.trim(), null]);
    for (const x of MARQUES) candidats.push([x, null, (PREP_MARCA[L] || {})[x] || null]);
    for (const [p, bonic, pr] of LLOCS[L]) candidats.push([p, bonic, pr]);
    candidats.sort((a, b) => b[0].length - a[0].length);
    for (const [p, bonic, pr] of candidats) {
      const re = P('(^|[\\s,])(' + c.r.prepLloc + ')(' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+') + ')(?=$|[\\s,.;:!?])');
      const mm = t.cerca(re);
      if (!mm) continue;
      const nomOrig = t.o.substr(mm.index + mm[1].length + mm[2].length, mm[3].length);
      const esMarca = MARQUES.includes(p);
      lloc = bonic || (esMarca ? nomOrig.replace(/\b\p{L}/gu, (x) => x.toUpperCase()) : cap(nomOrig));
      if (esMarca && !bonic) lloc = lloc.replace(/^Makro$/i, 'Makro');
      const dit = mm[2].trim();
      prep = /^(?:al|a la|a l'|a|en el|en la|en|au|a la|chez le|chez|at the|at|to the|to)$/.test(dit.replace(/\s+/g, ' ')) ? t.o.substr(mm.index + mm[1].length, mm[2].length).trim() : (pr || PREP_DEF[L]);
      if (L === 'fr' && prep === 'a') prep = 'à';
      t.treu({ index: mm.index + mm[1].length, 0: mm[2] + mm[3] });
      break;
    }

    // 8. llista d'articles («a la llista del Macro: ...»)
    let esLlista = !!t.pren(c.llista);

    // 9. el que queda
    let resta = t.resta().replace(/^[\s,.:;!?-]+|[\s,.:;!?-]+$/g, '').replace(/\s+([,.;:!?])/g, '$1').replace(/,(\s*,)+/g, ',');
    const netejaVores = (s) => {
      let canvi = true;
      while (canvi) {
        canvi = false;
        const n = plana(s);
        for (const b of c.r.buits) {
          const bb = plana(b);
          if (n === bb) { s = ''; canvi = true; break; }
          if (n.startsWith(bb + ' ') || n.startsWith(bb + ',')) { s = s.slice(bb.length).replace(/^[\s,]+/, ''); canvi = true; break; }
          if (n.endsWith(' ' + bb) || n.endsWith(',' + bb)) { s = s.slice(0, -bb.length).replace(/[\s,]+$/, ''); canvi = true; break; }
        }
        s = s.replace(/^[\s,.:;!?'-]+|[\s,.:;!?-]+$/g, '');
      }
      return s;
    };
    resta = netejaVores(resta);
    const mod = c.modal.exec(plana(resta));
    if (mod) resta = resta.slice(mod[0].length);
    resta = netejaVores(resta);

    // ---------------- pregunta
    if (esPregunta) {
      res.tipus = 'pregunta';
      let de = null, a = null;
      const fiDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
      if (rang === 'setmana' && !setmanaVe) { de = D0(ara); a = fiDia(sumaDies(D0(ara), 7 - diaSet(ara))); }
      else if (setmanaVe && !diaSetmana) { const dl = sumaDies(D0(ara), 8 - diaSet(ara)); de = dl; a = fiDia(sumaDies(dl, 6)); }
      else if (diaSetmana) { const d = properDia(diaSetmana, ara, setmanaVe, true); de = d; a = fiDia(d); }
      else if (dia) { de = D0(dia); a = fiDia(dia); }
      res.rang = de ? { de, a } : null;
      res.pendents = c.pendent.test(plana(resta));
      const termes = plana(resta).replace(c.pendent, ' ').split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !c.stop.has(w));
      res.termes = termes;
      if (lloc) res.lloc = lloc;
      return res;
    }

    // ---------------- ordre d'apuntar
    // llista d'articles: «comprar patates, oli i llet» o «a la llista: ...»
    let items = [];
    const mV = P('^(' + c.r.verbs + ')\\s+(.+)$').exec(plana(resta));
    let verb = '';
    let cos = resta;
    if (mV) { verb = resta.slice(0, mV[1].length); cos = resta.slice(mV[1].length).trim(); }
    if (mV || esLlista) {
      const parts = cos.split(c.sep).map((s) => netejaVores(s.trim())).filter(Boolean);
      if (parts.length >= 2 || (esLlista && parts.length >= 1)) items = parts;
    } else if (lloc) {
      // «al Mercadona llet, ous i oli»: amb lloc i enumeració curta, també és una llista
      const parts = resta.split(c.sep).map((s) => netejaVores(s.trim())).filter(Boolean);
      if (parts.length >= 2 && parts.every((p) => p.split(/\s+/).length <= 4)) { items = parts; esLlista = true; }
    }
    let text = resta;
    if (items.length && !verb && esLlista) text = '';
    res.items = items;
    res.esLlista = esLlista;
    res.verb = verb;

    // quan
    let quan = null;
    const hh = h != null ? h : hores.defecte, mm2 = h != null ? mi : 0;
    if (exacta) { quan = exacta; horaExplicita = true; }
    else if (rep) {
      let base = dia || null;
      if (!base && diaSetmana) base = properDia(diaSetmana, ara, setmanaVe, false);
      if (rep.t === 'setmana' && !rep.dies) rep.dies = [diaSet(base || ara)];
      quan = primera(rep, ara, hh, mm2, base);
    } else if (dia) {
      quan = ambHora(dia, hh, mm2);
      if (quan <= ara && D0(dia).getTime() === D0(ara).getTime()) {
        if (h != null && periode == null && h < 12 && ambHora(dia, h + 12, mi) > ara) quan = ambHora(dia, h + 12, mi);
        else if (h == null) { quan = new Date(Math.ceil((ara.getTime() + 3600000) / 300000) * 300000); horaExplicita = false; }
      }
    } else if (diaSetmana) {
      let d = properDia(diaSetmana, ara, setmanaVe, false);
      quan = ambHora(d, hh, mm2);
      if (D0(d).getTime() === D0(ara).getTime() && quan <= ara) quan = ambHora(sumaDies(d, 7), hh, mm2);
    } else if (h != null) {
      quan = ambHora(ara, h, mi);
      if (quan <= ara) {
        if (periode == null && h < 12 && ambHora(ara, h + 12, mi) > ara) quan = ambHora(ara, h + 12, mi);
        else quan = ambHora(sumaDies(ara, 1), h, mi);
      }
    } else if (setmanaVe) {
      quan = ambHora(sumaDies(D0(ara), 7), hh, 0);
    }
    if (!quan && avis === true) {
      // «apunta X, avisa'm» sense data: a l'hora per defecte d'avui, o de demà si ja ha passat
      quan = ambHora(ara, hores.defecte, 0);
      if (quan <= ara) quan = ambHora(sumaDies(ara, 1), hores.defecte, 0);
    }
    if (quan && !horaExplicita && h != null) horaExplicita = true;

    res.tipus = text || items.length || lloc ? 'afegeix' : 'buit';
    res.text = cap(text || (items.length ? cap(verb || '') : '') || '');
    res.lloc = lloc;
    res.prep = prep;
    res.quan = quan;
    res.horaExplicita = !!(quan && horaExplicita);
    res.rep = rep;
    res.avis = quan ? (avis == null ? op.avisDefecte !== false : avis) : false;
    res.abans = res.avis ? abans : 0;
    return res;
  }

  /** Pròxim dia de la setmana d (1-7). Si avui és d: avui (siAvui) o d'aquí 7 dies. */
  function properDia(d, ara, setmanaVe, siAvui) {
    const hoy = D0(ara);
    let n = (d - diaSet(hoy) + 7) % 7;
    if (n === 0 && !siAvui) n = 0; // es decideix després segons l'hora
    let x = sumaDies(hoy, n);
    if (setmanaVe) {
      const dlVinent = sumaDies(hoy, 8 - diaSet(hoy));
      while (x < dlVinent) x = sumaDies(x, 7);
    }
    return x;
  }

  // ---------------------------------------------------------------- frases
  const TXT = {
    ca: { avui: 'avui', dema: 'demà', dies: ['dilluns', 'dimarts', 'dimecres', 'dijous', 'divendres', 'dissabte', 'diumenge'],
      mesos: ['de gener', 'de febrer', 'de març', 'd\'abril', 'de maig', 'de juny', 'de juliol', 'd\'agost', 'de setembre', 'd\'octubre', 'de novembre', 'de desembre'],
      hora: (h, m) => (h === 1 || h === 13 ? 'a la ' : 'a les ') + h + (m ? ':' + String(m).padStart(2, '0') : ''), el: (d, mes) => 'el ' + d + ' ' + mes },
    es: { avui: 'hoy', dema: 'mañana', dies: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'],
      mesos: ['de enero', 'de febrero', 'de marzo', 'de abril', 'de mayo', 'de junio', 'de julio', 'de agosto', 'de septiembre', 'de octubre', 'de noviembre', 'de diciembre'],
      hora: (h, m) => (h === 1 || h === 13 ? 'a la ' : 'a las ') + h + (m ? ':' + String(m).padStart(2, '0') : ''), el: (d, mes) => 'el ' + d + ' ' + mes },
    fr: { avui: 'aujourd\'hui', dema: 'demain', dies: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'],
      mesos: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
      hora: (h, m) => 'à ' + h + ' h' + (m ? ' ' + String(m).padStart(2, '0') : ''), el: (d, mes) => 'le ' + d + ' ' + mes },
    en: { avui: 'today', dema: 'tomorrow', dies: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      mesos: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      hora: (h, m) => 'at ' + h + ':' + String(m || 0).padStart(2, '0'), el: (d, mes) => 'on ' + mes + ' ' + d },
  };
  /** «dijous a les 9», «demà a les 17:30», «el 15 de desembre a les 9» */
  function quanText(d, L, ara, ambHoraSempre) {
    if (!d) return '';
    d = new Date(d); ara = ara ? new Date(ara) : new Date();
    const T = TXT[L] || TXT.ca;
    const dif = Math.round((D0(d) - D0(ara)) / 86400000);
    let s;
    if (dif === 0) s = T.avui;
    else if (dif === 1) s = T.dema;
    else if (dif > 1 && dif < 7) s = T.dies[diaSet(d) - 1];
    else s = T.el(d.getDate(), T.mesos[d.getMonth()]);
    if (ambHoraSempre !== false) s += ' ' + T.hora(d.getHours(), d.getMinutes());
    return s;
  }
  function llocText(e, L) {
    if (!e.lloc) return '';
    let p = e.prep || (L === 'ca' && (PREP_MARCA.ca[plana(e.lloc)] || '')) || PREP_DEF[L] || '';
    if (L === 'ca' && p === 'a' && /^[aeiouh]/i.test(plana(e.lloc))) p = 'a l\'';
    return p.endsWith('\'') ? p + e.lloc : p + ' ' + e.lloc;
  }
  /** Què s'ha d'anunciar: «comprar patates al Macro» */
  function queText(e, L) {
    let s = e.text || '';
    const its = (e.items || []).filter((x) => !(x && x.fet)).map((x) => (typeof x === 'string' ? x : x.t));
    if (!s && its.length) s = unir(its, L);
    else if (its.length && !/,/.test(s) && /^\S+$/.test(s.trim())) s += ' ' + unir(its, L);
    const ll = llocText(e, L);
    if (ll && !plana(s).includes(plana(e.lloc))) s = s ? s + ' ' + ll : cap(e.lloc);
    return s.charAt(0).toLowerCase() + s.slice(1);
  }
  function unir(v, L) {
    const i = { ca: ' i ', es: ' y ', fr: ' et ', en: ' and ' }[L] || ' i ';
    return v.length <= 1 ? v.join('') : v.slice(0, -1).join(', ') + i + v[v.length - 1];
  }
  const FR = {
    ca: { recorda: 'Recorda: {x}.', previ: '{q}: {x}.', apuntat: 'Apuntat: {x}.', avisare: ' T\'avisaré.' },
    es: { recorda: 'Recuerda: {x}.', previ: '{q}: {x}.', apuntat: 'Apuntado: {x}.', avisare: ' Te avisaré.' },
    fr: { recorda: 'Rappel : {x}.', previ: '{q} : {x}.', apuntat: 'C\'est noté : {x}.', avisare: ' Je te préviendrai.' },
    en: { recorda: 'Reminder: {x}.', previ: '{q}: {x}.', apuntat: 'Noted: {x}.', avisare: ' I\'ll remind you.' },
  };
  const f = (s, v) => s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));
  /** Frase que diu l'avís quan arriba l'hora */
  function fraseAvis(e, L) { return f((FR[L] || FR.ca).recorda, { x: queText(e, L) }); }
  /** Frase de l'avís previ («Demà a les 9: comprar patates al Macro.») */
  function frasePrevia(e, L) {
    if (!e.quan || !e.abans) return '';
    const quan = new Date(e.quan);
    const ara = new Date(quan.getTime() - e.abans * 60000);
    return f((FR[L] || FR.ca).previ, { q: cap(quanText(quan, L, ara)), x: queText(e, L) });
  }
  /** Confirmació quan s'apunta */
  function fraseConfirma(e, L, ara) {
    let x = queText(e, L);
    if (e.quan) x += ', ' + quanText(e.quan, L, ara, e.horaExplicita !== false || true);
    return f((FR[L] || FR.ca).apuntat, { x }) + (e.avis ? (FR[L] || FR.ca).avisare : '');
  }

  g.Interpret = { analitza, seguent, primera, quanText, queText, llocText, fraseAvis, frasePrevia, fraseConfirma, unir, plana, diaSet, TXT };
})(typeof window !== 'undefined' ? window : globalThis);
