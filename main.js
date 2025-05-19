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

  injectBannerStyle() {
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

    // --- CHANGES BELOW: path resolution based on toggle ---
    let bannerPath;
    if (this.settings.useRootAttachmentFolder) {
      // Always look in root/attachments folder (take only filename)
      const filename = String(banner).split('/').pop();
      bannerPath = `attachments/${filename}`;
    } else {
      // Look in relative attachment folder (current behavior)
      bannerPath = String(banner);
    }

    // Determine the base path for the banner image
    let resourcePath;
    if (this.settings.useRootAttachmentFolder) {
      resourcePath = this.app.vault.adapter.getResourcePath(bannerPath);
    } else {
      resourcePath = this.app.vault.adapter.getResourcePath(
        view.file.path.replace(/[^/]+$/, bannerPath)
      );
    }

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
      .setName('Always use root attachment folder for banners')
      .setDesc('If enabled, banner images are always loaded from the root attachment folder. If disabled, they are loaded relative to the note location.')
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
