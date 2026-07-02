# OneSoft ERP — Branding Assets

This folder contains all visual identity files used during build and installation.
Replace any file with your final artwork — no code changes needed.

## Files

| File | Size | Used in | Description |
|------|------|---------|-------------|
| `icon.ico` | multi-size (16/32/48/256 px) | Windows EXE, taskbar, Start menu, notifications | Main app icon — **primary file** |
| `icon.png` | 256×256 px | Cross-platform fallback | PNG version of the icon |
| `installer-header.bmp` | 150×57 px | NSIS wizard header | Top banner in setup wizard |
| `installer-sidebar.bmp` | 164×314 px | NSIS wizard sidebar | Left panel in setup wizard pages |
| `LICENSE.txt` | — | NSIS license screen | Shown to user before install |

## React UI Assets (`../ui/assets/`)

| File | Size | Used in | Description |
|------|------|---------|-------------|
| `logo.png` | 128×128 px | WizardShell title bar, Welcome screen | In-app logo |

## Replacement Guide

### icon.ico (most important)
- Format: Windows ICO with multiple embedded sizes: 16, 32, 48, 256 px
- Tools: [IcoFX](https://icofx.ro/), [GIMP](https://www.gimp.org/), Figma export + [ConvertICO](https://convertico.com/)
- Replace file in-place — no code changes needed

### logo.png (installer UI)
- Format: PNG, 128×128 or higher, transparent background preferred
- Replace `installer/ui/assets/logo.png` — Vite will bundle it automatically

### NSIS wizard images
- `installer-header.bmp`: 150×57 px, 24-bit BMP, no alpha
- `installer-sidebar.bmp`: 164×314 px, 24-bit BMP, no alpha
- To enable: uncomment the two `installerHeader`/`installerSidebar` lines in `electron-builder.config.ts`

### Brand colors
| Color | Hex | Usage |
|-------|-----|-------|
| Dark Navy | `#1E344F` | Title bar, headings |
| Primary Blue | `#406B93` | Buttons, active steps, logo background |
| Mid Blue | `#2d5070` | Gradients |
| Warm Cream | `#F4F1EC` | Background |
