import { purgeEmbeddedScripts, ScriptData } from '@/component/script_repository/data';
import { scriptEvents, ScriptRepositoryEventType } from '@/component/script_repository/events';
import { ScriptManager } from '@/component/script_repository/script_controller';
import { Script, ScriptType } from '@/component/script_repository/types';
import { UIController } from '@/component/script_repository/ui_controller';
import { extensionFolderPath } from '@/util/extension_variables';

import {
  bindQrEnabledChangeListener,
  checkQrEnabledStatusAndAddButton,
  unbindQrEnabledChangeListener,
} from '@/component/script_repository/button';
import { event_types, eventSource, this_chid } from '@sillytavern/script';
import { callGenericPopup, POPUP_TYPE } from '@sillytavern/scripts/popup';
import { loadFileToDocument, uuidv4 } from '@sillytavern/scripts/utils';
const load_events = [event_types.CHAT_CHANGED] as const;
const delete_events = [event_types.CHARACTER_DELETED] as const;

/**
 * Script repository application - uses event-driven architecture
 * Integrates ScriptManager and UIManager to provide a unified interface
 */
export class ScriptRepositoryApp {
  private static instance: ScriptRepositoryApp;
  private scriptManager: ScriptManager;
  private uiManager: UIController;
  private initialized: boolean = false;

  private constructor() {
    this.scriptManager = ScriptManager.getInstance();
    this.uiManager = UIController.getInstance();

    // Listen for character switch events
    this.registerEvents();
  }

  /**
   * Get application instance
   */
  public static getInstance(): ScriptRepositoryApp {
    if (!ScriptRepositoryApp.instance) {
      ScriptRepositoryApp.instance = new ScriptRepositoryApp();
    }
    return ScriptRepositoryApp.instance;
  }

  /**
   * Destroy application instance
   */
  public static destroyInstance(): void {
    if (ScriptRepositoryApp.instance) {
      ScriptRepositoryApp.instance.cleanup();
      ScriptRepositoryApp.instance = undefined as unknown as ScriptRepositoryApp;
      ScriptManager.destroyInstance();
      UIController.destroyInstance();
      ScriptData.destroyInstance();
      unbindQrEnabledChangeListener();
    }
  }

  /**
   * Initialize application
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await loadFileToDocument(
        `/scripts/extensions/${extensionFolderPath}/src/component/script_repository/public/style.css`,
        'css',
      );
      await this.uiManager.initialize();
      this.initialized = true;
    } catch (error) {
      console.error('[script_repository] Initialization failed:', error);
      this.initialized = false;
    }
  }

  /**
   * Register event listeners
   */
  private registerEvents(): void {
    load_events.forEach(eventType => {
      eventSource.on(eventType, this.refreshCharacterRepository.bind(this));
    });

    delete_events.forEach(eventType => {
      eventSource.on(eventType, (character: any) => purgeEmbeddedScripts({ character }));
    });
  }

  /**
   * Refresh character script repository
   */
  private async refreshCharacterRepository(): Promise<void> {
    if (!this.initialized) {
      return;
    }
    // Clean up iframe from previous character script repository
    const previousCharacterScripts: Script[] = [];
    $(`#character-script-list`)
      .find('.script-item')
      .each((_index, element) => {
        const $element = $(element);
        const scriptId = $element.attr('id');
        if (scriptId) {
          const script = this.scriptManager.getScriptById(scriptId);
          if (script) {
            previousCharacterScripts.push(script);
          }
        }
      });
    this.scriptManager.stopScriptsByType(previousCharacterScripts, ScriptType.CHARACTER);

    // Get global and character scripts
    const scriptData = ScriptData.getInstance();
    const globalScripts = this.scriptManager.getGlobalScripts();
    const characterScripts = this.scriptManager.getCharacterScripts();

    this.scriptManager.refreshCharacterScriptEnabledState();

    console.info('[script_repository] Refreshing character script repository');

    if (this_chid && characterScripts.length > 0) {
      await this.uiManager.checkEmbeddedScripts(this_chid);
    }

    // Check for ID conflicts
    const conflictScripts = characterScripts.filter(charScript =>
      globalScripts.some(globalScript => globalScript.id === charScript.id),
    );

    // Handle conflicting scripts
    if (conflictScripts.length > 0) {
      console.info(`[script_repository] Found ${conflictScripts.length} script ID conflicts`);

      for (const charScript of conflictScripts) {
        const globalScript = globalScripts.find(gs => gs.id === charScript.id)!;

        // Create conflict resolution popup
        const result = await callGenericPopup(
          `Global script "${globalScript.name}" already exists. Disable conflicting script?`,
          POPUP_TYPE.TEXT,
          '',
          {
            okButton: 'Disable global',
            cancelButton: 'Disable local',
          },
        );

        // Regardless of choice, modify local script ID to avoid conflicts
        charScript.id = uuidv4();

        // Disable corresponding script based on user choice
        if (result) {
          if (globalScript.enabled) {
            await this.scriptManager.stopScript(globalScript, ScriptType.GLOBAL);
            globalScript.enabled = false;
            console.info(`[script_repository] Disabled global script: ${globalScript.name}`);
            scriptEvents.emit(ScriptRepositoryEventType.UI_REFRESH, {
              action: 'script_toggled',
              script: globalScript,
              type: ScriptType.GLOBAL,
              enable: false,
            });
            scriptData.saveGlobalScripts(globalScripts);
          }
        } else if (charScript.enabled) {
          charScript.enabled = false;
          await scriptData.saveCharacterScripts(characterScripts);
            console.info(`[script_repository] Disabled local script: ${charScript.name}`);
        }
      }
    }

    scriptEvents.emit(ScriptRepositoryEventType.UI_REFRESH, { action: 'refresh_charact_scripts' });
    checkQrEnabledStatusAndAddButton();
    // Rebind event listeners after chat switch
    bindQrEnabledChangeListener();

    // Run all enabled character scripts
    await this.scriptManager.runScriptsByType(characterScripts, ScriptType.CHARACTER);
  }

  /**
   * Clean up resources
   */
  public async cleanup(): Promise<void> {
    try {
      load_events.forEach(eventType => {
        eventSource.removeListener(eventType, this.refreshCharacterRepository.bind(this));
      });

      // Clean up component resources
      await this.scriptManager.cleanup();
      this.uiManager.cleanup();

      this.initialized = false;
      console.info('[script_repository] Cleanup complete');
    } catch (error) {
      console.error('[script_repository] Cleanup failed:', error);
    }
  }
}

/**
 * Build script repository application
 */
export async function buildScriptRepository(): Promise<void> {
  const app = ScriptRepositoryApp.getInstance();
  await app.initialize();
}

/**
 * Remove script repository application
 */
export async function removeScriptRepository(): Promise<void> {
  ScriptRepositoryApp.destroyInstance();
}

/**
 * Build script repository when extension starts
 */
export async function buildScriptRepositoryOnExtension(): Promise<void> {
  await buildScriptRepository();
}

/**
 * Destroy script repository when extension closes
 */
export function destroyScriptRepositoryOnExtension(): void {
  removeScriptRepository();
}

export { ScriptType };
