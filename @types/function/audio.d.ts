/**
 * Toggle audio playback mode
 */
async function audioMode(args: { type: string; mode: string }): Promise<void>;

/**
 * Toggle audio player on/off state
 */
async function audioEnable(args: { type: string; state?: string }): Promise<void>;

/**
 * Toggle play/pause state
 */
async function audioPlay(args: { type: string; play?: string }): Promise<void>;

/**
 * Import audio URL
 */
async function audioImport(args: { type: string; play?: string }, url: string): Promise<void>;

/**
 * Select and play audio
 */
async function audioSelect(args: { type: string }, url: string): Promise<void>;
