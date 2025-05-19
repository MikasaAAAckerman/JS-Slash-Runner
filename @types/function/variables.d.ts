interface VariableOption {
  /**
   * Which variables to operate on:
   * - `message`: Message-level variables
   * - `chat`: Chat variables
   * - `character`: Character variables  
   * - `global`: Global variables
   * Default: `'chat'`
   */
  type?: 'message' | 'chat' | 'character' | 'global';

  /**
   * When `type` is `'message'`, specifies which message to get variables from:
   * - Number: Message ID (negative numbers are depth indexes, e.g. -1 = latest message)
   * - `'latest'`: Latest message (default)
   */
  message_id?: number | 'latest';
}

/**
 * Get variables table
 *
 * @param option Optional parameters
 *   - `type?:'message'|'chat'|'character'|'global'`: Which variables to get:
 *     - `message`: Message-level variables
 *     - `chat`: Chat variables (default)
 *     - `character`: Character variables
 *     - `global`: Global variables
 *   - `message_id?:number|'latest'`: When `type` is `'message'`, specifies which message to get variables from:
 *     - Number: Message ID (negative numbers are depth indexes, e.g. -1 = latest message)
 *     - `'latest'`: Latest message (default)
 *
 * @returns Variables table
 *
 * @example
 * // Get all chat variables and show in alert
 * const variables = getVariables({type: 'chat'});
 * alert(variables);
 *
 * @example
 * // Get all global variables
 * const variables = getVariables({type: 'global'});
 * // Tavern Helper includes lodash library for operations like checking if variable exists
 * if (_.has(variables, "KaguraHikari.affection")) {
 *   ...
 * }
 *
 * @example
 * // Get variables from second-to-last message
 * const variables = getVariables({type: 'message', message_id: -2});
 */
function getVariables({ type, message_id }?: VariableOption): Record<string, any>;

/**
 * Completely replace variables table with `variables`
 *
 * This direct function is provided because Tavern Helper includes lodash:
 * Functions like `insertOrAssignVariables` first get variables, process with lodash, then replace them.
 *
 * @param variables New variables table to replace with
 * @param option Optional parameters
 *   - `type?:'message'|'chat'|'character'|'global'`: Which variables to replace:
 *     - `message`: Message-level variables
 *     - `chat`: Chat variables (default)
 *     - `character`: Character variables
 *     - `global`: Global variables
 *   - `message_id?:number|'latest'`: When `type` is `'message'`, specifies which message to replace variables from:
 *     - Number: Message ID (negative numbers are depth indexes, e.g. -1 = latest message)
 *     - `'latest'`: Latest message (default)
 *
 * @example
 * // Before: `{KarenAijo: {affection: 5}}`
 * await replaceVariables({KaguraHikari: {affection: 5, awareness: 0}});
 * // After: `{KaguraHikari: {affection: 5, awareness: 0}}`
 *
 * @example
 * // Delete `{KaguraHikari: {affection: 5}}` variable
 * let variables = getVariables();
 * _.unset(variables, "KaguraHikari.affection");
 * await replaceVariables(variables);
 */
async function replaceVariables(variables: Record<string, any>, { type, message_id }?: VariableOption): Promise<void>;

type VariablesUpdater =
  | ((variables: Record<string, any>) => Record<string, any>)
  | ((variables: Record<string, any>) => Promise<Record<string, any>>);

/**
 * Update variables table using an `updater` function
 *
 * @param updater Function that receives current variables and returns modified ones
 * @param option Optional parameters
 *   - `type?:'message'|'chat'|'character'|'global'`: Which variables to update:
 *     - `message`: Message-level variables
 *     - `chat`: Chat variables (default)
 *     - `character`: Character variables
 *     - `global`: Global variables
 *   - `message_id?:number|'latest'`: When `type` is `'message'`, specifies which message to update variables from:
 *     - Number: Message ID (negative numbers are depth indexes, e.g. -1 = latest message)
 *     - `'latest'`: Latest message (default)
 *
 * @returns Updated variables table
 *
 * @example
 * // Delete `{KaguraHikari: {affection: 5}}` variable
 * await updateVariablesWith(variables => {
 *   _.unset(variables, "KaguraHikari.affection");
 *   return variables;
 * });
 *
 * @example
 * // Double "KarenAijo.affection" value, set to 0 if doesn't exist
 * await updateVariablesWith(variables => 
 *   _.update(variables, "KarenAijo.affection", value => value ? value * 2 : 0)
 * );
 */
async function updateVariablesWith(
  updater: VariablesUpdater,
  { type, message_id }?: VariableOption,
): Promise<Record<string, any>>;

/**
 * Insert or update variables based on existence
 *
 * @param variables Variables to update
 *   - If variable doesn't exist: Insert it
 *   - If variable exists: Update its value
 * @param option Optional parameters
 *   - `type?:'message'|'chat'|'character'|'global'`: Which variables to update:
 *     - `message`: Message-level variables
 *     - `chat`: Chat variables (default)
 *     - `character`: Character variables
 *     - `global`: Global variables
 *   - `message_id?:number|'latest'`: When `type` is `'message'`, specifies which message to update variables from:
 *     - Number: Message ID (negative numbers are depth indexes, e.g. -1 = latest message)
 *     - `'latest'`: Latest message (default)
 *
 * @example
 * // Before: `{KarenAijo: {affection: 5}}`
 * await insertOrAssignVariables({
 *   KarenAijo: {affection: 10}, 
 *   KaguraHikari: {affection: 5, awareness: 0}
 * });
 * // After: `{KarenAijo: {affection: 10}, KaguraHikari: {affection: 5, awareness: 0}}`
 */
async function insertOrAssignVariables(
  variables: Record<string, any>,
  { type, message_id }?: VariableOption,
): Promise<void>;

/**
 * Insert new variables only if they don't exist
 *
 * @param variables Variables to insert
 *   - If variable doesn't exist: Insert it
 *   - If variable exists: Do nothing
 * @param option Optional parameters
 *   - `type?:'message'|'chat'|'character'|'global'`: Which variables to operate on:
 *     - `message`: Message-level variables
 *     - `chat`: Chat variables (default)
 *     - `character`: Character variables
 *     - `global`: Global variables
 *   - `message_id?:number|'latest'`: When `type` is `'message'`, specifies which message to insert variables into:
 *     - Number: Message ID (negative numbers are depth indexes, e.g. -1 = latest message)
 *     - `'latest'`: Latest message (default)
 *
 * @example
 * // Before: `{KarenAijo: {affection: 5}}`
 * await insertVariables({
 *   KarenAijo: {affection: 10},
 *   KaguraHikari: {affection: 5, awareness: 0}
 * });
 * // After: `{KarenAijo: {affection: 5}, KaguraHikari: {affection: 5, awareness: 0}}`
 */
async function insertVariables(variables: Record<string, any>, { type, message_id }?: VariableOption): Promise<void>;

/**
 * Delete a variable if it exists (no action if it doesn't)
 *
 * @param variable_path Path to variable to delete
 *   - If variable doesn't exist: No action
 *   - If variable exists: Delete it
 * @param option Optional parameters
 *   - `type?:'message'|'chat'|'character'|'global'`: Which variables to operate on:
 *     - `message`: Message-level variables
 *     - `chat`: Chat variables (default)
 *     - `character`: Character variables
 *     - `global`: Global variables
 *   - `message_id?:number|'latest'`: When `type` is `'message'`, specifies which message to delete variables from:
 *     - Number: Message ID (negative numbers are depth indexes, e.g. -1 = latest message)
 *     - `'latest'`: Latest message (default)
 *
 * @returns Whether deletion was successful
 *
 * @example
 * // Before: `{KarenAijo: {affection: 5}}`
 * await deleteVariable("KarenAijo.affection");
 * // After: `{KarenAijo: {}}`
 */
async function deleteVariable(variable_path: string, { type, message_id }?: VariableOption): Promise<boolean>;
