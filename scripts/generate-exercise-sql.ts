import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

const CSV_PATH = path.join(
  __dirname,
  '../docs/exercise-library-csv/TemplateEsercizicompleto(Sheet1).csv'
)
const OUTPUT_PATH = path.join(__dirname, '../docs/exercise-library-csv/exercises-seed.sql')

// --- CSV parser (RFC 4180, handles double-quote escaping) ---
function parseCSV(raw: string): string[][] {
  // Strip BOM
  const content = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  while (i < content.length) {
    const ch = content[i]

    if (inQuotes) {
      if (ch === '"' && content[i + 1] === '"') {
        field += '"'
        i += 2
      } else if (ch === '"') {
        inQuotes = false
        i++
      } else {
        field += ch
        i++
      }
    } else {
      if (ch === '"') {
        inQuotes = true
        i++
      } else if (ch === ',') {
        row.push(field.trim())
        field = ''
        i++
      } else if (ch === '\r') {
        i++
      } else if (ch === '\n') {
        row.push(field.trim())
        rows.push(row)
        row = []
        field = ''
        i++
      } else {
        field += ch
        i++
      }
    }
  }

  // Flush last row
  if (row.length > 0 || field.trim()) {
    row.push(field.trim())
    if (row.some((f) => f)) rows.push(row)
  }

  return rows
}

function sql(s: string): string {
  return s.replace(/'/g, "''")
}

function buildNotesArray(raw: string): string {
  const variants = raw
    .split(';')
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
  if (variants.length === 0) return "ARRAY[]::text[]"
  return `ARRAY[${variants.map((v) => `'${sql(v)}'`).join(', ')}]::text[]`
}

// --- Main ---
const raw = fs.readFileSync(CSV_PATH, 'utf-8')
const rows = parseCSV(raw)

const header = rows[0]
// Muscle group names start at index 5, stop at first empty header
const muscleGroupNames: string[] = []
for (let i = 5; i < header.length; i++) {
  const h = header[i].trim()
  if (h) muscleGroupNames.push(h)
}

const lines: string[] = []

lines.push('-- ============================================================')
lines.push('-- Exercise library seed — auto-generated from CSV')
lines.push('-- Generated: ' + new Date().toISOString())
lines.push('-- ============================================================')
lines.push('')
lines.push('-- Requires at least one admin user in the users table.')
lines.push('-- Movement patterns and muscle groups must already exist.')
lines.push('')
lines.push('DO $$')
lines.push('DECLARE')
lines.push('  v_creator_id TEXT;')
lines.push('BEGIN')
lines.push('')
lines.push("  SELECT id INTO v_creator_id FROM users WHERE role = 'admin' LIMIT 1;")
lines.push('')
lines.push('  IF v_creator_id IS NULL THEN')
lines.push("    RAISE EXCEPTION 'No admin user found — seed exercises first requires an admin user.';")
lines.push('  END IF;')
lines.push('')

let count = 0

for (let r = 1; r < rows.length; r++) {
  const row = rows[r]
  const name = row[0]?.trim()
  if (!name) continue

  const variantsRaw = row[1] ?? ''
  const youtubeUrl = row[2]?.trim() ?? ''
  const typeRaw = row[3]?.trim().toUpperCase()
  const movementPatternName = row[4]?.trim() ?? ''

  const exerciseType = typeRaw === 'F' ? 'fundamental' : 'accessory'
  const notesSQL = buildNotesArray(variantsRaw)
  const youtubeSQL = youtubeUrl ? `'${sql(youtubeUrl)}'` : 'NULL'

  const exerciseId = crypto.randomUUID()

  lines.push(`  -- [${count + 1}] ${name}`)
  lines.push(`  INSERT INTO exercises ("id", "name", "notes", "youtubeUrl", "type", "movementPatternId", "createdBy", "createdAt")`)
  lines.push(`  VALUES (`)
  lines.push(`    '${exerciseId}',`)
  lines.push(`    '${sql(name)}',`)
  lines.push(`    ${notesSQL},`)
  lines.push(`    ${youtubeSQL},`)
  lines.push(`    '${exerciseType}'::"ExerciseType",`)
  lines.push(`    (SELECT id FROM movement_patterns WHERE LOWER(name) = LOWER('${sql(movementPatternName)}') LIMIT 1),`)
  lines.push(`    v_creator_id,`)
  lines.push(`    NOW()`)
  lines.push(`  )`)
  lines.push(`  ON CONFLICT DO NOTHING;`)
  lines.push('')

  // Muscle group coefficients
  for (let m = 0; m < muscleGroupNames.length; m++) {
    const colIndex = 5 + m
    const coefRaw = row[colIndex]?.trim() ?? ''
    if (!coefRaw) continue
    const coef = parseFloat(coefRaw)
    if (isNaN(coef) || coef === 0) continue

    const mgName = muscleGroupNames[m]
    lines.push(`  INSERT INTO exercise_muscle_groups ("id", "exerciseId", "muscleGroupId", "coefficient")`)
    lines.push(`  VALUES (`)
    lines.push(`    '${crypto.randomUUID()}',`)
    lines.push(`    '${exerciseId}',`)
    lines.push(`    (SELECT id FROM muscle_groups WHERE LOWER(name) = LOWER('${sql(mgName)}') LIMIT 1),`)
    lines.push(`    ${coef}`)
    lines.push(`  )`)
    lines.push(`  ON CONFLICT DO NOTHING;`)
    lines.push('')
  }

  count++
}

lines.push('END $$;')
lines.push('')
lines.push(`-- Total exercises: ${count}`)

const output = lines.join('\n')
fs.writeFileSync(OUTPUT_PATH, output, 'utf-8')
console.log(`Generated ${count} exercises → ${OUTPUT_PATH}`)
