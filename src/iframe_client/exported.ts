/**
 * Stable API provided by SillyTavern to plugins, see:
 * - SillyTavern/public/scripts/st-context.js 
 * - https://github.com/SillyTavern/SillyTavern/blob/release/public/scripts/st-context.js
 * 
 * You can also view the current API by pressing F12 in SillyTavern and entering:
 * `window.SillyTavern.getContext()`
 */
const SillyTavern = (
  window.parent as unknown as {
    SillyTavern: { getContext: () => Record<string, any> };
  }
).SillyTavern.getContext();

/**
 * Additional features provided by TavernHelper, see:
 * https://n0vi028.github.io/JS-Slash-Runner-Doc
 * 
 * You can also view the current API by pressing F12 in SillyTavern and entering:
 * `window.TavernHelper`
 */
const TavernHelper = (window.parent as unknown as { TavernHelper: Record<string, any> }).TavernHelper;

for (const key in TavernHelper) {
  (window as any)[key] = TavernHelper[key];
}

const toastr = (window.parent as unknown as { toastr: any }).toastr;

/**
 * Additional features provided by the Prompt Template Syntax plugin, see:
 * https://github.com/zonde306/ST-Prompt-Template
 * 
 * You can also view the current API by pressing F12 in SillyTavern and entering:
 * `window.EjsTemplate`
 */
const EjsTemplate = (window.parent as unknown as { EjsTemplate: Record<string, any> }).EjsTemplate;
