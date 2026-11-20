"""Baixa el model de veu català de Vosk (sense connexió) per a «hey soci» i el posa a android/app/src/main/assets/model-ca.

Ús: python -I eines/baixa_model.py [fitxer.zip ja baixat]
El model (Apache 2.0, https://alphacephei.com/vosk/models) no va al repo: ocupa ~85 MB descomprimit.
"""
import sys
import urllib.request
import zipfile
from pathlib import Path

URL = 'https://alphacephei.com/vosk/models/vosk-model-small-ca-0.4.zip'
ARREL = Path(__file__).resolve().parent.parent
DESTI = ARREL / 'android' / 'app' / 'src' / 'main' / 'assets' / 'model-ca'
# fitxers que Vosk no fa servir en temps real
FORA = {'README', 'graph/phones/align_lexicon.txt'}


def main():
    zp = Path(sys.argv[1]) if len(sys.argv) > 1 else ARREL / 'eines' / 'model-ca.zip'
    if not zp.exists():
        print('Baixant', URL)
        urllib.request.urlretrieve(URL, zp)
    DESTI.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zp) as z:
        for i in z.infolist():
            if i.is_dir():
                continue
            rel = i.filename.split('/', 1)[1]
            if rel in FORA:
                continue
            f = DESTI / rel
            f.parent.mkdir(parents=True, exist_ok=True)
            f.write_bytes(z.read(i))
    # StorageService.unpack de Vosk torna a copiar el model si aquest uuid canvia
    (DESTI / 'uuid').write_text('vosk-model-small-ca-0.4\n', encoding='utf-8')
    mida = sum(f.stat().st_size for f in DESTI.rglob('*') if f.is_file())
    print(f'Model a {DESTI} ({mida / 1e6:.1f} MB)')


if __name__ == '__main__':
    main()
