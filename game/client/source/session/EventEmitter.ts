export class EventEmitter<TEvents extends Record<string, any>> {
  private readonly listeners = new Map<keyof TEvents, Set<(payload: any) => void>>();

  on<TKey extends keyof TEvents>(event: TKey, listener: (payload: TEvents[TKey]) => void): () => void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener as (payload: any) => void);
    this.listeners.set(event, set);
    return () => this.off(event, listener);
  }

  off<TKey extends keyof TEvents>(event: TKey, listener: (payload: TEvents[TKey]) => void): void {
    this.listeners.get(event)?.delete(listener as (payload: any) => void);
  }

  emit<TKey extends keyof TEvents>(event: TKey, payload: TEvents[TKey]): void {
    const set = this.listeners.get(event);
    if (!set) {
      return;
    }

    for (const listener of set) {
      listener(payload);
    }
  }
}
