import { executeSlashCommandsWithOptions } from '@sillytavern/scripts/slash-commands';

export async function triggerSlash(command: string): Promise<string> {
  const result = await executeSlashCommandsWithOptions(command);
  if (result.isError) {
    throw Error(`Error running Slash command '${command}': ${result.errorMessage}`);
  }

  console.info(`Run Slash command: ${command}`);
  return result.pipe;
}
