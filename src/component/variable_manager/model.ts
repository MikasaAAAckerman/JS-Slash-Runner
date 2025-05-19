import { VariableDataType, VariableItem, VariableType } from '@/component/variable_manager/types';
import { getLastMessageId } from '@/function/util';
import {
  deleteVariable,
  getVariables,
  insertOrAssignVariables,
  replaceVariables,
  updateVariablesWith,
} from '@/function/variables';

export class VariableModel {
  private currentVariables: Record<string, any> = {};

  private activeVariableType: VariableType = 'global';

  private filterState: Record<VariableDataType, boolean> = {
    string: true,
    array: true,
    boolean: true,
    number: true,
    object: true,
  };

  private searchKeyword: string = '';

  private floorMinRange: number | null = null;
  private floorMaxRange: number | null = null;

  /**
   * Variable loading state flag
   * @private
   */
  private _isLoading: boolean = false;

  /**
   * Variable loading debounce timer
   * @private
   */
  private _loadDebounceTimeout: number | null = null;

  /**
   * Variable loading request ID for canceling outdated requests
   * @private
   */
  private _loadRequestId: number = 0;

  /**
   * Operation source flag
   * Marks if current operation is internal (UI triggered)
   * Prevents sync service from duplicate processing internal events
   * @private
   */
  private _isInternalOperation: boolean = false;

  /**
   * Operation counter
   * Handles nested operations, ensures flag reset only after outermost operation
   * @private
   */
  private _internalOperationCount: number = 0;

  constructor() {}

  /**
   * Get if variables are currently loading
   */
  public get isLoading(): boolean {
    return this._isLoading;
  }

  /**
   * Mark start of internal operation
   * Allows sync service to identify and ignore events from internal operations
   */
  public beginInternalOperation(): void {
    this._internalOperationCount++;
    this._isInternalOperation = true;
  }

  /**
   * Mark end of internal operation
   * Only resets flag when all nested operations complete
   */
  public endInternalOperation(): void {
    this._internalOperationCount = Math.max(0, this._internalOperationCount - 1);

    if (this._internalOperationCount === 0) {
      this._isInternalOperation = false;
    }
  }

  /**
   * Check if current operation is internal
   * @returns Whether operation is internal
   */
  public isInternalOperation(): boolean {
    return this._isInternalOperation;
  }

  /**
   * Force reset internal operation state
   * Used for recovery in exceptional cases
   */
  public resetInternalOperationState(): void {
    this._internalOperationCount = 0;
    this._isInternalOperation = false;
  }

  /**
   * Load variables of specified type
   * @param type Variable type (global/character/chat/message)
   * @param preloadedVariables Preloaded variable data to use directly if provided
   * @returns Promise<boolean> Whether load completed successfully
   */
  public async loadVariables(type: VariableType, preloadedVariables?: Record<string, any>): Promise<boolean> {
    // Don't reload if type hasn't changed
    if (this.activeVariableType === type && Object.keys(this.currentVariables).length > 0) {
      return true;
    }

    // Cancel previous debounce timer
    if (this._loadDebounceTimeout !== null) {
      window.clearTimeout(this._loadDebounceTimeout);
      this._loadDebounceTimeout = null;
    }

    // Generate new request ID
    const requestId = ++this._loadRequestId;

    // Return promise that executes actual load after debounce
    return new Promise<boolean>(resolve => {
      this._loadDebounceTimeout = window.setTimeout(async () => {
        // Cancel if current request is outdated
        if (requestId !== this._loadRequestId) {
          resolve(false);
          return;
        }

        // Set loading state
        this._isLoading = true;

        try {
          this.activeVariableType = type;

          if (type === 'message') {
            const [currentMinFloor, currentMaxFloor] = this.getFloorRange();
            const hasExistingRange = currentMinFloor !== null && currentMaxFloor !== null;

            if (!hasExistingRange) {
              const lastMessageId = getLastMessageId();

              const newMinFloor = Math.max(0, lastMessageId - 4);
              const newMaxFloor = lastMessageId;

              this.updateFloorRange(newMinFloor, newMaxFloor);
            }

            this.currentVariables = {};

            if (hasExistingRange || (currentMinFloor !== null && currentMaxFloor !== null)) {
              const minFloor = currentMinFloor!;
              const maxFloor = currentMaxFloor!;

              for (let floor = minFloor; floor <= maxFloor; floor++) {
                const floorVars = this.getFloorVariables(floor);
                const floorVarCount = Object.keys(floorVars).length;

                if (floorVarCount > 0) {
                  Object.assign(this.currentVariables, floorVars);
                }
              }
            }
          } else if (preloadedVariables) {
            // Use preloaded variables if provided
            this.currentVariables = preloadedVariables;
          } else {
            // Otherwise fetch variables fresh
            this.currentVariables = getVariables({ type });
          }

          resolve(true);
        } catch (error) {
          console.error(`[VariableModel] Failed to load ${type} variable:`, error);
          resolve(false);
        } finally {
          this._isLoading = false;
          this._loadDebounceTimeout = null;
        }
      }, 50); // 50ms anti-shake delay
    });
  }

  /**
   * Get all currently loaded variables
   * @returns Current variables
   */
  public getCurrentVariables(): Record<string, any> {
    return this.currentVariables;
  }

  /**
   * Get currently active variable type
   * @returns Variable type
   */
  public getActiveVariableType(): VariableType {
    return this.activeVariableType;
  }

  /**
   * Get value of specific variable
   * @param name Variable name
   * @returns Variable value
   */
  public getVariableValue(name: string): any {
    return this.currentVariables[name];
  }

  /**
   * Save variable data
   * @param type Variable type (global/character/chat/message)
   * @param name Variable name
   * @param value Variable value
   * @param message_id Message ID (only for message type)
   */
  public async saveVariableData(type: VariableType, name: string, value: any, message_id?: number): Promise<void> {
    if (type === this.activeVariableType) {
      this.currentVariables[name] = value;
    }

    if (type === 'message' && message_id !== undefined) {
      await updateVariablesWith(data => ({ ...data, [name]: value }), { type, message_id });
    } else {
      await updateVariablesWith(data => ({ ...data, [name]: value }), { type });
    }
  }

  /**
   * Delete variable
   * @param type Variable type (global/character/chat/message)
   * @param name Variable name
   * @param message_id Message ID (only for message type)
   */
  public async deleteVariableData(type: VariableType, name: string, message_id?: number): Promise<void> {
    if (type === this.activeVariableType && this.currentVariables[name]) {
      delete this.currentVariables[name];
    }

    if (type === 'message' && message_id !== undefined) {
      await deleteVariable(name, { type, message_id });
    } else {
      await deleteVariable(name, { type });
    }
  }

  /**
   * Rename variable (done in single transaction)
   * @param type Variable type (global/character/chat/message)
   * @param oldName Old variable name
   * @param newName New variable name
   * @param value Variable value
   */
  public async renameVariable(type: VariableType, oldName: string, newName: string, value: any): Promise<void> {
    await updateVariablesWith(
      variables => {
        _.set(variables, newName, value);
        _.unset(variables, oldName);
        return variables;
      },
      { type },
    );

    if (type === this.activeVariableType) {
      this.currentVariables[newName] = value;
      delete this.currentVariables[oldName];
    }
  }

  /**
   * Update list variable order
   * @param type Variable type (global/character/chat/message)
   * @param name Variable name
   * @param items New list order
   */
  public async updateListOrder(type: VariableType, name: string, items: string[]): Promise<void> {
    if (type === this.activeVariableType && this.currentVariables[name] && Array.isArray(this.currentVariables[name])) {
      this.currentVariables[name] = items;
      await insertOrAssignVariables({ [name]: items }, { type });
    }
  }

  /**
   * Clear all variables
   * @param type Variable type (global/character/chat/message)
   */
  public async clearAllVariables(type: VariableType): Promise<void> {
    if (type === this.activeVariableType) {
      this.currentVariables = {};
    }

      // Message type variables need floor-by-floor clearing
    if (type === 'message') {
      const [minFloor, maxFloor] = this.getFloorRange();

      // Skip if no valid floor range set
      if (minFloor === null || maxFloor === null) {
        console.warn('[VariableModel] Failed to clear message variable: No valid floor range is set');
        return;
      }

      // Clear variables floor by floor
      for (let floor = minFloor; floor <= maxFloor; floor++) {
        try {
          await replaceVariables({}, { type: 'message', message_id: floor });
        } catch (error) {
          console.error(`[VariableModel] Failed to clear variables at level ${floor}:`, error);
        }
      }
    } else {
      // Other types replace with empty object directly
      await replaceVariables({}, { type });
    }
  }

  /**
   * Update filter state
   * @param type Data type
   * @param checked Whether checked
   */
  public updateFilterState(type: VariableDataType, checked: boolean): void {
    this.filterState[type] = checked;
  }

  /**
   * Get filter state
   * @returns Filter state
   */
  public getFilterState(): Record<VariableDataType, boolean> {
    return this.filterState;
  }

  /**
   * Update search keyword
   * @param keyword Search keyword
   */
  public updateSearchKeyword(keyword: string): void {
    this.searchKeyword = keyword;
  }

  /**
   * Get search keyword
   * @returns Search keyword
   */
  public getSearchKeyword(): string {
    return this.searchKeyword;
  }

  /**
   * Update floor range filter
   * @param min Minimum floor
   * @param max Maximum floor
   */
  public updateFloorRange(min: number | null, max: number | null): void {
    if (min !== null) {
      min = Math.max(0, min);
    }

    this.floorMinRange = min;
    this.floorMaxRange = max;
  }

  /**
   * Get current floor range filter
   * @returns Current floor range [min, max]
   */
  public getFloorRange(): [number | null, number | null] {
    return [this.floorMinRange, this.floorMaxRange];
  }

  /**
   * Get variable data for specific floor
   * @param messageId Message ID
   * @returns Floor variable data object
   */
  public getFloorVariables(messageId: number): Record<string, any> {
    try {
      const variables = getVariables({ type: 'message', message_id: messageId });
      return variables || {};
    } catch (error) {
      console.error(`Failed to get the ${messageId} layer variable:`, error);
      return {};
    }
  }

  /**
   * Convert variables to UI display format
   * @returns Formatted variable list for UI display
   */
  public formatVariablesForUI(): VariableItem[] {
    const result: VariableItem[] = [];

    for (const name in this.currentVariables) {
      const value = this.currentVariables[name];
      let type: VariableDataType = 'string';
      let formattedValue = value;

      if (Array.isArray(value)) {
        type = 'array';
      } else if (value === null) {
        type = 'string';
        formattedValue = 'null';
      } else if (value === undefined) {
        type = 'string';
        formattedValue = 'undefined';
      } else if (typeof value === 'boolean') {
        type = 'boolean';
      } else if (typeof value === 'number') {
        type = 'number';
      } else if (typeof value === 'object') {
        type = 'object';
      } else if (typeof value === 'string') {
        type = 'string';
      }

      result.push({
        name,
        type,
        value: formattedValue,
      });
    }

    return result;
  }

  /**
   * Filter variable list
   * @param operationId Operation ID (for logging)
   * @returns Filtered variable list
   */
  public filterVariables(): VariableItem[] {
    const initialVariables = this.formatVariablesForUI();

    if (Object.values(this.filterState).every(value => value === true) && !this.searchKeyword) {
      return initialVariables;
    }

    const filteredVariables = initialVariables.filter(variable => {
      const typeFilterPassed = this.filterState[variable.type];
      if (!typeFilterPassed) return false;

      if (this.searchKeyword) {
        const keyword = this.searchKeyword.toLowerCase();
        const nameMatch = variable.name.toLowerCase().includes(keyword);

        let valueMatch = false;
        if (['string', 'number', 'boolean'].includes(variable.type)) {
          const valueStr = String(variable.value).toLowerCase();
          valueMatch = valueStr.includes(keyword);
        }

        return nameMatch || valueMatch;
      }

      return true;
    });

    return filteredVariables;
  }

  /**
   * Force refresh current variable data
   * @returns Whether refresh succeeded
   */
  public forceRefreshVariables(): boolean {
    try {
      if (this.activeVariableType !== 'message') {
        const latestVariables = getVariables({ type: this.activeVariableType });
        this.currentVariables = { ...latestVariables };
      }
      return true;
    } catch (error) {
      console.error(`[VariableModel] Forced refresh of variables failed:`, error);
      return false;
    }
  }
}
