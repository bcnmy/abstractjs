import { zeroAddress } from "viem"
import { describe, expect, test } from "vitest"
import { resolveInstructions } from "./resolveInstructions"

describe("utils.resolveInstructions", () => {
  test("should resolve instructions to an array of instructions", async () => {
    const instructions = [
      Promise.resolve([
        {
          chainId: 1,
          calls: [
            {
              to: zeroAddress,
              value: 0n
            }
          ]
        }
      ]),
      Promise.resolve([
        {
          chainId: 1,
          calls: [
            {
              to: zeroAddress,
              value: 0n
            }
          ]
        }
      ]),
      {
        chainId: 1,
        calls: [
          {
            to: zeroAddress,
            value: 0n
          }
        ]
      },
      [
        {
          chainId: 1,
          calls: [
            {
              to: zeroAddress,
              value: 0n
            }
          ]
        },
        {
          chainId: 1,
          calls: [
            {
              to: zeroAddress,
              value: 0n
            }
          ]
        }
      ]
    ]
    const resolvedInstructions = await resolveInstructions(instructions)
    expect(resolvedInstructions).toEqual([
      {
        chainId: 1,
        calls: [{ to: zeroAddress, value: 0n }]
      },
      {
        chainId: 1,
        calls: [{ to: zeroAddress, value: 0n }]
      },
      {
        chainId: 1,
        calls: [{ to: zeroAddress, value: 0n }]
      },
      {
        chainId: 1,
        calls: [{ to: zeroAddress, value: 0n }]
      },
      {
        chainId: 1,
        calls: [{ to: zeroAddress, value: 0n }]
      }
    ])
  })
})
