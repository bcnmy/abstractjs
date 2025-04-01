import type { Address, Chain, Client, Hash, Hex, Transport } from "viem"
import type { Call } from "../../../../account/utils/Types"
import type { ModularSmartAccount } from "../../../utils/Types"
import { type AddOwnerParameters, addOwner } from "./addOwner"
import { getAddOwnerTx, toAddOwnerCalls } from "./getAddOwnerTx"
import { type GetOwnersParameters, getOwners } from "./getOwners"
import {
  type GetRemoveOwnerTxParameters,
  getRemoveOwnerTx,
  toRemoveOwnerCalls
} from "./getRemoveOwnerTx"
import {
  type GetSetThresholdTxParameters,
  getSetThresholdTx,
  toSetThresholdCalls
} from "./getSetThresholdTx"
import { type GetThresholdParameters, getThreshold } from "./getThreshold"
import { type MultiSignParameters, multiSign } from "./multiSign"
import {
  type PrepareForMultiSignParameters,
  type PrepareForMultiSignPayload,
  prepareForMultiSign
} from "./prepareForMultiSign"
import { type RemoveOwnerParameters, removeOwner } from "./removeOwner"
import { type SetThresholdParameters, setThreshold } from "./setThreshold"

export type OwnableActions<
  TModularSmartAccount extends ModularSmartAccount | undefined
> = {
  getRemoveOwnerTx: (
    args: GetRemoveOwnerTxParameters<TModularSmartAccount>
  ) => Promise<Call>
  addOwner: (args: AddOwnerParameters<TModularSmartAccount>) => Promise<Hash>
  removeOwner: (
    args: RemoveOwnerParameters<TModularSmartAccount>
  ) => Promise<Hash>
  setThreshold: (
    args: SetThresholdParameters<TModularSmartAccount>
  ) => Promise<Hash>
  getOwners: (
    args?: GetOwnersParameters<TModularSmartAccount>
  ) => Promise<Address[]>
  getSetThresholdTx: (
    args: GetSetThresholdTxParameters<TModularSmartAccount>
  ) => Promise<Call>
  getAddOwnerTx: (
    args: AddOwnerParameters<TModularSmartAccount>
  ) => Promise<Call>
  getThreshold: (
    args?: GetThresholdParameters<TModularSmartAccount>
  ) => Promise<number>
  multiSign: (args: MultiSignParameters<TModularSmartAccount>) => Promise<Hex>
  prepareForMultiSign: (
    args: PrepareForMultiSignParameters<TModularSmartAccount>
  ) => Promise<PrepareForMultiSignPayload>
}

export function ownableActions() {
  return <TModularSmartAccount extends ModularSmartAccount | undefined>(
    client: Client<Transport, Chain | undefined, TModularSmartAccount>
  ): OwnableActions<TModularSmartAccount> => {
    return {
      prepareForMultiSign: async (args) => {
        return await prepareForMultiSign(client, args)
      },
      multiSign: async (args) => {
        return await multiSign(client, args)
      },
      getThreshold: (args) => {
        return getThreshold(client, args)
      },
      getAddOwnerTx: (args) => {
        return getAddOwnerTx(client, args)
      },
      getOwners: (args) => {
        return getOwners(client, args)
      },
      getSetThresholdTx: (args) => {
        return getSetThresholdTx(client, args)
      },
      getRemoveOwnerTx: (args) => {
        return getRemoveOwnerTx(client, args)
      },
      addOwner: (args) => {
        return addOwner(client, args)
      },
      removeOwner: (args) => {
        return removeOwner(client, args)
      },
      setThreshold: (args) => {
        return setThreshold(client, args)
      }
    }
  }
}

export const ownableCalls = {
  toAddOwnerCalls,
  toSetThresholdCalls,
  toRemoveOwnerCalls
} as const

export const ownableReads = {
  toGetOwnersReads: getOwners,
  toGetThresholdReads: getThreshold
} as const

export {
  prepareForMultiSign,
  multiSign,
  addOwner,
  removeOwner,
  setThreshold,
  getOwners,
  getThreshold,
  getAddOwnerTx,
  getRemoveOwnerTx,
  getSetThresholdTx
}
