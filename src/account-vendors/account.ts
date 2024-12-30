import type { Call, Signer } from "@biconomy/sdk";
import {
  ClientChainNotConfiguredError,
  type Address,
  type Client,
  type Hex,
} from "viem";

export type MinimalMEESmartAccount = {
  address: Address;
  client: Client;
  getInitCode: () => Hex;
  getNonce: () => Promise<bigint>;
  encodeExecuteBatch: (calls: readonly Call[]) => Promise<Hex>;
  isDeployed(): Promise<boolean>;
};

export class MultichainSmartAccount {
  deployments: MinimalMEESmartAccount[];
  signer: Signer;

  constructor(deployments: MinimalMEESmartAccount[], signer: Signer) {
    (this.deployments = deployments), (this.signer = signer);
  }

  deploymentOn(chainId: number): MinimalMEESmartAccount {
    const deployment = this.deployments.find((dep) => {
      const chain = dep.client.chain;
      if (!chain) {
        throw new ClientChainNotConfiguredError();
      }
      return chain.id === chainId;
    });
    if (!deployment) {
      throw Error(`No account deployment for chainId: ${chainId}`);
    }
    return deployment;
  }
}
