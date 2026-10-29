# Stabilisierungsplan: leaderboard.io / Leaderboard.sc

Stand: 27. Oktober 2026. Vorbereitung auf Basis der Codeanalyse und HANDOVER.md.
Der folgende Plan enthält den ursprünglichen Arbeitsumfang. Der aktuelle Umsetzungsstand steht am Ende.

## Bestätigte Produktentscheidung

Abzeichen dürfen in allen Wettbewerben über `hasBadges` aktiviert werden.
Eine Beschränkung auf TRRC ist nicht gewünscht. Dieses Verhalten bleibt erhalten.
Die entsprechende Beschränkung in HANDOVER.md ist überholt.

## Vorgehen

Kleine, einzeln prüfbare Änderungen am bestehenden Projekt. Sicherheit und
Datenintegrität zuerst; größere Umbauten und neue Funktionen folgen danach.
Vor Änderungen an Next.js-Code die passenden installierten Guides unter
`node_modules/next/dist/docs/` lesen.

## Paket 1: Zugangsschutz und öffentliche Daten

- Credentials-Logging in `src/auth.ts` entfernen.
- Gemeinsame serverseitige Prüfungen für Anmeldung, aktuelle Rolle und
  Objektberechtigungen einführen und in allen schreibenden Server Actions anwenden.
- Rollenänderungen und das Ändern/Löschen privilegierter Konten gegen
  Rechteausweitung absichern. Laut Übergabe ernennt nur SUPER_ADMIN weitere Admins.
- Identität für Scoreänderungen und Auditlogs aus der Serversitzung ableiten.
- Öffentliche Turnier-, Profil- und Historienantworten auf benötigte Felder
  beschränken. Keine Passwort-Hashes oder vollständigen Userobjekte ausliefern.
- Private Kontaktdaten, Handicap-Antragsdetails und Auditlogs nur für die
  jeweils berechtigten Personen ausliefern.
- Flight-Zugehörigkeit anhand der serverseitigen Paarungen prüfen. Die konkrete
  Behandlung von Gruppen ohne Matchzuordnung vor Umsetzung festlegen.

Abnahme: Direkte Action-Aufrufe durch Gäste, fremde Spieler und unberechtigte
Admins werden abgewiesen; erlaubte Eingaben bleiben möglich. Öffentliche
Antworten enthalten ausschließlich freigegebene Felder. Rollenänderungen werden
auch bei bestehenden Sitzungen berücksichtigt.

## Paket 2: Datenintegrität

- Abschläge mit bestehenden IDs aktualisieren, statt alle zu löschen und neu
  anzulegen. Referenzierte Abschläge nur nach einer geregelten Zuordnung entfernen.
- Teilnehmer, Runde, Match, Abschlag und Loch auf gemeinsame Zugehörigkeit prüfen.
- Scorewerte und Statuswerte serverseitig validieren.
- Score-Schreibvorgänge und zugehörige Auditänderungen in Transaktionen bündeln.
- Eindeutigkeit für `(participantId, roundId, holeId)` herstellen und atomar
  speichern. Bestehende Duplikate vor einer Migration ermitteln; widersprüchliche
  Ergebnisse nicht automatisch verwerfen.
- `Score.roundId` mit einer tatsächlichen Rundenrelation absichern; bestehende
  verwaiste Datensätze und das gewünschte Löschverhalten zuvor prüfen.
- Handicapinitialisierung aus dem Rendern der öffentlichen Seite entfernen und
  in den Einrichtungsablauf verschieben.

Abnahme: Gleichzeitige Eingaben erzeugen keine doppelten Scores. Platzänderungen
erhalten Abschlagzuordnungen. Fehler führen nicht zu teilweise gespeicherten
Scorekarten. Öffentliche Seitenaufrufe verändern keine Daten.

## Paket 3: Wertungsregeln und gezielte Regressionstests

- Eine reguläre Testsuite für die tatsächlich kritischen Wertungsfälle einrichten.
- Wintercup: halbe Matchpunkte mit passendem Datenbanktyp ermöglichen; die
  unterschiedliche Verwendung von Scorefeldern ausdrücklich abbilden.
- Zweimal-neun-Loch-Runden: benötigte Löcher beim Speichern laden und dieselben
  Regeln in Speicherung, Scorekarte und Rangliste verwenden.
- Fälle für Plus-Handicap, manuelle Vorgabe 0, individuelle Abschläge, gestrichene
  und ungespielte Löcher, geteilte Plätze und vorzeitig entschiedene Matches prüfen.
- Ryder-Cup-Gewichte und Viertelpunkte gemäß dem folgenden Abschnitt absichern.

Abnahme: Dokumentierte Eingaben haben feste erwartete Ergebnisse. Speicherung,
Scorekarte, Teamstand und MVP-Auswertung widersprechen einander nicht.

## Matchgewichte: geprüfter Iststand

`getRyderCupMatchWeight` in `src/app/components/RyderCupBoard.tsx` verwendet:

1. `match.weight`, falls im übergebenen JavaScriptobjekt vorhanden.
2. Sonst Gewicht 0,5 bei Typ `SINGLES`, wenn der Rundenname `VM`, `NM`,
   `Vormittag` oder `Nachmittag` enthält oder `match.holeRange` exakt `1-9` ist.
3. Sonst Gewicht 1,0.

Die Namensprüfung unterscheidet Groß-/Kleinschreibung. Der Lochbereich `10-18`
erfüllt die Sonderregel nicht. Auch tatsächlich neun gespielte Löcher reichen
ohne die genannten Merkmale nicht aus.

`Match` besitzt im Prisma-Schema kein `weight`-Feld. Die untersuchte Anwendung
enthält keinen regulären Speicherweg für frei konfigurierbare Matchgewichte.
Eine weitere Implementierung derselben Regel steht in `RyderCupView.tsx`;
bei der Untersuchung wurde keine Einbindung dieser Komponente gefunden.

Das Gewicht wird dem Sieger vollständig und bei Gleichstand beiden Seiten
je zur Hälfte zugerechnet. Es beeinflusst Teamstand, Rundenstände und MVP-Punkte.
Es ist unabhängig von der Handicap-Allowance.

`formatCupScore` rundet Viertelpunkte falsch für die Darstellung: 0,25 wird als
½ ausgegeben und 0,75 als 1. Bei geteilten Matches mit Gewicht 0,5 sind solche
Viertelpunkte ein reguläres Ergebnis der aktuellen Berechnung.

### Vorgeschlagene Stabilisierung

- Bestehende effektive Gewichte vor einer Umstellung erfassen und vergleichen.
- Ein explizites nullable Matchgewicht ergänzen; zugelassene Werte fachlich
  festlegen. Als erste Option bieten sich 0,5 und 1,0 an.
- Bestehende Gewichte anhand der bisherigen Regel übernehmen, ohne die
  historischen Punktestände stillschweigend zu verändern.
- Für neue Matches das Gewicht ausdrücklich setzen und in der Verwaltung
  sichtbar machen. Rundennamen sollen danach nur der Beschriftung dienen.
- Berechnung und Darstellung in eine gemeinsam genutzte Funktion auslagern.
- Viertelpunkte exakt darstellen, etwa `¼`, `½`, `¾` oder als Dezimalzahl.

Fachlich noch zu bestätigen: Sollen Neun-Loch-Einzel grundsätzlich 0,5 zählen,
auch bei `10-18`, oder ist die bisherige Regel eine besondere TRRC-Vereinbarung?
Aus dem aktuellen Code allein lässt sich das nicht entscheiden. Diese Frage
blockiert Paket 1 nicht.

## Paket 4: Wartbarkeit und reproduzierbarer Betrieb

- Hook-Reihenfolge durch separate Komponenten für die Turnierarten stabilisieren.
- Berechnungen aus den großen UI-Dateien herauslösen und wiederverwenden.
- Nach außen gerichtete Daten und Action-Eingaben zuerst konkret typisieren.
- Lint schrittweise bereinigen; keine pauschale Abschaltung wichtiger Regeln.
- README und TODO am tatsächlichen Stand ausrichten.
- Bestehendes Datenbankschema als Migrationsbaseline erfassen und künftige
  Schemaänderungen versionieren.
- Deploymentziel, getrennte Entwicklungsdatenbank, Backups und einen
  Wiederherstellungstest prüfen. Angaben in HANDOVER.md sind hierfür Hinweise,
  noch kein geprüfter Betriebsnachweis.

## Ausgangsprüfung und Grenzen

Die bisherige Prüfung ergab: TypeScript und Produktionsbuild erfolgreich;
ESLint im Anwendungscode meldet 935 Fehler und 77 Warnungen, davon 775
Meldungen zu explizitem `any`. Die Zahlen sind keine Anzahl unabhängiger Bugs.
Browserabläufe, reale Turnierergebnisse und die Produktivkonfiguration wurden
noch nicht praktisch verifiziert.

Vor einer produktiven Schemaänderung: betroffene Daten prüfen, Migration in
einer getrennten Umgebung testen und Wiederherstellbarkeit sicherstellen.
Dieser Vorbereitungsschritt ändert weder Anwendung noch Datenbank und löst
kein Deployment aus.

## Umsetzung am 27. Oktober 2026

Pakete 1–3 sind implementiert: Zugriffe mit aktuellen Rollen, Flight-Schutz,
öffentliche Datenfilter, sichere Abschlagbearbeitung, transaktionale Scores und
Auditlogs, eindeutige Scores, Rundenrelation, neun-Loch-Anpassungen, halbe
Wintercuppunkte und explizite Matchgewichte mit exakter Viertelpunktanzeige.

Aus Paket 4 umgesetzt: eigene Komponente für Standardturniere (stabile Hook-Reihenfolge),
typisierte gemeinsame Vorgabe- und Cup-Helfer, Entfernung doppelter Ryder-Cup-Statuslogik,
versionierte Migrationen, reguläre Tests, CI, Lint-Regressionsprüfung und aktualisierte
README/TODO. Weitere UI-Zerlegung und vollständige Lintbereinigung bleiben fortlaufende
Arbeit. Kein pauschales Abschalten der vorhandenen Regeln.

Die initiale Baseline entsprach dem tatsächlichen Schema. Eine konsistente Sicherung
aller 17 Tabellen wurde isoliert wiederhergestellt und die Migration daran geprüft.
Anschließend wurde die Migration auf der bestehenden Datenbank erfolgreich ausgeführt.
Der anschließende Vergleich bestätigte 3.287 unveränderte Scores und identische Gewichte
für alle 177 bestehenden Matches. Sicherung und Prüfprotokoll liegen lokal im ignorierten
scratch-Verzeichnis und sind nicht Teil des Repositorys.

39 Regressionstests und der Produktionsbuild mit Next.js 16.4.3 / Auth.js Beta 32
wurden erfolgreich geprüft. Die neuen Kernmodule und Tests haben keine Lintbefunde.
Die vorhandenen UI-Befunde werden über eslint-baseline.json als Altbestand sichtbar
gehalten; zusätzliche Befunde führen zum Fehlschlag der CI-Prüfung.

Beim Typisieren wurde zusätzlich ein falscher Aufruf der Einzel-Matchvorgabeberechnung
im Ryder-Cup-Board gefunden und korrigiert. Tests decken manuelle Vorgaben, vorzeitigen
Abschluss, Weiterspielen bis zum Ende und unvollständige Lochreihenfolgen ab.

Abzeichen bleiben ausdrücklich in allen Wettbewerben aktivierbar. Die historische
Gewichtsregel bleibt der Anfangswert für neu angelegte Matches; keine pauschale
Änderung aller Neun-Loch-Einzel auf 0,5. Gespeicherte Gewichte sind danach unabhängig
von Beschriftung und Lochbereich.

Offene Betriebsnachweise: Anbieterzugriff für Neon-PITR/Backupaufbewahrung und eine
dauerhaft getrennte gehostete Entwicklungsdatenbank sind nicht vorhanden. Isolierte
PostgreSQL-Tests, wiederherstellbare lokale Sicherung und Konfigurationsvorlage sind
vorhanden. Der verbleibende DeepmergeTS-Auditbefund betrifft das Prisma-CLI-Paket;
kein ungeprüfter Wechsel auf Prisma 7.

Abschlussprüfung am 29. Oktober 2026: 39 Tests erfolgreich, TypeScript erfolgreich.
Der lokale HTTP-Smoke-Test prüfte sieben vorhandene Turnierformate, Gastsitzung,
Login und vier gesperrte Adminrouten erfolgreich. Die ungefilterte Lintprüfung
enthält weiterhin dokumentierte Altlasten; die Regressionsprüfung ist erfolgreich.
