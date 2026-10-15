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
