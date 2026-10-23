---
"@biconomy/abstractjs": patch
---

Smart sessions: ERC-1271 / ERC-7739 session policies are temporarily not supported with the current SmartSession module. `grantPermission`, `toEnableSessionsCalls` and `toEnableERC1271PoliciesCalls` now throw when they are set; sessions without them are unaffected.
