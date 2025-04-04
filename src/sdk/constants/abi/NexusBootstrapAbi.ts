export const NexusBootstrapAbi = [
  {
    type: "constructor",
    inputs: [
      {
        name: "defaultValidator",
        type: "address",
        internalType: "address"
      },
      {
        name: "initData",
        type: "bytes",
        internalType: "bytes"
      }
    ],
    stateMutability: "nonpayable"
  },
  {
    type: "error",
    name: "CanNotRemoveLastValidator",
    inputs: []
  },
  {
    type: "error",
    name: "DefaultValidatorAlreadyInstalled",
    inputs: []
  },
  {
    type: "error",
    name: "EmergencyUninstallSigError",
    inputs: []
  },
  {
    type: "error",
    name: "EnableModeSigError",
    inputs: []
  },
  {
    type: "error",
    name: "FallbackAlreadyInstalledForSelector",
    inputs: [
      {
        name: "selector",
        type: "bytes4",
        internalType: "bytes4"
      }
    ]
  },
  {
    type: "error",
    name: "FallbackCallTypeInvalid",
    inputs: []
  },
  {
    type: "error",
    name: "FallbackHandlerUninstallFailed",
    inputs: []
  },
  {
    type: "error",
    name: "FallbackNotInstalledForSelector",
    inputs: [
      {
        name: "selector",
        type: "bytes4",
        internalType: "bytes4"
      }
    ]
  },
  {
    type: "error",
    name: "FallbackSelectorForbidden",
    inputs: []
  },
  {
    type: "error",
    name: "HookAlreadyInstalled",
    inputs: [
      {
        name: "currentHook",
        type: "address",
        internalType: "address"
      }
    ]
  },
  {
    type: "error",
    name: "HookPostCheckFailed",
    inputs: []
  },
  {
    type: "error",
    name: "InvalidInput",
    inputs: []
  },
  {
    type: "error",
    name: "InvalidModule",
    inputs: [
      {
        name: "module",
        type: "address",
        internalType: "address"
      }
    ]
  },
  {
    type: "error",
    name: "InvalidModuleTypeId",
    inputs: [
      {
        name: "moduleTypeId",
        type: "uint256",
        internalType: "uint256"
      }
    ]
  },
  {
    type: "error",
    name: "InvalidNonce",
    inputs: []
  },
  {
    type: "error",
    name: "LinkedList_AlreadyInitialized",
    inputs: []
  },
  {
    type: "error",
    name: "LinkedList_EntryAlreadyInList",
    inputs: [
      {
        name: "entry",
        type: "address",
        internalType: "address"
      }
    ]
  },
  {
    type: "error",
    name: "LinkedList_InvalidEntry",
    inputs: [
      {
        name: "entry",
        type: "address",
        internalType: "address"
      }
    ]
  },
  {
    type: "error",
    name: "LinkedList_InvalidPage",
    inputs: []
  },
  {
    type: "error",
    name: "MismatchModuleTypeId",
    inputs: []
  },
  {
    type: "error",
    name: "MissingFallbackHandler",
    inputs: [
      {
        name: "selector",
        type: "bytes4",
        internalType: "bytes4"
      }
    ]
  },
  {
    type: "error",
    name: "ModuleAddressCanNotBeZero",
    inputs: []
  },
  {
    type: "error",
    name: "ModuleAlreadyInstalled",
    inputs: [
      {
        name: "moduleTypeId",
        type: "uint256",
        internalType: "uint256"
      },
      {
        name: "module",
        type: "address",
        internalType: "address"
      }
    ]
  },
  {
    type: "error",
    name: "ModuleNotInstalled",
    inputs: [
      {
        name: "moduleTypeId",
        type: "uint256",
        internalType: "uint256"
      },
      {
        name: "module",
        type: "address",
        internalType: "address"
      }
    ]
  },
  {
    type: "error",
    name: "NoValidatorInstalled",
    inputs: []
  },
  {
    type: "error",
    name: "PrevalidationHookAlreadyInstalled",
    inputs: [
      {
        name: "currentPreValidationHook",
        type: "address",
        internalType: "address"
      }
    ]
  },
  {
    type: "error",
    name: "UnauthorizedOperation",
    inputs: [
      {
        name: "operator",
        type: "address",
        internalType: "address"
      }
    ]
  },
  {
    type: "error",
    name: "UnsupportedCallType",
    inputs: [
      {
        name: "callType",
        type: "bytes1",
        internalType: "CallType"
      }
    ]
  },
  {
    type: "error",
    name: "ValidatorNotInstalled",
    inputs: [
      {
        name: "module",
        type: "address",
        internalType: "address"
      }
    ]
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
  {
    type: "fallback",
    stateMutability: "payable"
  },
  {
    type: "function",
    name: "eip712Domain",
    inputs: [],
    outputs: [
      {
        name: "fields",
        type: "bytes1",
        internalType: "bytes1"
      },
      {
        name: "name",
        type: "string",
        internalType: "string"
      },
      {
        name: "version",
        type: "string",
        internalType: "string"
      },
      {
        name: "chainId",
        type: "uint256",
        internalType: "uint256"
      },
      {
        name: "verifyingContract",
        type: "address",
        internalType: "address"
      },
      {
        name: "salt",
        type: "bytes32",
        internalType: "bytes32"
      },
      {
        name: "extensions",
        type: "uint256[]",
        internalType: "uint256[]"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getActiveHook",
    inputs: [],
    outputs: [
      {
        name: "hook",
        type: "address",
        internalType: "address"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getExecutorsPaginated",
    inputs: [
      {
        name: "cursor",
        type: "address",
        internalType: "address"
      },
      {
        name: "size",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    outputs: [
      {
        name: "array",
        type: "address[]",
        internalType: "address[]"
      },
      {
        name: "next",
        type: "address",
        internalType: "address"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getFallbackHandlerBySelector",
    inputs: [
      {
        name: "selector",
        type: "bytes4",
        internalType: "bytes4"
      }
    ],
    outputs: [
      {
        name: "",
        type: "bytes1",
        internalType: "CallType"
      },
      {
        name: "",
        type: "address",
        internalType: "address"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getRegistry",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract IERC7484"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getValidatorsPaginated",
    inputs: [
      {
        name: "cursor",
        type: "address",
        internalType: "address"
      },
      {
        name: "size",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    outputs: [
      {
        name: "array",
        type: "address[]",
        internalType: "address[]"
      },
      {
        name: "next",
        type: "address",
        internalType: "address"
      }
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
          {
            name: "module",
            type: "address",
            internalType: "address"
          },
          {
            name: "data",
            type: "bytes",
            internalType: "bytes"
          }
        ]
      },
      {
        name: "executors",
        type: "tuple[]",
        internalType: "struct BootstrapConfig[]",
        components: [
          {
            name: "module",
            type: "address",
            internalType: "address"
          },
          {
            name: "data",
            type: "bytes",
            internalType: "bytes"
          }
        ]
      },
      {
        name: "hook",
        type: "tuple",
        internalType: "struct BootstrapConfig",
        components: [
          {
            name: "module",
            type: "address",
            internalType: "address"
          },
          {
            name: "data",
            type: "bytes",
            internalType: "bytes"
          }
        ]
      },
      {
        name: "fallbacks",
        type: "tuple[]",
        internalType: "struct BootstrapConfig[]",
        components: [
          {
            name: "module",
            type: "address",
            internalType: "address"
          },
          {
            name: "data",
            type: "bytes",
            internalType: "bytes"
          }
        ]
      },
      {
        name: "preValidationHooks",
        type: "tuple[]",
        internalType: "struct BootstrapPreValidationHookConfig[]",
        components: [
          {
            name: "hookType",
            type: "uint256",
            internalType: "uint256"
          },
          {
            name: "module",
            type: "address",
            internalType: "address"
          },
          {
            name: "data",
            type: "bytes",
            internalType: "bytes"
          }
        ]
      },
      {
        name: "registryConfig",
        type: "tuple",
        internalType: "struct RegistryConfig",
        components: [
          {
            name: "registry",
            type: "address",
            internalType: "contract IERC7484"
          },
          {
            name: "attesters",
            type: "address[]",
            internalType: "address[]"
          },
          {
            name: "threshold",
            type: "uint8",
            internalType: "uint8"
          }
        ]
      }
    ],
    outputs: [],
    stateMutability: "payable"
  },
  {
    type: "function",
    name: "initNexusNoRegistry",
    inputs: [
      {
        name: "validators",
        type: "tuple[]",
        internalType: "struct BootstrapConfig[]",
        components: [
          {
            name: "module",
            type: "address",
            internalType: "address"
          },
          {
            name: "data",
            type: "bytes",
            internalType: "bytes"
          }
        ]
      },
      {
        name: "executors",
        type: "tuple[]",
        internalType: "struct BootstrapConfig[]",
        components: [
          {
            name: "module",
            type: "address",
            internalType: "address"
          },
          {
            name: "data",
            type: "bytes",
            internalType: "bytes"
          }
        ]
      },
      {
        name: "hook",
        type: "tuple",
        internalType: "struct BootstrapConfig",
        components: [
          {
            name: "module",
            type: "address",
            internalType: "address"
          },
          {
            name: "data",
            type: "bytes",
            internalType: "bytes"
          }
        ]
      },
      {
        name: "fallbacks",
        type: "tuple[]",
        internalType: "struct BootstrapConfig[]",
        components: [
          {
            name: "module",
            type: "address",
            internalType: "address"
          },
          {
            name: "data",
            type: "bytes",
            internalType: "bytes"
          }
        ]
      },
      {
        name: "preValidationHooks",
        type: "tuple[]",
        internalType: "struct BootstrapPreValidationHookConfig[]",
        components: [
          {
            name: "hookType",
            type: "uint256",
            internalType: "uint256"
          },
          {
            name: "module",
            type: "address",
            internalType: "address"
          },
          {
            name: "data",
            type: "bytes",
            internalType: "bytes"
          }
        ]
      }
    ],
    outputs: [],
    stateMutability: "payable"
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
          {
            name: "module",
            type: "address",
            internalType: "address"
          },
          {
            name: "data",
            type: "bytes",
            internalType: "bytes"
          }
        ]
      },
      {
        name: "hook",
        type: "tuple",
        internalType: "struct BootstrapConfig",
        components: [
          {
            name: "module",
            type: "address",
            internalType: "address"
          },
          {
            name: "data",
            type: "bytes",
            internalType: "bytes"
          }
        ]
      },
      {
        name: "registryConfig",
        type: "tuple",
        internalType: "struct RegistryConfig",
        components: [
          {
            name: "registry",
            type: "address",
            internalType: "contract IERC7484"
          },
          {
            name: "attesters",
            type: "address[]",
            internalType: "address[]"
          },
          {
            name: "threshold",
            type: "uint8",
            internalType: "uint8"
          }
        ]
      }
    ],
    outputs: [],
    stateMutability: "payable"
  },
  {
    type: "function",
    name: "initNexusScopedNoRegistry",
    inputs: [
      {
        name: "validators",
        type: "tuple[]",
        internalType: "struct BootstrapConfig[]",
        components: [
          {
            name: "module",
            type: "address",
            internalType: "address"
          },
          {
            name: "data",
            type: "bytes",
            internalType: "bytes"
          }
        ]
      },
      {
        name: "hook",
        type: "tuple",
        internalType: "struct BootstrapConfig",
        components: [
          {
            name: "module",
            type: "address",
            internalType: "address"
          },
          {
            name: "data",
            type: "bytes",
            internalType: "bytes"
          }
        ]
      }
    ],
    outputs: [],
    stateMutability: "payable"
  },
  {
    type: "function",
    name: "initNexusWithDefaultValidator",
    inputs: [
      {
        name: "data",
        type: "bytes",
        internalType: "bytes"
      }
    ],
    outputs: [],
    stateMutability: "payable"
  },
  {
    type: "function",
    name: "initNexusWithDefaultValidatorAndOtherModules",
    inputs: [
      {
        name: "defaultValidatorInitData",
        type: "bytes",
        internalType: "bytes"
      },
      {
        name: "executors",
        type: "tuple[]",
        internalType: "struct BootstrapConfig[]",
        components: [
          {
            name: "module",
            type: "address",
            internalType: "address"
          },
          {
            name: "data",
            type: "bytes",
            internalType: "bytes"
          }
        ]
      },
      {
        name: "hook",
        type: "tuple",
        internalType: "struct BootstrapConfig",
        components: [
          {
            name: "module",
            type: "address",
            internalType: "address"
          },
          {
            name: "data",
            type: "bytes",
            internalType: "bytes"
          }
        ]
      },
      {
        name: "fallbacks",
        type: "tuple[]",
        internalType: "struct BootstrapConfig[]",
        components: [
          {
            name: "module",
            type: "address",
            internalType: "address"
          },
          {
            name: "data",
            type: "bytes",
            internalType: "bytes"
          }
        ]
      },
      {
        name: "preValidationHooks",
        type: "tuple[]",
        internalType: "struct BootstrapPreValidationHookConfig[]",
        components: [
          {
            name: "hookType",
            type: "uint256",
            internalType: "uint256"
          },
          {
            name: "module",
            type: "address",
            internalType: "address"
          },
          {
            name: "data",
            type: "bytes",
            internalType: "bytes"
          }
        ]
      },
      {
        name: "registryConfig",
        type: "tuple",
        internalType: "struct RegistryConfig",
        components: [
          {
            name: "registry",
            type: "address",
            internalType: "contract IERC7484"
          },
          {
            name: "attesters",
            type: "address[]",
            internalType: "address[]"
          },
          {
            name: "threshold",
            type: "uint8",
            internalType: "uint8"
          }
        ]
      }
    ],
    outputs: [],
    stateMutability: "payable"
  },
  {
    type: "function",
    name: "initNexusWithDefaultValidatorAndOtherModulesNoRegistry",
    inputs: [
      {
        name: "defaultValidatorInitData",
        type: "bytes",
        internalType: "bytes"
      },
      {
        name: "validators",
        type: "tuple[]",
        internalType: "struct BootstrapConfig[]",
        components: [
          {
            name: "module",
            type: "address",
            internalType: "address"
          },
          {
            name: "data",
            type: "bytes",
            internalType: "bytes"
          }
        ]
      },
      {
        name: "executors",
        type: "tuple[]",
        internalType: "struct BootstrapConfig[]",
        components: [
          {
            name: "module",
            type: "address",
            internalType: "address"
          },
          {
            name: "data",
            type: "bytes",
            internalType: "bytes"
          }
        ]
      },
      {
        name: "hook",
        type: "tuple",
        internalType: "struct BootstrapConfig",
        components: [
          {
            name: "module",
            type: "address",
            internalType: "address"
          },
          {
            name: "data",
            type: "bytes",
            internalType: "bytes"
          }
        ]
      },
      {
        name: "fallbacks",
        type: "tuple[]",
        internalType: "struct BootstrapConfig[]",
        components: [
          {
            name: "module",
            type: "address",
            internalType: "address"
          },
          {
            name: "data",
            type: "bytes",
            internalType: "bytes"
          }
        ]
      },
      {
        name: "preValidationHooks",
        type: "tuple[]",
        internalType: "struct BootstrapPreValidationHookConfig[]",
        components: [
          {
            name: "hookType",
            type: "uint256",
            internalType: "uint256"
          },
          {
            name: "module",
            type: "address",
            internalType: "address"
          },
          {
            name: "data",
            type: "bytes",
            internalType: "bytes"
          }
        ]
      }
    ],
    outputs: [],
    stateMutability: "payable"
  },
  {
    type: "function",
    name: "initNexusWithSingleValidator",
    inputs: [
      {
        name: "validator",
        type: "address",
        internalType: "address"
      },
      {
        name: "data",
        type: "bytes",
        internalType: "bytes"
      },
      {
        name: "registryConfig",
        type: "tuple",
        internalType: "struct RegistryConfig",
        components: [
          {
            name: "registry",
            type: "address",
            internalType: "contract IERC7484"
          },
          {
            name: "attesters",
            type: "address[]",
            internalType: "address[]"
          },
          {
            name: "threshold",
            type: "uint8",
            internalType: "uint8"
          }
        ]
      }
    ],
    outputs: [],
    stateMutability: "payable"
  },
  {
    type: "function",
    name: "initNexusWithSingleValidatorNoRegistry",
    inputs: [
      {
        name: "validator",
        type: "address",
        internalType: "address"
      },
      {
        name: "data",
        type: "bytes",
        internalType: "bytes"
      }
    ],
    outputs: [],
    stateMutability: "payable"
  },
  {
    type: "function",
    name: "installModule",
    inputs: [
      {
        name: "moduleTypeId",
        type: "uint256",
        internalType: "uint256"
      },
      {
        name: "module",
        type: "address",
        internalType: "address"
      },
      {
        name: "initData",
        type: "bytes",
        internalType: "bytes"
      }
    ],
    outputs: [],
    stateMutability: "payable"
  },
  {
    type: "function",
    name: "isModuleInstalled",
    inputs: [
      {
        name: "moduleTypeId",
        type: "uint256",
        internalType: "uint256"
      },
      {
        name: "module",
        type: "address",
        internalType: "address"
      },
      {
        name: "additionalContext",
        type: "bytes",
        internalType: "bytes"
      }
    ],
    outputs: [
      {
        name: "installed",
        type: "bool",
        internalType: "bool"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "uninstallModule",
    inputs: [
      {
        name: "moduleTypeId",
        type: "uint256",
        internalType: "uint256"
      },
      {
        name: "module",
        type: "address",
        internalType: "address"
      },
      {
        name: "deInitData",
        type: "bytes",
        internalType: "bytes"
      }
    ],
    outputs: [],
    stateMutability: "payable"
  },
  {
    type: "receive",
    stateMutability: "payable"
  }
] as const
