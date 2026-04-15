import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../pipeline/eventBus.js';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  describe('on/off', () => {
    it('应注册并触发事件处理器', () => {
      const handler = vi.fn();
      eventBus.on('test', handler);
      eventBus.emit('test', { data: 'hello' });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ data: 'hello' });
    });

    it('应支持多个处理器', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      eventBus.on('test', handler1);
      eventBus.on('test', handler2);
      eventBus.emit('test', {});

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('应通过 off 取消订阅', () => {
      const handler = vi.fn();
      eventBus.on('test', handler);
      eventBus.off('test', handler);
      eventBus.emit('test', {});

      expect(handler).not.toHaveBeenCalled();
    });

    it('应返回取消订阅函数', () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.on('test', handler);
      unsubscribe();
      eventBus.emit('test', {});

      expect(handler).not.toHaveBeenCalled();
    });

    it('应处理不存在的事件类型', () => {
      expect(() => eventBus.emit('nonexistent', {})).not.toThrow();
    });

    it('应处理多次 off 调用', () => {
      const handler = vi.fn();
      eventBus.on('test', handler);
      eventBus.off('test', handler);
      eventBus.off('test', handler); // 第二次应该无事发生
      eventBus.emit('test', {});

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('emit', () => {
    it('应传递事件数据给处理器', () => {
      const handler = vi.fn();
      eventBus.on('data', handler);
      eventBus.emit('data', { value: 42 });

      expect(handler).toHaveBeenCalledWith({ value: 42 });
    });

    it('应在处理器出错时继续执行其他处理器', () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const normalHandler = vi.fn();
      eventBus.on('test', errorHandler);
      eventBus.on('test', normalHandler);
      eventBus.emit('test', {});

      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(normalHandler).toHaveBeenCalledTimes(1);
    });

    it('应捕获并记录处理器错误', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const errorHandler = vi.fn(() => {
        throw new Error('Test error');
      });
      eventBus.on('test', errorHandler);
      eventBus.emit('test', {});

      expect(errorHandler).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('once', () => {
    it('应只触发一次处理器', () => {
      const handler = vi.fn();
      eventBus.once('test', handler);
      eventBus.emit('test', {});
      eventBus.emit('test', {});
      eventBus.emit('test', {});

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('应传递正确的事件数据', () => {
      const handler = vi.fn();
      eventBus.once('test', handler);
      eventBus.emit('test', { data: 'once' });

      expect(handler).toHaveBeenCalledWith({ data: 'once' });
    });

    it('取消订阅后不应触发', () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.once('test', handler);
      unsubscribe();
      eventBus.emit('test', {});

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('应清除所有处理器', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      eventBus.on('event1', handler1);
      eventBus.on('event2', handler2);
      eventBus.clear();

      eventBus.emit('event1', {});
      eventBus.emit('event2', {});

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe('不同事件类型', () => {
    it('应区分不同事件类型', () => {
      const handlerA = vi.fn();
      const handlerB = vi.fn();
      eventBus.on('eventA', handlerA);
      eventBus.on('eventB', handlerB);
      eventBus.emit('eventA', {});

      expect(handlerA).toHaveBeenCalledTimes(1);
      expect(handlerB).not.toHaveBeenCalled();
    });
  });
});
