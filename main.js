const { Plugin, PluginSettingTab, Setting, MarkdownView, TFile, normalizePath } = require('obsidian');
const STYLE_ID = 'frontmatter-banner-style';

module.exports = class FrontmatterBannerPlugin extends Plugin {
  async onload() {
    // Load settings
    this.settings = Object.assign({ 
      bannerHeight: 250, 
      useRootAttachmentFolder: false 
    }, await this.loadData());

    // Apply initial banner height CSS variable
    document.documentElement.style.setProperty(
      '--banner-image-height',
      `${this.settings.bannerHeight}px`
    );

    // Inject style.css
    await this.injectCSS();

    // Register layout-change event and initial injection
    this.registerEvent(
      this.app.workspace.on('layout-change', () => this.injectBannerStyle())
    );
    this.injectBannerStyle();

    // Add settings tab
    this.addSettingTab(new BannerSettingTab(this.app, this));
  }

  async injectCSS() {
    // Remove any existing injected style
    const existing = document.getElementById(STYLE_ID);
    if (existing) existing.remove();

    // Try to read style.css from the plugin directory
    try {
      const cssPath = normalizePath(this.manifest.dir + '/style.css');
      let css = '';
      if (await this.app.vault.adapter.exists(cssPath)) {
        css = await this.app.vault.adapter.read(cssPath);
      } else if (typeof this.app.vault.adapter.readLocal === "function") {
        // Community plugins folder (not .obsidian)
        const localPath = `${this.app.vault.adapter.basePath}/${this.manifest.dir}/style.css`;
        css = await this.app.vault.adapter.readLocal(localPath);
      }
      if (css) {
        const styleTag = document.createElement('style');
        styleTag.id = STYLE_ID;
        styleTag.textContent = css;
        document.head.appendChild(styleTag);
      }
    } catch (e) {
      // fail silently
    }
  }

  async injectBannerStyle() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || !view.file) return;

    const cache = this.app.metadataCache.getFileCache(view.file);
    const banner = cache?.frontmatter?.banner;

    // Elements to style
    const previewEl = view.containerEl.querySelector('.markdown-preview-view');
    const editorEl = view.containerEl.querySelector('.cm-scroller');

    // Clear any previous banner styles
    if (previewEl) {
      previewEl.style.removeProperty('--banner-url');
      previewEl.style.removeProperty('--banner-position');
    }
    if (editorEl) {
      editorEl.style.removeProperty('--banner-url');
      editorEl.style.removeProperty('--banner-position');
    }

    if (!banner) return;

    // Determine banner focus; default to 'center'
    let focus = 'center';
    const rawFocus = cache.frontmatter.bannerFocus;
    if (rawFocus) {
      const trimmed = rawFocus.toString().trim();
      if (/^\d+$/.test(trimmed)) {
        focus = `0% ${trimmed}%`;
      } else if (/^\d+%$/.test(trimmed)) {
        focus = `0% ${trimmed}`;
      } else {
        focus = trimmed;
      }
    }

    // Build possible paths
    let possiblePaths = [];
    if (String(banner).includes('/')) {
      // User gave a path, use as-is according to toggle
      if (this.settings.useRootAttachmentFolder) {
        possiblePaths = [ `attachments/${banner}` ];
      } else {
        possiblePaths = [ view.file.path.replace(/[^/]+$/, banner) ];
      }
    } else {
      // Just a filename; try both "attachments/filename" and "<current-folder>/attachments/filename"
      const filename = String(banner).trim();
      const rootAttachments = `attachments/${filename}`;
      const perFolderAttachments = view.file.path.replace(/[^/]+$/, `attachments/${filename}`);

      if (this.settings.useRootAttachmentFolder) {
        possiblePaths = [rootAttachments, perFolderAttachments];
      } else {
        possiblePaths = [perFolderAttachments];
      }
    }

    let resourcePath = null;
    for (const path of possiblePaths) {
      if (await this.app.vault.adapter.exists(path)) {
        resourcePath = this.app.vault.adapter.getResourcePath(path);
        break;
      }
    }

    if (!resourcePath) return;

    // Apply to preview mode
    if (previewEl) {
      previewEl.style.setProperty('--banner-url', `url('${resourcePath}')`);
      previewEl.style.setProperty('--banner-position', focus);
    }

    // Apply to edit mode (CodeMirror scroller)
    if (editorEl) {
      editorEl.style.setProperty('--banner-url', `url('${resourcePath}')`);
      editorEl.style.setProperty('--banner-position', focus);
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  onunload() {
    // Remove injected style
    const existing = document.getElementById(STYLE_ID);
    if (existing) existing.remove();
  }
};

class BannerSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    this.containerEl.empty();
    this.containerEl.createEl('h2', { text: 'Frontmatter Banner Settings' });

    new Setting(this.containerEl)
      .setName('Banner height (px)')
      .setDesc('Set the banner height in pixels.')
      .addText(text =>
        text
          .setPlaceholder('250')
          .setValue(String(this.plugin.settings.bannerHeight))
          .onChange(async (value) => {
            const num = parseInt(value);
            if (!isNaN(num)) {
              this.plugin.settings.bannerHeight = num;
              document.documentElement.style.setProperty(
                '--banner-image-height',
                `${num}px`
              );
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(this.containerEl)
      .setName('Use root attachment folder for banners')
      .setDesc('If enabled, the plugin tries the root attachments folder first, then per-note folder. If disabled, only tries per-note folder.')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.useRootAttachmentFolder)
          .onChange(async (value) => {
            this.plugin.settings.useRootAttachmentFolder = value;
            await this.plugin.saveSettings();
            this.plugin.injectBannerStyle();
          })
      );
  }
}
