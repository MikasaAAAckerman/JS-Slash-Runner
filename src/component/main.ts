import {
  destroyMacroOnExtension,
  initializeMacroOnExtension,
  registerAllMacros,
  unregisterAllMacros,
} from '@/component/macro';
import {
  addCodeToggleButtonsToAllMessages,
  addRenderingHideStyleSettings,
  addRenderingOptimizeSettings,
  partialRenderEvents,
  removeRenderingHideStyleSettings,
  removeRenderingOptimizeSettings,
  renderAllIframes,
  renderMessageAfterDelete,
  renderPartialIframes,
  tampermonkey_script,
  viewport_adjust_script,
} from '@/component/message_iframe';
import { destroyCharacterLevelOnExtension, initializeCharacterLevelOnExtension } from '@/component/script_iframe';
import {
  buildScriptRepositoryOnExtension,
  destroyScriptRepositoryOnExtension,
} from '@/component/script_repository/index';
import { iframe_client } from '@/iframe_client/index';
import { handleIframe } from '@/iframe_server/index';
import { checkVariablesEvents, clearTempVariables, shouldUpdateVariables } from '@/iframe_server/variables';
import { script_url } from '@/script_url';
import { getSettingValue, saveSettingValue } from '@/util/extension_variables';
import { initializeToastr } from '@/component/toastr';
import { eventSource, event_types, reloadCurrentChat, saveSettingsDebounced, this_chid } from '@sillytavern/script';

const handleChatChanged = async () => {
  await renderAllIframes();
  if (getSettingValue('render.rendering_optimize')) {
    addCodeToggleButtonsToAllMessages();
  }
};

const handlePartialRender = (mesId: string) => {
  const mesIdNumber = parseInt(mesId, 10);
  renderPartialIframes(mesIdNumber);
};

const handleMessageDeleted = (mesId: string) => {
  const mesIdNumber = parseInt(mesId, 10);
  clearTempVariables();
  renderMessageAfterDelete(mesIdNumber);
  if (getSettingValue('render.rendering_optimize')) {
    addCodeToggleButtonsToAllMessages();
  }
};

const handleVariableUpdated = (mesId: string) => {
  const mesIdNumber = parseInt(mesId, 10);
  shouldUpdateVariables(mesIdNumber);
};

/**
 * Initialize main extension settings panel
 */
export function initExtensionMainPanel() {
  const isEnabled = getSettingValue('enabled_extension');
  if (isEnabled) {
    handleExtensionToggle(false, true);
  }
  $('#extension-enable-toggle')
    .prop('checked', isEnabled)
    .on('change', function (event: JQuery.ChangeEvent) {
      handleExtensionToggle(true, $(event.currentTarget).prop('checked'));
    });
}

async function handleExtensionToggle(userAction: boolean = true, enable: boolean = true) {
  if (userAction) {
    saveSettingValue('enabled_extension', enable);
  }
  if (enable) {
    // Status indicator styling
    $('#extension-status-icon').css('color', 'green').next().text('Extension enabled');

    script_url.set('iframe_client', iframe_client);
    script_url.set('viewport_adjust_script', viewport_adjust_script);
    script_url.set('tampermonkey_script', tampermonkey_script);

    registerAllMacros();
    initializeToastr();
    initializeMacroOnExtension();
    initializeCharacterLevelOnExtension();
    buildScriptRepositoryOnExtension();

    // Re-inject frontend card optimization styles and settings
    if (userAction && getSettingValue('render.rendering_optimize')) {
      addRenderingOptimizeSettings();
    }
    if (userAction && getSettingValue('render.render_hide_style')) {
      addRenderingHideStyleSettings();
    }

    window.addEventListener('message', handleIframe);

    eventSource.on(event_types.CHAT_CHANGED, handleChatChanged);

    partialRenderEvents.forEach(eventType => {
      eventSource.on(eventType, handlePartialRender);
    });

    checkVariablesEvents.forEach(eventType => {
      eventSource.on(eventType, handleVariableUpdated);
    });
    eventSource.on(event_types.MESSAGE_DELETED, handleMessageDeleted);
    if (userAction && this_chid !== undefined) {
      await reloadCurrentChat();
    }
  } else {
    // Status indicator styling
    $('#extension-status-icon').css('color', 'red').next().text('Extension disabled');

    script_url.delete('iframe_client');
    script_url.delete('viewport_adjust_script');
    script_url.delete('tampermonkey_script');

    unregisterAllMacros();
    destroyMacroOnExtension();
    destroyCharacterLevelOnExtension();
    destroyScriptRepositoryOnExtension();

    if (getSettingValue('render.rendering_optimize')) {
      removeRenderingOptimizeSettings();
    }

    if (getSettingValue('render.render_hide_style')) {
      removeRenderingHideStyleSettings();
    }

    window.removeEventListener('message', handleIframe);

    eventSource.removeListener(event_types.CHAT_CHANGED, handleChatChanged);

    partialRenderEvents.forEach(eventType => {
      eventSource.removeListener(eventType, handlePartialRender);
    });
    checkVariablesEvents.forEach(eventType => {
      eventSource.removeListener(eventType, handleVariableUpdated);
    });
    eventSource.removeListener(event_types.MESSAGE_DELETED, handleMessageDeleted);
    if (userAction && this_chid !== undefined) {
      await reloadCurrentChat();
    }
  }
  saveSettingsDebounced();
}
