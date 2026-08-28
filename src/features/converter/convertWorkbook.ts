import * as XLSX from 'xlsx'

export type Cell = string | number | boolean | null
export type Sheet = Record<string, Cell>[]
export type Conversion = Record<string, Sheet>

export function convertWorkbook(bytes: ArrayBuffer): Conversion {
  const workbook = XLSX.read(bytes, { type: 'array' })
  return Object.fromEntries(workbook.SheetNames.map(name => [
    name,
    XLSX.utils.sheet_to_json(workbook.Sheets[name]!) as Sheet,
  ]))
}
