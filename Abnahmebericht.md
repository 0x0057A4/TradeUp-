# Arbeitspaket 1 – zur Abnahme

Die vorhandene HTML-Arbeitskopie wurde fortgeschrieben. Die ursprüngliche Datei in Downloads und die synchronisierten Projektquellen blieben unverändert. Diese Fassung liegt ausschließlich im Prüfzweig; die Übernahme in `main` erfolgt nach Abnahme.

## Umgesetzt

1. Verteiler zeigen das Angebot ihrer vorgeschalteten Förderkette. Lagerbestände und vorgelagerte Ausgangsfilter bestimmen die Auswahl. Gespeicherte Ausnahmen bleiben sichtbar; weitere Produkte lassen sich über eine durchsuchbare Auswahl hinzufügen. Bei Zusammenführungen ist das Angebot je Eingang getrennt.
2. Produktionsobjekte lassen sich ohne aktives Bauwerkzeug mit der linken Maustaste ziehen. Waren, Einstellungen und IDs bleiben erhalten. Verbundene Brücken und Tunnel werden als Einheit bewegt. Ungültige Ziele und Abbruch verändern den Ausgangszustand nicht.
3. Mitarbeiterzugänge sind gegen Gebäude und Fließbänder auf beiden Ebenen geschützt, auch beim Versetzen und Kopieren. Bereits blockierte Zugänge aus alten Spielständen werden gemeldet, ohne Objekte zu löschen.
4. Alle Förderbandkomponenten besitzen ein tatsächliches Inventar mit Annahmegrenze 25. Sichtbare Spurplätze bzw. Greifarm und Warteschlange zählen gemeinsam. Die fünfspaltige Tabelle zeigt Produkt, Menge, Einzel-X, Mengenfeld mit ENTER und Alles-X. Enter im Mengenfeld und der ENTER-Knopf löschen die eingegebene Anzahl. Nur positive ganze Zahlen bis zum aktuellen Bestand sind zulässig. Das Löschen aller Einheiten einer Warenart verlangt eine Bestätigung. Eingaben und Fokus bleiben bei laufenden Bestandsaktualisierungen erhalten. Einzel- und Segmentanzeigen berücksichtigen die Warteschlange.
5. Die neue Smart-Zusammenführung bietet drei filterbare Eingänge, optionalen Vorrang, fairen Umlauf, Zielkapazitätsprüfung, Inventar25 und dieselbe Objektbedienung. Sie wird gemeinsam mit der bisherigen Zusammenführung freigeschaltet.

Zusätzlich behoben: Forschungsauswahl berücksichtigt nur geeignete Forschungstische; Wärmeangaben gelöschter Blaupausen bleiben gespeichert; automatischer Export berücksichtigt den Kopierbonus korrekt; Dialoge sperren den Hintergrund und halten den Tastaturfokus; umbelegte Designer-Tasten öffnen und schließen korrekt; Tastatureingaben in Bedienelementen bewegen die Kamera nicht.

Haupt- und Zwischenlager bieten eine gespeicherte Ausgabepriorität in ihrer Gebäude-Inventaransicht. Warenzeilen können am Griff gezogen oder mit ↑/↓ verschoben werden. Bei neuen automatischen Entnahmen durch Band oder Greifarm wird die oberste zulässige Warenart zuerst aufgebraucht, danach die nächste. Filter, Abgaberegeln und Reservierungen bleiben bindend. Die aggregierte Lagerübersicht im Lager-Fenster hat keine gemeinsame Priorität für mehrere Lager.

Im Hauptlager aktiviert eine tatsächliche Sortieränderung auch die automatische Ausgabe ohne Ausgangsfilter. Ohne Sortieränderung bleibt die bisherige Filterpflicht erhalten. Explizite Ausgangsfilter beschränken weiterhin die Ausgabe. Bereits auf Bändern oder in Greifarmreserven liegende Ware behält ihre Reihenfolge. Wieder eingelagerte Waren erhalten ihren gespeicherten Rang; Kurieraufträge bleiben unverändert.

## Prüfung

85 automatisierte Prüfungen bestanden: 10 Grundfunktionen, 15 Bedienoberfläche, 21 Transport-/Speicherprüfungen, 15 Objekt-/Zugangsprüfungen und 24 Lagerprioritätsprüfungen. Darunter tatsächliche Annahme25/Ablehnung26, FIFO ohne doppelten Durchsatzverbrauch, Greifarmreserve, Warenflags, Migration, Abriss ohne Doppelbuchung, faire Eingänge, Filtervererbung sowie lange und zyklische Förderketten. Lagerpriorität wird für Band und Greifarm, Regeln, Filter, Reservierungen, Save/Load, Kopieren, Snapshots und tatsächliche Drag-Ereignishandler geprüft. Sämtliche Spielskripte sind syntaktisch gültig.

Browserprüfung in einer getrennten lokalen Testumgebung: Lagerfilter zunächst sieben vorhandene Ressourcen, nach gewählter Ausgabe nur Eisen; nachgelagerter Smart-Zusammenführer bietet am verbundenen Eingang nur Eisen; Suchausnahme und gespeicherter Filter funktionieren. Ein Verteiler wurde mit 25 echten Einheiten gefüllt. Ein Band mit 14 Einheiten wurde versetzt und nach Neuladen mit unverändertem Inventar wiedergefunden. Eine Einzellöschung reduzierte 15 auf14 und blieb gespeichert. Die Sammellöschung öffnet den Bestätigungsdialog; Abbrechen erhält den Bestand. Ungültiges Versetzen auf einen blockierten Zugang wurde abgewiesen. Dialog-Tabfolge, Fokuswiederherstellung, Leertaste und umgelegte Designer-Taste wurden geprüft. Keine Browserfehler oder Warnungen in der Abschlussprüfung.

Die automatisierten Prüfungen verwenden isolierte Spielzustände und ersetzen keine vollständige Langzeit-Spielbalanceprüfung. Die Browserprüfung deckt repräsentative Abläufe ab; nicht jede Maschinenart wurde einzeln im Browser aufgebaut.

Nachbesserungen im Browser geprüft: Einzel-X25→24, Mengenfeld mit Enter24→21 und ENTER-Knopf21→19. Null und99 bei Bestand21 werden ohne Löschung abgewiesen; Sammellöschabbruch behält19. Kupfer wurde am Griff vor die anderen Waren gezogen; die erste Position blieb nach dem Neuladen gespeichert. Bei gleichzeitig freigegebenem Kupfer und Holz sank der Kupferbestand20→15, während Holz29 unverändert blieb. Die nachgelagerte Bandkapazität begrenzte diesen Browserversuch; vollständiges Aufbrauchen und Wechsel zur nächsten Ware wurden in den automatisierten Prüfungen bestätigt. Keine Browserfehler oder Warnungen in der Abschlussprüfung.

## Hinweise für die Abnahme

- Speicherformat15 liest ältere Spielstände. Alte überfüllte Puffer werden vollständig erhalten und nehmen bis zum Abfluss keine weitere Ware an. Neue Reserven sind für das neue Format bestimmt; die alte Spielfassung sollte neu gespeicherte Stände nicht bearbeiten.
- Bereits vor dieser Änderung verlorene Wärmeangaben gelöschter Blaupausen können nicht rekonstruiert werden; beim Laden erscheint ein Hinweis.
- Beim Einlagern ins mengenbasierte Depot gilt die bestehende Lagersemantik: Mengen bleiben erhalten, individuelle QA-/Defektflags werden dort nicht verwaltet.
- Die Prüfung von Blaupausenrevisionen bleibt Arbeitspaket2. Sie ist kein Bestandteil dieser Freigabe.

## Reproduzierbare Prüfungen

Node.js genügt; zusätzliche Pakete sind für die Prüfskripte nicht erforderlich. Im Repository ausführen:

```powershell
node pruefungen/test-grundfunktionen.cjs "index_arbeitskopie (1).html"
node pruefungen/test-ui.cjs "index_arbeitskopie (1).html"
node pruefungen/logik-regressionen.cjs "index_arbeitskopie (1).html"
node pruefungen/grafik-tests.cjs "index_arbeitskopie (1).html"
node pruefungen/test-lager-prioritaet.cjs "index_arbeitskopie (1).html"
node --check pruefungen/grafik-syntax.mjs
```

Die Skripte schreiben ihre Prüfergebnisse und die extrahierte Syntax-Prüfdatei neben die Skripte. Die Spielstanddaten selbst werden nicht geändert.
