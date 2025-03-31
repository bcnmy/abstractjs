import type { Address, Hex } from "viem"
import { describe, expect, it } from "vitest"
import { toInitData } from "./toInitData"

describe("utils.toInitData", () => {
  it("should format module with module and data properties", () => {
    const input = {
      module: "0x1234567890123456789012345678901234567890" as Address,
      data: "0x1234" as Hex
    }

    const result = toInitData(input)
    expect(result).toEqual(input)
  })

  it("should format module with address and initData properties", () => {
    const input = {
      address: "0x1234567890123456789012345678901234567890" as Address,
      initData: "0x1234" as Hex
    }

    const expected = {
      module: "0x1234567890123456789012345678901234567890" as Address,
      data: "0x1234" as Hex
    }

    const result = toInitData(input)
    expect(result).toEqual(expected)
  })

  it("should handle mixed property names", () => {
    const input = {
      address: "0x1234567890123456789012345678901234567890" as Address,
      data: "0x1234" as Hex
    }

    const expected = {
      module: "0x1234567890123456789012345678901234567890" as Address,
      data: "0x1234" as Hex
    }

    const result = toInitData(input)
    expect(result).toEqual(expected)
  })

  it("should throw error when module/address is missing", () => {
    const input = {
      data: "0x1234" as Hex
    }

    expect(() => toInitData(input)).toThrow("Module or data is missing")
  })

  it("should throw error when data/initData is missing", () => {
    const input = {
      module: "0x1234567890123456789012345678901234567890" as Address
    }

    expect(() => toInitData(input)).toThrow("Module or data is missing")
  })
})
