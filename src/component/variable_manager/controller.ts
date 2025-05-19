import { VariableModel } from '@/component/variable_manager/model';
import { VariableSyncService } from '@/component/variable_manager/sync';
import { VariableDataType, VariableType } from '@/component/variable_manager/types';
import { VariableView } from '@/component/variable_manager/view';

export class VariableController {
  /**
   * Variable data model
   */
  private model: VariableModel;

  /**
   * Variable view
   */
  private view: VariableView;

  /**
   * Variable sync service
   */
  private syncService: VariableSyncService;

  /**
   * Constructor
   * @param model Data model
   * @param view View component
   * @param syncService Sync service
   */
  constructor(model: VariableModel, view: VariableView, syncService: VariableSyncService) {
    this.model = model;
    this.view = view;
    this.syncService = syncService;
  }

  /**
   * Initialize controller
   * @param container UI container
   */
  public async init(container: JQuery<HTMLElement>): Promise<void> {
    this.view.initUI();
    this.bindEvents(container);

    try {
      // Ensure internal operation flag is set during preloading
      this.model.beginInternalOperation();
      const preloadedVariables = await this.syncService.setCurrentType('global');
      this.syncService.activateListeners();
      await this.loadVariables('global', preloadedVariables);
    } finally {
      this.model.endInternalOperation();
    }
  }

  /**
   * Bind UI events
   * @param container UI container
   */
  private bindEvents(container: JQuery<HTMLElement>): void {
    container.find('.tab-item').on('click', this.handleTabChange.bind(this));
    container.on('click', '.add-list-item', this.handleAddListItem.bind(this));
    container.on('click', '.list-item-delete', this.handleDeleteListItem.bind(this));
    container.on('click', '.delete-btn', this.handleDeleteVariableCard.bind(this));
    container.on('click', '.save-btn', this.handleSaveVariableCard.bind(this));
    container.on('click', '#add-variable', this.handleAddVariable.bind(this));
    container.on('click', '#clear-all', this.handleClearAll.bind(this));
    container.on('click', '#filter-icon', this.handleFilterIconClick.bind(this));
    container.on('change', '.filter-checkbox', this.handleFilterOptionChange.bind(this));
    container.on('input', '#variable-search', this.handleVariableSearch.bind(this));
    container.on('click', '#floor-filter-btn', this.handleFloorRangeFilter.bind(this));
  }

  /**
   * Load variables
   * @param type Variable type
   * @param preloadedVariables Preloaded variable data
   */
  public async loadVariables(type: VariableType, preloadedVariables?: Record<string, any>): Promise<void> {
    // Ignore duplicate requests if already loading
    if (this.model.isLoading) {
      console.log(`[VariableController] Ignore duplicate ${type} variable loading requests`);
      return;
    }

    const isListeningActive = this.syncService['_listenersActive'];
    if (isListeningActive) {
      this.syncService.deactivateListeners();
    }

    try {
      this.model.beginInternalOperation();

      // Load variable data
      const loadSuccess = await this.model.loadVariables(type, preloadedVariables);

      if (!loadSuccess) {
        console.warn(`[VariableController] ${type} variable loading was not completed or was canceled`);
        return;
      }

      // Update UI configurations
      if (type === 'message') {
        this.view.getContainer().find('#floor-filter-container').show();
        const [minFloor, maxFloor] = this.model.getFloorRange();
        this.view.updateFloorRangeInputs(minFloor, maxFloor);
      } else {
        this.view.getContainer().find('#floor-filter-container').hide();
      }

      // Refresh variable cards display
      this.refreshVariableCards();
    } finally {
      this.model.endInternalOperation();

      if (isListeningActive) {
        this.syncService.activateListeners();
      }
    }
  }

  /**
   * Force refresh active variables
   */
  public forceRefresh(): void {
    try {
      this.model.beginInternalOperation();
      this.model.forceRefreshVariables();
      this.refreshVariableCards();
    } catch (error) {
      console.error(`[VariableManager] Forced refresh of variable data failed:`, error);
    } finally {
      this.model.endInternalOperation();
    }
  }

  /**
   * Refresh variable cards
   */
  private refreshVariableCards(): void {
    const type = this.model.getActiveVariableType();

    try {
      const filteredVariables = this.model.filterVariables();
      this.view.refreshVariableCards(type, filteredVariables);
    } catch (error) {
      console.error(`[VariableManager] Failed to refresh variable card:`, error);
    }
  }

  /**
   * Handle tab change
   * @param event Click event
   */
  private async handleTabChange(event: JQuery.ClickEvent): Promise<void> {
    const target = $(event.currentTarget);
    const tabId = target.attr('id');

    if (!tabId) return;

    const type = tabId.replace('-tab', '') as VariableType;
    const currentType = this.model.getActiveVariableType();

    if (type === currentType) return;

    // First update UI tab state
    this.view.setActiveTab(type);

    // Deactivate current listeners
    this.syncService.deactivateListeners();

    // Set new variable type and get preloaded variables
    const preloadedVariables = await this.syncService.setCurrentType(type);

    // Load new variable type (using preloaded vars to avoid duplicate fetching)
    await this.loadVariables(type, preloadedVariables);

    // Activate new type listeners
    this.syncService.activateListeners();
  }

  /**
   * Handle add list item
   * @param event Click event
   */
  private handleAddListItem(event: JQuery.ClickEvent): void {
    const button = $(event.currentTarget);
    const listContainer = button.siblings('.list-items-container');

    const newItem = $(`
      <div class="list-item">
        <span class="drag-handle">☰</span>
        <textarea class="variable-content-input" placeholder="Enter variable content"></textarea>
        <button class="list-item-delete"><i class="fa-solid fa-times"></i></button>
      </div>
    `);

    listContainer.append(newItem);
    newItem.find('textarea').focus();
  }

  /**
   * Handle delete list item
   * @param event Click event
   */
  private handleDeleteListItem(event: JQuery.ClickEvent): void {
    const button = $(event.currentTarget);
    const listItem = button.closest('.list-item');

    // Add delete animation
    listItem.css({
      'background-color': 'rgba(255, 0, 0, 0.2)',
      transition: 'all 0.3s ease',
    });

    // Apply transform effect
    setTimeout(() => {
      listItem.css({
        transform: 'scale(0.9)',
        opacity: '0.7',
      });

      // Remove element after fade out
      setTimeout(() => {
        listItem.remove();
      }, 200);
    }, 50);
  }

  /**
   * Handle delete variable card
   * @param event Click event
   */
  private handleDeleteVariableCard(event: JQuery.ClickEvent): void {
    const button = $(event.currentTarget);
    const card = button.closest('.variable-card');
    const name = this.view.getVariableCardName(card);
    const type = this.model.getActiveVariableType();

    // Get floor info (if in floor panel)
    let floorId: number | undefined = undefined;
    if (type === 'message') {
      const floorPanel = card.closest('.floor-panel');
      if (floorPanel.length > 0) {
        floorId = parseInt(floorPanel.attr('data-floor') || '', 10);
        if (isNaN(floorId)) {
          floorId = undefined;
        }
      }
    }

    this.view.showConfirmDialog(`Are you sure you want to delete the variable "${name}"?`, async confirmed => {
      if (confirmed) {
        try {
          this.model.beginInternalOperation();
          await this.model.deleteVariableData(type, name, floorId);

          // No longer handle DOM operations directly, but through the removeVariableCard method
          this.view.removeVariableCard(name);
        } catch (error) {
          console.error(`[VariableManager] Failed to delete variable:`, error);
        } finally {
          this.model.endInternalOperation();
        }
      }
    });
  }

  /**
   * Handle add variable
   */
  private async handleAddVariable(): Promise<void> {
    const type = this.model.getActiveVariableType();

    this.view.showAddVariableDialog((dataType, floorId) => {
      try {
        this.model.beginInternalOperation();
        // Pass floorId parameter to createNewVariableCard
        this.view.createNewVariableCard(type, dataType, floorId);
      } finally {
        this.model.endInternalOperation();
      }
    });
  }

  /**
   * Handle save variable card
   * @param event Click event
   */
  private async handleSaveVariableCard(event: JQuery.ClickEvent): Promise<void> {
    const button = $(event.currentTarget);
    const card = button.closest('.variable-card');
    const oldName = card.attr('data-original-name') || '';
    const newName = this.view.getVariableCardName(card);
    const type = this.model.getActiveVariableType();
    const value = this.view.getVariableCardValue(card);
    const isNewCard = card.attr('data-status') === 'new';

    // Get floor ID (for message type)
    const floorId = type === 'message' ? parseInt(card.attr('data-floor') || '-1', 10) : undefined;

    if (!newName || newName.trim() === '') {
      toastr.error('Variable name cannot be empty');
      return;
    }

    try {
      this.model.beginInternalOperation();

      if (isNewCard) {
        // For new cards, just check if name conflicts
        if (this.model.getVariableValue(newName) !== undefined) {
          toastr.error(`Variable name "${newName}" already exists, please use another name`);
          return;
        }

        // Save new variable (pass message_id based on type)
        if (type === 'message' && floorId !== undefined && floorId >= 0) {
          await this.model.saveVariableData(type, newName, value, floorId);
        } else {
          await this.model.saveVariableData(type, newName, value);
        }

        // Update card state
        card.removeAttr('data-status');
        card.attr('data-original-name', newName);
        card.attr('data-name', newName);

        // Use animation instead of toast notification
        card.addClass('variable-added');
        setTimeout(() => {
          card.removeClass('variable-added');
        }, 1500);

        // For chat vars, add to recent processing to prevent duplicate handling
        if (type === 'chat') {
          this.syncService.markVariableAsProcessed(newName);
        }
      } else if (oldName !== newName) {
        // Variable rename
        if (this.model.getVariableValue(newName) !== undefined) {
          toastr.error(`Variable name "${newName}" already exists, please use another name`);
          return;
        }

        // Rename variables
        await this.model.renameVariable(type, oldName, newName, value);

        // Update card attributes
        card.attr('data-original-name', newName);
        card.attr('data-name', newName);

        // Use animation effects instead of toast notifications
        card.addClass('variable-changed');
        setTimeout(() => {
          card.removeClass('variable-changed');
        }, 1500);

        // For chat vars, add to recent processing
        if (type === 'chat') {
          // Remove the record with the old name (if it exists) and add the record with the new name
          this.syncService.markVariableAsProcessed(newName);
        }
      } else {
        // Only update value
        await this.model.saveVariableData(type, newName, value);

        // Use animation effects instead of toast notifications
        card.addClass('variable-changed');
        setTimeout(() => {
          card.removeClass('variable-changed');
        }, 1500);

        // For chat variables, add it to the most recent transaction record
        if (type === 'chat') {
          this.syncService.markVariableAsProcessed(newName);
        }
      }

        // Ensure internal operation flag ends after animations complete
        // Gives polling more time to recognize as internal operation
      if (type === 'chat') {
        setTimeout(() => {
          this.model.endInternalOperation();
        }, 2100); // Slightly longer than the animation time and polling interval
      } else {
        this.model.endInternalOperation();
      }
    } catch (error: any) {
      console.error(`[VariableManager] Failed to save variables:`, error);
      toastr.error(`Error saving variables: ${error.message || 'Unknown error'}`);
      this.model.endInternalOperation();
    }
  }

  /**
   * Handle clear all variables
   */
  private async handleClearAll(): Promise<void> {
    const type = this.model.getActiveVariableType();

    this.view.showConfirmDialog(
      `Are you sure you want to clear all ${this.getVariableTypeName(type)} variables? This operation cannot be undone. `,
      async confirmed => {
        if (confirmed) {
          try {
            this.model.beginInternalOperation();
            await this.model.clearAllVariables(type);

            // Get containers
            const container = this.view.getContainer().find(`#${type}-content .variables-container`);
            const floorContainer = this.view.getContainer().find(`#${type}-content .floor-variables-container`);

            // First add fade out effect
            container.css({
              transition: 'all 0.5s ease',
              opacity: '0.2',
            });
            floorContainer.css({
              transition: 'all 0.5s ease',
              opacity: '0.2',
            });

            // After animation, use refresh mechanism instead of direct DOM clearing
            setTimeout(() => {
              // Use the existing refresh mechanism to ensure UI and data consistency
              this.refreshVariableCards();

              // Restore container opacity
              container.css({ opacity: '1' });
              floorContainer.css({ opacity: '1' });

              // Keep success notification for global operation
              toastr.success(`All ${this.getVariableTypeName(type)} variables have been cleared`);
            }, 500);
          } catch (error: any) {
            console.error(`[VariableManager] Failed to clear ${type} variable:`, error);
            toastr.error(`Error in clearing ${this.getVariableTypeName(type)} variable: ${error.message || 'Unknown error'}`);
          } finally {
            this.model.endInternalOperation();
          }
        }
      },
    );
  }

  /**
   * Handle filter icon click
   */
  private handleFilterIconClick(): void {
    const $filterOptions = this.view.getContainer().find('.filter-options');
    $filterOptions.toggle();
  }

  /**
   * Handle filter option change
   * @param event Change event
   */
  private handleFilterOptionChange(event: JQuery.ChangeEvent): void {
    const $checkbox = $(event.currentTarget);
    const type = $checkbox.data('type') as VariableDataType;
    const isChecked = $checkbox.is(':checked');

    this.model.updateFilterState(type, isChecked);
    this.refreshVariableCards();
  }

  /**
   * Handle variable search
   * @param event Input event
   */
  private handleVariableSearch(event: JQuery.TriggeredEvent): void {
    const keyword = $(event.currentTarget).val() as string;
    this.model.updateSearchKeyword(keyword);
    this.refreshVariableCards();
  }

  /**
   * Handle floor range filter
   */
  private handleFloorRangeFilter(): void {
    const $minInput = this.view.getContainer().find('#floor-min');
    const $maxInput = this.view.getContainer().find('#floor-max');

    const minVal = $minInput.val() as string;
    const maxVal = $maxInput.val() as string;

    const min = minVal ? parseInt(minVal) : null;
    const max = maxVal ? parseInt(maxVal) : null;

    if ((min !== null && isNaN(min)) || (max !== null && isNaN(max))) {
      this.view.showFloorFilterError('Please enter a valid number');
      return;
    }

    if (min !== null && max !== null && min > max) {
      this.view.showFloorFilterError('The minimum value cannot be greater than the maximum value');
      return;
    }

    this.view.hideFloorFilterError();

    if (min !== null || max !== null) {
      this.applyFloorRangeAndReload(min || 0, max === null ? Infinity : max);
    }
  }

  /**
   * Apply floor range and reload variables
   * @param min Minimum floor
   * @param max Maximum floor
   */
  private async applyFloorRangeAndReload(min: number, max: number): Promise<void> {
    try {
      this.model.beginInternalOperation();

      // Update floor range in model
      this.model.updateFloorRange(min, max);

      // Update input display values
      this.view.updateFloorRangeInputs(min, max);

      // Reload message variables
      await this.loadVariables('message');
    } catch (error: any) {
      console.error(`[VariableManager] Failed to apply floor scope and reload variables:`, error);
    } finally {
      this.model.endInternalOperation();
    }
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    try {
      this.model.resetInternalOperationState();

      this.syncService.cleanup();
    } catch (error) {
      console.error(`[VariableManager] Failed to clean up resources:`, error);
    }
  }

  /**
   * Get variable type display name
   * @param type Variable type
   * @returns Display name
   */
  private getVariableTypeName(type: VariableType): string {
    switch (type) {
      case 'global':
        return '全局';
      case 'character':
        return '角色';
      case 'chat':
        return '聊天';
      case 'message':
        return '消息';
      default:
        return type;
    }
  }
}
