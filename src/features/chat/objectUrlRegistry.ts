export interface MessageWithImages {
  images?: string[]
}

export class ObjectUrlRegistry {
  private readonly active = new Set<string>()

  constructor(private readonly revoke: (url: string) => void = URL.revokeObjectURL.bind(URL)) {}

  replace(urls: string[]): void {
    const next = new Set(urls.filter(url => url.startsWith('blob:')))
    for (const url of this.active) if (!next.has(url)) this.revoke(url)
    this.active.clear()
    for (const url of next) this.active.add(url)
  }

  discard(urls: string[]): void {
    for (const url of urls) if (url.startsWith('blob:')) this.revoke(url)
  }

  clear(): void {
    this.discard([...this.active])
    this.active.clear()
  }
}

export async function resolveProtectedMessageImages<T extends MessageWithImages>(
  messages: T[],
  load: (path: string) => Promise<string>,
  registry: ObjectUrlRegistry,
): Promise<{ messages: T[]; objectUrls: string[] }> {
  const objectUrls: string[] = []
  try {
    const resolved = []
    for (const message of messages) {
      const images = []
      for (const image of message.images || []) {
        const value = image.startsWith('/api/') ? await load(image) : image
        images.push(value)
        if (value.startsWith('blob:')) objectUrls.push(value)
      }
      resolved.push({ ...message, images: images.length ? images : undefined })
    }
    return { messages: resolved, objectUrls }
  } catch (error) {
    registry.discard(objectUrls)
    throw error
  }
}
