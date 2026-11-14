---
"@ui-sdk/core": patch
---

A hover popup the pointer only crossed on its way to another hover trigger now closes at once, so separate hover popovers in a table's rows no longer pile up. A trigger inside the popup, or inside a popup nested under it, keeps it open.
