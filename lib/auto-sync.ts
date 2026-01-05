/**
 * Auto-sync manager for checking emails at regular intervals
 */

export class AutoSyncManager {
  private intervalId: NodeJS.Timeout | null = null
  private isRunning = false
  private checkIntervalMs: number

  constructor(checkIntervalMinutes: number = 30) {
    this.checkIntervalMs = checkIntervalMinutes * 60 * 1000
  }

  start(onSync: () => Promise<void>) {
    if (this.isRunning) {
      console.log('Auto-sync already running')
      return
    }

    console.log(`Starting auto-sync with interval: ${this.checkIntervalMs / 60000} minutes`)
    this.isRunning = true

    // Run immediately on start
    onSync().catch(error => {
      console.error('Auto-sync error:', error)
    })

    // Then run at intervals
    this.intervalId = setInterval(() => {
      if (this.isRunning) {
        onSync().catch(error => {
          console.error('Auto-sync error:', error)
        })
      }
    }, this.checkIntervalMs)
  }

  stop() {
    console.log('Stopping auto-sync')
    this.isRunning = false
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  updateInterval(checkIntervalMinutes: number) {
    this.checkIntervalMs = checkIntervalMinutes * 60 * 1000
    if (this.isRunning && this.intervalId) {
      // Restart with new interval
      const wasRunning = this.isRunning
      this.stop()
      if (wasRunning) {
        // Will be restarted by caller
      }
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      intervalMinutes: this.checkIntervalMs / 60000
    }
  }
}
