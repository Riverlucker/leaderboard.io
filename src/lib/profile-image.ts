import "server-only"
import sharp from "sharp"

/** Small, reencoded avatars use the existing image field, without a storage account. */
export async function prepareProfileImage(value: string | null | undefined): Promise<string | undefined> {
  if (!value) return undefined
  if (value.length > 400000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) throw new Error("Bitte ein JPG-, PNG- oder WebP-Foto auswählen.")
  const data = Buffer.from(value.slice(value.indexOf(",")+1),"base64")
  try {
    const photo = await sharp(data,{limitInputPixels:16000000}).rotate().resize(256,256,{fit:"cover",withoutEnlargement:true}).webp({quality:80}).toBuffer()
    if (photo.length > 65536) throw new Error("Bild zu groß")
    return `data:image/webp;base64,${photo.toString("base64")}`
  } catch { throw new Error("Dieses Foto konnte nicht verarbeitet werden. Bitte ein anderes Foto auswählen.") }
}
