import { Router } from 'express'
import type { CrossAppClients } from '../clients/contracts.js'
import type { AppConfig } from '../config.js'
import { runChatCompletion, streamChatAgent } from '../chat/agent.js'
import { judgeModel, runImageModel, runTextModel, textModels } from '../providers/providerService.js'

function responseSignal(res: import('express').Response): AbortSignal {
  const controller = new AbortController()
  res.once('close', () => controller.abort())
  return controller.signal
}

function providerError(res: import('express').Response, error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : 'PROVIDER_ERROR'
  const status = code === 'PROVIDER_UNAVAILABLE' ? 503 : ['INVALID_PROMPT', 'INVALID_IMAGE'].includes(code) ? 400 : 502
  res.status(status).json({ code, error: error instanceof Error ? error.message : 'Provider request failed' })
}

export function aiRoutes(config: AppConfig, clients: CrossAppClients): Router {
  const router = Router()
  router.get('/providers', (_req, res) => {
    res.json({
      text: textModels().map(({ id, label, provider, endpoint, apiKey }) => ({ id, label, provider, state: endpoint && apiKey ? 'available' : 'unavailable' })),
      image: ['gpt-image-1', 'gpt-image-2', 'mai-image-2e'].map(id => ({ id, state: id === 'mai-image-2e' ? (process.env.MAI_IMAGE_ENDPOINT && process.env.MAI_IMAGE_API_KEY ? 'available' : 'unavailable') : (process.env.GPT_IMAGE_ENDPOINT && process.env.GPT_IMAGE_API_KEY ? 'available' : 'unavailable') })),
    })
  })
  router.post('/ai-test/analyze', async (req, res) => {
    const blocks = Object.entries(req.body.responses || {}).slice(0, 8)
      .filter(([, value]) => typeof value === 'object' && value !== null && 'content' in value && typeof value.content === 'string' && value.content)
      .map(([name, value]) => `### ${name}\n${String((value as { content: string }).content)}`).join('\n\n')
    if (!String(req.body.prompt || '').trim() || !blocks) return res.status(400).json({ code: 'INVALID_PROMPT', error: 'Prompt and successful responses are required' })
    const prompt = 'You are judging how several AI models answered the same prompt. Compare their responses for correctness, completeness, clarity, and how well each followed the instructions. Be concise and specific — no preamble.\n\n' +
      `ORIGINAL PROMPT:\n${String(req.body.prompt)}\n\nMODEL RESPONSES:\n${blocks}\n\n` +
      'Respond in markdown with:\n1. **Verdict** — one line on which response is strongest and why.\n2. **Per model** — one bullet each: main strength + main weakness.\n3. **Errors** — any factual or logical mistakes you spotted (or "none").'
    try { res.json(await runTextModel(judgeModel(), prompt, config, responseSignal(res))) } catch (error) { providerError(res, error) }
  })
  router.post('/ai-test/:model', async (req, res) => {
    const model = textModels().find(item => item.id === req.params.model)
    if (!model) return res.status(404).json({ code: 'MODEL_NOT_FOUND', error: 'Unknown model' })
    try { res.json(await runTextModel(model, String(req.body.prompt || ''), config, responseSignal(res))) } catch (error) { providerError(res, error) }
  })
  router.post('/ai-image-test/:model', async (req, res) => {
    if (!['gpt-image-1', 'gpt-image-2', 'mai-image-2e'].includes(req.params.model || '')) return res.status(404).json({ code: 'MODEL_NOT_FOUND', error: 'Unknown image model' })
    try { res.json(await runImageModel(req.params.model!, { prompt: String(req.body.prompt || ''), size: String(req.body.size || '1024x1024'), sourceImage: typeof req.body.sourceImage === 'string' ? req.body.sourceImage : null }, config, responseSignal(res))) } catch (error) { providerError(res, error) }
  })
  router.post('/azure-openai/chat', async (req, res) => {
    try {
      res.json(await runChatCompletion(req.body.messages, req.body.images ?? (req.body.image ? [req.body.image] : []), config, responseSignal(res)))
    } catch (error) { providerError(res, error) }
  })
  router.post('/azure-openai/chat/stream', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('X-Accel-Buffering', 'no')
    const signal = responseSignal(res)
    try {
      await streamChatAgent({ input: req.body.messages, images: req.body.images ?? (req.body.image ? [req.body.image] : []), config, clients, repository: req.repository, identity: req.identity!, res, signal })
    } catch (error) {
      if (!signal.aborted) res.write(`event: error\ndata: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Provider request failed' })}\n\n`)
    }
    if (!res.writableEnded) res.end()
  })
  router.get('/contracts/:app/status', async (req, res) => {
    const app = req.params.app as 'hearth' | 'lantern' | 'watchtower'
    if (!['hearth', 'lantern', 'watchtower'].includes(app)) return res.status(404).json({ code: 'CONTRACT_NOT_FOUND', error: 'Unknown contract' })
    res.json(await clients[app].read('/api/contracts/v1/status', responseSignal(res)))
  })
  router.get('/media/search', async (req, res) => res.json(await clients.marquee.search(String(req.query.q || ''), responseSignal(res))))
  router.post('/media/:kind/prepare', async (req, res) => {
    const kind = req.params.kind as 'playlists' | 'collections'
    if (!['playlists', 'collections'].includes(kind)) return res.status(404).json({ code: 'CONTRACT_NOT_FOUND', error: 'Unknown mutation kind' })
    res.json(await clients.marquee.prepare(kind, req.body, responseSignal(res)))
  })
  router.post('/media/:kind/commit', async (req, res) => {
    const kind = req.params.kind as 'playlists' | 'collections'
    if (!['playlists', 'collections'].includes(kind)) return res.status(404).json({ code: 'CONTRACT_NOT_FOUND', error: 'Unknown mutation kind' })
    if (typeof req.body.intentId !== 'string' || !req.body.intentId.trim() || req.body.intentId.length > 200 ||
        typeof req.body.confirmationPhrase !== 'string' || !req.body.confirmationPhrase.trim() || req.body.confirmationPhrase.length > 500) {
      return res.status(400).json({ code: 'INVALID_CONFIRMATION', error: 'A bounded intent and exact confirmation phrase are required' })
    }
    const requestedIntentId = req.body.intentId
    const result = await clients.marquee.commit(kind, requestedIntentId, req.body.confirmationPhrase, responseSignal(res))
    const correlated = result.state === 'available' && result.data.intentId !== requestedIntentId
      ? { state: 'unavailable' as const, reason: 'Marquee returned a mismatched intent ID; the outcome is ambiguous and must not be retried', retryable: false }
      : result
    const mutationState = result.state === 'available' && result.data.intentId !== requestedIntentId
      ? 'intent-mismatch-ambiguous'
      : result.state === 'available' ? result.data.state : (result.state === 'unavailable' ? (result.outcome || result.state) : result.state)
    await req.repository.audit(req.identity!, 'commit', `marquee.${kind}`, requestedIntentId, mutationState === 'success' ? 'success' : 'failure', { mutationState })
    res.json(correlated)
  })
  return router
}
