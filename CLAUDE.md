# CLAUDE.md - DiscordArc

## Project Overview

DiscordArc is a BetterDiscord plugin that brings Arc browser-style profiles to Discord. Users can create named profiles (e.g., "Work", "Personal", "Gaming") to filter which servers and folders appear in their sidebar.

## Tech Stack

- **Platform**: BetterDiscord plugin system
- **Language**: JavaScript (ES6+)
- **APIs**: BdApi (BetterDiscord API)
- **File Format**: Single `.plugin.js` file with meta header

## Project Structure

```
discord-arc/
├── DiscordArc.plugin.js   # Main plugin file (~1225 lines)
├── README.md              # User documentation
├── CLAUDE.md              # This file
└── .gitignore
```

## Key Concepts

### BetterDiscord Plugin Architecture

Plugins use a class-based structure with required methods:
- `start()` - Called when plugin is enabled
- `stop()` - Called when plugin is disabled
- `getSettingsPanel()` - Returns DOM element for settings UI

The meta header at the top of the file is required:
```javascript
/**
 * @name DiscordArc
 * @version 1.0.0
 * @description ...
 * @author agregis
 * @source https://github.com/anthonygregis/discord-arc
 */
```

### BdApi Modules Used

- `BdApi.Data.load(pluginName, key)` / `BdApi.Data.save(pluginName, key, value)` - Persistent JSON storage
- `BdApi.DOM.addStyle(id, css)` / `BdApi.DOM.removeStyle(id)` - CSS injection
- `BdApi.ContextMenu.patch(menuName, callback)` - Patch Discord's context menus (returns unpatch function)
- `BdApi.ContextMenu.buildItem({...})` - Build menu items
- `BdApi.Webpack.getStore(storeName)` - Access Discord's internal stores
- `BdApi.UI.showToast(message, options)` - Toast notifications

### Discord Internal Stores

Access via `BdApi.Webpack.getStore()`:
- `GuildStore` - Get user's servers via `.getGuilds()`
- `SortedGuildStore` - Get folder structure via `.getGuildFolders()`
- `ExpandedGuildFolderStore` - Get expanded folder state

### Data Structure

```javascript
{
  activeProfile: "profile_id",
  profiles: {
    "all": { name: "All Servers", emoji: "🌐", servers: [], folders: [], isDefault: true },
    "work": { name: "Work", emoji: "💼", servers: ["guild_id"], folders: ["folder_id"] }
  },
  shortcuts: {
    nextProfile: "Ctrl+Shift+]",
    prevProfile: "Ctrl+Shift+[",
    profile1: "Ctrl+Shift+1",
    // ... profile2-5
  }
}
```

## Code Organization

The plugin is organized into clearly commented sections:

1. **Lifecycle** (lines 34-51): `start()` and `stop()` methods
2. **Settings Storage** (lines 55-72): `loadSettings()` and `saveSettings()`
3. **Discord Module Access** (lines 74-96): Getters for GuildStore, SortedGuildStore, etc.
4. **Profile Management** (lines 98-412): CRUD operations for profiles, servers, folders
5. **CSS Injection** (lines 414-554): `injectStyles()`, `applyProfile()`, `showAllGuilds()`
6. **Profile Switcher Icon** (lines 556-746): UI for switching profiles in sidebar
7. **Context Menus** (lines 748-896): Right-click menu patches
8. **Keyboard Shortcuts** (lines 898-944): Global hotkey handling
9. **Settings Panel** (lines 946-1224): Full settings UI generation

## Important Implementation Details

### Server/Folder Hiding

Uses DOM manipulation with data attributes, NOT CSS-only:
1. Find element by `data-list-item-id` attribute
2. Traverse to parent wrapper (`listItem` for servers, `folderGroup` for folders)
3. Set `data-discordarc-hidden="true"` attribute
4. CSS rule hides elements with this attribute

**Why not CSS-only**: The `data-list-item-id` is on a deeply nested element, and hiding just that element leaves visual artifacts (indicators, spacing).

Key code (lines 510-545):
```javascript
// For servers - find parent listItem
const listItem = element.closest('[class*="listItem"]');
listItem.setAttribute('data-discordarc-hidden', 'true');

// For folders - find parent folderGroup (or fallback to listItem)
const folderGroup = element.closest('[class*="folderGroup"]');
```

### Folder ID Format

- Servers: `data-list-item-id="guildsnav___${guildId}"`
- Folders: `data-list-item-id="guildsnav___${folderId}"` (NO "folder-" prefix)

### Context Menu Patching

Must patch multiple menu names for compatibility (Discord updates may change names):
- Servers: `["guild-context", "guild-context-menu", "GuildContextMenu"]`
- Folders: `["guild-folder-context", "folder-context", "GuildFolderContextMenu"]`

**Critical requirements for menu items**:
- Every `buildItem()` call MUST have a unique `id` property
- Use `children` (not `items`) for submenu items array
- Use `checked` (not `active`) for toggle state
- Use `type: "toggle"` for checkbox items

Example (lines 787-802):
```javascript
BdApi.ContextMenu.buildItem({
    id: `discordarc-guild-${profileId}`,  // REQUIRED
    type: "toggle",
    label: profile.name,
    checked: isInProfile,  // NOT 'active'
    action: () => { /* toggle logic */ }
})
```

### Custom Modals

Discord doesn't support native `prompt()` or `confirm()`. The plugin implements:

- **Emoji Picker** (`showEmojiPicker()`, lines 127-240): Grid of common emojis + custom input
- **Confirm Dialog** (`showConfirmDialog()`, lines 242-322): For delete confirmations

Both use:
- Fixed position overlay with semi-transparent background
- Modal centered with `z-index: 100000`
- Click-outside-to-close behavior

### Profile Switcher Location

Inserted between DMs and server list (lines 558-623):
1. Find `[class*="guildSeparator"]` element
2. Get its parent listItem
3. Insert switcher wrapper after it using `insertBefore(wrapper, separatorListItem.nextSibling)`

Uses `MutationObserver` with 15s timeout if elements aren't immediately available.

### Keyboard Shortcuts

Registered on document `keydown` event (lines 900-937):
- `Ctrl+Shift+]` - Next profile (cycles)
- `Ctrl+Shift+[` - Previous profile (cycles)
- `Ctrl+Shift+1-9` - Jump to profile by index

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Context menu items not showing | Missing `id` property | Add unique `id` to each `buildItem()` call |
| Submenu not showing | Using `items` instead of `children` | Use `children` property for submenus |
| Toggle state wrong | Using `active` instead of `checked` | Use `checked` for toggle items |
| Element partially hidden | Hiding wrong element | Traverse to correct parent wrapper |
| prompt()/confirm() errors | Not supported in Discord | Use custom modal implementations |
| Switcher not appearing | DOM not ready | Use MutationObserver to wait for elements |
| Profile popup not visible | Wrong positioning | Use fixed positioning with getBoundingClientRect() |

## Development Workflow

1. Edit `DiscordArc.plugin.js`
2. Save file (BetterDiscord auto-reloads on file change)
3. Check Discord DevTools console (Ctrl+Shift+I on Windows/Linux, Cmd+Option+I on Mac) for errors
4. Test functionality in Discord
5. If plugin doesn't reload, disable and re-enable in Settings → Plugins

## Building & Distribution

No build step required - the `.plugin.js` file is the distribution format.

Users install by copying to their BetterDiscord plugins folder:
- **Windows**: `%appdata%/BetterDiscord/plugins/`
- **macOS**: `~/Library/Application Support/BetterDiscord/plugins/`
- **Linux**: `~/.config/BetterDiscord/plugins/`

## Git Remote

Uses SSH alias for GitHub: `git@gh-ag:anthonygregis/discord-arc.git`

Repository: https://github.com/anthonygregis/discord-arc

## Version History

- **1.0.0**: Initial release with full profile management, context menus, keyboard shortcuts, and settings panel
