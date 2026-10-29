"use client"

import { useState, type FormEvent, type ChangeEvent } from "react"
import Link from "next/link"
import NextImage from "next/image"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { savePersonalProfile } from "./actions"

async function readPhoto(file: File): Promise<string> {
  if (!["image/jpeg","image/png","image/webp"].includes(file.type) || file.size > 8*1024*1024) throw new Error("Bitte ein JPG-, PNG- oder WebP-Foto bis 8 MB auswählen.")
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    await new Promise<void>((resolve,reject) => {image.onload=()=>resolve();image.onerror=()=>reject(new Error("Foto konnte nicht gelesen werden."));image.src=url})
    const canvas = document.createElement("canvas")
    const scale = Math.min(1,512/Math.max(image.width,image.height))
    canvas.width = Math.max(1,Math.round(image.width*scale)); canvas.height = Math.max(1,Math.round(image.height*scale))
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Bildverarbeitung nicht verfügbar.")
    context.fillStyle="#ffffff";context.fillRect(0,0,canvas.width,canvas.height)
    context.drawImage(image,0,0,canvas.width,canvas.height)
    return canvas.toDataURL("image/jpeg",0.8)
  } finally {URL.revokeObjectURL(url)}
}

export function ProfileForm({name,email:initialEmail,image,token,invitation=false,redirectTo="/profile"}:{name:string;email:string;image:string|null;token?:string;invitation?:boolean;redirectTo?:string}) {
  const router = useRouter()
  const [email,setEmail]=useState(initialEmail)
  const [password,setPassword]=useState("")
  const [confirmation,setConfirmation]=useState("")
  const [currentPassword,setCurrentPassword]=useState("")
  const [photo,setPhoto]=useState<string>()
  const [busy,setBusy]=useState(false)
  const [photoBusy,setPhotoBusy]=useState(false)
  const [error,setError]=useState("")
  const [success,setSuccess]=useState("")
  async function selectPhoto(event:ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setPhotoBusy(true);setError("")
    try {setPhoto(await readPhoto(file))} catch(e) {setError(e instanceof Error ? e.message : "Foto konnte nicht gelesen werden.")}
    finally {setPhotoBusy(false);event.target.value=""}
  }
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setError("");setSuccess("")
    if (password!==confirmation) {setError("Die neuen Passwörter stimmen nicht überein.");return}
    setBusy(true)
    try {
      const result = await savePersonalProfile({email,password,currentPassword,image:photo,token})
      if (!result.success) {setError(result.error || "Speichern fehlgeschlagen.");return}
      if (result.reauthenticate) {
        const login=await signIn("credentials",{email:email.trim().toLowerCase(),password,redirect:false})
        if (!login?.ok || login.error) {router.replace(`/login?callbackUrl=${encodeURIComponent(redirectTo)}`);return}
        router.replace(redirectTo);router.refresh()
      } else {setSuccess("Dein Profil wurde gespeichert.");setPhoto(undefined);router.refresh()}
      setPassword("");setConfirmation("");setCurrentPassword("")
    } catch {setError("Die Verbindung wurde unterbrochen. Bitte erneut versuchen; falls dein Profil bereits gespeichert wurde, melde dich mit deinem neuen Passwort an.")}
    finally {setBusy(false)}
  }
  const field="w-full rounded-xl border border-slate-600 bg-slate-950 px-4 py-3 text-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-400"
  return <main className="min-h-screen bg-slate-950 text-slate-100 px-5 py-10 sm:py-16">
    <div className="mx-auto max-w-lg">
      <Link href="/" className="text-sm font-semibold text-emerald-400">Leaderboard.sc</Link>
      <section className="mt-6 rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-xl sm:p-9">
        <p className="text-xs uppercase tracking-widest text-emerald-400">{invitation ? "Dein persönlicher Zugang" : "Dein Spielerprofil"}</p>
        <h1 className="mt-2 text-3xl font-bold">{invitation ? `Willkommen, ${name.split(" ")[0]}!` : name}</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">{invitation ? "Vervollständige dein Profil und lege dein persönliches Passwort fest. Dein Zugang gilt für alle Wettbewerbe auf Leaderboard.sc." : "Verwalte deinen persönlichen Zugang unabhängig von deinen Wettbewerben."}</p>
        {invitation && <p className="mt-2 text-xs text-slate-400">Dein Link wird erst nach erfolgreichem Speichern verwendet. Das Foto ist freiwillig.</p>}
        <form onSubmit={submit} className="mt-7 space-y-5">
          <div className="flex items-center gap-4">
            {(photo || image) ? <NextImage unoptimized width={80} height={80} src={photo || image || ""} alt={`Profilfoto von ${name}`} referrerPolicy="no-referrer" className="h-20 w-20 rounded-full object-cover" /> : <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-700 text-2xl font-bold" aria-label="Noch kein Profilfoto">{name.slice(0,1)}</div>}
            <label className="text-sm font-semibold">Profilfoto <span className="font-normal text-slate-400">(optional)</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy||photoBusy} onChange={selectPhoto} className="mt-2 block w-full text-xs text-slate-300" />
            </label>
          </div>
          <label className="block space-y-2 text-sm font-semibold"><span>E-Mail-Adresse</span><input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} className={field} /></label>
          {!invitation && <label className="block space-y-2 text-sm font-semibold"><span>Aktuelles Passwort</span><input type="password" autoComplete="current-password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} className={field} /><span className="block text-xs font-normal text-slate-400">Nur für eine Änderung der E-Mail-Adresse oder des Passworts erforderlich.</span></label>}
          <label className="block space-y-2 text-sm font-semibold"><span>{invitation ? "Dein Passwort" : "Neues Passwort (optional)"}</span><input type="password" autoComplete="new-password" minLength={10} maxLength={72} required={invitation} value={password} onChange={e=>setPassword(e.target.value)} className={field} /><span className="block text-xs font-normal text-slate-400">Mindestens 10 Zeichen.</span></label>
          <label className="block space-y-2 text-sm font-semibold"><span>Neues Passwort wiederholen</span><input type="password" autoComplete="new-password" required={invitation||!!password} value={confirmation} onChange={e=>setConfirmation(e.target.value)} className={field} /></label>
          {error && <p role="alert" className="rounded-xl bg-red-950 p-3 text-sm text-red-200">{error}</p>}
          {success && <p role="status" className="rounded-xl bg-emerald-950 p-3 text-sm text-emerald-200">{success}</p>}
          <button disabled={busy||photoBusy} className="w-full rounded-xl bg-emerald-400 px-4 py-3 font-bold text-slate-950 disabled:opacity-50">{photoBusy ? "Foto wird vorbereitet …" : busy ? "Wird gespeichert …" : invitation ? "Profil einrichten" : "Änderungen speichern"}</button>
        </form>
      </section>
      <Link href="/" className="mt-5 inline-block text-sm text-slate-300">Zur Turnierübersicht</Link>
    </div>
  </main>
}
