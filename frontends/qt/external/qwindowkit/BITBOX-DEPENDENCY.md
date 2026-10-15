# QWindowKit dependency

Vendored source pins:

- QWindowKit: https://github.com/stdware/qwindowkit at `5626b3ae5f22508d77361495f589abedb39c2ee4`
- qmsetup: https://github.com/stdware/qmsetup at `f9cb0153a9dc913b7b8226451cd6760ed83b6ce8`
- stdcorelib: https://github.com/stdware/stdcorelib at `2fbefa9b152451d9621bf71bb1dfc8f98f8d2120`

All dependency sources and their license notices are included. The desktop build integration selects static Core/Widgets libraries and disables Quick, examples, upstream tests and the style agent.

The dependency import preserves the pinned upstream files without BitBox-specific source patches. Platform integration patches are reviewed separately and documented alongside their implementation.
