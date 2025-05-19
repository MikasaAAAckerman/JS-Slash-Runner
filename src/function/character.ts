import { charsPath } from '@/util/extension_variables';
import { characters, getPastCharacterChats, getRequestHeaders, getThumbnailUrl, this_chid } from '@sillytavern/script';
import { v1CharData } from '@sillytavern/scripts/char-data';

export class Character {
  private charData: v1CharData;

  constructor(characterData: v1CharData) {
    this.charData = characterData;
  }

  static find({ name, allowAvatar = true }: { name?: string; allowAvatar?: boolean } = {}): v1CharData {
    if (name === undefined) {
      // @ts-ignore
      const currentChar = characters[this_chid];
      if (currentChar) {
        name = currentChar.avatar;
        // Ensure allowAvatar is true to accurately find character by avatar
        allowAvatar = true;
      }
    }

    const matches = (char: { avatar: string; name: string }) =>
      !name || char.name === name || (allowAvatar && char.avatar === name);

    const filteredCharacters = characters;

    // If exact avatar ID is provided, return that character
    if (allowAvatar && name) {
      const characterByAvatar = filteredCharacters.find(char => char.avatar === name);
      if (characterByAvatar) {
        return characterByAvatar;
      }
    }

    // Find all matching characters
    const matchingCharacters = name ? filteredCharacters.filter(matches) : filteredCharacters;
    if (matchingCharacters.length > 1) {
      console.warn(`Found multiple matching characters, returning earliest imported: ${name}`);
    }

    if (matchingCharacters.length === 0) {
      throw new Error(`No matching character found for name/avatar ID: ${name}`);
    }

    return matchingCharacters[0];
  }

  static findCharacterIndex(name: string): number {
    const matchTypes = [
      (a: string, b: string) => a === b,
      (a: string, b: string) => a.startsWith(b),
      (a: string, b: string) => a.includes(b),
    ];

    const exactAvatarMatch = characters.findIndex(x => x.avatar === name);

    if (exactAvatarMatch !== -1) {
      return exactAvatarMatch;
    }

    for (const matchType of matchTypes) {
      const index = characters.findIndex(x => matchType(x.name.toLowerCase(), name.toLowerCase()));
      if (index !== -1) {
        return index;
      }
    }

    return -1;
  }

  static async getChatsFromFiles(data: any[], isGroupChat: boolean): Promise<Record<string, any>> {
    const chat_dict: Record<string, any> = {};
    const chat_list = Object.values(data)
      .sort((a, b) => a['file_name'].localeCompare(b['file_name']))
      .reverse();

    const chat_promise = chat_list.map(async ({ file_name }) => {
      // Extract character name from filename (part before dash)
      const ch_name = isGroupChat ? '' : file_name.split(' - ')[0];

      // Use Character.find to get character and avatar
      let characterData = null;
      let avatar_url = '';

      if (!isGroupChat && ch_name) {
        characterData = Character.find({ name: ch_name });
        if (characterData) {
          avatar_url = characterData.avatar;
        }
      }

      const endpoint = isGroupChat ? '/api/chats/group/get' : '/api/chats/get';
      const requestBody = isGroupChat
        ? JSON.stringify({ id: file_name })
        : JSON.stringify({
            ch_name: ch_name,
            file_name: file_name.replace('.jsonl', ''),
            avatar_url: avatar_url,
          });

      const chatResponse = await fetch(endpoint, {
        method: 'POST',
        headers: getRequestHeaders(),
        body: requestBody,
        cache: 'no-cache',
      });

      if (!chatResponse.ok) {
        return;
      }

      const currentChat = await chatResponse.json();
      if (!isGroupChat) {
        // Remove first message (metadata) for individual chats only
        currentChat.shift();
      }
      chat_dict[file_name] = currentChat;
    });

    await Promise.all(chat_promise);

    return chat_dict;
  }

  getCardData(): v1CharData {
    return this.charData;
  }

  getAvatarId(): string {
    return this.charData.avatar || '';
  }

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
  }> {
    return this.charData.data?.extensions?.regex_scripts || [];
  }

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
  } | null {
    return this.charData.data?.character_book || null;
  }

  getWorldName(): string {
    return this.charData.data?.extensions?.world || '';
  }
}

export function getCharData(name?: string, allowAvatar: boolean = true): v1CharData | null {
  try {
    const characterData = Character.find({ name, allowAvatar });
    if (!characterData) return null;

    const character = new Character(characterData);
    console.info(`Successfully got character card data for: ${name || 'unknown'}`);
    return character.getCardData();
  } catch (error) {
    console.error(`Failed to get character card data for: ${name || 'unknown'}`, error);
    return null;
  }
}

export function getCharAvatarPath(name?: string, allowAvatar: boolean = true): string | null {
  try {
    const characterData = Character.find({ name, allowAvatar });
    if (!characterData) return null;

    const character = new Character(characterData);
    const avatarId = character.getAvatarId();

    // Get thumbnail URL and extract actual filename
    const thumbnailPath = getThumbnailUrl('avatar', avatarId);
    const targetAvatarImg = thumbnailPath.substring(thumbnailPath.lastIndexOf('=') + 1);

    // Assume charsPath is defined elsewhere
    console.info(`Successfully got character avatar path for: ${name || 'unknown'}`);
    return charsPath + targetAvatarImg;
  } catch (error) {
    console.error(`Failed to get character avatar path for: ${name || 'unknown'}`, error);
    return null;
  }
}

export async function getChatHistoryBrief(name?: string, allowAvatar: boolean = true): Promise<any[] | null> {
  try {
    const characterData = Character.find({ name, allowAvatar });
    if (!characterData) return null;

    const character = new Character(characterData);
    const index = Character.findCharacterIndex(character.getAvatarId());

    if (index === -1) return null;

    const chats = await getPastCharacterChats(index);
    console.info(`Successfully got chat history summary for: ${name || 'unknown'}`);
    return chats;
  } catch (error) {
    console.error(`Failed to get chat history summary for: ${name || 'unknown'}`, error);
    return null;
  }
}

export async function getChatHistoryDetail(
  data: any[],
  isGroupChat: boolean = false,
): Promise<Record<string, any> | null> {
  try {
    const result = await Character.getChatsFromFiles(data, isGroupChat);
    console.info(`Successfully got chat file details`);
    return result;
  } catch (error) {
    console.error(`Failed to get chat file details`, error);
    return null;
  }
}
