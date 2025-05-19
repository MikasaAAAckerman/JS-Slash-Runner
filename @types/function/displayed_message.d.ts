interface FormatAsDisplayedMessageOption {
  /** The message floor number, must exist within range `[0, await getLastMessageId()]`; defaults to 'last' */
  message_id?: 'last' | 'last_user' | 'last_char' | number;
}

/**
 * Process string into HTML format for tavern display. Will:
 * 1. Replace tavern macros in the string
 * 2. Apply corresponding tavern regex patterns
 * 3. Convert string to HTML format
 *
 * @param text String to process
 * @param option Optional parameters
 *   - `message_id?:number`: The message floor number, must exist within range `[0, await getLastMessageId()]`; defaults to latest floor
 *
 * @returns Processed result
 *
 * @example
 * const text = formatAsDisplayedMessage("{{char}} speaks in {{lastMessageId}}");
 * => "<p>Revue Starlight speaks in 5</p>";
 */
function formatAsDisplayedMessage(text: string, { message_id }?: FormatAsDisplayedMessageOption): string;

/**
 * Get message content as JQuery for a given floor number
 *
 * More of an example showing JQuery usage than a utility function
 *
 * @param message_id Floor number to retrieve, must be currently displayed in the tavern UI
 * @returns JQuery of the message's HTML if available, otherwise empty JQuery
 *
 * @example
 * // Get text content of floor 0
 * const text = retrieveDisplayedMessage(0).text();
 *
 * @example
 * // Modify displayed content of floor 0
 * // - Changes only affect current display and won't persist to message files
 * // - To actually modify message files, use `setChatMessage`
 * retrieveDisplayedMessage(0).text("new text");
 * retrieveDisplayedMessage(0).append("<pre>new text</pre>");
 * retrieveDisplayedMessage(0).append(formatAsDisplayedMessage("{{char}} speaks in {{lastMessageId}}"));
 */
function retrieveDisplayedMessage(message_id: number): JQuery<HTMLDivElement>;
