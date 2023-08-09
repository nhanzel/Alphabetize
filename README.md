# Alphabetize

Alphabetize any selected text via the Command Pallete, Context Menu, or Shortcut (`Ctrl + Shift + A`)

## Features

### General Use

Highlight desired text to be alphabetized, and using either the Command Pallete with `Alphabetize Selected Lines`, the Context Menu via right click, or your desired shortcut (default is `Ctrl + Shift + A`), the text will sort itself alphabetically

### CSS

CSS is a unique filetype in that alphabetizing the whole file is advantageous as opposed to general programming languages. CSS files will alphabetize themselves with respect to the selectors automatically. The settings for sorting css files and configuring how they get sorted can be found in the settings.

## Extension Settings

Configuring auto-sorting for css files:

- `alphabetize.sortCssOnSave`: Sort a css file by selector upon 'Save'. This setting is the root setting for any automatic css sorting functionality.
- `myExtension.enableGlobalCssSort`: Sort all unsaved css files in your workspace upon 'Save All'.
- `myExtension.sortCssProperties`: Sort properties within each selector. This is in addition to sorting the css file by selector already (`sortCssOnSave`).

## Known Issues

This extension currently doesn't support CSS Layers, if you utilize `@Layers` in your CSS, consider using the "Alphabetize Selected Lines" global command that works with any filetype on your CSS.

## Release Notes

### 1.0.0

Initial Release
