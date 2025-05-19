import { ScriptManager } from '@/component/script_repository/script_controller';
import { eventSource } from '@sillytavern/script';
import { Script } from './types';

let isQrEnabled = false;
let isCombined = false;
export abstract class Button {
  id: string;
  name: string;
  visible: boolean;
  scriptId: string;

  constructor(name: string, scriptId: string, visible: boolean = true) {
    this.id = `${scriptId}_${name}`;
    this.name = name;
    this.scriptId = scriptId;
    this.visible = visible;
  }

  // Render button HTML
  abstract render(): string;

  // Binding events
  abstract bindEvents(): void;

  // remove button
  remove(): void {
    $(`#${this.id}`).remove();
  }
}

// Standard script button
export class ScriptButton extends Button {
  constructor(name: string, scriptId: string, visible: boolean = true) {
    super(name, scriptId, visible);
  }

  render(): string {
    return `<div class="qr--button menu_button interactable" id="${this.id}">${this.name}</div>`;
  }

  bindEvents(): void {
    $(`#${this.id}`).on('click', () => {
      eventSource.emit(this.id);
      console.log(`[Script] 点击按钮：${this.id}`);
    });
  }
}

// Different types of buttons can be expanded in the future
export class ButtonFactory {
  static createButton(type: string, name: string, scriptId: string, visible: boolean = true): Button {
    switch (type) {
      case 'script':
      default:
        return new ScriptButton(name, scriptId, visible);
    }
  }
}

// button manager
export class ButtonManager {
  private buttons: Button[] = [];

  // Migrate buttons from old container to new container
  migrateButtonsToNewContainer(oldContainerId: string, newContainerId: string): void {
    const $oldButtons = $(`#${oldContainerId} .qr--button`);
    const $newContainer = $(`#${newContainerId}`);

    if ($oldButtons.length && $newContainer.length) {
      $oldButtons.detach().appendTo($newContainer);

      // Rebind events
      this.buttons.forEach(button => {
        button.bindEvents();
      });
    }
  }

  // Get script container ID
  private getScriptContainerId(scriptId: string): string {
    return `script_container_${scriptId}`;
  }

  // Create buttons from script data
  createButtonsFromScripts(
    globalScripts: Script[],
    characterScripts: Script[],
    isGlobalEnabled: boolean,
    isCharacterEnabled: boolean,
  ): void {
    this.clearButtons();

    // Check if there are any visible buttons
    const hasGlobalVisibleButtons =
      isGlobalEnabled &&
      globalScripts.some(
        script =>
          script.enabled &&
          script.buttons &&
          script.buttons.length > 0 &&
          script.buttons.some(button => button.visible),
      );

    const hasCharacterVisibleButtons =
      isCharacterEnabled &&
      characterScripts.some(
        script =>
          script.enabled &&
          script.buttons &&
          script.buttons.length > 0 &&
          script.buttons.some(button => button.visible),
      );

    if (!hasGlobalVisibleButtons && !hasCharacterVisibleButtons) {
      return;
    }

    // Process global script buttons
    if (isGlobalEnabled && hasGlobalVisibleButtons) {
      this.addScriptButtons(globalScripts);
    }

    // Process character script buttons
    if (isCharacterEnabled && hasCharacterVisibleButtons) {
      this.addScriptButtons(characterScripts);
    }
  }

  // Add script buttons
  private addScriptButtons(scripts: Script[]): void {
    scripts.forEach(script => {
      if (script.enabled && script.buttons && script.buttons.length > 0) {
        // Filter visible buttons
        const visibleButtons = script.buttons
          .filter(buttonData => buttonData.visible)
          .map(buttonData => ButtonFactory.createButton('script', buttonData.name, script.id, buttonData.visible));

        if (visibleButtons.length > 0) {
          // Create a container for each script
          this.addButtonsGroup(visibleButtons, script.id);
        }
      }
    });
  }

  // Add button group
  private addButtonsGroup(buttons: Button[], scriptId: string): void {
    if (buttons.length === 0) return;

    const containerId = this.getScriptContainerId(scriptId);

    $(`#${containerId}`).remove();

    // Create new container
    let containerHtml = `<div id="${containerId}" class="qr--buttons th--button">`;

    buttons.forEach(button => {
      this.buttons = this.buttons.filter(btn => btn.id !== button.id);
      this.buttons.push(button);
      containerHtml += button.render();
    });

    // Close container tag
    containerHtml += '</div>';

    if (isCombined) {
      $('#send_form #qr--bar .qr--buttons').first().append(containerHtml);
    } else {
      $('#send_form #qr--bar').first().append(containerHtml);
    }

    buttons.forEach(button => button.bindEvents());
  }

  // Add all buttons for specified script
  addButtonsForScript(script: Script): void {
    if (!script.buttons || script.buttons.length === 0) return;

    // Filter visible buttons
    const visibleButtons = script.buttons
      .filter(buttonData => buttonData.visible)
      .map(buttonData => ButtonFactory.createButton('script', buttonData.name, script.id, buttonData.visible));

    if (visibleButtons.length > 0) {
      // Create container for script and add all buttons
      this.addButtonsGroup(visibleButtons, script.id);
    }
  }

  // Remove buttons
  removeButtonsByScriptId(scriptId: string): void {
    const containerId = this.getScriptContainerId(scriptId);
    $(`#${containerId}`).remove();
  }

  // Remove all buttons
  clearButtons(): void {
    this.buttons.forEach(btn => btn.remove());
    this.buttons = [];

    // Remove all script containers
    $('.th-button').remove();
  }
}

// Create button manager instance
const buttonManager = new ButtonManager();

function _setButtonLogic() {
  const scriptManager = ScriptManager.getInstance();

  // Get script data
  const globalScripts = scriptManager.getGlobalScripts();
  const characterScripts = scriptManager.getCharacterScripts();
  const isGlobalEnabled = scriptManager.isGlobalScriptEnabled;
  const isCharacterEnabled = scriptManager.isCharacterScriptEnabled;

  // Recreate buttons
  buttonManager.createButtonsFromScripts(globalScripts, characterScripts, isGlobalEnabled, isCharacterEnabled);
}

/**
 * Re-add buttons when QR is enabled/disabled
 */
export function bindQrEnabledChangeListener() {
  $(`#qr--isEnabled`).on('change', () => {
    isQrEnabled = $('#qr--isEnabled').prop('checked');
    checkQrEnabledStatusAndAddButton();
    console.log('[script_manager] Creating buttons');
  });

  $('#qr--isCombined').on('change', () => {
    isCombined = $('#qr--isCombined').prop('checked');
    checkQrEnabledStatusAndAddButton();
    console.log('[script_manager] Creating buttons');
  });
}

/**
 * Unbind change event listener for qr--isEnabled element
 */
export function unbindQrEnabledChangeListener() {
  $(`#qr--isEnabled`).off('change');
  $(`#qr--isCombined`).off('change');
}

/**
 * Handle container based on qr--isEnabled status
 */
function checkQrEnabledStatus() {
  isQrEnabled = $('#qr--isEnabled').prop('checked');
  const qrBarLength = $('#send_form #qr--bar').length;
  if (!isQrEnabled) {
    if (qrBarLength === 0) {
      // QR not enabled and container not created before, create it
      $('#send_form').append('<div class="flex-container flexGap5" id="qr--bar"></div>');
    } else {
      // If container exists, remove extra containers
      $('#send_form #qr--bar').not(':first').remove();
    }
  }
}

/**
 * Check qr--isCombined status
 */
function checkQrCombinedStatus() {
  isCombined = $('#qr--isCombined').prop('checked');
  if (!isQrEnabled) {
    if (isCombined) {
      $('#send_form #qr--bar').append('<div class="qr--buttons th--buttons"></div>');
    }
  }
}

export function checkQrEnabledStatusAndAddButton() {
  checkQrEnabledStatus();
  checkQrCombinedStatus();
  _setButtonLogic();
}

/**
 * Initialize script buttons including verifying QR container and binding change event
 */
export function initScriptButton() {
  checkQrEnabledStatus();
  checkQrCombinedStatus();
  bindQrEnabledChangeListener();
}
