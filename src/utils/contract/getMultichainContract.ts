import type { Abi, Address, Hex, EncodeFunctionDataParameters, Prettify } from "viem";
import { encodeFunctionData } from "viem";
import type {
  ExtractAbiFunctionNames,
  AbiParametersToPrimitiveTypes,
  ExtractAbiFunction,
} from "abitype";
import { AbstractCall, MeeUserOp } from "../../workflow";
import { AddressMapping } from "../../primitives";

/**
 * Contract instance capable of encoding transactions across multiple chains
 * @template TAbi - The contract ABI type
 */
export type MultichainContract<TAbi extends Abi> = {
  abi: TAbi;
  deployments: Map<number, Address>;
  on: (chainId: number) => ChainSpecificContract<TAbi>;
  addressOn: (chainId: number) => Address;
};

export type ChainSpecificContract<TAbi extends Abi> = {
  [TFunctionName in ExtractAbiFunctionNames<TAbi>]: (params: {
    args: AbiParametersToPrimitiveTypes<
      ExtractAbiFunction<TAbi, TFunctionName>["inputs"]
    >;
    gasLimit: bigint;
    value?: bigint;
  }) => MeeUserOp;
};

function createChainSpecificContract<TAbi extends Abi>(
  abi: TAbi,
  chainId: number,
  address: Address
): ChainSpecificContract<TAbi> {
  return new Proxy({} as ChainSpecificContract<TAbi>, {
    get: (target, prop: string) => {
      if (!abi.some((item) => item.type === "function" && item.name === prop)) {
        throw new Error(`Function ${prop} not found in ABI`);
      }

      return ({
        args,
        gasLimit,
        value = 0n,
      }: {
        args: any[]; // This will be typed by the ChainSpecificContract type
        gasLimit: bigint;
        value?: bigint;
      }) => {
        const params: EncodeFunctionDataParameters = {
          abi,
          functionName: prop,
          args,
        };
        const data = encodeFunctionData(params);

        const call: AbstractCall = {
          to: address,
          gasLimit,
          value,
          data,
        };

        return {
          calls: [call],
          chainId,
        };
      };
    },
  });
}


/**
 * Creates a contract instance that can encode function calls across multiple chains
 * @template TAbi The contract ABI type
 * @example
 * const mcUSDC = getMultichainContract({
 *   abi: erc20ABI,
 *   deployments: [
 *     ['0x...', optimism.id],
 *     ['0x...', base.id],
 *     // Other chains
 *   ]
 * });
 *
 * const transferOp = usdc.on(optimism.id).transfer({
 *   args: ['0x...', 100n],
 *   gasLimit: 100000n
 * });
 */
export function getMultichainContract<TAbi extends Abi>(config: {
  abi: TAbi;
  deployments: [Address, number][];
}): MultichainContract<TAbi> {
  const deployments = new Map(
    config.deployments.map((deployment) => {
      const [address, chainId] = deployment;
      return [chainId, address];
    })
  );
  return {
    abi: config.abi,
    deployments,
    on: (chainId: number) => {
      const address = deployments.get(chainId);
      if (!address) {
        throw new Error(`No deployment found for chain ${chainId}`);
      }

      return createChainSpecificContract(config.abi, chainId, address);
    },
    addressOn: (chainId: number) => {
      const address = deployments.get(chainId);
      if (!address) {
        throw new Error(`No deployment found for chain ${chainId}`);
      }
      return address;
    },
  };
}
