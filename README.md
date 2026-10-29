# Leaderboard.io / Leaderboard.sc

Golfturniere mit öffentlichen Ranglisten, mobiler Scoreeingabe und Administration.
Unterstützt Stableford, Zählspiel, Matchplay, Ryder Cup sowie Wintercup/CL.
Stack: Next.js 16.4.3, React 19, TypeScript, Tailwind 4, Auth.js 5 Beta,
Prisma 6 und PostgreSQL. Die sichtbare Produktbezeichnung ist aktuell Leaderboard.sc.

## Lokale Entwicklung

Node.js 22.12 oder neuer verwenden (CI: Node 22). Abhängigkeiten mit
`npm ci` installieren. Für eine neue Umgebung `.env.example` als Grundlage
für `.env` verwenden und eine **separate Entwicklungsdatenbank** eintragen.
Der bestehende lokale Datenbankzugang ist nicht automatisch eine Testdatenbank.

- `POSTGRES_PRISMA_URL`: PostgreSQL-Verbindung der Anwendung, optional gepoolt.
- `POSTGRES_URL_NON_POOLING`: direkte Verbindung für Migrationen.
- `AUTH_SECRET`: zufälliges Geheimnis mit mindestens 32 Zeichen.
- `AUTH_URL`: URL der jeweiligen Umgebung; für lokal normalerweise http://localhost:3000.
- `AUTH_TRUST_HOST=true`: gegebenenfalls für einen lokal gestarteten Produktionsserver
  setzen; nicht ohne Prüfung für beliebige öffentliche Proxys übernehmen.

Eine leere Entwicklungsdatenbank mit `npm run db:deploy` initialisieren.
Danach `npm run dev` starten. `prisma/seed.ts` enthält optionale Seed-Daten;
vor Verwendung dessen Inhalt und das Datenbankziel prüfen.

## Prüfungen

| Befehl | Zweck |
| --- | --- |
| `npm test` | Golfregeln, Zugriffe, Score-Action und isolierte PostgreSQL-Migration |
| `npm run typecheck` | Next.js-Routentypen erzeugen und TypeScript prüfen |
| `npm run build` | Produktionsbuild; lädt Google Fonts |
| `npm run lint` | Keine zusätzlichen Lintbefunde gegenüber eslint-baseline.json |
| `npm run lint:all` | Ungefilterte Ausgabe einschließlich vorhandener UI-Altlasten |
| `npm run test:smoke -- http://localhost:3100` | Laufende lokale Anwendung lesend prüfen |

Die Tests verwenden für Migrationen PGlite in isoliertem Speicher und benötigen
keinen Zugriff auf die konfigurierte Datenbank. Der Smoke-Test liest dagegen
deren Turnierauswahl. Er prüft öffentliche Formate, Gastsitzung, Admin-Redirects
und die Abwesenheit privater Felder in den ausgelieferten Antworten.

Die Lintbaseline schaltet keine Regeln ab: zusätzliche Befunde je Datei, Regel
und Schweregrad führen zu einem Fehler, ebenso Befunde in neuen Dateien.
Bestehende Budgets bei einer Bereinigung reduzieren, nicht zum Verdecken neuer
Fehler erhöhen. GitHub Actions führt Tests, Lint, Build und Typprüfung aus.

## Berechtigungen und Daten

- Gäste sehen öffentliche Ranglisten, Profile und Scorekarten; private
  Kontaktdaten, Passwort-Hashes, Scorebearbeiter und Auditlogs werden nicht
  öffentlich ausgeliefert.
- Spieler erfassen Scores im eigenen zugeordneten Match/Flight. Ohne Paarung
  dürfen sie nur eigene Scores erfassen. Wintercup-Ergebnisse und Termine sind
  auf die tatsächlichen Partieteilnehmer beschränkt.
- Admins verwalten Wettbewerbe, Plätze und normale Spieler. Nur Superadmins
  dürfen privilegierte Konten bearbeiten oder weitere Admins ernennen.
- Rollen werden serverseitig aktuell gelesen; alte JWT-Rollen reichen nicht aus.
- Abzeichen bleiben über `hasBadges` in **allen** Wettbewerben verfügbar.

Scoreänderungen sind transaktional und pro Teilnehmer/Runde/Loch eindeutig.
Rundenscores werden beim Löschen ihrer Runde mitgelöscht. Referenzierte
Abschläge können nicht versehentlich durch Platzbearbeitung entfernt werden.
Öffentliche Seitenaufrufe schreiben keine Handicaps mehr.

## Matchpunkte

Ryder-Cup-Matches besitzen ein gespeichertes Gewicht von 0,5 oder 1, sichtbar
und änderbar in beiden Verwaltungsansichten der Paarungen. Neue Matches erhalten
beim Anlegen die bisherige Regel als Anfangswert. Eine spätere Umbenennung der
Runde ändert ein gespeichertes Gewicht nicht.

Die Migration hat die bisherigen effektiven Gewichte unverändert übernommen.
Ein geteiltes Match mit Gewicht 0,5 ergibt 0,25 pro Seite. Team- und MVP-Anzeige
unterstützen Viertel-, Halb- und Dreiviertelpunkte exakt. Handicapvorgaben sind
von diesen Matchgewichten unabhängig.

## Migrationen, Sicherung und Veröffentlichung

Schemaänderungen künftig unter `prisma/migrations` versionieren und mit
`npm run db:deploy` ausführen. `prisma db push` ist kein Produktionsablauf.
Der Build führt keine Datenbankmigration aus.

Für eine bestehende Datenbank ohne Migrationshistorie zuerst deren Schema mit
`prisma/baseline.prisma` vergleichen. Nur bei Übereinstimmung einmalig
`npx prisma migrate resolve --applied 00000000000000_baseline` ausführen.
Die Baseline nicht auf eine bereits befüllte Datenbank als SQL anwenden.

Vor einer Migration:

1. `npm run db:preflight` prüft Duplikate, fehlende Runden und falsche Zuordnungen.
2. `npm run db:backup` schreibt eine komprimierte konsistente Sicherung nach scratch/.
3. `npm run db:verify-backup -- scratch/db-backup-….json.gz` stellt sie isoliert
   wieder her und prüft die Migration sowie unveränderte Gewichte/Zeilenzahlen.
4. Nach `npm run db:deploy` prüft `npm run db:verify -- scratch/db-backup-….json.gz`
   die bestehenden Scores und Matchgewichte gegen die Sicherung.

Sicherungen enthalten sensible Daten und bleiben im Git-ignorierten scratch/.
Die lokalen Prüfungen ersetzen kein externes regelmäßiges Backup.
Neon-Aufbewahrung und providerseitiges PITR sind nicht über Anbieterzugriff
verifiziert. Auch eine dauerhaft getrennte gehostete Entwicklungsdatenbank
muss im jeweiligen Betreiberkonto konfiguriert werden.

Laut Übergabe veröffentlicht Vercel Pushes auf main. Vor einem Push müssen
Schemaänderungen bereitstehen und die lokalen Prüfungen erfolgreich sein;
anschließend Deploymentstatus prüfen. Details der Umsetzung stehen in
[STABILISIERUNGSPLAN.md](STABILISIERUNGSPLAN.md). HANDOVER.md ist die historische
Übergabe; bestätigte Korrekturen und der Umsetzungsstand stehen im Plan.

## Persönliche Profile und Einladungen

Unter `/profile` verwaltet jeder angemeldete Benutzer sein eigenes Profil unabhängig
von Wettbewerben. E-Mail ist erforderlich, das Foto optional. Fotos werden vor dem
Versand im Browser verkleinert, serverseitig validiert und als kleine WebP-Avatare
im vorhandenen Bildfeld gespeichert; ein externer Storage-Zugang ist nicht nötig.

Unter `/admin/invitations` können Administratoren einen Wettbewerb auswählen und
persönliche Einladungen samt WhatsApp-Textdatei erzeugen. Alle Teilnehmer müssen
bereits mit Benutzerkonten verknüpft sein. Nur Superadmins dürfen Einladungen für
andere privilegierte Konten erzeugen; Admins dürfen ihr eigenes Konto einbeziehen.

Die Links enthalten zufällige 256-Bit-Tokens. Nur deren SHA-256-Hashes werden in
der Datenbank gespeichert. Gültigkeit: 14 Tage. GET-Aufrufe und Linkvorschauen
verbrauchen sie nicht; erst die erfolgreiche Profiländerung beansprucht den Link
atomar. Ein neuer Link ersetzt vorherige unbenutzte Einladungen. Ein benutzter,
unbekannter oder abgelaufener Link führt zur Anmeldung und danach ins eigene Profil.

Beim Erstzugang kann das Passwort ohne Kenntnis des alten ersetzt werden. Danach
erfordern E-Mail-/Passwortänderungen im persönlichen Profil das aktuelle Passwort.
Passwortänderungen erhöhen die Sitzungsversion und machen alte Sitzungen ungültig.
Profilseiten setzen `no-referrer` und `noindex, nofollow`.

Für einen ausdrücklich angeforderten Betreiberexport:
`npm run profiles:invite -- TRRC26`. Der Befehl erzeugt neue Links und zwei private
Textdateien im Git-ignorierten `scratch/`-Ordner. Er versendet keine Nachrichten.
Die Klartextlinks sind Zugangsdaten und dürfen nicht in Git oder öffentliche Logs
übernommen werden. Bereits ausgegebene Dateien nicht durch versehentliches erneutes
Erzeugen ungültig machen.

Optionales Weiterleitungsziel nach erfolgreicher Einrichtung:
`/profile/?player=TOKEN&RDIR=TRRC26/agenda` führt zu `/?comp=TRRC26&tab=agenda`.
Das Format ist `Wettbewerb-Slug/Tab`; externe Ziele sind ausgeschlossen. Ohne
`RDIR` öffnet sich das Profil. Verbrauchte Links führen weiterhin zur Anmeldung
und ins eigene Profil. Für einen Export mit Agenda-Ziel:
`npm run profiles:invite -- TRRC26 TRRC26/agenda`.

## Weitere Arbeit

Weitere Zerlegung großer UI-Komponenten und Bereinigung der dokumentierten
Lintaltlasten; vollständige Offline-PWA und Upload von Scorekartenfotos.
Der Dependency-Audit meldet nach den Sicherheitsupdates noch den
DeepmergeTS-Pfad im Prisma-CLI-Konfigurationspaket. Die vorgeschlagene
Behebung erfordert Prisma 7; dafür ist eine eigene geprüfte Migration nötig.
Die Anwendung verwendet keine vom Benutzer gelieferte Prisma-Konfiguration.
