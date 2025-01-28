import { expect, test, describe } from "vitest"
import { parseErrorMessage } from "./parseErrorMessage"

const revertExceptionMessage = `Error: call revert exception [ See: https://links.ethers.org/v5-errors-CALL_EXCEPTION ] (method="simulateHandleOp((address,uint256,bytes,bytes,bytes32,uint256,bytes32,bytes,bytes),address,bytes)", data="0x220266b600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000001b4141313320696e6974436f6465206661696c6564206f72204f4f470000000000", errorArgs=[{"type":"BigNumber","hex":"0x00"},"AA13 initCode failed or OOG"], errorName="FailedOp", errorSignature="FailedOp(uint256,string)", reason=null, code=CALL_EXCEPTION, version=abi/5.7.0)`

describe("utils.parseErrorMessage", () => {
  test("should return the relevant part from an entrypoint error", () => {
    const error = new Error(revertExceptionMessage)
    expect(parseErrorMessage(error)).toBe("AA13 initCode failed or OOG")
    expect(error.message).toBe("AA13 initCode failed or OOG")
  })

  test("should return the error message if it doesn't match the entrypoint error pattern", () => {
    const error = { errors: [revertExceptionMessage] }
    expect(parseErrorMessage(error)).toBe("AA13 initCode failed or OOG")
  })

  test("should return the error message if it doesn't match the entrypoint error pattern", () => {
    const error = new Error("test")
    expect(parseErrorMessage(error)).toBe("test")
    expect(parseErrorMessage("test")).toBe("test")
  })

  test("should handle errors array", () => {
    const error = { errors: ["First error", "Second error"] }
    expect(parseErrorMessage(error)).toBe("First error")
  })

  test("should handle message field", () => {
    const error = { message: "Error message" }
    expect(parseErrorMessage(error)).toBe("Error message")
  })

  test("should handle statusText field", () => {
    const error = { statusText: "Not Found" }
    expect(parseErrorMessage(error)).toBe("Not Found")
  })

  test("should handle nested error object", () => {
    const error = {
      json: {
        errors: ["JSON error"]
      }
    }
    expect(parseErrorMessage(error)).toBe(String(error))
  })

  test("should clean up common error prefixes", () => {
    expect(parseErrorMessage("Error: Something went wrong")).toBe(
      "Something went wrong"
    )
    expect(parseErrorMessage("Details: Problem occurred")).toBe(
      "Problem occurred"
    )
    expect(parseErrorMessage("Message: Invalid input")).toBe("Invalid input")
    expect(parseErrorMessage("error")).toBe("")
  })
})
