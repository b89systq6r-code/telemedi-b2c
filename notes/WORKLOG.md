# Dziennik pracy: Telemedi B2C, zadanie rekrutacyjne

Sebastian Szablewski + Claude (Opus, Claude Code w chmurze). Stack: Python + DuckDB do analizy, statyczny HTML/JS jako narzędzie.
Zapis prowadzony na bieżąco, w kolejności. Ślepe uliczki zostają.

## 2026-10-18, krok 0: setup
- Dane: 19 plików CSV + README. Ładuję je do DuckDB (`src/load.py`) jako tabele `raw_*`, na razie bez czyszczenia.
- Tabele mają się do siebie tak: sessions 459 557, events 494 605, orders 65 882 wiersze, users 52 422, go 4 227, spend 5 676. Zgadza się z nagłówkiem zadania (459 557 sesji, 52 422 kont).

## Krok 1: audyt danych (`src/q.py`, ad hoc SQL)
Spójność, która się zgadza:
- session_id unikalne; zdarzenia unikalne na poziomie (session, event).
- Wszystkie zamówienia, zdarzenia i GO mają sesję i usera. Każdy `payment_succeeded` to zamówienie albo GO.
- Strefy czasowe: created_at minus event_at_utc daje +1h zimą i +2h latem, przełączenia DST są poprawne. Przyjmuję, że daty w analizie są w czasie polskim, a sesje i zdarzenia konwertuję z UTC.
- GO: valid_until = zakup + 12 miesięcy w 100% przypadków. Każde zamówienie z discount_type=go ma ważne GO. Ceny GO to −50% u internisty i −20% u reszty, zgodnie z regulaminem.

**Podejrzane (ta część to też odpowiedź):**
1. **Duplikaty w orders.csv.** 604 order_id występują 2×, wszystkie z created_at między 10 a 24 VI 2026. Wiersze są w 100% identyczne. To błąd eksportu albo ETL, nie realne zakupy. Dashboard liczący wiersze zawyża czerwiec o ok. 30% w tych dniach. Decyzja: deduplikuję po order_id.
2. **Konta testowe QA.** Kod `TEST-QA`: 1 810 zamówień za 1,00 zł, wszystkie u internisty, duration 1 min, desktop Chrome, wejście bezpośrednie, godziny 9–17. 22 konta, wszystkie z Warszawy (mazowieckie, miasto >200k) i bez zgody marketingowej. Te same konta mają jeszcze 292 zamówienia bez kodu (89 zł, 1 min, desktop, direct), więc to też testy. Razem 2 102 zamówienia i 2 093 sesje. Liczba testów rośnie w czasie (z 4/mies. do 100–160/mies.), więc zawyża **zamówienia** i wskaźnik **powracających**. Decyzja: wykluczam 22 konta w całości (orders, sessions, users).
   - Pytanie do zespołu: czy lekarz dostawał wynagrodzenie za te wizyty? Status jest `completed`, więc według reguły kosztowej tak, a to byłby realny koszt.
3. **Wrzesień 2025: w lejku payment_started > account_completed.** To nie błąd. Od 7 IX 2025 działa `crm_go_upsell`, czyli zakup samego GO (bez kroków 1–3). We IX 2025 było 225 standalone GO. Lejek konsultacji liczę bez sesji, w których kupiono tylko GO.
4. Dziury w ruchu w dni wolne (1 XI, 25–26 XII, 1–3 V). Wyglądają na sezonowość, nie na awarię, bo spadek jest równoległy na wszystkich krokach.

## Krok 2: zdarzenia znalezione w danych (pierwsze przejście)
| Data | Co | Skąd wiem |
|---|---|---|
| 2025-09-07 | Start `crm_go_upsell` (e-mail), od teraz GO można kupić osobno | Pierwsza sesja kampanii i pierwsze GO z order_id = null |
| 2025-10 | Pierwsze GO z X 2024 wygasają, brak auto-odnowienia | valid_until |
| 2025-11-03 | Start Meta `meta_prosp_l4_szybko` + kod `L4SZYBKO20` (−20 zł) | Spend i pierwsza sesja kampanii, pierwszy kod 2025-11-04 |
| 2026-02-09 | Start TikTok `tt_prosp_l4_15min` + kod `TIKTOK25` (−25 zł) | j.w. |
| od XII 2025 | Rośnie opóźnienie startu wizyty (z ok. 4 do ok. 9 min), rośnie odsetek **refunded** (z 2% do 6%; najpierw błędnie zapisałem to jako no_show, a no_show jest płaskie, ok. 2,5%), spadają oceny (z 4,4 do 4,15) | Miesięczne KPI zamówień |
| 2026-06-10…24 | Duplikaty w eksporcie orders | patrz wyżej |

Hipoteza robocza: wzrost XI 2025 – III 2026 jest kupiony płatnym ruchem L4 (Meta i TikTok z kodami rabatowymi). Ten ruch konwertuje gorzej (psu/sess spada z 0,18 do 0,12), przeciąża internistów (opóźnienia, no_show) i może mieć słabą retencję. Do sprawdzenia na kohortach.

## Krok 3: warstwa czysta (`src/build.py`)
- Pierwsza próba: tabele tymczasowe w `q.py` nie działają w trybie read-only. Zamiast obchodzić to doraźnie, zapisałem decyzje z audytu jako kod (A1–A6 w nagłówku build.py).
- Atrybucja (A4): last non-direct touch w oknie 30 dni przed 1. zamówieniem, po wszystkich visitor_id powiązanych z kontem. W 86–93% przypadków zgadza się z kanałem sesji zakupowej. `meta_rmkt` (retargeting koszyka) zawsze jest last-touchem, więc prawdopodobnie przejmuje zasługi prospectingu. To ograniczenie jest opisane w sekcji „nierozstrzygalne”.
- Po czyszczeniu: 63 207 zamówień, 40 918 pacjentów (konto z ≥1 opłaconym zamówieniem). 11 482 konta nigdy nic nie kupiły.

## Krok 4: odtworzenie dashboardu
Liczby z dashboardu odtwarzam co do sztuki na danych SUROWYCH:
- +52% pacjentów: 24 689 / 16 251 nowych pacjentów (data 1. zamówienia).
- +61% zamówień: 40 613 / 25 269 **wierszy** (z duplikatami i QA).
- +50% przychodu: suma `amount_paid` **brutto**, bez zwrotów.
- +40% GO: 2 468 / 1 759.
Po czyszczeniu: zamówienia +56%, przychód netto +45%, marża po koszcie lekarza +42%, spend +77%.
Uwaga metodologiczna: okres P1 startuje od zera (sprzedaż od 1 X 2024), więc P2 ma naturalną przewagę bazy powracających. YoY zamówień jest strukturalnie zawyżone względem dojrzałego biznesu.

## Krok 5: kohorty, pierwsze wnioski
- Retencja 90 dni (2. zamówienie w ≤90 dni) spada z ok. 24% (kohorty X 2024 – X 2025) do ok. 14–15% (kohorty IV–VI 2026).
- Spadek to w większości **miks kanałów**: pacjenci z `meta_l4` wracają w 5,1%, z `tiktok_l4` w 3,3%, reszta w ok. 23%. Wśród pacjentów z kampanii L4: 72–77% pierwszych zamówień z kodem promo, 86% to L4.
- Ale retencja w kanałach „core” też spada, z ok. 24% do 19–20% w III–V 2026. Szukam przyczyny…
- …i ją widzę: **opóźnienie startu wizyty u internisty rano (6–12)** rośnie z 5–6 min (do X 2025) do 22–25 min (od II 2026). Po południu i w nocy bez zmian (3–4 min). Start: XI 2025, czyli razem z kampanią `meta_prosp_l4_szybko`.
- Kto zajmuje poranne sloty: udział pacjentów z kampanii L4 rośnie z 0% do 33–36%. Wolumen porannych wizyt rośnie z ok. 470 do ok. 800–980/mies.
- Efekt opóźnienia (core, internista, 1. wizyta completed, kohorty XII 2025 – VI 2026): retencja 90 dni przy <10 min wynosi 28,4%, a przy ≥20 min 11,5%. Ocena wizyty: przy <10 min 4,45, przy ≥20 min 3,10 (25% ocen to 1–2).
- Kontrola konfundera: przed XI 2025 poranni pacjenci wracali prawie tak samo jak reszta (23,2% vs 24,5%). Po XII 2025 mają 17,6% vs 21,7%. Różnica pojawia się razem z opóźnieniem.
- L4 z kampanii: 16,4% pierwszych wizyt kończy się zwrotem (lekarz nie wystawił L4). Koszt lekarza i tak jest płacony. W kanałach core L4 ma 7,8% zwrotów.

## Krok 6: lejek
- **iOS Safari, krok account_completed:** spada z ok. 0,75 do ok. 0,60 od **17 III 2026** (dzień zmiany widoczny w danych dziennych). macOS Safari, Chrome na iOS i Android bez zmian. Stan trwa do IX 2026. Kroki po logowaniu (psu/ac) bez zmian, więc to problem logowania lub rejestracji, nie płatności.
- Ślepa uliczka: najpierw liczyłem ac/sl z podziałem na „zalogowany / niezalogowany” i wyszło 0 vs 1. user_id w sesji pojawia się właśnie przez account_completed, więc ten podział jest tautologiczny. Odrzucone.
- Przeglądarki in-app (FB/IG/TikTok): konwersja sesji 6,5% vs 15,9% poza in-app. Krok logowania 0,61 vs 0,72. To głównie ruch z kampanii L4.
- Płatność (psu/pst) stabilna ok. 0,90–0,93 na wszystkich OS. BLIK, karta i przelew bez zmian w miksie.
- Kliknięcia vs sesje kampanii są stabilne (Google ok. 93%, Meta ok. 78%, TikTok ok. 72%). Nie widać utraty trackingu.

## Krok 7: TelemediGO
- Brak auto-odnowienia: z 1 524 wygasłych członkostw odnowiono **83 (5,4%)**.
- Aktywność wokół wygaśnięcia (nieodnowione): 0,172 zamówienia w 90 dniach przed, 0,037 w 90 dniach po (−78%). Baza porównawcza (pacjenci bez GO, 12 mies. od 1. zamówienia): 0,026 → 0,019. Wygaśnięcie GO to moment churnu.
- Standalone GO (od IX 2025, `crm_go_upsell`): kupują je lojalni pacjenci (średnio 3,6 wcześniejszych zamówień). Nie da się czysto rozstrzygnąć, ile z późniejszych zamówień to inkrementalność, a ile samoselekcja. Do sekcji 05.

## Krok 8: dodatkowe kontrole jakości
- Brak: zamówień z terminem przed płatnością, startu dla cancelled/no_show, ocen dla nieodbytych wizyt, nadpłat, częściowych zwrotów, botów (max 29 sesji/visitor), visitor_id współdzielonych przez wiele kont.
- Pediatra: średni wiek konta 38 lat, więc rodzic kupuje dla dziecka na swoim koncie. Wiek z users.csv nie opisuje pacjenta wizyty.

## Krok 9: liczby do priorytetów
- iOS Safari: przed 17 III krok konta 0,746, po 0,599. W B ok. 975 sesji/mies. dochodzi do wyboru terminu, więc ok. 143 mniej logowań/mies. × 0,80 (konto → opłacone) ≈ 115 opłaconych zamówień/mies. Marża/zamówienie na iOS Safari 38,4 zł, 50% to nowi pacjenci, więc ≈ 5–6 tys. zł/mies.
- Kampanie L4 (VII–IX 2026): Meta 17,0 tys. zł/mies. i 398 nowych/mies. (CAC 42,7 zł), TikTok 12,3 tys. zł/mies. i 267 nowych/mies. (CAC 46,1 zł). Marża w czasie życia kohort XI 2025 – III 2026: Meta 37,0 zł, TikTok 31,7 zł (Google generic 64,6 zł, SEO 64,9 zł).
- Poranne sloty: ok. 380 wizyt/mies. z opóźnieniem ≥20 min, w tym ok. 140 pierwszych wizyt pacjentów core.
- GO: ok. 200 wygaśnięć/mies. w najbliższych 12 miesiącach.
- In-app: krok konta 0,61 vs 0,72.
- Uwaga: wartości dla GO standalone przy porównaniu kupujących i niekupujących wyszły niespójnie (marża na zamówienie u ciężkich użytkowników bez GO tylko ok. 25 zł, bo wielu z nich już miało GO z wcześniejszych zakupów). Porównanie jest zanieczyszczone, więc nie wyciągam z niego wniosku. Trafia do „nierozstrzygalnych”.

## Krok 10: narzędzie (`src/export.py`, `tool/`, `src/build_tool.py`)
- Decyzja architektoniczna: zamiast prekalkulowanych tabel wysyłam do przeglądarki dane na poziomie pacjenta (40 918) i sesji (457 464) jako kolumnowe tablice binarne (gzip + base64, 1,3 MB). Każdy filtr i podział liczy się na żywo. To „narzędzie, nie raport”, więc da się zadać pytanie, którego nie przewidziałem.
- Kohorty: dzień / tydzień / miesiąc, miary: retencja w N dni, marża w N dni, marża − CAC, nowi pacjenci, % zwrotów. Podział po 15 wymiarach, filtry po 13. Cenzura okna zaznaczona na wykresie. Trójkąt kohort i tabela segmentów.
- Lejki: okres A vs B, konwersja każdego kroku w segmentach z podświetleniem spadków, szereg czasowy kroku z adnotacjami zdarzeń.
- Kanały: CAC, marża 90/180/365 dni, marża − CAC.
- Pierwszy render: (1) tabela ocen posortowała się alfabetycznie („10–20” przed „< 10”), poprawione na kolejność logiczną. (2) Tygodniowe szeregi lejka dla małych segmentów (macOS, iOS inne) za bardzo szumiały, podniosłem próg do 40 sesji na tydzień. (3) W werdykcie było +26%, a tabela pokazuje +27% (26,5% zaokrąglone), ujednolicone. (4) Na telefonie skrócony nagłówek.
- Nowa obserwacja z wykresu kanałów: brand + direct też rosną w I–III 2026, razem z kampaniami L4. Może to być halo kampanii albo sezon infekcji. Dopisane do „nierozstrzygalnych”.

## Krok 11: przegląd błędów i podpis autora (prośba Sebastiana: „sprawdź błędy, dodaj mój sznyt”)
Weryfikacja wszystkich liczb z tekstów narzędzia względem danych. Poprawione:
- „16% pierwszych wizyt ze zwrotem” w kampaniach L4 to za dużo: dla wszystkich pierwszych wizyt jest 14,2% (Meta 14,7%, TikTok 13,1%). 15–17% dotyczy tylko pierwszych wizyt L4. Teksty rozdzielone.
- „90. percentyl > 30 min” rano: to była wartość dla całego dnia. Rano od II 2026 p90 = 56 min. Poprawione na „co dziesiąta wizyta zaczyna się ponad 55 min po terminie”.
- Ocena 3,1 vs 4,45 dotyczy wszystkich ocenionych wizyt, nie tylko pierwszych. Zmienione sformułowanie.
- Zwroty jako % kwoty: 6,1% (P1) i 8,0% (P2), tekst „6–8%” zgadza się.
- Błąd wizualny: tygodnie z 1–3 pacjentami rysowały skoki do 0% lub 15% (np. pierwsze tygodnie kampanii L4). Wprowadziłem minimalną liczebność punktu: 20 pacjentów (tydzień/miesiąc), 5 (dzień), 20 w oknie 7-dniowym. Przy okazji wyłapałem, że ten próg zerował wykres „nowi pacjenci dziennie”, więc rolling dostał osobny parametr.
- Usunięta półpauza (—) z komentarza w kodzie (preferencja: bez em-dashy).
Podpis: szable z logo Fabest (bez napisu, na prośbę), z usuniętym białym tłem, żeby działały w ciemnym motywie. W nagłówku „// by S. Szablewski”, w stopce kontakt i stack. Etykiety w stylu CV (`// komentarz`, `[ lista ]`).
