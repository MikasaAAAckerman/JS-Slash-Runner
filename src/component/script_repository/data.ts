import { Script, ScriptType } from '@/component/script_repository/types';
import { getSettingValue, saveSettingValue } from '@/util/extension_variables';
import { characters, this_chid } from '@sillytavern/script';
import { writeExtensionField } from '@sillytavern/scripts/extensions';

/**
 * Script data management class
 */
export class ScriptData {
  private static instance: ScriptData;
  private globalScripts: Script[] = [];
  private characterScripts: Script[] = [];
  private _isGlobalScriptEnabled: boolean = false;
  private _isCharacterScriptEnabled: boolean = false;

  private constructor() {
    this.loadScripts();
  }

  public get isGlobalScriptEnabled(): boolean {
    return this._isGlobalScriptEnabled;
  }

  public get isCharacterScriptEnabled(): boolean {
    return this._isCharacterScriptEnabled;
  }

  public static getInstance(): ScriptData {
    if (!ScriptData.instance) {
      ScriptData.instance = new ScriptData();
    }
    return ScriptData.instance;
  }

  public static destroyInstance(): void {
    if (ScriptData.instance) {
      ScriptData.instance = undefined as unknown as ScriptData;
    }
  }

  /**
   * Check if script repository is enabled for current character
   * @returns Whether character scripts are enabled
   */
  public checkCharacterScriptEnabled(): boolean {
    const charactersWithScripts = getSettingValue('script.characters_with_scripts') || [];
    // @ts-ignore
    const avatar = characters?.[this_chid]?.avatar;
    return charactersWithScripts?.includes(avatar) || false;
  }

  /**
   * Load raw script data
   */
  loadScripts() {
    const rawGlobalScripts = getSettingValue('script.scriptsRepository') || [];
    this.globalScripts = rawGlobalScripts.map((scriptData: any) => new Script(scriptData));

    // @ts-ignore
    const rawCharacterScripts = characters[this_chid]?.data?.extensions?.TavernHelper_scripts || [];
    this.characterScripts = rawCharacterScripts.map((scriptData: any) => new Script(scriptData));

    this._isGlobalScriptEnabled = getSettingValue('script.global_script_enabled') ?? false;
    //@ts-ignore
    this._isCharacterScriptEnabled = this.checkCharacterScriptEnabled();
  }

  /**
   * Get global scripts list
   */
  getGlobalScripts(): Script[] {
    return this.globalScripts;
  }

  /**
   * Get character scripts list
   */
  getCharacterScripts(): Script[] {
    // @ts-ignore
    this.characterScripts = characters[this_chid]?.data?.extensions?.TavernHelper_scripts || [];
    return this.characterScripts;
  }

  /**
   * Get script by ID
   * @param id Script ID
   * @returns Script object or undefined if not found
   */
  getScriptById(id: string): Script | undefined {
    let script = this.globalScripts.find((s: Script) => s.id === id);
    if (script) return script;

    script = this.characterScripts.find((s: Script) => s.id === id);
    if (script) return script;

    return undefined;
  }

  /**
   * Save single script to settings - adds if new, updates if exists
   * @param script Script object
   * @param type Script type
   */
  async saveScript(script: Script, type: ScriptType): Promise<void> {
    if (!script.name || script.name.trim() === '') {
      throw new Error('[Script] Save failed - script name is empty');
    }

    const array =
      type === ScriptType.GLOBAL
        ? getSettingValue('script.scriptsRepository') || []
        : // @ts-ignore
          characters[this_chid]?.data?.extensions?.TavernHelper_scripts || [];

    const index = array.findIndex((s: Script) => s.id === script.id);
    if (index === -1) {
      array.push(script);
    } else {
      array[index] = script;
    }

    if (type === ScriptType.GLOBAL) {
      await this.saveGlobalScripts(array);
    } else {
      await this.saveCharacterScripts(array);
    }

    // Update local cache
    this.loadScripts();
  }

  /**
   * Save global scripts array to extension settings
   * @param array Scripts array
   */
  async saveGlobalScripts(array: Script[]): Promise<void> {
    saveSettingValue('script.scriptsRepository', array);
    this.globalScripts = array;
  }

  /**
   * Save scripts array to character card data
   * @param array Scripts array
   */
  async saveCharacterScripts(array: Script[]): Promise<void> {
    if (!this_chid) {
      throw new Error('[Script] Save failed - current character is empty');
    }

    // @ts-ignore
    await writeExtensionField(this_chid, 'TavernHelper_scripts', array);

    this.characterScripts = array;
  }

  /**
   * Delete script from repository
   * @param id Script ID
   * @param type Script type
   */
  async deleteScript(id: string, type: ScriptType): Promise<void> {
    const array =
      type === ScriptType.GLOBAL
        ? getSettingValue('script.scriptsRepository') || []
        : // @ts-ignore
          characters[this_chid]?.data?.extensions?.TavernHelper_scripts || [];

    const existingScriptIndex = array.findIndex((script: Script) => script.id === id);
    if (existingScriptIndex !== -1) {
      array.splice(existingScriptIndex, 1);

      if (type === ScriptType.GLOBAL) {
        await this.saveGlobalScripts(array);
      } else {
        await this.saveCharacterScripts(array);
      }
    } else {
      throw new Error('[Script] Delete failed - script does not exist');
    }
  }

  /**
   * Update script enable state
   * @param type Script type
   * @param enable Whether to enable
   */
  async updateScriptTypeEnableState(type: ScriptType, enable: boolean): Promise<void> {
    if (type === ScriptType.GLOBAL) {
      saveSettingValue('script.global_script_enabled', enable);
      this._isGlobalScriptEnabled = enable;
    } else {
      const charactersWithScripts = getSettingValue('script.characters_with_scripts') || [];
      // @ts-ignore
      const avatar = characters?.[this_chid]?.avatar;

      if (enable) {
        if (avatar && !charactersWithScripts.includes(avatar)) {
          charactersWithScripts.push(avatar);
        }
      } else {
        const index = charactersWithScripts.indexOf(avatar);
        if (index !== -1) {
          charactersWithScripts.splice(index, 1);
        }
      }

      saveSettingValue('script.characters_with_scripts', charactersWithScripts);
      this._isCharacterScriptEnabled = enable;
    }
  }

  /**
   * Get script type
   * @param script Script object
   * @returns Script type
   */
  getScriptType(script: Script): ScriptType {
    return this.globalScripts.some(s => s.id === script.id) ? ScriptType.GLOBAL : ScriptType.CHARACTER;
  }

  /**
   * Move script to different repository type
   * @param script Script object
   * @param sourceType Source repository type
   */
  async moveScriptToOtherType(script: Script, sourceType: ScriptType): Promise<void> {
    // Get the source and target arrays
    const sourceArray =
      sourceType === ScriptType.GLOBAL
        ? getSettingValue('script.scriptsRepository') || []
        : // @ts-ignore
          characters[this_chid]?.data?.extensions?.TavernHelper_scripts || [];

    // Remove from source array
    const sourceIndex = sourceArray.findIndex((s: any) => s.id === script.id);
    if (sourceIndex !== -1) {
      sourceArray.splice(sourceIndex, 1);

      if (sourceType === ScriptType.GLOBAL) {
        await this.saveGlobalScripts(sourceArray);
      } else {
        await this.saveCharacterScripts(sourceArray);
      }

      // Add to target array
      const targetType = sourceType === ScriptType.GLOBAL ? ScriptType.CHARACTER : ScriptType.GLOBAL;
      const targetArray =
        targetType === ScriptType.GLOBAL
          ? getSettingValue('script.scriptsRepository') || []
          : // @ts-ignore
            characters[this_chid]?.data?.extensions?.TavernHelper_scripts || [];

      targetArray.push(script);

      if (targetType === ScriptType.GLOBAL) {
        await this.saveGlobalScripts(targetArray);
      } else {
        await this.saveCharacterScripts(targetArray);
      }

      return;
    }

    throw new Error('[Script] Move failed - script does not exist');
  }

  /**
   * Refresh character script enabled state
   */
  refreshCharacterScriptEnabledState(): void {
    this._isCharacterScriptEnabled = this.checkCharacterScriptEnabled();
  }
}

/**
 * Get character script variables
 * @returns Variables object
 */
export function getCharacterScriptVariables(): Record<string, any> {
  // @ts-ignore
  return characters[this_chid]?.data?.extensions?.TavernHelper_characterScriptVariables || {};
}

/**
 * Replace character script variables
 * @param variables Variables object
 */
export async function replaceCharacterScriptVariables(variables: Record<string, any>): Promise<void> {
  if (!this_chid) {
    throw new Error('[Script] Save variables failed - current character is empty');
  }
  // @ts-ignore
  await writeExtensionField(this_chid, 'TavernHelper_characterScriptVariables', variables);
}

/**
 * Remove character from scripts allow list
 * @param param0
 */
export async function purgeEmbeddedScripts({ character }: { character: any }): Promise<void> {
  const avatar = character?.character?.avatar;
  const charactersWithScripts = getSettingValue('script.characters_with_scripts') || [];

  if (avatar && charactersWithScripts?.includes(avatar)) {
    const index = charactersWithScripts.indexOf(avatar);
    if (index !== -1) {
      charactersWithScripts.splice(index, 1);
      saveSettingValue('script.characters_with_scripts', charactersWithScripts);
    }
  }
}
