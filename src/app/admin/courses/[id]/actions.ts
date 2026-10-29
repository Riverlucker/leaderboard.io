"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/access"
import { atomic } from "@/lib/transaction"

interface CourseInput {
  name: string
  holes: { id: string; par: number | string; strokeIndex: number | string }[]
  tees: { id: string; name: string; courseRating: number | string; slope: number | string }[]
}

export async function updateCourse(courseId: string, data: CourseInput) {
  await requireAdmin()
  if (typeof data.name !== "string" || !data.name.trim() || data.name.length > 200) throw new Error("Ungültiger Platzname.")
  if (!Array.isArray(data.holes) || !Array.isArray(data.tees) || !data.tees.length) throw new Error("Löcher und mindestens ein Abschlag erforderlich.")
  await atomic(async db => {
    const course = await db.course.findUniqueOrThrow({where: {id: courseId}, include: {holes: true, tees: true}})
    if (data.holes.length !== course.holes.length || new Set(data.holes.map(h => h.id)).size !== data.holes.length ||
        data.holes.some(h => !course.holes.some(existing => existing.id === h.id))) throw new Error("Falsche Lochzuordnung.")
    const indexes = data.holes.map(h => Number(h.strokeIndex))
    if (new Set(indexes).size !== indexes.length) throw new Error("Die Vorgabeindizes müssen eindeutig sein.")
    for (const hole of data.holes) {
      const par = Number(hole.par), strokeIndex = Number(hole.strokeIndex)
      if (!Number.isInteger(par) || par < 3 || par > 6 || !Number.isInteger(strokeIndex) || strokeIndex < 1 || strokeIndex > 18) throw new Error("Ungültige Lochdaten.")
      await db.hole.update({where: {id: hole.id}, data: {par, strokeIndex}})
    }
    if (new Set(data.tees.map(t => t.id)).size !== data.tees.length) throw new Error("Doppelte Abschläge.")
    for (const tee of course.tees.filter(t => !data.tees.some(next => next.id === t.id))) {
      const referenced = await db.tee.findUniqueOrThrow({where: {id: tee.id}, select: {_count: {select: {rounds: true, manualRoundHandicaps: true}}}})
      if (referenced._count.rounds || referenced._count.manualRoundHandicaps) throw new Error(`Abschlag ${tee.name} wird noch verwendet und kann nicht gelöscht werden.`)
      await db.tee.delete({where: {id: tee.id}})
    }
    for (const tee of data.tees) {
      const courseRating = Number(tee.courseRating), slope = Number(tee.slope)
      if (typeof tee.name !== "string" || !tee.name.trim() || !Number.isFinite(courseRating) || courseRating <= 0 || courseRating > 100 || !Number.isInteger(slope) || slope < 55 || slope > 155) throw new Error("Ungültige Abschlagdaten.")
      const values = {name: tee.name.trim(), courseRating, slope}
      if (course.tees.some(t => t.id === tee.id)) await db.tee.update({where: {id: tee.id}, data: values})
      else {
        if (!tee.id.startsWith("new_")) throw new Error("Abschlag gehört nicht zu diesem Golfplatz.")
        await db.tee.create({data: {courseId, ...values}})
      }
    }
    await db.course.update({where: {id: courseId}, data: {name: data.name.trim()}})
  })

  revalidatePath("/admin/courses")
  revalidatePath(`/admin/courses/${courseId}`)
  revalidatePath("/")
  
  return { success: true }
}
