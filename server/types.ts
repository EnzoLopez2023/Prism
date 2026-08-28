import type { Identity, PrismRepository } from '../lib/db/repositories/prismRepository.js'

declare global {
  namespace Express {
    interface Request {
      identity?: Identity
      roles?: string[]
      repository: PrismRepository
    }
  }
}

export {}
