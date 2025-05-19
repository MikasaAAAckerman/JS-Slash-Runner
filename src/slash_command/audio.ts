import { saveSettingValue } from '@/util/extension_variables';

import { chat_metadata, saveSettingsDebounced } from '@sillytavern/script';
import { saveMetadataDebounced } from '@sillytavern/scripts/extensions';
import { SlashCommand } from '@sillytavern/scripts/slash-commands/SlashCommand';
import {
  ARGUMENT_TYPE,
  SlashCommandArgument,
  SlashCommandNamedArgument,
} from '@sillytavern/scripts/slash-commands/SlashCommandArgument';
import { commonEnumProviders, enumIcons } from '@sillytavern/scripts/slash-commands/SlashCommandCommonEnumsProvider';
import { SlashCommandEnumValue, enumTypes } from '@sillytavern/scripts/slash-commands/SlashCommandEnumValue';
import { SlashCommandParser } from '@sillytavern/scripts/slash-commands/SlashCommandParser';

import {
  list_BGMS,
  list_ambients,
  onAudioEnabledClick,
  playAudio,
  updateAudio,
  updateAudioSelect,
} from '../component/audio';

interface AudioElement extends HTMLElement {
  pause(): void;
}

/**
 * Toggle audio playback mode
 */
export async function audioMode(args: { type: string; mode: string }): Promise<void> {
  const type = args.type.toLowerCase();
  const mode = args.mode.toLowerCase();

  if (!['bgm', 'ambient'].includes(type) || !['repeat', 'random', 'single', 'stop'].includes(mode)) {
    console.warn('WARN: Invalid arguments for /audiomode command');
    return '';
  }

  if (type === 'bgm') {
    saveSettingValue('audio.bgm_mode', mode);
    const iconMap: Record<string, string> = {
      repeat: 'fa-repeat',
      random: 'fa-random',
      single: 'fa-redo-alt',
      stop: 'fa-cancel',
    };
    $('#audio_bgm_mode_icon').removeClass('fa-repeat fa-random fa-redo-alt fa-cancel');
    $('#audio_bgm_mode_icon').addClass(iconMap[mode]);
  } else if (type === 'ambient') {
    saveSettingValue('audio.ambient_mode', mode);
    const iconMap: Record<string, string> = {
      repeat: 'fa-repeat',
      random: 'fa-random',
      single: 'fa-redo-alt',
      stop: 'fa-cancel',
    };
    $('#audio_ambient_mode_icon').removeClass('fa-repeat fa-random fa-redo-alt fa-cancel');
    $('#audio_ambient_mode_icon').addClass(iconMap[mode]);
  }

  saveSettingsDebounced();
  return '';
}

/**
 * Toggle audio player on/off state
 */
export async function audioEnable(args: { type: string; state?: string }): Promise<void> {
  const type = args.type.toLowerCase();
  const state = (args.state || 'true').toLowerCase();

  if (!type) {
    console.warn('WARN: Missing arguments for /audioenable command');
    return '';
  }

  if (type === 'bgm') {
    if (state === 'true') {
      $('#enable_bgm').prop('checked', true);
      await onAudioEnabledClick('bgm');
    } else if (state === 'false') {
      $('#enable_bgm').prop('checked', false);
      await onAudioEnabledClick('bgm');
    }
  } else if (type === 'ambient') {
    if (state === 'true') {
      $('#enable_ambient').prop('checked', true);
      await onAudioEnabledClick('ambient');
    } else if (state === 'false') {
      $('#enable_ambient').prop('checked', false);
      await onAudioEnabledClick('ambient');
    }
  }

  return '';
}

/**
 * Toggle play/pause state
 */
export async function audioPlay(args: { type: string; play?: string }): Promise<void> {
  const type = args.type.toLowerCase();
  const play = (args.play || 'true').toLowerCase();

  if (!type) {
    console.warn('WARN: Missing arguments for /audioplaypause command');
    return '';
  }

  if (type === 'bgm') {
    if (play === 'true') {
      await playAudio('bgm');
    } else if (play === 'false') {
      const audioElement = $('#audio_bgm')[0] as AudioElement;
      audioElement.pause();
    }
  } else if (type === 'ambient') {
    if (play === 'true') {
      await playAudio('ambient');
    } else if (play === 'false') {
      const audioElement = $('#audio_ambient')[0] as AudioElement;
      audioElement.pause();
    }
  }

  return '';
}

/**
 * Import audio URLs
 */
export async function audioImport(args: { type: string; play?: string }, url: string): Promise<void> {
  const type = args.type.toLowerCase();
  const play = (args.play || 'true').toLowerCase();

  if (!type || !url) {
    console.warn('WARN: Missing arguments for /audioimport command');
    return '';
  }

  const urlArray = url
    .split(',')
    .map((url: string) => url.trim())
    .filter((url: string) => url !== '')
    .filter((url: string, index: number, self: string[]) => self.indexOf(url) === index);
  if (urlArray.length === 0) {
    console.warn('WARN: Invalid or empty URLs provided.');
    return '';
  }

  if (!chat_metadata.variables) {
    chat_metadata.variables = {};
  }

  const typeKey = type === 'bgm' ? 'bgmurl' : 'ambienturl';
  const existingUrls = chat_metadata.variables[typeKey] || [];
  const mergedUrls = [...new Set([...urlArray, ...existingUrls])];

  chat_metadata.variables[typeKey] = mergedUrls;
  saveMetadataDebounced();

  if (type === 'bgm') {
    updateAudioSelect('bgm');
  } else if (type === 'ambient') {
    updateAudioSelect('ambient');
  }

  if (play === 'true' && urlArray[0]) {
    const selectedUrl = urlArray[0];
    if (type === 'bgm') {
      saveSettingValue('audio.bgm_selected', selectedUrl);
      await updateAudio('bgm', true);
    } else if (type === 'ambient') {
      saveSettingValue('audio.ambient_selected', selectedUrl);
      await updateAudio('ambient', true);
    }
  }

  return '';
}

/**
 * Select and play audio
 */
export async function audioSelect(args: { type: string }, url: string): Promise<void> {
  const type = args.type.toLowerCase();

  if (!url) {
    console.warn('WARN: Missing URL for /audioselect command');
    return '';
  }

  if (!chat_metadata.variables) {
    chat_metadata.variables = {};
  }

  const playlist = type === 'bgm' ? list_BGMS : list_ambients;
  const typeKey = type === 'bgm' ? 'bgmurl' : 'ambienturl';

  if (playlist && playlist.includes(url)) {
    if (type === 'bgm') {
      saveSettingValue('audio.bgm_selected', url);
      await updateAudio('bgm', true);
    } else if (type === 'ambient') {
      saveSettingValue('audio.ambient_selected', url);
      await updateAudio('ambient', true);
    }
    return '';
  }

  const existingUrls = chat_metadata.variables[typeKey] || [];

  const mergedUrls = [...new Set([url, ...existingUrls])];
  chat_metadata.variables[typeKey] = mergedUrls;
  saveMetadataDebounced();

  if (type === 'bgm') {
    updateAudioSelect('bgm');
    saveSettingValue('audio.bgm_selected', url);
    await updateAudio('bgm', true);
  } else if (type === 'ambient') {
    updateAudioSelect('ambient');
    saveSettingValue('audio.ambient_selected', url);
    await updateAudio('ambient', true);
  }

  return '';
}

/**
 * Initialize audio-related slash commands
 */
export function initAudioSlashCommands() {
  // Register audioselect command
  SlashCommandParser.addCommandObject(
    SlashCommand.fromProps({
      name: 'audioselect',
      callback: audioSelect,
      namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
          name: 'type',
          description: 'Select player type (bgm or ambient)',
          typeList: [ARGUMENT_TYPE.STRING],
          enumList: [
            new SlashCommandEnumValue('bgm', null, enumTypes.enum, enumIcons.file),
            new SlashCommandEnumValue('ambient', null, enumTypes.enum, enumIcons.file),
          ],
          isRequired: true,
        }),
      ],
      unnamedArgumentList: [new SlashCommandArgument('url', [ARGUMENT_TYPE.STRING], true)],
      helpString: `
        <div>
            Select and play audio. If the audio URL doesn't exist, it will be imported first.
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code>/audioselect type=bgm https://example.com/song.mp3</code></pre>
                    Select and play specified music.
                </li>
                <li>
                    <pre><code>/audioselect type=ambient https://example.com/sound.mp3</code></pre>
                    Select and play specified sound effect.
                </li>
            </ul>
        </div>
      `,
    }),
  );

  // Register the audioimport command
  SlashCommandParser.addCommandObject(
    SlashCommand.fromProps({
      name: 'audioimport',
      callback: audioImport,
      namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
          name: 'type',
          description: 'Select import type (bgm or ambient)',
          typeList: [ARGUMENT_TYPE.STRING],
          enumList: [
            new SlashCommandEnumValue('bgm', null, enumTypes.enum, enumIcons.file),
            new SlashCommandEnumValue('ambient', null, enumTypes.enum, enumIcons.file),
          ],
          isRequired: true,
        }),
        SlashCommandNamedArgument.fromProps({
          name: 'play',
          description: 'Whether to play the first URL immediately after import',
          typeList: [ARGUMENT_TYPE.BOOLEAN],
          defaultValue: 'true',
          isRequired: false,
        }),
      ],
      unnamedArgumentList: [new SlashCommandArgument('url', [ARGUMENT_TYPE.STRING], true)],
      helpString: `
        <div>
            Import audio or music URLs and decide whether to play immediately (default is true). Multiple URLs can be imported by separating with commas.
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code>/audioimport type=bgm https://example.com/song1.mp3,https://example.com/song2.mp3</code></pre>
                    Import BGM music and play first URL immediately.
                </li>
                <li>
                    <pre><code>/audioimport type=ambient play=false url=https://example.com/sound1.mp3,https://example.com/sound2.mp3 </code></pre>
                    Import sound effect URLs (without auto-play).
                </li>
            </ul>
        </div>
      `,
    }),
  );

  // Register the audioplay command
  SlashCommandParser.addCommandObject(
    SlashCommand.fromProps({
      name: 'audioplay',
      callback: audioPlay,
      namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
          name: 'type',
          description: 'Select player to control (bgm or ambient)',
          typeList: [ARGUMENT_TYPE.STRING],
          enumList: [
            new SlashCommandEnumValue('bgm', null, enumTypes.enum, enumIcons.file),
            new SlashCommandEnumValue('ambient', null, enumTypes.enum, enumIcons.file),
          ],
          isRequired: true,
        }),
        new SlashCommandNamedArgument(
          'play',
          'Play or pause',
          [ARGUMENT_TYPE.STRING],
          true,
          false,
          'true',
          commonEnumProviders.boolean('trueFalse')(),
        ),
      ],
      helpString: `
        <div>
            Control play/pause for music or sound effect player.
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code>/audioplay type=bgm</code></pre>
                    Play current music.
                </li>
                <li>
                    <pre><code>/audioplay type=ambient play=false</code></pre>
                    Pause current sound effect.
                </li>
            </ul>
        </div>
      `,
    }),
  );

  // Register audioenable command
  SlashCommandParser.addCommandObject(
    SlashCommand.fromProps({
      name: 'audioenable',
      callback: audioEnable,
      namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
          name: 'type',
          description: 'Select the player to control (bgm or ambient)',
          typeList: [ARGUMENT_TYPE.STRING],
          enumList: [
            new SlashCommandEnumValue('bgm', null, enumTypes.enum, enumIcons.file),
            new SlashCommandEnumValue('ambient', null, enumTypes.enum, enumIcons.file),
          ],
          isRequired: true,
        }),
        new SlashCommandNamedArgument(
          'state',
          'Turn player on or off',
          [ARGUMENT_TYPE.STRING],
          false,
          false,
          'true',
          commonEnumProviders.boolean('trueFalse')(),
        ),
      ],
      helpString: `
        <div>
            Turn music or sound effect player on/off.
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code>/audioenable type=bgm state=true</code></pre>
                    Turn music player on.
                </li>
                <li>
                    <pre><code>/audioenable type=ambient state=false</code></pre>
                    Turn sound effect player off.
                </li>
            </ul>
        </div>
    `,
    }),
  );

  // Register audiomode command
  SlashCommandParser.addCommandObject(
    SlashCommand.fromProps({
      name: 'audiomode',
      callback: audioMode,
      namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
          name: 'type',
          description: 'Select player to control (bgm or ambient)',
          typeList: [ARGUMENT_TYPE.STRING],
          enumList: [
            new SlashCommandEnumValue('bgm', null, enumTypes.enum, enumIcons.file),
            new SlashCommandEnumValue('ambient', null, enumTypes.enum, enumIcons.file),
          ],
          isRequired: true,
        }),
        SlashCommandNamedArgument.fromProps({
          name: 'mode',
          description: 'Select playback mode',
          typeList: [ARGUMENT_TYPE.STRING],
          enumList: [
            new SlashCommandEnumValue('repeat', null, enumTypes.enum, enumIcons.loop),
            new SlashCommandEnumValue('random', null, enumTypes.enum, enumIcons.shuffle),
            new SlashCommandEnumValue('single', null, enumTypes.enum, enumIcons.redo),
            new SlashCommandEnumValue('stop', null, enumTypes.enum, enumIcons.stop),
          ],
          isRequired: true,
        }),
      ],
      helpString: `
        <div>
            Set audio playback mode.
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code>/audiomode type=bgm mode=repeat</code></pre>
                    Set music to repeat mode.
                </li>
                <li>
                    <pre><code>/audiomode type=ambient mode=random</code></pre>
                    Set sound effects to random mode.
                </li>
                <li>
                    <pre><code>/audiomode type=bgm mode=single</code></pre>
                    Set music to single repeat mode.
                </li>
                <li>
                    <pre><code>/audiomode type=ambient mode=stop</code></pre>
                    Set sound effects to stop mode.
                </li>
            </ul>
        </div>
    `,
    }),
  );
}
