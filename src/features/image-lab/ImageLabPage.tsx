import DownloadOutlined from '@mui/icons-material/DownloadOutlined'
import ImageOutlined from '@mui/icons-material/ImageOutlined'
import { Alert, Box, Button, FormControl, InputLabel, LinearProgress, MenuItem, Paper, Select, TextField, Typography } from '@mui/material'
import { useState } from 'react'
import { PageHeading } from '../../components/PageHeading'
import { apiFetch } from '../../services/api'

const models = [['gpt-image-1', 'GPT Image 1'], ['gpt-image-2', 'GPT Image 2'], ['mai-image-2e', 'MAI Image 2e']] as const
type ImageResult = { image?: string; model?: string; durationMs?: number; error?: string }

export default function ImageLabPage() {
  const [prompt, setPrompt] = useState('')
  const [orientation, setOrientation] = useState('square')
  const [sourceImage, setSourceImage] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, ImageResult>>({})
  const [busy, setBusy] = useState(false)
  const size = orientation === 'portrait' ? '1024x1536' : orientation === 'landscape' ? '1536x1024' : '1024x1024'

  const run = async () => {
    setBusy(true); setResults({})
    const targets = sourceImage ? models.filter(([id]) => id !== 'mai-image-2e') : models
    const values = await Promise.all(targets.map(async ([id]) => {
      try { return [id, await apiFetch<ImageResult>(`/api/ai-image-test/${id}`, { method: 'POST', body: JSON.stringify({ prompt, size, sourceImage }) })] as const }
      catch (error) { return [id, { error: error instanceof Error ? error.message : 'Generation failed' }] as const }
    }))
    setResults(Object.fromEntries(values)); setBusy(false)
  }
  const upload = (file?: File) => {
    if (!file || !file.type.startsWith('image/') || file.size > 15_000_000) return
    const reader = new FileReader(); reader.onload = () => setSourceImage(String(reader.result)); reader.readAsDataURL(file)
  }
  return (
    <Box className="page-shell">
      <PageHeading title="Image lab" description="Compare image providers at one native orientation. Source images stay bounded to this request." actions={<Button variant="contained" startIcon={<ImageOutlined />} onClick={run} disabled={!prompt.trim() || busy}>Generate</Button>} />
      <Paper className="workspace-panel image-controls">
        <TextField fullWidth multiline minRows={3} label="Image prompt" value={prompt} onChange={event => setPrompt(event.target.value)} inputProps={{ maxLength: 32000 }} />
        <Box className="control-row">
          <FormControl size="small"><InputLabel>Orientation</InputLabel><Select value={orientation} label="Orientation" onChange={event => setOrientation(event.target.value)}><MenuItem value="portrait">Portrait</MenuItem><MenuItem value="square">Square</MenuItem><MenuItem value="landscape">Landscape</MenuItem></Select></FormControl>
          <Button component="label" variant="outlined">{sourceImage ? 'Replace source image' : 'Add source image'}<input hidden type="file" accept="image/*" onChange={event => upload(event.target.files?.[0])} /></Button>
          {sourceImage && <Button onClick={() => setSourceImage(null)}>Remove source</Button>}
        </Box>
        {busy && <LinearProgress />}
      </Paper>
      <Box className="image-grid">
        {models.map(([id, label]) => {
          const result = results[id]
          const skipped = sourceImage && id === 'mai-image-2e'
          return (
            <Paper key={id} className="image-result" variant="outlined">
              <Typography fontWeight={720}>{label}</Typography>
              {skipped ? <Alert severity="info">Image editing is unavailable for this provider.</Alert> : result?.error ? <Alert severity="error">{result.error}</Alert> : result?.image ? <>
                <img src={result.image} alt={`${label} generation`} />
                <Button component="a" href={result.image} download={`${id}.png`} startIcon={<DownloadOutlined />}>Download</Button>
                <Typography variant="caption" color="text.secondary">{result.durationMs} ms · {result.model}</Typography>
              </> : <Box className="empty-stage"><Box><strong>No generation yet.</strong>The provider result will appear here.</Box></Box>}
            </Paper>
          )
        })}
      </Box>
    </Box>
  )
}
