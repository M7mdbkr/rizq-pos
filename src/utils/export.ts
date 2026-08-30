import * as XLSX from 'xlsx'

/** Export multiple named sheets to a single .xlsx workbook. */
export function exportWorkbook(
  filename: string,
  sheets: { name: string; rows: Record<string, unknown>[] }[],
): void {
  const wb = XLSX.utils.book_new()
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.rows.length ? s.rows : [{}])
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31))
  }
  XLSX.writeFile(wb, filename)
}
