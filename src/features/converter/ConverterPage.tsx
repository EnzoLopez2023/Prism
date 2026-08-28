import DownloadOutlined from '@mui/icons-material/DownloadOutlined'
import UploadFileOutlined from '@mui/icons-material/UploadFileOutlined'
import { Alert, Box, Button, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import { useState } from 'react'
import { PageHeading } from '../../components/PageHeading'
import { convertWorkbook, type Conversion } from './convertWorkbook'

export default function ConverterPage() {
  const [data, setData] = useState<Conversion | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')

  const convert = async (file?: File) => {
    if (!file) return
    if (!/\.(xlsx|xls)$/i.test(file.name) || file.size > 25_000_000) return setError('Choose an .xlsx or .xls file smaller than 25 MB')
    try {
      const result = convertWorkbook(await file.arrayBuffer())
      setData(result); setFileName(file.name.replace(/\.(xlsx|xls)$/i, '')); setError('')
    } catch { setError('This spreadsheet could not be read. Check that the file is a valid Excel workbook.'); setData(null) }
  }
  const download = () => {
    if (!data) return
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = `${fileName || 'converted'}.json`; link.click(); URL.revokeObjectURL(url)
  }
  const firstSheet = data ? Object.entries(data)[0] : null
  const columns = firstSheet?.[1][0] ? Object.keys(firstSheet[1][0]) : []

  return (
    <Box className="page-shell">
      <PageHeading title="Excel to JSON" description="Convert workbooks locally in your browser. The file is never sent to Prism." actions={data && <Button variant="contained" startIcon={<DownloadOutlined />} onClick={download}>Download JSON</Button>} />
      <Paper className="workspace-panel converter-drop" component="label">
        <UploadFileOutlined sx={{ fontSize: 44 }} color="primary" />
        <Typography variant="h2">Choose an Excel workbook</Typography>
        <Typography color="text.secondary">Every sheet becomes a key; each row becomes an object.</Typography>
        <Button component="span" variant="outlined">Browse files</Button>
        <input hidden type="file" accept=".xlsx,.xls" onChange={event => convert(event.target.files?.[0])} />
      </Paper>
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      {data && <Paper className="workspace-panel converter-preview">
        <Box className="preview-head"><Box><Typography variant="h2">{fileName}.json</Typography><Typography color="text.secondary">{Object.keys(data).length} sheet{Object.keys(data).length === 1 ? '' : 's'} · {Object.values(data).reduce((sum, rows) => sum + rows.length, 0)} rows</Typography></Box></Box>
        {firstSheet && <><Typography fontWeight={700} sx={{ p: 2 }}>{firstSheet[0]} · first 8 rows</Typography><Box sx={{ overflowX: 'auto' }}><Table size="small"><TableHead><TableRow>{columns.map(column => <TableCell key={column}>{column}</TableCell>)}</TableRow></TableHead><TableBody>{firstSheet[1].slice(0, 8).map((row, index) => <TableRow key={index}>{columns.map(column => <TableCell key={column}>{String(row[column] ?? '')}</TableCell>)}</TableRow>)}</TableBody></Table></Box></>}
      </Paper>}
    </Box>
  )
}
