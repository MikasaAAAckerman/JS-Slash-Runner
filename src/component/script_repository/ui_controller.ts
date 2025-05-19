import { ButtonManager, initScriptButton } from '@/component/script_repository/button';
import { scriptEvents, ScriptRepositoryEventType } from '@/component/script_repository/events';
import { ScriptManager } from '@/component/script_repository/script_controller';
import { Script, ScriptType } from '@/component/script_repository/types';
import { extensionFolderPath, getSettingValue, saveSettingValue } from '@/util/extension_variables';
import { renderMarkdown } from '@/util/render_markdown';
import { characters, this_chid } from '@sillytavern/script';
import { renderExtensionTemplateAsync } from '@sillytavern/scripts/extensions';
import { callGenericPopup, POPUP_TYPE } from '@sillytavern/scripts/popup';
import { download, getSortableDelay, uuidv4 } from '@sillytavern/scripts/utils';
export class UIController {
  // Singleton pattern
  private static instance: UIController;

  // Dependencies and state
  private scriptManager: ScriptManager;
  private buttonManager: ButtonManager;

  // Template paths and cache
  private templatePath: string;
  private baseTemplate: JQuery<HTMLElement> | null = null;
  private defaultScriptTemplate: JQuery<HTMLElement> | null = null;

  /**
   * Private constructor
   */
  private constructor() {
    this.scriptManager = ScriptManager.getInstance();
    this.buttonManager = new ButtonManager();
    this.templatePath = `${extensionFolderPath}/src/component/script_repository/public`;
  }

  /**
   * Get UI controller instance
   */
  public static getInstance(): UIController {
    if (!UIController.instance) {
      UIController.instance = new UIController();
    }
    return UIController.instance;
  }

  /**
   * Destroy UI controller instance
   */
  public static destroyInstance(): void {
    if (UIController.instance) {
      UIController.instance.cleanup();
      UIController.instance = undefined as unknown as UIController;
    }
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    this.buttonManager.clearButtons();
    this.baseTemplate = null;
    this.defaultScriptTemplate = null;
  }

  /**
   * Initialize UI
   */
  public async initialize(): Promise<void> {
    // Initialize templates
    await this.initializeTemplates();

    // Set up UI events
    this.setupScriptRepositoryEvents();

    // Register event listeners
    this.registerEventListeners();

    // Render script lists
    await this.renderScriptLists();

    // Initialize button container
    initScriptButton();

    // Emit UI loaded event
    scriptEvents.emit(ScriptRepositoryEventType.UI_LOADED);
  }

  /**
   * Initialize templates
   */
  private async initializeTemplates(): Promise<void> {
    // Initialize script item template
    this.baseTemplate = $(
      await renderExtensionTemplateAsync(this.templatePath, 'script_item_template', {
        scriptName: '',
        id: '',
        moveTo: '',
        faIcon: '',
      }),
    );

    // Initialize default script repository template
    this.defaultScriptTemplate = $(
      await renderExtensionTemplateAsync(this.templatePath, 'script_default_repository', {
        scriptName: '',
        id: '',
      }),
    );
  }

  /**
   * Initialize script repository UI events
   */
  private setupScriptRepositoryEvents(): void {
    // Global script toggle
    $('#global-script-enable-toggle')
      .prop('checked', this.scriptManager.isGlobalScriptEnabled)
      .on('click', (event: JQuery.ClickEvent) => {
        scriptEvents.emit(ScriptRepositoryEventType.TYPE_TOGGLE, {
          type: ScriptType.GLOBAL,
          enable: event.target.checked,
          userInput: true,
        });
      });

    // Character script toggle
    $('#character-script-enable-toggle')
      .prop('checked', this.scriptManager.isCharacterScriptEnabled)
      .on('click', (event: JQuery.ClickEvent) => {
        scriptEvents.emit(ScriptRepositoryEventType.TYPE_TOGGLE, {
          type: ScriptType.CHARACTER,
          enable: event.target.checked,
          userInput: true,
        });
      });

    // Script editor buttons
    $('#open-global-script-editor').on('click', () => {
      scriptEvents.emit(ScriptRepositoryEventType.SCRIPT_EDIT, {
        type: ScriptType.GLOBAL,
      });
    });

    $('#open-character-script-editor').on('click', () => {
      scriptEvents.emit(ScriptRepositoryEventType.SCRIPT_EDIT, {
        type: ScriptType.CHARACTER,
      });
    });

    // Script variable editor button
    $('#character-variable').on('click', () => {
      scriptEvents.emit(ScriptRepositoryEventType.VARIABLE_EDIT);
    });

    // Import script file
    $('#import-script-file').on('change', async function () {
      let target = 'global';
      const template = $(
        await renderExtensionTemplateAsync(
          `${extensionFolderPath}/src/component/script_repository/public`,
          'script_import_target',
        ),
      );
      template.find('#script-import-target-global').on('input', () => (target = 'global'));
      template.find('#script-import-target-character').on('input', () => (target = 'character'));
      const result = await callGenericPopup(template, POPUP_TYPE.CONFIRM, '', {
        okButton: '确认',
        cancelButton: '取消',
      });

      if (result) {
        const inputElement = this instanceof HTMLInputElement && this;
        if (inputElement && inputElement.files) {
          for (const file of inputElement.files) {
            scriptEvents.emit(ScriptRepositoryEventType.SCRIPT_IMPORT, {
              file,
              type: target === 'global' ? ScriptType.GLOBAL : ScriptType.CHARACTER,
            });
          }
          inputElement.value = '';
        }
      }
    });

    // Trigger script file import dialog
    $('#import-script').on('click', function () {
      $('#import-script-file').trigger('click');
    });

    // Load default script repository
    $('#default-script').on('click', () => {
      scriptEvents.emit(ScriptRepositoryEventType.UI_REFRESH, { action: 'load_default_scripts' });
    });

    // Fix layout issue
    $('#extensions_settings').css('min-width', '0');
  }

  /**
   * Register event listeners
   */
  private registerEventListeners(): void {
    scriptEvents.on(ScriptRepositoryEventType.UI_REFRESH, async data => {
      const { action } = data;

      switch (action) {
        case 'script_toggled':
          // Script toggle state changed
          await this.refreshScriptState(data.script, data.enable);
          break;
        case 'type_toggled':
          // Script type toggle state changed
          await this.refreshTypeState(data.type, data.enable);
          break;
        case 'script_imported':
          // Script imported successfully
          await this.renderScript(data.script, data.type);
          break;
        case 'script_saved':
          // Script saved successfully
          await this.renderScript(data.script, data.type);
          break;
        case 'script_deleted':
          // Script deleted successfully
          this.removeScriptElement(data.scriptId);
          break;
        case 'script_moved':
          // Script moved successfully
          this.handleScriptMoved(data.script, data.fromType, data.targetType);
          break;
        case 'scripts_reordered':
          // Scripts reordered
          await this.scriptManager.saveScriptsOrder(data.scripts, data.type);
          break;
        case 'load_default_scripts':
          // Load default scripts
          await this.loadDefaultScriptsRepository();
          break;
        case 'refresh_charact_scripts':
          // Only refresh character script list
          await this.refreshCharacterScriptList();
          break;
        default:
          console.warn(`[script_repository] Unhandled UI refresh event: ${action}`);
      }
    });

    // Listen for button add events
    scriptEvents.on(ScriptRepositoryEventType.BUTTON_ADD, data => {
      const { script } = data;
      this.addButton(script);
    });

    // Listen for button remove events
    scriptEvents.on(ScriptRepositoryEventType.BUTTON_REMOVE, data => {
      const { scriptId } = data;
      this.buttonManager.removeButtonsByScriptId(scriptId);
    });

    // Listen for script edit events
    scriptEvents.on(ScriptRepositoryEventType.SCRIPT_EDIT, async data => {
      const { type, scriptId } = data;
      await this.openScriptEditor(type, scriptId);
    });

    // Listen for variable edit events
    scriptEvents.on(ScriptRepositoryEventType.VARIABLE_EDIT, async () => {
      await this.openVariableEditor();
    });
  }

  /**
   * Add buttons
   * @param script Script object
   */
  private addButton(script: Script): void {
    if (script.buttons && script.buttons.length > 0) {
      this.buttonManager.addButtonsForScript(script);
    }
  }

  /**
   * Render script lists
   */
  private async renderScriptLists(): Promise<void> {
    // Clear lists
    this.clearGlobalScriptList();
    this.clearCharacterScriptList();

    // Render global scripts
    const globalScripts = this.scriptManager.getGlobalScripts();
    await this.renderGlobalScriptList(globalScripts);

    // Render character scripts
    const characterScripts = this.scriptManager.getCharacterScripts();
    await this.renderCharacterScriptList(characterScripts);
  }

  /**
   * Render global script list
   * @param scripts Script array
   */
  private async renderGlobalScriptList(scripts: Script[]): Promise<void> {
    if (scripts.length > 0) {
      for (const script of scripts) {
        await this.renderScript(script, ScriptType.GLOBAL);
      }
    } else {
      this.showEmptyScriptListTip(ScriptType.GLOBAL);
    }

    // Set up drag sorting
    this.setupDraggable(ScriptType.GLOBAL);
  }

  /**
   * Render character script list
   * @param scripts Script array
   */
  private async renderCharacterScriptList(scripts: Script[]): Promise<void> {
    if (scripts.length > 0) {
      for (const script of scripts) {
        await this.renderScript(script, ScriptType.CHARACTER);
      }
    } else {
      this.showEmptyScriptListTip(ScriptType.CHARACTER);
    }

    // Set up drag sorting
    this.setupDraggable(ScriptType.CHARACTER);
  }

  /**
   * Clear global script list
   */
  private clearGlobalScriptList(): void {
    $('#global-script-list').empty();
  }

  /**
   * Clear character script list
   */
  private clearCharacterScriptList(): void {
    $('#character-script-list').empty();
  }

  /**
   * Refresh character script list
   */
  private async refreshCharacterScriptList(): Promise<void> {
    // Clear character script list
    this.clearCharacterScriptList();

    // Get and render character scripts
    const characterScripts = this.scriptManager.getCharacterScripts();
    await this.renderCharacterScriptList(characterScripts);

    // Set master toggle state
    const isCharacterScriptEnabled = this.scriptManager.isCharacterScriptEnabled;
    $('#character-script-enable-toggle').prop('checked', isCharacterScriptEnabled);
  }

  /**
   * Show empty script list message
   * @param type Script type
   */
  private showEmptyScriptListTip(type: ScriptType): void {
    const container = type === ScriptType.GLOBAL ? $('#global-script-list') : $('#character-script-list');
    if (container.find('small').length === 0) {
      container.append('<small>No scripts available</small>');
    }
  }

  /**
   * Refresh script state
   * @param script Script object
   * @param enable Whether enabled
   */
  private async refreshScriptState(script: Script, enable: boolean): Promise<void> {
    // Update UI state
    const $script = $(`#${script.id}`);
    if ($script.length > 0) {
      if (enable) {
        $script.find('.script-toggle').addClass('enabled');
        $script.find('.script-toggle i.fa-toggle-off').hide();
        $script.find('.script-toggle i.fa-toggle-on').show();
      } else {
        $script.find('.script-toggle').removeClass('enabled');
        $script.find('.script-toggle i.fa-toggle-off').show();
        $script.find('.script-toggle i.fa-toggle-on').hide();
      }
    }
  }

  /**
   * Refresh script type state
   * @param type Script type
   * @param enable Whether enabled
   */
  private async refreshTypeState(type: ScriptType, enable: boolean): Promise<void> {
    // Update UI state
    const $toggle =
      type === ScriptType.GLOBAL ? $('#global-script-enable-toggle') : $('#character-script-enable-toggle');
    $toggle.prop('checked', enable);
  }

  /**
   * Remove script element
   * @param scriptId Script ID
   */
  private removeScriptElement(scriptId: string): void {
    $(`#${scriptId}`).remove();
  }

  /**
   * Handle script move
   * @param script Script object
   * @param fromType Source type
   * @param targetType Target type
   */
  private handleScriptMoved(script: Script, fromType: ScriptType, targetType: ScriptType): void {
    // Remove from source list
    $(`#${script.id}`).remove();

    // Check if source list is empty
    const sourceList = fromType === ScriptType.GLOBAL ? $('#global-script-list') : $('#character-script-list');
    if (sourceList.children().length === 0) {
      this.showEmptyScriptListTip(fromType);
    }

    // Render in target list
    scriptEvents.emit(ScriptRepositoryEventType.UI_REFRESH, {
      action: 'script_imported',
      script,
      type: targetType,
    });
  }

  /**
   * Render single script item
   * @param script Script object
   * @param type Script type
   */
  private async renderScript(script: Script, type: ScriptType): Promise<void> {
    if (!this.baseTemplate) {
      await this.initializeTemplates();
    }

    const scriptHtml = this.baseTemplate!.clone();

    // Set script ID, ensuring it's not affected by temp IDs from built-in repo
    scriptHtml.attr('id', script.id);

    scriptHtml.find('.script-item-name').text(script.name);
    scriptHtml.find('.script-storage-location').addClass(type === 'global' ? 'move-to-character' : 'move-to-global');
    scriptHtml.find('.script-storage-location i').addClass(type === 'global' ? 'fa-arrow-down' : 'fa-arrow-up');

    const $toggleButton = scriptHtml.find('.script-toggle');
    // Set initial state
    if (script.enabled) {
      $toggleButton.addClass('enabled');
      $toggleButton.find('i.fa-toggle-off').hide();
      $toggleButton.find('i.fa-toggle-on').show();
    } else {
      $toggleButton.removeClass('enabled');
      $toggleButton.find('i.fa-toggle-off').show();
      $toggleButton.find('i.fa-toggle-on').hide();
    }

    // Bind click event
    $toggleButton.on('click', function () {
      const isEnabled = $(this).hasClass('enabled');
      const newState = !isEnabled;

      if (newState) {
        $(this).addClass('enabled');
        $(this).find('i.fa-toggle-off').hide();
        $(this).find('i.fa-toggle-on').show();
      } else {
        $(this).removeClass('enabled');
        $(this).find('i.fa-toggle-off').show();
        $(this).find('i.fa-toggle-on').hide();
      }

      script.enabled = newState;

      scriptEvents.emit(ScriptRepositoryEventType.SCRIPT_TOGGLE, {
        script,
        type,
        enable: newState,
        userInput: true,
      });
    });

    scriptHtml.find('.script-info').on('click', () => {
      const scriptInfo = script.info || '';
      const htmlText = renderMarkdown(scriptInfo);
      callGenericPopup(htmlText, POPUP_TYPE.DISPLAY, undefined, { wide: true });
    });

    scriptHtml.find('.edit-script').on('click', () => {
      scriptEvents.emit(ScriptRepositoryEventType.SCRIPT_EDIT, { type, scriptId: script.id });
    });

    scriptHtml.find('.script-storage-location').on('click', () => {
      scriptEvents.emit(ScriptRepositoryEventType.SCRIPT_MOVE, { script, fromType: type });
    });

    scriptHtml.find('.export-script').on('click', async () => {
      // eslint-disable-next-line no-control-regex
      const fileName = `${script.name.replace(/[\s.<>:"/\\|?*\x00-\x1F\x7F]/g, '_').toLowerCase()}.json`;
      const { enabled, ...scriptData } = script;
      const fileData = JSON.stringify(scriptData, null, 2);
      download(fileData, fileName, 'application/json');
    });

    scriptHtml.find('.delete-script').on('click', async () => {
      const confirm = await callGenericPopup('确定要删除这个脚本吗？', POPUP_TYPE.CONFIRM);

      if (!confirm) {
        return;
      }

      scriptEvents.emit(ScriptRepositoryEventType.SCRIPT_DELETE, { scriptId: script.id, type });
      scriptHtml.remove();
    });

    const $emptyTip =
      type === ScriptType.GLOBAL ? $('#global-script-list').find('small') : $('#character-script-list').find('small');

    // Get the container of the corresponding type
    const container = type === ScriptType.GLOBAL ? $('#global-script-list') : $('#character-script-list');

    // Check if script element with same ID already exists (excluding temp IDs from built-in repo)
    const existingElement = container.find(`#${CSS.escape(script.id)}`).filter(function (this: HTMLElement) {
      const elementId = $(this).attr('id');
      // Select only those elements that do not have the default_lib_ prefix
      return elementId !== undefined && !elementId.startsWith('default_lib_');
    });

    if (existingElement.length > 0) {
      // If exists, replace element while keeping position
      existingElement.replaceWith(scriptHtml);
    } else {
      // If doesn't exist, append to list end
      container.append(scriptHtml);
    }

    if ($emptyTip.length > 0) {
      $emptyTip.remove();
    }
  }

  /**
   * Set up script drag sorting
   * @param type Script type
   */
  private setupDraggable(type: ScriptType): void {
    const list = type === ScriptType.GLOBAL ? $('#global-script-list') : $('#character-script-list');

    list.sortable({
      delay: getSortableDelay(),
      items: '.script-item',
      stop: async (_, ui) => {
        const itemId = ui.item.attr('id');
        if (!itemId) return;

        // Get new order
        const newOrder: string[] = [];
        list.children('.script-item').each(function () {
          const childId = $(this).attr('id');
          if (childId) {
            newOrder.push(childId);
          }
        });

        // Reorder script array
        const scripts =
          type === ScriptType.GLOBAL ? this.scriptManager.getGlobalScripts() : this.scriptManager.getCharacterScripts();

        const orderedScripts = newOrder.map(id => scripts.find(s => s.id === id)).filter(Boolean) as Script[];

        scriptEvents.emit(ScriptRepositoryEventType.UI_REFRESH, {
          action: 'scripts_reordered',
          scripts: orderedScripts,
          type,
        });
      },
    });
  }

  /**
   * Clone default script template
   * @param script Script object
   */
  private async cloneDefaultScriptTemplate(script: Script): Promise<JQuery<HTMLElement>> {
    if (!this.defaultScriptTemplate) {
      await this.initializeTemplates();
    }

    const scriptHtml = this.defaultScriptTemplate!.clone();

    // Use temp ID prefix for built-in repo scripts to avoid conflicts
    const tempId = `default_lib_${script.id}`;
    scriptHtml.attr('id', tempId);

    scriptHtml.find('.script-item-name').text(script.name);
    scriptHtml.find('.script-info').on('click', () => {
      const htmlText = renderMarkdown(script.info);
      callGenericPopup(htmlText, POPUP_TYPE.DISPLAY, undefined, { wide: true });
    });

    scriptHtml.find('.add-script').on('click', async () => {
      let target: ScriptType = ScriptType.GLOBAL;
      const template = $(await renderExtensionTemplateAsync(this.templatePath, 'script_import_target'));
      template.find('#script-import-target-global').on('input', () => (target = ScriptType.GLOBAL));
      template.find('#script-import-target-character').on('input', () => (target = ScriptType.CHARACTER));
      const result = await callGenericPopup(template, POPUP_TYPE.CONFIRM, '', {
        okButton: '确认',
        cancelButton: '取消',
      });

      if (!result) {
        return;
      }

      const newScript = new Script({ ...script, enabled: false });

      let action: 'new' | 'override' | 'cancel' = 'new';

      const existing_script = this.scriptManager.getScriptById(script.id);
      if (existing_script) {
        const input = await callGenericPopup(
          `要导入的脚本 '${script.name}' 与脚本库中的 '${existing_script.name}' id 相同，是否要导入？`,
          POPUP_TYPE.TEXT,
          '',
          {
            okButton: '覆盖原脚本',
            cancelButton: '取消',
            customButtons: ['新建脚本'],
          },
        );

        switch (input) {
          case 0:
            action = 'cancel';
            break;
          case 1:
            action = 'override';
            break;
          case 2:
            action = 'new';
            break;
        }
      }

      switch (action) {
        case 'new':
          if (existing_script) {
            // Use new ID
            newScript.id = uuidv4();
          }
          break;
        case 'override':
          {
            if (!existing_script) {
              return;
            }

            $(`#${existing_script.id}`).remove();

            if (existing_script.enabled) {
              await this.scriptManager.stopScript(existing_script, target);
              this.buttonManager.removeButtonsByScriptId(existing_script.id);
            }
          }
          break;
        case 'cancel':
          return;
      }

      scriptEvents.emit(ScriptRepositoryEventType.SCRIPT_SAVE, { script: newScript, type: target });

      toastr.success(`脚本"${newScript.name}"已添加到${target === ScriptType.GLOBAL ? '全局' : '角色'}脚本库`);
    });

    return scriptHtml;
  }

  /**
   * Create default script repository container
   * Avoids re-rendering template
   */
  private createDefaultScriptContainer(): JQuery<HTMLElement> {
    // Create a simple container instead of re-rendering the full template
    return $('<div class="default-script-repository-container"></div>');
  }

  /**
   * Load default script repository
   */
  private async loadDefaultScriptsRepository(): Promise<void> {
    const createDefaultScripts = (await import('./builtin_scripts')).createDefaultScripts;
    const container = this.createDefaultScriptContainer();

    const defaultScripts = await createDefaultScripts();
    for (const script of defaultScripts) {
      if (!script) continue;
      const scriptHtml = await this.cloneDefaultScriptTemplate(script);
      container.append(scriptHtml);
    }

    await callGenericPopup(container, POPUP_TYPE.DISPLAY, '', { wide: true });
  }

  /**
   * Open script editor
   * @param type Script type
   * @param scriptId Script ID
   */
  private async openScriptEditor(type: ScriptType, scriptId?: string): Promise<void> {
    const $editorHtml = $(await renderExtensionTemplateAsync(this.templatePath, 'script_editor'));
    let script: Script | undefined;

    if (scriptId) {
      script = this.scriptManager.getScriptById(scriptId);

      if (script) {
        $editorHtml.find('#script-name-input').val(script.name);
        $editorHtml.find('#script-content-textarea').val(script.content);
        $editorHtml.find('#script-info-textarea').val(script.info);

        // Add existing buttons
        if (script.buttons && script.buttons.length > 0) {
          script.buttons.forEach((button, buttonIndex) => {
            const $buttonHtml = $(`
              <div class="button-item" id="button-${buttonIndex}">
                <span class="drag-handle menu-handle">☰</span>
                <input type="checkbox" id="checkbox-button-${buttonIndex}" class="button-visible" ${
              button.visible ? 'checked' : ''
            }>
                <input class="text_pole button-name" type="text" id="text-button-${buttonIndex}" value="${
              button.name
            }" placeholder="Button name">
                <div class="delete-button menu_button interactable" data-index="${buttonIndex}">
                  <i class="fa-solid fa-trash"></i>
                </div>
              </div>
            `);

            $editorHtml.find('.button-list').append($buttonHtml);
          });
        }
      }
    }

    // Add button trigger event
    $editorHtml.find('#add-button-trigger').on('click', () => {
      const buttonIndex = $editorHtml.find('.button-list .button-item').length;
      const buttonId = `button-${buttonIndex}`;
      const $buttonContent = $(`<div class="button-item" id="${buttonId}">
        <span class="drag-handle menu-handle">☰</span>
        <input type="checkbox" id="checkbox-${buttonId}" class="button-visible" checked>
        <input class="text_pole button-name" type="text" id="text-${buttonId}" placeholder="Button name">
        <div class="delete-button menu_button interactable" data-index="${buttonIndex}">
          <i class="fa-solid fa-trash"></i>
        </div>
      </div>`);
      $editorHtml.find('.button-list').append($buttonContent);
    });

    // Configure sorting
    //@ts-ignore
    $editorHtml.find('#script-button-content .button-list').sortable({
      handle: '.drag-handle',
      items: '.button-item',
    });

    // Delete button event
    $editorHtml.on('click', '.delete-button', (e: JQuery.ClickEvent) => {
      $(e.currentTarget).closest('.button-item').remove();
    });

    const result = await callGenericPopup($editorHtml, POPUP_TYPE.CONFIRM, '', {
      wide: true,
      okButton: '保存',
      cancelButton: '取消',
    });

    if (!result) {
      return;
    }

    const scriptName = String($editorHtml.find('#script-name-input').val());
    const scriptContent = String($editorHtml.find('#script-content-textarea').val());
    const scriptInfo = String($editorHtml.find('#script-info-textarea').val());

    // Collect button data
    const buttons: { name: string; visible: boolean }[] = [];
    $editorHtml.find('.button-list .button-item').each(function () {
      const buttonName = $(this).find('.button-name').val() as string;
      const visible = $(this).find('.button-visible').prop('checked') as boolean;
      if (buttonName && buttonName.trim() !== '') {
        buttons.push({ name: buttonName, visible });
      }
    });

    if (!script) {
      // Create new script
      script = new Script({
        id: uuidv4(),
        name: scriptName,
        content: scriptContent,
        info: scriptInfo,
        enabled: false,
        buttons,
      });

      // Emit save event
      scriptEvents.emit(ScriptRepositoryEventType.SCRIPT_SAVE, { script, type });
    } else {
      const wasEnabled = script.enabled;

      // Remove script buttons
      scriptEvents.emit(ScriptRepositoryEventType.BUTTON_REMOVE, { scriptId: script.id });

      // Update script data
      script.name = scriptName;
      script.content = scriptContent;
      script.info = scriptInfo;
      script.buttons = buttons;

      // Emit save event
      scriptEvents.emit(ScriptRepositoryEventType.SCRIPT_SAVE, { script, type });

      if (wasEnabled) {
        try {
          await this.scriptManager.stopScript(script, type);
          await this.scriptManager.runScript(script, type);
        } catch (error) {
          console.error(`[Script] Failed to restart script: ${script.name}`, error);
          toastr.error(`Failed to restart script: ${script.name}`);
        }
      }
    }
  }

  /**
   * Open variable editor
   */
  private async openVariableEditor(): Promise<void> {
    if (!this_chid) {
      toastr.error('Save failed - current character is empty');
      return;
    }

    const variablesPromise = import('./data').then(module => module.getCharacterScriptVariables());
    const replaceVariablesPromise = import('./data').then(module => module.replaceCharacterScriptVariables);

    const [existingVariables, replaceFunc] = await Promise.all([variablesPromise, replaceVariablesPromise]);

    const $editorHtml = $(await renderExtensionTemplateAsync(this.templatePath, 'script_variable_editor'));
    const variableContainer = $editorHtml.find('.variable-container');

    // Add existing variables
    for (const [key, value] of Object.entries(existingVariables)) {
      const $variableRow = $(`
        <div class="variable-row flex-container mb-2" style="gap:5px;">
          <input type="text" class="text_pole variable-key" style="width:150px;" value="${key}" placeholder="variable name">
          <input type="text" class="text_pole variable-value" style="flex-grow:1;" value="${value}" placeholder="variable value">
          <div class="menu_button delete-variable">delete</div>
        </div>
      `);

      $variableRow.find('.delete-variable').on('click', function () {
        $(this).closest('.variable-row').remove();
      });

      variableContainer.append($variableRow);
    }

    // Add new variable button
    $editorHtml.find('#add-variable').on('click', function () {
      const $variableRow = $(`
        <div class="variable-row flex-container mb-2" style="gap:5px;">
          <input type="text" class="text_pole variable-key" style="width:150px;" placeholder="variable name">
          <input type="text" class="text_pole variable-value" style="flex-grow:1;" placeholder="variable value">
          <div class="menu_button delete-variable">delete</div>
        </div>
      `);

      $variableRow.find('.delete-variable').on('click', function () {
        $(this).closest('.variable-row').remove();
      });

      variableContainer.append($variableRow);
    });

    const result = await callGenericPopup($editorHtml, POPUP_TYPE.CONFIRM, '', {
      wide: true,
      okButton: '保存',
      cancelButton: '取消',
    });

    if (!result) {
      return;
    }

    // Collect variable data
    const variables: Record<string, string> = {};
    $editorHtml.find('.variable-row').each(function () {
      const key = $(this).find('.variable-key').val() as string;
      const value = $(this).find('.variable-value').val() as string;
      if (key && key.trim() !== '') {
        variables[key] = value;
      }
    });

    await replaceFunc(variables);
    console.info('[Script] Saved character script variables');
    toastr.success('Saved character script variables');
  }

  /**
   * Check for embedded scripts in character
   * @param characterId Character ID
   * @param enableableScripts List of scripts that can be enabled
   */
  public async checkEmbeddedScripts(characterId: any): Promise<void> {
    const charactersWithScripts = getSettingValue('script.characters_with_scripts') || [];
    const avatar = characters[characterId]?.avatar;
    if (charactersWithScripts.includes(avatar)) {
      return;
    }

    const template = await renderExtensionTemplateAsync(
      `${extensionFolderPath}/src/component/script_repository/public`,
      'script_allow_popup',
    );
    const result = await callGenericPopup(template, POPUP_TYPE.CONFIRM, '', {
      okButton: '确认',
      cancelButton: '取消',
    });

    if (result) {
      if (avatar && !charactersWithScripts.includes(avatar)) {
        charactersWithScripts.push(avatar);
        saveSettingValue('script.characters_with_scripts', charactersWithScripts);
      }

      $('#character-script-enable-toggle').prop('checked', true);

      scriptEvents.emit(ScriptRepositoryEventType.TYPE_TOGGLE, {
        type: ScriptType.CHARACTER,
        enable: true,
        userInput: false,
      });
    } else {
      $('#character-script-enable-toggle').prop('checked', false);

      scriptEvents.emit(ScriptRepositoryEventType.TYPE_TOGGLE, {
        type: ScriptType.CHARACTER,
        enable: false,
        userInput: false,
      });
    }
  }
}
