import { Router } from 'express'
import type { AppConfig } from '../config.js'

export function conversationRoutes(config: AppConfig): Router {
  const router = Router()

  router.get('/conversations', async (req, res) => res.json({ conversations: await req.repository.listConversations(req.identity!) }))
  router.post('/conversations', async (req, res) => {
    const title = typeof req.body.title === 'string' && req.body.title.trim() ? req.body.title.trim().slice(0, 160) : `Conversation ${new Date().toLocaleString()}`
    res.status(201).json({ conversation: await req.repository.createConversation(req.identity!, title) })
  })
  router.get('/conversations/:id', async (req, res) => {
    const result = await req.repository.getConversation(req.identity!, Number(req.params.id))
    return result ? res.json(result) : res.status(404).json({ code: 'NOT_FOUND', error: 'Conversation not found' })
  })
  router.post('/conversations/:id/message', async (req, res) => {
    const message = req.body.message as { id?: unknown; type?: unknown; content?: unknown; timestamp?: unknown; images?: unknown }
    if (!message || typeof message.id !== 'string' || !['user', 'assistant'].includes(String(message.type)) || typeof message.content !== 'string' || message.content.length > config.limits.maxPromptChars * 2) {
      return res.status(400).json({ code: 'INVALID_MESSAGE', error: 'A valid bounded message is required' })
    }
    const saved = await req.repository.addMessage(req.identity!, Number(req.params.id), {
      id: message.id,
      type: message.type as 'user' | 'assistant',
      content: message.content,
      timestamp: typeof message.timestamp === 'string' ? message.timestamp : new Date().toISOString(),
      images: Array.isArray(message.images) ? message.images.filter((item): item is string => typeof item === 'string').slice(0, 4) : undefined,
    }, config.limits.maxImageBytes)
    if (!saved) return res.status(404).json({ code: 'NOT_FOUND', error: 'Conversation not found' })
    res.status(201).json({ success: true })
  })
  router.delete('/conversations/:id', async (req, res) => {
    const deleted = await req.repository.deleteConversation(req.identity!, Number(req.params.id))
    if (!deleted) return res.status(404).json({ code: 'NOT_FOUND', error: 'Conversation not found' })
    await req.repository.audit(req.identity!, 'delete', 'conversation', req.params.id || null, 'success')
    res.json({ success: true })
  })
  router.get('/conversation-images/:id', async (req, res) => {
    const image = await req.repository.getImage(req.identity!, Number(req.params.id))
    if (!image) return res.status(404).json({ code: 'NOT_FOUND', error: 'Image not found' })
    res.setHeader('Content-Type', image.contentType)
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable')
    res.send(image.bytes)
  })
  return router
}
