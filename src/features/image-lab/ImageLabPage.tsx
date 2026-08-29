import DownloadOutlined from '@mui/icons-material/DownloadOutlined'
import ImageOutlined from '@mui/icons-material/ImageOutlined'
import {
  Alert, Box, Button, FormControl, InputLabel, LinearProgress, MenuItem, Paper, Select, Stack, TextField, ToggleButton,
  ToggleButtonGroup, Typography,
} from '@mui/material'
import { useRef, useState } from 'react'
import { PageHeading } from '../../components/PageHeading'
import { SamplePromptPicker } from '../../components/SamplePromptPicker'
import { apiFetch } from '../../services/api'
import {
  buildImagePrompt, IMAGE_LAB_MODELS, IMAGE_LAB_SAMPLE_PROMPTS, IMAGE_OUTPUT_PRESETS, imageOutputPreset, imageTargetIds,
  type ImageOrientation, nativeImageSize,
} from './imageLabConfig'

type ImageResult = { image?: string; model?: string; durationMs?: number; error?: string; mode?: 'generate' | 'edit' }

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('The source image could not be read'))
    reader.onerror = () => reject(new Error('The source image could not be read'))
    reader.readAsDataURL(file)
  })
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('The source image could not be decoded'))
    image.src = source
  })
}

async function cleanSourceImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file')
  if (file.size > 15_000_000) throw new Error('Choose an image smaller than 15 MB')
  const image = await loadImage(await readFile(file))
  const scale = Math.min(1, 1536 / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser cannot prepare the source image')
  context.drawImage(image, 0, 0, width, height)
  return canvas.toDataURL('image/png')
}

function saveDownload(href: string, filename: string) {
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The resized image could not be encoded')), 'image/png'))
}

export default function ImageLabPage() {
  const [prompt, setPrompt] = useState('')
  const [orientation, setOrientation] = useState<ImageOrientation>('square')
  const [presetId, setPresetId] = useState('native')
  const [sourceImage, setSourceImage] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, ImageResult>>({})
  const [busy, setBusy] = useState(false)
  const [sourceBusy, setSourceBusy] = useState(false)
  const [downloadBusy, setDownloadBusy] = useState('')
  const [error, setError] = useState('')
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const sourceGeneration = useRef(0)
  const size = nativeImageSize(orientation)
  const preset = imageOutputPreset(presetId)

  const run = async () => {
    const value = prompt.trim()
    if (!value || busy) return
    setError('')
    setBusy(true)
    setResults({})
    const finalPrompt = buildImagePrompt(value, orientation, presetId)
    const values = await Promise.all(imageTargetIds(Boolean(sourceImage)).map(async id => {
      try { return [id, await apiFetch<ImageResult>(`/api/ai-image-test/${id}`, { method: 'POST', body: JSON.stringify({ prompt: finalPrompt, size, sourceImage }) })] as const }
      catch (requestError) { return [id, { error: requestError instanceof Error ? requestError.message : 'Generation failed' }] as const }
    }))
    setResults(Object.fromEntries(values))
    setBusy(false)
  }

  const upload = async (file?: File) => {
    if (!file) return
    const currentGeneration = ++sourceGeneration.current
    setError('')
    setSourceBusy(true)
    try {
      const cleaned = await cleanSourceImage(file)
      if (currentGeneration === sourceGeneration.current) setSourceImage(cleaned)
    } catch (uploadError) {
      if (currentGeneration === sourceGeneration.current) setError(uploadError instanceof Error ? uploadError.message : 'The source image could not be prepared')
    } finally {
      if (currentGeneration === sourceGeneration.current) setSourceBusy(false)
    }
  }

  const removeSource = () => {
    sourceGeneration.current += 1
    setSourceBusy(false)
    setSourceImage(null)
  }

  const download = async (modelId: string, imageSource: string) => {
    const model = IMAGE_LAB_MODELS.find(item => item.id === modelId)
    if (!model) return
    setError('')
    setDownloadBusy(modelId)
    try {
      if (preset.id === 'native' || !preset.width || !preset.height) {
        saveDownload(imageSource, `${model.label}.png`)
        return
      }
      const image = await loadImage(imageSource)
      const canvas = document.createElement('canvas')
      canvas.width = preset.width
      canvas.height = preset.height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('This browser cannot resize the image')
      const scale = Math.max(preset.width / image.naturalWidth, preset.height / image.naturalHeight)
      const width = image.naturalWidth * scale
      const height = image.naturalHeight * scale
      context.drawImage(image, (preset.width - width) / 2, (preset.height - height) / 2, width, height)
      const url = URL.createObjectURL(await canvasBlob(canvas))
      saveDownload(url, `${model.label}-${preset.width}x${preset.height}.png`)
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'The image could not be downloaded')
    } finally {
      setDownloadBusy('')
    }
  }

  return (
    <Box className="page-shell">
      <PageHeading title="Compare image models side-by-side" description="GPT-Image-1, GPT-Image-2, and MAI-Image-2e receive the same prompt. Add a source image for GPT image-to-image." />
      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
      <Paper className="workspace-panel image-controls">
        <TextField
          fullWidth
          multiline
          minRows={3}
          label="Image prompt"
          placeholder="Describe the image to generate… (Ctrl+Enter to send)"
          value={prompt}
          onChange={event => setPrompt(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
              event.preventDefault()
              void run()
            }
          }}
          inputRef={promptRef}
          inputProps={{ maxLength: 32000 }}
        />
        <SamplePromptPicker
          prompts={IMAGE_LAB_SAMPLE_PROMPTS}
          labelLength={40}
          onSelect={value => {
            setPrompt(value)
            requestAnimationFrame(() => promptRef.current?.focus())
          }}
        />
        <Box className="image-option-grid">
          <Box>
            <Typography variant="body2" color="text.secondary" fontWeight={700} sx={{ mb: 0.75 }}>Orientation</Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={orientation}
              onChange={(_event, value: ImageOrientation | null) => {
                if (!value) return
                setOrientation(value)
                setPresetId('native')
              }}
              aria-label="Image orientation"
            >
              <ToggleButton value="portrait">Portrait</ToggleButton>
              <ToggleButton value="square">Square</ToggleButton>
              <ToggleButton value="landscape">Landscape</ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <FormControl size="small" fullWidth>
            <InputLabel>Output size</InputLabel>
            <Select
              value={presetId}
              label="Output size"
              onChange={event => {
                const next = imageOutputPreset(event.target.value)
                setPresetId(next.id)
                if (next.orientation) setOrientation(next.orientation)
              }}
            >
              {IMAGE_OUTPUT_PRESETS.map(item => (
                <MenuItem key={item.id} value={item.id}>
                  {item.id === 'native' ? item.label : `${item.label} — ${item.width}×${item.height}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        <Typography variant="caption" color="text.secondary">Generated at {size}; downloads {preset.id === 'native' ? 'stay model-native.' : `scale and center-crop to ${preset.width}×${preset.height}.`}</Typography>
        <Box className="source-image-row">
          {sourceImage && <img src={sourceImage} alt="Source attachment preview" />}
          <Box className="source-image-copy">
            <Typography fontWeight={700}>{sourceImage ? 'Source image attached' : 'Source image (optional)'}</Typography>
            <Typography variant="caption" color="text.secondary">{sourceImage ? 'Image-to-image · GPT-Image models only' : 'Images are cleaned to PNG and capped at 1536 px before upload.'}</Typography>
          </Box>
          <Stack direction="row" gap={1} flexWrap="wrap">
            <Button component="label" variant="outlined" disabled={sourceBusy}>
              {sourceBusy ? 'Preparing…' : sourceImage ? 'Replace source image' : 'Upload source image'}
              <input hidden type="file" accept="image/*" onChange={event => {
                const file = event.target.files?.[0]
                event.target.value = ''
                void upload(file)
              }} />
            </Button>
            {sourceImage && <Button onClick={removeSource}>Remove</Button>}
          </Stack>
        </Box>
        <Box className="image-generate-row">
          <Typography variant="caption" color="text.secondary">Press Ctrl/⌘ + Enter from the prompt to generate.</Typography>
          <Button variant="contained" startIcon={<ImageOutlined />} onClick={run} disabled={!prompt.trim() || busy || sourceBusy}>
            {busy ? 'Generating…' : 'Generate'}
          </Button>
        </Box>
        {busy && <LinearProgress />}
      </Paper>
      <Box className="image-grid">
        {IMAGE_LAB_MODELS.map(model => {
          const result = results[model.id]
          const skipped = sourceImage && !model.supportsEditing
          return (
            <Paper key={model.id} className="image-result" variant="outlined">
              <Box>
                <Typography fontWeight={720}>{model.label}</Typography>
                <Typography variant="caption" color="text.secondary">{model.provider}</Typography>
              </Box>
              {skipped
                ? <Alert severity="info">Skipped for image-to-image — MAI generates from text only. Remove the source image to compare all three.</Alert>
                : result?.error
                  ? <Alert severity="error" className="lab-error">{result.error}</Alert>
                  : result?.image
                    ? (
                      <>
                        <a href={result.image} target="_blank" rel="noreferrer" className="image-result-link">
                          <img src={result.image} alt={`${model.label} generation`} />
                        </a>
                        <Button
                          startIcon={<DownloadOutlined />}
                          onClick={() => void download(model.id, result.image!)}
                          disabled={downloadBusy === model.id}
                        >
                          {downloadBusy === model.id ? 'Preparing download…' : preset.id === 'native' ? 'Download native' : `Download ${preset.width}×${preset.height}`}
                        </Button>
                        <Typography variant="caption" color="text.secondary">
                          {typeof result.durationMs === 'number' ? `${(result.durationMs / 1000).toFixed(1)} sec` : ''}
                          {result.mode === 'edit' ? ' · Image-to-image (edit)' : ''}
                          {result.model ? ` · ${result.model}` : ''}
                        </Typography>
                      </>
                    )
                    : (
                      <Box className="empty-stage lab-result-state">
                        <Box>
                          <strong>{busy ? 'Generating image…' : 'Image will appear here'}</strong>
                          {!busy && 'Run one prompt to compare this provider.'}
                        </Box>
                      </Box>
                    )}
            </Paper>
          )
        })}
      </Box>
    </Box>
  )
}
