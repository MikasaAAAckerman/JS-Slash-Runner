import { getRequestHeaders } from '@sillytavern/script';
import { extensionTypes } from '@sillytavern/scripts/extensions';
import { t } from '@sillytavern/scripts/i18n';
import { POPUP_TYPE, callGenericPopup } from '@sillytavern/scripts/popup';
import { extensionFolderPath, extensionName } from './extension_variables';
import { renderMarkdown } from './render_markdown';

const GITLAB_INSTANCE_URL = 'gitlab.com';
const GITLAB_PROJECT_PATH = 'novi028/JS-Slash-Runner';
const GITLAB_BRANCH = 'main';
const VERSION_FILE_PATH_GITLAB = 'manifest.json';
const CHANGELOG_FILE_PATH_GITLAB = 'CHANGELOG.md';
export const VERSION_FILE_PATH = `/scripts/extensions/${extensionFolderPath}/manifest.json`;
let CURRENT_VERSION: string;
let LATEST_VERSION: string;
let CHANGELOG_CONTENT: string;

/**
 * Get raw file content from GitLab repository (supports project ID or path)
 * @param filePath File path in repository (will be URL encoded automatically)
 * @returns Promise<string> containing file content
 */
async function fetchRawFileContentFromGitLab(filePath: string): Promise<string> {
  const idOrPathForUrl =
    typeof GITLAB_PROJECT_PATH === 'string' && GITLAB_PROJECT_PATH.includes('/')
      ? encodeURIComponent(GITLAB_PROJECT_PATH)
      : GITLAB_PROJECT_PATH;
  const encodedFilePath = encodeURIComponent(filePath);
  const url = `https://${GITLAB_INSTANCE_URL}/api/v4/projects/${idOrPathForUrl}/repository/files/${encodedFilePath}/raw?ref=${GITLAB_BRANCH}`;

  const headers: HeadersInit = {
    'Cache-Control': 'no-cache',
  };

  try {
    const response = await fetch(url, { method: 'GET', headers: headers });
    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch (e) {
        /* ignore */
      }
      throw new Error(
        `[TavernHelper] Failed to get GitLab file: ${response.status} ${response.statusText}. URL: ${url}. Response: ${errorBody}`,
      );
    }
    const content = await response.text();
    return content.trim();
  } catch (error) {
    console.error('[TavernHelper] Error getting GitLab file content:', error);
    throw error;
  }
}

/**
 * Parse 'version' field from JSON file content
 * @param content File content string
 * @returns Parsed version string (e.g. "2.5.5")
 * @throws Error if content is not valid JSON, or 'version' field is missing/not a string
 */
export function parseVersionFromFile(content: string): string {
  try {
    const data = JSON.parse(content);

    if (data && typeof data.version === 'string') {
      return data.version;
    } else {
      throw new Error("[TavernHelper] No valid 'version' field found in JSON data (must be string type)");
    }
  } catch (error) {
    console.error('[TavernHelper] Error parsing version file content:', error);

    if (error instanceof SyntaxError) {
      throw new Error(`[TavernHelper] Failed to parse file content as JSON: ${error.message}`);
    }

      throw new Error(
        `[TavernHelper] Failed to parse version from file content: ${error instanceof Error ? error.message : String(error)}`,
      );
  }
}

/**
 * Get current version
 * @param path Version file path
 * @returns Current version
 */
export async function getCurrentVersion(path: string) {
  CURRENT_VERSION = parseVersionFromFile(await getFileContentByPath(path));
  return CURRENT_VERSION;
}

/**
 * Compare two semantic versions (Major.Minor.Patch)
 * @param versionA Version string A (e.g. "2.5.5")
 * @param versionB Version string B (e.g. "1.0.0")
 * @returns
 * - Positive (> 0): if versionA > versionB (A is newer)
 * - Negative (< 0): if versionA < versionB (B is newer)
 * - 0: if versionA == versionB (same version)
 * Note: This basic comparator doesn't handle prerelease tags (-beta) or build metadata (+build).
 * It will treat "2.5.5-beta" and "2.5.5" as equal in this comparison.
 */
function compareSemVer(versionA: string, versionB: string): number {
  const cleanVersionA = versionA.split('-')[0].split('+')[0];
  const cleanVersionB = versionB.split('-')[0].split('+')[0];

  const partsA = cleanVersionA.split('.').map(Number);
  const partsB = cleanVersionB.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    // If version part is missing (e.g. "1.2" vs "1.2.3"), treat as 0
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;

    if (isNaN(numA) || isNaN(numB)) {
      console.warn(`[TavernHelper] Version "${versionA}" or "${versionB}" contains non-numeric parts, comparison may be inaccurate.`);
      return 0;
    }

    if (numA > numB) {
      return 1;
    }
    if (numA < numB) {
      return -1;
    }
  }

  return 0;
}

export async function getFileContentByPath(filePath: string) {
  try {
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const content = await response.text();
    return content;
  } catch (error) {
    console.error(`Failed to read file ${filePath}:`, error);
    throw error;
  }
}

export async function runCheckWithPath() {
  try {
    LATEST_VERSION = parseVersionFromFile(await fetchRawFileContentFromGitLab(VERSION_FILE_PATH_GITLAB));

    const comparisonResult = compareSemVer(LATEST_VERSION, CURRENT_VERSION);

    if (comparisonResult > 0) {
      console.info(`[TavernHelper] Update needed! Latest version ${LATEST_VERSION} > current version ${CURRENT_VERSION}`);
      return true;
    } else if (comparisonResult === 0) {
      console.info(`[TavernHelper] Current version ${CURRENT_VERSION} is already latest.`);
      return false;
    } else {
      console.warn(`[TavernHelper] Current version ${CURRENT_VERSION} is newer than remote version ${LATEST_VERSION}?`);
      return false;
    }
  } catch (error) {
    console.error('[TavernHelper] Version check failed:', error);
    return false;
  }
}

/**
 * Add version update notification element
 */
export function addVersionUpdateElement() {
  const container = $('#tavern-helper-extension-container .inline-drawer-header b');
  container.append(`
    <span style="color: red; font-size: 12px; font-weight: bold;">
      New!
    </span>
  `);
  $('#version-update-text').closest('.flex-container .alignItemsCenter').append(`
      <div style='background-color: var(--SmartThemeQuoteColor);border-radius: 50px;padding: 0 5px;height: 50%; font-size: calc(var(--mainFontSize) * 0.7);'>
        Latest: Ver ${LATEST_VERSION}
      </div>
    `);
}

/**
 * Parse changelog content and extract logs between two versions
 * @param changelogContent Full changelog content
 * @param currentVersion Current version number
 * @param latestVersion Latest version number
 * @returns Log content between the two versions
 */
export function parseChangelogBetweenVersions(
  changelogContent: string,
  currentVersion: string,
  latestVersion: string,
): string | undefined {
  // Find all version headers, supports multiple Markdown header formats
  // Matches ## version, # version, [version] etc.
  const versionRegex = /(?:^|\n)(?:#{1,3}\s*|\[)([0-9]+\.[0-9]+\.[0-9]+)(?:\]|\s|$)/g;
  const matches = [...changelogContent.matchAll(versionRegex)];

  if (matches.length === 0) {
    toastr.error('Could not find version logs.');
    return;
  }

  // Compare current and latest versions
  const comparisonResult = compareSemVer(latestVersion, currentVersion);
  let extractedContent = '';

  if (comparisonResult <= 0) {
    // Current version is newer or equal, only return latest version's logs
    const latestVersionMatch = matches.find(match => match[1] === latestVersion);
    if (!latestVersionMatch) {
      toastr.error('Failed to get update logs');
      return;
    }

    const startIndex = latestVersionMatch.index;
    const nextVersionMatch = matches.find(match => match.index > startIndex);
    const endIndex = nextVersionMatch ? nextVersionMatch.index : changelogContent.length;

    extractedContent = changelogContent.substring(startIndex, endIndex).trim();
  } else {
    const currentVersionMatch = matches.find(match => match[1] === currentVersion);
    if (!currentVersionMatch) {
      toastr.error(`Could not find logs for version ${currentVersion}.`);
      return;
    }

    const latestVersionMatch = matches.find(match => match[1] === latestVersion);
    if (!latestVersionMatch) {
      toastr.error(`Could not find logs for version ${latestVersion}.`);
      return;
    }

    const startIndex = currentVersionMatch.index;
    const endIndex = latestVersionMatch.index;

    extractedContent = changelogContent.substring(startIndex, endIndex).trim();
  }

  return renderMarkdown(extractedContent);
}

/**
 * Show changelog popup
 */
export async function handleUpdateButton() {
  if (!CHANGELOG_CONTENT) {
    await getChangelog();
  }
  const result = await callGenericPopup(CHANGELOG_CONTENT, POPUP_TYPE.CONFIRM, '', {
    okButton: 'Update',
    cancelButton: 'Cancel',
  });
  if (result) {
    toastr.info('Updating...');
    await updateTavernHelper();
  }
}

/**
 * Get changelog
 * @returns Log content between versions
 */
export async function getChangelog() {
  toastr.info('Fetching changelog...');
  const changelogContent = await fetchRawFileContentFromGitLab(CHANGELOG_FILE_PATH_GITLAB);
  if (LATEST_VERSION === undefined) {
    LATEST_VERSION = parseVersionFromFile(await fetchRawFileContentFromGitLab(VERSION_FILE_PATH_GITLAB));
  }

  if (CURRENT_VERSION === undefined) {
    CURRENT_VERSION = parseVersionFromFile(await getFileContentByPath(VERSION_FILE_PATH));
  }

  const logs = parseChangelogBetweenVersions(changelogContent, CURRENT_VERSION, LATEST_VERSION);
  if (!logs) {
    toastr.error('Failed to get changelog');
    return;
  } else {
    CHANGELOG_CONTENT = logs;
  }
}

/**
 * Update Tavern Helper
 */
export async function updateTavernHelper() {
  const extensionType = getExtensionType(extensionName);
  const response = await fetch('/api/extensions/update', {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify({ extensionName: extensionName, global: extensionType === 'global' ? true : false }),
  });
  if (!response.ok) {
    const text = await response.text();
    toastr.error(text || response.statusText, t`Failed to update Tavern Helper`, { timeOut: 5000 });
    console.error(`Failed to update Tavern Helper: ${text}`);
    return false;
  }

  const data = await response.json();
  if (data.isUpToDate) {
    console.info(`Tavern Helper is already latest version, no update needed`);
  } else {
    toastr.success(t`Successfully updated Tavern Helper to ${data.shortCommitHash}, refreshing page to apply changes...`);
    console.info(`Successfully updated Tavern Helper to ${data.shortCommitHash}, refreshing page to apply changes...`);
    setTimeout(() => location.reload(), 3000);
  }
  return true;
}

// Copied from Tavern's original code
/**
 * Gets the type of an extension based on its external ID.
 * @param {string} externalId External ID of the extension (excluding or including the leading 'third-party/')
 * @returns {string} Type of the extension (global, local, system, or empty string if not found)
 */
function getExtensionType(externalId: string) {
  const id = Object.keys(extensionTypes).find(
    // eslint-disable-next-line no-shadow
    (id: string) => id === externalId || (id.startsWith('third-party') && id.endsWith(externalId)),
  );
  return id ? extensionTypes[id] : 'local';
}

// Used after legacy version update
/**
 *
 */

export async function showNewFeature() {
  let changelogContent = await fetchRawFileContentFromGitLab(CHANGELOG_FILE_PATH_GITLAB);
  changelogContent = changelogContent + '\n\n*Legacy frontend helper config cleared, please reconfigure extension settings*';
  const logs = parseChangelogBetweenVersions(changelogContent, '3.0.0', '3.0.0');

  if (logs) {
    const modifiedLogs = logs.replace(/<h2([^>]*)>([^<]*)<\/h2>/g, '<h2$1>Tavern Helper $2</h2>');
    await callGenericPopup(modifiedLogs, POPUP_TYPE.TEXT);
  }
}
