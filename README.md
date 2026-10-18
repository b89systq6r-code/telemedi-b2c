# Telemedi B2C: kohorty i lejki (zadanie rekrutacyjne, Head of B2C)

Autor: Sebastian Szablewski. Praca z AI: Claude (Claude Code).

- **Narzędzie:** `index.html` (kopia `dist/index.html`), jedna strona bez instalacji. Działa offline i na GitHub Pages.
- **Ślad pracy:** `notes/WORKLOG.md` (chronologicznie, łącznie ze ślepymi uliczkami) + historia commitów.

## Co jest w narzędziu
| Zakładka | Na jakie pytanie odpowiada |
|---|---|
| Czy to wzrost? | Werdykt: dashboard vs dane po czyszczeniu, retencja, poranny szczyt, zdarzenia znalezione w danych |
| Kohorty | Gdzie tracimy, gdzie zyskujemy (zł/mies., rok do roku, mostek miks/wynik) + kohorty dzienne/tygodniowe/miesięczne z filtrami |
| Lejki | Gdzie i od kiedy tracimy pacjentów: okres A vs B, konwersja kroków w segmentach, szereg czasowy kroku |
| Kanały i CAC | W co inwestować: opłacalność kampanii, koszt kolejnego pacjenta, rekomendacja i symulator budżetu |
| Priorytety | Co robić po kolei: wartość, sposób pomiaru, czas wdrożenia |
| Czego nie rozstrzygniemy | Czego dane nie mówią i jaki test to domknie |
| Dane i metoda | Problemy w danych i założenia |

## Struktura
| Plik | Co robi |
|---|---|
| `src/load.py` | surowe CSV → DuckDB (`raw_*`) |
| `src/q.py` | zapytania ad hoc z audytu (SQL ze stdin) |
| `src/build.py` | warstwa czysta: deduplikacja, wykluczenie kont QA, strefy czasowe, atrybucja, marża (założenia A1–A6 w nagłówku) |
| `src/daily_scan.py` | skan anomalii dziennych i lejek tygodniowy |
| `src/export.py` | eksport danych pacjent/sesja do `tool/data.js` |
| `tool/*` | narzędzie (HTML/CSS/JS, bez frameworka) |
| `src/build_tool.py` | składa `dist/index.html` |

## Odtworzenie
```
pip install duckdb pandas numpy
# CSV z paczki zadania → data/raw/
python3 src/load.py && python3 src/build.py && python3 src/export.py && python3 src/build_tool.py
```
Dane wejściowe nie są w repozytorium (ok. 80 MB, paczka od Telemedi).
