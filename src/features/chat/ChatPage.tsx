import Add from '@mui/icons-material/Add'
import AttachFile from '@mui/icons-material/AttachFile'
import DeleteOutline from '@mui/icons-material/DeleteOutline'
import Send from '@mui/icons-material/Send'
import StopCircleOutlined from '@mui/icons-material/StopCircleOutlined'
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Paper, Select, Stack,
  TextField, Tooltip, Typography,
} from '@mui/material'
import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { PageHeading } from '../../components/PageHeading'
import { apiBlob, apiFetch, apiHeaders } from '../../services/api'
import { commitMediaMutation, type CommitDecision } from './mutationCommit'
import { ObjectUrlRegistry, resolveProtectedMessageImages } from './objectUrlRegistry'
import { boundedChatContext, type ChatContextMessage } from './chatContext'

interface Conversation { id: number; title: string; updated_at: string; message_count: number }
interface Message { id: string; type: 'user' | 'assistant'; content: string; timestamp: string; images?: string[] }
interface Prompt { id: number; title: string; body: string }
interface MutationPreview { schema: string; intentId: string; confirmationPhrase: string; expiresAt: string; preview: { title: string; media: { id: string; title: string }[] } }
interface PendingMutation { kind: 'playlists' | 'collections'; preview: MutationPreview; phrase: string; outcome?: CommitDecision }

function titleFor(value: string) {
  const title = value.replace(/[*_`#]/g, '').trim().slice(0, 50)
  return `${title || 'New conversation'}${value.length > 50 ? '…' : ''}`
}

async function streamChat(
  messages: ChatContextMessage[],
  images: string[],
  signal: AbortSignal,
  handlers: { onDelta: (value: string) => void; onImage: (value: string) => void; onTool: (value: string) => void },
): Promise<{ text: string; images: string[] }> {
  const response = await fetch('/api/azure-openai/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await apiHeaders() },
    body: JSON.stringify({ messages, images }),
    signal,
  })
  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => ({ error: `Assistant failed (${response.status})` }))
    throw new Error(body.error)
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''
  const generatedImages: string[] = []
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const frames = buffer.split('\n\n')
    buffer = frames.pop() || ''
    for (const frame of frames) {
      const event = frame.match(/^event:\s*(.+)$/m)?.[1]
      const raw = frame.match(/^data:\s*(.+)$/m)?.[1]
      if (!raw) continue
      const data = JSON.parse(raw)
      if (event === 'error') throw new Error(data.error || 'Assistant stream failed')
      if ((event === 'delta' || !event) && typeof data.delta === 'string') { full += data.delta; handlers.onDelta(data.delta) }
      if (event === 'image' && typeof data.image === 'string') { generatedImages.push(data.image); handlers.onImage(data.image) }
      if (event === 'tool' && typeof data.name === 'string') handlers.onTool(`${data.name}: ${data.status || 'running'}`)
    }
  }
  return { text: full, images: generatedImages }
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentId, setCurrentId] = useState<number | ''>('')
  const [messages, setMessages] = useState<Message[]>([])
  const [question, setQuestion] = useState('')
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [attached, setAttached] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [mutation, setMutation] = useState<PendingMutation | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [toolStatus, setToolStatus] = useState('')
  const aborter = useRef<AbortController | null>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const objectUrls = useRef(new ObjectUrlRegistry())
  const conversationLoad = useRef(0)

  const reloadList = async () => {
    const data = await apiFetch<{ conversations: Conversation[] }>('/api/conversations')
    setConversations(data.conversations)
  }

  useEffect(() => {
    Promise.all([reloadList(), apiFetch<Prompt[]>('/api/prompts?sort=title&order=asc').then(setPrompts)]).catch(error => setError(error.message))
  }, [])
  useEffect(() => () => {
    conversationLoad.current += 1
    objectUrls.current.clear()
  }, [])
  useEffect(() => {
    const transcript = transcriptRef.current
    if (transcript) transcript.scrollTo({ top: transcript.scrollHeight, behavior: messages.length ? 'smooth' : 'auto' })
  }, [messages, busy])

  const openConversation = async (id: number | '') => {
    const generation = ++conversationLoad.current
    objectUrls.current.clear()
    setMessages([])
    setCurrentId(id)
    setMutation(null)
    if (!id) return
    try {
      const data = await apiFetch<{ messages: Message[] }>(`/api/conversations/${id}`)
      const secured = await resolveProtectedMessageImages(data.messages, apiBlob, objectUrls.current)
      if (generation !== conversationLoad.current) return objectUrls.current.discard(secured.objectUrls)
      objectUrls.current.replace(secured.objectUrls)
      setMessages(secured.messages)
    } catch (error) { setError(error instanceof Error ? error.message : 'Conversation could not be opened') }
  }

  const addMessage = (conversationId: number, message: Message) =>
    apiFetch(`/api/conversations/${conversationId}/message`, { method: 'POST', body: JSON.stringify({ message }) })

  const maybePrepareMedia = async (text: string): Promise<boolean> => {
    const lower = text.toLowerCase()
    const kind = lower.includes('playlist') ? 'playlists' : lower.includes('collection') ? 'collections' : null
    if (!kind || !/(create|make|build|generate)/.test(lower)) return false
    const searchTerm = text.replace(/.*?(playlist|collection)(?:\s+(?:of|with|containing))?/i, '').replace(/called\s+["'][^"']+["']/i, '').trim() || text
    const search = await apiFetch<{ state: string; data?: { items: { id: string; title: string }[] }; reason?: string }>(`/api/media/search?q=${encodeURIComponent(searchTerm)}`)
    if (search.state !== 'available' || !search.data?.items.length) throw new Error(search.reason || 'Marquee media search is unavailable')
    const prepared = await apiFetch<{ state: string; data?: MutationPreview; reason?: string }>(`/api/media/${kind}/prepare`, {
      method: 'POST',
      body: JSON.stringify({ title: titleFor(searchTerm), mediaIds: search.data.items.map(item => item.id) }),
    })
    if (prepared.state !== 'available' || !prepared.data) throw new Error(prepared.reason || 'Marquee could not prepare the mutation')
    setMutation({ kind, preview: prepared.data, phrase: '' })
    return true
  }

  const send = async () => {
    const text = question.trim()
    if (!text || busy) return
    setQuestion('')
    setError('')
    setBusy(true)
    try {
      let id = currentId
      if (!id) {
        const created = await apiFetch<{ conversation: Conversation }>('/api/conversations', { method: 'POST', body: JSON.stringify({ title: titleFor(text) }) })
        id = created.conversation.id
        setCurrentId(id)
      }
      const sentImages = attached ? [attached] : []
      const user: Message = { id: crypto.randomUUID(), type: 'user', content: text, timestamp: new Date().toISOString(), images: sentImages.length ? sentImages : undefined }
      setAttached(null)
      setMessages(previous => [...previous, user])
      await addMessage(id, user)
      if (await maybePrepareMedia(text)) {
        const assistant: Message = { id: crypto.randomUUID(), type: 'assistant', content: 'I prepared a Marquee mutation preview. Review the exact media list and enter the confirmation phrase below; nothing has been changed yet.', timestamp: new Date().toISOString() }
        setMessages(previous => [...previous, assistant])
        await addMessage(id, assistant)
      } else {
        const assistant: Message = { id: crypto.randomUUID(), type: 'assistant', content: '', timestamp: new Date().toISOString() }
        setMessages(previous => [...previous, assistant])
        aborter.current = new AbortController()
        const context = boundedChatContext([...messages, user])
        let final = { text: '', images: [] as string[] }
        try {
          final = await streamChat(context, sentImages, aborter.current.signal, {
            onDelta: delta => setMessages(previous => previous.map(item => item.id === assistant.id ? { ...item, content: item.content + delta } : item)),
            onImage: image => setMessages(previous => previous.map(item => item.id === assistant.id ? { ...item, images: [...(item.images || []), image] } : item)),
            onTool: setToolStatus,
          })
        } catch (streamError) {
          if (aborter.current.signal.aborted) throw streamError
          const fallback = await apiFetch<{ choices?: { message?: { content?: string } }[] }>('/api/azure-openai/chat', {
            method: 'POST',
            body: JSON.stringify({ messages: context, images: sentImages }),
          })
          final.text = fallback.choices?.[0]?.message?.content || ''
          setMessages(previous => previous.map(item => item.id === assistant.id ? { ...item, content: final.text } : item))
        }
        setToolStatus('')
        await addMessage(id, { ...assistant, content: final.text, images: final.images.length ? final.images : undefined })
      }
      await reloadList()
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setError(error instanceof Error ? error.message : 'The message could not be sent')
    } finally { setBusy(false); aborter.current = null }
  }

  const commitMutation = async () => {
    if (!mutation) return
    setBusy(true)
    try {
      const outcome = await commitMediaMutation({ kind: mutation.kind, intentId: mutation.preview.intentId, confirmationPhrase: mutation.phrase }, apiFetch)
      if (outcome.clearPreview) setMutation(null)
      else setMutation({ ...mutation, outcome })
    } catch (error) {
      setMutation({ ...mutation, outcome: { state: 'unavailable', message: `${error instanceof Error ? error.message : 'Mutation request failed'} Keep this preview; do not assume the mutation completed.`, clearPreview: false } })
    }
    finally { setBusy(false) }
  }

  const removeConversation = async () => {
    if (!currentId) return
    await apiFetch(`/api/conversations/${currentId}`, { method: 'DELETE' })
    setCurrentId('')
    objectUrls.current.clear()
    setMessages([])
    await reloadList()
    setConfirmDelete(false)
  }

  const attachFile = (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > 15_000_000) return setError('Choose an image smaller than 15 MB')
    const reader = new FileReader()
    reader.onload = () => setAttached(String(reader.result))
    reader.readAsDataURL(file)
  }

  return (
    <Box className="page-shell chat-page">
      <PageHeading title="Assistant" description="A private, durable workspace with streamed answers and confirmed media actions." actions={
        <>
          <Select size="small" value={currentId} onChange={event => openConversation(event.target.value as number | '')} displayEmpty sx={{ minWidth: 220, bgcolor: 'background.paper' }}>
            <MenuItem value="">New conversation</MenuItem>
            {conversations.map(item => <MenuItem key={item.id} value={item.id}>{item.title}</MenuItem>)}
          </Select>
          <Tooltip title="Delete conversation"><span><IconButton disabled={!currentId} onClick={() => setConfirmDelete(true)} aria-label="Delete conversation"><DeleteOutline /></IconButton></span></Tooltip>
        </>
      } />
      <Paper className="workspace-panel chat-workspace">
        <Box className="chat-transcript" aria-live="polite" ref={transcriptRef}>
          {!messages.length && <Box className="empty-stage"><Box><strong>Start with the work in front of you.</strong>Ask a question, use a saved prompt, attach an image, or prepare a Marquee playlist.</Box></Box>}
          {messages.map(message => (
            <Box key={message.id} className={`chat-message ${message.type}`}>
              <Typography className="message-author">{message.type === 'user' ? 'You' : 'Prism'}</Typography>
              {message.images?.map(image => <img key={image} src={image} className="message-image" alt="Conversation attachment" />)}
              <Box className="markdown-body">{message.content ? <ReactMarkdown>{message.content}</ReactMarkdown> : <CircularProgress size={18} />}</Box>
            </Box>
          ))}
          {mutation && (
            <Alert severity="warning" className="mutation-preview">
              <Typography fontWeight={700}>{mutation.preview.preview.title}</Typography>
              <Typography variant="body2">{mutation.preview.preview.media.map(item => item.title).join(', ')}</Typography>
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>Expires {new Date(mutation.preview.expiresAt).toLocaleString()}</Typography>
              {mutation.outcome && <Alert severity={mutation.outcome.state === 'crash-ambiguous' ? 'warning' : 'error'} sx={{ mt: 1.5 }}>{mutation.outcome.message}</Alert>}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.5 }}>
                <TextField size="small" value={mutation.phrase} onChange={event => setMutation({ ...mutation, phrase: event.target.value })} label={`Type “${mutation.preview.confirmationPhrase}”`} fullWidth />
                <Button variant="contained" color="warning" disabled={mutation.phrase !== mutation.preview.confirmationPhrase || busy || Boolean(mutation.outcome)} onClick={commitMutation}>Commit</Button>
                <Button onClick={() => setMutation(null)}>Cancel</Button>
              </Stack>
            </Alert>
          )}
        </Box>
        {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
        {toolStatus && <Alert severity="info">{toolStatus}</Alert>}
        <Box className="chat-composer">
          {attached && <Box className="attachment-preview"><img src={attached} alt="Pending attachment" /><Button size="small" onClick={() => setAttached(null)}>Remove</Button></Box>}
          <Box className="composer-row">
            <Tooltip title="Attach image"><IconButton component="label" aria-label="Attach image"><AttachFile /><input hidden type="file" accept="image/*" onChange={event => attachFile(event.target.files?.[0])} /></IconButton></Tooltip>
            <Select size="small" displayEmpty value="" onChange={event => setQuestion(prompts.find(prompt => prompt.id === Number(event.target.value))?.body || '')} aria-label="Use saved prompt" sx={{ maxWidth: 150 }}>
              <MenuItem value=""><Add fontSize="small" /> Prompt</MenuItem>
              {prompts.map(prompt => <MenuItem key={prompt.id} value={prompt.id}>{prompt.title}</MenuItem>)}
            </Select>
            <TextField multiline maxRows={7} fullWidth placeholder="Message Prism…" value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send() } }} inputProps={{ maxLength: 32000 }} />
            {busy ? <IconButton color="error" onClick={() => aborter.current?.abort()} aria-label="Stop response"><StopCircleOutlined /></IconButton> : <IconButton color="primary" onClick={send} disabled={!question.trim()} aria-label="Send message"><Send /></IconButton>}
          </Box>
        </Box>
      </Paper>
      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)}>
        <DialogTitle>Delete this conversation?</DialogTitle>
        <DialogContent>This removes every message and stored image in the conversation. This cannot be undone.</DialogContent>
        <DialogActions><Button onClick={() => setConfirmDelete(false)}>Cancel</Button><Button color="error" variant="contained" onClick={removeConversation}>Delete conversation</Button></DialogActions>
      </Dialog>
    </Box>
  )
}
