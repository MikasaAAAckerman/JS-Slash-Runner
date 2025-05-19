/**
 * Execute a Slash command (note: no feedback will be given for invalid commands)
 *
 * @param command Slash command to execute
 * @returns Slash pipeline result, returns `undefined` if command fails or `/abort` is executed
 *
 * @example
 * // Show success message in tavern interface
 * triggerSlash('/echo severity=success Operation successful!');
 * // But it's recommended to use toastr directly instead
 * toastr.success('Operation successful!');
 *
 * @example
 * // Get the ID of the last message in current chat
 * const last_message_id = await triggerSlash('/pass {{lastMessageId}}');
 */
async function triggerSlash(command: string): Promise<string>;
