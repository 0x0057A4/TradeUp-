# Arbeitspaket 2 – Abnahmebericht

Arbeitspaket 2 wurde nach der Freigabe „Starte“ auf Basis des übernommenen Hauptstands `40516b22bf4997701b0b8767971de8f450a1407e` umgesetzt. Die ursprüngliche Downloads-Datei und die synchronisierten Quellen blieben unverändert.

## Umgesetzt

Produktversionen besitzen jetzt eine stabile Designer-ID und eine eigene Waren-ID je gespeichertem Stand. Beim erneuten Speichern eines Designs wird eine neue Version archiviert. Die Werte, Bauteile, Wärme und Gehäusedaten einer bereits erzeugten Version werden nicht durch spätere Änderungen überschrieben. Montage-Rezepte können die Version auswählen; eine neue Auswahl gilt für folgende Durchgänge. Laufende Produktionsaufträge werden mit Auftrag, getragenem Material, Phase und Zeit gespeichert und nach dem Laden fortgesetzt.

Ein Doppelklick auf ein normales Fließband startet den Weiterbau über das Fließband-Bauwerkzeug. Die Gruppenauswahl bleibt über „Ganze Gruppe wählen“ verfügbar. Die übrigen Förderbandkomponenten können über „Verschieben“ versetzt und mit R gedreht werden. Die Vorschau prüft Ziel, Arbeitszugänge, verbundene Untergrundpaare und atomaren Abbruch. Waren, Einlaufrichtung, Inventar, Filter, Prioritäten und IDs bleiben erhalten. Das normale Fließband wird von der neuen geometrischen R-Rotation ausgenommen; seine bestehende Richtungsumkehr bleibt verfügbar.

## Prüfung

102 Arbeitspaket-1-Regressionen sowie 7 neue Arbeitspaket-2-Prüfungen bestanden. Zusätzlich wurden die vollständigen Inline-Skripte lokal syntaktisch geprüft. Die neuen Prüfungen decken Versionsarchiv, unveränderliche Werte, stabile Designer-ID, laufende Produktionsaufträge, Doppelklick-Weiterbau, Rotationseinschränkung, Warenrichtung und Texteingabe-Isolation ab.

Browserprüfung in einer getrennten lokalen Testumgebung: Zwei Versionen desselben Designs wurden gespeichert; die Anzeige zeigte V1 und V2. Nach Neuladen blieb V2 erhalten. Ein Splitter wurde platziert, die Infoansicht zeigte „Verschieben M“ und „Drehen R“, und die Rotation meldete „Bandteil gedreht.“ Es traten keine Browserwarnungen oder -fehler auf. Der Doppelklickpfad ist zusätzlich durch die neue Handlerprüfung abgesichert; ein vollständiger Browsernachweis mit einem normal gebauten Band bleibt für die nächste Abnahmerunde zu ergänzen.

## Reproduzierbare Prüfungen

```powershell
node test-ap2.cjs index.html
node test-grundfunktionen.cjs index.html
node test-ui.cjs index.html
node logik-regressionen.cjs index.html
node grafik-tests.cjs index.html
node test-lager-prioritaet.cjs index.html
node test-band-reihenfolge.cjs index.html
```

Die Übernahme in `main` erfolgt erst nach deiner Abnahme.
