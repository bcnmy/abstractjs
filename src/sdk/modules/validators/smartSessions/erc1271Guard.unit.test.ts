import { describe, expect, it } from "vitest"
import {
  ERC1271_SESSION_POLICIES_UNSUPPORTED,
  assertNoErc1271SessionPolicies
} from "./Helpers"
import { toEnableERC1271PoliciesCalls } from "./decorators/toEnableERC1271PoliciesCalls"

const policy = {
  policy: "0x0000000000000000000000000000000000000001",
  initData: "0x"
} as const
const content = {
  contentName: ["Permit"],
  appDomainSeparator: `0x${"11".repeat(32)}`
} as const

describe("assertNoErc1271SessionPolicies", () => {
  it("allows missing or empty ERC-7739 data", () => {
    expect(() => assertNoErc1271SessionPolicies(undefined, "t")).not.toThrow()
    expect(() =>
      assertNoErc1271SessionPolicies(
        { allowedERC7739Content: [], erc1271Policies: [] },
        "t"
      )
    ).not.toThrow()
  })
  it("rejects ERC-1271 policies", () => {
    expect(() =>
      assertNoErc1271SessionPolicies(
        { allowedERC7739Content: [], erc1271Policies: [policy] },
        "t"
      )
    ).toThrow(ERC1271_SESSION_POLICIES_UNSUPPORTED)
  })
  it("rejects allowed ERC-7739 content", () => {
    expect(() =>
      assertNoErc1271SessionPolicies(
        { allowedERC7739Content: [content], erc1271Policies: [] },
        "t"
      )
    ).toThrow(ERC1271_SESSION_POLICIES_UNSUPPORTED)
  })
})

describe("toEnableERC1271PoliciesCalls", () => {
  it("refuses to build an enable call for ERC-1271 policies", async () => {
    await expect(
      toEnableERC1271PoliciesCalls({} as never, {
        permissionId: `0x${"22".repeat(32)}`,
        erc1271Policies: {
          allowedERC7739Content: [content],
          erc1271Policies: [policy]
        } as never
      })
    ).rejects.toThrow(ERC1271_SESSION_POLICIES_UNSUPPORTED)
  })
})
