interface LorebookEntry {
  /** uid is relative to the world book - don't use across different world books */
  uid: number;
  /** Display order when sorting is set to "Custom" in tavern */
  display_index: number;

  comment: string;
  enabled: boolean;
  type: 'constant' | 'selective' | 'vectorized';
  position:
    | 'before_character_definition'
    | 'after_character_definition'
    | 'before_example_messages'
    | 'after_example_messages'
    | 'before_author_note'
    | 'after_author_note'
    | 'at_depth_as_system'
    | 'at_depth_as_assistant'
    | 'at_depth_as_user';

  /** Only meaningful when `position === 'at_depth_as_???'`; otherwise null */
  depth: number | null;
  order: number;
  probability: number;

  keys: string[];
  logic: 'and_any' | 'and_all' | 'not_all' | 'not_any';
  filters: string[];

  scan_depth: 'same_as_global' | number;
  case_sensitive: 'same_as_global' | boolean;
  match_whole_words: 'same_as_global' | boolean;
  use_group_scoring: 'same_as_global' | boolean;
  automation_id: string | null;

  exclude_recursion: boolean;
  prevent_recursion: boolean;
  /** true if enabled, or number if specific Recursion Level is set (see tavern UI when this option is checked) */
  delay_until_recursion: boolean | number;

  content: string;

  group: string;
  group_prioritized: boolean;
  group_weight: number;
  sticky: number | null;
  cooldown: number | null;
  delay: number | null;
}

interface GetLorebookEntriesOption {
  /** Filter entries by field values, e.g. `{position: 'at_depth_as_system'}` gets only entries at @D⚙ position. Defaults to no filtering. Due to implementation limits, only simple filtering is possible. For complex filtering, get all entries and filter them yourself. */
  filter?: 'none' | Partial<LorebookEntry>;
}

/**
 * Get entry information from a world book
 *
 * @param lorebook World book name
 *
 * @returns An array containing all entry information
 *
 * @example
 * // Get all entries from a world book
 * const entries = await getLorebookEntries("eramgt少女歌剧");
 */
async function getLorebookEntries(lorebook: string): Promise<LorebookEntry[]>;

/**
 * Completely replace all entries in world book `lorebook` with `entries`
 *
 * @param lorebook World book name
 * @param entries Array of entries to replace with. If `uid` is not set or duplicated, new uids will be assigned. If any fields are missing, tavern default values will be used.
 *
 * @example
 * // Disable recursion for all entries while keeping other settings
 * const entries = await getLorebookEntries("eramgt少女歌剧");
 * await replaceLorebookEntries("eramgt少女歌剧", entries.map(entry => ({ ...entry, prevent_recursion: true })));
 *
 * @example
 * // Delete all entries containing '神乐光' in their comment
 * const entries = await getLorebookEntries("eramgt少女歌剧");
 * _.remove(entries, entry => entry.comment.includes('神乐光'));
 * await replaceLorebookEntries("eramgt少女歌剧", entries);
 */
async function replaceLorebookEntries(lorebook: string, entries: Partial<LorebookEntry>[]): Promise<void>;

type LorebookEntriesUpdater =
  | ((entries: LorebookEntry[]) => Partial<LorebookEntry>[])
  | ((entries: LorebookEntry[]) => Promise<Partial<LorebookEntry>[]>);

/**
 * Update world book `lorebook` using the `updater` function
 *
 * @param updater Function that updates the world book. It should receive world book entries as input and return updated entries.
 *
 * @returns Updated world book entries
 *
 * @example
 * // Delete all entries containing '神乐光' in their comment
 * await updateLorebookEntriesWith("eramgt少女歌剧", entries => entries.filter(entry => entry.comment.includes('神乐光')))
 */
async function updateLorebookEntriesWith(lorebook: string, updater: LorebookEntriesUpdater): Promise<LorebookEntry[]>;

/**
 * Modify entry information in the specified world book. If a field is missing, the original value will be kept.
 *
 * This only modifies existing entries - it cannot create new ones. Entries must already exist in the world book.
 *
 * @param lorebook World book name containing the entries
 * @param entries Array of entry information. Each must include "uid", other fields are optional.
 *
 * @returns Updated world book entries
 */
async function setLorebookEntries(
  lorebook: string,
  entries: Array<Pick<LorebookEntry, 'uid'> & Partial<LorebookEntry>>,
): Promise<LorebookEntry[]>;

/**
 * Add new entries to a world book
 *
 * @param lorebook World book name
 * @param entries Field values for new entries. Uses tavern defaults if not specified. **Cannot set `uid`**.
 *
 * @returns Updated world book entries and uids of new entries
 */
async function createLorebookEntries(
  lorebook: string,
  entries: Partial<LorebookEntry>[],
): Promise<{ entries: LorebookEntry[]; new_uids: number[] }>;

/**
 * Delete entries from a world book
 *
 * @param lorebook World book name
 * @param uids Array of uids to delete
 *
 * @returns Updated world book entries and whether deletion occurred
 */
async function deleteLorebookEntries(
  lorebook: string,
  uids: number[],
): Promise<{ entries: LorebookEntry[]; delete_occurred: boolean }>;

//----------------------------------------------------------------------------------------------------------------------
/** @deprecated Use `createLorebookEntries` instead */
async function createLorebookEntry(lorebook: string, field_values: Partial<LorebookEntry>): Promise<number>;

/** @deprecated Use `deleteLorebookEntries` instead */
async function deleteLorebookEntry(lorebook: string, lorebook_uid: number): Promise<boolean>;
