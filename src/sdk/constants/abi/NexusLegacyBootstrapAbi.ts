export const NexusLegacyBootstrapAbi = [
  { type: "fallback", stateMutability: "payable" },
  { type: "receive", stateMutability: "payable" },
  {
    type: "function",
    name: "eip712Domain",
    inputs: [],
    outputs: [
      { name: "fields", type: "bytes1", internalType: "bytes1" },
      { name: "name", type: "string", internalType: "string" },
      { name: "version", type: "string", internalType: "string" },
      { name: "chainId", type: "uint256", internalType: "uint256" },
      { name: "verifyingContract", type: "address", internalType: "address" },
      { name: "salt", type: "bytes32", internalType: "bytes32" },
      { name: "extensions", type: "uint256[]", internalType: "uint256[]" }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getActiveHook",
    inputs: [],
    outputs: [{ name: "hook", type: "address", internalType: "address" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getExecutorsPaginated",
    inputs: [
      { name: "cursor", type: "address", internalType: "address" },
      { name: "size", type: "uint256", internalType: "uint256" }
    ],
    outputs: [
      { name: "array", type: "address[]", internalType: "address[]" },
      { name: "next", type: "address", internalType: "address" }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getFallbackHandlerBySelector",
    inputs: [{ name: "selector", type: "bytes4", internalType: "bytes4" }],
    outputs: [
      { name: "", type: "bytes1", internalType: "CallType" },
      { name: "", type: "address", internalType: "address" }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getInitNexusCalldata",
    inputs: [
      {
        name: "validators",
        type: "tuple[]",
        internalType: "struct BootstrapConfig[]",
        components: [
          { name: "module", type: "address", internalType: "address" },
          { name: "data", type: "bytes", internalType: "bytes" }
        ]
      },
      {
        name: "executors",
        type: "tuple[]",
        internalType: "struct BootstrapConfig[]",
        components: [
          { name: "module", type: "address", internalType: "address" },
          { name: "data", type: "bytes", internalType: "bytes" }
        ]
      },
      {
        name: "hook",
        type: "tuple",
        internalType: "struct BootstrapConfig",
        components: [
          { name: "module", type: "address", internalType: "address" },
          { name: "data", type: "bytes", internalType: "bytes" }
        ]
      },
      {
        name: "fallbacks",
        type: "tuple[]",
        internalType: "struct BootstrapConfig[]",
        components: [
          { name: "module", type: "address", internalType: "address" },
          { name: "data", type: "bytes", internalType: "bytes" }
        ]
      },
      { name: "registry", type: "address", internalType: "contract IERC7484" },
      { name: "attesters", type: "address[]", internalType: "address[]" },
      { name: "threshold", type: "uint8", internalType: "uint8" }
    ],
    outputs: [{ name: "init", type: "bytes", internalType: "bytes" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getInitNexusScopedCalldata",
    inputs: [
      {
        name: "validators",
        type: "tuple[]",
        internalType: "struct BootstrapConfig[]",
        components: [
          { name: "module", type: "address", internalType: "address" },
          { name: "data", type: "bytes", internalType: "bytes" }
        ]
      },
      {
        name: "hook",
        type: "tuple",
        internalType: "struct BootstrapConfig",
        components: [
          { name: "module", type: "address", internalType: "address" },
          { name: "data", type: "bytes", internalType: "bytes" }
        ]
      },
      { name: "registry", type: "address", internalType: "contract IERC7484" },
      { name: "attesters", type: "address[]", internalType: "address[]" },
      { name: "threshold", type: "uint8", internalType: "uint8" }
    ],
    outputs: [{ name: "init", type: "bytes", internalType: "bytes" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getInitNexusWithSingleValidatorCalldata",
    inputs: [
      {
        name: "validator",
        type: "tuple",
        internalType: "struct BootstrapConfig",
        components: [
          { name: "module", type: "address", internalType: "address" },
          { name: "data", type: "bytes", internalType: "bytes" }
        ]
      },
      { name: "registry", type: "address", internalType: "contract IERC7484" },
      { name: "attesters", type: "address[]", internalType: "address[]" },
      { name: "threshold", type: "uint8", internalType: "uint8" }
    ],
    outputs: [{ name: "init", type: "bytes", internalType: "bytes" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getValidatorsPaginated",
    inputs: [
      { name: "cursor", type: "address", internalType: "address" },
      { name: "size", type: "uint256", internalType: "uint256" }
    ],
    outputs: [
      { name: "array", type: "address[]", internalType: "address[]" },
      { name: "next", type: "address", internalType: "address" }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "initNexus",
    inputs: [
      {
        name: "validators",
        type: "tuple[]",
        internalType: "struct BootstrapConfig[]",
        components: [
          { name: "module", type: "address", internalType: "address" },
          { name: "data", type: "bytes", internalType: "bytes" }
        ]
      },
      {
        name: "executors",
        type: "tuple[]",
        internalType: "struct BootstrapConfig[]",
        components: [
          { name: "module", type: "address", internalType: "address" },
          { name: "data", type: "bytes", internalType: "bytes" }
        ]
      },
      {
        name: "hook",
        type: "tuple",
        internalType: "struct BootstrapConfig",
        components: [
          { name: "module", type: "address", internalType: "address" },
          { name: "data", type: "bytes", internalType: "bytes" }
        ]
      },
      {
        name: "fallbacks",
        type: "tuple[]",
        internalType: "struct BootstrapConfig[]",
        components: [
          { name: "module", type: "address", internalType: "address" },
          { name: "data", type: "bytes", internalType: "bytes" }
        ]
      },
      { name: "registry", type: "address", internalType: "contract IERC7484" },
      { name: "attesters", type: "address[]", internalType: "address[]" },
      { name: "threshold", type: "uint8", internalType: "uint8" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "initNexusScoped",
    inputs: [
      {
        name: "validators",
        type: "tuple[]",
        internalType: "struct BootstrapConfig[]",
        components: [
          { name: "module", type: "address", internalType: "address" },
          { name: "data", type: "bytes", internalType: "bytes" }
        ]
      },
      {
        name: "hook",
        type: "tuple",
        internalType: "struct BootstrapConfig",
        components: [
          { name: "module", type: "address", internalType: "address" },
          { name: "data", type: "bytes", internalType: "bytes" }
        ]
      },
      { name: "registry", type: "address", internalType: "contract IERC7484" },
      { name: "attesters", type: "address[]", internalType: "address[]" },
      { name: "threshold", type: "uint8", internalType: "uint8" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "initNexusWithSingleValidator",
    inputs: [
      { name: "validator", type: "address", internalType: "contract IModule" },
      { name: "data", type: "bytes", internalType: "bytes" },
      { name: "registry", type: "address", internalType: "contract IERC7484" },
      { name: "attesters", type: "address[]", internalType: "address[]" },
      { name: "threshold", type: "uint8", internalType: "uint8" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "registry",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "contract IERC7484" }],
    stateMutability: "view"
  },
  {
    type: "event",
    name: "ERC7484RegistryConfigured",
    inputs: [
      {
        name: "registry",
        type: "address",
        indexed: true,
        internalType: "contract IERC7484"
      }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "ModuleInstalled",
    inputs: [
      {
        name: "moduleTypeId",
        type: "uint256",
        indexed: false,
        internalType: "uint256"
      },
      {
        name: "module",
        type: "address",
        indexed: false,
        internalType: "address"
      }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "ModuleUninstalled",
    inputs: [
      {
        name: "moduleTypeId",
        type: "uint256",
        indexed: false,
        internalType: "uint256"
      },
      {
        name: "module",
        type: "address",
        indexed: false,
        internalType: "address"
      }
    ],
    anonymous: false
  },
  { type: "error", name: "CanNotRemoveLastValidator", inputs: [] },
  { type: "error", name: "EnableModeSigError", inputs: [] },
  {
    type: "error",
    name: "FallbackAlreadyInstalledForSelector",
    inputs: [{ name: "selector", type: "bytes4", internalType: "bytes4" }]
  },
  { type: "error", name: "FallbackCallTypeInvalid", inputs: [] },
  { type: "error", name: "FallbackHandlerUninstallFailed", inputs: [] },
  {
    type: "error",
    name: "FallbackNotInstalledForSelector",
    inputs: [{ name: "selector", type: "bytes4", internalType: "bytes4" }]
  },
  { type: "error", name: "FallbackSelectorForbidden", inputs: [] },
  {
    type: "error",
    name: "HookAlreadyInstalled",
    inputs: [{ name: "currentHook", type: "address", internalType: "address" }]
  },
  { type: "error", name: "HookPostCheckFailed", inputs: [] },
  { type: "error", name: "InvalidInput", inputs: [] },
  {
    type: "error",
    name: "InvalidModule",
    inputs: [{ name: "module", type: "address", internalType: "address" }]
  },
  {
    type: "error",
    name: "InvalidModuleTypeId",
    inputs: [{ name: "moduleTypeId", type: "uint256", internalType: "uint256" }]
  },
  {
    type: "error",
    name: "LinkedList_EntryAlreadyInList",
    inputs: [{ name: "entry", type: "address", internalType: "address" }]
  },
  {
    type: "error",
    name: "LinkedList_InvalidEntry",
    inputs: [{ name: "entry", type: "address", internalType: "address" }]
  },
  { type: "error", name: "LinkedList_InvalidPage", inputs: [] },
  {
    type: "error",
    name: "MismatchModuleTypeId",
    inputs: [{ name: "moduleTypeId", type: "uint256", internalType: "uint256" }]
  },
  {
    type: "error",
    name: "MissingFallbackHandler",
    inputs: [{ name: "selector", type: "bytes4", internalType: "bytes4" }]
  },
  { type: "error", name: "ModuleAddressCanNotBeZero", inputs: [] },
  {
    type: "error",
    name: "ModuleAlreadyInstalled",
    inputs: [
      { name: "moduleTypeId", type: "uint256", internalType: "uint256" },
      { name: "module", type: "address", internalType: "address" }
    ]
  },
  {
    type: "error",
    name: "ModuleNotInstalled",
    inputs: [
      { name: "moduleTypeId", type: "uint256", internalType: "uint256" },
      { name: "module", type: "address", internalType: "address" }
    ]
  },
  { type: "error", name: "NoValidatorInstalled", inputs: [] },
  {
    type: "error",
    name: "UnauthorizedOperation",
    inputs: [{ name: "operator", type: "address", internalType: "address" }]
  },
  {
    type: "error",
    name: "UnsupportedCallType",
    inputs: [{ name: "callType", type: "bytes1", internalType: "CallType" }]
  },
  {
    type: "error",
    name: "ValidatorNotInstalled",
    inputs: [{ name: "module", type: "address", internalType: "address" }]
  }
] as const
