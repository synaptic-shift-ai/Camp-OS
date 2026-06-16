export type CsvColumn<T> = {
  key: string
  header: string
  accessor?: (row: T) => unknown
}

function toCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return ""
  }

  const stringValue = String(value)

  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }

  return stringValue
}

export function buildExportFilename(prefix: string): string {
  const now = new Date()

  const pad = (value: number) => String(value).padStart(2, "0")

  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`

  return `${prefix.toUpperCase()}_${date}_${time}.csv`
}

export type CsvSection<T> = {
  title: string
  rows: T[]
  columns: Array<CsvColumn<T>>
}

function formatCsvRows<T>(rows: T[], columns: Array<CsvColumn<T>>): string[] {
  const header = columns.map((column) => column.header).join(",")

  const lines = rows.map((row) =>
    columns
      .map((column) => {
        const value = column.accessor ? column.accessor(row) : (row as Record<string, unknown>)[column.key]
        return toCsvCell(value)
      })
      .join(",")
  )

  return [header, ...lines]
}

function buildCsvSection<T>(section: CsvSection<T>): string {
  if (!section.columns.length) {
    return ""
  }

  return [toCsvCell(section.title), ...formatCsvRows(section.rows, section.columns)].join("\n")
}

function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)

  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.style.display = "none"

  document.body.appendChild(link)
  link.click()

  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function exportToCsv<T>(filename: string, rows: T[], columns: Array<CsvColumn<T>>): void {
  if (!rows.length || !columns.length) {
    return
  }

  downloadCsv(filename, formatCsvRows(rows, columns).join("\n"))
}

export function exportMultiSectionCsv(filename: string, sections: CsvSection<unknown>[]): void {
  const csv = sections
    .map((section) => buildCsvSection(section))
    .filter((section) => section.length > 0)
    .join("\n\n")

  if (!csv) {
    return
  }

  downloadCsv(filename, csv)
}

