import { getSortableDelay } from '@sillytavern/scripts/utils';
import { VariableDataType } from '@/component/variable_manager/types';

export class VariableCardFactory {
  /**
   * Infer variable data type from value
   * @param value Value to infer type from
   * @returns Inferred variable data type
   */
  public inferDataType(value: any): VariableDataType {
    if (Array.isArray(value)) {
      return 'array';
    } else if (typeof value === 'boolean') {
      return 'boolean';
    } else if (typeof value === 'number') {
      return 'number';
    } else if (typeof value === 'object' && value !== null) {
      return 'object';
    }
    return 'string';
  }

  /**
   * Set variable card data attributes
   * @param card Variable card jQuery object
   * @param name Variable name
   * @param value Variable value
   * @returns Variable card jQuery object with attributes set
   */
  public setCardDataAttributes(card: JQuery<HTMLElement>, name: string, value: any): JQuery<HTMLElement> {
    card.attr('data-name', name);
    card.attr('data-original-name', name);
    card.attr('data-value', JSON.stringify(value));
    return card;
  }

  /**
   * Create variable card
   * @param type Variable data type
   * @param name Variable name
   * @param value Variable value
   * @returns Variable card jQuery object
   */
  public createCard(type: VariableDataType, name: string, value: any): JQuery<HTMLElement> {
    let card: JQuery<HTMLElement>;
    switch (type) {
      case 'array':
        card = this.createArrayCard(name, value as any[]);
        break;
      case 'boolean':
        card = this.createBooleanCard(name, value as boolean);
        break;
      case 'number':
        card = this.createNumberCard(name, value as number);
        break;
      case 'object':
        card = this.createObjectCard(name, value as object);
        break;
      case 'string':
        card = this.createStringCard(name, String(value));
        break;
      default:
        // Default to string variable card (handles null and undefined values)
        card = this.createStringCard(name, String(value));
    }

    // Set data properties
    return this.setCardDataAttributes(card, name, value);
  }

  /**
   * Create array variable card
   * @param name Variable name
   * @param items Array items
   * @returns Array variable card jQuery object
   */
  private createArrayCard(name: string, items: any[]): JQuery<HTMLElement> {
    const card = $(`
      <div class="variable-card" data-type="array" data-name="${name}">
        <div class="variable-card-header">
          <div class="variable-title-container">
            <i class="fa-solid fa-list"></i>
            <input type="text" class="variable-title" value="${name}" placeholder="variable name">
          </div>
          <div class="variable-actions">
            <button class="variable-action-btn save-btn" title="keep">
              <i class="fa-regular fa-save"></i>
            </button>
            <button class="variable-action-btn delete-btn" title="delete">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </div>
        <div class="variable-card-content">
          <div class="list-items-container">
            ${this.generateArrayItems(items)}
          </div>
          <button class="add-list-item"><i class="fa-solid fa-plus"></i> Add item</button>
        </div>
      </div>
    `);

    // Add drag functionality to list
    const listContainer = card.find('.list-items-container');
    listContainer.sortable({
      delay: getSortableDelay(),
      handle: '.drag-handle',
      // Only sorting events are recorded here, and the actual save is triggered by the save button
    });

    return card;
  }

  /**
   * Generate array items HTML
   * @param items Array items
   * @returns Array items HTML string
   */
  private generateArrayItems(items: any[]): string {
    if (!items || items.length === 0) {
      return '';
    }

    return items
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
  }

  /**
   * Create boolean variable card
   * @param name Variable name
   * @param value Boolean value
   * @returns Boolean variable card jQuery object
   */
  private createBooleanCard(name: string, value: boolean): JQuery<HTMLElement> {
    const card = $(`
      <div class="variable-card" data-type="boolean" data-name="${name}">
        <div class="variable-card-header">
          <div class="variable-title-container">
            <i class="fa-solid fa-toggle-on"></i>
            <input type="text" class="variable-title" value="${name}" placeholder="variable name">
          </div>
          <div class="variable-actions">
            <button class="variable-action-btn save-btn" title="keep">
              <i class="fa-regular fa-save"></i>
            </button>
            <button class="variable-action-btn delete-btn" title="delete">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </div>
        <div class="variable-card-content">
          <div class="boolean-input-container">
            <div class="boolean-buttons-container">
              <button class="boolean-btn ${value ? 'active' : ''}" data-value="true">True</button>
              <button class="boolean-btn ${!value ? 'active' : ''}" data-value="false">False</button>
            </div>
          </div>
        </div>
      </div>
    `);

    card.find('.boolean-btn').on('click', function () {
      card.find('.boolean-btn').removeClass('active');
      $(this).addClass('active');
    });

    return card;
  }

  /**
   * Create number variable card
   * @param name Variable name
   * @param value Number value
   * @returns Number variable card jQuery object
   */
  private createNumberCard(name: string, value: number): JQuery<HTMLElement> {
    const card = $(`
      <div class="variable-card" data-type="number" data-name="${name}">
        <div class="variable-card-header">
          <div class="variable-title-container">
            <i class="fa-solid fa-hashtag"></i>
            <input type="text" class="variable-title" value="${name}" placeholder="variable name">
          </div>
          <div class="variable-actions">
            <button class="variable-action-btn save-btn" title="keep">
              <i class="fa-regular fa-save"></i>
            </button>
            <button class="variable-action-btn delete-btn" title="delete">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </div>
        <div class="variable-card-content">
          <input type="number" class="number-input variable-content-input" value="${value}" step="any">
        </div>
      </div>
    `);

    return card;
  }

  /**
   * Create object variable card
   * @param name Variable name
   * @param value Object value
   * @returns Object variable card jQuery object
   */
  private createObjectCard(name: string, value: object): JQuery<HTMLElement> {
    const jsonString = JSON.stringify(value, null, 2);

    const card = $(`
      <div class="variable-card" data-type="object" data-name="${name}">
        <div class="variable-card-header">
          <div class="variable-title-container">
            <i class="fa-solid fa-code"></i>
            <input type="text" class="variable-title" value="${name}" placeholder="variable name">
          </div>
          <div class="variable-actions">
            <button class="variable-action-btn save-btn" title="keep">
              <i class="fa-regular fa-save"></i>
            </button>
            <button class="variable-action-btn delete-btn" title="delete">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </div>
        <div class="variable-card-content">
          <textarea class="json-input variable-content-input" placeholder="Input JSON object">${jsonString}</textarea>
        </div>
      </div>
    `);

    return card;
  }

  /**
   * Create string variable card
   * @param name Variable name
   * @param value String value
   * @returns String variable card jQuery object
   */
  private createStringCard(name: string, value: string): JQuery<HTMLElement> {
    const card = $(`
      <div class="variable-card" data-type="string" data-name="${name}">
        <div class="variable-card-header">
          <div class="variable-title-container">
            <i class="fa-solid fa-font"></i>
            <input type="text" class="variable-title" value="${name}" placeholder="variable name">
          </div>
          <div class="variable-actions">
            <button class="variable-action-btn save-btn" title="keep">
              <i class="fa-regular fa-save"></i>
            </button>
            <button class="variable-action-btn delete-btn" title="delete">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </div>
        <div class="variable-card-content">
          <textarea class="string-input variable-content-input" placeholder="Enter string value">${value}</textarea>
        </div>
      </div>
    `);

    return card;
  }
}
