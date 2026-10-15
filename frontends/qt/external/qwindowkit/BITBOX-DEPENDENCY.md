# QWindowKit dependency

Vendored source pins:

- QWindowKit: https://github.com/stdware/qwindowkit at `5626b3ae5f22508d77361495f589abedb39c2ee4`
- qmsetup: https://github.com/stdware/qmsetup at `f9cb0153a9dc913b7b8226451cd6760ed83b6ce8`
- stdcorelib: https://github.com/stdware/stdcorelib at `2fbefa9b152451d9621bf71bb1dfc8f98f8d2120`

All dependency sources and their license notices are included. Only static Core/Widgets libraries are built. Quick, examples, upstream tests and the style agent are disabled.

The bounded downstream change in `src/core/contexts/qtwindowcontext.cpp` makes the Qt fallback use the host QWindow's `_qwk_resize_frame` QRect property for resize borders. The `_qwk_resize_border` and `_qwk_resize_corner` properties provide matching cursor/resize hit tests with a minimum 4px band and extended corner targets. The `_qwk_resize_outset` property bounds the outer input gutter to 6px of the client shadow, while the inner band stays 4px and excess shadow padding is excluded. `_qwk_disabled_resize_edges` disables attached Wayland tile edges. `_qwk_title_double_click` optionally selects `none` or `minimize`; other values retain maximize/restore. These properties are private integration points set by DesktopWindow, not upstream public APIs. Retest this patch and the private Qt Wayland adapter when upgrading Qt or QWindowKit.
