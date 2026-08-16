---
name: Linux Windows packaging limit
description: Environment constraint encountered when producing the NSIS Windows installer from this Linux workspace.
---

The Linux workspace can produce `win-unpacked` x64, but the NSIS installer stage requires electron-builder's Windows `rcedit` helper. The available Wine setup exposes a non-executable 32-bit `wine` wrapper; redirecting it to `wine64` still fails in experimental WoW64 mode.

**Why:** Repeated local packaging attempts failed before creating the NSIS `.exe`; publishing an unpacked Electron executable as an installer would be misleading.

**How to apply:** Use a native Windows builder or a dedicated Windows CI runner for `OneSoftSetup-*-x64.exe`. Do not reuse an old installer artifact when the current build has not produced a new NSIS package.