import React from "react"
import { Calendar, Clock, MapPin, Award, Shield, FileText, CheckCircle2, AlertCircle, Sparkles } from "lucide-react"

export function RyderCupAgendaTab({ competition }: { competition: any }) {
  const rounds = competition?.rounds || []

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 text-amber-400 font-black text-xs uppercase tracking-widest mb-1">
              <Sparkles size={14} />
              <span>THE REAL RYDER CUP 2026 · SCHEDULE</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">Turnier-Agenda & Spielplan</h2>
          </div>
          <div className="inline-flex items-center gap-2 bg-amber-400/10 border border-amber-400/30 px-3.5 py-1.5 rounded-full text-xs font-bold text-amber-400">
            <span>3 Tage · 5 Runden · 21 Punkte</span>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-slate-300 mt-3 leading-relaxed max-w-3xl">
          Willkommen beim TRRC 2026. Drei Tage Spitzen-Matchplay auf Mallorca. Alle 7 Spieler jedes Teams sind in jeder Runde im Einsatz. Für den Cup-Sieg werden 11 Punkte benötigt.
        </p>
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* TAG 1 */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="bg-[#3765e9] text-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-blue-200">Tag 1 · Freitag</span>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono font-bold">19. Dez 2026</span>
            </div>
            <h3 className="text-xl font-black mt-1">T-Club Palma</h3>
            <div className="text-xs text-blue-100 flex items-center gap-1.5 mt-1">
              <MapPin size={13} />
              <span>T-Golf & Country Club Palma</span>
            </div>
          </div>

          <div className="p-4 space-y-4 flex-1 flex flex-col justify-between">
            <div className="space-y-3">
              {/* Session 1 */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                  <span className="flex items-center gap-1">
                    <Clock size={12} className="text-emerald-600" /> 09:02 Uhr
                  </span>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded font-black font-mono">18 Loch</span>
                </div>
                <div className="font-black text-slate-900 text-sm">Vormittag: Best Ball Matchplay</div>
                <div className="text-xs text-slate-600 mt-1 leading-snug">
                  85% Vorgabe (Bester Spieler auf 0). 3x Best Ball Matches (je 1.0 Pkt) + 1x Einzel-Matchplay (0.5 Pkt).
                </div>
                <div className="text-[11px] font-black text-amber-600 mt-2">
                  Gesamt Session: 3.5 Punkte
                </div>
              </div>

              {/* Session 2 */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                  <span className="flex items-center gap-1">
                    <Clock size={12} className="text-emerald-600" /> 14:22 Uhr
                  </span>
                  <span className="bg-cyan-100 text-cyan-800 text-[10px] px-2 py-0.5 rounded font-black font-mono">9 Loch (Front 9)</span>
                </div>
                <div className="font-black text-slate-900 text-sm">Nachmittag: Chapman-Vierer</div>
                <div className="text-xs text-slate-600 mt-1 leading-snug">
                  Pinehurst 60/40 Formel. 3x Chapman Matches (je 1.0 Pkt) + 1x Einzel-Matchplay über 9 Loch (0.5 Pkt).
                </div>
                <div className="text-[11px] font-black text-amber-600 mt-2">
                  Gesamt Session: 3.5 Punkte
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs font-black">
              <span className="text-slate-500">Tageswertung Tag 1:</span>
              <span className="bg-slate-900 text-white px-2 py-0.5 rounded font-mono">7.0 Punkte</span>
            </div>
          </div>
        </div>

        {/* TAG 2 */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="bg-[#1e293b] text-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-300">Tag 2 · Samstag</span>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono font-bold">20. Dez 2026</span>
            </div>
            <h3 className="text-xl font-black mt-1">Golf Son Gual</h3>
            <div className="text-xs text-slate-300 flex items-center gap-1.5 mt-1">
              <MapPin size={13} />
              <span>Golf Son Gual Mallorca</span>
            </div>
          </div>

          <div className="p-4 space-y-4 flex-1 flex flex-col justify-between">
            <div className="space-y-3">
              {/* Session 1 */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                  <span className="flex items-center gap-1">
                    <Clock size={12} className="text-emerald-600" /> 09:02 Uhr
                  </span>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded font-black font-mono">18 Loch</span>
                </div>
                <div className="font-black text-slate-900 text-sm">Vormittag: Best Ball Matchplay</div>
                <div className="text-xs text-slate-600 mt-1 leading-snug">
                  85% Vorgabe. 3x Best Ball Matches (je 1.0 Pkt) + 1x Einzel-Matchplay (0.5 Pkt).
                </div>
                <div className="text-[11px] font-black text-amber-600 mt-2">
                  Gesamt Session: 3.5 Punkte
                </div>
              </div>

              {/* Session 2 */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                  <span className="flex items-center gap-1">
                    <Clock size={12} className="text-emerald-600" /> 14:22 Uhr
                  </span>
                  <span className="bg-cyan-100 text-cyan-800 text-[10px] px-2 py-0.5 rounded font-black font-mono">9 Loch (Front 9)</span>
                </div>
                <div className="font-black text-slate-900 text-sm">Nachmittag: Chapman-Vierer</div>
                <div className="text-xs text-slate-600 mt-1 leading-snug">
                  Pinehurst 60/40 Formel. 3x Chapman Matches (je 1.0 Pkt) + 1x Einzel-Matchplay über 9 Loch (0.5 Pkt).
                </div>
                <div className="text-[11px] font-black text-amber-600 mt-2">
                  Gesamt Session: 3.5 Punkte
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs font-black">
              <span className="text-slate-500">Tageswertung Tag 2:</span>
              <span className="bg-slate-900 text-white px-2 py-0.5 rounded font-mono">7.0 Punkte</span>
            </div>
          </div>
        </div>

        {/* TAG 3 */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="bg-[#cb3838] text-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-red-200">Tag 3 · Sonntag</span>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono font-bold">21. Dez 2026</span>
            </div>
            <h3 className="text-xl font-black mt-1">T-Club Calvia</h3>
            <div className="text-xs text-red-100 flex items-center gap-1.5 mt-1">
              <MapPin size={13} />
              <span>T-Golf Calvia</span>
            </div>
          </div>

          <div className="p-4 space-y-4 flex-1 flex flex-col justify-between">
            <div className="space-y-3">
              {/* Session 1 */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                  <span className="flex items-center gap-1">
                    <Clock size={12} className="text-emerald-600" /> 11:12 Uhr
                  </span>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded font-black font-mono">18 Loch</span>
                </div>
                <div className="font-black text-slate-900 text-sm">Final Day Singles (Einzel)</div>
                <div className="text-xs text-slate-600 mt-1 leading-snug">
                  7 Einzel-Matchplays, geordnet strikt nach Handicap (höchstes HCP zuerst, niedrigstes HCP im Top-Match). 75% Vorgabe.
                </div>
                <div className="text-[11px] font-black text-amber-600 mt-2">
                  7 Matches à 1.0 Punkt = 7.0 Punkte
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <div className="font-black text-amber-900 text-xs flex items-center gap-1.5">
                  <Award size={14} className="text-amber-600" />
                  <span>Siegerehrung & Feier</span>
                </div>
                <p className="text-[11px] text-amber-800 mt-1">
                  Übergabe des TRRC Pokals an den Turniersieger sowie Ehrung des MVPs und Vergabe des gefürchteten Donut-Preises.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs font-black">
              <span className="text-slate-500">Tageswertung Tag 3:</span>
              <span className="bg-slate-900 text-white px-2 py-0.5 rounded font-mono">7.0 Punkte</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

export function RyderCupRulesTab() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl text-white">
        <div className="flex items-center gap-2 text-amber-400 font-black text-xs uppercase tracking-widest mb-1">
          <Shield size={14} />
          <span>OFFIZIELLES REGELWERK · TRRC 2026</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">Turnier- & Spielregeln</h2>
        <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-3xl leading-relaxed">
          Alle Matches werden nach den offiziellen R&A / USGA Golf- und Matchplay-Regeln ausgetragen, ergänzt um die spezifischen TRRC-Vorgabenregelungen.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Card 1: Matchplay & Wertung */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-black text-base border-b border-slate-200 pb-3">
            <Award size={18} className="text-amber-500" />
            <span>1. Matchplay-Prinzip & Punktevergabe</span>
          </div>

          <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
            <p>
              Gespielt wird <strong>Lochspiel (Matchplay)</strong>. Jedes Loch wird separat gewertet. Das Team bzw. der Spieler mit dem niedrigeren Netto-Score gewinnt das Loch (<strong>1 UP</strong>). Bei gleichem Netto-Score wird das Loch geteilt (<strong>Halved</strong>).
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 font-medium">
              <div className="flex justify-between">
                <span>Match-Gewinn (z. B. 2&1 oder 1 UP):</span>
                <span className="font-black text-emerald-600">1.0 Punkt (bzw. 0.5 im Solo-Match)</span>
              </div>
              <div className="flex justify-between">
                <span>Geteiltes Match nach 18/9 Loch (A/S):</span>
                <span className="font-black text-blue-600">0.5 Punkte (bzw. 0.25 im Solo-Match)</span>
              </div>
              <div className="flex justify-between">
                <span>Match-Verlust:</span>
                <span className="font-black text-slate-400">0.0 Punkte</span>
              </div>
            </div>
            <p>
              Ein Match ist vorzeitig entschieden, wenn eine Partei mit mehr Löchern führt, als noch zu spielen sind (z. B. <em>3&2</em> = 3 auf bei 2 verbleibenden Löchern).
            </p>
          </div>
        </div>

        {/* Card 2: Vorgabenberechnung */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-black text-base border-b border-slate-200 pb-3">
            <FileText size={18} className="text-blue-500" />
            <span>2. Formate & Handicap-Vorgaben</span>
          </div>

          <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
            <div>
              <div className="font-black text-slate-900 text-sm">A) Best Ball Matchplay (Vormittag Tag 1 & 2):</div>
              <p className="mt-0.5">
                Vierball-Bestball (2 gegen 2). Jeder spielt seinen eigenen Ball. Der beste Netto-Score jedes Teams zählt.
                <br />
                <span className="text-slate-900 font-bold">Vorgabe: 85% Differenz.</span> Der Spieler mit dem niedrigsten Playing Handicap im Flight wird auf <strong>0</strong> gesetzt. Die übrigen 3 Spieler erhalten 85% der Differenz als Schläge auf den schwersten Löchern (nach Stroke Index).
              </p>
            </div>

            <div className="pt-2 border-t border-slate-150">
              <div className="font-black text-slate-900 text-sm">B) Chapman-Vierer (Nachmittag Tag 1 & 2):</div>
              <p className="mt-0.5">
                Front 9 (9 Loch). Beide Partner schlagen ab. Schlag 2 wird jeweils über Kreuz mit dem Ball des Partners gespielt. Ab Schlag 3 wird der beste Ball gewählt und abwechselnd eingelocht.
                <br />
                <span className="text-slate-900 font-bold">Pinehurst-Formel:</span> Team-HCP = 60% des niedrigeren + 40% des höheren Spielers. Die Differenz beider Teams wird halbiert (da 9 Loch) und dem Team mit höherem Wert gutgeschrieben.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-150">
              <div className="font-black text-slate-900 text-sm">C) Final Day Singles (Tag 3):</div>
              <p className="mt-0.5">
                18 Loch Einzel-Matchplay. <span className="text-slate-900 font-bold">75% (3/4) Vorgabe</span> der Handicap-Differenz zwischen den beiden Kontrahenten. Gespielt wird strikt nach Handicap (höchstes HCP zuerst, niedrigstes HCP im Top-Match).
              </p>
            </div>
          </div>
        </div>

        {/* Card 3: Cup-Sieg & Sonderwertungen */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-black text-base border-b border-slate-200 pb-3">
            <Sparkles size={18} className="text-amber-500" />
            <span>3. Cup-Entscheidung & Wertungen</span>
          </div>

          <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3">
              <div className="font-black text-amber-950 text-sm">🏆 Gesamtsieg: 11 Punkte erforderlich</div>
              <p className="text-amber-900 mt-1">
                Von den 21 zu vergebenden Punkten sichert sich das Team mit mindestens 11 Punkten den Gesamtsieg. Bei 10.5 : 10.5 endet das Turnier unentschieden (Tie).
              </p>
            </div>

            <div>
              <span className="font-black text-slate-900">Most Valuable Player (MVP):</span>
              <p className="mt-0.5">
                Der Spieler, der im Turnierverlauf die meisten Punkte für sein Team erzielt (Sieg = 1.0 bzw. 0.5 Pkt, Teilung = 0.5 bzw. 0.25 Pkt).
              </p>
            </div>

            <div>
              <span className="font-black text-slate-900">Donut-Wertung:</span>
              <p className="mt-0.5">
                Das humorvolle Gegenstück zum MVP: Der Spieler, der über alle 5 Runden die wenigsten Punkte für sein Team beisteuern konnte.
              </p>
            </div>
          </div>
        </div>

        {/* Card 4: Match-Verhalten & Fairplay */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-black text-base border-b border-slate-200 pb-3">
            <CheckCircle2 size={18} className="text-emerald-500" />
            <span>4. Schenken & Fairplay</span>
          </div>

          <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
            <p>
              Im Lochspiel kann ein Putt, ein Loch oder das gesamte Match jederzeit vom Gegner <strong>geschenkt (conceded)</strong> werden. Eine Schenkung ist unwiderruflich und kann nicht abgelehnt werden.
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
              <div className="font-bold text-slate-900">Score-Erfassung & Live-Entry:</div>
              <p className="text-slate-600">
                Jedes Match erfasst den Score Loch für Loch per Handy. Ist ein Loch entschieden oder ein Ball aussichtslos im Hindernis, kann der Ball aufgehoben werden.
              </p>
            </div>
            <div className="text-[11px] text-slate-500 italic">
              "Der wahre Geist des Ryder Cups: Harter Wettkampf auf dem Platz, beste Freundschaft am 19. Loch."
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
