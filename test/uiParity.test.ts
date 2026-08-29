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
  assert.match(prompts, /<DialogTitle>Delete prompt\?<\/DialogTitle>/)
  assert.match(prompts, /onClick=\{\(\) => setPendingDelete\(prompt\)\}/)
})

test('lab and chat keyboard and prompt-picker paths remain present', () => {
  const root = process.cwd()
  const modelLab = fs.readFileSync(path.join(root, 'src/features/model-lab/ModelLabPage.tsx'), 'utf8')
  const imageLab = fs.readFileSync(path.join(root, 'src/features/image-lab/ImageLabPage.tsx'), 'utf8')
  const chat = fs.readFileSync(path.join(root, 'src/features/chat/ChatPage.tsx'), 'utf8')
  assert.match(modelLab, /event\.ctrlKey \|\| event\.metaKey/)
  assert.match(modelLab, /MODEL_LAB_SAMPLE_PROMPTS/)
  assert.match(imageLab, /event\.ctrlKey \|\| event\.metaKey/)
  assert.match(imageLab, /IMAGE_OUTPUT_PRESETS/)
  assert.match(imageLab, /cleanSourceImage/)
  assert.match(chat, /Search prompts…/)
  assert.match(chat, /setQuestion\(prompt\.body\)/)
})
