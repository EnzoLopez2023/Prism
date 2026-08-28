import { Router } from 'express'

function input(body: Record<string, unknown>) {
  return {
    title: typeof body.title === 'string' ? body.title : '',
    body: typeof body.body === 'string' ? body.body : '',
    category: typeof body.category === 'string' ? body.category : 'General',
    tags: Array.isArray(body.tags) ? body.tags.filter((tag): tag is string => typeof tag === 'string').slice(0, 30) : [],
    model: typeof body.model === 'string' ? body.model : null,
    notes: typeof body.notes === 'string' ? body.notes : null,
    isFavorite: Boolean(body.is_favorite),
  }
}

export function promptRoutes(): Router {
  const router = Router()
  router.get('/prompts', async (req, res) => res.json(await req.repository.listPrompts(req.identity!, Object.fromEntries(Object.entries(req.query).map(([key, value]) => [key, typeof value === 'string' ? value : undefined])))))
  router.post('/prompts', async (req, res) => {
    const value = input(req.body)
    if (!value.title.trim() || !value.body.trim()) return res.status(400).json({ code: 'INVALID_PROMPT', error: 'Title and body are required' })
    const id = await req.repository.savePrompt(req.identity!, null, value)
    res.status(201).json({ id })
  })
  router.put('/prompts/:id', async (req, res) => {
    const value = input(req.body)
    if (!value.title.trim() || !value.body.trim()) return res.status(400).json({ code: 'INVALID_PROMPT', error: 'Title and body are required' })
    const id = await req.repository.savePrompt(req.identity!, Number(req.params.id), value)
    return id ? res.json({ id }) : res.status(404).json({ code: 'NOT_FOUND', error: 'Prompt not found or read-only legacy prompt' })
  })
  router.post('/prompts/:id/use', async (req, res) => {
    const changed = await req.repository.usePrompt(req.identity!, Number(req.params.id))
    return changed ? res.json({ success: true }) : res.status(404).json({ code: 'NOT_FOUND', error: 'Prompt not found' })
  })
  router.delete('/prompts/:id', async (req, res) => {
    const changed = await req.repository.deletePrompt(req.identity!, Number(req.params.id))
    if (!changed) return res.status(404).json({ code: 'NOT_FOUND', error: 'Prompt not found or read-only legacy prompt' })
    await req.repository.audit(req.identity!, 'delete', 'prompt', req.params.id || null, 'success')
    res.json({ success: true })
  })
  return router
}
