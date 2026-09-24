import React from "react"
import { Calendar, Clock, MapPin, Award, Shield, FileText, CheckCircle2, AlertTriangle, Sparkles, Bus } from "lucide-react"

export function RyderCupAgendaTab({ competition }: { competition: any }) {
  const scheduleRows = [
    {
      session: "Pre-Event",
      date: "Do, 17.12.",
      course: "Lindner Hotel",
      courseType: "Teams auslosen & Welcome",
      shuttle: "Hotel Lindner",
      teeTimes: "Abend",
      holes: "-",
      estEnd: "Open End",
      isPractice: true,
      evening: "Lindner",
      badgeColor: "bg-purple-100 text-purple-900 border-purple-300"
    },
    {
      session: "Tag 1 VM",
      date: "Fr, 18.12.",
      course: "Son Muntaner (TBD)",
      courseType: "Einspielrunde / Proberunde",
      shuttle: "09:30 - 17:00",
      teeTimes: "11:00 / 11:10 / 11:20 / 11:30",
      holes: "18 Loch",
      estEnd: "~15:30",
      isPractice: true,
      evening: "TBD gemeinsam",
      badgeColor: "bg-slate-100 text-slate-800 border-slate-300"
    },
    {
      session: "Tag 2 VM",
      date: "Sa, 19.12.",
      course: "T Club Palma",
      courseType: "Runde 1: Best Ball (3.5 Pkt)",
      shuttle: "07:40 - 17:30",
      teeTimes: "08:50 / 09:00 / 09:10 / 09:20",
      holes: "18 Loch",
      estEnd: "~13:30",
      isPractice: false,
      evening: "",
      badgeColor: "bg-blue-100 text-blue-900 border-blue-300"
    },
    {
      session: "Tag 2 NM",
      date: "Sa, 19.12.",
      course: "T Club Palma",
      courseType: "Runde 1: Chapman 4er (3.5 Pkt)",
      shuttle: "Vor Ort (Pause & Lunch)",
      teeTimes: "14:10 / 14:20 / 14:30 / 14:40",
      holes: "9 Loch",
      estEnd: "~17:00",
      isPractice: false,
      evening: "individuell",
      badgeColor: "bg-blue-100 text-blue-900 border-blue-300"
    },
    {
      session: "Tag 3 VM",
      date: "So, 20.12.",
      course: "Son Gual",
      courseType: "Runde 2: Best Ball (3.5 Pkt)",
      shuttle: "07:40 - 17:30",
      teeTimes: "08:50 / 09:00 / 09:10 / 09:20",
      holes: "18 Loch",
      estEnd: "~13:30",
      isPractice: false,
      evening: "",
      badgeColor: "bg-emerald-100 text-emerald-900 border-emerald-300"
    },
    {
      session: "Tag 3 NM",
      date: "So, 20.12.",
      course: "Son Gual",
      courseType: "Runde 2: Chapman 4er (3.5 Pkt)",
      shuttle: "Vor Ort (Pause & Lunch)",
      teeTimes: "14:10 / 14:20 / 14:30 / 14:40",
      holes: "9 Loch",
      estEnd: "~17:00",
      isPractice: false,
      evening: "individuell",
      badgeColor: "bg-emerald-100 text-emerald-900 border-emerald-300"
    },
    {
      session: "Tag 4 VM",
      date: "Mo, 21.12.",
      course: "T Club Calviá",
      courseType: "Finale: Singles (7.0 Pkt)",
      shuttle: "09:30 - 21:00",
      teeTimes: "11:00 / 11:10 / 11:20 / 11:30",
      holes: "18 Loch",
      estEnd: "~15:30",
      isPractice: false,
      evening: "Calvia",
      badgeColor: "bg-amber-100 text-amber-950 border-amber-300"
    },
  ]

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 text-amber-400 font-black text-xs uppercase tracking-widest mb-1">
              <Sparkles size={14} />
              <span>THE REAL RYDER CUP 2026 · OFFIZIELLER ZEITPLAN</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">Turnier-Agenda & Vollständiger Tagesplan</h2>
          </div>
          <div className="inline-flex items-center gap-2 bg-amber-400/10 border border-amber-400/30 px-3.5 py-1.5 rounded-full text-xs font-bold text-amber-400">
            <span>5 Tage (17.–21. Dez) · 6 Runden · 21 Cup-Punkte</span>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-slate-300 mt-3 leading-relaxed max-w-4xl">
          Vollständiger Ablaufplan für den TRRC 2026 auf Mallorca: Beginnend mit der Teamauslosung am Donnerstagabend (17.12.) im Lindner Hotel, der offiziellen Einspielrunde auf Son Muntaner am Freitag (18.12.), gefolgt von den drei Ryder-Cup Wettkampftagen (19.–21.12.) auf T-Club Palma, Son Gual und dem großen Finale auf T-Club Calviá.
        </p>
      </div>

      {/* Official Spreadsheet Table: VOLLSTÄNDIGER TAGESPLAN */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
        {/* Table Title Bar */}
        <div className="bg-[#1f3f2d] text-white px-5 py-3 font-black text-sm sm:text-base uppercase tracking-wider flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-emerald-400" />
            <span>VOLLSTÄNDIGER TAGESPLAN</span>
          </div>
          <span className="text-xs font-mono font-medium text-emerald-200">Dezember 2026</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-[#87af96] text-slate-950 font-black text-xs uppercase border-b border-slate-300">
                <th className="py-2.5 px-3 sm:px-4">Session / Event</th>
                <th className="py-2.5 px-3 sm:px-4">Datum</th>
                <th className="py-2.5 px-3 sm:px-4">Ort / Platz</th>
                <th className="py-2.5 px-3 sm:px-4">Shuttle</th>
                <th className="py-2.5 px-3 sm:px-4 text-center">Tee Times</th>
                <th className="py-2.5 px-2 sm:px-3 text-center">Runde</th>
                <th className="py-2.5 px-3 sm:px-4 text-center">Est. Ende</th>
                <th className="py-2.5 px-3 sm:px-4 text-right">Abendplanung</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium">
              {scheduleRows.map((row, idx) => (
                <tr 
                  key={idx} 
                  className={`hover:bg-slate-50/80 transition-colors ${
                    row.isPractice ? "bg-slate-50/60" : "bg-white"
                  }`}
                >
                  <td className="py-3 px-3 sm:px-4 font-black">
                    <span className={`inline-block px-2 py-0.5 rounded border text-xs ${row.badgeColor}`}>
                      {row.session}
                    </span>
                    {row.isPractice && row.session !== "Pre-Event" && (
                      <span className="ml-1.5 text-[10px] bg-slate-200 text-slate-700 font-bold px-1.5 py-0.5 rounded">
                        Proberunde
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 sm:px-4 font-bold text-slate-900 whitespace-nowrap">
                    {row.date}
                  </td>
                  <td className="py-3 px-3 sm:px-4 font-extrabold text-slate-800">
                    <div>{row.course}</div>
                    <div className="text-[11px] font-normal text-slate-500">{row.courseType}</div>
                  </td>
                  <td className="py-3 px-3 sm:px-4 text-slate-650 font-mono text-xs whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Bus size={13} className="text-slate-400 shrink-0" />
                      <span>{row.shuttle}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 sm:px-4 text-center">
                    <span className="inline-block bg-[#d1fae5] text-[#065f46] font-mono font-black px-2.5 py-1 rounded-md text-xs border border-emerald-300">
                      {row.teeTimes}
                    </span>
                  </td>
                  <td className="py-3 px-2 sm:px-3 text-center font-bold text-slate-800">
                    {row.holes}
                  </td>
                  <td className="py-3 px-3 sm:px-4 text-center font-mono font-bold text-slate-700">
                    {row.estEnd}
                  </td>
                  <td className="py-3 px-3 sm:px-4 text-right font-extrabold text-emerald-850 whitespace-nowrap">
                    {row.evening ? (
                      <span className="inline-block bg-amber-50 text-amber-900 border border-amber-200/80 px-2.5 py-1 rounded-md text-xs">
                        🍽️ {row.evening}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Daylight Alert Notice (From Screenshot) */}
        <div className="bg-[#fef9c3] border-t border-[#fef08a] px-4 py-3 text-xs text-[#854d0e] flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-black">Hinweis Tageslicht: </span>
            Die Nachmittagsrunden an Tag 2 und 3 (9 Loch ab 14:10 Uhr) enden schätzungsweise gegen 17:00 Uhr. Sonnenuntergang ~17:26 Uhr – ausreichend Licht vorhanden.
          </div>
        </div>
      </div>

      {/* 4 Days Detail Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* TAG 1 (FR, 18.12.) - Proberunde */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="bg-slate-800 text-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-300">Tag 1 · Freitag</span>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono font-bold">18. Dez 2026</span>
            </div>
            <h3 className="text-lg font-black mt-1">Son Muntaner</h3>
            <div className="text-xs text-slate-300 flex items-center gap-1.5 mt-0.5">
              <MapPin size={12} />
              <span>Golf Son Muntaner</span>
            </div>
          </div>

          <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
            <div className="space-y-2.5">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                  <span className="flex items-center gap-1 font-mono">
                    <Clock size={12} className="text-emerald-600" /> 11:00 - 11:30
                  </span>
                  <span className="bg-slate-200 text-slate-800 text-[10px] px-2 py-0.5 rounded font-black font-mono">18 Loch</span>
                </div>
                <div className="font-black text-slate-900 text-sm">Offizielle Proberunde</div>
                <div className="text-xs text-slate-600 mt-1 leading-snug">
                  Einspielen, Platzbesichtigung & Vorbereitung auf die Wettkampftage. 4 Flights à 4 Spieler.
                </div>
              </div>

              <div className="text-xs text-slate-500 flex items-center gap-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200">
                <Bus size={13} className="text-slate-600" />
                <span>Shuttle: 09:30 - 17:00 Uhr</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs font-bold text-slate-500">
              <span className="text-amber-850 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-semibold">🍽️ TBD gemeinsam</span>
              <span className="text-slate-400 font-mono">Ende ~15:30</span>
            </div>
          </div>
        </div>

        {/* TAG 2 (SA, 19.12.) - TRRC Tag 1 */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="bg-[#3765e9] text-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-blue-200">Tag 2 · Samstag</span>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono font-bold">19. Dez 2026</span>
            </div>
            <h3 className="text-lg font-black mt-1">T-Club Palma</h3>
            <div className="text-xs text-blue-100 flex items-center gap-1.5 mt-0.5">
              <MapPin size={12} />
              <span>T-Golf Palma</span>
            </div>
          </div>

          <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
            <div className="space-y-2.5">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                  <span className="font-mono text-emerald-700">VM 08:50 - 09:20</span>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.5 rounded font-black font-mono">18 Loch</span>
                </div>
                <div className="font-black text-slate-900 text-xs">Best Ball Matchplay (3.5 Pkt)</div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  85% Vorgabe · 3 Matches (1.0 Pkt) + 1 Einzel (0.5 Pkt)
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                  <span className="font-mono text-cyan-700">NM 14:10 - 14:40</span>
                  <span className="bg-cyan-100 text-cyan-800 text-[10px] px-1.5 py-0.5 rounded font-black font-mono">9 Loch</span>
                </div>
                <div className="font-black text-slate-900 text-xs">Chapman-Vierer (3.5 Pkt)</div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  Pinehurst 60/40 · 3 Matches + 1 Einzel
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs font-bold">
              <span className="text-amber-850 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">🍽️ individuell</span>
              <span className="bg-blue-600 text-white px-2 py-0.5 rounded font-mono font-black">7.0 Pkt</span>
            </div>
          </div>
        </div>

        {/* TAG 3 (SO, 20.12.) - TRRC Tag 2 */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="bg-[#1e293b] text-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-300">Tag 3 · Sonntag</span>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono font-bold">20. Dez 2026</span>
            </div>
            <h3 className="text-lg font-black mt-1">Golf Son Gual</h3>
            <div className="text-xs text-slate-300 flex items-center gap-1.5 mt-0.5">
              <MapPin size={12} />
              <span>Golf Son Gual</span>
            </div>
          </div>

          <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
            <div className="space-y-2.5">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                  <span className="font-mono text-emerald-700">VM 08:50 - 09:20</span>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.5 rounded font-black font-mono">18 Loch</span>
                </div>
                <div className="font-black text-slate-900 text-xs">Best Ball Matchplay (3.5 Pkt)</div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  85% Vorgabe · 3 Matches (1.0 Pkt) + 1 Einzel (0.5 Pkt)
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                  <span className="font-mono text-cyan-700">NM 14:10 - 14:40</span>
                  <span className="bg-cyan-100 text-cyan-800 text-[10px] px-1.5 py-0.5 rounded font-black font-mono">9 Loch</span>
                </div>
                <div className="font-black text-slate-900 text-xs">Chapman-Vierer (3.5 Pkt)</div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  Pinehurst 60/40 · 3 Matches + 1 Einzel
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs font-bold">
              <span className="text-amber-850 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">🍽️ individuell</span>
              <span className="bg-slate-900 text-white px-2 py-0.5 rounded font-mono font-black">7.0 Pkt</span>
            </div>
          </div>
        </div>

        {/* TAG 4 (MO, 21.12.) - TRRC Finale */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="bg-[#cb3838] text-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-red-200">Tag 4 · Montag</span>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono font-bold">21. Dez 2026</span>
            </div>
            <h3 className="text-lg font-black mt-1">T-Club Calviá</h3>
            <div className="text-xs text-red-100 flex items-center gap-1.5 mt-0.5">
              <MapPin size={12} />
              <span>T-Golf Calviá</span>
            </div>
          </div>

          <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
            <div className="space-y-2.5">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                  <span className="font-mono text-emerald-700">11:00 - 11:30</span>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.5 rounded font-black font-mono">18 Loch</span>
                </div>
                <div className="font-black text-slate-900 text-xs">Final Day Singles (7.0 Pkt)</div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  7 Einzel-Matchplays strictly nach Handicap-Reihenfolge.
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-2">
                <div className="font-black text-amber-950 text-xs flex items-center gap-1">
                  <Award size={13} className="text-amber-600" />
                  <span>Siegerehrung & Feier</span>
                </div>
                <div className="text-[10px] text-amber-800 mt-0.5">
                  Übergabe des TRRC Pokals, MVP & Donut-Preis. Shuttle bis 21:00.
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs font-bold">
              <span className="text-amber-850 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">🍽️ Calvia</span>
              <span className="bg-red-600 text-white px-2 py-0.5 rounded font-mono font-black">7.0 Pkt</span>
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
              <div className="font-black text-slate-900 text-sm">A) Best Ball Matchplay (Vormittag Tag 2 & 3):</div>
              <p className="mt-0.5">
                Vierball-Bestball (2 gegen 2). Jeder spielt seinen eigenen Ball. Der beste Netto-Score jedes Teams zählt.
                <br />
                <span className="text-slate-900 font-bold">Vorgabe: 85% Differenz.</span> Der Spieler mit dem niedrigsten Playing Handicap im Flight wird auf <strong>0</strong> gesetzt. Die übrigen 3 Spieler erhalten 85% der Differenz als Schläge auf den schwersten Löchern (nach Stroke Index).
              </p>
            </div>

            <div className="pt-2 border-t border-slate-150">
              <div className="font-black text-slate-900 text-sm">B) Chapman-Vierer (Nachmittag Tag 2 & 3 - 9 Loch):</div>
              <p className="mt-0.5">
                Front 9 (9 Loch). Beide Partner schlagen ab. Schlag 2 wird jeweils über Kreuz mit dem Ball des Partners gespielt. Ab Schlag 3 wird der beste Ball gewählt und abwechselnd eingelocht.
                <br />
                <span className="text-slate-900 font-bold">Pinehurst-Formel:</span> Team-HCP = 60% des niedrigeren + 40% des höheren Spielers. Die Differenz beider Teams wird halbiert (da 9 Loch) und dem Team mit höherem Wert gutgeschrieben.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-150">
              <div className="font-black text-slate-900 text-sm">C) Final Day Singles (Tag 4):</div>
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
                Das humorvolle Gegenstück zum MVP: Der Spieler, der über alle Runden die wenigsten Punkte für sein Team beisteuern konnte.
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
