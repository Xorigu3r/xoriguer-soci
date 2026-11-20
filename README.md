# Xoriguer Soci

Assistent de veu per a Android: li dius què has de fer i quan, ho apunta i t'ho recorda **parlant**.

> «Hey Soci, apunta: Macro, comprar patates el dijous, avisa'm»
> → dijous, notificació i veu: «Recorda: comprar patates al Macro».

- **Dicta o escriu** en català, castellà, francès o anglès. Queda apuntat amb el dictat original.
- **Entén** dies, hores, «d'aquí 20 minuts», «a dos quarts de sis», repeticions («cada dilluns») i avís previ («el dia abans»).
- **Llistes per lloc**: «apunta al Mercadona llet, ous i oli».
- **Preguntes**: «què tinc demà?», «què havia de comprar al Macro?». Pot incloure el calendari del mòbil.
- **Canvia-ho parlant**: «ja he comprat la llet», «mou el dentista a divendres», «posposa-ho una hora», «i també ous», «desfés».
- **Insisteix** fins que ho marquis com a fet: «recorda'm la pastilla cada dia a les 9 fins que ho faci».
- **«Hey soci»** sempre escoltant, sense connexió (opcional, amb interruptor).
- **Avisos per lloc**: «quan arribi al Mercadona compra llet», «quan surti de la feina truca a la mare». «On he aparcat?»
- **Respon parlant** a l'avís: «fet», «d'aquí 10 minuts», «demà», també amb el mòbil bloquejat.
- «Cada 2 setmanes», «el primer dilluns de cada mes», «quants dies falten per les vacances?».
- **Assistent del mòbil**: mantén premut el botó d'inici o el dels auriculars i t'escolta. Comparteix → Soci des de qualsevol app.
- **Avís amb veu** i botons Fet / +10 min / +1 h / Demà. Respecta el silenci, les trucades i les hores de nit.
- **Giny**, botó a la **barra ràpida** i drecera a la icona: un toc i ja escolta.
- Agenda, notes, resum del matí i còpia diària a Documents/Soci.

**Privadesa:** l'app no té permís d'Internet. El reconeixement de veu el fa el servei de veu del mòbil.

## Instal·lar
Baixa `XoriguerSoci.apk` de les [Releases](https://github.com/Xorigu3r/xoriguer-soci/releases), instal·la-la i
dona-li els permisos des d'**Ajustos** (micròfon, notificacions, alarmes exactes i bateria sense restriccions).

La [versió web](https://xorigu3r.github.io/xoriguer-soci/) serveix per provar-la: només avisa amb la pàgina oberta.

## Construir
`npm install`, `python -I eines/baixa_model.py` (model de veu català de Vosk, Apache 2.0) i `npm run apk` (Capacitor 8, JDK 21 i SDK d'Android a `~/android-tools`). Proves: `npm test`.

Família Xoriguer · https://xoriguer.dev/
