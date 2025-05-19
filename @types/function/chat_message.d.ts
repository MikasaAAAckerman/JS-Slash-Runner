interface ChatMessage {
  message_id: number;
  name: string;
  role: 'system' | 'assistant' | 'user';
  is_hidden: boolean;
  message: string;
  data: Record<string, any>;
  extra: Record<string, any>;
}

interface ChatMessageSwiped {
  message_id: number;
  name: string;
  role: 'system' | 'assistant' | 'user';
  is_hidden: boolean;
  swipe_id: number;
  swipes: string[];
  swipes_data: Record<string, any>[];
  swipes_info: Record<string, any>[];
}

interface GetChatMessagesOption {
  /** Filter messages by role; defaults to `'all'` */
  role?: 'all' | 'system' | 'assistant' | 'user';
  /** Filter messages by hidden state; defaults to `'all'` */
  hide_state?: 'all' | 'hidden' | 'unhidden';
  /** Whether to include message pages not used by AI (like unselected openings or re-rolled floors). If false returns `ChatMessage`, if true returns `ChatMessageSwiped`; defaults to `false` */
  include_swipes?: boolean;
}

/**
 * Get chat messages, only retrieving the message page used by AI for each floor
 *
 * @param range Message floor number or range to retrieve, e.g. `0`, `'0-{{lastMessageId}}'`, `-1`, etc. Negative numbers indicate depth, e.g. `-1` for the latest message floor, `-2` for the second-to-last message floor.
 * @param option Optional parameters
 *   - `role:'all'|'system'|'assistant'|'user'`: Filter messages by role; defaults to `'all'`
 *   - `hide_state:'all'|'hidden'|'unhidden'`: Filter messages by hidden state; defaults to `'all'`
 *   - `include_swipes:false`: Do not include message pages not used by AI
 *
 * @returns A `ChatMessage` array, sorted by message_id from low to high
 *
 * @example
 * // Get only the message page used by AI for floor 10
 * const chat_messages = getChatMessages(10);
 * const chat_messages = getChatMessages('10');
 * const chat_messages = getChatMessages('10', { include_swipes: false });
 *
 * @example
 * // Get the message page used by AI for the latest floor
 * const chat_message = getChatMessages(-1)[0];  // or getChatMessages('{{lastMessageId}}')[0]
 *
 * @example
 * // Get message pages used by AI for all floors
 * const chat_messages = getChatMessages('0-{{lastMessageId}}');
 */
function getChatMessages(
  range: string | number,
  { role, hide_state, include_swipes }?: Omit<GetChatMessagesOption, 'include_swipes'> & { include_swipes?: false },
): ChatMessage[];

/**
 * Get chat messages, retrieving all message pages for each floor including those not used by AI
 *
 * @param range Message floor number or range to retrieve, e.g. `0`, `'0-{{lastMessageId}}'`, `-1`, etc. Negative numbers indicate depth, e.g. `-1` for the latest message floor, `-2` for the second-to-last message floor.
 * @param option Optional parameters
 *   - `role:'all'|'system'|'assistant'|'user'`: Filter messages by role; defaults to `'all'`
 *   - `hide_state:'all'|'hidden'|'unhidden'`: Filter messages by hidden state; defaults to `'all'`
 *   - `include_swipes:true`: Include message pages not used by AI
 *
 * @returns A `ChatMessageSwiped` array, sorted by message_id from low to high
 *
 * @example
 * // Get all message pages for floor 10
 * const chat_messages = getChatMessages(10, { include_swipes: true });
 * const chat_messages = getChatMessages('10', { include_swipes: true });
 *
 * @example
 * // Get all message pages for the latest floor
 * const chat_message = getChatMessages(-1, { include_swipes: true })[0];  // or getChatMessages('{{lastMessageId}}', { include_swipes: true })[0]
 *
 * @example
 * // Get all message pages for all floors
 * const chat_messages = getChatMessages('0-{{lastMessageId}}', { include_swipes: true });
 */
function getChatMessages(
  range: string | number,
  { role, hide_state, include_swipes }?: Omit<GetChatMessagesOption, 'include_swipes'> & { include_swipes?: true },
): ChatMessageSwiped[];

/**
 * Get chat messages (generic version)
 *
 * @param range Message floor number or range to retrieve, e.g. `0`, `'0-{{lastMessageId}}'`, `-1`, etc. Negative numbers indicate depth, e.g. `-1` for the latest message floor, `-2` for the second-to-last message floor.
 * @param option Optional parameters
 *   - `role:'all'|'system'|'assistant'|'user'`: Filter messages by role; defaults to `'all'`
 *   - `hide_state:'all'|'hidden'|'unhidden'`: Filter messages by hidden state; defaults to `'all'`
 *   - `include_swipes:boolean`: Whether to include message pages not used by AI, such as unselected openings or re-rolled floors. If false returns `ChatMessage`, if true returns `ChatMessageSwiped`; defaults to `false`
 *
 * @returns An array of messages for each floor, sorted by message_id from low to high, of type `ChatMessage` or `ChatMessageSwiped` (depending on `include_swipes` value, defaults to `ChatMessage`).
 */
function getChatMessages(
  range: string | number,
  { role, hide_state, include_swipes }?: GetChatMessagesOption,
): (ChatMessage | ChatMessageSwiped)[];

interface SetChatMessagesOption {
  /**
   * Whether to update message display on page - only updates floors already loaded in UI and triggers "format-only" regex; defaults to `'affected'`
   * - `'none'`: Don't update display
   * - `'affected'`: Only update affected floors, triggers `tavern_events.USER_MESSAGE_RENDERED` or `tavern_events.CHARACTER_MESSAGE_RENDERED` events
   * - `'all'`: Reload entire chat, triggers `tavern_events.CHAT_CHANGED` event
   */
  refresh?: 'none' | 'affected' | 'all';
}

/**
 * Modify chat message data
 *
 * @param chat_messages Messages to modify, must include `message_id` field
 * @param option Optional parameters
 *   - `refresh:'none'|'affected'|'all'`: Whether to update message display on page - only updates floors already loaded in UI and triggers "format-only" regex; defaults to `'affected'`
 *
 * @example
 * // Modify the content of floor 10's AI-used message page
 * await setChatMessages([{message_id: 10, message: 'New message'}]);
 *
 * @example
 * // Add floor variables to second-to-last floor
 * const chat_message = getChatMessages(-2)[0];
 * _.set(chat_message.data, 'Kagura Light Affection', 5);
 * await setChatMessages([{message_id: 0, data: chat_message.data}], {refresh: 'none'});
 *
 * @example
 * // Switch to opening 3
 * await setChatMessages([{message_id: 0, swipe_id: 2}]);
 *
 * @example
 * // Hide all floors
 * const last_message_id = getLastMessageId();
 * await setChatMessages(_.range(last_message_id + 1).map(message_id => ({message_id, is_hidden: true})));
 */
async function setChatMessages(
  chat_messages: Array<{ message_id: number } & (Partial<ChatMessage> | Partial<ChatMessageSwiped>)>,
  { refresh }?: SetChatMessagesOption,
);

interface ChatMessageCreating {
  name?: string;
  role: 'system' | 'assistant' | 'user';
  is_hidden?: boolean;
  message: string;
  data?: Record<string, any>;
}

interface CreateChatMessagesOption {
  /** Insert before or at the end of the specified floor */
  insert_at?: number | 'end';

  /**
   * Whether to update message display on page - only updates floors already loaded in UI and triggers "format-only" regex; defaults to `'affected'`
   * - `'none'`: Don't update display
   * - `'affected'`: Only update affected floors
   * - `'all'`: Reload entire chat, triggers `tavern_events.CHAT_CHANGED` event
   */
  refresh?: 'none' | 'affected' | 'all';
}

/**
 * Create chat messages
 *
 * @param chat_messages Messages to create, must include `role` and `message` fields
 * @param option Optional parameters
 *   - `insert_at:number|'end'`: Insert before specified floor or at the end
 *   - `refresh:'none'|'affected'|'all'`: Whether to update message display on page - only updates floors already loaded in UI and triggers "format-only" regex; defaults to `'affected'`
 *
 * @example
 * // Insert a message before floor 10
 * await createChatMessages([{role: 'user', message: 'Hello'}], {insert_at: 10});
 *
 * @example
 * // Insert a message at the end
 * await createChatMessages([{role: 'user', message: 'Hello'}]);
 */
async function createChatMessages(
  chat_messages: ChatMessageCreating[],
  { insert_at, refresh }?: CreateChatMessagesOption,
): Promise<void>;

interface DeleteChatMessagesOption {
  /**
   * Whether to update message display on page - only updates floors already loaded in UI and triggers "format-only" regex; defaults to `'all'`
   * - `'none'`: Don't update display
   * - `'all'`: Reload entire chat, triggers `tavern_events.CHAT_CHANGED` event
   */
  refresh?: 'none' | 'all';
}

/**
 * Delete chat messages
 *
 * @param message_ids Array of message floor numbers to delete
 * @param option Optional parameters
 *   - `refresh:'none'|'all'`: Whether to update message display on page - only updates floors already loaded in UI and triggers "format-only" regex; defaults to `'all'`
 *
 * @example
 * // Delete floors 10, 15, second-to-last and last floor
 * await deleteChatMessages([10, 15, -2, getLastMessageId()]);
 *
 * @example
 * // Delete all floors
 * await deleteChatMessages(_.range(getLastMessageId() + 1));
 */
async function deleteChatMessages(message_ids: number[], { refresh }?: DeleteChatMessagesOption): Promise<void>;

interface RotateChatMessagesOption {
  /**
   * Whether to update message display on page - only updates floors already loaded in UI and triggers "format-only" regex; defaults to `'all'`
   * - `'none'`: Don't update display
   * - `'all'`: Reload entire chat, triggers `tavern_events.CHAT_CHANGED` event
   */
  refresh?: 'none' | 'all';
}

/**
 * Rotate message floors from original order `[begin, middle) [middle, end)` to `[middle, end) [begin, middle)`
 *
 * @param begin Starting floor number before rotation
 * @param middle Floor number that will be moved to the start after rotation
 * @param end Ending floor number + 1 before rotation
 * @param option Optional parameters
 *   - `refresh:'none'|'all'`: Whether to update message display on page - only updates floors already loaded in UI and triggers "format-only" regex; defaults to `'all'`
 *
 * @example
 * // Move last floor before floor 5
 * await rotateChatMessages(5, getLastMessageId(), getLastMessageId() + 1);
 *
 * // Move last 3 floors before floor 1
 * await rotateChatMessages(1, getLastMessageId() - 2, getLastMessageId() + 1);
 *
 * // Move first 3 floors to the end
 * await rotateChatMessages(0, 3, getLastMessageId() + 1);
 */
async function rotateChatMessages(
  begin: number,
  middle: number,
  end: number,
  { refresh }?: RotateChatMessagesOption,
): Promise<void>;
