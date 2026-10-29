import { ESLint } from "eslint"
import { readFileSync } from "node:fs"
import { relative } from "node:path"

// Existing UI debt is counted, not disabled. New rules/files have a zero budget.
const baseline = JSON.parse(readFileSync(new URL("../eslint-baseline.json", import.meta.url), "utf8"))
const eslint = new ESLint()
const results = await eslint.lintFiles(["src", "tests", "scripts", "vitest.config.mts"])
const counts = {}
let errors = 0, warnings = 0
for (const file of results) {
  const path = relative(process.cwd(), file.filePath).replaceAll("\\", "/")
  for (const message of file.messages) {
    const key = `${path}|${message.ruleId ?? "parse-error"}|${message.severity}`
    counts[key] = (counts[key] || 0) + 1
    if (message.severity === 2) errors++; else warnings++
  }
}
const regressions = Object.entries(counts).filter(([key, count]) => count > (baseline[key] || 0))
if (regressions.length) {
  console.error("Neue Lintbefunde gegenüber dem dokumentierten Altbestand:")
  for (const [key, count] of regressions) console.error(`${key}: ${count} (zuvor ${baseline[key] || 0})`)
  process.exitCode = 1
} else {
  console.log(`Keine neuen Lintbefunde. Bekannter Altbestand: ${errors} Fehler, ${warnings} Warnungen. Vollausgabe: npm run lint:all.`)
}
