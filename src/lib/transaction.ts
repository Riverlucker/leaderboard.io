import "server-only"
import { Prisma } from "@prisma/client"
import prisma from "./prisma"

/** Retry only serialization conflicts; never retry validation or permission errors. */
export async function atomic<T>(work: (db: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 })
    } catch (error) {
      if (attempt >= 2 || !(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034") throw error
    }
  }
}
