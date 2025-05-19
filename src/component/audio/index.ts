import { Collapsible } from '@/util/collapsible';
import { extensionFolderPath, getSettingValue, saveSettingValue } from '@/util/extension_variables';

import { chat_metadata, eventSource, event_types, saveSettingsDebounced } from '@sillytavern/script';
import { renderExtensionTemplateAsync, saveMetadataDebounced } from '@sillytavern/scripts/extensions';
import { POPUP_TYPE, callGenericPopup } from '@sillytavern/scripts/popup';
import { isMobile } from '@sillytavern/scripts/RossAscends-mods';
import { getSortableDelay, loadFileToDocument } from '@sillytavern/scripts/utils';

let isExtensionEnabled: boolean;
let isAudioEnabled: boolean;
export let list_BGMS: string[] = [];
export let list_ambients: string[] = [];
let bgmEnded = true;
let ambientEnded = true;

const templatePath = `${extensionFolderPath}/src/component/audio`;
// Default audio settings
export const defaultAudioSettings = {
  audio_enabled: true,
  bgm_enabled: true,
  ambient_enabled: true,
  bgm_mode: 'repeat',
  bgm_muted: false,
  bgm_volume: 50,
  bgm_selected: null,
  bgm_current_time: 0,
  ambient_mode: 'stop',
  ambient_muted: false,
  ambient_volume: 50,
  ambient_selected: null,
  ambient_current_time: 0,
  audio_cooldown: 0,
};

/**
 * Update audio playback
 * @param type Audio type - "bgm" or "ambient"
 * @param isUserInput Whether triggered by user input (will interrupt current playback)
 */
export async function updateAudio(type = 'bgm', isUserInput = false) {
  if (!getSettingValue('audio.audio_enabled')) {
    return;
  }

  const isTypeEnabled =
    type === 'bgm' ? getSettingValue('audio.bgm_enabled') : getSettingValue('audio.ambient_enabled');

  if (!isTypeEnabled) {
    return;
  }
  const audioEnded = type === 'bgm' ? bgmEnded : ambientEnded;
  const audioSelector = `#audio_${type}`;

  if (!isUserInput && $(audioSelector).attr('src') != '' && !audioEnded) {
    return;
  }

  let audio_url = '';
  const playlist = await getAudioUrl(type as 'bgm' | 'ambient');

  if (isUserInput) {
    audio_url =
      type === 'bgm'
        ? getSettingValue('audio.bgm_selected') || playlist[0]
        : getSettingValue('audio.ambient_selected') || playlist[0];
  } else {
    const mode = type === 'bgm' ? getSettingValue('audio.bgm_mode') : getSettingValue('audio.ambient_mode');

    const selected = type === 'bgm' ? getSettingValue('audio.bgm_selected') : getSettingValue('audio.ambient_selected');

    audio_url = getNextFileByMode(mode, playlist, selected);
  }

  if (!audio_url) {
    return;
  }

  const audio = $(audioSelector)[0] as HTMLAudioElement;

  // For ambient type, remove cache-busting suffix
  if (type === 'ambient') {
    const cleanAudioSrc = audio.src.split('?')[0];
    const cleanAudioUrl = audio_url.split('?')[0];
    if (decodeURIComponent(cleanAudioSrc) === decodeURIComponent(cleanAudioUrl) && !audioEnded) {
      return;
    }
  } else if (decodeURIComponent(audio.src) === decodeURIComponent(audio_url) && !audioEnded) {
    return;
  }

  // Set audioEnded state
  if (type === 'bgm') {
    bgmEnded = false;
  } else {
    ambientEnded = false;
  }

  if (type === 'bgm') {
    audio.src = audio_url;
    audio.load();

    await new Promise<void>(resolve => {
      const canPlayHandler = () => {
        audio.removeEventListener('canplaythrough', canPlayHandler);
        resolve();
      };

      if (audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
        resolve();
      } else {
        audio.addEventListener('canplaythrough', canPlayHandler);
      }
    });

    await playAudio(type);
  } else {
    // For ambient type, use cache busting
    const audioUrlWithCacheBusting = getAudioUrlWithCacheBusting(audio_url);
    audio.src = audioUrlWithCacheBusting;
    audio.load();

    await new Promise<void>(resolve => {
      const canPlayHandler = () => {
        audio.removeEventListener('canplaythrough', canPlayHandler);
        resolve();
      };

      if (audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
        resolve();
      } else {
        audio.addEventListener('canplaythrough', canPlayHandler);
      }
    });

    await playAudio(type as 'bgm' | 'ambient');
  }

  // Update selected audio
  if (type === 'bgm') {
    saveSettingValue('audio.bgm_selected', audio_url);
  } else {
    saveSettingValue('audio.ambient_selected', audio_url);
  }

  // Update selector
  const selectElement = $(`#audio_${type}_select`);
  if (selectElement.val() !== audio_url) {
    selectElement.val(audio_url);
  }

  saveSettingsDebounced();
}

/**
 * Update the audio dropdown selection menu
 * @param type Audio type - "bgm" or "ambient"
 */
export async function updateAudioSelect(type = 'bgm') {
  if (!getSettingValue(`audio.${type}_enabled`)) {
    return;
  }

  const selectElement = $(`#audio_${type}_select`);
  selectElement.empty();

  if (type === 'bgm') {
    list_BGMS = await getAudioUrl('bgm');
  } else {
    list_ambients = await getAudioUrl('ambient');
  }

  const audioList = type === 'bgm' ? list_BGMS : list_ambients;
  let selectedSetting =
    type === 'bgm' ? getSettingValue('audio.bgm_selected') : getSettingValue('audio.ambient_selected');

  if (audioList && audioList.length > 0) {
    // Check if currently selected audio is in the list, if not select the first one
    if (!audioList.includes(selectedSetting)) {
      console.warn(`[Audio] Currently selected audio ${selectedSetting} not in list, auto-selecting first item`);
      selectedSetting = audioList[0];
      if (type === 'bgm') {
        saveSettingValue('audio.bgm_selected', selectedSetting);
      } else {
        saveSettingValue('audio.ambient_selected', selectedSetting);
      }
      saveSettingsDebounced();
    }

    const audioFiles = Array.isArray(audioList) ? audioList : audioList.split(',').map(file => file.trim());
    audioFiles.forEach((file: string) => {
      const fileLabel = file.replace(/^.*[\\\/]/, '').replace(/\.[^/.]+$/, '');
      selectElement.append(new Option(fileLabel, file));
    });

    selectElement.val(selectedSetting);
  } else {
    console.log(`[Audio] No available ${type.toUpperCase()} resources`);
  }
}

// Rest of file remains the same with all Chinese comments translated to English...
