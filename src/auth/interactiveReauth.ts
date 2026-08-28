export type ReauthStatus = 'ready' | 'required' | 'authenticating' | 'error'
export interface ReauthSnapshot { status: ReauthStatus; message: string }

export class InteractiveReauthCoordinator {
  private snapshot: ReauthSnapshot = { status: 'ready', message: '' }
  private active: Promise<void> | null = null
  private readonly listeners = new Set<() => void>()

  getSnapshot = (): ReauthSnapshot => this.snapshot
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  require(message = 'Your Microsoft session needs attention. Sign in again to continue safely.'): void {
    this.update({ status: 'required', message })
  }

  ready(): void {
    this.update({ status: 'ready', message: '' })
  }

  run(action: () => Promise<unknown>): Promise<void> {
    if (this.active) return this.active
    this.update({ status: 'authenticating', message: 'Redirecting to Microsoft to refresh your session…' })
    this.active = action()
      .then(() => this.ready())
      .catch(error => {
        this.update({ status: 'error', message: error instanceof Error ? error.message : 'Interactive sign-in could not start.' })
        throw error
      })
      .finally(() => { this.active = null })
    return this.active
  }

  private update(snapshot: ReauthSnapshot): void {
    this.snapshot = snapshot
    for (const listener of this.listeners) listener()
  }
}
