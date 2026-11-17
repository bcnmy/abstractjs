---
"@biconomy/abstractjs": patch
---

Smart sessions: sign every session-signed userOp. Session use that pays its own fee (`feeToken`) has two session-signed userOps, the payment and the call, and each needs its own signature over its own userOpHash. The signed quote now carries `sessionSignatures` (one per session userOp); `signature` still holds the first one for nodes that predate the field.
