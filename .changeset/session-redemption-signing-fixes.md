---
"@biconomy/abstractjs": patch
---

Fix smart-session redemption on MEE 2.2.3. Session quotes now sign via the NoMee personal-sign flow (raw userOpHash) instead of Simple mode (`0x177eee00` / SuperTx EIP-712), which `K1MeeValidator` cannot validate when called by SmartSessions. Enabling a session already worked; redeeming it failed with `[0] Invalid signature`. (#201)

Also resolves the EIP-712 domain on fresh ERC-7702 EOAs during `signQuote` (#203), and uses unique default nonce keys to prevent same-chain userOp collisions (#209).
