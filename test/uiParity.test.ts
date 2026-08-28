import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import * as XLSX from 'xlsx'
import { convertWorkbook } from '../src/features/converter/convertWorkbook.js'

test('converter preserves SheetJS default omission semantics for blank cells', () => {
  const sheet = XLSX.utils.aoa_to_sheet([['name', 'blank'], ['Prism']])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1')
  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  assert.deepEqual(convertWorkbook(bytes), { Sheet1: [{ name: 'Prism' }] })
})

test('destructive conversation and prompt controls require explicit confirmation dialogs', () => {
  const root = process.cwd()
  const chat = fs.readFileSync(path.join(root, 'src/features/chat/ChatPage.tsx'), 'utf8')
  const prompts = fs.readFileSync(path.join(root, 'src/features/prompts/PromptLibraryPage.tsx'), 'utf8')
  assert.match(chat, /Delete this conversation\?/)
  assert.match(chat, /onClick=\{\(\) => setConfirmDelete\(true\)\}/)
  assert.match(prompts, /Delete “\{pendingDelete\?\.title\}”\?/)
  assert.match(prompts, /onClick=\{\(\) => setPendingDelete\(prompt\)\}/)
})
