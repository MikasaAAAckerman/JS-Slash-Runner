/**
 * Replace tavern macros in a string
 *
 * @param text String containing macros to replace
 * @returns String with macros substituted
 *
 * @example
 * const text = substitudeMacros("{{char}} speaks in {{lastMessageId}}");
 * text == "Stage Girl speaks in 5";
 */
function substitudeMacros(text: string): string;

/**
 * Get the ID of the latest message
 *
 * @returns Latest message ID
 */
function getLastMessageId(): number;

/**
 * Wrap a function to display any errors via tavern notifications
 *
 * @param fn Function to wrap
 * @returns Wrapped function that shows errors in tavern UI
 *
 * @example
 * // Wrap `test` function to show 'test' error in tavern notifications
 * async function test() {
 *   throw Error(`test`);
 * }
 * errorCatched(test)();
 */
function errorCatched<T extends any[], U>(fn: (...args: T) => U): (...args: T) => U;
