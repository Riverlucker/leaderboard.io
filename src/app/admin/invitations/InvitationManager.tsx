"use client"

import { useState } from "react"
import { createCompetitionInvitations } from "./actions"

export function InvitationManager({competitions}:{competitions:{id:string;name:string;count:number}[]}) {
  const [competition,setCompetition]=useState(competitions[0]?.id||"")
  const [confirm,setConfirm]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState("")
  const [links,setLinks]=useState<Awaited<ReturnType<typeof createCompetitionInvitations>>>([])
  function download() {
    const content=links.map(i=>`${i.name}\n${i.message}\n\n${"─".repeat(48)}`).join("\n\n")
    const url=URL.createObjectURL(new Blob([content],{type:"text/plain;charset=utf-8"}))
    const anchor=document.createElement("a");anchor.href=url;anchor.download="Leaderboard-Profil-Einladungen.txt";anchor.click();URL.revokeObjectURL(url)
  }
  return <section className="mt-6 max-w-3xl space-y-5">
    <p className="text-slate-300">Erzeuge persönliche Links für bestehende Benutzerkonten eines Wettbewerbs. Die Profile gelten für alle Wettbewerbe.</p>
    <select aria-label="Wettbewerb" value={competition} onChange={e=>{setCompetition(e.target.value);setConfirm(false)}} disabled={busy} className="w-full rounded-lg border border-slate-600 bg-slate-900 p-3">{competitions.map(c=><option key={c.id} value={c.id}>{c.name} ({c.count})</option>)}</select>
    <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)} /><span>Neue Links erzeugen. Bisherige unbenutzte Einladungslinks dieser Spieler werden dadurch ungültig. Bestehende Passwörter bleiben bis zur tatsächlichen Einrichtung unverändert.</span></label>
    <button disabled={!competition||busy||!confirm} onClick={async()=>{setBusy(true);setError("");try{setLinks(await createCompetitionInvitations(competition));setConfirm(false)}catch(e){setError(e instanceof Error?e.message:"Erzeugen fehlgeschlagen.")}finally{setBusy(false)}}} className="rounded-xl bg-emerald-400 px-5 py-3 font-bold text-slate-950 disabled:opacity-50">{busy?"Wird erzeugt …":"Einladungslinks erzeugen"}</button>
    {error&&<p role="alert" className="text-red-400">{error}</p>}
    {!!links.length&&<><p role="status">{links.length} Einladungen erzeugt. Bitte jetzt herunterladen; die persönlichen Links werden nur hier angezeigt.</p><button onClick={download} className="rounded-xl border border-emerald-400 px-5 py-3 text-emerald-300">WhatsApp-Texte als Textdatei herunterladen</button><ul className="space-y-3">{links.map(i=><li key={i.url} className="rounded-xl bg-slate-900 p-4"><p className="font-bold">{i.name}</p><p className="mt-2 break-all text-sm text-emerald-300">{i.url}</p></li>)}</ul></>}
  </section>
}
