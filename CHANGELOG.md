## 3.1.4

### ⏫ Features

- Added `builtin.addOneMessage` for adding a specific message to the page

## 3.1.3

### 💻 UI

- Script buttons no longer occupy a separate line, now displayed with quick reply buttons (grouping controlled by "Merge Quick Replies" setting)
- Player tab renamed to Toolbox, with player moved to Toolbox submenu
- Added quick access button for variable manager in the input box context menu

### ⏫ Features

- Added variable manager for visual management of global, character, chat, and message variables

### 🐛 Fixes

- Fixed `setVariables` triggering render events unexpectedly when operating on message-level variables
- Fixed issue where character scripts from previous characters were incorrectly copied when switching characters
- Fixed incorrect button container creation

## 3.1.2

### 💻 UI

- Added reference link to [Tavern Command Reference](https://rentry.org/sillytavern-script-book) in the interface
- Split rendering optimization options - code block highlighting can now be disabled separately to improve rendering speed

### ⏫ Features

- Added `extra` field to `ChatMessage` and `swipes_info` field to `ChatMessageSwiped`
- Added `createChatMessages` interface for adding new messages (supports batch creation compared to `/send` and `/sendas`)

  ```typescript
  // Add a message at the end
  await createChatMessages([{role: 'user', message: 'Hello'}]);
  ```

  ```typescript
  // Insert two messages before message #10 without refreshing display
  await createChatMessages([{role: 'user', message: 'Hello'}, {role: 'assistant', message: 'Hi'}], {insert_at: 10});
  ```

- Added `deleteChatMessages` interface for message deletion (supports batch and selective deletion compared to `/del`)

  ```typescript
  // Delete messages #10, #15, second-to-last and last messages
  await deleteChatMessages([10, 15, -2, getLastMessageId()]);
  ```

  ```typescript
  // Delete all messages
  await deleteChatMessages(_.range(getLastMessageId() + 1));
  ```

- Added `rotateChatMessages` interface for reordering messages

  ```typescript
  // Move messages 4-6 before messages 2-3
  await rotateChatMessages(2, 4, 7);
  ```

  ```typescript
  // Move last message before message #5
  await rotateChatMessages(5, getLastMessageId(), getLastMessageId() + 1);
  ```

  ```typescript
  // Move last 3 messages before first message
  await rotateChatMessages(1, getLastMessageId() - 2, getLastMessageId() + 1);
  ```

  ```typescript
  // Move first 3 messages to the end
  await rotateChatMessages(0, 3, getLastMessageId() + 1);
  ```

- Added `getChatLorebook` and `setChatLorebook` for direct chat lorebook control
- Added optional parameter to `getOrCreateChatLorebook` for custom lorebook naming:

  ```typescript
  // If chat lorebook doesn't exist, create one named 'Hello'
  const lorebook = await getOrCreateChatLorebook('Hello');
  ```

### 🐛 Fixes

- Fixed `getCharLorebooks` not retrieving additional lorebooks

## 3.1.1

### ⏫ Features

- Added `setChatMessages` interface, more flexible than `setChatMessage` - allows direct scenario switching, message hiding, etc.

  ```typescript
  // Modify message content used by AI for message #10
  await setChatMessages([{message_id: 10, message: 'New message'}]);
  ```

  ```typescript
  // Add variables to second-to-last message
  const chat_message = getChatMessages(-2)[0];
  _.set(chat_message.data, 'KaguraHikariAffection', 5);
  await setChatMessages([{message_id: 0, data: chat_message.data}], {refresh: 'none'});
  ```

  ```typescript
  // Switch to scenario 3
  await setChatMessages([{message_id: 0, swipe_id: 2}]);
  ```

  ```typescript
  // Hide all messages
  const last_message_id = getLastMessageId();
  await setChatMessages(_.range(last_message_id + 1).map(message_id => ({message_id, is_hidden: true})));
  ```

- Modified `getChatMessage` interface to return `ChatMessage[]` or `ChatMessageSwiped[]` based on `{ include_swipes: boolean }` parameter.

  ```typescript
  // Get only the message page used by AI for message #10
  const chat_messages = getChatMessages(10);
  const chat_messages = getChatMessages('10');
  const chat_messages = getChatMessages('10', { include_swipes: false });
  // Get all message pages for message #10
  const chat_messages = getChatMessages(10, { include_swipes: true });
  ```

  ```typescript
  // Get message page used by AI for latest message
  const chat_message = getChatMessages(-1)[0];  // or getChatMessages('{{lastMessageId}}')[0]
  // Get all message pages for latest message
  const chat_message = getChatMessages(-1, { include_swipes: true })[0];  // or getChatMessages('{{lastMessageId}}', { include_swipes: true })[0]
  ```

  ```typescript
  // Get all message pages used by AI for all messages
  const chat_messages = getChatMessages('0-{{lastMessageId}}');
  // Get all message pages for all messages
  const chat_messages = getChatMessages('0-{{lastMessageId}}', { include_swipes: true });
  ```

### 🐛 Fixes

- Now `setChatMessage` with `refresh: 'display_and_render_current'` option will trigger corresponding Tavern render events to activate listeners, not just render iframe.

## 3.1.0

All built-in library scripts now use `import 'https://fastly.jsdelivr.net/gh/StageDog/tavern_resource/dist/tavern_helper/tagged/index.js'` to fetch latest code directly from repository, **so scripts will always stay up-to-date**. You no longer need to re-import scripts for updates.

## 3.0.7

### ⏫ Features

- Exported `toastr` library, now you can use `toastr.error('content', 'title')` instead of `triggerSlash('/echo severity=error title=Title content')` for Tavern notifications:
  - `toastr.info`
  - `toastr.success`
  - `toastr.warning`
  - `toastr.error`

## 3.0.6

### 🐛 Fixes

- Fixed issue where older Tavern versions might not display lorebook entries correctly after operations

## 3.0.5

### 💻 UI

- Newly imported scripts are now added to the end instead of beginning
- New buttons in script editor are enabled by default

### 📚 Script Library

**Built-in Library:**

- Added `Preset Protection` script to lock preset options (except 'Streaming', 'Request Chain-of-Thought' and 'Specific Entries') from UI modification

### ⏫ Features

**Lorebook Entry Operations:**

- Added `replaceLorebookEntries` and `updateLorebookEntriesWith` functions, more convenient than original `setLorebookEntries`

  ```typescript
  // Disable recursion for all entries while keeping other settings
  const entries = await getLorebookEntries("eramgtRevueStarlight");
  await replaceLorebookEntries("eramgtRevueStarlight", entries.map(entry => ({ ...entry, prevent_recursion: true })));
  ```

  ```typescript
  // Delete all entries containing 'Kagura Hikari' in name
  const entries = await getLorebookEntries("eramgtRevueStarlight");
  _.remove(entries, entry => entry.comment.includes('Kagura Hikari'));
  await replaceLorebookEntries("eramgtRevueStarlight", entries);
  ```

- Added array versions of `createLorebookEntry` and `deleteLorebookEntry`: `createLorebookEntries` and `deleteLorebookEntries`

### 🐛 Fixes

- Compatibility issues with some functions in previous versions

## 3.0.4

### 🐛 Fixes

- Depth input box not loading correctly when value is 0
- Quick reply code editor not displaying correctly when frontend optimization is enabled

## 3.0.3

### 💻 UI

- Now when script import conflicts occur, you can choose between 'Create New Script' or 'Overwrite Original Script'

### 📚 Script Library

**Built-in Library:**

- Modified `Tagging` to enable/disable Tavern Helper scripts

### 🐛 Fixes

- `replaceTavernRegexes` throwing unexpected errors when no character is selected

## 3.0.2

### 📚 Script Library

**Built-in Library:**

- Optimized execution speed of `Tagging`
- Modified `Auto-Close Incompatible Frontend Options` to also disable "Show Tags in Response"
- Added `Style Loading` script
- Added `Resource Preloading` script

### ⏫ Features

- Added `getScriptId` function to get script's unique ID

- Variable operations like `getVariables` now support character-bound variables, which can also be modified manually in Tavern Helper "Script Library" settings under "Variables" button.

  ```typescript
  const variables = getVariables({type: 'character'});
  ```

- Variable operations now support message-level variables with negative indices for reverse indexing (e.g. `-1` for latest message)

  ```typescript
  const variables = getVariables({type: 'message', message_id: -1});
  ```

- `getChatMessage` and `setChatMessage` now support negative indices for reverse indexing

### 🐛 Fixes

- Real-time modification listeners couldn't monitor scripts

## 3.0.1

### 🐛 Fixes

- Some functions not working properly
- Audio player not functioning correctly
- getCharacterRegexes throwing errors incorrectly when no character is selected

## 3.0.0

### 💻 New UI

- Completely redesigned interface layout with independent control for each functional module

### ⏫ Version Management

- Automatic version checking on extension startup with update notifications
- Click update button to view changelog from current to latest version

### 📚 Script Library

- New script library feature for unified script management
- Script import/export functionality
- Scripts can be exported with character cards and auto-imported with them
- Added character-bound variables that can be read by extension and exported with character cards
- Built-in library contains utility scripts provided by extension

### 🔌 Enhanced Extensibility

- Registered Tavern Helper core functions to global scope
- Support for other extension plugins to call Tavern Helper functions

### ✍️ Improved Character Creation Experience

> Tutorial in progress, currently basic setup instructions available in Discord post [VSCode/Cursor Environment Setup for Character Creation with Tavern Helper](https://discord.com/channels/1134557553011998840/1320081111451439166/1354125905848569958)

- Support for real-time modifications - changes in code editor immediately update Tavern content
- Support for split-file development - separate logic for different interface features
- Support for adding third-party libraries via package.json
