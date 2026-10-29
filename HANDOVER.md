# Technische und fachliche Übergabedokumentation: leaderboard.io / Leaderboard.sc

**Stand:** 27. Oktober 2026
**Projekt:** leaderboard.io / Leaderboard.sc
**Technologie-Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript 5, Tailwind CSS v4, Prisma ORM 6, NextAuth.js v5, PostgreSQL (Neon / Vercel Postgres).

---

## Inhaltsverzeichnis
1. [Tatsächlich implementierte Funktionen vs. unfertige Bereiche](#1-tatsächlich-implementierte-funktionen-vs-unfertige-bereiche)
2. [Verbindlich vereinbarte Regeln & Berechnungslogik](#2-verbindlich-vereinbarte-regeln--berechnungslogik)
   - [Handicap- & Course-Handicap-Formeln](#handicap---course-handicap-formeln)
   - [Stableford-Wertung](#stableford-wertung)
   - [Matchplay-Wertung & Handicap Allowance](#matchplay-wertung--handicap-allowance)
   - [Ryder Cup Format (TRRC)](#ryder-cup-format-trrc)
   - [Wintercup & Champions League Format (CL)](#wintercup--champions-league-format-cl)
3. [Berechtigungskonzept & Rollen](#3-berechtigungskonzept--rollen)
4. [Bekannte Fehler, Workarounds & technische Kompromisse](#4-bekannte-fehler-workarounds--technische-kompromisse)
5. [Infrastruktur, Hosting, Deployment & Datenbank](#5-infrastruktur-hosting-deployment--datenbank)
6. [Offene Nutzerwünsche & Prioritäten](#6-offene-nutzerwünsche--prioritäten)

---

## 1. Tatsächlich implementierte Funktionen vs. unfertige Bereiche

### A. Tatsächlich implementiert & produktiv

1. **Authentifizierung & Benutzerverwaltung**
   - Credentials-Login via NextAuth v5 Beta (`src/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`) mit bcrypt-Passworthashing.
   - Rollensystem im Datenmodell: `USER`, `ADMIN`, `SUPER_ADMIN` (`prisma/schema.prisma`).
   - Session-Handling mit JWT-Callbacks für Benutzer-ID und Rolle.

2. **Admin-Bereich (`/admin`)**
   - Absicherung über Layout-Guard (`src/app/admin/layout.tsx`).
   - **Dashboard** (`/admin`): Schnellübersicht über Turniere und Nutzer.
   - **Competitions** (`/admin/competitions`, `[id]`): Anlegen, Bearbeiten, Runden-Zuweisung, Abschlagsauswahl, Teilnehmer-Zuweisung (Benutzer oder Dummy-Accounts), Team-Zuteilung, Matchplay-Paarungen.
   - **Courses & Tees** (`/admin/courses`, `[id]`): Golfplätze mit GPS-Koordinaten, Abschlägen (CR, Slope) und Löchern (Par, Stroke Index).
   - **Users** (`/admin/users`, `[id]`): Spielerdatenbank, Stammvorgabe (Handicap), Heimatclub, Telefonnummer, Rollenzuweisung.
   - **In-App Quick Settings**: Im Frontend-Header jeder Competition ("Configure Settings") für Administratoren direkt erreichbar (Rundenabschläge, manuelle Vorgaben, Runden-Resets, Audit-Log-Einsicht).

3. **Leaderboard & Ansichten (`CompetitionClientView.tsx`)**
   - **Landingpage & Cookie-Speicher** (`src/app/page.tsx`): Automatische Weiterleitung auf die zuletzt besuchte Competition (`last-comp-slug`).
   - **Brutto- und Netto-Ranglisten**: Einzel- und Teamwertungen, kumulativ über alle Runden oder nach Einzelrunden filterbar.
   - **Sortierung & T-Ränge**: Korrekte Berechnung geteilter Ränge (`T1`, `T3`) gem. `assignLeaderboardRanks` (`src/lib/scoring.ts`).
   - **Relativ zu Par**: Optionales Umschalten auf `+/-`/`E` Anzeige statt reiner Schlagzahlen.
   - **Außer Konkurrenz (aK)**: Spieler mit Flag `isOutOfCompetition` werden am Tabellenende separat geführt.
   - **Ryder Cup Ansicht (`src/app/components/RyderCupBoard.tsx`, `RyderCupView.tsx`)**:
     - Live Hero Score Banner (z. B. Diamonds vs. Hearts).
     - Match-Kacheln mit Tagesgruppierung, Status (Final, Lochzahl, Lead), Tee-Times und Gewichten.
     - MVP-Tabelle (Rangliste aller Spieler nach erspielten Matchplay-Punkten).
     - Donut-Tabelle (Spieler ohne Lochgewinn).
     - Agenda- & Regel-Tabs (`src/app/components/RyderCupAgendaRules.tsx`).
   - **Wintercup / CL-Format (`src/app/components/WintercupView.tsx`, `src/lib/clFormat.ts`)**:
     - Vorrunden in 3er-Gruppen oder 1v1 Matchplay.
     - Zwischenrunde und Playoff-Turnierbaum (K.o.-Phase).
     - Termin- und Slot-Buchungssystem mit Zeitslots und Sperrzeiten.
     - Datumsbasierte Anonymisierung künftiger Spielpaarungen.

4. **Score-Eingabe & Scorekarten**
   - **Live Score Entry**: Mobile Loch-für-Loch Eingabe (`+`, `-`, `/` für Wiped, `-` für Unplayed).
   - **Bulk Scorecard Entry** (`src/app/BulkScorecardEntry.tsx`): Schnelleingabe kompletter Runden auf einer Seite.
   - **Interaktive Scorekarten-Modals**:
     - `PlayerScorecardModal.tsx`: Einzel-Scorekarte mit Par, Vorgabe, Brutto, Netto und Stableford-Punkten.
     - `MatchplayScorecardModal.tsx`: Loch-für-Loch Vergleich mit farblicher Hervorhebung des Lochgewinners, Strichen und Führungshistorie.
     - `TeamScorecardModal.tsx`: Vierball-Best-Ball Scorekarte mit automatischer Markierung des gewerteten besten Balls.
     - `onShare`: Direkte Weitergabe von Scorekarten-Links via Clipboard.

5. **Spielerprofile, Avatare & Kontextmenü**
   - **Globales Kontextmenü** (`src/app/components/ContextMenu.tsx`): Rechtsklick auf jeden Spielernamen im gesamten Leaderboard und in allen Matchplays öffnet "Show Player Profile".
   - **Profil-Modal** (`src/app/components/PlayerProfileModal.tsx`): Anzeige von Porträtfoto, Sternen-Abzeichen (wenn `hasBadges` aktiv ist), Rundenhistorie mit Schnellaufruf historischer Scorekarten, Handicap-Korrekturanträgen.
   - **Profilbilder im Leaderboard**: Zentral neben Matchplay-Namen, linksbündig in Standard-Leaderboards und Scorekarten, global aktivierbar über die Admin-Einstellung `showProfilePicture` (`src/app/components/PlayerAvatar.tsx`).

---

### B. Bekannte unfertige / noch nicht implementierte Bereiche

1. **PWA & Offline Service Worker**
   - *Status:* In `PLAN.md` und `TODO.md` skizziert, aber im Code noch **nicht implementiert**.
   - *Auswirkung:* Bei Netzabbrüchen auf abgelegenen Golfbahnen können Eingaben fehlschlagen, wenn keine Verbindung zum Server besteht.

2. **Dateiuploads / Vercel Blob Storage**
   - *Status:* Das Schema sieht Bilder als String-URLs vor (`image`, `picture`). Ein nativer Datei-Upload-Endpunkt mit Vercel Blob ist noch nicht fertiggestellt.

3. **Automatisierte Testsuite**
   - *Status:* Keine Unit- oder E2E-Tests in `package.json` (`npm test` existiert nicht).
   - *Vorhanden:* Ca. 80 Ad-hoc Node/TSX-Verifikationsskripte im Ordner `scratch/`.

4. **Granulare Rechtevergabe für Scorer**
   - *Status:* Authentifizierte Benutzer können über das Frontend Scores eintragen; es gibt bisher keine serverseitige Begrenzung, die festlegt, dass Spieler X ausschließlich für sein eigenes Flight schreiben darf.

---

## 2. Verbindlich vereinbarte Regeln & Berechnungslogik

### Handicap- & Course-Handicap-Formeln
*Betroffene Dateien:* `src/lib/scoring.ts`, `src/app/CompetitionClientView.tsx`

1. **Course Handicap (Playing Handicap / Spielvorgabe):**
   $$\text{Course Handicap} = \text{round}\left( \text{Handicap Index} \times \frac{\text{Slope}}{113} + (\text{Course Rating} - \text{Course Par}) \right)$$
   - *Code:* `calculateCourseHandicap` in `src/lib/scoring.ts:21-28`.
   - *Sonderfall Manuelle Vorgaben:* In `ManualRoundHandicap` / `ManualCourseHandicap` kann die Spielleitung den Wert fix pro Runde/Abschlag überschreiben (z. B. für TRRC oder feste Vorgaben).
   - *Plus-Handicap (negatives CH):* Schläge werden auf den leichtesten Löchern (höchste Stroke Indices) abgezogen (`src/lib/scoring.ts:40-46`).

2. **Vorgabestriche pro Loch (`getHandicapStrokesOnHole`):**
   - Basis: $\lfloor \text{Course Handicap} / 18 \rfloor$.
   - Rest: $\text{Course Handicap} \pmod{18}$.
   - Löcher mit $\text{Stroke Index} \le \text{Rest}$ erhalten einen Zusatzstrich.

---

### Stableford-Wertung
*Betroffene Datei:* `src/lib/scoring.ts:54-68`

- **Brutto-Punkte:** $\max(0, 2 + \text{Par} - \text{GrossStrokes})$
- **Netto-Punkte:** $\max(0, 2 + \text{Par} + \text{HandicapStrokes} - \text{GrossStrokes})$
- **Sonderstatus:**
  - `WIPED` (`/`): Loch gestrichen $\rightarrow 0$ Punkte.
  - `NOT_PLAYED` (`-`): Noch kein Score $\rightarrow \text{null}$ (wird nicht gewertet).

---

### Matchplay-Wertung & Handicap Allowance
*Betroffene Dateien:* `src/app/CompetitionClientView.tsx`, `src/app/components/MatchplayScorecardModal.tsx`, `src/app/components/RyderCupBoard.tsx`

1. **Vorgaben-Berechnung (Differenz-Methode):**
   - Der Spieler bzw. das Team mit dem niedrigsten Playing Handicap spielt von Vorgabe `0`.
   - Die Gegner erhalten Schläge basierend auf der Differenz:
     $$\text{Allowance} = \text{round}((\text{CH}_{\text{Spieler}} - \text{CH}_{\text{Bester}}) \times \text{Allowance-Prozentsatz})$$
   - Standard-Prozentsatz: `75%` (konfigurierbar auf `50%`, `85%`, `100%` oder `0%`).
2. **Lochgewinn:**
   - Das niedrigere Nettoscore gewinnt das Loch (+1 Lead).
   - Bei gleichem Nettoscore: Loch geteilt (*Halved*).
3. **Short Track Limit:**
   - Wenn in der Competition `shortTrackLimit` gesetzt ist (z. B. `3`), wird der Vorsprung auf maximal $N$ Up gedeckelt.
4. **Match-Status & Abschluss:**
   - Liegt ein Team mit mehr Löchern in Führung, als noch zu spielen sind, ist das Match vorzeitig entschieden (z. B. `3&2`, `2&1`, `4&3`).
   - Bei Gleichstand nach allen Löchern: `All Square (AS)`.
   - Punktevergabe: Sieg = `1.0` Punkt, Unentschieden = `0.5` Punkt, Niederlage = `0.0` Punkte.

---

### Ryder Cup Format (TRRC)
*Betroffene Dateien:* `src/app/components/RyderCupBoard.tsx`, `src/app/components/RyderCupView.tsx`

1. **Team-Setup:** Zwei Teams (z. B. Team Diamonds in Blau vs. Team Hearts in Rot).
2. **Match-Typen:** Einzel-Matchplays (1v1) und Vierball/Chapman-Matchplays (2v2).
3. **Punktwertung:**
   - Matches können Gewichte haben (`weight`, z. B. `1.0` oder `0.5`).
   - Gesamtpunktestand wird mit echten halben Punkten formatiert (`formatCupScore`: z. B. `8 ½`).
4. **Zusatzwertungen:**
   - **MVP:** Rangliste der Spieler nach erzielten Matchpunkten.
   - **Donuts:** Liste der Spieler, die im Matchplay kein einziges Loch gewinnen konnten.
5. **Sterne-Abzeichen (`badgeType === "STARS"`):**
   - Ausschließlich aktiv für TRRC (`TRRC26`). Bei allen anderen Wettbewerben deaktiviert (`hasBadges = false`).

---

### Wintercup & Champions League Format (CL)
*Betroffene Dateien:* `src/lib/clFormat.ts`, `src/app/components/WintercupView.tsx`, `src/app/components/WintercupAdminView.tsx`

1. **Konfiguration:** Gespeichert als JSON im Feld `competition.cssConfig`.
2. **Vorrunden:**
   - Modus `GROUP_3`: 3er-Gruppen, rotierende Besetzung über die Vorrunden.
   - Modus `MATCHPLAY`: Berger-Tabellen-Algorithmus (Round-Robin ohne Wiederholungsduelle).
3. **Qualifikation & Zwischenrunde (`getQualificationStructure`):**
   - Direkte Playoff-Plätze: Die oberen Plätze ($\text{playoffCount} / 2$) qualifizieren sich direkt.
   - Zwischenrunde: Die nächsten $\text{playoffCount}$ Spieler spielen Überkreuz-Matches (z. B. 5. vs. 12., 6. vs. 11.).
4. **Playoff-Phasen:** K.o.-Turnierbaum (Viertelfinale, Halbfinale, Finale).
5. **Anonymisierung (`isRoundPairingsAnonymized`):**
   - Zukünftige Vorrundenpaarungen bleiben für Spieler anonymisiert (als `?`), bis das Startdatum der jeweiligen Runde erreicht ist.

---

## 3. Berechtigungskonzept & Rollen

| Aktion / Ansicht | Zuschauer (Gast) | Spieler (`USER`) | Admin (`ADMIN`) | Superadmin (`SUPER_ADMIN`) |
| :--- | :---: | :---: | :---: | :---: |
| Leaderboards & Matchplays ansehen | Ja | Ja | Ja | Ja |
| Scorekarten einsehen & teilen | Ja | Ja | Ja | Ja |
| Spielerprofile ansehen | Ja | Ja | Ja | Ja |
| Eigenes Profil bearbeiten (Foto/Mail) | Nein | Ja (eigenes) | Ja | Ja |
| Handicap-Request einreichen | Nein | Ja | Ja | Ja |
| Scores live eingeben | Nein (UI-Zugang) | Eingeloggt möglich | Ja | Ja |
| Admin-Panel (`/admin`) betreten | Nein (Redirect) | Nein (Redirect) | Ja | Ja |
| Wettbewerbe, Plätze, Abschläge anlegen | Nein | Nein | Ja | Ja |
| Manuelle Handicaps überschreiben | Nein | Nein | Ja | Ja |
| Scores zurücksetzen (Reset) | Nein | Nein | Ja | Ja |
| Handicap-Requests genehmigen/ablehnen | Nein | Nein | Ja | Ja |
| Andere Admins ernennen | Nein | Nein | Nein | Ja |

---

## 4. Bekannte Fehler, Workarounds & technische Kompromisse

1. **Monolithische Client-Komponente (`CompetitionClientView.tsx`)**
   - *Problem:* Mit über 6.000 Zeilen vereint die Datei Leaderboard-Tabs, Berechnungen, Scorecard-Modals, Quick-Settings und Audit-Logs.
   - *Kompromiss:* Ermöglicht schnelles State-Sharing ohne prop-drilling über 10 Schichten, führt jedoch zu langen Re-Render-Ketten bei Änderungen.
   - *Empfehlung:* Schrittweises Auslagern der Sub-Tabs (`LeaderboardTab`, `ScoresTab`, `AdminSettingsModal`) in eigene Komponenten.

2. **Schema-Evolution via `prisma db push` statt Migrationen**
   - *Problem:* Es gibt keinen formellen Migrationsverlauf (`prisma/migrations` ist nicht eingecheckt).
   - *Workaround:* Änderungen am Schema wurden direkt per `prisma db push` gegen die Neon-PostgreSQL-Datenbank eingespielt.
   - *Risiko:* Bei Teamarbeit können Schema-Konflikte auftreten, wenn Felder ohne Migrationsskripte umbenannt werden.

3. **Client-Routing & State-Synchronisation**
   - *Technischer Kompromiss:* Tabs und Modal-Zustände werden über eine Mischung aus `URLSearchParams` (`tab`, `round`, `type`), `localStorage` und React State gesteuert. Gelegentlich muss bei Navigationen manuell `window.history.replaceState` synchronisiert werden.

4. **Fehlende automatisierte Regressionstests**
   - *Kompromiss:* Schnelle Entwicklungsgeschwindigkeit, jedoch hohe Abhängigkeit von manueller Funktionsprüfung und den Skripten im Ordner `scratch/`.

---

## 5. Infrastruktur, Hosting, Deployment & Datenbank

- **Hosting & Plattform:** Vercel (Next.js App Router).
- **Automatisches Deployment:** Jeder Push auf den Branch `main` des Repositories (`Riverlucker/leaderboard.io`) löst ein Vercel Production Deployment aus.
- **Datenbank-Provider:** Neon PostgreSQL (Serverless PostgreSQL mit Connection Pooling).
  - *Pooling-URL:* Umgebungsvariable `POSTGRES_PRISMA_URL` (genutzt für Webapp-Abfragen).
  - *Direct-URL:* Umgebungsvariable `POSTGRES_URL_NON_POOLING` (genutzt für Prisma-CLI und Schemapushes).
- **Build-Prozess:** `next build` mit Turbopack und automatischem TypeScript-Check.
- **Backup & Ausfallsicherheit:** Point-in-Time Recovery und automatische Snapshots über das Neon Console Dashboard.

---

## 6. Offene Nutzerwünsche & Prioritäten

| Priorität | Thema / Feature | Beschreibung |
| :---: | :--- | :--- |
| **Prio 1** | **Flight-Locking bei Score-Eingabe** | Serverseitig absichern, dass authentifizierte Spieler nur Scores für ihr eigenes Match bzw. ihr eigenes Flight erfassen und verändern dürfen. |
| **Prio 2** | **Nativer Bild-Upload (Vercel Blob)** | Direkter Datei-Upload für Spielerfotos im Profil und Scorekarten-Fotos statt manueller Bild-URLs. |
| **Prio 3** | **Offline-PWA (Service Worker)** | Caching von Spielständen im LocalStorage/IndexedDB bei Verbindungsabbruch auf dem Platz mit automatischem Sync bei Wiederverbindung. |
| **Prio 4** | **Refactoring & Test-Framework** | Aufsplittung von `CompetitionClientView.tsx` in Submodule und Einrichtung von `vitest` zur Absicherung der Scoring-Engine. |

---

*Ende der Übergabedokumentation.*
