import { expect, test, describe } from "vitest"
import { parseErrorMessage } from "./parseErrorMessage"

describe("utils.parseErrorMessage", () => {
  test("should return the relevant part from an entrypoint error", () => {
    const testErrorString = `Error: call revert exception [ See: https://links.ethers.org/v5-errors-CALL_EXCEPTION ] (method="simulateHandleOp((address,uint256,bytes,bytes,bytes32,uint256,bytes32,bytes,bytes),address,bytes)", data="0x220266b600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000001b4141313320696e6974436f6465206661696c6564206f72204f4f470000000000", errorArgs=[{"type":"BigNumber","hex":"0x00"},"AA13 initCode failed or OOG"], errorName="FailedOp", errorSignature="FailedOp(uint256,string)", reason=null, code=CALL_EXCEPTION, version=abi/5.7.0)`
    const error = new Error(testErrorString)
    expect(parseErrorMessage(error)).toBe("AA13 initCode failed or OOG")
    expect(error.message).toBe("AA13 initCode failed or OOG")
  })

  test("should return the error message if it doesn't match the entrypoint error pattern", () => {
    const error = new Error("test")
    expect(parseErrorMessage(error)).toBe("test")
    expect(parseErrorMessage("test")).toBe("test")
  })
})
