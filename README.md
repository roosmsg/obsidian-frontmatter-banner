# Frontmatter Banner (Obsidian Plugin)

Add a visually stunning banner image to any note by specifying the image path in your note’s frontmatter. The plugin automatically renders the banner at the top of your note, both in reading and editing mode, using efficient CSS. Banner position and height are fully customizable.

---

## Features

- **Automatic banner images** for notes with a `banner` property in YAML frontmatter.
- **Works in both reading (preview) and editing (live preview) modes.**
- **Customizable banner position:** use the `bannerFocus` frontmatter key for fine-tuned image alignment (supports CSS background-position syntax).
- **Adjustable banner height:** set a global height via the plugin settings tab.
- **No need for manual callouts or markdown image embeds.**
- **Efficient and unobtrusive:** only affects notes with a `banner` property.
- **CSS stored in a separate `style.css` file** for easy tweaking and theming.
- **Choose banner image location:** Toggle in plugin settings to select if banners are loaded from the note's folder or always from the root attachments folder.

---

## Usage

1. **Add a banner to a note:**
   ```yaml
   ---
   banner: attachments/your-image.png
   bannerFocus: 20   # optional (examples: "center", "top")
   ---
