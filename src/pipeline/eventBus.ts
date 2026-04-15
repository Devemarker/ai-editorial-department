type EventHandler<T = unknown> = (event: T) => void;

export class EventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();

  on<T>(eventType: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler as EventHandler);

    // 返回取消订阅函数
    return () => this.off(eventType, handler);
  }

  off<T>(eventType: string, handler: EventHandler<T>): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler as EventHandler);
    }
  }

  emit<T>(eventType: string, event: T): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      for (const handler of handlers) {
        try {
          (handler as EventHandler<T>)(event);
        } catch (err) {
          console.error(`[EventBus] Handler error for ${eventType}:`, err);
        }
      }
    }
  }

  once<T>(eventType: string, handler: EventHandler<T>): () => void {
    const wrappedHandler: EventHandler<T> = (event) => {
      this.off(eventType, wrappedHandler);
      handler(event);
    };
    return this.on(eventType, wrappedHandler);
  }

  clear(): void {
    this.handlers.clear();
  }
}

// 全局事件总线单例
export const globalEventBus = new EventBus();
