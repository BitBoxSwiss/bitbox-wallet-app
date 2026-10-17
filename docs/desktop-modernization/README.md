# Desktop modernization comparisons

These generated figures explain the supporting UI work around desktop CSD.
CSD is enabled in both columns: the left reconstructs missing supporting
changes, and the right illustrates the intended integrated result. They are
explanatory mockups, not runtime screenshots or test evidence. macOS native
compilation and behavior remain unvalidated.

| Figure | Shared motivation |
|---|---|
| [Headers and sidebar](images/01-headers-sidebar.png) | Control insets, alignment, preserved logo size and sidebar width. |
| [Guide and overlays](images/02-guide-overlay.png) | Separate close controls, fixed guide header, drag exclusions and dismissal. |
| [Scrollbars](images/03-scrollbars.png) | Stable gutters, inset thumbs, idle appearance and corner clearance. |
| [Linux window rendering](images/04-linux-window-finish.png) | Rounded surfaces, startup transparency, theme-aware outline and resize targets. |
| [Appearance and settings](images/05-appearance-settings.png) | Linux portal appearance and explicit restart feedback for system borders. |

The figures relate to the Linux, Windows and macOS CSD implementations; their
captions identify platform-specific behavior. Custom thumb styling applies to
Linux/Windows; macOS keeps native scrollbar appearance. The portal correction
and the illustrated 4px-inside/6px-outside resize targets apply to Linux.

Static figures do not verify native dragging, Snap Layouts, animation timing,
startup rendering or live resizing. Use native runtime captures and recordings
for those checks. Raw user screenshots and recordings are intentionally not
included here because some contain other desktop content.

The complete implementation is available on `desktop-modernization-effort`.
The CSD-only comparison branch preserves upstream UI layout and styling so
engineers can observe which integration gaps the shared changes address.

## Local appearance playground

On `codex/desktop-modernization-optimized`, open Settings → General → Appearance
→ Design playground (PoC). Colors, gradients, button/input/card shapes, inner
borders, card/button shadows, separators, scrollbar appearance and panel/button
animation timing update live. Light and dark appearances are saved separately
in the WebEngine profile's local storage; Reset current appearance clears the
current theme's overrides. Header height and logo visibility use the existing
Qt settings and are shared between themes. Hiding or scaling the logo preserves
its space, and scrollbar thumb width changes retain the same gutter.

Use system window borders requires a restart and disables the custom window
behavior while retaining the modernized web design and appearance controls.
The playground does not customize the OS frame or shadow, and adds no dependency.
Custom palettes may reduce contrast. Reduced-motion and forced-color system
preferences take precedence over custom animation and scrollbar styling.
