import { PrismaClient } from "@prisma/client"
import { mkdirSync, existsSync, writeFileSync } from "node:fs"
import { issueProfileInvitations } from "../src/lib/profile-invitations"
import { invitationMessage } from "../src/lib/invitation-message"

const db=new PrismaClient()
async function main() {
  const slug=process.argv[2]
  if (!slug) throw new Error("Competition-Slug erforderlich.")
  const prefix=`scratch/${slug.replace(/[^a-zA-Z0-9_-]/g,"")}-profile-${new Date().toISOString().replace(/[:.]/g,"-")}`
  if (existsSync(`${prefix}-whatsapp.txt`)) throw new Error("Ausgabedatei existiert bereits.")
  mkdirSync("scratch",{recursive:true})
  const result=await db.$transaction(async tx=>{
    const competition=await tx.competition.findFirstOrThrow({where:{uniqueSlug:{equals:slug,mode:"insensitive"}},include:{participants:{include:{user:{select:{id:true,name:true}}}}}})
    if (competition.participants.some(p=>!p.userId)) throw new Error("Teilnehmer ohne Benutzerkonto vorhanden.")
    if (slug.toUpperCase()==="TRRC26" && competition.participants.length!==14) throw new Error("Ryder-Cup-Liste muss genau 14 Teilnehmer enthalten.")
    const invitations=await issueProfileInvitations(tx,competition.participants.map(p=>p.userId!))
    return {competition,invitations:invitations.sort((a,b)=>a.name.localeCompare(b.name,"de"))}
  },{isolationLevel:"Serializable",timeout:30000})
  const links=result.invitations.map(i=>({name:i.name,url:`https://leaderboard.sc/profile/?player=${i.token}`,expiresAt:i.expiresAt.toISOString()}))
  writeFileSync(`${prefix}-links.txt`,links.map(i=>`${i.name}\n${i.url}\n`).join("\n"),{flag:"wx"})
  writeFileSync(`${prefix}-whatsapp.txt`,links.map((i,index)=>`${index+1}. ${i.name}\n\n${invitationMessage(i.name,i.url,slug.toUpperCase()==="TRRC26"?"Ryder Cup":result.competition.name,result.competition.uniqueSlug)}\n\n${"─".repeat(60)}\n`).join("\n"),{flag:"wx"})
  // Only file paths and counts; never print bearer links in logs.
  console.log(JSON.stringify({count:links.length,linksFile:`${prefix}-links.txt`,messagesFile:`${prefix}-whatsapp.txt`,expiresAt:links[0]?.expiresAt},null,2))
}
main().catch(()=>{console.error("Einladungen konnten nicht erzeugt werden. Kein automatischer Wiederholungsversuch, damit bereits erzeugte Links gültig bleiben.");process.exitCode=1}).finally(()=>db.$disconnect())
