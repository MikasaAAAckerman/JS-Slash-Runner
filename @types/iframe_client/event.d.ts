/**
 * Events can be:
 * - iframe events from `iframe_events`
 * - tavern events from `tavern_events` 
 * - custom string events
 */
type EventType = IframeEventType | TavernEventType | string;

/**
 * Register `listener` to run when `event_type` occurs
 *
 * - If `listener` is already registered for `event_type`, this has no effect
 *
 * @param event_type Event type to listen for
 * @param listener Function to register
 *
 * @example
 * function hello() { alert("hello"); }
 * eventOn("custom_event", hello);
 *
 * @example
 * // Detect when a message is updated
 * // Works because tavern_events.MESSAGE_UPDATED sends the message ID
 * function detectMessageUpdated(message_id) {
 *   alert(`You just modified message ${message_id} 😡`);
 * }
 * eventOn(tavern_events.MESSAGE_UPDATED, detectMessageUpdated);
 */
function eventOn<T extends EventType>(event_type: T, listener: ListenerType[T]): void;

/**
 * Register `listener` to run when a script button with `event_type` is pressed
 *
 * - If `listener` is already registered for `event_type`, this has no effect
 *
 * @param event_type Button event type to listen for
 * @param listener Function to register
 *
 * @example
 * function hello() { alert("hello"); }
 * eventOnButton("button_name", hello);
 */
function eventOnButton<T extends EventType>(event_type: T, listener: ListenerType[T]): void;

/**
 * Register `listener` to run last when `event_type` occurs
 *
 * - If `listener` is already registered for `event_type`, moves it to last position
 *
 * @param event_type Event type to listen for
 * @param listener Function to register/move to last
 *
 * @example
 * eventMakeLast("custom_event", myFunction);
 */
function eventMakeLast<T extends EventType>(event_type: T, listener: ListenerType[T]): void;

/**
 * Register `listener` to run first when `event_type` occurs
 *
 * - If `listener` is already registered for `event_type`, moves it to first position
 *
 * @param event_type Event type to listen for
 * @param listener Function to register/move to first
 *
 * @example
 * eventMakeFirst("custom_event", myFunction);
 */
function eventMakeFirst<T extends EventType>(event_type: T, listener: ListenerType[T]): void;

/**
 * Register `listener` to run only once on next `event_type` occurrence
 *
 * - If `listener` is already registered for `event_type`, this has no effect
 * - Listener is automatically removed after first execution
 *
 * @param event_type Event type to listen for
 * @param listener Function to register
 *
 * @example
 * eventOnce("custom_event", myFunction);
 */
function eventOnce<T extends EventType>(event_type: T, listener: ListenerType[T]): void;

/**
 * Wait for one occurrence of `event_type`
 *
 * @param event_type Event type to wait for
 *
 * @example
 * await eventWaitOnce(tavern_events.MESSAGE_DELETED);
 */
async function eventWaitOnce(event_type: EventType): Promise<any | undefined>;

/**
 * Wait for `listener` to handle one `event_type` and return its result
 *
 * If providing `listener`, it must already be registered for `event_type`
 *
 * @param event_type Event type the listener is registered for
 * @param listener Function already registered for the event
 *
 * @returns Result from the listener's execution
 *
 * @example
 * eventOnce("save", save);
 * await eventWaitOnce("save", save);
 */
async function eventWaitOnce<T extends EventType>(event_type: T, listener: ListenerType[T]): Promise<any | undefined>;

/**
 * Emit an `event_type` with optional `data` payload
 *
 * All listeners registered for `event_type` will receive the event and data
 *
 * @param event_type Event type to emit
 * @param data Data payload to send with the event
 *
 * @example
 * // Emit "character_stage_updated" event
 * eventEmit("character_stage_updated");
 *
 * @example
 * // Emit "save" event and wait for all listeners to complete
 * await eventEmit("save");
 *
 * @example
 * // Emit event with data payload ["hello", 0]
 * eventEmit("custom_event", "hello", 0);
 */
async function eventEmit<T extends EventType>(event_type: T, ...data: Parameters<ListenerType[T]>): Promise<void>;

/**
 * Remove `listener` from `event_type` listeners
 *
 * - If `listener` is not registered for `event_type`, this has no effect
 *
 * @param event_type Event type to unregister from
 * @param listener Function to unregister
 *
 * @example
 * eventRemoveListener("custom_event", myFunction);
 */
function eventRemoveListener<T extends EventType>(event_type: T, listener: ListenerType[T]): void;

/**
 * Remove all listeners for `event_type` in this iframe
 *
 * @param event_type Event type to clear listeners for
 */
function eventClearEvent(event_type: EventType): void;

/**
 * Remove all event listeners for `listener` in this iframe
 *
 * @param listener Function to remove from all events
 */
function eventClearListener(listener: Function): void;

/**
 * Remove all event listeners in this iframe
 */
function eventClearAll(): void;

//------------------------------------------------------------------------------------------------------------------------
// Available events that can be emitted and listened to

type IframeEventType = (typeof iframe_events)[keyof typeof iframe_events];

// iframe events
const iframe_events = {
  MESSAGE_IFRAME_RENDER_STARTED: 'message_iframe_render_started',
  MESSAGE_IFRAME_RENDER_ENDED: 'message_iframe_render_ended',
  /** `generate` function started */
  GENERATION_STARTED: 'js_generation_started',
  /** Streamed `generate` function sends current full text: "This", "This is", "This is a streamed" */
  STREAM_TOKEN_RECEIVED_FULLY: 'js_stream_token_received_fully',
  /** Streamed `generate` function sends incremental text: "This", "is", "streamed" */
  STREAM_TOKEN_RECEIVED_INCREMENTALLY: 'js_stream_token_received_incrementally',
  /** `generate` function completed */
  GENERATION_ENDED: 'js_generation_ended',
} as const;

type TavernEventType = (typeof tavern_events)[keyof typeof tavern_events];

// Tavern events. **Not recommended to emit manually as the required data format is not documented**
const tavern_events = {
  APP_READY: 'app_ready',
  EXTRAS_CONNECTED: 'extras_connected',
  MESSAGE_SWIPED: 'message_swiped',
  MESSAGE_SENT: 'message_sent',
  MESSAGE_RECEIVED: 'message_received',
  MESSAGE_EDITED: 'message_edited',
  MESSAGE_DELETED: 'message_deleted',
  MESSAGE_UPDATED: 'message_updated',
  MESSAGE_FILE_EMBEDDED: 'message_file_embedded',
  IMPERSONATE_READY: 'impersonate_ready',
  CHAT_CHANGED: 'chat_id_changed',
  GENERATION_AFTER_COMMANDS: 'GENERATION_AFTER_COMMANDS',
  GENERATION_STARTED: 'generation_started',
  GENERATION_STOPPED: 'generation_stopped',
  GENERATION_ENDED: 'generation_ended',
  EXTENSIONS_FIRST_LOAD: 'extensions_first_load',
  EXTENSION_SETTINGS_LOADED: 'extension_settings_loaded',
  SETTINGS_LOADED: 'settings_loaded',
  SETTINGS_UPDATED: 'settings_updated',
  GROUP_UPDATED: 'group_updated',
  MOVABLE_PANELS_RESET: 'movable_panels_reset',
  SETTINGS_LOADED_BEFORE: 'settings_loaded_before',
  SETTINGS_LOADED_AFTER: 'settings_loaded_after',
  CHATCOMPLETION_SOURCE_CHANGED: 'chatcompletion_source_changed',
  CHATCOMPLETION_MODEL_CHANGED: 'chatcompletion_model_changed',
  OAI_PRESET_CHANGED_BEFORE: 'oai_preset_changed_before',
  OAI_PRESET_CHANGED_AFTER: 'oai_preset_changed_after',
  OAI_PRESET_EXPORT_READY: 'oai_preset_export_ready',
  OAI_PRESET_IMPORT_READY: 'oai_preset_import_ready',
  WORLDINFO_SETTINGS_UPDATED: 'worldinfo_settings_updated',
  WORLDINFO_UPDATED: 'worldinfo_updated',
  CHARACTER_EDITED: 'character_edited',
  CHARACTER_PAGE_LOADED: 'character_page_loaded',
  CHARACTER_GROUP_OVERLAY_STATE_CHANGE_BEFORE: 'character_group_overlay_state_change_before',
  CHARACTER_GROUP_OVERLAY_STATE_CHANGE_AFTER: 'character_group_overlay_state_change_after',
  USER_MESSAGE_RENDERED: 'user_message_rendered',
  CHARACTER_MESSAGE_RENDERED: 'character_message_rendered',
  FORCE_SET_BACKGROUND: 'force_set_background',
  CHAT_DELETED: 'chat_deleted',
  CHAT_CREATED: 'chat_created',
  GROUP_CHAT_DELETED: 'group_chat_deleted',
  GROUP_CHAT_CREATED: 'group_chat_created',
  GENERATE_BEFORE_COMBINE_PROMPTS: 'generate_before_combine_prompts',
  GENERATE_AFTER_COMBINE_PROMPTS: 'generate_after_combine_prompts',
  GENERATE_AFTER_DATA: 'generate_after_data',
  GROUP_MEMBER_DRAFTED: 'group_member_drafted',
  WORLD_INFO_ACTIVATED: 'world_info_activated',
  TEXT_COMPLETION_SETTINGS_READY: 'text_completion_settings_ready',
  CHAT_COMPLETION_SETTINGS_READY: 'chat_completion_settings_ready',
  CHAT_COMPLETION_PROMPT_READY: 'chat_completion_prompt_ready',
  CHARACTER_FIRST_MESSAGE_SELECTED: 'character_first_message_selected',
  // TODO: Naming convention is inconsistent with other events
  CHARACTER_DELETED: 'characterDeleted',
  CHARACTER_DUPLICATED: 'character_duplicated',
  STREAM_TOKEN_RECEIVED: 'stream_token_received',
  FILE_ATTACHMENT_DELETED: 'file_attachment_deleted',
  WORLDINFO_FORCE_ACTIVATE: 'worldinfo_force_activate',
  OPEN_CHARACTER_LIBRARY: 'open_character_library',
  ONLINE_STATUS_CHANGED: 'online_status_changed',
  IMAGE_SWIPED: 'image_swiped',
  CONNECTION_PROFILE_LOADED: 'connection_profile_loaded',
  TOOL_CALLS_PERFORMED: 'tool_calls_performed',
  TOOL_CALLS_RENDERED: 'tool_calls_rendered',
} as const;

type ListenerType = {
  [iframe_events.MESSAGE_IFRAME_RENDER_STARTED]: (iframe_name: string) => void;
  [iframe_events.MESSAGE_IFRAME_RENDER_ENDED]: (iframe_name: string) => void;
  [iframe_events.GENERATION_STARTED]: () => void;
  [iframe_events.STREAM_TOKEN_RECEIVED_FULLY]: (full_text: string) => void;
  [iframe_events.STREAM_TOKEN_RECEIVED_INCREMENTALLY]: (incremental_text: string) => void;
  [iframe_events.GENERATION_ENDED]: (text: string) => void;

  [tavern_events.APP_READY]: () => void;
  [tavern_events.EXTRAS_CONNECTED]: (modules: any) => void;
  [tavern_events.MESSAGE_SWIPED]: (message_id: number) => void;
  [tavern_events.MESSAGE_SENT]: (message_id: number) => void;
  [tavern_events.MESSAGE_RECEIVED]: (message_id: number) => void;
  [tavern_events.MESSAGE_EDITED]: (message_id: number) => void;
  [tavern_events.MESSAGE_DELETED]: (message_id: number) => void;
  [tavern_events.MESSAGE_UPDATED]: (message_id: number) => void;
  [tavern_events.MESSAGE_FILE_EMBEDDED]: (message_id: number) => void;
  [tavern_events.IMPERSONATE_READY]: (message: string) => void;
  [tavern_events.CHAT_CHANGED]: (chat_file_name: string) => void;
  [tavern_events.GENERATION_AFTER_COMMANDS]: (
    type: string,
    option: {
      automatic_trigger?: boolean;
      force_name2?: boolean;
      quiet_prompt?: string;
      quietToLoud?: boolean;
      skipWIAN?: boolean;
      force_chid?: number;
      signal?: AbortSignal;
      quietImage?: string;
      quietName?: string;
      depth?: number;
    },
    dry_run: boolean,
  ) => void;
  [tavern_events.GENERATION_STARTED]: (
    type: string,
    option: {
      automatic_trigger?: boolean;
      force_name2?: boolean;
      quiet_prompt?: string;
      quietToLoud?: boolean;
      skipWIAN?: boolean;
      force_chid?: number;
      signal?: AbortSignal;
      quietImage?: string;
      quietName?: string;
      depth?: number;
    },
    dry_run: boolean,
  ) => void;
  [tavern_events.GENERATION_STOPPED]: () => void;
  [tavern_events.GENERATION_ENDED]: (message_id: number) => void;
  [tavern_events.EXTENSIONS_FIRST_LOAD]: () => void;
  [tavern_events.EXTENSION_SETTINGS_LOADED]: () => void;
  [tavern_events.SETTINGS_LOADED]: () => void;
  [tavern_events.SETTINGS_UPDATED]: () => void;
  [tavern_events.GROUP_UPDATED]: () => void;
  [tavern_events.MOVABLE_PANELS_RESET]: () => void;
  [tavern_events.SETTINGS_LOADED_BEFORE]: (settings: Object) => void;
  [tavern_events.SETTINGS_LOADED_AFTER]: (settings: Object) => void;
  [tavern_events.CHATCOMPLETION_SOURCE_CHANGED]: (source: string) => void;
  [tavern_events.CHATCOMPLETION_MODEL_CHANGED]: (model: string) => void;
  [tavern_events.OAI_PRESET_CHANGED_BEFORE]: (result: {
    preset: Object;
    presetName: string;
    settingsToUpdate: Object;
    settings: Object;
    savePreset: Function;
  }) => void;
  [tavern_events.OAI_PRESET_CHANGED_AFTER]: () => void;
  [tavern_events.OAI_PRESET_EXPORT_READY]: (preset: Object) => void;
  [tavern_events.OAI_PRESET_IMPORT_READY]: (result: { data: Object; presetName: string }) => void;
  [tavern_events.WORLDINFO_SETTINGS_UPDATED]: () => void;
  [tavern_events.WORLDINFO_UPDATED]: (name: string, data: { entries: Object[] }) => void;
  [tavern_events.CHARACTER_EDITED]: (result: { detail: { id: string; character: Object } }) => void;
  [tavern_events.CHARACTER_PAGE_LOADED]: () => void;
  [tavern_events.CHARACTER_GROUP_OVERLAY_STATE_CHANGE_BEFORE]: (state: number) => void;
  [tavern_events.CHARACTER_GROUP_OVERLAY_STATE_CHANGE_AFTER]: (state: number) => void;
  [tavern_events.USER_MESSAGE_RENDERED]: (message_id: number) => void;
  [tavern_events.CHARACTER_MESSAGE_RENDERED]: (message_id: number) => void;
  [tavern_events.FORCE_SET_BACKGROUND]: (background: { url: string; path: string }) => void;
  [tavern_events.CHAT_DELETED]: (chat_file_name: string) => void;
  [tavern_events.CHAT_CREATED]: () => void;
  [tavern_events.GROUP_CHAT_DELETED]: (chat_file_name: string) => void;
  [tavern_events.GROUP_CHAT_CREATED]: () => void;
  [tavern_events.GENERATE_BEFORE_COMBINE_PROMPTS]: () => void;
  [tavern_events.GENERATE_AFTER_COMBINE_PROMPTS]: (result: { prompt: string; dryRun: boolean }) => void;
  [tavern_events.GENERATE_AFTER_DATA]: (generate_data: Object) => void;
  [tavern_events.GROUP_MEMBER_DRAFTED]: (character_id: string) => void;
  [tavern_events.WORLD_INFO_ACTIVATED]: (entries: any[]) => void;
  [tavern_events.TEXT_COMPLETION_SETTINGS_READY]: () => void;
  [tavern_events.CHAT_COMPLETION_SETTINGS_READY]: (generate_data: {
    messages: { role: string; content: string }[];
    model: string;
    temprature: number;
    frequency_penalty: number;
    presence_penalty: number;
    top_p: number;
    max_tokens: number;
    stream: boolean;
    logit_bias: Object;
    stop: string[];
    chat_comletion_source: string;
    n?: number;
    user_name: string;
    char_name: string;
    group_names: string[];
    include_reasoning: boolean;
    reasoning_effort: string;
    [others: string]: any;
  }) => void;
  [tavern_events.CHAT_COMPLETION_PROMPT_READY]: (event_data: {
    chat: { role: string; content: string }[];
    dryRun: boolean;
  }) => void;
  [tavern_events.CHARACTER_FIRST_MESSAGE_SELECTED]: (event_args: {
    input: string;
    output: string;
    character: Object;
  }) => void;
  [tavern_events.CHARACTER_DELETED]: (result: { id: string; character: Object }) => void;
  [tavern_events.CHARACTER_DUPLICATED]: (result: { oldAvatar: string; newAvatar: string }) => void;
  [tavern_events.STREAM_TOKEN_RECEIVED]: (text: string) => void;
  [tavern_events.FILE_ATTACHMENT_DELETED]: (url: string) => void;
  [tavern_events.WORLDINFO_FORCE_ACTIVATE]: (entries: Object[]) => void;
  [tavern_events.OPEN_CHARACTER_LIBRARY]: () => void;
  [tavern_events.ONLINE_STATUS_CHANGED]: () => void;
  [tavern_events.IMAGE_SWIPED]: (result: {
    message: Object;
    element: JQuery<HTMLElement>;
    direction: 'left' | 'right';
  }) => void;
  [tavern_events.CONNECTION_PROFILE_LOADED]: (profile_name: string) => void;
  [tavern_events.TOOL_CALLS_PERFORMED]: (tool_invocations: Object[]) => void;
  [tavern_events.TOOL_CALLS_RENDERED]: (tool_invocations: Object[]) => void;
  [custom_event: string]: (...args: any) => any;
};
