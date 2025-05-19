/**
 * Additional functionality provided by the prompt template syntax plugin. 
 * Requires installing the prompt template syntax plugin separately.
 * See https://github.com/zonde306/ST-Prompt-Template for details.
 * 
 * You can also press F12 in the tavern page and enter `window.EjsTemplate` 
 * in the console to view the currently available template syntax interfaces.
 */
const EjsTemplate: {
  /**
   * Process text using template syntax
   * @note `context` is typically obtained from `prepareContext`. 
   * If you need to modify it, modify the original object directly.
   *
   * @param code Template code
   * @param context Execution context/environment
   * @param options EJS parameters
   * @returns The processed template content
   *
   * @example
   * // Use the plugin's function to create a temporary tavern regex and process a message
   * await EjsTemplate.evalTemplate('<%_ await activateRegex(/<thinking>.*?<\/thinking>/gs, '') _%>')
   *
   * @example
   * const env    = await EjsTemplate.prepareContext({ a: 1 });
   * const result = await EjsTemplate.evalTemplate('a is <%= a _%>', env);
   * => result === 'a is 1'
   * // However, this usage is better done with _.template
   * // See https://lodash.com/docs/4.17.15#template
   * const compiled = _.template('hello <%= user %>!');
   * const result   = compiled({ 'user': 'fred' });;
   * => result === 'hello user!'
   */
  evaltemplate: (code: string, context: Record<string, any> = {}, options: Record<string, any> = {}) => Promise<string>;

  /**
   * Create an execution context for template processing
   *
   * @param additional_context Additional context to merge
   * @param last_message_id Maximum message ID for merging message variables
   * @returns The prepared execution context
   */
  prepareContext: (
    additional_context: Record<string, any> = {},
    last_message_id: number = 65535,
  ) => Promise<Record<string, any>>;

  /**
   * Check if template contains syntax errors
   * Does not actually execute the template
   *
   * @param code Template code to check
   * @param max_lines Number of surrounding lines to include in error output
   * @returns Syntax error message, or empty string if no errors
   */
  getSyntaxErrorInfo: (code: string, max_lines: number = 4) => Promise<string>;
};
