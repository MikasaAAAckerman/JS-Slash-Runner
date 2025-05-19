// TODO: Add types for settings variables instead of using any
import { characters, getThumbnailUrl, saveSettingsDebounced, this_chid, user_avatar } from '@sillytavern/script';
import { extension_settings } from '@sillytavern/scripts/extensions';

export const extensionName = 'JS-Slash-Runner';
export const extensionSettingName = 'TavernHelper';

export const extensionFolderPath = `third-party/${extensionName}`;

// Get original avatar images
export const charsPath = '/characters/';
export const getUserAvatarPath = () => `./User Avatars/${user_avatar}`;
export const getCharAvatarPath = () => {
  //@ts-ignore
  const thumbnailPath = getThumbnailUrl('avatar', characters[this_chid].avatar);
  const targetAvatarImg = thumbnailPath.substring(thumbnailPath.lastIndexOf('=') + 1);
  return charsPath + targetAvatarImg;
};

/**
 * Get extension setting value
 *
 * @param path Setting key path
 * @param default_value Default value if key doesn't exist
 * @returns Setting value
 */
export function getSettingValue(path: string, default_value: any = undefined): any {
  // @ts-ignore
  return _.get(extension_settings[extensionSettingName], path, default_value);
}

/**
 * Save extension setting value
 *
 * @param path Setting key path
 * @param value Value to set
 * @returns The set value
 */
export function saveSettingValue<T>(path: string, value: T): T {
  // @ts-ignore
  _.set(extension_settings[extensionSettingName], path, value);
  saveSettingsDebounced();
  return value;
}

/**
 * Get setting value if exists, otherwise set and return default value
 *
 * @param path Setting key path
 * @param default_value Default value to set and return if key doesn't exist
 * @returns Setting value
 */
export async function getOrSaveSettingValue<T>(path: string, default_value: T): Promise<T> {
  // @ts-ignore
  if (_.has(extension_settings[extensionSettingName], path)) {
    return getSettingValue(path);
  }
  return saveSettingValue(path, default_value);
}
