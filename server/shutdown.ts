export interface ShutdownServer {
  close(callback: (error?: Error) => void): void
  closeAllConnections(): void
}

interface ShutdownOptions {
  getServer: () => ShutdownServer | undefined
  releaseResources: () => void
  timeoutMs: number
  exit?: (code: number) => void
  logger?: Pick<Console, 'log' | 'error'>
}

export function createShutdownHandler({
  getServer,
  releaseResources,
  timeoutMs,
  exit = code => process.exit(code),
  logger = console,
}: ShutdownOptions): (signal: string) => void {
  let shuttingDown = false
  let finished = false

  return signal => {
    if (shuttingDown) return
    shuttingDown = true
    logger.log(`prism_shutdown signal=${signal}`)
    const state: { timeout?: NodeJS.Timeout } = {}

    const finish = (requestedExitCode: number, serverError?: Error) => {
      if (finished) return
      finished = true
      if (state.timeout) clearTimeout(state.timeout)
      let exitCode = requestedExitCode
      if (serverError) {
        logger.error('prism_shutdown_server_error', serverError)
        exitCode = 1
      }
      try {
        releaseResources()
      } catch (error) {
        logger.error('prism_shutdown_cleanup_failed', error)
        exitCode = 1
      }
      exit(exitCode)
    }

    const server = getServer()
    if (!server) {
      finish(0)
      return
    }

    state.timeout = setTimeout(() => {
      logger.error(`prism_shutdown_timeout timeoutMs=${timeoutMs}`)
      try {
        server.closeAllConnections()
        finish(1)
      } catch (error) {
        finish(1, error instanceof Error ? error : new Error(String(error)))
      }
    }, timeoutMs)
    state.timeout.unref()

    try {
      server.close(error => finish(error ? 1 : 0, error))
    } catch (error) {
      finish(1, error instanceof Error ? error : new Error(String(error)))
    }
  }
}
