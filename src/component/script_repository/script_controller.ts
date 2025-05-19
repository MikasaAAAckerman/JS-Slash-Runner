import { destroyIframe } from '@/component/message_iframe';
import { ScriptData } from '@/component/script_repository/data';
import { scriptEvents, ScriptRepositoryEventType } from '@/component/script_repository/events';
import { IFrameElement, Script, ScriptType } from '@/component/script_repository/types';
import { script_url } from '@/script_url';
import third_party from '@/third_party.html';
import { getSettingValue } from '@/util/extension_variables';
import { callGenericPopup, POPUP_TYPE } from '@sillytavern/scripts/popup';
import { uuidv4 } from '@sillytavern/scripts/utils';

class ScriptExecutor {
  /**
   * Create and run a single script
   * @param script Script object
   * @param type Script type (GLOBAL/CHARACTER)
   */
  async runScript(script: Script, type: ScriptType): Promise<void> {
    const typeName = type === ScriptType.GLOBAL ? 'global' : 'character';

    try {
      // First check if iframe with same name exists, destroy if it does
      const iframeElement = $('iframe').filter(
        (_index, element) => $(element).attr('script-id') === script.id,
      )[0] as IFrameElement;

      if (iframeElement) {
        await destroyIframe(iframeElement);
      }

      // Create HTML content for running script
      const htmlContent = this.createScriptHtml(script);

      // Create new iframe element
      const $iframe = $('<iframe>', {
        style: 'display: none;',
        id: `tavern-helper-script-${script.name}`,
        srcdoc: htmlContent,
        'script-id': script.id,
      });

      // Set load event handler
      $iframe.on('load', () => {
        console.info(`[Script] Enabled ${typeName} script ["${script.name}"]`);
      });

      // Add to page
      $('body').append($iframe);
    } catch (error) {
      console.error(`[Script] Failed to enable ${typeName} script ["${script.name}"]`, error);
      toastr.error(`Failed to enable ${typeName} script ["${script.name}"]`);
      throw error;
    }
  }

  /**
   * Stop single script and destroy its iframe
   * @param script Script object
   * @param type Script type (GLOBAL/CHARACTER)
   */
  async stopScript(script: Script, type: ScriptType): Promise<void> {
    const typeName = type === ScriptType.GLOBAL ? 'global' : 'character';

    const iframeElement = $('iframe').filter(
      (_index, element) => $(element).attr('script-id') === script.id,
    )[0] as IFrameElement;

    if (iframeElement) {
      await destroyIframe(iframeElement);
      console.info(`[Script] Disabled ${typeName} script ["${script.name}"]`);
    }
  }

  /**
   * Create HTML content for running script
   * @param script Script object
   * @returns HTML content string
   */
  private createScriptHtml(script: Script): string {
    return `
      <html>
      <head>
        ${third_party}
        <script>
          (function ($) {
            var original$ = $;
            window.$ = function (selector, context) {
              if (context === undefined || context === null) {
                if (window.parent && window.parent.document) {
                  context = window.parent.document;
                } else {
                  console.warn('Cannot access window.parent.document, using current iframe document as context.');
                  context = window.document;
                }
              }
              return original$(selector, context);
            };
          })(jQuery);

          SillyTavern = window.parent.SillyTavern.getContext();
          TavernHelper = window.parent.TavernHelper;
          for (const key in TavernHelper) {
            window[key] = TavernHelper[key];
          }
        </script>
        <script src="${script_url.get('iframe_client')}"></script>
      </head>
      <body>
        <script type="module">
          ${script.content}
        </script>
      </body>
      </html>
    `;
  }

  /**
   * Clean up all script iframes
   */
  async clearAllScriptsIframe(): Promise<void> {
    const $iframes = $('iframe[id^="tavern-helper-script-"]');
    for (const iframe of $iframes) {
      await destroyIframe(iframe as IFrameElement);
    }
  }
}

/**
 * Script manager - handles core script operations like running/stopping
 * Acts as unified entry point, uses ScriptExecutor for actual execution
 */
export class ScriptManager {
  private static instance: ScriptManager;
  private scriptData: ScriptData;
  private executor: ScriptExecutor;

  private constructor() {
    this.scriptData = ScriptData.getInstance();
    this.executor = new ScriptExecutor();
    this.registerEventListeners();
  }

  /**
   * Get script manager instance
   */
  public static getInstance(): ScriptManager {
    if (!ScriptManager.instance) {
      ScriptManager.instance = new ScriptManager();
    }
    return ScriptManager.instance;
  }

  /**
   * Destroy script manager instance
   */
  public static destroyInstance(): void {
    if (ScriptManager.instance) {
      ScriptManager.instance = undefined as unknown as ScriptManager;
    }
  }

  /**
   * Register event listeners
   */
  private registerEventListeners(): void {
    // Script toggle event
    scriptEvents.on(ScriptRepositoryEventType.SCRIPT_TOGGLE, async data => {
      const { script, type, enable, userInput = true } = data;
      await this.toggleScript(script, type, enable, userInput);
    });

    // Type toggle event
    scriptEvents.on(ScriptRepositoryEventType.TYPE_TOGGLE, async data => {
      const { type, enable, userInput = true } = data;
      await this.toggleScriptType(type, enable, userInput);
    });

    // Script import event
    scriptEvents.on(ScriptRepositoryEventType.SCRIPT_IMPORT, async data => {
      const { file, type } = data;
      await this.importScript(file, type);
    });

    // Script delete event
    scriptEvents.on(ScriptRepositoryEventType.SCRIPT_DELETE, async data => {
      const { scriptId, type } = data;
      await this.deleteScript(scriptId, type);
    });

    // Script save event
    scriptEvents.on(ScriptRepositoryEventType.SCRIPT_SAVE, async data => {
      const { script, type } = data;
      await this.saveScript(script, type);
    });

    // Script move event
    scriptEvents.on(ScriptRepositoryEventType.SCRIPT_MOVE, async data => {
      const { script, fromType } = data;
      await this.moveScript(script, fromType);
    });

    // UI loaded event - auto-run enabled scripts
    scriptEvents.on(ScriptRepositoryEventType.UI_LOADED, async () => {
      if (!getSettingValue('enabled_extension')) {
        return;
      }

      // Get global and character script lists
      const globalScripts = this.scriptData.getGlobalScripts();
      const characterScripts = this.scriptData.getCharacterScripts();

      // Check if global script type is enabled
      if (this.scriptData.isGlobalScriptEnabled) {
        await this.runScriptsByType(globalScripts, ScriptType.GLOBAL);
      } else {
        console.info('[Script] Global script type disabled, skipping global scripts');
      }

      // Check if character script type is enabled
      if (this.scriptData.isCharacterScriptEnabled) {
        await this.runScriptsByType(characterScripts, ScriptType.CHARACTER);
      } else {
        console.info('[Script] Character script type disabled, skipping character scripts');
      }
    });
  }

  /**
   * Toggle script enabled state
   * @param script Script object
   * @param type Script type (GLOBAL/CHARACTER)
   * @param enable Whether to enable
   * @param userInput Whether triggered by user input
   */
  public async toggleScript(
    script: Script,
    type: ScriptType,
    enable: boolean,
    userInput: boolean = true,
  ): Promise<void> {
    if (userInput) {
      script.enabled = enable;
      await this.scriptData.saveScript(script, type);
    }

    try {
      if (enable) {
        // Check whether the script master switch of the corresponding type is enabled
        if (type === ScriptType.GLOBAL && !this.scriptData.isGlobalScriptEnabled) {
          console.info(`[script_manager] Global script type disabled, skipping script ["${script.name}"]`);
          return;
        }
        if (type === ScriptType.CHARACTER && !this.scriptData.isCharacterScriptEnabled) {
          console.info(`[script_manager] Character script type disabled, skipping script ["${script.name}"]`);
          return;
        }

        await this.runScript(script, type);
      } else {
        await this.stopScript(script, type);
      }

      scriptEvents.emit(ScriptRepositoryEventType.UI_REFRESH, {
        action: 'script_toggled',
        script,
        type,
        enable,
      });
    } catch (error) {
      console.error(`[Script] Failed to toggle script state: ${script.name}`, error);
      toastr.error(`Failed to toggle script state: ${script.name}`);
    }
  }

  /**
   * Toggle script type enabled state
   * @param type Script type (GLOBAL/CHARACTER)
   * @param enable Whether to enable
   * @param userInput Whether triggered by user input
   */
  public async toggleScriptType(type: ScriptType, enable: boolean, userInput: boolean = true): Promise<void> {
    if (userInput) {
      await this.scriptData.updateScriptTypeEnableState(type, enable);
    }

    try {
      const scripts =
        type === ScriptType.GLOBAL ? this.scriptData.getGlobalScripts() : this.scriptData.getCharacterScripts();

      if (enable) {
        await this.runScriptsByType(scripts, type);
      } else {
        await this.stopScriptsByType(scripts, type);
      }

      scriptEvents.emit(ScriptRepositoryEventType.UI_REFRESH, {
        action: 'type_toggled',
        type,
        enable,
      });
    } catch (error) {
      console.error(`[Script] Failed to toggle script type state: ${type}`, error);
      toastr.error(`Failed to toggle script type state: ${type}`);
    }
  }

  /**
   * Run single script
   * @param script Script object
   * @param type Script type (GLOBAL/CHARACTER)
   */
  public async runScript(script: Script, type: ScriptType): Promise<void> {
    // Check if the extension is enabled
    if (!getSettingValue('enabled_extension')) {
      toastr.error('[Script] Extension not enabled');
      return;
    }

    // Check if the corresponding type of script is enabled
    if (type === ScriptType.GLOBAL && !this.scriptData.isGlobalScriptEnabled) {
      return;
    }
    if (type === ScriptType.CHARACTER && !this.scriptData.isCharacterScriptEnabled) {
      return;
    }

    // run script
    await this.executor.runScript(script, type);

    // Process button
    if (script.buttons && script.buttons.length > 0) {
      scriptEvents.emit(ScriptRepositoryEventType.BUTTON_ADD, { script });
    }
  }

  /**
   * Stop single script
   * @param script Script object
   * @param type Script type (GLOBAL/CHARACTER)
   */
  public async stopScript(script: Script, type: ScriptType): Promise<void> {
    await this.executor.stopScript(script, type);

    // Process button
    if (script.buttons && script.buttons.length > 0) {
      scriptEvents.emit(ScriptRepositoryEventType.BUTTON_REMOVE, { scriptId: script.id });
    }
  }

  /**
   * Run all scripts of specified type
   * @param scripts Script array
   * @param type Script type (GLOBAL/CHARACTER)
   */
  public async runScriptsByType(scripts: Script[], type: ScriptType): Promise<void> {
    if (!getSettingValue('enabled_extension')) {
      toastr.error('[Script] Tavern Helper not enabled, cannot run scripts');
      return;
    }

    // Check if the corresponding type of script is enabled
    if (type === ScriptType.GLOBAL && !this.scriptData.isGlobalScriptEnabled) {
      return;
    }
    if (type === ScriptType.CHARACTER && !this.scriptData.isCharacterScriptEnabled) {
      return;
    }

    // Filter enabled scripts
    const enabledScripts = scripts.filter(script => script.enabled);

    // Run each script
    for (const script of enabledScripts) {
      await this.executor.runScript(script, type);

      // Process button
      if (script.buttons && script.buttons.length > 0) {
        scriptEvents.emit(ScriptRepositoryEventType.BUTTON_ADD, { script });
      }
    }
  }

  /**
   * Stop all scripts of specified type
   * @param scripts Script array
   * @param type Script type (GLOBAL/CHARACTER)
   */
  public async stopScriptsByType(scripts: Script[], type: ScriptType): Promise<void> {
    const enabledScripts = scripts.filter(script => script.enabled);

    for (const script of enabledScripts) {
      await this.executor.stopScript(script, type);

      // Process button
      if (script.buttons && script.buttons.length > 0) {
        scriptEvents.emit(ScriptRepositoryEventType.BUTTON_REMOVE, { scriptId: script.id });
      }
    }
  }

  /**
   * Import script
   * @param file File object
   * @param type Target script type (GLOBAL/CHARACTER)
   */
  public async importScript(file: File, type: ScriptType): Promise<void> {
    try {
      const content = await this.readFileAsText(file);
      const scriptData = JSON.parse(content);

      if (!scriptData.name || !scriptData.content) {
        throw new Error('Invalid script data');
      }

      // Create new script object, disabled by default
      const scriptToImport = new Script({
        ...scriptData,
        enabled: false,
      });

      // Check for ID conflicts in both global and character scripts
      const globalScripts = this.scriptData.getGlobalScripts();
      const characterScripts = this.scriptData.getCharacterScripts();

      // Check for conflicts in global scripts
      const conflictInGlobal = globalScripts.find(script => script.id === scriptToImport.id);
      // Check for conflicts in character scripts
      const conflictInCharacter = characterScripts.find(script => script.id === scriptToImport.id);

      // Determine if conflict exists and its type
      let existingScript: Script | undefined;
      let conflictType: ScriptType | undefined;

      if (conflictInGlobal) {
        existingScript = conflictInGlobal;
        conflictType = ScriptType.GLOBAL;
      } else if (conflictInCharacter) {
        existingScript = conflictInCharacter;
        conflictType = ScriptType.CHARACTER;
      }

      // Handle conflict if exists
      if (existingScript && conflictType) {
        const action = await this.handleScriptIdConflict(scriptToImport, existingScript, type);

        switch (action) {
          case 'new':
            // Generate new ID
            scriptToImport.id = uuidv4();
            await this.saveScript(scriptToImport, type);
            break;
          case 'override':
            // First delete conflicting script (note: use actual type of conflicting script)
            await this.deleteScript(existingScript.id, conflictType);
            // Save new script to target type
            await this.saveScript(scriptToImport, type);
            break;
          case 'cancel':
            return;
        }
      } else {
        // No conflict, save directly
        await this.saveScript(scriptToImport, type);
      }

      scriptEvents.emit(ScriptRepositoryEventType.UI_REFRESH, {
        action: 'script_imported',
        script: scriptToImport,
        type,
      });

      toastr.success(`Script '${scriptToImport.name}' imported successfully.`);
    } catch (error) {
      console.error('[script_repository] Script import failed:', error);
      toastr.error('Invalid JSON file.');
    }
  }

  /**
   * Read file content as text - uses Promise instead of callbacks
   * @param file File object
   * @returns File content
   */
  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target?.result as string);
      reader.onerror = e => reject(e);
      reader.readAsText(file);
    });
  }

  /**
   * Save script
   * @param script Script object
   * @param type Script type (GLOBAL/CHARACTER)
   */
  public async saveScript(script: Script, type: ScriptType): Promise<void> {
    await this.scriptData.saveScript(script, type);
    scriptEvents.emit(ScriptRepositoryEventType.UI_REFRESH, {
      action: 'script_saved',
      script,
      type,
    });
  }

  /**
   * Save script order
   * @param scripts Sorted script array
   * @param type Script type (GLOBAL/CHARACTER)
   */
  public async saveScriptsOrder(scripts: Script[], type: ScriptType): Promise<void> {
    if (type === ScriptType.GLOBAL) {
      await this.scriptData.saveGlobalScripts(scripts);
    } else {
      await this.scriptData.saveCharacterScripts(scripts);
    }

    // Refresh local data
    this.scriptData.loadScripts();
  }

  /**
   * Delete script
   * @param scriptId Script ID
   * @param type Script type (GLOBAL/CHARACTER)
   */
  public async deleteScript(scriptId: string, type: ScriptType): Promise<void> {
    const script = this.scriptData.getScriptById(scriptId);
    if (!script) {
      throw new Error('[Script] Script does not exist');
    }

    // First stop the script
    await this.stopScript(script, type);

    // Delete the script
    await this.scriptData.deleteScript(scriptId, type);

    scriptEvents.emit(ScriptRepositoryEventType.UI_REFRESH, {
      action: 'script_deleted',
      scriptId,
      type,
    });
  }

  /**
   * Move script to different type
   * @param script Script object
   * @param fromType Source script type
   */
  public async moveScript(script: Script, fromType: ScriptType): Promise<void> {
    // First stop the script
    await this.stopScript(script, fromType);

    // Determine target type
    const targetType = fromType === ScriptType.GLOBAL ? ScriptType.CHARACTER : ScriptType.GLOBAL;

    // Check if script with same ID exists in target type
    const existingScriptInTarget = this.scriptData.getScriptById(script.id);
    const existingScriptType = existingScriptInTarget ? this.scriptData.getScriptType(existingScriptInTarget) : null;

    // Only handle conflict if same ID exists in target type
    if (existingScriptInTarget && existingScriptType === targetType) {
      const action = await this.handleScriptIdConflict(script, existingScriptInTarget, targetType);

      switch (action) {
        case 'new':
            // Generate new ID
          script.id = uuidv4();
          break;
        case 'override':
            // First delete script in target type
          await this.deleteScript(existingScriptInTarget.id, targetType);
          break;
        case 'cancel':
            // Cancel move operation
          return;
      }
    }

    // Move the script
    await this.scriptData.moveScriptToOtherType(script, fromType);

    scriptEvents.emit(ScriptRepositoryEventType.UI_REFRESH, {
      action: 'script_moved',
      script,
      fromType,
      targetType,
    });

    // If target type is enabled and script is enabled, start script
    if (
      script.enabled &&
      ((targetType === ScriptType.GLOBAL && this.scriptData.isGlobalScriptEnabled) ||
        (targetType === ScriptType.CHARACTER && this.scriptData.isCharacterScriptEnabled))
    ) {
      await this.runScript(script, targetType);
    }
  }

  /**
   * Refresh character script data
   */
  public refreshCharacterScriptData(): void {
    this.scriptData.getCharacterScripts();
  }

  /**
   * Get global scripts
   */
  public getGlobalScripts(): Script[] {
    return this.scriptData.getGlobalScripts();
  }

  /**
   * Get character scripts
   */
  public getCharacterScripts(): Script[] {
    return this.scriptData.getCharacterScripts();
  }

  /**
   * Refresh character script enabled state
   */
  public refreshCharacterScriptEnabledState(): void {
    this.scriptData.refreshCharacterScriptEnabledState();
  }

  /**
   * Get global script enabled state
   */
  public get isGlobalScriptEnabled(): boolean {
    return this.scriptData.isGlobalScriptEnabled;
  }

  /**
   * Get character script enabled state
   */
  public get isCharacterScriptEnabled(): boolean {
    return this.scriptData.isCharacterScriptEnabled;
  }

  /**
   * Get script by ID
   * @param id Script ID
   */
  public getScriptById(id: string): Script | undefined {
    return this.scriptData.getScriptById(id);
  }

  /**
   * Clean up all resources
   */
  public async cleanup(): Promise<void> {
    await this.executor.clearAllScriptsIframe();
  }

  /**
   * Handle script ID conflict
   * @param script Script to process
   * @param existingScript Existing script
   * @param targetType Target script type
   * @returns Resolution: 'new' - use new ID, 'override' - overwrite existing, 'cancel' - abort
   */
  public async handleScriptIdConflict(
    script: Script,
    existingScript: Script,
    targetType: ScriptType,
  ): Promise<'new' | 'override' | 'cancel'> {
    // Get existing script type text
    const existingScriptType = this.scriptData.getScriptType(existingScript);
    const existingTypeText = existingScriptType === ScriptType.GLOBAL ? '全局脚本' : '角色脚本';

    // Get target type text
    const targetTypeText = targetType === ScriptType.GLOBAL ? '全局脚本' : '角色脚本';

    // Show conflict resolution options
    const input = await callGenericPopup(
      `要${targetType === existingScriptType ? '导入' : '移动'}的脚本 '${script.name}' 与${existingTypeText}库中的 '${
        existingScript.name
      }' id 相同，是否要继续操作？`,
      POPUP_TYPE.TEXT,
      '',
      {
        okButton: '覆盖原脚本',
        cancelButton: '取消',
        customButtons: ['新建脚本'],
      },
    );

    let action: 'new' | 'override' | 'cancel' = 'cancel';

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

    return action;
  }
}
