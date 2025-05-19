import { isUrl } from '@/util/is_url';

/**
 * Default script configuration type
 */
type ScriptConfig = {
  name: string;
  content: string;
  info: string;
};

/**
 * Default script configuration
 * Contains basic information for each default script
 */
export const DEFAULT_SCRIPT_CONFIGS: Record<string, ScriptConfig> = {
  tagging: {
    name: 'Tagging: Automatically toggle regex and prompt entries based on lorebook, presets or links',
    content: 'https://fastly.jsdelivr.net/gh/StageDog/tavern_resource/dist/酒馆助手/标签化/index.js',
    info: 'https://fastly.jsdelivr.net/gh/StageDog/tavern_resource/src/酒馆助手/标签化/README.md',
  },
  style_loading: {
    name: 'Style Loading: Write character card CSS like Tavern theme customization',
    content: 'https://fastly.jsdelivr.net/gh/StageDog/tavern_resource/dist/酒馆助手/样式加载/index.js',
    info: 'https://fastly.jsdelivr.net/gh/StageDog/tavern_resource/src/酒馆助手/样式加载/README.md',
  },
  preset_protection: {
    name: 'Preset Protection',
    content: 'https://fastly.jsdelivr.net/gh/StageDog/tavern_resource/dist/酒馆助手/预设防误触/index.js',
    info: 'https://fastly.jsdelivr.net/gh/StageDog/tavern_resource/src/酒馆助手/预设防误触/README.md',
  },
  resource_preloading: {
    name: 'Resource Preloading: Cache character card illustrations in advance',
    content: 'https://fastly.jsdelivr.net/gh/StageDog/tavern_resource/dist/酒馆助手/资源预载/index.js',
    info: 'https://fastly.jsdelivr.net/gh/StageDog/tavern_resource/src/酒馆助手/资源预载/README.md',
  },
  auto_close_incompatible: {
    name: 'Auto-Close Incompatible Options',
    content: 'https://fastly.jsdelivr.net/gh/StageDog/tavern_resource/dist/酒馆助手/自动关闭前端卡不兼容选项/index.js',
    info: 'https://fastly.jsdelivr.net/gh/StageDog/tavern_resource/src/酒馆助手/自动关闭前端卡不兼容选项/README.md',
  },
  auto_enable_regex: {
    name: 'Auto-Enable Character Regex',
    content: 'https://fastly.jsdelivr.net/gh/StageDog/tavern_resource/dist/酒馆助手/自动开启角色卡局部正则/index.js',
    info: 'https://fastly.jsdelivr.net/gh/StageDog/tavern_resource/src/酒馆助手/自动开启角色卡局部正则/README.md',
  },
};

function loadScriptContent(content: string): string {
  return isUrl(content) ? `import '${content}'` : content;
}

async function loadScriptInfo(info: string): Promise<string> {
  return isUrl(info) ? (await fetch(info)).text() : info;
}

/**
 * Creating a Single Default Script
 * @param script_id Script ID
 * @returns script object
 */
export async function createDefaultScript(script_id: string): Promise<any> {
  const config = DEFAULT_SCRIPT_CONFIGS[script_id];
  if (!config) {
    console.error(`[Script] Script config not found: ${script_id}`);
    return null;
  }

  try {
    return {
      id: script_id,
      name: config.name,
      content: loadScriptContent(config.content),
      info: await loadScriptInfo(config.info),
      enabled: false,
    };
  } catch (error) {
    console.error(`[Script] Failed to create default script: ${script_id}:`, error);
    return null;
  }
}

/**
 * Creates a default script of the specified type
 * @param type Script type
 * @returns script object
 */
export async function createScript(type: keyof typeof DEFAULT_SCRIPT_CONFIGS): Promise<any> {
  return (await createDefaultScript(type)) || {};
}

/**
 * Create all default scripts
 * @returns Default script array
 */
export async function createDefaultScripts(): Promise<any[]> {
  toastr.info('Loading default scripts...');
  const result = await Promise.all(
    Object.keys(DEFAULT_SCRIPT_CONFIGS).map(script_id => createDefaultScript(script_id)),
  );
  if (result.some(item => item === null)) {
    toastr.error('Failed to create default scripts');
  } else {
    toastr.success('Default scripts created successfully');
  }
  return result;
}
