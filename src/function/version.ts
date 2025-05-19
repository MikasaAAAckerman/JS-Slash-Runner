import {
  getCurrentVersion,
  updateTavernHelper as updateTavernHelperImpl,
  VERSION_FILE_PATH,
} from '@/util/check_update';

export async function getTavernHelperVersion(): Promise<string> {
  const currentVersion = await getCurrentVersion(VERSION_FILE_PATH);
  if (typeof currentVersion !== 'string') {
    throw new Error('The obtained version number is invalid');
  }
  return currentVersion;
}

export async function updateTavernHelper() {
  return updateTavernHelperImpl();
}
