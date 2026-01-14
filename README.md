# DiscordArc

A BetterDiscord plugin that brings Arc browser-style profiles to Discord. Create server profiles to filter which servers and folders appear in your sidebar.

## Features

- **Server Profiles**: Create named profiles (e.g., "Work", "Personal", "Gaming") to organize your servers
- **Folder Support**: Assign entire server folders to profiles
- **Quick Switching**: Switch profiles via the sidebar icon or keyboard shortcuts
- **Custom Emojis**: Set a custom emoji for each profile
- **Context Menu Integration**: Right-click servers or folders to add/remove them from profiles
- **Settings Panel**: Full profile management in BetterDiscord settings

## Installation

1. Download `DiscordArc.plugin.js`
2. Place it in your BetterDiscord plugins folder:
   - **Windows**: `%appdata%/BetterDiscord/plugins/`
   - **macOS**: `~/Library/Application Support/BetterDiscord/plugins/`
   - **Linux**: `~/.config/BetterDiscord/plugins/`
3. Enable the plugin in Discord Settings → Plugins

## Usage

### Creating Profiles

1. Go to Discord Settings → Plugins → DiscordArc Settings
2. Enter a profile name and click "Create Profile"
3. Check the servers/folders you want in that profile

### Assigning Servers/Folders

**Via Settings Panel:**
- Open DiscordArc settings and check/uncheck servers and folders for each profile

**Via Context Menu:**
- Right-click any server or folder in your sidebar
- Select "Server Profiles" submenu
- Toggle profiles on/off

### Switching Profiles

**Via Sidebar:**
- Click the profile icon (shows current profile's emoji) between DMs and servers
- Select a profile from the popup menu

**Via Keyboard:**
- `Ctrl+Shift+]` - Next profile
- `Ctrl+Shift+[` - Previous profile
- `Ctrl+Shift+1-9` - Jump to profile by number

### Default "All Servers" Profile

The "All Servers" profile always shows everything and cannot be deleted. Use it to see all your servers regardless of profile assignments.

## Screenshots

*Coming soon*

## License

MIT License - Feel free to modify and distribute.

## Support

If you encounter issues or have suggestions, please open an issue on GitHub.
