# Xoriguer Soci

Assistent de veu per a Android: li dius què has de fer i quan, ho apunta i t'ho recorda **parlant**.

> «Hey Soci, apunta: Macro, comprar patates el dijous, avisa'm»
> → dijous, notificació i veu: «Recorda: comprar patates al Macro».

- **Dicta o escriu** en català, castellà, francès o anglès. Queda apuntat amb el dictat original.
- **Entén** dies, hores, «d'aquí 20 minuts», «a dos quarts de sis», repeticions («cada dilluns») i avís previ («el dia abans»).
- **Llistes per lloc**: «apunta al Mercadona llet, ous i oli».
- **Preguntes**: «què tinc demà?», «què havia de comprar al Macro?».
- **Avís amb veu** i botons Fet / +10 min / +1 h / Demà. Respecta el silenci, les trucades i les hores de nit.
- **Giny**, botó a la **barra ràpida** i drecera a la icona: un toc i ja escolta.
- Agenda, notes, resum del matí i còpia diària a Documents/Soci.

**Privadesa:** l'app no té permís d'Internet. El reconeixement de veu el fa el servei de veu del mòbil.

## Instal·lar
Baixa `XoriguerSoci.apk` de les [Releases](https://github.com/Xorigu3r/xoriguer-soci/releases), instal·la-la i
dona-li els permisos des d'**Ajustos** (micròfon, notificacions, alarmes exactes i bateria sense restriccions).

La [versió web](https://xorigu3r.github.io/xoriguer-soci/) serveix per provar-la: només avisa amb la pàgina oberta.

## Construir
`npm install` i `npm run apk` (Capacitor 8, JDK 21 i SDK d'Android a `~/android-tools`). Proves: `npm test`.

Família Xoriguer · https://xoriguer.dev/
