import type { Address, Hex } from "viem"
import { describe, expect, it } from "vitest"
import type { ModuleMeta } from "../../modules"
import { toInstallData } from "./toInstallData"

describe("utils.toInstallData", () => {
  it("should format module with module, type, and data properties", () => {
    const input = {
      module: "0x1234567890123456789012345678901234567890" as Address,
      type: "validator",
      data: "0x1234" as Hex
    }

    const expected: ModuleMeta = {
      address: "0x1234567890123456789012345678901234567890" as Address,
      type: "validator",
      initData: "0x1234" as Hex,
      deInitData: "0x" as Hex
    }

    const result = toInstallData(input)
    expect(result).toEqual(expected)
  })

  it("should format module with address, type, and initData properties", () => {
    const input = {
      address: "0x1234567890123456789012345678901234567890" as Address,
      type: "validator",
      initData: "0x1234" as Hex
    }

    const expected: ModuleMeta = {
      address: "0x1234567890123456789012345678901234567890" as Address,
      type: "validator",
      initData: "0x1234" as Hex,
      deInitData: "0x" as Hex
    }

    const result = toInstallData(input)
    expect(result).toEqual(expected)
  })

  it("should handle mixed property names", () => {
    const input = {
      module: "0x1234567890123456789012345678901234567890" as Address,
      moduleType: "validator",
      data: "0x1234" as Hex
    }

    const expected: ModuleMeta = {
      address: "0x1234567890123456789012345678901234567890" as Address,
      type: "validator",
      initData: "0x1234" as Hex,
      deInitData: "0x" as Hex
    }

    const result = toInstallData(input)
    expect(result).toEqual(expected)
  })

  it("should handle custom deInitData", () => {
    const input = {
      module: "0x1234567890123456789012345678901234567890" as Address,
      type: "validator",
      data: "0x1234" as Hex,
      deInitData: "0xabcd" as Hex
    }

    const expected: ModuleMeta = {
      address: "0x1234567890123456789012345678901234567890" as Address,
      type: "validator",
      initData: "0x1234" as Hex,
      deInitData: "0xabcd" as Hex
    }

    const result = toInstallData(input)
    expect(result).toEqual(expected)
  })

  it("should throw error when address is missing", () => {
    const input = {
      type: "validator",
      data: "0x1234" as Hex
    }

    expect(() => toInstallData(input)).toThrow(
      "address, type or data is missing"
    )
  })

  it("should throw error when type is missing", () => {
    const input = {
      module: "0x1234567890123456789012345678901234567890" as Address,
      data: "0x1234" as Hex
    }

    expect(() => toInstallData(input)).toThrow(
      "address, type or data is missing"
    )
  })

  it("should throw error when data is missing", () => {
    const input = {
      module: "0x1234567890123456789012345678901234567890" as Address,
      type: "validator"
    }

    expect(() => toInstallData(input)).toThrow(
      "address, type or data is missing"
    )
  })
})
