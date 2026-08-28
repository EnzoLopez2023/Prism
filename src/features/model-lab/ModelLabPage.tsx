import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined'
import { Alert, Box, Button, Chip, LinearProgress, Paper, TextField, Typography } from '@mui/material'
import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { PageHeading } from '../../components/PageHeading'
import { apiFetch } from '../../services/api'

const models = [
  ['codex', 'GPT-5.3 Codex', 'Azure AI Foundry'],
  ['gpt54', 'GPT-5.4', 'Azure AI Foundry'],
  ['haiku', 'Claude Haiku 4.5', 'Anthropic'],
  ['gpt54pro', 'GPT-5.4 Pro', 'Azure AI Foundry'],
  ['sonnet', 'Claude Sonnet 4.6', 'Anthropic'],
  ['lmstudio', 'Local model', 'LM Studio'],
] as const
type Result = { content?: string; error?: string; durationMs?: number; model?: string }

export default function ModelLabPage() {
  const [prompt, setPrompt] = useState('')
  const [results, setResults] = useState<Record<string, Result>>({})
  const [states, setStates] = useState<Record<string, string>>({})
  const [analysis, setAnalysis] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { apiFetch<{ text: { id: string; state: string }[] }>('/api/providers').then(data => setStates(Object.fromEntries(data.text.map(item => [item.id, item.state])))).catch(() => {}) }, [])

  const run = async () => {
    if (!prompt.trim()) return
    setBusy(true); setResults({}); setAnalysis(null)
    const entries = await Promise.all(models.map(async ([id]) => {
      try { return [id, await apiFetch<Result>(`/api/ai-test/${id}`, { method: 'POST', body: JSON.stringify({ prompt }) })] as const }
      catch (error) { return [id, { error: error instanceof Error ? error.message : 'Request failed' }] as const }
    }))
    const next: Record<string, Result> = Object.fromEntries(entries)
    setResults(next)
    const successful = Object.fromEntries(Object.entries(next).filter(([, value]) => value.content))
    if (Object.keys(successful).length) {
      try { setAnalysis(await apiFetch<Result>('/api/ai-test/analyze', { method: 'POST', body: JSON.stringify({ prompt, responses: successful }) })) }
      catch (error) { setAnalysis({ error: error instanceof Error ? error.message : 'Analysis unavailable' }) }
    }
    setBusy(false)
  }

  return (
    <Box className="page-shell">
      <PageHeading title="Model lab" description="Six providers receive the same bounded prompt so differences stay visible." actions={<Button variant="contained" startIcon={<AutoAwesomeOutlined />} onClick={run} disabled={!prompt.trim() || busy}>Run comparison</Button>} />
      <Paper className="workspace-panel lab-prompt">
        <TextField fullWidth multiline minRows={4} label="Shared prompt" value={prompt} onChange={event => setPrompt(event.target.value)} inputProps={{ maxLength: 32000 }} />
        {busy && <LinearProgress />}
      </Paper>
      {analysis && <Paper className="analysis-strip"><Typography variant="h2">Cross-model analysis</Typography>{analysis.error ? <Alert severity="warning">{analysis.error}</Alert> : <Box className="markdown-body"><ReactMarkdown>{analysis.content}</ReactMarkdown></Box>}</Paper>}
      <Box className="model-grid">
        {models.map(([id, label, provider]) => {
          const result = results[id]
          return (
            <Paper key={id} className="model-result" variant="outlined">
              <Box className="model-result-head"><Box><Typography fontWeight={720}>{label}</Typography><Typography variant="caption" color="text.secondary">{provider}</Typography></Box><Chip size="small" label={states[id] || 'checking'} color={states[id] === 'available' ? 'success' : 'default'} /></Box>
              {!result && <Box className="empty-stage"><Box><strong>Ready for the shared prompt.</strong>Results stay separated for direct comparison.</Box></Box>}
              {result?.error && <Alert severity="error">{result.error}</Alert>}
              {result?.content && <><Box className="markdown-body"><ReactMarkdown>{result.content}</ReactMarkdown></Box><Typography variant="caption" color="text.secondary">{result.durationMs} ms · {result.model}</Typography></>}
            </Paper>
          )
        })}
      </Box>
    </Box>
  )
}
