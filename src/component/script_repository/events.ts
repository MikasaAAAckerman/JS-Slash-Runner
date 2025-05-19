/**
 * Script repository event types
 */
export enum ScriptRepositoryEventType {
  // Script operation events
  SCRIPT_TOGGLE = 'script_toggle',
  SCRIPT_RUN = 'script_run',
  SCRIPT_STOP = 'script_stop',
  SCRIPT_SAVE = 'script_save',
  SCRIPT_DELETE = 'script_delete',
  SCRIPT_MOVE = 'script_move',
  SCRIPT_EDIT = 'script_edit',

  // Type toggle events
  TYPE_TOGGLE = 'type_toggle',

  // Button events
  BUTTON_ADD = 'button_add',
  BUTTON_REMOVE = 'button_remove',

  // Import/export events
  SCRIPT_IMPORT = 'script_import',
  SCRIPT_EXPORT = 'script_export',

  // Variable editing events
  VARIABLE_EDIT = 'variable_edit',

  // UI events
  UI_REFRESH = 'ui_refresh',
  UI_LOADED = 'ui_loaded',
}

/**
 * Event listener type
 */
export type EventListener = (data: any) => void;

// Import SillyTavern event source
import { eventSource } from '@sillytavern/script';

/**
 * Event bus class for component communication
 * Based on SillyTavern.eventSource but adds namespace prefix to avoid conflicts
 */
export class EventBus {
  private static instance: EventBus;
  private readonly EVENT_NAMESPACE = 'script_repository_';
  private activeListeners: Map<ScriptRepositoryEventType, Set<EventListener>> = new Map();

  private constructor() {}

  /**
   * Get event bus instance
   */
  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * Get namespaced event name
   * @param eventType Event type
   * @returns Namespaced event name
   */
  private getNamespacedEvent(eventType: ScriptRepositoryEventType): string {
    return `${this.EVENT_NAMESPACE}${eventType}`;
  }

  /**
   * Add event listener
   * @param eventType Event type
   * @param listener Listener function
   */
  public on(eventType: ScriptRepositoryEventType, listener: EventListener): void {
    // Save listener reference for later removal
    if (!this.activeListeners.has(eventType)) {
      this.activeListeners.set(eventType, new Set());
    }
    this.activeListeners.get(eventType)?.add(listener);

    // Use SillyTavern event system but with namespace prefix
    const namespacedEvent = this.getNamespacedEvent(eventType);
    eventSource.on(namespacedEvent, listener);
  }

  /**
   * Remove event listener
   * @param eventType Event type
   * @param listener Listener function
   */
  public off(eventType: ScriptRepositoryEventType, listener: EventListener): void {
    const namespacedEvent = this.getNamespacedEvent(eventType);
    eventSource.removeListener(namespacedEvent, listener);

    // Remove from local records
    const listeners = this.activeListeners.get(eventType);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.activeListeners.delete(eventType);
      }
    }
  }

  /**
   * Emit event
   * @param eventType Event type
   * @param data Event data
   */
  public emit(eventType: ScriptRepositoryEventType, data?: any): void {
    const namespacedEvent = this.getNamespacedEvent(eventType);
    eventSource.emit(namespacedEvent, data);
  }

  /**
   * Clear all event listeners
   */
  public clear(): void {
    // Remove all registered listeners
    this.activeListeners.forEach((listeners, eventType) => {
      const namespacedEvent = this.getNamespacedEvent(eventType);
      listeners.forEach(listener => {
        eventSource.removeListener(namespacedEvent, listener);
      });
    });
    this.activeListeners.clear();
  }

  /**
   * Destroy event bus instance
   */
  public static destroyInstance(): void {
    if (EventBus.instance) {
      EventBus.instance.clear();
      EventBus.instance = undefined as unknown as EventBus;
    }
  }
}

// Export event bus singleton
export const scriptEvents = EventBus.getInstance();
