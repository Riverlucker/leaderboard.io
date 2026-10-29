import { expect,it,vi } from "vitest"
import sharp from "sharp"
vi.mock("server-only",()=>({}))
import { prepareProfileImage } from "@/lib/profile-image"

it("macht Fotos optional und weist SVG oder ungültige Dateien ab",async()=>{
  expect(await prepareProfileImage(undefined)).toBeUndefined()
  await expect(prepareProfileImage("data:image/svg+xml;base64,PHN2Zz4=" )).rejects.toThrow()
  await expect(prepareProfileImage("data:image/jpeg;base64,YmFk")).rejects.toThrow()
})
it("kodiert hochgeladene Fotos als kleine WebP-Avatare neu",async()=>{
  const original=await sharp({create:{width:800,height:600,channels:3,background:"#ffffff"}}).png().toBuffer()
  const image=await prepareProfileImage(`data:image/png;base64,${original.toString("base64")}`)
  const metadata=await sharp(Buffer.from(image!.split(",")[1],"base64")).metadata()
  expect(metadata.format).toBe("webp")
  expect(metadata.width).toBe(256);expect(metadata.height).toBe(256)
})
