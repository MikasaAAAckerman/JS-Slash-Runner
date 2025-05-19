interface TavernRegex {
  /** Unique identifier for the regex */
  id: string;
  /** Name of the regex script */
  script_name: string;
  /** Whether the regex is enabled */
  enabled: boolean;
  /** Whether to run on edit operations */
  run_on_edit: boolean;
  /** Scope of the regex ('global' or 'character') */
  scope: 'global' | 'character';
  /** Regex pattern to find */
  find_regex: string;
  /** Replacement string */
  replace_string: string;
  /** Sources where the regex applies */
  source: {
    /** Apply to user input */
    user_input: boolean;
    /** Apply to AI output */
    ai_output: boolean;
    /** Apply to slash commands */
    slash_command: boolean;
    /** Apply to world info */
    world_info: boolean;
  };
  /** Destinations where replacements should occur */
  destination: {
    /** Apply to displayed text */
    display: boolean;
    /** Apply to prompt text */
    prompt: boolean;
  };
  /** Minimum depth to apply (null for no minimum) */
  min_depth: number | null;
  /** Maximum depth to apply (null for no maximum) */
  max_depth: number | null;
}

/**
 * Check if character-specific regexes are enabled
 */
function isCharacterTavernRegexesEnabled(): boolean;

interface GetTavernRegexesOption {
  /** Filter by scope ('all', 'global', or 'character') */
  scope?: 'all' | 'global' | 'character';
  /** Filter by enabled state ('all', 'enabled', or 'disabled') */
  enable_state?: 'all' | 'enabled' | 'disabled';
}

/**
 * Get tavern regexes
 *
 * @param option Optional parameters
 *   - `scope?:'all'|'global'|'character'`:         // Filter by scope ('all', 'global', or 'character'); defaults to 'all'
 *   - `enable_state?:'all'|'enabled'|'disabled'`:  // Filter by enabled state ('all', 'enabled', or 'disabled'); defaults to 'all'
 *
 * @returns An array of `TavernRegex` objects, ordered by their execution sequence (same as the top-to-bottom order shown in tavern UI)
 */
function getTavernRegexes({ scope, enable_state }?: GetTavernRegexesOption): TavernRegex[];

interface ReplaceTavernRegexesOption {
  scope?: 'all' | 'global' | 'character';
}

/**
 * Completely replace tavern regexes with `regexes`.
 * - **This is a slow operation!** Try to batch all regex changes before calling replaceTavernRegexes.
 * - **It will reload the entire chat** to reapply regexes, triggering `tavern_events.CHAT_CHANGED` and reloading messages.
 *
 * This direct function is provided for cases where you need to reorder regexes, etc.
 *
 * @param regexes New tavern regexes to replace with
 * @param option Optional parameters
 *   - scope?: 'all' | 'global' | 'character';  // Which regexes to replace (default: 'all')
 */
function replaceTavernRegexes(regexes: TavernRegex[], { scope }: ReplaceTavernRegexesOption): Promise<void>;

type TavernRegexUpdater =
  | ((regexes: TavernRegex[]) => TavernRegex[])
  | ((regexes: TavernRegex[]) => Promise<TavernRegex[]>);

/**
 * Update tavern regexes using an `updater` function
 *
 * @param updater Function that receives current regexes and returns modified ones
 * @param option Optional parameters
 *   - scope?: 'all' | 'global' | 'character';  // Which regexes to update (default: 'all')
 *
 * @returns Updated tavern regexes
 *
 * @example
 * // Enable all regexes containing "Stage Girl" in their name
 * await updateTavernRegexesWith(regexes => {
 *   regexes.forEach(regex => {
 *     if (regex.script_name.includes('Stage Girl')) {
 *       regex.enabled = true;
 *     }
 *   });
 *   return regexes;
 * });
 */
function updateTavernRegexesWith(
  updater: TavernRegexUpdater,
  option?: ReplaceTavernRegexesOption,
): Promise<TavernRegex[]>;
