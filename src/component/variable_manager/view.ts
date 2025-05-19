import { POPUP_TYPE, callGenericPopup } from '@sillytavern/scripts/popup';
import { getSortableDelay } from '@sillytavern/scripts/utils';
import { isMobile } from '@sillytavern/scripts/RossAscends-mods';

import { VariableCardFactory } from '@/component/variable_manager/card';
import { IDomUpdater } from '@/component/variable_manager/sync';
import { VariableDataType, VariableItem, VariableType } from '@/component/variable_manager/types';
import { getLastMessageId } from '@/function/util';

export interface IController {
  cleanup(): void;
}

export class VariableView implements IDomUpdater {
  /**
   * Minimum dialog width (pixels)
   */
  private static readonly MIN_DIALOG_WIDTH = 300;

  /**
   * Minimum dialog height (pixels)
   */
  private static readonly MIN_DIALOG_HEIGHT = 250;

  /**
   * UI container
   */
  private container: JQuery<HTMLElement>;

  /**
   * Variable cards
   */
  private cardFactory: VariableCardFactory;

  /**
   * Dialog element
   */
  private dialog: JQuery<HTMLElement> | null = null;

  /**
   * Controller reference
   */
  private controller: IController | null = null;

  /**
   * Flag to skip animations
   */
  private _skipAnimation: boolean = false;

  /**
   * Latest render request ID for tracking/canceling old requests
   */
  private _lastRenderRequestId: number = 0;

  /**
   * Constructor
   * @param container Variable manager container
   */
  constructor(container: JQuery<HTMLElement>) {
    this.container = container;
    this.cardFactory = new VariableCardFactory();
  }

  /**
   * Set controller reference
   * @param controller Variable controller
   */
  public setController(controller: IController): void {
    this.controller = controller;
  }

  /**
   * Initialize UI
   */
  public initUI(): void {
    this.container.find('#global-tab').addClass('active');
    this.container.find('#global-content').addClass('active');

    // Hide floor filter controls by default (only shown for message tab)
    this.container.find('#floor-filter-container').hide();

    this.initSortable();
    this.initFloorFilter();
  }

  /**
   * Initialize sortable functionality
   */
  private initSortable(): void {
    this.container.find('.list-items-container').sortable({
      delay: getSortableDelay(),
      handle: '.drag-handle',
      stop: function (_event, ui) {
        const listContainer = $(ui.item).closest('.list-items-container');

        const items: string[] = [];
        listContainer.find('.variable-content-input').each(function () {
          items.push($(this).val() as string);
        });

        const processedItems = _.uniqBy(items, item => item.trim().toLowerCase());

        if (!_.isEqual(items, processedItems)) {
          listContainer.empty();
          processedItems.forEach(item => {
            const itemHtml = `
              <div class="list-item">
                <span class="drag-handle">☰</span>
                <textarea class="variable-content-input">${item}</textarea>
                <button class="list-item-delete"><i class="fa-solid fa-times"></i></button>
              </div>
            `;
            listContainer.append(itemHtml);
          });
        }

        listContainer.trigger('sortupdate');
      },
    });
  }

  /**
   * Initialize floor filter functionality
   */
  private initFloorFilter(): void {
    this.container.find('#floor-filter-btn').on('click', () => {
      const minVal = parseInt(this.container.find('#floor-min').val() as string, 10);
      const maxVal = parseInt(this.container.find('#floor-max').val() as string, 10);

      if (isNaN(minVal) || isNaN(maxVal)) {
        this.showFloorFilterError('Please enter a valid floor value');
        return;
      }

      if (maxVal < minVal) {
        this.showFloorFilterError('The maximum floor cannot be less than the minimum floor');
        return;
      }

      this.hideFloorFilterError();
    });

    this.container.find('#floor-min, #floor-max').on('input', () => {
      const minVal = parseInt(this.container.find('#floor-min').val() as string, 10);
      const maxVal = parseInt(this.container.find('#floor-max').val() as string, 10);

      if (!isNaN(minVal) && !isNaN(maxVal) && maxVal < minVal) {
        this.showFloorFilterError('The maximum floor cannot be less than the minimum floor');
      } else {
        this.hideFloorFilterError();
      }
    });
  }

  /**
   * Get UI container
   * @returns UI container jQuery object
   */
  public getContainer(): JQuery<HTMLElement> {
    return this.container;
  }

  /**
   * Show floor filter error message
   * @param message Error message
   */
  public showFloorFilterError(message: string): void {
    const $errorEl = this.container.find('#floor-filter-error');
    $errorEl.text(message).show();
  }

  /**
   * Hide floor filter error message
   */
  public hideFloorFilterError(): void {
    this.container.find('#floor-filter-error').hide();
  }

  /**
   * Update floor filter input values
   * @param min Minimum floor value
   * @param max Maximum floor value
   */
  public updateFloorRangeInputs(min: number | null, max: number | null): void {
    this.container.find('#floor-min').val(min !== null ? min.toString() : '');
    this.container.find('#floor-max').val(max !== null ? max.toString() : '');
    this.hideFloorFilterError();
  }

  /**
   * Get or create variable list container
   * @param typeOrContent Variable type or found content element
   * @returns Variable list jQuery object
   */
  private getOrCreateVariableList(typeOrContent: VariableType | JQuery<HTMLElement>): JQuery<HTMLElement> {
    let $content: JQuery<HTMLElement>;

    if (typeof typeOrContent === 'string') {
      $content = this.container.find(`#${typeOrContent}-content`);
    } else {
      $content = typeOrContent;
    }
    const $variableList = $content.find('.variable-list');
    return $variableList;
  }

  /**
   * Get active variable type
   * @returns Active variable type
   */
  private getActiveVariableType(): VariableType {
    return (this.container.find('.tab-item.active').attr('id')?.replace('-tab', '') as VariableType) || 'chat';
  }

  /**
   * Create and append card to variable list
   * @param name Variable name
   * @param value Variable value
   * @param dataType Variable data type (inferred if not provided)
   * @param targetType Target variable type (uses active type if not provided)
   * @param targetContent Target content container (looked up by targetType if not provided)
   * @returns Created card jQuery object
   */
  private createAndAppendCard(
    name: string,
    value: any,
    dataType?: VariableDataType,
    targetType?: VariableType,
    targetContent?: JQuery<HTMLElement>,
  ): JQuery<HTMLElement> {
    if (!dataType) {
      dataType = this.cardFactory.inferDataType(value);
    }

    if (!targetType) {
      targetType = this.getActiveVariableType();
    }

    const $variableList = targetContent
      ? this.getOrCreateVariableList(targetContent)
      : this.getOrCreateVariableList(targetType);

    const $emptyState = $variableList.find('.empty-state');
    if ($emptyState.length > 0) {
      $emptyState.remove();
    }

    const newCard = this.cardFactory.createCard(dataType, name, value);
    this.cardFactory.setCardDataAttributes(newCard, name, value);

    $variableList.append(newCard);

    return newCard;
  }

  /**
   * Set active tab
   * @param type Variable type to activate
   */
  public setActiveTab(type: VariableType): void {
    this.container.find('.tab-item').removeClass('active');
    this.container.find('.tab-content').removeClass('active');

    this.container.find(`#${type}-tab`).addClass('active');
    this.container.find(`#${type}-content`).addClass('active');

    const $floorFilterContainer = this.container.find('#floor-filter-container');
    if (type === 'message') {
      $floorFilterContainer.show();
      const [minFloor, maxFloor] = (this.controller as any).model.getFloorRange();

      if (minFloor === null || maxFloor === null) {
        const lastMessageId = getLastMessageId();
        const newMinFloor = Math.max(0, lastMessageId - 4);
        const newMaxFloor = lastMessageId;
        (this.controller as any).model.updateFloorRange(newMinFloor, newMaxFloor);
      }
    } else {
      $floorFilterContainer.hide();
    }
  }

  /**
   * Refresh variable cards
   * @param type Variable type
   * @param variables Filtered variable list
   */
  public refreshVariableCards(type: VariableType, variables: VariableItem[]): void {
    // Generate a unique ID for each rendering request
    const operationId = Date.now();
    this._lastRenderRequestId = operationId;

    // Update label text
    this.container.find('.variable-type-label').text(`${type}variable`);

    // Get the content container of the current activity
    const activeContent = this.container.find(`#${type}-content`);
    const $variableList = this.getOrCreateVariableList(activeContent);

    // Save scroll position
    const scrollTop = $variableList.scrollTop() || 0;

    // Clear the variable list
    $variableList.empty();

    // If there is no variable, show empty state
    if (variables.length === 0) {
      $variableList.html('<div class="empty-state"><p>No variables yet</p></div>');
      return;
    }

    // Choose different rendering methods according to variable type
    if (type === 'message') {
      this.renderMessageVariablesByFloor($variableList, operationId)
        .then(result => {
          // If the current rendering request has expired or been canceled, no subsequent operations are performed
          if (this._lastRenderRequestId !== operationId || result.cancelled) {
            return;
          }

          // restore scroll position
          $variableList.scrollTop(scrollTop);
        })
        .catch(error => {
          console.error(`[VariableView] Floor variable rendering error:`, error);
        });
    } else {
      // Rendering a list of normal variables
      this.renderRegularVariables(variables, $variableList);

      // restore scroll position
      $variableList.scrollTop(scrollTop);
    }
  }

  /**
   * Render regular variable list (non-floor grouped)
   * @param variables Variable list
   * @param $container Container element
   */
  private renderRegularVariables(variables: VariableItem[], $container: JQuery<HTMLElement>): void {
    // Improving rendering performance using DocumentFragment
    const fragment = document.createDocumentFragment();

    variables.forEach(variable => {
      const card = this.createAndAppendCard(variable.name, variable.value, variable.type);
      fragment.appendChild(card[0]);
    });

    $container.append(fragment);
  }

  /**
   * Render message variables by floor
   * @param $container Container element
   * @param operationId Operation ID for logging
   * @returns Promise with render results including cancellation status
   */
  private async renderMessageVariablesByFloor(
    $container: JQuery<HTMLElement>,
    operationId: number = Date.now(),
  ): Promise<{ cancelled: boolean }> {
    try {
      if (this._lastRenderRequestId !== operationId) {
        return { cancelled: true };
      }

      const controller = this.controller as any;
      if (!controller || !controller.model) {
        throw new Error('Variable model not found');
      }

      const minFloor = parseInt(this.container.find('#floor-min').val() as string, 10);
      const maxFloor = parseInt(this.container.find('#floor-max').val() as string, 10);

      if (isNaN(minFloor) || isNaN(maxFloor)) {
        $container.html('<div class="empty-state"><p>Please set a valid floor range filter</p></div>');
        return { cancelled: false };
      }

      const scrollTop = $container.scrollTop() || 0;

      if (this._lastRenderRequestId !== operationId) {
        return { cancelled: true };
      }

      $container.empty();

      const floorIds: number[] = [];
      for (let id = maxFloor; id >= minFloor; id--) {
        floorIds.push(id);
      }

      if (floorIds.length === 0) {
        $container.html('<div class="empty-state"><p>No floors were found for the current filter criteria</p></div>');
        return { cancelled: false };
      }

      if (this._lastRenderRequestId !== operationId) {
        return { cancelled: true };
      }

      const filterState = controller.model.getFilterState();
      const searchKeyword = controller.model.getSearchKeyword();

      const floorVariablesMap = new Map<number, VariableItem[]>();
      for (const floorId of floorIds) {
        const floorVariables = await this.getFloorVariables(floorId);

        if (this._lastRenderRequestId !== operationId) {
          return { cancelled: true };
        }

        const filteredFloorVariables = floorVariables.filter(variable => {
          const typeFilterPassed = filterState[variable.type];
          if (!typeFilterPassed) return false;

          if (searchKeyword) {
            const keyword = searchKeyword.toLowerCase();
            const nameMatch = variable.name.toLowerCase().includes(keyword);

            let valueMatch = false;
            if (['string', 'text', 'number', 'boolean'].includes(variable.type)) {
              const valueStr = String(variable.value).toLowerCase();
              valueMatch = valueStr.includes(keyword);
            }

            return nameMatch || valueMatch;
          }

          return true;
        });

        floorVariablesMap.set(floorId, filteredFloorVariables);
      }

      const documentFragment = document.createDocumentFragment();
      const $fragmentContainer = $(documentFragment);

      let totalVariablesCount = 0;
      let visibleFloors = 0;
      const $panels: Record<number, JQuery<HTMLElement>> = {};

      for (const floorId of floorIds) {
        const floorVariables = floorVariablesMap.get(floorId) || [];

        if (!floorVariables || floorVariables.length === 0) {
          continue;
        }

        if (this._lastRenderRequestId !== operationId) {
          return { cancelled: true };
        }

        const $floorPanel = await this.createFloorPanel(floorId, false);
        $panels[floorId] = $floorPanel;

        const $panelBody = $floorPanel.find('.floor-panel-body');

        floorVariables.forEach(variable => {
          const card = this.cardFactory.createCard(variable.type, variable.name, variable.value);
          this.cardFactory.setCardDataAttributes(card, variable.name, variable.value);
          $panelBody.append(card);
        });

        $fragmentContainer.append($floorPanel);

        totalVariablesCount += floorVariables.length;
        visibleFloors++;
      }

      if (this._lastRenderRequestId !== operationId) {
        return { cancelled: true };
      }

      $container.append(documentFragment);

      if (Object.keys($panels).length > 0) {
        const maxVisibleFloorId = Math.max(...Object.keys($panels).map(Number));
        const $maxFloorPanel = $panels[maxVisibleFloorId];
        $maxFloorPanel.find('.floor-panel-icon').addClass('expanded');
        $maxFloorPanel.find('.floor-panel-body').addClass('expanded');
      }

      $container.scrollTop(scrollTop);

      if ($container.children().length === 0) {
        $container.html('<div class="empty-state"><p>No floor variables were found for the current filter criteria</p></div>');
      }

      return { cancelled: false };
    } catch (error: any) {
      console.error(`[VariableView] Failed to render floor variables:`, error);
      $container.html(`<div class="empty-state"><p>Error rendering variables: ${error.message}</p></div>`);
      return { cancelled: false };
    }
  }

  /**
   * Get variables for specified floor
   * @param floorId Floor ID
   * @returns Variable list for the floor
   */
  private async getFloorVariables(floorId: number): Promise<VariableItem[]> {
    try {
      const controller = this.controller as any;
      if (!controller || !controller.model) {
        throw new Error('Variable model not found');
      }

      if (typeof controller.model.getFloorVariables === 'function') {
        const floorVariables = controller.model.getFloorVariables(floorId);

        const result: VariableItem[] = [];
        for (const name in floorVariables) {
          const value = floorVariables[name];
          let type: VariableDataType = 'string';

          if (Array.isArray(value)) {
            type = 'array';
          } else if (typeof value === 'boolean') {
            type = 'boolean';
          } else if (typeof value === 'number') {
            type = 'number';
          } else if (typeof value === 'object' && value !== null) {
            type = 'object';
          }

          result.push({
            name,
            type,
            value,
          });
        }

        return result;
      }
      console.warn(`[VariableView] The model does not have a method to obtain the floor variable`);
      return [];
    } catch (error) {
      console.error(`[VariableView] Failed to get floor ${floorId} variable:`, error);
      return [];
    }
  }

  /**
   * Create floor collapsible panel
   * @param floor Floor number
   * @param isExpanded Whether to expand by default
   * @returns Collapsible panel jQuery object
   */
  private async createFloorPanel(floor: number, isExpanded: boolean): Promise<JQuery<HTMLElement>> {
    const titleContent = `# ${floor} 楼`;

    const $panel = $(`
      <div class="floor-panel" data-floor="${floor}">
        <div class="floor-panel-header flex spaceBetween alignItemsCenter">
          <div class="floor-panel-title">${titleContent}</div>
          <div class="floor-panel-icon ${isExpanded ? 'expanded' : ''}">
            <i class="fa-solid fa-chevron-down"></i>
          </div>
        </div>
        <div class="floor-panel-body ${isExpanded ? 'expanded' : ''}"></div>
      </div>
    `);

    $panel.find('.floor-panel-header').on('click', function () {
      const $this = $(this);
      const $icon = $this.find('.floor-panel-icon');
      const $body = $this.closest('.floor-panel').find('.floor-panel-body');

      $icon.toggleClass('expanded');
      $body.toggleClass('expanded');
    });

    return $panel;
  }

  /**
   * Create new variable card
   * @param type Variable type
   * @param dataType Variable data type
   * @param floorId Floor ID (only for message type)
   */
  public createNewVariableCard(type: VariableType, dataType: VariableDataType, floorId?: number): void {
    const $content = this.container.find(`#${type}-content`);
    $content.find('.empty-state').remove();

    let defaultValue: any;
    switch (dataType) {
      case 'array':
        defaultValue = [];
        break;
      case 'boolean':
        defaultValue = false;
        break;
      case 'number':
        defaultValue = 0;
        break;
      case 'object':
        defaultValue = {};
        break;
      case 'string':
        defaultValue = '';
        break;
      default:
        defaultValue = '';
    }

    const defaultName = 'new_variable';

    // Special handling of message type
    if (type === 'message' && floorId !== undefined) {
      // Find or create a floor panel
      const $floorPanel = $content.find(`.floor-panel[data-floor="${floorId}"]`);

      if ($floorPanel.length === 0) {
        // Creating a New Floor Panel
        this.createFloorPanel(floorId, true).then($panel => {
          $content.find('.variable-list').append($panel);

          // Create a card in a panel
          const $panelBody = $panel.find('.floor-panel-body');
          const newCard = this.cardFactory.createCard(dataType, defaultName, defaultValue);
          this.cardFactory.setCardDataAttributes(newCard, defaultName, defaultValue);

          // Add floor information for saving
          newCard.attr('data-floor', floorId.toString());
          newCard.attr('data-type', dataType);
          newCard.attr('data-status', 'new');

          $panelBody.append(newCard);
        });
      } else {
        // Create a card in an existing panel
        const $panelBody = $floorPanel.find('.floor-panel-body');

        // Make sure the panel is expanded
        if (!$panelBody.hasClass('expanded')) {
          $floorPanel.find('.floor-panel-icon').addClass('expanded');
          $panelBody.addClass('expanded');
        }

        const newCard = this.cardFactory.createCard(dataType, defaultName, defaultValue);
        this.cardFactory.setCardDataAttributes(newCard, defaultName, defaultValue);

        // Add floor information for saving
        newCard.attr('data-floor', floorId.toString());
        newCard.attr('data-type', dataType);
        newCard.attr('data-status', 'new');

        $panelBody.append(newCard);
      }
    } else {
      // Other types of variables are handled normally
      const newCard = this.createAndAppendCard(defaultName, defaultValue, dataType, type, $content);
      newCard.attr('data-type', dataType);
      newCard.attr('data-status', 'new');
    }
  }

  /**
   * Update specific variable card
   * @param name Variable name
   * @param value New variable value
   * @returns Whether card was found and updated
   */
  public updateVariableCard(name: string, value: any): boolean {
    try {
      let card = this.container.find(`.variable-card[data-name="${name}"]`);

      if (card.length === 0) {
        const defaultName = 'new_variable';
        card = this.container.find(`.variable-card[data-original-name="${defaultName}"]`);

        if (card.length > 0) {
          this.cardFactory.setCardDataAttributes(card, name, value);
        }
      }

      if (card.length === 0) {
        this.createAndAppendCard(name, value);
        return true;
      }

      const currentValue = card.attr('data-value');
      const newValueString = JSON.stringify(value);

      if (currentValue === newValueString) {
        return true;
      }

      let displayValue = JSON.stringify(value);
      if (displayValue.length > 100) {
        displayValue = displayValue.substring(0, 100) + '...';
      }

      const cardType = card.attr('data-type') as VariableDataType;

      let listContainer;
      let jsonString;
      let inputElement;

      switch (cardType) {
        case 'string':
          card.find('.string-input').val(value);
          break;
        case 'number':
          card.find('.number-input').val(value);
          break;
        case 'boolean':
          card.find('.boolean-btn').removeClass('active');
          card.find(`.boolean-btn[data-value="${value}"]`).addClass('active');
          break;
        case 'array':
          listContainer = card.find('.list-items-container');
          listContainer.empty();
          if (Array.isArray(value) && value.length > 0) {
            const itemsHtml = value
              .map(
                item => `
                <div class="list-item">
                  <span class="drag-handle">☰</span>
                  <textarea class="variable-content-input">${String(item)}</textarea>
                  <button class="list-item-delete"><i class="fa-solid fa-times"></i></button>
                </div>
              `,
              )
              .join('');
            listContainer.html(itemsHtml);
          }
          break;
        case 'object':
          jsonString = JSON.stringify(value, null, 2);
          card.find('.json-input').val(jsonString);
          break;
        default:
          inputElement = card.find('.variable-content-input');
          if (inputElement.length > 0) {
            inputElement.val(typeof value === 'object' ? JSON.stringify(value) : value);
          } else {
            console.warn(`[VariableManager] Unable to find input element to update variable value: ${name}`);
          }
      }

      this.cardFactory.setCardDataAttributes(card, name, value);

      if (!this._skipAnimation) {
        card.addClass('variable-changed');

        void card[0].offsetHeight;

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {});
        });

        card.off('animationend.variableChanged');

        card.on('animationend.variableChanged', function () {
          $(this).removeClass('variable-changed');
          $(this).off('animationend.variableChanged');
        });
      }
      return true;
    } catch (error) {
      console.error(`[VariableManager] Update variable card "${name}" failed:`, error);
      return false;
    }
  }

  /**
   * Get variable card value
   * @param card Card element
   * @returns Variable value from card
   */
  public getVariableCardValue(card: JQuery<HTMLElement>): any {
    const dataType = card.attr('data-type') as VariableDataType;

    switch (dataType) {
      case 'array': {
        const items: string[] = [];
        card.find('.list-item textarea').each(function () {
          items.push($(this).val() as string);
        });
        return items;
      }
      case 'boolean': {
        const activeBtn = card.find('.boolean-btn.active');
        return activeBtn.attr('data-value') === 'true';
      }
      case 'number': {
        return Number(card.find('.number-input').val());
      }
      case 'object': {
        try {
          return JSON.parse(card.find('.json-input').val() as string);
        } catch (error) {
          console.error(`[VariableManager] JSON parsing error:`, error);
          return {};
        }
      }
      case 'string': {
        return card.find('.string-input, .variable-content-input').val();
      }
      default:
        return null;
    }
  }

  /**
   * Get variable card name
   * @param card Card element
   * @returns Variable name from card
   */
  public getVariableCardName(card: JQuery<HTMLElement>): string {
    return card.find('.variable-title').val() as string;
  }

  /**
   * Show add variable selection dialog
   * @param callback Callback after selection
   */
  public async showAddVariableDialog(callback: (dataType: VariableDataType, floorId?: number) => void): Promise<void> {
    const currentType = this.getActiveVariableType();

    // Handling message type variables
    if (currentType === 'message') {
      await this.showFloorInputDialog(async floorId => {
        if (floorId === null) return;

        // After confirming the floor, the variable type selection will be displayed.
        await this.showVariableTypeDialog(dataType => {
          callback(dataType, floorId);
        }, floorId);
      });
      return;
    }

    // Handling other types of variables
    await this.showVariableTypeDialog(dataType => {
      callback(dataType);
    });
  }

  /**
   * Show floor input dialog
   * @param callback Callback after input
   */
  public async showFloorInputDialog(callback: (floorId: number | null) => void): Promise<void> {
    const content = $(`
      <div>
        <h3>Enter floor number</h3>
        <div class="floor-input-dialog">
          <input type="number" id="floor-input" min="0" placeholder="Please enter the floor number" />
          <div id="floor-input-error" class="floor-filter-error" style="display: none">Please enter a valid floor number</div>
        </div>
      </div>
    `);

    const $inputField = content.find('#floor-input');
    const $errorMsg = content.find('#floor-input-error');

    // Get the current latest floor as the default value
    const lastMessageId = getLastMessageId();
    if (lastMessageId >= 0) {
      $inputField.val(lastMessageId);
    }

    const result = await callGenericPopup(content, POPUP_TYPE.CONFIRM, '', {
      okButton: '确认',
      cancelButton: '取消',
    });

    if (!result) {
      callback(null);
      return;
    }

    const floorId = parseInt($inputField.val() as string, 10);
    if (isNaN(floorId) || floorId < 0) {
      $errorMsg.show();
      setTimeout(() => this.showFloorInputDialog(callback), 10);
      return;
    }

    callback(floorId);
  }

  /**
   * Show variable type selection dialog
   * @param callback Callback after selection
   * @param floorId Floor ID (only for message type)
   */
  public async showVariableTypeDialog(callback: (dataType: VariableDataType) => void, floorId?: number): Promise<void> {
    const content = $(`
      <div>
        <h3>Select variable type</h3>
        <div class="variable-type-options">
          <div data-type="string"><i class="fa-solid fa-font"></i> string</div>
          <div data-type="number"><i class="fa-solid fa-hashtag"></i> number</div>
          <div data-type="boolean"><i class="fa-solid fa-toggle-on"></i> boolean</div>
          <div data-type="array"><i class="fa-solid fa-list"></i> array</div>
          <div data-type="object"><i class="fa-solid fa-code"></i> object</div>
        </div>
      </div>
    `);

    content.find('.variable-type-options div').on('click', function () {
      const dataType = $(this).attr('data-type') as VariableDataType;
      callback(dataType);

      $('.popup').find('.popup-button-close').trigger('click');
    });

    await callGenericPopup(content, POPUP_TYPE.DISPLAY);
  }

  /**
   * Show confirmation dialog
   * @param message Confirmation message
   * @param callback Callback after confirmation
   */
  public async showConfirmDialog(message: string, callback: (confirmed: boolean) => void): Promise<void> {
    const result = await callGenericPopup(message, POPUP_TYPE.CONFIRM, '', {
      okButton: '确认',
      cancelButton: '取消',
    });

    callback(!!result);
  }

  /**
   * Render variable manager dialog
   * Creates draggable, resizable dialog
   */
  public render(): void {
    this.unrender();

    this.dialog = $(`
      <div class="variable-manager-dialog">
        <div class="dialog-header">
          <div class="dialog-title">variable manager</div>
          <div class="dialog-controls">
            <button class="dialog-toggle-btn" title="Collapse/Expand"><i class="fa-solid fa-chevron-up"></i></button>
            <button class="dialog-close-btn"><i class="fa-solid fa-times"></i></button>
          </div>
        </div>
        <div class="dialog-content"></div>
        <div class="dialog-resize-handle"></div>
      </div>
    `);

    this.dialog.find('.dialog-content').append(this.container);

    this.dialog.find('.dialog-close-btn').on('click', () => {
      this.unrender();
    });

    this.dialog.find('.dialog-toggle-btn').on('click', () => {
      const $content = this.dialog!.find('.dialog-content');
      const $toggleBtn = this.dialog!.find('.dialog-toggle-btn i');

      $content.slideToggle(300, () => {
        if ($content.is(':visible')) {
          $toggleBtn.removeClass('fa-chevron-down').addClass('fa-chevron-up');
          this.dialog!.find('.dialog-resize-handle').show();
        } else {
          $toggleBtn.removeClass('fa-chevron-up').addClass('fa-chevron-down');
          this.dialog!.find('.dialog-resize-handle').hide();
        }
      });

      this.dialog!.toggleClass('content-collapsed');
    });

    $('body').append(this.dialog);

    this.initDraggableDialog();
    this.centerDialog();
    this.container.show();
  }

  /**
   * Close and clean up variable manager dialog
   */
  public unrender(): void {
    if (this.dialog) {
      this.container.detach();
      this.dialog.remove();
      this.dialog = null;

      if (this.controller) {
        this.controller.cleanup();
      }
    }
  }

  /**
   * Initialize dialog drag and resize functionality
   */
  private initDraggableDialog(): void {
    if (!this.dialog) return;

    const isMobileDevice = isMobile();

    (this.dialog as any).draggable({
      handle: '.dialog-header',
      containment: 'window',
      start: () => {
        this.dialog?.addClass('dragging');
      },
      stop: () => {
        this.dialog?.removeClass('dragging');
      },
    });

    (this.dialog as any).resizable({
      // Desktop uses all edges, mobile uses only the bottom right corner
      handles: isMobileDevice ? 'se' : 'n,e,s,w,ne,se,sw,nw',
      minHeight: VariableView.MIN_DIALOG_HEIGHT,
      minWidth: VariableView.MIN_DIALOG_WIDTH,
      start: () => {
        this.dialog?.addClass('resizing');
      },
      stop: () => {
        this.dialog?.removeClass('resizing');
      },
    });

    // Controls the display of resize controls
    this.dialog.find('.dialog-resize-handle').toggle(isMobileDevice);
  }

  /**
   * Center dialog on screen
   */
  private centerDialog(): void {
    if (!this.dialog) return;

    const windowWidth = $(window).width() || 0;
    const windowHeight = $(window).height() || 0;

    const dialogWidth = this.dialog.outerWidth() || VariableView.MIN_DIALOG_WIDTH;
    const dialogHeight = this.dialog.outerHeight() || VariableView.MIN_DIALOG_HEIGHT;

    const left = Math.max(0, (windowWidth - dialogWidth) / 2);
    const top = Math.max(0, (windowHeight - dialogHeight) / 2);

    this.dialog.css({
      left: `${left}px`,
      top: `${top}px`,
      position: 'fixed',
    });
  }

  /**
   * Set whether to skip animations
   * Implements IDomUpdater interface
   * @param isSkipAnimation Whether to skip animations
   */
  public updateWithoutAnimation(isSkipAnimation: boolean): void {
    this._skipAnimation = isSkipAnimation;
  }

  public addVariableCard(name: string, value: any): void {
    try {
      const newCard = this.createAndAppendCard(name, value);

      if (!this._skipAnimation) {
        newCard.addClass('variable-added');

        void newCard[0].offsetHeight;

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {});
        });

        newCard.off('animationend.variableAdded');

        newCard.on('animationend.variableAdded', function () {
          $(this).removeClass('variable-added');
          $(this).off('animationend.variableAdded');
        });
      }
    } catch (error) {
      console.error(`[VariableManager] 添加卡片"${name}"失败:`, error);
    }
  }

  public removeVariableCard(name: string): void {
    try {
      const $card = this.container.find(`.variable-card[data-name="${name}"]`);

      if ($card.length > 0) {
        // Check if the variable card is in the floor panel
        const $floorPanel = $card.closest('.floor-panel');

        if (this._skipAnimation) {
          $card.remove();

          // If this is the last variable card in a floor panel, remove the entire panel
          if ($floorPanel.length > 0) {
            const $remainingCards = $floorPanel.find('.variable-card');
            if ($remainingCards.length === 0) {
              $floorPanel.remove();
            }
          }
        } else {
          $card.addClass('variable-deleted');

          void $card[0].offsetHeight;

          requestAnimationFrame(() => {
            requestAnimationFrame(() => {});
          });

          $card.off('animationend.variableDeleted');

          $card.on('animationend.variableDeleted', function () {
            $(this).off('animationend.variableDeleted');
            $(this).remove();

            // Check the floor panel after the animation is finished
            if ($floorPanel.length > 0) {
              const $remainingCards = $floorPanel.find('.variable-card');
              if ($remainingCards.length === 0) {
                $floorPanel.remove();
              }
            }
          });
        }

        // Check if the variable list is empty and display the empty state
        const activeContent = this.container.find('.tab-content.active');
        const $variableList = this.getOrCreateVariableList(activeContent);

        setTimeout(
          () => {
            if (
              $variableList.find('.variable-card').length === 0 &&
              $variableList.find('.floor-panel').length === 0 &&
              $variableList.find('.empty-state').length === 0
            ) {
              $variableList.html('<div class="empty-state"><p>No variables yet</p></div>');
            }
          },
          this._skipAnimation ? 0 : 300,
        ); // Wait for animation to complete
      } else {
        console.warn(`[VariableView (IDomUpdater)] Card not found to remove: ${name}`);
      }
    } catch (error) {
      console.error(`[VariableView (IDomUpdater)] Failed to remove card "${name}":`, error);
      const $card = this.container.find(`.variable-card[data-name="${name}"]`);
      if ($card.length > 0) {
        $card.remove();
      }
    }
  }
}
