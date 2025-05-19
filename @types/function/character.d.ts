/**
 * Character card management class
 * Encapsulates character card data operations and provides convenient access methods
 */
class Character {
  constructor(characterData: v1CharData);

  /**
   * Find character card data by name or avatar ID
   * @param options Search options
   * @returns Found character card data, or null if not found
   */
  static find({ name, allowAvatar }?: { name?: string; allowAvatar?: boolean }): v1CharData;

  /**
   * Find character card index in characters array by name (similar to this_chid)
   * @param name Character name
   * @returns Index of character card in characters array, or -1 if not found
   */
  static findCharacterIndex(name: string): any;

  /**
   * Get chat content from server for each chat file and compile into dictionary.
   * This function iterates through provided chat metadata and requests actual chat content.
   *
   * @param {Array} data - Array containing metadata for each chat (e.g. filenames)
   * @param {boolean} isGroupChat - Flag indicating if chat is a group chat
   * @returns {Promise<Object>} chat_dict - Dictionary where each key is filename and value is
   * the corresponding chat content from server
   */
  static getChatsFromFiles(data: any[], isGroupChat: boolean): Promise<Record<string, any>>;

  /**
   * Get character management data
   * @returns Complete character management data object
   */
  getCardData(): v1CharData;

  /**
   * Get character avatar ID
   * @returns Avatar ID/filename
   */
  getAvatarId(): string;

  /**
   * Get regex scripts
   * @returns Array of regex scripts
   */
  getRegexScripts(): Array<{
    id: string;
    scriptName: string;
    findRegex: string;
    replaceString: string;
    trimStrings: string[];
    placement: number[];
    disabled: boolean;
    markdownOnly: boolean;
    promptOnly: boolean;
    runOnEdit: boolean;
    substituteRegex: number | boolean;
    minDepth: number;
    maxDepth: number;
  }>;

  /**
   * Get character book
   * @returns Character book data object or null
   */
  getCharacterBook(): {
    name: string;
    entries: Array<{
      keys: string[];
      secondary_keys?: string[];
      comment: string;
      content: string;
      constant: boolean;
      selective: boolean;
      insertion_order: number;
      enabled: boolean;
      position: string;
      extensions: any;
      id: number;
    }>;
  } | null;

  /**
   * Get character world name
   * @returns World name
   */
  getWorldName(): string;
}

/**
 * Get character card data
 * @param name Character name or avatar ID
 * @param allowAvatar Whether to allow lookup by avatar ID
 * @returns Character card data
 */
function getCharData(name?: string, allowAvatar?: boolean): v1CharData | null;

/**
 * Get character avatar path
 * @param name Character name or avatar ID
 * @param allowAvatar Whether to allow lookup by avatar ID
 * @returns Character avatar path
 */
function getCharAvatarPath(name?: string, allowAvatar?: boolean): string | null;

/**
 * Get character chat history summary
 * @param name Character name or avatar ID
 * @param allowAvatar Whether to allow lookup by avatar ID
 * @returns Array of chat history summaries
 */
function getChatHistoryBrief(name?: string, allowAvatar?: boolean): Promise<any[] | null>;

/**
 * Get detailed chat history
 * @param data Array of chat data
 * @param isGroupChat Whether it's a group chat
 * @returns Detailed chat history
 */
function getChatHistoryDetail(data: any[], isGroupChat?: boolean): Promise<Record<string, any> | null>;
