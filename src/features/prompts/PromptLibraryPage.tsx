import Add from '@mui/icons-material/Add'
import ContentCopy from '@mui/icons-material/ContentCopy'
import DeleteOutline from '@mui/icons-material/DeleteOutline'
import EditOutlined from '@mui/icons-material/EditOutlined'
import Star from '@mui/icons-material/Star'
import StarBorder from '@mui/icons-material/StarBorder'
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Drawer, FormControlLabel, IconButton, MenuItem, Paper,
  Select, Stack, Switch, TextField, Tooltip, Typography,
} from '@mui/material'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeading } from '../../components/PageHeading'
import { apiFetch } from '../../services/api'

interface Prompt {
  id: number; title: string; body: string; category: string; tags: string[]; model: string | null
  notes: string | null; is_favorite: number; usage_count: number
}
interface FormState { title: string; body: string; category: string; tags: string; model: string; notes: string; isFavorite: boolean }
const empty: FormState = { title: '', body: '', category: 'General', tags: '', model: '', notes: '', isFavorite: false }

export default function PromptLibraryPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [favorites, setFavorites] = useState(false)
  const [editing, setEditing] = useState<Prompt | null>(null)
  const [form, setForm] = useState(empty)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [pendingDelete, setPendingDelete] = useState<Prompt | null>(null)

  const load = useCallback(async () => {
    const params = new URLSearchParams({ sort: 'updated_at', order: 'desc' })
    if (search) params.set('search', search)
    if (category) params.set('category', category)
    if (favorites) params.set('favorite', '1')
    try { setPrompts(await apiFetch<Prompt[]>(`/api/prompts?${params}`)) }
    catch (error) { setError(error instanceof Error ? error.message : 'Prompts could not be loaded') }
  }, [search, category, favorites])
  useEffect(() => { const timeout = setTimeout(() => { void load() }, 180); return () => clearTimeout(timeout) }, [load])
  const categories = useMemo(() => [...new Set(prompts.map(item => item.category))].sort(), [prompts])

  const edit = (prompt?: Prompt) => {
    setEditing(prompt || null)
    setForm(prompt ? { title: prompt.title, body: prompt.body, category: prompt.category, tags: prompt.tags.join(', '), model: prompt.model || '', notes: prompt.notes || '', isFavorite: Boolean(prompt.is_favorite) } : empty)
    setOpen(true)
  }
  const save = async () => {
    const payload = { title: form.title, body: form.body, category: form.category, tags: form.tags.split(',').map(item => item.trim()).filter(Boolean), model: form.model || null, notes: form.notes || null, is_favorite: form.isFavorite ? 1 : 0 }
    await apiFetch(editing ? `/api/prompts/${editing.id}` : '/api/prompts', { method: editing ? 'PUT' : 'POST', body: JSON.stringify(payload) })
    setOpen(false); await load()
  }
  const copy = async (prompt: Prompt) => {
    await navigator.clipboard.writeText(prompt.body)
    await apiFetch(`/api/prompts/${prompt.id}/use`, { method: 'POST' })
    setPrompts(previous => previous.map(item => item.id === prompt.id ? { ...item, usage_count: item.usage_count + 1 } : item))
  }
  const toggleFavorite = async (prompt: Prompt) => {
    const next = prompt.is_favorite ? 0 : 1
    await apiFetch(`/api/prompts/${prompt.id}`, { method: 'PUT', body: JSON.stringify({ ...prompt, is_favorite: next }) })
    setPrompts(previous => previous.map(item => item.id === prompt.id ? { ...item, is_favorite: next } : item))
  }
  const remove = async (id: number) => {
    await apiFetch(`/api/prompts/${id}`, { method: 'DELETE' })
    setPrompts(previous => previous.filter(item => item.id !== id))
    setPendingDelete(null)
  }

  return (
    <Box className="page-shell">
      <PageHeading title="Prompt library" description="Store, find, and reuse the instructions that earn a place in your workflow." actions={<Button variant="contained" startIcon={<Add />} onClick={() => edit()}>New prompt</Button>} />
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      <Box className="prompt-filters">
        <TextField size="small" label="Search prompts" value={search} onChange={event => setSearch(event.target.value)} />
        <Select size="small" displayEmpty value={category} onChange={event => setCategory(event.target.value)}>
          <MenuItem value="">All categories</MenuItem>{categories.map(item => <MenuItem key={item} value={item}>{item}</MenuItem>)}
        </Select>
        <Button variant={favorites ? 'contained' : 'outlined'} startIcon={favorites ? <Star /> : <StarBorder />} onClick={() => setFavorites(!favorites)}>Favorites</Button>
      </Box>
      {!prompts.length ? <Paper className="workspace-panel empty-stage"><Box><strong>No prompts match this view.</strong>Clear a filter or save the first reusable prompt.</Box></Paper> :
        <Box className="prompt-list">
          {prompts.map(prompt => (
            <Paper key={prompt.id} className="prompt-row" variant="outlined">
              <Box className="prompt-copy"><Typography variant="h2">{prompt.title}</Typography><Typography className="prompt-body">{prompt.body}</Typography><Stack direction="row" gap={0.7} flexWrap="wrap"><Chip size="small" label={prompt.category} />{prompt.model && <Chip size="small" variant="outlined" label={prompt.model} />}{prompt.tags.map(tag => <Chip key={tag} size="small" variant="outlined" label={tag} />)}</Stack></Box>
              <Box className="prompt-meta"><Typography variant="caption" color="text.secondary">Used {prompt.usage_count}×</Typography><Box>
                <Tooltip title="Copy and record use"><IconButton onClick={() => copy(prompt)} aria-label={`Copy ${prompt.title}`}><ContentCopy /></IconButton></Tooltip>
                <Tooltip title={prompt.is_favorite ? 'Remove favorite' : 'Add favorite'}><IconButton onClick={() => toggleFavorite(prompt)} aria-label="Toggle favorite">{prompt.is_favorite ? <Star color="warning" /> : <StarBorder />}</IconButton></Tooltip>
                <Tooltip title="Edit prompt"><IconButton onClick={() => edit(prompt)} aria-label={`Edit ${prompt.title}`}><EditOutlined /></IconButton></Tooltip>
                <Tooltip title="Delete prompt"><IconButton onClick={() => setPendingDelete(prompt)} aria-label={`Delete ${prompt.title}`}><DeleteOutline /></IconButton></Tooltip>
              </Box></Box>
            </Paper>
          ))}
        </Box>}
      <Drawer anchor="right" open={open} onClose={() => setOpen(false)} PaperProps={{ sx: { width: { xs: '100%', sm: 480 }, p: 3 } }}>
        <Typography variant="h1">{editing ? 'Edit prompt' : 'New prompt'}</Typography>
        <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>Keep the reusable instruction in the body and context in notes.</Typography>
        <Stack spacing={2}>
          <TextField label="Title" required value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} />
          <TextField label="Prompt body" required multiline minRows={8} value={form.body} onChange={event => setForm({ ...form, body: event.target.value })} />
          <TextField label="Category" value={form.category} onChange={event => setForm({ ...form, category: event.target.value })} />
          <TextField label="Model" value={form.model} onChange={event => setForm({ ...form, model: event.target.value })} />
          <TextField label="Tags (comma separated)" value={form.tags} onChange={event => setForm({ ...form, tags: event.target.value })} />
          <TextField label="Notes" multiline minRows={3} value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} />
          <FormControlLabel control={<Switch checked={form.isFavorite} onChange={event => setForm({ ...form, isFavorite: event.target.checked })} />} label="Favorite" />
          <Stack direction="row" justifyContent="flex-end" spacing={1}><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="contained" disabled={!form.title.trim() || !form.body.trim()} onClick={save}>Save prompt</Button></Stack>
        </Stack>
      </Drawer>
      <Dialog open={Boolean(pendingDelete)} onClose={() => setPendingDelete(null)}>
        <DialogTitle>Delete “{pendingDelete?.title}”?</DialogTitle>
        <DialogContent>This permanently removes the prompt and its usage history.</DialogContent>
        <DialogActions><Button onClick={() => setPendingDelete(null)}>Cancel</Button><Button color="error" variant="contained" onClick={() => pendingDelete && remove(pendingDelete.id)}>Delete prompt</Button></DialogActions>
      </Dialog>
    </Box>
  )
}
