/**
 * Gets the iframe name
 *
 * @returns For message iframes: `message-iframe-messageId-iframeIndex`
 *          For global scripts: `script-iframe-scriptName` 
 *          For script repository: `tavern-helper-script-scriptName`
 */
function getIframeName(): string {
  return (window.frameElement as Element).id;
}

/**
 * Gets the script repository id (**only works for script repository**)
 *
 * @returns Script repository id
 */
function getScriptId(): string {
  return $(window.frameElement as Element).attr('script-id') ?? 'unknown_script';
}

/**
 * Gets the message id for this message iframe (**only works for message iframes**)
 *
 * @returns Message id
 */
function getCurrentMessageId(): number {
  return getMessageId(getIframeName());
}

/**
 * Gets the message id from message iframe's `iframe_name` (**only works for message iframes**)
 *
 * @param iframe_name Message iframe name
 * @returns Message id
 */
function getMessageId(iframe_name: string): number {
  const match = iframe_name.match(/^message-iframe-(\d+)-\d+$/);
  if (!match) {
    throw Error(`Failed to get message id from ${iframe_name}: Do not call getMessageId on global script iframes!`);
  }
  return parseInt(match[1].toString());
}
