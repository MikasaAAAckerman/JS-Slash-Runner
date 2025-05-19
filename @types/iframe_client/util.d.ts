/**
 * Get the iframe's name
 *
 * @returns For message iframes: `message-iframe-message_id-iframe_index`; 
 * For global scripts: `script-iframe-script_name`;
 * For script library: `tavern-helper-script-script_name`
 */
function getIframeName(): string;

/**
 * Get the script library ID (**Only works for script libraries**)
 *
 * @returns The script library ID
 */
function getScriptId(): string;

/**
 * Get the message ID for the current message iframe (**Only works for message iframes**)
 *
 * @returns The message ID
 */
function getCurrentMessageId(): number;

/**
 * Get the message ID from an iframe's name (**Only works for message iframes**)
 *
 * @param iframe_name The name of the message iframe
 * @returns The message ID
 */
function getMessageId(iframe_name: string): number;
