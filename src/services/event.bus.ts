import { EventEmitter } from 'events'
import type { CaseEvent } from '../domain/event.types'

class CasesEventBus extends EventEmitter {
  publish(event: CaseEvent): void {
    // Per-org channel for SSE fan-out
    this.emit(`org:${event.orgId}`, event)
    // Per-case channel for case-specific listeners
    this.emit(`case:${event.caseId}`, event)
    // Wildcard for any global listeners
    this.emit('*', event)
  }

  subscribeOrg(orgId: string, listener: (event: CaseEvent) => void): () => void {
    this.on(`org:${orgId}`, listener)
    return () => this.off(`org:${orgId}`, listener)
  }

  subscribeCase(caseId: string, listener: (event: CaseEvent) => void): () => void {
    this.on(`case:${caseId}`, listener)
    return () => this.off(`case:${caseId}`, listener)
  }
}

export const eventBus = new CasesEventBus()
eventBus.setMaxListeners(500)
