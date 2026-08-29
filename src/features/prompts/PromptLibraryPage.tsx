import Add from '@mui/icons-material/Add'
import ContentCopy from '@mui/icons-material/ContentCopy'
import DeleteOutline from '@mui/icons-material/DeleteOutline'
import EditOutlined from '@mui/icons-material/EditOutlined'
import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'
import Star from '@mui/icons-material/Star'
import StarBorder from '@mui/icons-material/StarBorder'
import {
  Alert, Autocomplete, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControl,
  FormControlLabel, IconButton, InputLabel, MenuItem, Paper, Select, Skeleton, Snackbar, Stack, TextField, Tooltip, Typography,
} from '@mui/material'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PageHeading } from '../../components/PageHeading'
import { apiFetch } from '../../services/api'

interface Prompt {
  id: number; title: string; body: string; category: string; tags: string[]; model: string | null
  notes: string | null; is_favorite: number; usage_count: number; is_read_only: number
}
interface FormState { title: string; body: string; category: string; tags: string[]; model: string; notes: string; isFavorite: boolean }
interface SnackbarState { message: string; severity: 'success' | 'warning' | 'error' }

const empty: FormState = { title: '', body: '', category: 'General', tags: [], model: '', notes: '', isFavorite: false }
const sortOptions = [
  { id: 'newest', label: 'Newest first', sort: 'created_at', order: 'desc' },
  { id: 'oldest', label: 'Oldest first', sort: 'created_at', order: 'asc' },
  { id: 'title', label: 'Title A–Z', sort: 'title', order: 'asc' },
  { id: 'used', label: 'Most used', sort: 'usage_count', order: 'desc' },
  { id: 'edited', label: 'Recently edited', sort: 'updated_at', order: 'desc' },
] as const

export default function PromptLibraryPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [model, setModel] = useState('')
  const [favorites, setFavorites] = useState(false)
  const [sortMode, setSortMode] = useState('newest')
  const [editing, setEditing] = useState<Prompt | null>(null)
  const [form, setForm] = useState(empty)
  const [tagInput, setTagInput] = useState('')
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [pendingDelete, setPendingDelete] = useState<Prompt | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [snackbar, setSnackbar] = useState<SnackbarState | null>(null)
  const copyTimer = useRef<number | null>(null)

  const load = useCallback(async () => {
    const selectedSort = sortOptions.find(option => option.id === sortMode) || sortOptions[0]
    const params = new URLSearchParams({ sort: selectedSort.sort, order: selectedSort.order })
    if (search) params.set('search', search)
    if (category) params.set('category', category)
    if (model) params.set('model', model)
    if (favorites) params.set('favorite', '1')
    setLoading(true)
    setError('')
    try {
      setPrompts(await apiFetch<Prompt[]>(`/api/prompts?${params}`))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load prompts.')
    } finally {
      setLoading(false)
    }
  }, [search, category, model, favorites, sortMode])

  useEffect(() => {
    const timeout = window.setTimeout(() => { void load() }, 250)
    return () => window.clearTimeout(timeout)
  }, [load])
  useEffect(() => () => {
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current)
  }, [])

  const categories = useMemo(() => [...new Set([...prompts.map(item => item.category), category, form.category].filter(Boolean))].sort(), [prompts, category, form.category])
  const models = useMemo(() => [...new Set([...prompts.map(item => item.model).filter((item): item is string => Boolean(item)), model, form.model].filter(Boolean))].sort(), [prompts, model, form.model])
  const filtered = Boolean(search || category || model || favorites)

  const edit = (prompt?: Prompt) => {
    if (prompt?.is_read_only) return
    setEditing(prompt || null)
    setForm(prompt ? { title: prompt.title, body: prompt.body, category: prompt.category, tags: prompt.tags, model: prompt.model || '', notes: prompt.notes || '', isFavorite: Boolean(prompt.is_favorite) } : empty)
    setTagInput('')
    setOpen(true)
  }

  const save = async () => {
    if (saving || !form.title.trim() || !form.body.trim()) return
    setSaving(true)
    const payload = {
      title: form.title.trim(),
      body: form.body.trim(),
      category: form.category.trim() || 'General',
      tags: form.tags,
      model: form.model.trim() || null,
      notes: form.notes.trim() || null,
      is_favorite: form.isFavorite ? 1 : 0,
    }
    try {
      await apiFetch(editing ? `/api/prompts/${editing.id}` : '/api/prompts', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      })
      setOpen(false)
      setSnackbar({ message: editing ? 'Prompt updated' : 'Prompt created', severity: 'success' })
      await load()
    } catch {
      setSnackbar({ message: 'Save failed', severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const copy = async (prompt: Prompt) => {
    try {
      await navigator.clipboard.writeText(prompt.body)
    } catch {
      setSnackbar({ message: 'Copy failed', severity: 'error' })
      return
    }
    setCopiedId(prompt.id)
    setSnackbar({ message: 'Copied!', severity: 'success' })
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current)
    copyTimer.current = window.setTimeout(() => setCopiedId(null), 2_000)
    try {
      await apiFetch(`/api/prompts/${prompt.id}/use`, { method: 'POST' })
      setPrompts(previous => previous.map(item => item.id === prompt.id ? { ...item, usage_count: item.usage_count + 1 } : item))
    } catch {
      setSnackbar({ message: 'Copied, but the usage count could not be updated', severity: 'warning' })
    }
  }

  const toggleFavorite = async (prompt: Prompt) => {
    if (prompt.is_read_only) return
    const next = prompt.is_favorite ? 0 : 1
    try {
      await apiFetch(`/api/prompts/${prompt.id}`, { method: 'PUT', body: JSON.stringify({ ...prompt, is_favorite: next }) })
      setPrompts(previous => previous.map(item => item.id === prompt.id ? { ...item, is_favorite: next } : item))
    } catch {
      setSnackbar({ message: 'Update failed', severity: 'error' })
    }
  }

  const remove = async (id: number) => {
    try {
      await apiFetch(`/api/prompts/${id}`, { method: 'DELETE' })
      setPrompts(previous => previous.filter(item => item.id !== id))
      setPendingDelete(null)
      setSnackbar({ message: 'Prompt deleted', severity: 'success' })
    } catch {
      setSnackbar({ message: 'Delete failed', severity: 'error' })
    }
  }

  const addTag = () => {
    const value = tagInput.trim()
    if (!value || form.tags.includes(value)) return setTagInput('')
    setForm(previous => ({ ...previous, tags: [...previous.tags, value] }))
    setTagInput('')
  }

  return (
    <Box className="page-shell">
      <PageHeading title="Your AI prompts" description="Store, search, and copy the prompts you rely on for image generation, chat, editing, and more." actions={<Button variant="contained" startIcon={<Add />} onClick={() => edit()}>New Prompt</Button>} />
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      <Box className="prompt-filters">
        <TextField className="prompt-filter-search" size="small" placeholder="Search title, body, notes…" value={search} onChange={event => setSearch(event.target.value)} inputProps={{ 'aria-label': 'Search prompts' }} />
        <FormControl size="small">
          <InputLabel>Category</InputLabel>
          <Select label="Category" value={category} onChange={event => setCategory(event.target.value)}>
            <MenuItem value="">All</MenuItem>
            {categories.map(item => <MenuItem key={item} value={item}>{item}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small">
          <InputLabel>Model</InputLabel>
          <Select label="Model" value={model} onChange={event => setModel(event.target.value)}>
            <MenuItem value="">All</MenuItem>
            {models.map(item => <MenuItem key={item} value={item}>{item}</MenuItem>)}
          </Select>
        </FormControl>
        <Button variant={favorites ? 'contained' : 'outlined'} startIcon={favorites ? <Star /> : <StarBorder />} onClick={() => setFavorites(!favorites)}>Favorites</Button>
        <FormControl size="small">
          <InputLabel>Sort</InputLabel>
          <Select label="Sort" value={sortMode} onChange={event => setSortMode(event.target.value)}>
            {sortOptions.map(option => <MenuItem key={option.id} value={option.id}>{option.label}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>
      {loading ? <Box className="prompt-list prompt-list-loading" aria-label="Loading prompts">{[0, 1, 2].map(item => <Skeleton key={item} variant="rounded" height={160} />)}</Box> :
        !prompts.length ? <Paper className="workspace-panel empty-stage"><Box><strong>{filtered ? 'No prompts match your filters.' : 'No prompts yet — click "New Prompt" to add one.'}</strong>{filtered && 'Adjust or clear a filter to see more.'}</Box></Paper> :
        <Box className="prompt-list">
          {prompts.map(prompt => (
            <Paper key={prompt.id} className="prompt-row" variant="outlined">
              <Box className="prompt-copy">
                <Typography variant="h2">{prompt.title}</Typography>
                <Stack direction="row" gap={0.7} flexWrap="wrap" sx={{ mt: 1 }}>
                  <Chip size="small" label={prompt.category} />
                  {prompt.model && <Chip size="small" variant="outlined" label={prompt.model} />}
                  {prompt.tags.map(tag => <Chip key={tag} size="small" variant="outlined" label={tag} />)}
                  {Boolean(prompt.is_read_only) && <Chip size="small" variant="outlined" label="Imported · read only" />}
                </Stack>
                <Typography className={`prompt-body${expanded.has(prompt.id) ? ' expanded' : ''}`}>{prompt.body}</Typography>
                {(prompt.body.length > 350 || prompt.body.split('\n').length > 4) && (
                  <Button size="small" startIcon={expanded.has(prompt.id) ? <ExpandLess /> : <ExpandMore />} onClick={() => setExpanded(previous => {
                    const next = new Set(previous)
                    if (next.has(prompt.id)) next.delete(prompt.id)
                    else next.add(prompt.id)
                    return next
                  })}>
                    {expanded.has(prompt.id) ? 'Show less' : 'Show more'}
                  </Button>
                )}
                {prompt.notes && <Typography className="prompt-notes" color="text.secondary">{prompt.notes}</Typography>}
              </Box>
              <Box className="prompt-meta">
                {prompt.usage_count > 0 ? <Typography variant="caption" color="text.secondary">Used {prompt.usage_count}×</Typography> : <span />}
                <Stack direction="row" gap={0.5} flexWrap="wrap" justifyContent="flex-end" className="prompt-actions">
                  <Button size="small" startIcon={<ContentCopy />} onClick={() => void copy(prompt)}>{copiedId === prompt.id ? 'Copied!' : 'Copy'}</Button>
                  {prompt.is_read_only ? (
                    Boolean(prompt.is_favorite) && <Tooltip title="Favorite imported prompt"><Star color="warning" fontSize="small" /></Tooltip>
                  ) : (
                    <>
                      <Tooltip title={prompt.is_favorite ? 'Remove favorite' : 'Add favorite'}>
                        <IconButton onClick={() => void toggleFavorite(prompt)} aria-label="Toggle favorite">{prompt.is_favorite ? <Star color="warning" /> : <StarBorder />}</IconButton>
                      </Tooltip>
                      <Tooltip title="Edit prompt"><IconButton onClick={() => edit(prompt)} aria-label={`Edit ${prompt.title}`}><EditOutlined /></IconButton></Tooltip>
                      <Tooltip title="Delete prompt"><IconButton onClick={() => setPendingDelete(prompt)} aria-label={`Delete ${prompt.title}`}><DeleteOutline /></IconButton></Tooltip>
                    </>
                  )}
                </Stack>
              </Box>
            </Paper>
          ))}
        </Box>}
      <Dialog open={open} onClose={() => { if (!saving) setOpen(false) }} fullWidth maxWidth="md">
        <DialogTitle>{editing ? 'Edit Prompt' : 'New Prompt'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.2} sx={{ pt: 1 }}>
            <TextField label="Title *" value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} inputProps={{ maxLength: 200 }} />
            <TextField
              label="Prompt body *"
              multiline
              minRows={7}
              value={form.body}
              onChange={event => setForm({ ...form, body: event.target.value })}
              helperText={`${form.body.length.toLocaleString()} characters`}
              inputProps={{ maxLength: 32000 }}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Autocomplete
                freeSolo
                fullWidth
                options={categories}
                inputValue={form.category}
                onInputChange={(_event, value) => setForm(previous => ({ ...previous, category: value }))}
                renderInput={params => <TextField {...params} label="Category" placeholder="General, Image Gen, Code…" />}
              />
              <Autocomplete
                freeSolo
                fullWidth
                options={models}
                inputValue={form.model}
                onInputChange={(_event, value) => setForm(previous => ({ ...previous, model: value }))}
                renderInput={params => <TextField {...params} label="Model (optional)" placeholder="gpt-image-2, gpt-5.4, claude…" />}
              />
            </Stack>
            <TextField
              label="Tags — press Enter to add"
              value={tagInput}
              onChange={event => setTagInput(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addTag()
                }
              }}
            />
            {form.tags.length > 0 && <Stack direction="row" gap={0.75} flexWrap="wrap">{form.tags.map(tag => <Chip key={tag} label={tag} onDelete={() => setForm(previous => ({ ...previous, tags: previous.tags.filter(item => item !== tag) }))} />)}</Stack>}
            <TextField label="Notes (optional)" placeholder="Context, tips, variations, when to use…" multiline minRows={3} value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} />
            <FormControlLabel control={<Checkbox checked={form.isFavorite} onChange={event => setForm({ ...form, isFavorite: event.target.checked })} />} label="Mark as favorite" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" disabled={saving || !form.title.trim() || !form.body.trim()} onClick={() => void save()}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Create prompt'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={Boolean(pendingDelete)} onClose={() => setPendingDelete(null)}>
        <DialogTitle>Delete prompt?</DialogTitle>
        <DialogContent>This can't be undone.</DialogContent>
        <DialogActions><Button onClick={() => setPendingDelete(null)}>Cancel</Button><Button color="error" variant="contained" onClick={() => pendingDelete && remove(pendingDelete.id)}>Delete prompt</Button></DialogActions>
      </Dialog>
      <Snackbar open={Boolean(snackbar)} autoHideDuration={3_000} onClose={() => setSnackbar(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {snackbar ? <Alert severity={snackbar.severity} onClose={() => setSnackbar(null)}>{snackbar.message}</Alert> : undefined}
      </Snackbar>
    </Box>
  )
}
