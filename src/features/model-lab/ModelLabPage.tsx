import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined'
import { Alert, Box, Button, Chip, LinearProgress, Paper, Stack, TextField, Tooltip, Typography } from '@mui/material'
import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { PageHeading } from '../../components/PageHeading'
import { SamplePromptPicker } from '../../components/SamplePromptPicker'
import { apiFetch } from '../../services/api'
import { MODEL_LAB_MODELS, MODEL_LAB_SAMPLE_PROMPTS } from './modelLabConfig'

type Result = {
  content?: string
  error?: string
  durationMs?: number
  model?: string
  usage?: { inputTokens?: number; outputTokens?: number }
}

export default function ModelLabPage() {
  const [prompt, setPrompt] = useState('')
  const [results, setResults] = useState<Record<string, Result>>({})
  const [states, setStates] = useState<Record<string, string>>({})
  const [analysis, setAnalysis] = useState<Result | null>(null)
  const [analysisBusy, setAnalysisBusy] = useState(false)
  const [busy, setBusy] = useState(false)
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const generation = useRef(0)

  useEffect(() => {
    const controller = new AbortController()
    apiFetch<{ text: { id: string; state: string }[] }>('/api/providers', { signal: controller.signal })
      .then(data => setStates(Object.fromEntries(data.text.map(item => [item.id, item.state]))))
      .catch(error => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setStates(Object.fromEntries(MODEL_LAB_MODELS.map(model => [model.id, 'status unknown'])))
        }
      })
    return () => controller.abort()
  }, [])

  const run = async () => {
    const value = prompt.trim()
    if (!value || busy) return
    const currentGeneration = ++generation.current
    setBusy(true)
    setResults({})
    setAnalysis(null)
    setAnalysisBusy(false)
    const entries = await Promise.all(MODEL_LAB_MODELS.map(async model => {
      try { return [model.id, await apiFetch<Result>(`/api/ai-test/${model.id}`, { method: 'POST', body: JSON.stringify({ prompt: value }) })] as const }
      catch (error) { return [model.id, { error: error instanceof Error ? error.message : 'Request failed' }] as const }
    }))
    if (currentGeneration !== generation.current) return
    const next: Record<string, Result> = Object.fromEntries(entries)
    setResults(next)
    setBusy(false)
    const successful: Record<string, { content: string }> = {}
    for (const model of MODEL_LAB_MODELS) {
      const content = next[model.id]?.content
      if (content) successful[model.label] = { content }
    }
    if (!Object.keys(successful).length) return
    setAnalysisBusy(true)
    try {
      const judged = await apiFetch<Result>('/api/ai-test/analyze', { method: 'POST', body: JSON.stringify({ prompt: value, responses: successful }) })
      if (currentGeneration === generation.current) setAnalysis(judged)
    } catch (error) {
      if (currentGeneration === generation.current) setAnalysis({ error: error instanceof Error ? error.message : 'Analysis unavailable' })
    } finally {
      if (currentGeneration === generation.current) setAnalysisBusy(false)
    }
  }

  return (
    <Box className="page-shell">
      <PageHeading title="Compare models side-by-side" description="Six models receive the same prompt so their strengths, tradeoffs, and errors stay visible." />
      <Paper className="workspace-panel lab-prompt">
        <TextField
          fullWidth
          multiline
          minRows={4}
          label="Shared prompt"
          placeholder="Enter a prompt… (Ctrl+Enter to send)"
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
        <Box className="lab-action-row">
          <SamplePromptPicker
            prompts={MODEL_LAB_SAMPLE_PROMPTS}
            labelLength={38}
            onSelect={value => {
              setPrompt(value)
              requestAnimationFrame(() => promptRef.current?.focus())
            }}
          />
          <Button variant="contained" startIcon={<AutoAwesomeOutlined />} onClick={run} disabled={!prompt.trim() || busy}>
            {busy ? 'Running…' : 'Compare'}
          </Button>
        </Box>
        {busy && <LinearProgress />}
      </Paper>
      {(analysisBusy || analysis) && (
        <Paper className="analysis-strip" aria-live="polite">
          <Typography variant="h2">AI Analysis</Typography>
          <Typography variant="caption" color="text.secondary">Claude Opus 4.8 · cross-model judge (6 models)</Typography>
          {analysisBusy
            ? <Typography color="text.secondary">Opus 4.8 is analyzing the six responses…</Typography>
            : analysis?.error
              ? <Alert severity="warning">{analysis.error}</Alert>
              : <Box className="markdown-body"><ReactMarkdown>{analysis?.content}</ReactMarkdown></Box>}
        </Paper>
      )}
      <Box className="model-grid">
        {MODEL_LAB_MODELS.map(model => {
          const result = results[model.id]
          const state = states[model.id] || 'checking'
          return (
            <Paper key={model.id} className="model-result" variant="outlined">
              <Box className="model-result-head">
                <Box>
                  <Typography fontWeight={720}>{model.label}</Typography>
                  <Typography variant="caption" color="text.secondary">{model.provider}</Typography>
                </Box>
                <Chip size="small" label={state} color={state === 'available' ? 'success' : 'default'} variant={state === 'available' ? 'filled' : 'outlined'} />
              </Box>
              {!result && (
                <Box className="empty-stage lab-result-state">
                  <Box>
                    <strong>{busy ? 'Waiting for response…' : 'Response will appear here'}</strong>
                    {!busy && 'Run one shared prompt to compare this model.'}
                  </Box>
                </Box>
              )}
              {result?.error && <Alert severity="error" className="lab-error">{result.error}</Alert>}
              {result?.content && (
                <>
                  <Typography component="pre" className="model-response">{result.content}</Typography>
                  <Stack direction="row" gap={1.5} flexWrap="wrap" className="result-meta">
                    {typeof result.durationMs === 'number' && <span>{(result.durationMs / 1000).toFixed(1)} sec</span>}
                    {result.usage?.outputTokens && (
                      <Tooltip title={`${result.usage.inputTokens || 0} in / ${result.usage.outputTokens} out`}>
                        <span>{result.usage.outputTokens} tok</span>
                      </Tooltip>
                    )}
                    {result.model && <span>{result.model}</span>}
                  </Stack>
                </>
              )}
            </Paper>
          )
        })}
      </Box>
    </Box>
  )
}
