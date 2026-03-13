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

export function exportToCsv<T>(filename: string, rows: T[], columns: Array<CsvColumn<T>>): void {
  if (!rows.length || !columns.length) {
    return
  }

  const header = columns.map((column) => column.header).join(",")

  const lines = rows.map((row) =>
    columns
      .map((column) => {
        const value = column.accessor ? column.accessor(row) : (row as any)[column.key]
        return toCsvCell(value)
      })
      .join(",")
  )

  const csv = [header, ...lines].join("\n")

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

