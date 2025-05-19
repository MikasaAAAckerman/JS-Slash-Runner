interface GenerateConfig {
  /** User input text */
  user_input?: string;

  /**
   * Image input, supports following formats:
   * - File object: From input[type="file"]
   * - Base64 string: Base64 encoded image
   * - URL string: Online image URL
   */
  image?: File | string;

  /**
   * Enable streaming; defaults to `false`.
   *
   * When enabled, the function will emit events for each stream result:
   * - `iframe_events.STREAM_TOKEN_RECEIVED_FULLY`: Current full text ("This", "This is", "This is streaming")
   * - `iframe_events.STREAM_TOKEN_RECEIVED_INCREMENTALLY`: Current incremental text ("This", "is", "streaming")
   *
   * @example
   * eventOn(iframe_events.STREAM_TOKEN_RECEIVED_FULLY, text => console.info(text));
   */
  should_stream?: boolean;

  /**
   * Override options. When set, fields in `overrides` will replace corresponding prompts.
   *   Example: `overrides.char_description = 'Override character description';` will override character description.
   */
  overrides?: Overrides;

  /** Additional prompts to inject */
  injects?: InjectionPrompt[];

  /** Maximum chat history items to use; defaults to 'all' */
  max_chat_history?: 'all' | number;
}

interface GenerateRawConfig {
  /**
   * User input text.
   *
   * If set, will be added as a prompt regardless of whether 'user_input' exists in ordered_prompts;
   * by default added at the end of 'chat_history'.
   */
  user_input?: string;

  /**
   * Image input, supports following formats:
   * - File object: From input[type="file"]
   * - Base64 string: Base64 encoded image
   * - URL string: Online image URL
   */
  image?: File | string;

  /**
   * Enable streaming; defaults to `false`.
   *
   * When enabled, the function will emit events for each stream result:
   * - `iframe_events.STREAM_TOKEN_RECEIVED_FULLY`: Current full text ("This", "This is", "This is streaming")
   * - `iframe_events.STREAM_TOKEN_RECEIVED_INCREMENTALLY`: Current incremental text ("This", "is", "streaming")
   *
   * @example
   * eventOn(iframe_events.STREAM_TOKEN_RECEIVED_FULLY, text => console.info(text));
   */
  should_stream?: boolean;

  /**
   * Override options. When set, fields in `overrides` will replace corresponding prompts.
   *   Example: `overrides.char_description = 'Override character description';` will override character description.
   */
  overrides?: Overrides;

  injects?: InjectionRawPrompt[];

  /**
   * An array of prompts that will be sent to AI in order, effectively creating a custom preset. The array can contain:
   * - `BuiltinPrompt`: Built-in prompts. Since no preset is used, you must specify which prompts to include and their order
   *                    If you don't want to specify, use `builtin_prompt_default_order` to get tavern's default order
   *                    (though in this case you might prefer using `generate` instead).
   * - `RolePrompt`: Additional custom prompts.
   */
  ordered_prompts?: (BuiltinPrompt | RolePrompt)[];

  /** Maximum chat history items to use; defaults to 'all' */
  max_chat_history?: 'all' | number;
}

interface RolePrompt {
  role: 'system' | 'assistant' | 'user';
  content: string;
  image?: File | string;
}

interface InjectionPrompt {
  role: 'system' | 'assistant' | 'user';
  content: string;

  /** Injection position. 'none' won't send to AI but can activate world book entries. */
  position: 'before_prompt' | 'in_chat' | 'after_prompt' | 'none';

  depth: number;

  /** Whether to include in world book scanning */
  should_scan: boolean;
}

interface InjectionRawPrompt {
  role: 'system' | 'assistant' | 'user';
  content: string;

  /** Injection position. 'none' won't send to AI but can activate world book entries. */
  position: 'in_chat' | 'none';

  depth: number;

  /** Whether to include in world book scanning */
  should_scan: boolean;
}

interface Overrides {
  world_info_before?: string;
  persona_description?: string;
  char_description?: string;
  char_personality?: string;
  scenario?: string;
  world_info_after?: string;
  dialogue_examples?: string;

  /**
   * Chat history configuration
   * - `with_depth_entries`: Whether to enable world book entries inserted by depth; defaults to `true`
   * - `author_note`: If set, overrides "author's note" with given string
   * - `prompts`: If set, overrides "chat history" with given prompts
   */
  chat_history?: {
    with_depth_entries?: boolean;
    author_note?: string;
    prompts?: RolePrompt[];
  };
}

/**
 * Default order of built-in prompts used in presets
 */
const builtin_prompt_default_order: BuiltinPrompt[];

type BuiltinPrompt =
  | 'world_info_before'
  | 'persona_description'
  | 'char_description'
  | 'char_personality'
  | 'scenario'
  | 'world_info_after'
  | 'dialogue_examples'
  | 'chat_history'
  | 'user_input';

/**
 * Generate text using the tavern's currently enabled preset.
 *
 * This function emits the following events during execution:
 * - `iframe_events.GENERATION_STARTED`: Generation started
 * - If streaming enabled, `iframe_events.STREAM_TOKEN_RECEIVED_FULLY`: Current full text ("This", "This is", "This is streaming")
 * - If streaming enabled, `iframe_events.STREAM_TOKEN_RECEIVED_INCREMENTALLY`: Current incremental text ("This", "is", "streaming")
 * - `iframe_events.GENERATION_ENDED`: Generation ended, returns final generated text (also available via function return value)
 *
 * @param config Prompt and generation configuration
 *   - `user_input?:string`: User input text
 *   - `should_stream?:boolean`: Enable streaming; defaults to 'false'
 *   - `image?:File|string`: Image input
 *   - `overrides?:Overrides`: Override options. When set, fields will replace corresponding prompts. Example: `overrides.char_description = 'Override character description'`
 *   - `injects?:InjectionPrompt[]`: Additional prompts to inject
 *   - `max_chat_history?:'all'|number`: Maximum chat history items to use
 * @returns Generated final text
 *
 * @example
 * // Streaming generation
 * const result = await generate({ user_input: 'Hello', should_stream: true });
 *
 * @example
 * // Image input
 * const result = await generate({ user_input: 'Hello', image: 'https://example.com/image.jpg' });
 *
 * @example
 * // Inject and override prompts
 * const result = await generate({
 *   user_input: 'Hello',
 *   injects: [{ role: 'system', content: 'Chain of thought...', position: 'in_chat', depth: 0, should_scan: true }],
 *   overrides: {
 *     char_personality: 'Kind',
 *     world_info_before: '',
 *     chat_history: {
 *       prompts: []
 *     }
 *   }
 * });
 */
async function generate(config: GenerateConfig): Promise<string>;

/**
 * Generate text without using the tavern's currently enabled preset.
 *
 * This function emits the following events during execution:
 * - `iframe_events.GENERATION_STARTED`: Generation started
 * - If streaming enabled, `iframe_events.STREAM_TOKEN_RECEIVED_FULLY`: Current full text ("This", "This is", "This is streaming")
 * - If streaming enabled, `iframe_events.STREAM_TOKEN_RECEIVED_INCREMENTALLY`: Current incremental text ("This", "is", "streaming")
 * - `iframe_events.GENERATION_ENDED`: Generation ended, returns final generated text (also available via function return value)
 *
 * @param config Prompt and generation configuration
 *   - `user_input?:string`: User input text
 *   - `should_stream?:boolean`: Enable streaming; defaults to 'false'
 *   - `image?:File|string`: Image input
 *   - `overrides?:Overrides`: Override options. When set, fields will replace corresponding prompts. Example: `overrides.char_description = 'Override character description'`
 *   - `injects?:InjectionPrompt[]`: Additional prompts to inject
 *   - `max_chat_history?:'all'|number`: Maximum chat history items to use
 *   - `ordered_prompts?:(BuiltinPrompt|RolePrompt)[]`: Array of prompts to send to AI in order (creates custom preset)
 * @returns Generated final text
 *
 * @example
 * // Custom built-in prompt order (prompts not in ordered_prompts won't be used)
 * const result = await generateRaw({
 *   user_input: 'Hello',
 *   ordered_prompts: [
 *     'char_description',
 *     { role: 'system', content: 'System prompt' },
 *     'chat_history',
 *     'user_input'
 *   ]
 * })
 */
async function generateRaw(config: GenerateRawConfig): Promise<string>;
