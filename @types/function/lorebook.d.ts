interface LorebookSettings {
  /** Names of globally selected world books */
  selected_global_lorebooks: string[];
  /** How deep to scan for world book entries */
  scan_depth: number;
  /** Percentage of context to allocate to world book entries */
  context_percentage: number;
  /** Maximum budget allocated to world book entries */
  budget_cap: number;
  /** Minimum number of activations required */
  min_activations: number;
  /** Maximum depth for recursive scanning */
  max_depth: number;
  /** Maximum recursion steps allowed */
  max_recursion_steps: number;
  /** Strategy for inserting world book entries */
  insertion_strategy: 'evenly' | 'character_first' | 'global_first';
  /** Whether to include character names in matching */
  include_names: boolean;
  /** Whether to enable recursive scanning */
  recursive: boolean;
  /** Whether matching is case sensitive */
  case_sensitive: boolean;
  /** Whether to match whole words only */
  match_whole_words: boolean;
  /** Whether to use group scoring */
  use_group_scoring: boolean;
  /** Whether to show overflow alerts */
  overflow_alert: boolean;
}

interface GetCharLorebooksOption {
  /** Character name to query (defaults to current character) */
  name?: string;
  /** Filter by binding type ('all', 'primary', or 'additional') */
  type?: 'all' | 'primary' | 'additional';
}

/**
 * Get current world book global settings
 *
 * @returns Current world book global settings
 *
 * @example
 * // Get all globally enabled world books
 * const settings = getLorebookSettings();
 * alert(settings.selected_global_lorebooks);
 */
function getLorebookSettings(): LorebookSettings;

/**
 * Modify world book global settings
 *
 * @returns Modified world book settings
 *
 * @example
 * // Set context percentage to 100% and enable recursive scanning
 * await setLorebookSettings({context_percentage: 100, recursive: true});
 *
 * @example
 * // Since setLorebookSettings is slow due to tavern issues, recommended to:
 * // 1. Get current settings
 * // 2. Compare with desired changes
 * // 3. Only update if needed
 * const expected_settings = { desired settings };
 * const settings = getLorebookSettings();
 * if (_.isEqual(_.merge({}, settings, expected_settings), settings)) {
 *   setLorebookSettings(expected_settings);
 * }
 */
function setLorebookSettings(settings: Partial<LorebookSettings>): void;

/**
 * Get list of all world books
 *
 * @returns Array of world book names
 */
function getLorebooks(): string[];

/**
 * Delete a world book
 *
 * @param lorebook World book name
 * @returns Whether deletion was successful (may fail if world book doesn't exist)
 */
async function deleteLorebook(lorebook: string): Promise<boolean>;

/**
 * Create a new world book
 *
 * @param lorebook World book name
 *
 * @returns Whether creation was successful (will fail if world book already exists)
 */
async function createLorebook(lorebook: string): Promise<boolean>;

interface CharLorebooks {
  /** Primary world book name (null if none set) */
  primary: string | null;
  /** Additional world book names */
  additional: string[];
}

/**
 * Get world books bound to a character card
 *
 * @param option Optional parameters
 *   - `name?:string`: Character card name to query (defaults to current character)
 *   - `type?:'all'|'primary'|'additional'`: Filter by binding type (default: 'all')
 *
 * @returns CharLorebooks object containing bound world books
 */
function getCharLorebooks({ name, type }?: GetCharLorebooksOption): CharLorebooks;

/**
 * Get the primary world book bound to current character card
 *
 * @returns Name of primary world book if bound and active (globe icon is green), otherwise `null`
 */
function getCurrentCharPrimaryLorebook(): string | null;

/**
 * Set world books bound to current character card
 *
 * @param lorebooks World book configuration to set
 *    - `primary: string | null;`: Primary world book name (set to null or empty string to remove)
 *    - `additional: string[];`: Additional world book names (empty array removes all)
 */
async function setCurrentCharLorebooks(lorebooks: Partial<CharLorebooks>): Promise<void>;

/**
 * Get the world book bound to current chat
 *
 * @returns Name of bound world book, or null if none bound
 */
async function getChatLorebook(): Promise<string | null>;

/**
 * Set or remove the world book bound to current chat
 *
 * @param lorebook World book name (null to remove binding)
 */
async function setChatLorebook(lorebook: string | null): Promise<void>;

/**
 * Get or create a world book bound to current chat
 *
 * @param lorebook Optional world book name (if not provided, will generate one from chat filename)
 *
 * @returns Name of the chat's world book
 */
async function getOrCreateChatLorebook(lorebook?: string): Promise<string>;
