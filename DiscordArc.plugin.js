/**
 * @name DiscordArc
 * @version 1.0.0
 * @description Create server profiles to filter which servers and folders appear in your sidebar - like Arc browser profiles for Discord. Switch profiles via the sidebar icon or keyboard shortcuts.
 * @author agregis
 * @source https://github.com/anthonygregis/discord-arc
 */

module.exports = class DiscordArc {
    constructor() {
        this.defaultSettings = {
            activeProfile: "all",
            profiles: {
                all: { name: "All Servers", emoji: "🌐", servers: [], folders: [], isDefault: true }
            },
            shortcuts: {
                nextProfile: "Ctrl+Shift+]",
                prevProfile: "Ctrl+Shift+[",
                profile1: "Ctrl+Shift+1",
                profile2: "Ctrl+Shift+2",
                profile3: "Ctrl+Shift+3",
                profile4: "Ctrl+Shift+4",
                profile5: "Ctrl+Shift+5"
            }
        };
        this.settings = null;
        this.styleElement = null;
        this.contextMenuPatches = [];
        this.keydownHandler = null;
    }

    // ==================== Lifecycle ====================

    start() {
        this.loadSettings();
        this.injectStyles();
        this.applyProfile(this.settings.activeProfile);
        this.patchContextMenus();
        this.addProfileSwitcher();
        this.registerKeyboardShortcuts();
        BdApi.UI.showToast("DiscordArc enabled", { type: "success" });
    }

    stop() {
        this.showAllGuilds();
        this.removeStyles();
        this.unpatchContextMenus();
        this.removeProfileSwitcher();
        this.unregisterKeyboardShortcuts();
        BdApi.UI.showToast("DiscordArc disabled", { type: "info" });
    }

    // ==================== Settings Storage ====================

    loadSettings() {
        const saved = BdApi.Data.load("DiscordArc", "settings");
        this.settings = Object.assign({}, this.defaultSettings, saved);
        // Ensure default profile always exists
        if (!this.settings.profiles.all) {
            this.settings.profiles.all = { name: "All Servers", emoji: "🌐", servers: [], folders: [], isDefault: true };
        }
        // Ensure all profiles have an emoji
        for (const profileId of Object.keys(this.settings.profiles)) {
            if (!this.settings.profiles[profileId].emoji) {
                this.settings.profiles[profileId].emoji = "📁";
            }
        }
    }

    saveSettings() {
        BdApi.Data.save("DiscordArc", "settings", this.settings);
    }

    // ==================== Discord Module Access ====================

    get GuildStore() {
        return BdApi.Webpack.getStore("GuildStore");
    }

    get SortedGuildStore() {
        return BdApi.Webpack.getStore("SortedGuildStore");
    }

    get ExpandedGuildFolderStore() {
        return BdApi.Webpack.getStore("ExpandedGuildFolderStore");
    }

    getGuilds() {
        return this.GuildStore?.getGuilds() || {};
    }

    getGuildFolders() {
        // Returns array of folder objects: { folderId, guildIds, folderName, folderColor }
        return this.SortedGuildStore?.getGuildFolders() || [];
    }

    // ==================== Profile Management ====================

    getProfileList() {
        return Object.keys(this.settings.profiles);
    }

    getProfile(profileId) {
        return this.settings.profiles[profileId];
    }

    createProfile(name, emoji = "📁") {
        const id = `profile_${Date.now()}`;
        this.settings.profiles[id] = {
            name: name,
            emoji: emoji,
            servers: [],
            folders: []
        };
        this.saveSettings();
        return id;
    }

    setProfileEmoji(profileId, emoji) {
        if (this.settings.profiles[profileId]) {
            this.settings.profiles[profileId].emoji = emoji;
            this.saveSettings();
            this.updateSwitcherUI();
        }
    }

    showEmojiPicker(profileId, parentPanel) {
        // Remove existing picker
        const existing = document.getElementById("discordarc-emoji-picker");
        if (existing) existing.remove();

        const commonEmojis = [
            "💼", "🏠", "🎮", "💻", "📚", "🎵", "🎨", "⚙️",
            "🌐", "📁", "⭐", "❤️", "🔥", "✨", "🚀", "💡",
            "🎯", "📱", "🖥️", "🎬", "📷", "🎤", "🎧", "🎪",
            "🏢", "🏰", "🌙", "☀️", "🌈", "🍕", "☕", "🍺"
        ];

        const overlay = document.createElement("div");
        overlay.id = "discordarc-emoji-picker";
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 100000;
        `;

        const modal = document.createElement("div");
        modal.style.cssText = `
            background: #2b2d31;
            border-radius: 8px;
            padding: 16px;
            max-width: 320px;
        `;

        const title = document.createElement("div");
        title.textContent = "Choose an emoji";
        title.style.cssText = "color: #fff; font-weight: 600; margin-bottom: 12px; font-size: 16px;";
        modal.appendChild(title);

        const grid = document.createElement("div");
        grid.style.cssText = "display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px; margin-bottom: 12px;";

        commonEmojis.forEach(emoji => {
            const btn = document.createElement("button");
            btn.textContent = emoji;
            btn.style.cssText = `
                font-size: 20px;
                padding: 8px;
                background: #1e1f22;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            `;
            btn.onmouseover = () => btn.style.background = "#5664f0";
            btn.onmouseout = () => btn.style.background = "#1e1f22";
            btn.onclick = () => {
                this.setProfileEmoji(profileId, emoji);
                overlay.remove();
                this.renderSettingsPanel(parentPanel);
            };
            grid.appendChild(btn);
        });

        modal.appendChild(grid);

        // Custom input
        const customRow = document.createElement("div");
        customRow.style.cssText = "display: flex; gap: 8px;";

        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Or type any emoji...";
        input.style.cssText = `
            flex: 1;
            padding: 8px;
            background: #1e1f22;
            border: none;
            border-radius: 4px;
            color: #fff;
            font-size: 14px;
        `;

        const applyBtn = document.createElement("button");
        applyBtn.textContent = "Apply";
        applyBtn.style.cssText = `
            padding: 8px 16px;
            background: #5664f0;
            border: none;
            border-radius: 4px;
            color: #fff;
            cursor: pointer;
            font-size: 14px;
        `;
        applyBtn.onclick = () => {
            if (input.value.trim()) {
                this.setProfileEmoji(profileId, input.value.trim());
                overlay.remove();
                this.renderSettingsPanel(parentPanel);
            }
        };

        customRow.appendChild(input);
        customRow.appendChild(applyBtn);
        modal.appendChild(customRow);

        overlay.appendChild(modal);
        overlay.onclick = (e) => {
            if (e.target === overlay) overlay.remove();
        };

        document.body.appendChild(overlay);
        input.focus();
    }

    showConfirmDialog(title, message, onConfirm) {
        const existing = document.getElementById("discordarc-confirm-dialog");
        if (existing) existing.remove();

        const overlay = document.createElement("div");
        overlay.id = "discordarc-confirm-dialog";
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 100000;
        `;

        const modal = document.createElement("div");
        modal.style.cssText = `
            background: #2b2d31;
            border-radius: 8px;
            padding: 20px;
            max-width: 400px;
            min-width: 300px;
        `;

        const titleEl = document.createElement("div");
        titleEl.textContent = title;
        titleEl.style.cssText = "color: #fff; font-weight: 600; font-size: 18px; margin-bottom: 8px;";
        modal.appendChild(titleEl);

        const messageEl = document.createElement("div");
        messageEl.textContent = message;
        messageEl.style.cssText = "color: #b5bac1; font-size: 14px; margin-bottom: 20px;";
        modal.appendChild(messageEl);

        const btnRow = document.createElement("div");
        btnRow.style.cssText = "display: flex; justify-content: flex-end; gap: 12px;";

        const cancelBtn = document.createElement("button");
        cancelBtn.textContent = "Cancel";
        cancelBtn.style.cssText = `
            padding: 10px 20px;
            background: #4e5058;
            border: none;
            border-radius: 4px;
            color: #fff;
            cursor: pointer;
            font-size: 14px;
        `;
        cancelBtn.onclick = () => overlay.remove();

        const confirmBtn = document.createElement("button");
        confirmBtn.textContent = "Delete";
        confirmBtn.style.cssText = `
            padding: 10px 20px;
            background: #da373c;
            border: none;
            border-radius: 4px;
            color: #fff;
            cursor: pointer;
            font-size: 14px;
        `;
        confirmBtn.onclick = () => {
            overlay.remove();
            onConfirm();
        };

        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(confirmBtn);
        modal.appendChild(btnRow);

        overlay.appendChild(modal);
        overlay.onclick = (e) => {
            if (e.target === overlay) overlay.remove();
        };

        document.body.appendChild(overlay);
    }

    deleteProfile(profileId) {
        if (profileId === "all") return false; // Can't delete default
        delete this.settings.profiles[profileId];
        if (this.settings.activeProfile === profileId) {
            this.switchProfile("all");
        }
        this.saveSettings();
        return true;
    }

    renameProfile(profileId, newName) {
        if (this.settings.profiles[profileId]) {
            this.settings.profiles[profileId].name = newName;
            this.saveSettings();
        }
    }

    addServerToProfile(profileId, serverId) {
        const profile = this.settings.profiles[profileId];
        if (profile && !profile.servers.includes(serverId)) {
            profile.servers.push(serverId);
            this.saveSettings();
            if (this.settings.activeProfile === profileId) {
                this.applyProfile(profileId);
            }
        }
    }

    removeServerFromProfile(profileId, serverId) {
        const profile = this.settings.profiles[profileId];
        if (profile) {
            profile.servers = profile.servers.filter(id => id !== serverId);
            this.saveSettings();
            if (this.settings.activeProfile === profileId) {
                this.applyProfile(profileId);
            }
        }
    }

    addFolderToProfile(profileId, folderId) {
        const profile = this.settings.profiles[profileId];
        if (profile && !profile.folders.includes(folderId)) {
            profile.folders.push(folderId);
            this.saveSettings();
            if (this.settings.activeProfile === profileId) {
                this.applyProfile(profileId);
            }
        }
    }

    removeFolderFromProfile(profileId, folderId) {
        const profile = this.settings.profiles[profileId];
        if (profile) {
            profile.folders = profile.folders.filter(id => id !== folderId);
            this.saveSettings();
            if (this.settings.activeProfile === profileId) {
                this.applyProfile(profileId);
            }
        }
    }

    isServerInProfile(profileId, serverId) {
        const profile = this.settings.profiles[profileId];
        if (!profile) return false;
        if (profile.servers.includes(serverId)) return true;
        // Check if server is in a folder that's in this profile
        const folders = this.getGuildFolders();
        for (const folder of folders) {
            if (profile.folders.includes(folder.folderId) && folder.guildIds.includes(serverId)) {
                return true;
            }
        }
        return false;
    }

    isFolderInProfile(profileId, folderId) {
        const profile = this.settings.profiles[profileId];
        return profile?.folders.includes(folderId) || false;
    }

    switchProfile(profileId) {
        if (!this.settings.profiles[profileId]) return;
        this.settings.activeProfile = profileId;
        this.saveSettings();
        this.applyProfile(profileId);
        this.updateSwitcherUI();
        const profileName = this.settings.profiles[profileId].name;
        BdApi.UI.showToast(`Switched to: ${profileName}`, { type: "info" });
    }

    // ==================== CSS Injection for Hiding ====================

    injectStyles() {
        // Base styles for the plugin UI
        const baseCSS = `
            [data-discordarc-hidden="true"] {
                display: none !important;
            }
            .discordarc-switcher {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 48px;
                height: 48px;
                margin-bottom: 8px;
                cursor: pointer;
                border-radius: 16px;
                background-color: #1d1d1e;
                transition: border-radius 0.15s ease-out, background-color 0.15s ease-out;
                user-select: none;
            }
            .discordarc-switcher:hover {
                border-radius: 16px;
                background-color: #5664f0;
            }
            .discordarc-emoji {
                font-size: 24px;
                line-height: 1;
            }
            .discordarc-popup {
                position: fixed;
                background: #111214;
                border-radius: 8px;
                padding: 8px;
                box-shadow: 0 8px 16px rgba(0,0,0,0.4);
                z-index: 99999;
                min-width: 180px;
            }
            .discordarc-popup-item {
                padding: 10px 12px;
                border-radius: 4px;
                cursor: pointer;
                color: #b5bac1;
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 14px;
                white-space: nowrap;
            }
            .discordarc-popup-item:hover {
                background: #36373d;
                color: #ffffff;
            }
            .discordarc-popup-item.active {
                background: #5664f0;
                color: #ffffff;
            }
            .discordarc-popup-emoji {
                font-size: 18px;
            }
        `;
        BdApi.DOM.addStyle("DiscordArc-base", baseCSS);
    }

    removeStyles() {
        BdApi.DOM.removeStyle("DiscordArc-base");
    }

    applyProfile(profileId) {
        // Remove previous hiding
        this.showAllGuilds();

        // "all" profile shows everything
        if (profileId === "all") return;

        const profile = this.settings.profiles[profileId];
        if (!profile) return;

        const guilds = this.getGuilds();
        const folders = this.getGuildFolders();
        const visibleGuildIds = new Set();
        const visibleFolderIds = new Set(profile.folders);

        // Add directly assigned servers
        profile.servers.forEach(id => visibleGuildIds.add(id));

        // Add servers from assigned folders
        folders.forEach(folder => {
            if (profile.folders.includes(folder.folderId)) {
                folder.guildIds.forEach(guildId => visibleGuildIds.add(guildId));
            }
        });

        let hiddenCount = 0;

        // Hide guilds not in profile
        Object.keys(guilds).forEach(guildId => {
            if (!visibleGuildIds.has(guildId)) {
                const element = document.querySelector(`[data-list-item-id="guildsnav___${guildId}"]`);
                if (element) {
                    // Find the parent listItem element
                    const listItem = element.closest('[class*="listItem"]');
                    if (listItem) {
                        listItem.setAttribute('data-discordarc-hidden', 'true');
                        hiddenCount++;
                    }
                }
            }
        });

        // Hide folders not in profile
        folders.forEach(folder => {
            if (folder.folderId && !visibleFolderIds.has(folder.folderId)) {
                // Folder data-list-item-id is just the folderId without "folder-" prefix
                const element = document.querySelector(`[data-list-item-id="guildsnav___${folder.folderId}"]`);
                if (element) {
                    // For folders, we need to hide the folderGroup wrapper
                    const folderGroup = element.closest('[class*="folderGroup"]');
                    if (folderGroup) {
                        folderGroup.setAttribute('data-discordarc-hidden', 'true');
                        hiddenCount++;
                    } else {
                        // Fallback to listItem
                        const listItem = element.closest('[class*="listItem"]');
                        if (listItem) {
                            listItem.setAttribute('data-discordarc-hidden', 'true');
                            hiddenCount++;
                        }
                    }
                }
            }
        });

    }

    showAllGuilds() {
        // Remove hidden attribute from all previously hidden items
        document.querySelectorAll('[data-discordarc-hidden="true"]').forEach(el => {
            el.removeAttribute('data-discordarc-hidden');
        });
    }

    // ==================== Profile Switcher Icon ====================

    addProfileSwitcher() {
        const tryAddSwitcher = () => {
            // First check if already added
            if (document.getElementById("discordarc-switcher")) return true;

            // Find the tree/list that contains guilds
            const guildsList = document.querySelector('[data-list-id="guildsnav"]');

            if (!guildsList) {
                // Fallback: find scroller
                const scroller = document.querySelector('[class*="guilds_"] [class*="scroller_"]') ||
                                 document.querySelector('[class*="guilds-"] [class*="scroller-"]');
                if (!scroller) return false;
            }

            // Find the guild separator (the line between DMs and servers)
            const separator = document.querySelector('[class*="guildSeparator"]');

            // Get the listItem that contains the separator
            const separatorListItem = separator?.closest('[class*="listItem"]');

            if (separatorListItem && separatorListItem.parentElement) {
                // Insert after the separator's list item
                this.insertSwitcher(separatorListItem.parentElement, separatorListItem.nextSibling);
                return true;
            }

            // Fallback: find by data attribute - first actual guild
            const firstGuild = document.querySelector('[data-list-item-id^="guildsnav___"]:not([data-list-item-id*="home"])');

            if (firstGuild && firstGuild.parentElement) {
                this.insertSwitcher(firstGuild.parentElement, firstGuild);
                return true;
            }

            // Last resort: just append to the guilds list
            if (guildsList) {
                this.insertSwitcher(guildsList, null);
                return true;
            }

            return false;
        };

        // Try immediately
        if (tryAddSwitcher()) return;

        // If not found, use MutationObserver to wait
        const observer = new MutationObserver((mutations, obs) => {
            if (tryAddSwitcher()) {
                obs.disconnect();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => observer.disconnect(), 15000);

        // Close popup when clicking outside
        document.addEventListener("click", this.closePopupHandler = (e) => {
            const popup = document.getElementById("discordarc-popup");
            const switcher = document.getElementById("discordarc-switcher");
            if (popup && !popup.contains(e.target) && !switcher?.contains(e.target)) {
                popup.remove();
            }
        });
    }

    insertSwitcher(container, insertBefore = null) {
        const self = this;

        // Create wrapper to match Discord's list item structure
        const wrapper = document.createElement("div");
        wrapper.id = "discordarc-switcher-wrapper";
        wrapper.style.cssText = "display: flex; justify-content: center; margin: 4px 0; position: relative;";

        const switcher = document.createElement("div");
        switcher.className = "discordarc-switcher";
        switcher.id = "discordarc-switcher";

        const activeProfile = this.settings.profiles[this.settings.activeProfile];
        switcher.innerHTML = `<span class="discordarc-emoji">${activeProfile?.emoji || "🌐"}</span>`;
        switcher.title = `Profile: ${activeProfile?.name || "All Servers"}`;

        // Handle both left and right click
        switcher.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            self.togglePopup();
        });

        switcher.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            e.stopPropagation();
            self.togglePopup();
        });

        wrapper.appendChild(switcher);

        if (insertBefore) {
            container.insertBefore(wrapper, insertBefore);
        } else {
            container.appendChild(wrapper);
        }
    }

    removeProfileSwitcher() {
        const wrapper = document.getElementById("discordarc-switcher-wrapper");
        if (wrapper) wrapper.remove();
        const switcher = document.getElementById("discordarc-switcher");
        if (switcher) switcher.remove();
        const popup = document.querySelector(".discordarc-popup");
        if (popup) popup.remove();
        if (this.closePopupHandler) {
            document.removeEventListener("click", this.closePopupHandler);
        }
    }

    togglePopup() {
        const existing = document.getElementById("discordarc-popup");
        if (existing) {
            existing.remove();
            return;
        }

        const switcher = document.getElementById("discordarc-switcher");
        if (!switcher) return;

        const popup = document.createElement("div");
        popup.className = "discordarc-popup";
        popup.id = "discordarc-popup";

        // Position popup next to the switcher
        const rect = switcher.getBoundingClientRect();
        popup.style.position = "fixed";
        popup.style.left = (rect.right + 10) + "px";
        popup.style.top = rect.top + "px";

        const profiles = this.getProfileList();

        profiles.forEach(profileId => {
            const profile = this.settings.profiles[profileId];
            const item = document.createElement("div");
            item.className = "discordarc-popup-item";
            if (profileId === this.settings.activeProfile) {
                item.classList.add("active");
            }
            item.innerHTML = `
                <span class="discordarc-popup-emoji">${profile.emoji || "📁"}</span>
                <span>${profile.name}</span>
            `;
            item.addEventListener("click", (e) => {
                e.stopPropagation();
                this.switchProfile(profileId);
                popup.remove();
            });
            popup.appendChild(item);
        });

        document.body.appendChild(popup);
    }

    updateSwitcherUI() {
        const switcher = document.getElementById("discordarc-switcher");
        if (switcher) {
            const activeProfile = this.settings.profiles[this.settings.activeProfile];
            switcher.innerHTML = `<span class="discordarc-emoji">${activeProfile?.emoji || "🌐"}</span>`;
            switcher.title = `Profile: ${activeProfile?.name || "All Servers"}`;
        }
    }

    waitForElement(selector, callback, timeout = 10000) {
        const element = document.querySelector(selector);
        if (element) {
            callback(element);
            return;
        }

        const observer = new MutationObserver((mutations, obs) => {
            const el = document.querySelector(selector);
            if (el) {
                obs.disconnect();
                callback(el);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        setTimeout(() => observer.disconnect(), timeout);
    }

    // ==================== Context Menus ====================

    patchContextMenus() {
        const self = this;

        // Helper to find and append to the correct children array
        const appendToMenu = (tree, items) => {
            // Handle different menu structures
            let children = tree?.props?.children;

            // Sometimes children is nested in arrays
            if (Array.isArray(children)) {
                // Find the main menu group (usually the last array or the array with menu items)
                const lastArray = children.filter(c => Array.isArray(c)).pop();
                if (lastArray) {
                    lastArray.push(...items);
                } else {
                    children.push(...items);
                }
            } else if (children?.props?.children && Array.isArray(children.props.children)) {
                children.props.children.push(...items);
            }
        };

        // Build submenu items for a guild
        const buildGuildSubmenu = (guildId) => {
            const profiles = self.getProfileList().filter(id => id !== "all");

            if (profiles.length === 0) {
                return [
                    BdApi.ContextMenu.buildItem({
                        id: "discordarc-no-profiles",
                        type: "text",
                        label: "No profiles created",
                        disabled: true
                    })
                ];
            }

            return profiles.map(profileId => {
                const profile = self.settings.profiles[profileId];
                const isInProfile = self.isServerInProfile(profileId, guildId);
                return BdApi.ContextMenu.buildItem({
                    id: `discordarc-guild-${profileId}`,
                    type: "toggle",
                    label: profile.name || "Unnamed Profile",
                    checked: isInProfile,
                    action: () => {
                        if (isInProfile) {
                            self.removeServerFromProfile(profileId, guildId);
                        } else {
                            self.addServerToProfile(profileId, guildId);
                        }
                    }
                });
            });
        };

        // Build submenu items for a folder
        const buildFolderSubmenu = (folderId) => {
            const profiles = self.getProfileList().filter(id => id !== "all");

            if (profiles.length === 0) {
                return [
                    BdApi.ContextMenu.buildItem({
                        id: "discordarc-no-profiles-folder",
                        type: "text",
                        label: "No profiles created",
                        disabled: true
                    })
                ];
            }

            return profiles.map(profileId => {
                const profile = self.settings.profiles[profileId];
                const isInProfile = self.isFolderInProfile(profileId, folderId);
                return BdApi.ContextMenu.buildItem({
                    id: `discordarc-folder-${profileId}`,
                    type: "toggle",
                    label: profile.name || "Unnamed Profile",
                    checked: isInProfile,
                    action: () => {
                        if (isInProfile) {
                            self.removeFolderFromProfile(profileId, folderId);
                        } else {
                            self.addFolderToProfile(profileId, folderId);
                        }
                    }
                });
            });
        };

        // Try multiple possible menu navIds for guild context menu
        const guildMenuNames = ["guild-context", "guild-context-menu", "GuildContextMenu"];
        for (const menuName of guildMenuNames) {
            try {
                const unpatch = BdApi.ContextMenu.patch(menuName, (tree, props) => {
                    const guildId = props?.guild?.id;
                    if (!guildId) return;

                    const items = [
                        BdApi.ContextMenu.buildItem({ id: "discordarc-separator-guild", type: "separator" }),
                        BdApi.ContextMenu.buildItem({
                            id: "discordarc-submenu-guild",
                            type: "submenu",
                            label: "Server Profiles",
                            children: buildGuildSubmenu(guildId)
                        })
                    ];

                    appendToMenu(tree, items);
                });
                this.contextMenuPatches.push(unpatch);
            } catch (e) {
                // Menu name not available
            }
        }

        // Try multiple possible menu navIds for folder context menu
        const folderMenuNames = ["guild-folder-context", "folder-context", "GuildFolderContextMenu"];
        for (const menuName of folderMenuNames) {
            try {
                const unpatch = BdApi.ContextMenu.patch(menuName, (tree, props) => {
                    const folderId = props?.folderId;
                    if (!folderId) return;

                    const items = [
                        BdApi.ContextMenu.buildItem({ id: "discordarc-separator-folder", type: "separator" }),
                        BdApi.ContextMenu.buildItem({
                            id: "discordarc-submenu-folder",
                            type: "submenu",
                            label: "Server Profiles",
                            children: buildFolderSubmenu(folderId)
                        })
                    ];

                    appendToMenu(tree, items);
                });
                this.contextMenuPatches.push(unpatch);
            } catch (e) {
                // Menu name not available
            }
        }
    }

    unpatchContextMenus() {
        this.contextMenuPatches.forEach(unpatch => unpatch());
        this.contextMenuPatches = [];
    }

    // ==================== Keyboard Shortcuts ====================

    registerKeyboardShortcuts() {
        this.keydownHandler = (e) => {
            const profiles = this.getProfileList();

            // Check for Ctrl+Shift combinations
            if (e.ctrlKey && e.shiftKey) {
                // Next profile: Ctrl+Shift+]
                if (e.key === "]") {
                    e.preventDefault();
                    const currentIndex = profiles.indexOf(this.settings.activeProfile);
                    const nextIndex = (currentIndex + 1) % profiles.length;
                    this.switchProfile(profiles[nextIndex]);
                    return;
                }

                // Previous profile: Ctrl+Shift+[
                if (e.key === "[") {
                    e.preventDefault();
                    const currentIndex = profiles.indexOf(this.settings.activeProfile);
                    const prevIndex = (currentIndex - 1 + profiles.length) % profiles.length;
                    this.switchProfile(profiles[prevIndex]);
                    return;
                }

                // Number keys 1-9 for direct profile access
                const num = parseInt(e.key);
                if (num >= 1 && num <= 9) {
                    e.preventDefault();
                    if (profiles[num - 1]) {
                        this.switchProfile(profiles[num - 1]);
                    }
                    return;
                }
            }
        };

        document.addEventListener("keydown", this.keydownHandler);
    }

    unregisterKeyboardShortcuts() {
        if (this.keydownHandler) {
            document.removeEventListener("keydown", this.keydownHandler);
            this.keydownHandler = null;
        }
    }

    // ==================== Settings Panel ====================

    getSettingsPanel() {
        const panel = document.createElement("div");
        panel.style.padding = "16px";
        panel.style.color = "var(--text-normal)";

        this.renderSettingsPanel(panel);
        return panel;
    }

    renderSettingsPanel(panel) {
        panel.innerHTML = "";

        // Header
        const header = document.createElement("h2");
        header.textContent = "DiscordArc Profiles";
        header.style.marginBottom = "16px";
        header.style.color = "var(--header-primary)";
        panel.appendChild(header);

        // Active profile indicator
        const activeInfo = document.createElement("div");
        activeInfo.style.marginBottom = "16px";
        activeInfo.style.padding = "8px 12px";
        activeInfo.style.background = "var(--background-secondary)";
        activeInfo.style.borderRadius = "4px";
        const activeProfile = this.settings.profiles[this.settings.activeProfile];
        activeInfo.innerHTML = `<strong>Active Profile:</strong> ${activeProfile?.emoji || "🌐"} ${activeProfile?.name || "All Servers"}`;
        panel.appendChild(activeInfo);

        // Create new profile section
        const createSection = document.createElement("div");
        createSection.style.marginBottom = "24px";
        createSection.style.display = "flex";
        createSection.style.gap = "8px";

        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.placeholder = "New profile name...";
        nameInput.style.flex = "1";
        nameInput.style.padding = "8px 12px";
        nameInput.style.borderRadius = "4px";
        nameInput.style.border = "none";
        nameInput.style.background = "var(--background-secondary)";
        nameInput.style.color = "var(--text-normal)";

        const createBtn = document.createElement("button");
        createBtn.textContent = "Create Profile";
        createBtn.style.padding = "8px 16px";
        createBtn.style.borderRadius = "4px";
        createBtn.style.border = "none";
        createBtn.style.background = "var(--brand-experiment)";
        createBtn.style.color = "white";
        createBtn.style.cursor = "pointer";
        createBtn.onclick = () => {
            const name = nameInput.value.trim();
            if (name) {
                this.createProfile(name);
                nameInput.value = "";
                this.renderSettingsPanel(panel);
            }
        };

        createSection.appendChild(nameInput);
        createSection.appendChild(createBtn);
        panel.appendChild(createSection);

        // Profiles list
        const profilesList = document.createElement("div");
        profilesList.style.display = "flex";
        profilesList.style.flexDirection = "column";
        profilesList.style.gap = "16px";

        this.getProfileList().forEach(profileId => {
            const profile = this.settings.profiles[profileId];
            const profileCard = this.createProfileCard(profileId, profile, panel);
            profilesList.appendChild(profileCard);
        });

        panel.appendChild(profilesList);

        // Keyboard shortcuts info
        const shortcutsInfo = document.createElement("div");
        shortcutsInfo.style.marginTop = "24px";
        shortcutsInfo.style.padding = "12px";
        shortcutsInfo.style.background = "var(--background-secondary)";
        shortcutsInfo.style.borderRadius = "4px";
        shortcutsInfo.innerHTML = `
            <h3 style="margin-bottom: 8px; color: var(--header-primary);">Keyboard Shortcuts</h3>
            <div style="font-size: 14px; line-height: 1.6;">
                <div><code style="background: var(--background-tertiary); padding: 2px 6px; border-radius: 3px;">Ctrl+Shift+]</code> Next profile</div>
                <div><code style="background: var(--background-tertiary); padding: 2px 6px; border-radius: 3px;">Ctrl+Shift+[</code> Previous profile</div>
                <div><code style="background: var(--background-tertiary); padding: 2px 6px; border-radius: 3px;">Ctrl+Shift+1-9</code> Jump to profile by number</div>
            </div>
        `;
        panel.appendChild(shortcutsInfo);
    }

    createProfileCard(profileId, profile, parentPanel) {
        const card = document.createElement("div");
        card.style.background = "var(--background-secondary)";
        card.style.borderRadius = "8px";
        card.style.padding = "16px";

        // Profile header with emoji, name and actions
        const headerRow = document.createElement("div");
        headerRow.style.display = "flex";
        headerRow.style.justifyContent = "space-between";
        headerRow.style.alignItems = "center";
        headerRow.style.marginBottom = "12px";

        const nameSection = document.createElement("div");
        nameSection.style.display = "flex";
        nameSection.style.alignItems = "center";
        nameSection.style.gap = "10px";

        // Emoji button/picker
        const emojiBtn = document.createElement("button");
        emojiBtn.style.fontSize = "24px";
        emojiBtn.style.background = "var(--background-tertiary)";
        emojiBtn.style.border = "none";
        emojiBtn.style.borderRadius = "8px";
        emojiBtn.style.padding = "4px 8px";
        emojiBtn.style.cursor = "pointer";
        emojiBtn.style.lineHeight = "1";
        emojiBtn.textContent = profile.emoji || "📁";
        emojiBtn.title = "Click to change emoji";
        emojiBtn.onclick = () => {
            this.showEmojiPicker(profileId, parentPanel);
        };
        nameSection.appendChild(emojiBtn);

        const nameSpan = document.createElement("span");
        nameSpan.style.fontWeight = "600";
        nameSpan.style.fontSize = "16px";
        nameSpan.textContent = profile.name;
        if (profile.isDefault) {
            nameSpan.textContent += " (Default)";
        }
        nameSection.appendChild(nameSpan);

        const actionsDiv = document.createElement("div");
        actionsDiv.style.display = "flex";
        actionsDiv.style.gap = "8px";

        if (!profile.isDefault) {
            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "Delete";
            deleteBtn.style.padding = "4px 12px";
            deleteBtn.style.borderRadius = "4px";
            deleteBtn.style.border = "none";
            deleteBtn.style.background = "var(--button-danger-background)";
            deleteBtn.style.color = "white";
            deleteBtn.style.cursor = "pointer";
            deleteBtn.style.fontSize = "12px";
            deleteBtn.onclick = () => {
                this.showConfirmDialog(
                    `Delete "${profile.name}"?`,
                    "This will permanently delete this profile.",
                    () => {
                        this.deleteProfile(profileId);
                        this.renderSettingsPanel(parentPanel);
                    }
                );
            };
            actionsDiv.appendChild(deleteBtn);
        }

        const switchBtn = document.createElement("button");
        switchBtn.textContent = profileId === this.settings.activeProfile ? "Active" : "Switch";
        switchBtn.disabled = profileId === this.settings.activeProfile;
        switchBtn.style.padding = "4px 12px";
        switchBtn.style.borderRadius = "4px";
        switchBtn.style.border = "none";
        switchBtn.style.background = profileId === this.settings.activeProfile
            ? "var(--brand-experiment)"
            : "var(--background-tertiary)";
        switchBtn.style.color = profileId === this.settings.activeProfile ? "white" : "var(--text-normal)";
        switchBtn.style.cursor = profileId === this.settings.activeProfile ? "default" : "pointer";
        switchBtn.style.fontSize = "12px";
        if (profileId !== this.settings.activeProfile) {
            switchBtn.onclick = () => {
                this.switchProfile(profileId);
                this.renderSettingsPanel(parentPanel);
            };
        }
        actionsDiv.appendChild(switchBtn);

        headerRow.appendChild(nameSection);
        headerRow.appendChild(actionsDiv);
        card.appendChild(headerRow);

        // Skip server list for "all" profile
        if (profile.isDefault) {
            const info = document.createElement("div");
            info.style.color = "var(--text-muted)";
            info.style.fontSize = "14px";
            info.textContent = "Shows all servers and folders";
            card.appendChild(info);
            return card;
        }

        // Server/Folder assignment section
        const assignmentSection = document.createElement("div");
        assignmentSection.style.maxHeight = "300px";
        assignmentSection.style.overflowY = "auto";

        const guilds = this.getGuilds();
        const folders = this.getGuildFolders();
        const serversInFolders = new Set();

        // Show folders first
        folders.forEach(folder => {
            if (folder.folderId) {
                folder.guildIds.forEach(id => serversInFolders.add(id));

                const folderRow = document.createElement("div");
                folderRow.style.display = "flex";
                folderRow.style.alignItems = "center";
                folderRow.style.padding = "8px";
                folderRow.style.borderRadius = "4px";
                folderRow.style.marginBottom = "4px";
                folderRow.style.background = "var(--background-tertiary)";

                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.checked = this.isFolderInProfile(profileId, folder.folderId);
                checkbox.style.marginRight = "8px";
                checkbox.onchange = () => {
                    if (checkbox.checked) {
                        this.addFolderToProfile(profileId, folder.folderId);
                    } else {
                        this.removeFolderFromProfile(profileId, folder.folderId);
                    }
                };

                const label = document.createElement("span");
                label.innerHTML = `<strong>📁 ${folder.folderName || "Unnamed Folder"}</strong> <span style="color: var(--text-muted);">(${folder.guildIds.length} servers)</span>`;

                folderRow.appendChild(checkbox);
                folderRow.appendChild(label);
                assignmentSection.appendChild(folderRow);
            }
        });

        // Show ungrouped servers
        Object.values(guilds).forEach(guild => {
            if (serversInFolders.has(guild.id)) return;

            const serverRow = document.createElement("div");
            serverRow.style.display = "flex";
            serverRow.style.alignItems = "center";
            serverRow.style.padding = "8px";
            serverRow.style.marginBottom = "4px";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = profile.servers.includes(guild.id);
            checkbox.style.marginRight = "8px";
            checkbox.onchange = () => {
                if (checkbox.checked) {
                    this.addServerToProfile(profileId, guild.id);
                } else {
                    this.removeServerFromProfile(profileId, guild.id);
                }
            };

            const label = document.createElement("span");
            label.textContent = guild.name;

            serverRow.appendChild(checkbox);
            serverRow.appendChild(label);
            assignmentSection.appendChild(serverRow);
        });

        card.appendChild(assignmentSection);
        return card;
    }
};
