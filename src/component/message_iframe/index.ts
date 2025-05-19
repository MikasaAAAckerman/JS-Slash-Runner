import { script_url } from '@/script_url';
import third_party from '@/third_party.html';
import { getCharAvatarPath, getSettingValue, getUserAvatarPath, saveSettingValue } from '@/util/extension_variables';

import { eventSource, event_types, reloadCurrentChat, updateMessageBlock } from '@sillytavern/script';
import { getContext } from '@sillytavern/scripts/extensions';

let isExtensionEnabled: boolean;
let tampermonkeyMessageListener: ((event: MessageEvent) => void) | null = null;
let isRenderEnabled: boolean;
let isRenderingOptimizeEnabled: boolean;
let isRenderingHideStyleEnabled: boolean;
let renderDepth: number;
let isTampermonkeyEnabled: boolean;

// Save original highlight method
const originalHighlightElement = hljs.highlightElement;

const RENDER_MODES = {
  FULL: 'FULL',
  PARTIAL: 'PARTIAL',
};

// Extended Window interface definition
declare global {
  interface Window {
    _sharedResizeObserver?: ResizeObserver;
    _observedElements?: Map<HTMLElement, { iframe: HTMLIFrameElement }>;
    gc?: () => void;
  }
}

export const partialRenderEvents = [
  event_types.CHARACTER_MESSAGE_RENDERED,
  event_types.USER_MESSAGE_RENDERED,
  event_types.MESSAGE_UPDATED,
  event_types.MESSAGE_SWIPED,
];

export const defaultIframeSettings = {
  render_enabled: true,
  tampermonkey_compatibility: false,
  render_depth: 0,
  render_optimize: false,
};

export async function handleRenderToggle(userInput: boolean = true, enable: boolean = true) {
  if (enable) {
    renderMessagesInIframes(RENDER_MODES.FULL);
  }
  if (userInput) {
    saveSettingValue('render.render_enabled', enable);
  }
}

/**
 * Clear and re-render all iframes
 */
export async function clearAndRenderAllIframes() {
  await clearAllIframes();
  await reloadCurrentChat();
  await renderAllIframes();
}

/**
 * Render all iframes
 */
export async function renderAllIframes() {
  await renderMessagesInIframes(RENDER_MODES.FULL);
  console.log('[Render] 渲染所有iframe');
}

/**
 * Render partial iframes
 * @param mesId Message ID
 */
export async function renderPartialIframes(mesId: number) {
  const processDepth = parseInt($('#render-depth').val() as string, 10);
  const context = getContext();
  const totalMessages = context.chat.length;

  if (processDepth > 0) {
    const depthOffset = totalMessages - processDepth;

    if (mesId < depthOffset) {
      return;
    }
  }

  await renderMessagesInIframes(RENDER_MODES.PARTIAL, mesId);

  console.log('[Render] Rendering' + mesId + 'iframe of message number');
}

/**
 * Automatically adjust iframe height when min-height:vh is used
 */
export const viewport_adjust_script = `
$(window).on("message", function (event) {
    if (event.originalEvent.data.request === "updateViewportHeight") {
        const newHeight = event.originalEvent.data.newHeight;
        $("html").css("--viewport-height", newHeight + "px");
    }
});
`;

/**
 * tapermonkey Script
 */
export const tampermonkey_script = `
class AudioManager {
  constructor() {
    this.currentlyPlaying = null;
  }
  handlePlay(audio) {
    if (this.currentlyPlaying && this.currentlyPlaying !== audio) {
      this.currentlyPlaying.pause();
    }
    window.parent.postMessage({
      type: 'audioPlay',
      iframeId: window.frameElement.id
    }, '*');

    this.currentlyPlaying = audio;
  }
  stopAll() {
    if (this.currentlyPlaying) {
      this.currentlyPlaying.pause();
      this.currentlyPlaying = null;
    }
  }
}
const audioManager = new AudioManager();
$('.qr-button').on('click', function() {
  const buttonName = $(this).text().trim();
  window.parent.postMessage({ type: 'buttonClick', name: buttonName }, '*');
});
$('.st-text').each(function() {
  $(this).on('input', function() {
    window.parent.postMessage({ type: 'textInput', text: $(this).val() }, '*');
  });
  $(this).on('change', function() {
    window.parent.postMessage({ type: 'textInput', text: $(this).val() }, '*');
  });
  const textarea = this;
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
        window.parent.postMessage({ type: 'textInput', text: $(textarea).val() }, '*');
      }
    });
  });
  observer.observe(textarea, { attributes: true });
});
$('.st-send-button').on('click', function() {
  window.parent.postMessage({ type: 'sendClick' }, '*');
});
$('.st-audio').on('play', function() {
  audioManager.handlePlay(this);
});
$(window).on('message', function(event) {
  if (event.originalEvent.data.type === 'stopAudio' &&
    event.originalEvent.data.iframeId !== window.frameElement.id) {
    audioManager.stopAll();
  }
});
`;

/**
 * Convert min-height:vh in code blocks
 * @param htmlContent Code block content
 * @returns Converted code block content
 */
function processVhUnits(htmlContent: string) {
  const hasMinVh = /min-height:\s*[^;]*vh/.test(htmlContent);

  if (!hasMinVh) {
    return htmlContent;
  }

  const viewportHeight = window.innerHeight;
  const processedContent = htmlContent.replace(/min-height:\s*([^;]*vh[^;]*);/g, expression => {
    const processedExpression = expression.replace(
      /(\d+)vh/g,
      `calc(var(--viewport-height, ${viewportHeight}px) * $1 / 100)`,
    );
    return `${processedExpression};`;
  });

  return processedContent;
}

/**
 * Update iframe viewport height when using min-height:vh
 */
function updateIframeViewportHeight() {
  $(window).on('resize', function () {
    if ($('iframe[data-needs-vh="true"]').length) {
      const viewportHeight = window.innerHeight;
      $('iframe[data-needs-vh="true"]').each(function () {
        const iframe = this as HTMLIFrameElement;
        if (iframe.contentWindow) {
          iframe.contentWindow.postMessage(
            {
              request: 'updateViewportHeight',
              newHeight: viewportHeight,
            },
            '*',
          );
        }
      });
    }
  });
}

/**
 * Render messages to iframe
 * @param mode Render mode
 * @param specificMesId Specific message ID
 */
async function renderMessagesInIframes(mode = RENDER_MODES.FULL, specificMesId: number | null = null) {
  if (isExtensionEnabled === undefined) {
    isExtensionEnabled = getSettingValue('enabled_extension');
  }
  if (!isExtensionEnabled || !isRenderEnabled) {
    return;
  }
  const context = getContext();
  const totalMessages = context.chat.length;
  const processDepth = renderDepth ?? 0;
  const depthLimit = processDepth > 0 ? processDepth : totalMessages;
  const depthLimitedMessageIds = [...Array(totalMessages).keys()].slice(-depthLimit);

  let messagesToRenderIds: number[] = [];
  const messagesToCancelIds: number[] = [...Array(totalMessages).keys()].filter(
    id => !depthLimitedMessageIds.includes(id),
  );

  if (mode === RENDER_MODES.FULL) {
    messagesToRenderIds = depthLimitedMessageIds;
  } else if (mode === RENDER_MODES.PARTIAL && specificMesId !== null) {
    if (depthLimitedMessageIds.includes(specificMesId)) {
      messagesToRenderIds = [specificMesId];
    } else {
      return;
    }
  }

  for (const messageId of messagesToCancelIds) {
    const message = context.chat[messageId];
    const $iframes = $(`[id^="message-iframe-${messageId}-"]`);
    if ($iframes.length > 0) {
      await Promise.all(
        $iframes.toArray().map(async iframe => {
          await destroyIframe(iframe as HTMLIFrameElement);
        }),
      );
      updateMessageBlock(messageId, message);
    }
    if (isRenderingHideStyleEnabled) {
      const $mesText = $(
        `.mes[mesid="${messageId}"] .mes_block .mes_reasoning_details, .mes[mesid="${messageId}"] .mes_block .mes_text`,
      );
      addToggleButtonsToMessage($mesText);
    }
  }

  for (const messageId of messagesToRenderIds) {
    const $messageElement = $(`.mes[mesid="${messageId}"]`);
    if (!$messageElement.length) {
      console.debug(`The message element corresponding to mesid: ${messageId} was not found.`);
      continue;
    }

    const $codeElements = $messageElement.find('pre');
    if (!$codeElements.length) {
      continue;
    }

    let iframeCounter = 1;

    $codeElements.each(function () {
      let extractedText = extractTextFromCode(this);

      const shouldHaveButton = shouldHaveCodeToggle(this);
      const shouldRenderAsIframe = !shouldHaveButton;

      if (shouldHaveButton && isRenderingHideStyleEnabled) {
        const $pre = $(this);
        addToggleButtonToCodeBlock($pre);
      }

      if (shouldRenderAsIframe) {
        const disableLoading = /<!--\s*disable-default-loading\s*-->/.test(extractedText);
        const hasMinVh = /min-height:\s*[^;]*vh/.test(extractedText);
        extractedText = hasMinVh ? processVhUnits(extractedText) : extractedText;

        let $wrapper = $('<div>').css({
          position: 'relative',
          width: '100%',
        });

        const $iframe = $('<iframe>')
          .attr({
            id: `message-iframe-${messageId}-${iframeCounter}`,
            srcdoc: '',
            loading: 'lazy',
          })
          .css({
            margin: '5px auto',
            border: 'none',
            width: '100%',
          });

        iframeCounter++;

        if (hasMinVh) {
          $iframe.attr('data-needs-vh', 'true');
        }

        let loadingTimeout: NodeJS.Timeout | null = null;
        if (!disableLoading) {
          const $loadingOverlay = $('<div>').addClass('iframe-loading-overlay').html(`
              <div class="iframe-loading-content">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <span class="loading-text">Loading...</span>
              </div>`);

          loadingTimeout = setTimeout(() => {
            const $loadingText = $loadingOverlay.find('.loading-text');
            if ($loadingText.length) {
              $loadingText.text('If the loading time is too long, please check the network');
            }
          }, 10000);

          $wrapper.append($loadingOverlay);
        }

        $wrapper.append($iframe);

        const srcdocContent = `
          <html>
          <head>
            <style>
            ${hasMinVh ? `:root{--viewport-height:${window.innerHeight}px;}` : ``}
            html,body{margin:0;padding:0;overflow:hidden;max-width:100%!important;box-sizing:border-box}
            .user_avatar,.user-avatar{background-image:url('${getUserAvatarPath()}')}
            .char_avatar,.char-avatar{background-image:url('${getCharAvatarPath()}')}
            </style>
            ${third_party}
            <script src="${script_url.get('iframe_client')}"></script>
          </head>
          <body>
            ${extractedText}
            ${hasMinVh ? `<script src="${script_url.get('viewport_adjust_script')}"></script>` : ``}
            ${
              getSettingValue('render.tampermonkey_compatibility')
                ? `<script src="${script_url.get('tampermonkey_script')}"></script>`
                : ``
            }
          </body>
          </html>
        `;
        $iframe.attr('srcdoc', srcdocContent);

        $iframe.on('load', function () {
          observeIframeContent(this as HTMLIFrameElement);

          $wrapper = $(this).parent();
          if ($wrapper.length) {
            const $loadingOverlay = $wrapper.find('.iframe-loading-overlay');
            if ($loadingOverlay.length) {
              $loadingOverlay.css('opacity', '0');
              setTimeout(() => $loadingOverlay.remove(), 300);
            }
          }

          if ($(this).attr('data-needs-vh') === 'true') {
            const iframe = this as HTMLIFrameElement;
            if (iframe.contentWindow) {
              iframe.contentWindow.postMessage(
                {
                  request: 'updateViewportHeight',
                  newHeight: window.innerHeight,
                },
                '*',
              );
            }
          }

          eventSource.emitAndWait('message_iframe_render_ended', this.id);

          if (isRenderingHideStyleEnabled) {
            removeCodeToggleButtonsByMesId(messageId);
          }

          if (loadingTimeout) {
            clearTimeout(loadingTimeout);
          }
        });

        eventSource.emitAndWait('message_iframe_render_started', $iframe.attr('id'));
        $(this).replaceWith($wrapper);
      }
    });
  }
}

/**
 * Get or create shared ResizeObserver instance
 */
function getSharedResizeObserver(): ResizeObserver {
  if (!window._sharedResizeObserver) {
    window._observedElements = new Map();

    window._sharedResizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const element = entry.target;

        const data = window._observedElements?.get(element as HTMLElement);
        if (data) {
          const { iframe } = data;
          adjustIframeHeight(iframe);
        }
      }
    });

    console.log('Created shared ResizeObserver instance');
  }

  return window._sharedResizeObserver;
}

/**
 * Observe iframe content for auto height adjustment
 * @param iframe iframe element
 */
function observeIframeContent(iframe: HTMLIFrameElement) {
  const $iframe = $(iframe);
  if (!$iframe.length || !$iframe[0].contentWindow || !$iframe[0].contentWindow.document.body) {
    return;
  }
  try {
    const docBody = $iframe[0].contentWindow.document.body;

    const resizeObserver = getSharedResizeObserver();

    if (window._observedElements) {
      for (const [element, data] of window._observedElements.entries()) {
        if (data.iframe === iframe) {
          resizeObserver.unobserve(element);
          window._observedElements.delete(element);
          break;
        }
      }
    }

    window._observedElements?.set(docBody, { iframe });
    resizeObserver.observe(docBody);

    adjustIframeHeight(iframe);
  } catch (error) {
    console.error('[Render] Error setting iframe content observation:', error);
  }
}

/**
 * Destroy iframe
 * @param iframe iframe element
 */
export function destroyIframe(iframe: HTMLIFrameElement): Promise<void> {
  return new Promise(resolve => {
    const $iframe = $(iframe);

    if (!$iframe.length) {
      resolve();
      return;
    }

    const iframeId = $iframe.attr('id');
    $iframe.off();

    try {
      if ($iframe[0].contentWindow) {
        const iframeDoc = $iframe[0].contentWindow.document;
        if (iframeDoc) {
          $(iframeDoc).find('*').off();
          $(iframeDoc).off();
        }
      }
    } catch (e) {
      console.debug('[Render] Error in cleaning up iframe internal events:', e);
    }

    try {
      const $mediaElements = $iframe.contents().find('audio, video');
      $mediaElements.each(function () {
        if (this instanceof HTMLMediaElement) {
          this.pause();
          this.src = '';
          this.load();
          $(this).off();
        }
      });
    } catch (e) {
      console.debug('[Render] Error cleaning up media element:', e);
    }

    if ($iframe[0].contentWindow && 'stop' in $iframe[0].contentWindow) {
      $iframe[0].contentWindow.stop();
    }

    // If there is a ResizeObserver instance and a record of observed elements
    if (window._sharedResizeObserver && window._observedElements) {
      for (const [element, data] of window._observedElements.entries()) {
        if (data.iframe === iframe) {
          window._sharedResizeObserver.unobserve(element);
          window._observedElements.delete(element);
          break;
        }
      }
    }

    // Clear iframe content
    if ($iframe[0].contentWindow) {
      try {
        if (iframeId && typeof eventSource.removeListener === 'function') {
          eventSource.removeListener('message_iframe_render_ended', iframeId as any);
          eventSource.removeListener('message_iframe_render_started', iframeId as any);
        }

        $iframe.attr('src', 'about:blank');
      } catch (e) {
        console.debug('[Render] Error clearing iframe content:', e);
      }
    }

    // Remove from DOM
    $iframe.remove();

    // Remove jQuery data cache
    try {
      $iframe.removeData();
    } catch (e) {
      console.debug('[Render] Error removing jQuery data cache:', e);
    }

    if (window._observedElements?.size === 0 && window._sharedResizeObserver) {
      window._sharedResizeObserver.disconnect();
      window._sharedResizeObserver = undefined;
      console.log('[Render] All iframes have been removed, stop observing');
    }

    // Make sure all cleanup operations are completed before resolving
    setTimeout(() => {
      resolve();
    }, 0);
  });
}

/**
 * Clear all iframes
 * @returns {Promise<void>}
 */
export async function clearAllIframes(): Promise<void> {
  const $iframes = $('iframe[id^="message-iframe"]');
  await Promise.all(
    $iframes.toArray().map(async iframe => {
      await destroyIframe(iframe as HTMLIFrameElement);
    }),
  );

  // Clean up related event listeners
  try {
    if (typeof eventSource.removeListener === 'function') {
      eventSource.removeListener('message_iframe_render_started', null as any);
      eventSource.removeListener('message_iframe_render_ended', null as any);
    }
  } catch (e) {
    console.debug('[Render] Error while cleaning up event listeners:', e);
  }

  // Try to trigger garbage collection proactively
  try {
    let arr = [];
    for (let i = 0; i < 10; i++) {
      arr.push(new Array(1000000).fill(1));
    }
    arr = null as any;

    if (window.gc) {
      window.gc();
    }
  } catch (e) {
    console.debug('Error while trying to trigger garbage collection:', e);
  }
}

/**
 * Setup iframe removal listener
 * @returns {MutationObserver} Observer instance
 */
function setupIframeRemovalListener(): MutationObserver {
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.removedNodes.length) {
        mutation.removedNodes.forEach(node => {
          if (node instanceof HTMLIFrameElement) {
            destroyIframe(node).catch(err => {
              console.error('[Render] Error cleaning iframe:', err);
            });
          } else if (node instanceof HTMLElement) {
            const iframes = node.querySelectorAll('iframe');
            if (iframes.length) {
              iframes.forEach(iframe => {
                destroyIframe(iframe).catch(err => {
                  console.error('[Render] Error cleaning iframe:', err);
                });
              });
            }
          }
        });
      }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
  return observer;
}

/**
 * Handle Tampermonkey compatibility mode messages
 * @param event Message event
 */
function handleTampermonkeyMessages(event: MessageEvent): void {
  if (event.data.type === 'buttonClick') {
    const buttonName = event.data.name;
    $('.qr--button.menu_button').each(function () {
      if ($(this).find('.qr--button-label').text().trim() === buttonName) {
        $(this).trigger('click');
      }
    });
  } else if (event.data.type === 'textInput') {
    const $sendTextarea = jQuery('#send_textarea');
    if ($sendTextarea.length) {
      $sendTextarea.val(event.data.text).trigger('input').trigger('change');
    }
  } else if (event.data.type === 'sendClick') {
    const $sendButton = jQuery('#send_but');
    if ($sendButton.length) {
      $sendButton.trigger('click');
    }
  }
}

/**
 * Tampermonkey compatibility - Create global audio manager
 */
function createGlobalAudioManager() {
  let currentPlayingIframeId: string | null = null;

  window.addEventListener('message', function (event) {
    if (event.data.type === 'audioPlay') {
      const newIframeId = event.data.iframeId;

      if (currentPlayingIframeId && currentPlayingIframeId !== newIframeId) {
        $('iframe').each(function () {
          const iframe = this as HTMLIFrameElement;
          if (iframe.contentWindow) {
            iframe.contentWindow.postMessage(
              {
                type: 'stopAudio',
                iframeId: newIframeId,
              },
              '*',
            );
          }
        });
      }

      currentPlayingIframeId = newIframeId;
    }
  });
}

/**
 * Adjust iframe height
 * @param iframe iframe element
 */
function adjustIframeHeight(iframe: HTMLIFrameElement) {
  const $iframe = $(iframe);
  if (!$iframe.length || !$iframe[0].contentWindow || !$iframe[0].contentWindow.document.body) {
    return;
  }

  const doc = $iframe[0].contentWindow.document;

  const bodyHeight = doc.body.offsetHeight;
  const htmlHeight = doc.documentElement.offsetHeight;

  const newHeight = Math.max(bodyHeight, htmlHeight);
  const currentHeight = parseFloat($iframe.css('height')) || 0;

  if (Math.abs(currentHeight - newHeight) > 5) {
    $iframe.css('height', newHeight + 'px');

    if ($iframe.attr('data-needs-vh') === 'true' && iframe.contentWindow) {
      iframe.contentWindow.postMessage(
        {
          request: 'updateViewportHeight',
          newHeight: window.innerHeight,
        },
        '*',
      );
    }
  }
}

/**
 * Extract text from code block
 * @param codeElement Code block element
 * @returns Extracted text
 */
function extractTextFromCode(codeElement: HTMLElement) {
  let textContent = '';

  $(codeElement)
    .contents()
    .each(function () {
      if (this.nodeType === Node.TEXT_NODE) {
        textContent += this.textContent;
      } else if (this.nodeType === Node.ELEMENT_NODE) {
        textContent += extractTextFromCode(this as HTMLElement);
      }
    });

  return textContent;
}

/**
 * Re-render after message deletion
 * @param mesId Message ID
 */
export async function renderMessageAfterDelete(mesId: number) {
  const context = getContext();
  const processDepth = parseInt($('#render-depth').val() as string, 10);
  const totalMessages = context.chat.length;
  const maxRemainId = mesId - 1;

  const getMessage = (id: number) => {
    const message = context.chat[id] ?? {};
    return message;
  };

  const getIframe = (id: number) => {
    const $iframe = $('[id^="message-iframe-' + id + '-"]');
    return $iframe.length > 0 ? ($iframe.get(0) as HTMLIFrameElement) : null;
  };

  const checkCodeBlock = (message: any) => {
    return /```[\s\S]*?```/.test(message.mes);
  };
  // Considering the situation of high floors, when the depth is 0, only the last message is rendered
  if (processDepth === 0) {
    const message = getMessage(maxRemainId);
    const hasCodeBlock = checkCodeBlock(message);
    const iframe = getIframe(maxRemainId);

    if (!hasCodeBlock && !iframe) {
      return;
    }
    await destroyIframe(iframe as HTMLIFrameElement);
    updateMessageBlock(maxRemainId, message);
    renderPartialIframes(maxRemainId);
  } else {
    let startRenderIndex = totalMessages - processDepth;
    if (startRenderIndex < 0) {
      startRenderIndex = 0;
    }

    for (let i = startRenderIndex; i <= maxRemainId; i++) {
      const message = getMessage(i);
      const hasCodeBlock = checkCodeBlock(message);
      const iframe = getIframe(i);

      if (!hasCodeBlock && !iframe) {
        continue;
      }
      await destroyIframe(iframe as HTMLIFrameElement);
      updateMessageBlock(i, message);
      renderPartialIframes(i);
    }
  }
}

/**
 * Handle Tampermonkey compatibility setting change
 */
async function handleTampermonkeyCompatibilityChange(enable: boolean, userInput: boolean = true) {
  if (userInput) {
    saveSettingValue('render.tampermonkey_compatibility', enable);
  }

  if (!getSettingValue('enabled_extension')) {
    return;
  }

  if (enable) {
    if (!tampermonkeyMessageListener) {
      tampermonkeyMessageListener = handleTampermonkeyMessages;
      window.addEventListener('message', tampermonkeyMessageListener);
      createGlobalAudioManager();
    }
  } else if (tampermonkeyMessageListener) {
    window.removeEventListener('message', tampermonkeyMessageListener);
    tampermonkeyMessageListener = null;
  }

  await clearAndRenderAllIframes();
}

/**
 * Handle depth input change
 */
async function onDepthInput(value: string) {
  const processDepth = parseInt(value, 10);
  renderDepth = processDepth;

  if (processDepth < 0) {
    toastr.warning('Processing depth cannot be negative');
    $('#render-depth').val(getSettingValue('render.render_depth'));
    return;
  }

  saveSettingValue('render.render_depth', processDepth);

  await clearAndRenderAllIframes();
}

export const handlePartialRender = (mesId: number) => {
  console.log('[Render] triggers local rendering, message ID:', mesId);
  const processDepth = parseInt($('#render-depth').val() as string, 10);
  const context = getContext();
  const totalMessages = context.chat.length;

  if (processDepth > 0) {
    const depthOffset = totalMessages - processDepth;

    if (mesId < depthOffset) {
      return;
    }
  }

  setTimeout(() => {
    renderMessagesInIframes(RENDER_MODES.PARTIAL, mesId);
  }, 100);
};

/**
 * Inject loading styles
 */
export function injectLoadingStyles() {
  if ($('#iframe-loading-styles').length) return;

  const styleSheet = $('<style>', {
    id: 'iframe-loading-styles',
    text: `
      .iframe-loading-overlay{
        position:absolute;
        top:0;
        left:0;
        right:0;
        bottom:0;
        background:rgba(0,0,0,.7);
        display:flex;
        justify-content:center;
        align-items:center;
        z-index:1000;
        transition:opacity .3s ease
      }
      .iframe-loading-content{
        color:#fff;
        display:flex;
        align-items:center;
        gap:10px;
        font-size:16px
      }
      .iframe-loading-content i{
        font-size:20px
      }
      .loading-text {
        transition: opacity 0.3s ease;
      }`,
  });

  $('head').append(styleSheet);
}

/**
 * Inject code block hide styles
 */
export function injectCodeBlockHideStyles() {
  const styleId = 'hidden-code-block-styles';
  let style = document.getElementById(styleId);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('id', styleId);
    document.head.appendChild(style);
  }
  style.innerHTML = `
    pre {
      display: none;
    }
    .code-toggle-button {
      display: inline-block;
      margin: 5px 0;
      padding: 5px 10px;
      background-color: rgba(0, 0, 0, 0.1);
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9em;
      user-select: none;
      transition: background-color 0.3s;
    }
    .code-toggle-button:hover {
      background-color: rgba(0, 0, 0, 0.2);
    }
    .popup:has(#qr--modalEditor) .popup-content > #qr--modalEditor > #qr--main > .qr--modal-messageContainer > #qr--modal-messageHolder > #qr--modal-message {
      color: var(--SmartThemeEmColor) !important;
    }
  `;
}

/**
 * Remove code block hide styles
 */
function removeCodeBlockHideStyles() {
  const styleId = 'hidden-code-block-styles';
  const style = document.getElementById(styleId);
  if (style) {
    style.remove();
  }
}

/**
 * Add toggle button to code block
 * @param $pre Code block element
 */
function addToggleButtonToCodeBlock($pre: JQuery<HTMLElement>) {
  // Check if the code block already has a collapse button
  if ($pre.prev('.code-toggle-button').length > 0) {
    return;
  }

  const $toggleButton = $(
    '<div class="code-toggle-button" title="Disable [Tavern Helper - Renderer - Render Optimization] to turn off this folding feature">Show code block</div>',
  );

  $toggleButton.on('click', function () {
    const isVisible = $pre.is(':visible');

    if (isVisible) {
      $pre.hide();
      $(this).text('Show code block');
    } else {
      $pre.show();
      $(this).text('Hidden code block');
    }
  });

  $pre.before($toggleButton);
}

/**
 * Add toggle buttons to message
 * @param $mesText Message text element
 */
function addToggleButtonsToMessage($mesText: JQuery<HTMLElement>) {
  if ($mesText.find('.code-toggle-button').length > 0 || $mesText.find('pre').length === 0) {
    return;
  }

  $mesText.find('pre').each(function () {
    const $pre = $(this);
    const $code = $pre.find('code');
    if ($code.length && shouldHaveCodeToggle($code[0])) {
      addToggleButtonToCodeBlock($pre);
    }
  });
}

/**
 * Add toggle buttons to all messages
 */
export function addCodeToggleButtonsToAllMessages() {
  const $chat = $('#chat');
  if (!$chat.length) {
    return;
  }

  $chat.find('.mes .mes_block .mes_text, .mes .mes_block .mes_reasoning_details').each(function () {
    const $mesText = $(this);
    addToggleButtonsToMessage($mesText);
  });
}

/**
 * Remove toggle button from code block
 * @param $codeElement Code element
 */
function removeToggleButtonFromCodeBlock($codeElement: JQuery<HTMLElement>) {
  const $parent = $codeElement.parent();
  const $toggleButton = $parent.prev('.code-toggle-button');
  if ($toggleButton.length) {
    $toggleButton.off('click').remove();
  }
}

/**
 * Remove toggle buttons by message ID
 * @param mesId Message ID
 */
function removeCodeToggleButtonsByMesId(mesId: number) {
  const $messageElement = $(`div[mesid="${mesId}"]`);
  const $codeElements = $messageElement.find('pre code');

  $codeElements.each(function () {
    const $codeElement = $(this);

    // Only remove the collapse button from code blocks that should not have it
    if (!shouldHaveCodeToggle(this)) {
      removeToggleButtonFromCodeBlock($codeElement);
    }
  });
}

/**
 * Remove all toggle buttons
 */
function removeAllCodeToggleButtons() {
  $('.code-toggle-button').each(function () {
    $(this).off('click').remove();
  });
  // Remove all pre's display:none
  $('pre').css('display', 'block');
}

/**
 * Add rendering optimization settings
 */
export function addRenderingOptimizeSettings() {
  hljs.highlightElement = function () {
    return;
  };
}

/**
 * Remove rendering optimization settings
 */
export function removeRenderingOptimizeSettings() {
  hljs.highlightElement = originalHighlightElement;
}

/**
 * Handle rendering optimization toggle
 * @param enable Whether to enable rendering optimization
 * @param userInput Whether triggered by user input
 */
async function handleRenderingOptimizationToggle(enable: boolean, userInput: boolean = true) {
  if (userInput) {
    saveSettingValue('render.render_optimize', enable);
    isRenderingOptimizeEnabled = enable;
  }

  if (!isRenderEnabled) {
    return;
  }

  if (enable) {
    addRenderingOptimizeSettings();
    if (userInput) {
      await clearAndRenderAllIframes();
    }
  } else {
    removeRenderingOptimizeSettings();
    if (userInput) {
      await clearAndRenderAllIframes();
    }
  }
}

/**
 * Add code block folding settings
 */
export function addRenderingHideStyleSettings() {
  injectCodeBlockHideStyles();
}

/**
 * Remove code block folding settings
 */
export function removeRenderingHideStyleSettings() {
  removeCodeBlockHideStyles();
  removeAllCodeToggleButtons();
}

/**
 * Handle code block folding toggle
 * @param enable Whether to enable code block folding
 * @param userInput Whether triggered by user input
 */
async function handleRenderingHideStyleToggle(enable: boolean, userInput: boolean = true) {
  if (userInput) {
    saveSettingValue('render.render_hide_style', enable);
    isRenderingHideStyleEnabled = enable;
  }
  if (!isRenderEnabled) {
    return;
  }

  if (enable) {
    addRenderingHideStyleSettings();
    if (userInput) {
      await clearAndRenderAllIframes();
    }
  } else {
    removeRenderingHideStyleSettings();
    if (userInput) {
      await clearAndRenderAllIframes();
    }
  }
}

/**
 * Handle renderer enable toggle
 * @param enable Whether to enable renderer
 * @param userInput Whether triggered by user input
 */
async function handleRenderEnableToggle(enable: boolean, userInput: boolean = true) {
  if (userInput) {
    saveSettingValue('render.render_enabled', enable);
    isRenderEnabled = enable;
  }
  if (enable) {
    $('#render-settings-content .extension-content-item').not(':first').css('opacity', 1);
    if (isRenderingOptimizeEnabled) {
      addRenderingOptimizeSettings();
    }
    if (isRenderingHideStyleEnabled) {
      addRenderingHideStyleSettings();
    }
    await renderAllIframes();
  } else {
    $('#render-settings-content .extension-content-item').not(':first').css('opacity', 0.5);
    if (isRenderingOptimizeEnabled) {
      removeRenderingOptimizeSettings();
    }
    if (isRenderingHideStyleEnabled) {
      removeRenderingHideStyleSettings();
    }
    await clearAllIframes();
    await reloadCurrentChat();
  }
}

/**
 * Add render quick button
 */
function addRenderQuickButton() {
  const buttonHtml = $(`
  <div id="tavern-helper-render-container" class="list-group-item flex-container flexGap5 interactable">
      <div class="fa-solid fa-puzzle-piece extensionsMenuExtensionButton" /></div>
      <span id="tavern-helper-render-text">${isRenderEnabled ? 'Turn off front-end rendering' : 'Enable front-end rendering'}</span>
  </div>`);
  buttonHtml.css('display', 'flex');
  $('#extensionsMenu').append(buttonHtml);
  $('#tavern-helper-render-container').on('click', async function () {
    $('#tavern-helper-render-text').text(!isRenderEnabled ? 'Turn off front-end rendering' : 'Enable front-end rendering');
    await handleRenderEnableToggle(!isRenderEnabled, true);
    $('#render-enable-toggle').prop('checked', isRenderEnabled);
  });
}

/**
 * Initialize iframe control panel
 */
export async function initIframePanel() {
  // Handles heavy front-end card rendering optimization
  isRenderingOptimizeEnabled = getSettingValue('render.render_optimize');
  if (isRenderingOptimizeEnabled) {
    handleRenderingOptimizationToggle(true, false);
  }
  $('#render-optimize-toggle')
    .prop('checked', isRenderingOptimizeEnabled)
    .on('click', (event: JQuery.ClickEvent) => handleRenderingOptimizationToggle(event.target.checked, true));

  isRenderingHideStyleEnabled = getSettingValue('render.render_hide_style');
  if (isRenderingHideStyleEnabled) {
    handleRenderingHideStyleToggle(true, false);
  }
  $('#render-hide-style-toggle')
    .prop('checked', isRenderingHideStyleEnabled)
    .on('click', (event: JQuery.ClickEvent) => handleRenderingHideStyleToggle(event.target.checked, true));

  // Processing depth settings
  renderDepth = getSettingValue('render.render_depth');
  $('#render-depth')
    .val(renderDepth ?? defaultIframeSettings.render_depth)
    .on('blur', function (event) {
      onDepthInput((event.target as HTMLInputElement).value);
    });

  isRenderEnabled = getSettingValue('render.render_enabled');
  handleRenderEnableToggle(isRenderEnabled, false);
  $('#render-enable-toggle')
    .prop('checked', isRenderEnabled)
    .on('click', (event: JQuery.ClickEvent) => handleRenderEnableToggle(event.target.checked, true));

  // Handle Tampermonkey compatibility settings
  isTampermonkeyEnabled = getSettingValue('render.tampermonkey_compatibility');
  if (isTampermonkeyEnabled) {
    handleTampermonkeyCompatibilityChange(true, false);
  }
  $('#tampermonkey-compatibility-toggle')
    .prop('checked', isTampermonkeyEnabled)
    .on('click', (event: JQuery.ClickEvent) => handleTampermonkeyCompatibilityChange(event.target.checked, true));

  $(window).on('resize', function () {
    if ($('iframe[data-needs-vh="true"]').length) {
      updateIframeViewportHeight();
    }
  });

  addRenderQuickButton();
  injectLoadingStyles();
  setupIframeRemovalListener();
}

/**
* Determine whether the code block should have a fold button
* @param codeElement code block element
* @returns whether there should be a fold button
*/
function shouldHaveCodeToggle(codeElement: HTMLElement): boolean {
  const extractedText = extractTextFromCode(codeElement);
  return !(extractedText.includes('<body') && extractedText.includes('</body>'));
}
