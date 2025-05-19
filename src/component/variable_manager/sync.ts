import { eventSource } from '@sillytavern/script';

import { VariableModel } from '@/component/variable_manager/model';
import { VariableType } from '@/component/variable_manager/types';
import { getVariables } from '@/function/variables';

let variableCache: Record<string, any> = {};

const VARIABLE_EVENTS: Record<string, string> = {
  GLOBAL: 'settings_updated',
  CHARACTER: 'character_variables_changed',
  MESSAGE: 'message_variables_changed',
  // Chat variables use polling instead of events
  CHAT: '',
};

// Define polling interval (milliseconds)
const CHAT_POLLING_INTERVAL = 2000;

export interface IDomUpdater {
  addVariableCard(name: string, value: any): void;
  removeVariableCard(name: string): void;
  updateVariableCard(name: string, value: any): void;
  updateWithoutAnimation(isSkipAnimation: boolean): void;
}

interface ListenerStatus {
  bound: boolean;
  handler: (...args: any[]) => Promise<void>;
}

export class VariableSyncService {
  private domUpdater: IDomUpdater;
  private model: VariableModel;
  private currentType: VariableType | null = null;
  private _boundListeners: Record<VariableType, ListenerStatus> = {
    global: { bound: false, handler: this._handleVariableUpdate.bind(this, 'global') },
    character: { bound: false, handler: this._handleVariableUpdate.bind(this, 'character') },
    chat: { bound: false, handler: this._handleVariableUpdate.bind(this, 'chat') },
    message: { bound: false, handler: this._handleVariableUpdate.bind(this, 'message') },
  };
  // Timer ID for chat variable polling
  private _chatPollingInterval: number | null = null;
  // Flag if listeners are active
  private _listenersActive: boolean = false;
  // Flag if type switching is in progress
  private _isTypeChanging: boolean = false;
  // Map of recently processed variables: key=name, value=timestamp
  private _recentlyProcessedVariables: Map<string, number> = new Map();
  // Last cleanup timestamp
  private _lastCleanupTimestamp: number = 0;

  /**
   * Constructor
   * @param domUpdater DOM updater
   * @param model Variable data model
   */
  constructor(domUpdater: IDomUpdater, model: VariableModel) {
    this.domUpdater = domUpdater;
    this.model = model;
  }

  // Get if currently switching types
  public get isTypeChanging(): boolean {
    return this._isTypeChanging;
  }

  /**
   * Mark variable as recently processed
   * @param name Variable name
   */
  public markVariableAsProcessed(name: string): void {
    this._recentlyProcessedVariables.set(name, Date.now());
  }

  /**
   * Check if variable was recently processed
   * @param name Variable name
   * @param maxAgeMs Maximum age in ms (default 3000ms)
   * @returns Whether variable was recently processed
   */
  public wasRecentlyProcessed(name: string, maxAgeMs: number = 3000): boolean {
    const timestamp = this._recentlyProcessedVariables.get(name);
    if (!timestamp) return false;
    return Date.now() - timestamp < maxAgeMs;
  }

  /**
   * Clean up expired processing records
   * @param maxAgeMs Maximum record age in ms (default 5000ms)
   * @private
   */
  private _cleanupProcessedRecords(maxAgeMs: number = 5000): void {
    const now = Date.now();
    // Max once every 30 seconds
    if (now - this._lastCleanupTimestamp < 30000) return;

    this._lastCleanupTimestamp = now;
    this._recentlyProcessedVariables.forEach((timestamp, name) => {
      if (now - timestamp > maxAgeMs) {
        this._recentlyProcessedVariables.delete(name);
      }
    });
  }

  public async cleanup(): Promise<void> {
    this._unbindAllEventListeners();
    this._stopChatPolling();

    try {
      variableCache = {};
      this._recentlyProcessedVariables.clear();
    } catch (error) {
      console.error(`[VariableManager]: Error clearing cache:`, error);
    }
    this.currentType = null;
  }

  /**
   * Set current variable type and initialize listeners/polling
   * @param type Variable type
   * @returns Retrieved variable data
   */
  public async setCurrentType(type: VariableType): Promise<Record<string, any>> {
    let loadedVariables = {};

    if (this.currentType !== type) {
      this._isTypeChanging = true;
      this.domUpdater.updateWithoutAnimation(true);

      this.currentType = type;

      loadedVariables = await this.initializeCacheForType(type);

      if (this._listenersActive) {
        if (type === 'chat') {
          this._startChatPolling();
        } else {
          this._bindVariableListener(type);
        }
      }

      this._isTypeChanging = false;
      this.domUpdater.updateWithoutAnimation(false);
    }

    return loadedVariables;
  }

  /**
   * Activate event listeners/polling for current type
   * Should be called when tab becomes active
   */
  public activateListeners(): void {
    this._listenersActive = true;
    if (this.currentType) {
      if (this.currentType === 'chat') {
        this._startChatPolling();
      } else {
        this._bindVariableListener(this.currentType);
      }
    }
  }

  /**
   * Deactivate current event listeners/polling
   * Should be called when tab becomes inactive to save resources
   */
  public deactivateListeners(): void {
    this._listenersActive = false;
    this._unbindAllEventListeners();
    this._stopChatPolling();
  }

  public async initializeCacheForType(type: VariableType): Promise<Record<string, any>> {
    try {
      const currentVariables = getVariables({ type });
      const fullCache = variableCache || {};
      fullCache[type] = _.cloneDeep(currentVariables);
      variableCache = fullCache;
      return currentVariables;
    } catch (error) {
      console.error(`[VariableManager]: Error initializing cache of type ${type}:`, error);
      return {};
    }
  }

  /**
   * Manually trigger variable update handling
   * Used for testing or when event system is unavailable
   * @returns Promise<void>
   */
  public async manualUpdate(): Promise<void> {
    if (this.currentType) {
      await this._handleVariableUpdate(this.currentType);
    }
  }

  /**
   * Unified variable listener binding
   * @param type Variable type
   * @private
   */
  private _bindVariableListener(type: VariableType): void {
    if (type === 'chat') return;

    const eventName = VARIABLE_EVENTS[type.toUpperCase()];
    const listenerStatus = this._boundListeners[type];

    if (!listenerStatus.bound && eventName) {
      try {
        eventSource.on(eventName, listenerStatus.handler);
        this._boundListeners[type].bound = true;
      } catch (error) {
        console.error(`[VariableSyncService]: Error binding ${type} variable event listener:`, error);
        this._boundListeners[type].bound = false;
      }
    }
  }

  /**
   * Unbind all event listeners
   * @private
   */
  private _unbindAllEventListeners(): void {
    for (const type of Object.keys(this._boundListeners) as VariableType[]) {
      if (type === 'chat') continue;

      const eventName = VARIABLE_EVENTS[type.toUpperCase()];
      const listenerStatus = this._boundListeners[type];

      if (listenerStatus.bound && eventName) {
        try {
          eventSource.removeListener(eventName, listenerStatus.handler);
          this._boundListeners[type].bound = false;
        } catch (error) {
          console.error(`[VariableManager]: Error unbinding ${type} variable event listener:`, error);
        }
      }
    }
  }

  /**
   * Start chat variable polling
   * @private
   */
  private _startChatPolling(): void {
    this._stopChatPolling();

    if (this.currentType === 'chat' && this._listenersActive) {
      try {
        // Set interval to check chat variables
        this._chatPollingInterval = window.setInterval(async () => {
          await this._handleVariableUpdate('chat');
        }, CHAT_POLLING_INTERVAL);
      } catch (error) {
        console.error('[VariableManager]: Error starting chat variable polling:', error);
        this._chatPollingInterval = null;
      }
    }
  }

  /**
   * Stop chat variable polling
   * @private
   */
  private _stopChatPolling(): void {
    if (this._chatPollingInterval !== null) {
      try {
        window.clearInterval(this._chatPollingInterval);
        this._chatPollingInterval = null;
      } catch (error) {
        console.error('[VariableManager]: Error stopping chat variable polling:', error);
      }
    }
  }

  /**
   * Unified variable update handler
   * Works for all variable types (global/character/chat/message)
   * @param type Variable type
   * @param data Optional event data (provided for character vars)
   * @private
   */
  private async _handleVariableUpdate(type: VariableType, data?: any): Promise<void> {
    // Skip if type mismatch, switching types, or internal operation
    if (!this.currentType || this.currentType !== type || this._isTypeChanging || this.model.isInternalOperation()) {
      // Add more detailed logs, especially for chat polling
      if (type === 'chat' && this.model.isInternalOperation()) {
        console.debug(`[VariableSyncService] Ignoring chat variable polling updates: currently an internal operation`);
      }
      return;
    }

    try {
      // Clean expired records if chat polling
      if (type === 'chat') {
        this._cleanupProcessedRecords();
      }

      // Get latest variables
      // Character/message events provide data directly
      let currentVariables: Record<string, any>;
      if ((type === 'character' || type === 'message') && data && data.variables) {
        currentVariables = data.variables;
      } else {
        // Other types use getVariables
        currentVariables = getVariables({ type });
      }

      const fullCache = variableCache || {};
      const cachedVariables = fullCache[type] || {};

      // Compare variables and update DOM
      const { added, removed, updated } = this._compareVariableRecords(cachedVariables, currentVariables);

      // Special handling for chat variables
      if (type === 'chat' && Object.keys(added).length > 0) {
        // Filter out existing/recently processed variables
        const filteredAdded: Record<string, any> = {};

        for (const [name, value] of Object.entries(added)) {
          // Check if variable was recently processed
          if (this.wasRecentlyProcessed(name)) {
            console.debug(`[VariableSyncService] Chat variable polling: Variable "${name}" has just been processed, skipping adding`);
            continue;
          }

          // Check if variable card exists in DOM
          const existingCard = $(`.variable-card[data-name="${name}"]`);
          if (existingCard.length === 0) {
            filteredAdded[name] = value;
          } else {
            console.debug(`[VariableSyncService] Chat variable polling: Variable "${name}" already exists in DOM, skipping duplicate addition`);
          }
        }

        // Use filtered add list
        Object.entries(filteredAdded).forEach(([name, value]) => {
          this.domUpdater.addVariableCard(name, value);
        });
      } else {
      // Normal handling for other types
      // Handle additions
        Object.entries(added).forEach(([name, value]) => {
          this.domUpdater.addVariableCard(name, value);
        });
      }

      // Handle removals
      removed.forEach(name => {
        this.domUpdater.removeVariableCard(name);
      });

      // Handle updates, skipping recently processed chat vars
      if (type === 'chat' && Object.keys(updated).length > 0) {
        Object.entries(updated).forEach(([name, value]) => {
          // Check if variable was recently processed
          if (this.wasRecentlyProcessed(name)) {
            console.debug(`[VariableSyncService] Chat variable polling: Variable "${name}" has just been processed, skipping update`);
            return;
          }

          this.domUpdater.updateVariableCard(name, value);
        });
      } else {
        // Normal update handling for other types
        Object.entries(updated).forEach(([name, value]) => {
          this.domUpdater.updateVariableCard(name, value);
        });
      }

      // Update cache
      fullCache[type] = _.cloneDeep(currentVariables);
      variableCache = fullCache;
    } catch (error) {
      console.error(`[VariableManager]: Error processing ${type} variable update:`, error);
    }
  }

  /**
   * Compare cached vs current variable records
   * @param cached - Cached variables (Record<string, any>)
   * @param current - Current variables (Record<string, any>)
   * @returns Object with added(Record), removed(string[]), updated(Record) vars
   */
  private _compareVariableRecords(
    cached: Record<string, any>,
    current: Record<string, any>,
  ): { added: Record<string, any>; removed: string[]; updated: Record<string, any> } {
    const added: Record<string, any> = {};
    const removed: string[] = [];
    const updated: Record<string, any> = {};

    const cachedKeys = new Set(Object.keys(cached));
    const currentKeys = new Set(Object.keys(current));

    // Check for removed variables
    for (const key of cachedKeys) {
      if (!currentKeys.has(key)) {
        removed.push(key);
      }
    }

    // Check for added/updated variables
    for (const key of currentKeys) {
      if (!cachedKeys.has(key)) {
        // New variable
        if (this.currentType === 'chat') {
          // For chat vars, check if recently processed
          if (!this.wasRecentlyProcessed(key)) {
            // Check DOM existence (fallback for edge cases)
            const existingCard = $(`.variable-card[data-name="${key}"]`);
            if (existingCard.length === 0) {
              added[key] = _.cloneDeep(current[key]);
            }
          }
        } else {
          // Normal handling for other types
          added[key] = _.cloneDeep(current[key]);
        }
      } else if (!_.isEqual(current[key], cached[key])) {
        // Handle updates
        if (this.currentType === 'chat') {
          // For chat vars, only mark update if not recently processed
          if (!this.wasRecentlyProcessed(key)) {
            updated[key] = _.cloneDeep(current[key]);
          }
        } else {
          // Normal handling for other types
          updated[key] = _.cloneDeep(current[key]);
        }
      }
    }

    return { added, removed, updated };
  }
}
