import { erc20Abi } from "viem"
import { getMultichainContract } from "../../utils/contract/getMultichainContract"

export const mcUSDT = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0xdAC17F958D2ee523a2206206994597C13D831ec7", 1],
    ["0x919C1c267BC06a7039e03fcc2eF738525769109c", 2222],
    ["0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", 42220],
    ["0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", 43114]
  ]
})

export const mcUSDC = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", 1],
    ["0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", 10],
    ["0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", 137],
    ["0x1d17CBcF0D6D143135aE902365D2E5e2A16538D4", 324],
    ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", 8453],
    ["0xaf88d065e77c8cC2239327C5EDb3A432268e5831", 42161],
    ["0xcebA9300f2b948710d2653dD7B07f33A8B32118C", 42220],
    ["0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", 43114],
    ["0x036CbD53842c5426634e7929541eC2318f3dCF7e", 84532]
  ]
})

export const mcTON = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x582d872A1B094FC48F5DE31D3B73F2D9bE47def1", 1],
    ["0x76A797A59Ba2C17726896976B7B3747BfD1d220f", 56]
  ]
})

export const mcLINK = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x514910771AF9Ca656af840dff83E8264EcF986CA", 1],
    ["0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6", 10],
    ["0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD", 56],
    ["0xE2e73A1c69ecF83F464EFCE6A5be353a37cA09b2", 100],
    ["0x9e004545c59D359F6B7BFB06a26390b087717b42", 128],
    ["0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39", 137],
    ["0xb3654dc3D10Ea7645f8319668E8F54d2574FBdC8", 250],
    ["0xf390830DF829cf22c53c8840554B98eafC5dCBc2", 2001],
    ["0x68Ca48cA2626c415A89756471D4ADe2CC9034008", 39797],
    ["0xf97f4df75117a78c1A5a0DBb814Af92458539FB4", 42161],
    ["0x5947BB275c521040051D82396192181b413227A3", 43114],
    ["0x218532a12a389a4a92fC0C5Fb22901D1c19198aA", 1666600000]
  ]
})

export const mcUNI = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", 1],
    ["0x6fd9d7AD17242c41f7131d257212c54A0e816691", 10],
    ["0xBf5140A22578168FD562DCcF235E5D43A02ce9B1", 56],
    ["0x4537e328Bf7e4eFA29D05CAeA260D7fE26af9D74", 100],
    ["0x22C54cE8321A4015740eE1109D9cBc25815C46E6", 128],
    ["0xb33EaAd8d922B1083446DC23f610c2567fB5180f", 137],
    ["0x665B3A802979eC24e076c80025bFF33c18eB6007", 39797],
    ["0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0", 42161],
    ["0x8eBAf22B6F053dFFeaf46f4Dd9eFA95D89ba8580", 43114],
    ["0x90D81749da8867962c760414C1C25ec926E889b6", 1666600000]
  ]
})

export const mcBGB = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x54D2252757e1672EEaD234D27B1270728fF90581", 1],
    ["0x55d1f1879969bdbB9960d269974564C58DBc3238", 2818]
  ]
})

export const mcPEPE = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x6982508145454Ce325dDbE47a25d4ec3d2311933", 1],
    ["0x25d887Ce7a35172C62FeBFD67a1856F20FaEbB00", 56],
    ["0x25d887Ce7a35172C62FeBFD67a1856F20FaEbB00", 42161]
  ]
})

export const mcWEETH = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee", 1],
    ["0x35751007a407ca6FEFfE80b3cB397736D2cf4dbe", 42161]
  ]
})

export const mcUSDS = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0xdC035D45d973E3EC169d2276DDab16f1e407384F", 1],
    ["0x820C137fa70C8691f0e44Dc420a5e53c168921Dc", 8453]
  ]
})

export const mcAAVE = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", 1],
    ["0x76FB31fb4af56892A25e32cFC43De717950c9278", 10],
    ["0xfb6115445Bff7b52FeB98650C87f44907E58f802", 56],
    ["0x202b4936fE1a82A4965220860aE46d7d3939Bb25", 128],
    ["0xD6DF932A45C0f255f85145f286eA0b292B21C90B", 137],
    ["0x6a07A792ab2965C72a5B8088d3a069A7aC3a993B", 250],
    ["0xA7F2f790355E0C32CAb03f92F6EB7f488E6F049a", 39797],
    ["0xba5DdD1f9d7F570dc94a51479a000E3BCE967196", 42161],
    ["0x63a72806098Bd3D9520cC43356dD78afe5D386D9", 43114],
    ["0xcF323Aad9E522B93F11c352CaA519Ad0E14eB40F", 1666600000]
  ]
})

export const mcMNT = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x3c3a81e81dc49A522A592e7622A7E711c06bf354", 1],
    ["0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000", 5000]
  ]
})

export const mcRENDER = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x6De037ef9aD2725EB40118Bb1702EBb27e4Aeb24", 1],
    ["0x61299774020dA444Af134c82fa83E3810b309991", 137]
  ]
})

export const mcPOL = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x455e53CBB86018Ac2B8092FdCd39d8444aFFC3F6", 1],
    ["0x0000000000000000000000000000000000001010", 137]
  ]
})

export const mcOM = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x3593D125a4f7849a1B059E64F4517A86Dd60c95d", 1],
    ["0xF78D2e7936F5Fe18308A3B2951A93b6c4a41F5e2", 56],
    ["0xC3Ec80343D2bae2F8E680FDADDe7C17E71E114ea", 137],
    ["0x3992B27dA26848C2b19CeA6Fd25ad5568B68AB98", 8453]
  ]
})

export const mcFET = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0xaea46A60368A7bD060eec7DF8CBa43b7EF41Ad85", 1],
    ["0x031b41e504677879370e9DBcF937283A8691Fa7f", 56]
  ]
})

export const mcVIRTUAL = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x44ff8620b8cA30902395A7bD3F2407e1A091BF73", 1],
    ["0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b", 8453]
  ]
})

export const mcARB = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0xB50721BCf8d664c30412Cfbc6cf7a15145234ad1", 1],
    ["0x912CE59144191C1204E64559FE8253a0e49E6548", 42161],
    ["0xf823C3cD3CeBE0a1fA952ba88Dc9EEf8e0Bf46AD", 42170]
  ]
})

export const mcOKB = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x75231F58b43240C9718Dd58B4967c5114342a86c", 1],
    ["0xdF54B6c6195EA4d948D03bfD818D365cf175cFC2", 66]
  ]
})

export const mcBONK = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x1151CB3d861920e07a38e03eEAd12C32178567F6", 1],
    ["0xA697e272a73744b343528C3Bc4702F2565b2F422", 56],
    ["0xe5B49820e5A1063F6F4DdF851327b5E8B2301048", 137],
    ["0x09199d9A5F4448D0848e4395D065e1ad9c4a1F74", 42161],
    ["0xD4B6520f7Fb78E1EE75639F3376c581a71bcdb0E", 245022934]
  ]
})

export const mcINJ = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0xe28b3B32B6c345A34Ff64674606124Dd5Aceca30", 1],
    ["0xa2B726B1145A4773F68593CF171187d8EBe4d495", 56]
  ]
})

export const mcCBBTC = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", 1],
    ["0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", 8453],
    ["0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", 42161]
  ]
})

export const mcGRT = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0xc944E90C64B2c07662A292be6244BDf05Cda44a7", 1],
    ["0x5fe2B58c013d7601147DcdD68C143A77499f5531", 137],
    ["0x771513bA693D457Df3678c951c448701f2eAAad5", 39797],
    ["0x9623063377AD1B27544C965cCd7342f7EA7e88C7", 42161],
    ["0x8a0cAc13c7da965a312f08ea4229c37869e85cB9", 43114],
    ["0x002FA662F2E09de7C306d2BaB0085EE9509488Ff", 1666600000]
  ]
})

export const mcWLD = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x163f8C2467924be0ae7B5347228CABF260318753", 1],
    ["0xdC6fF44d5d932Cbd77B52E5612Ba0529DC6226F1", 10],
    ["0x2cFc85d8E48F8EAB294be644d9E25C3030863003", 480]
  ]
})

export const mcUSD0 = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x73A15FeD60Bf67631dC6cd7Bc5B6e8da8190aCF5", 1],
    ["0x35f1C5cB7Fb977E669fD244C567Da99d8a3a6850", 42161]
  ]
})

export const mcFDUSD = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0xc5f0f7b66764F6ec8C8Dff7BA683102295E16409", 1],
    ["0xc5f0f7b66764F6ec8C8Dff7BA683102295E16409", 56]
  ]
})

export const mcRETH = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0xae78736Cd615f374D3085123A210448E74Fc6393", 1],
    ["0x9Bcef72be871e61ED4fBbc7630889beE758eb81D", 10],
    ["0x0266F4F08D82372CF0FcbCCc0Ff74309089c74d1", 137],
    ["0xB6fe221Fe9EeF5aBa221c348bA20A1Bf5e73624c", 8453],
    ["0xEC70Dcb4A1EFa46b8F2D97C310C9c4790ba5ffA8", 42161]
  ]
})

export const mcFLOKI = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0xcf0C122c6b73ff809C693DB761e7BaeBe62b6a2E", 1],
    ["0xfb5B838b6cfEEdC2873aB27866079AC55363D37E", 56]
  ]
})

export const mcLBTC = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x8236a87084f8B84306f72007F36F2618A5634494", 1],
    ["0xecAc9C5F704e954931349Da37F60E39f515c11c1", 56],
    ["0xecAc9C5F704e954931349Da37F60E39f515c11c1", 8453]
  ]
})

export const mcLDO = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32", 1],
    ["0xFdb794692724153d1488CcdBE0C56c252596735F", 10],
    ["0xC3C7d422809852031b44ab29EEC9F1EfF2A58756", 137],
    ["0x13Ad51ed4F1B7e9Dc168d8a00cB3f4dDD85EfA60", 42161]
  ]
})

export const mcMETH = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0xd5F7838F5C461fefF7FE49ea5ebaF7728bB0ADfa", 1],
    ["0xcDA86A272531e8640cD7F1a92c01839911B90bb0", 5000]
  ]
})

export const mcQNT = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x4a220E6096B25EADb88358cb44068A3248254675", 1],
    ["0x462B35452E552A66B519EcF70aEdb1835d434965", 39797]
  ]
})

export const mcSAND = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x3845badAde8e6dFF049820680d1F14bD3903a5d0", 1],
    ["0xBbba073C31bF03b8ACf7c28EF0738DeCF3695683", 137],
    ["0x73a4AC88c12D66AD08c1cfC891bF47883919ba74", 39797],
    ["0x35de8649e1e4Fd1A7Bd3B14F7e24e5e7887174Ed", 1666600000]
  ]
})

export const mcSPX = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0xE0f63A424a4439cBE457D80E4f4b51aD25b2c56C", 1],
    ["0x50dA645f148798F68EF2d7dB7C1CB22A6819bb2C", 8453]
  ]
})

export const mcNEXO = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0xB62132e35a6c13ee1EE0f84dC5d40bad8d815206", 1],
    ["0x41b3966B4FF7b427969ddf5da3627d6AEAE9a48E", 137],
    ["0x7C598c96D02398d89FbCb9d41Eab3DF0C16F227D", 250],
    ["0x04640Dc771eDd73cbeB934FB5461674830BAea11", 39797]
  ]
})

export const mcSOLVBTC = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x7A56E1C57C7475CCf742a1832B028F0456652F97", 1],
    ["0x4aae823a6a0b376De6A78e74eCC5b079d38cBCf7", 56],
    ["0x41D9036454BE47d3745A823C4aaCD0e29cFB0f71", 4200],
    ["0xa68d25fC2AF7278db4BcdcAabce31814252642a9", 5000],
    ["0x3B86Ad95859b6AB773f55f8d94B4b9d443EE931f", 8453],
    ["0x3647c54c4c2C65bC7a2D63c0Da2809B399DBBDC0", 42161],
    ["0xbc78D84Ba0c46dFe32cf2895a19939c86b81a777", 43114],
    ["0xbEAf16cFD8eFe0FC97C2a07E349B9411F5dC272C", 810180]
  ]
})

export const mcMKR = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2", 1],
    ["0x6f7C932e7684666C9fd1d44527765433e01fF61d", 137],
    ["0x050317d93f29D1bA5FF3EaC3b8157fD4E345588D", 39797],
    ["0x88128fd4b259552A9A1D457f435a6527AAb72d42", 43114]
  ]
})

export const mcBEAM = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x62D0A8458eD7719FDAF978fe5929C6D342B0bFcE", 1],
    ["0x62D0A8458eD7719FDAF978fe5929C6D342B0bFcE", 56],
    ["0x62D0A8458eD7719FDAF978fe5929C6D342B0bFcE", 43114]
  ]
})

export const mcAIOZ = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x626E8036dEB333b408Be468F951bdB42433cBF18", 1],
    ["0x33d08D8C7a168333a85285a68C0042b39fC3741D", 56]
  ]
})

export const mcBTT = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0xC669928185DbCE49d2230CC9B0979BE6DC797957", 1],
    ["0x352Cb5E19b12FC216548a2677bD0fce83BaE434B", 56],
    ["0x0000000000000000000000000000000000001010", 199],
    ["0xF1BdCF2D4163adF9554111439dAbdD6f18fF9BA7", 39797]
  ]
})

export const mcCRV = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0xD533a949740bb3306d119CC777fa900bA034cd52", 1],
    ["0x0994206dfE8De6Ec6920FF4D779B0d950605Fb53", 10],
    ["0x172370d5Cd63279eFa6d502DAB29171933a610AF", 137],
    ["0x1E4F97b9f9F913c46F1632781732927B9019C68b", 250],
    ["0xd3319EAF3c4743ac75AaCE77befCFA445Ed6E69E", 39797],
    ["0x11cDb42B0EB46D95f990BeDD4695A6e3fA034978", 42161]
  ]
})

export const mcSUSDS = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD", 1],
    ["0x5875eEE11Cf8398102FdAd704C9E96607675467a", 8453]
  ]
})

export const mcAXS = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0xBB0E17EF65F82Ab018d8EDd776e8DD940327B28b", 1],
    ["0x715D400F88C167884bbCc41C5FeA407ed4D2f8A0", 56],
    ["0x97a9107C1793BC407d6F527b77e7fff4D812bece", 2020],
    ["0x7CD3D51beE45434Dd80822c5D58b999333b69FfB", 39797],
    ["0x14A7B318fED66FfDcc80C1517C172c13852865De", 1666600000]
  ]
})

export const mcSOLVBTC_BBN = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0xd9D920AA40f578ab794426F5C90F6C731D159DEf", 1],
    ["0x1346b618dC92810EC74163e4c27004c921D446a5", 56],
    ["0x1760900aCA15B90Fa2ECa70CE4b4EC441c2CF6c5", 4200],
    ["0x1d40baFC49c37CdA49F2a5427E2FB95E1e3FCf20", 5000],
    ["0xC26C9099BD3789107888c35bb41178079B282561", 8453],
    ["0x346c574C56e1A4aAa8dc88Cda8F7EB12b39947aB", 42161],
    ["0xCC0966D8418d412c599A6421b760a847eB169A8c", 43114]
  ]
})

export const mcMANA = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x0F5D2fB29fb7d3CFeE444a200298f468908cC942", 1],
    ["0xA1c57f48F0Deb89f569dFbE6E2B7f46D33606fD4", 137]
  ]
})

export const mcDEXE = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0xde4EE8057785A7e8e800Db58F9784845A5C2Cbd6", 1],
    ["0x6E88056E8376Ae7709496Ba64d37fa2f8015ce3e", 56]
  ]
})

export const mcMATIC = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0", 1],
    ["0xCC42724C6683B7E57334c4E856f4c9965ED682bD", 56],
    ["0x3405A1bd46B85c5C029483FbECf2F3E611026e45", 1284],
    ["0x682F81e57EAa716504090C3ECBa8595fB54561D8", 1285],
    ["0x98997E1651919fAeacEe7B96aFbB3DfD96cb6036", 39797],
    ["0x301259f392B551CA8c592C9f676FCD2f9A0A84C5", 1666600000]
  ]
})

export const mcMOG = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0xaaeE1A9723aaDB7afA2810263653A34bA2C21C7a", 1],
    ["0x2Da56AcB9Ea78330f947bD57C54119Debda7AF71", 8453]
  ]
})

export const mcAPE = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x4d224452801ACEd8B2F0aebE155379bb5D594381", 1],
    ["0xB7b31a6BC18e48888545CE79e83E06003bE70930", 137]
  ]
})

export const mcRSR = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x320623b8E4fF03373931769A31Fc52A4E78B5d70", 1],
    ["0xaB36452DbAC151bE02b16Ca17d8919826072f64a", 8453],
    ["0xfcE13BB63B60f6e20ed846ae73ed242D29129800", 39797],
    ["0xCa5Ca9083702c56b481D1eec86F1776FDbd2e594", 42161]
  ]
})

export const mcUSDD = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x0C10bF8FcB7Bf5412187A595ab97a3609160b5c6", 1],
    ["0xd17479997F34dd9156Deef8F95A52D81D265be9c", 56],
    ["0x17F235FD5974318E4E2a5e37919a209f7c37A6d1", 199],
    ["0x680447595e8b7b3Aa1B43beB9f6098C79ac2Ab3f", 42161],
    ["0xB514CABD09eF5B169eD3fe0FA8DBd590741E81C2", 43114]
  ]
})

export const mcPRIME = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0xb23d80f5FefcDDaa212212F028021B41DEd428CF", 1],
    ["0xfA980cEd6895AC314E7dE34Ef1bFAE90a5AdD21b", 8453]
  ]
})

export const mcW = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0xB0fFa8000886e57F86dd5264b9582b2Ad87b2b91", 1],
    ["0xB0fFa8000886e57F86dd5264b9582b2Ad87b2b91", 8453],
    ["0xB0fFa8000886e57F86dd5264b9582b2Ad87b2b91", 42161]
  ]
})

export const mcPENDLE = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x808507121B80c02388fAd14726482e061B8da827", 1],
    ["0xBC7B1Ff1c6989f006a1185318eD4E7b5796e66E1", 10],
    ["0xb3Ed0A426155B79B898849803E3B36552f7ED507", 56],
    ["0xA99F6e6785Da0F5d6fB42495Fe424BCE029Eeb3E", 8453],
    ["0x0c880f6761F1af8d9Aa9C466984b80DAb9a8c9e8", 42161]
  ]
})

export const mcCAKE = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x152649eA73beAb28c5b49B26eb48f7EAD6d4c898", 1],
    ["0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", 56],
    ["0x2779106e4F4A8A28d77A24c18283651a2AE22D1C", 204],
    ["0x3A287a06c66f9E95a56327185cA2BDF5f031cEcD", 324],
    ["0x0D1E753a25eBda689453309112904807625bEFBe", 1101],
    ["0x3055913c90Fcc1A6CE9a358911721eEb942013A1", 8453],
    ["0x1b896893dfc86bb67Cf57767298b9073D2c1bA2c", 42161],
    ["0x0D1E753a25eBda689453309112904807625bEFBe", 59144]
  ]
})

export const mcGNO = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x6810e776880C02933D47DB1b9fc05908e5386b96", 1],
    ["0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb", 100],
    ["0xF452bff8e958C6F335F06fC3aAc427Ee195366fE", 39797],
    ["0xa0b862F60edEf4452F25B4160F177db44DeB6Cf1", 42161]
  ]
})

export const mcCMETH = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0xE6829d9a7eE3040e1276Fa75293Bde931859e8fA", 1],
    ["0xE6829d9a7eE3040e1276Fa75293Bde931859e8fA", 5000]
  ]
})

export const mcFRAX = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x853d955aCEf822Db058eb8505911ED77F175b99e", 1],
    ["0x2E3D870790dC77A83DD1d18184Acc7439A53f475", 10],
    ["0x90C97F71E18723b0Cf0dfa30ee176Ab653E89F40", 56],
    ["0x45c32fA6DF82ead1e2EF74d17b76547EDdFaFF89", 137],
    ["0xdc301622e621166BD8E82f2cA0A26c13Ad0BE355", 250],
    ["0x7562F525106F5d54E891e005867Bf489B5988CD9", 288],
    ["0xFf8544feD5379D9ffa8D47a74cE6b91e632AC44D", 1101],
    ["0x322E86852e492a7Ee17f28a78c663da38FB33bfb", 1284],
    ["0x1A93B23281CC1CDE4C4741353F3064709A16197d", 1285],
    ["0x80Eede496655FB9047dd39d9f418d5483ED600df", 1329],
    ["0xE03494D0033687543a80c9B1ca7D6237F2EA8BD8", 9001],
    ["0x17FC002b466eEc40DaE837Fc4bE5c67993ddBd6F", 42161],
    ["0xD24C2Ad096400B6FBcd2ad8B24E7acBc21A1da64", 43114],
    ["0xE4B9e004389d91e4134a28F19BD833cBA1d994B6", 1313161554],
    ["0xFa7191D292d5633f702B0bd7E3E3BcCC0e633200", 1666600000]
  ]
})

export const mcCOMP = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0xc00e94Cb662C3520282E6f5717214004A7f26888", 1],
    ["0x52CE071Bd9b1C4B00A0b92D298c512478CaD67e8", 56],
    ["0x8505b9d2254A7Ae468c0E9dd10Ccea3A837aef5c", 137],
    ["0x9e1028F5F1D5eDE59748FFceE5532509976840E0", 8453],
    ["0x66bC411714e16B6F0C68be12bD9c666cc4576063", 39797],
    ["0x354A6dA3fcde098F8389cad84b0182725c6C91dE", 42161],
    ["0xc3048E19E76CB9a3Aa9d77D8C03c29Fc906e2437", 43114],
    ["0x32137b9275EA35162812883582623cd6f6950958", 1666600000]
  ]
})

export const mcSNX = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F", 1],
    ["0x8700dAec35aF8Ff88c16BdF0418774CB3D7599B4", 10],
    ["0x777850281719d5a96C29812ab72f822E0e09F3Da", 128],
    ["0x50B728D8D964fd00C2d0AAD81718b71311feF68a", 137],
    ["0x56ee926bD8c72B2d5fa1aF4d9E4Cbb515a1E3Adc", 250],
    ["0x22e6966B799c4D5B13BE962E1D117b56327FDa66", 8453],
    ["0xa255461fF545d6ecE153283f421D67D2DE5D0E29", 39797],
    ["0xBeC243C995409E6520D7C41E404da5dEba4b209B", 43114],
    ["0x7b9c523d59AeFd362247Bd5601A89722e3774dD2", 1666600000]
  ]
})

export const mcAMP = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0xfF20817765cB7f73d4bde2e66e067E58D11095C2", 1],
    ["0xAD7ABE6f12F1059bDf48aE67bfF92B00438ceD95", 39797]
  ]
})

export const mcUSDX = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0xf3527ef8dE265eAa3716FB312c12847bFBA66Cef", 1],
    ["0xf3527ef8dE265eAa3716FB312c12847bFBA66Cef", 56],
    ["0xf3527ef8dE265eAa3716FB312c12847bFBA66Cef", 42161]
  ]
})

export const mcSUPER = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0xe53EC727dbDEB9E2d5456c3be40cFF031AB40A55", 1],
    ["0xa1428174F516F527fafdD146b883bB4428682737", 137]
  ]
})

export const mcAXL = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x467719aD09025FcC6cF6F8311755809d45a5E5f3", 1],
    ["0x23ee2343B892b1BB63503a4FAbc840E0e2C6810f", 10],
    ["0x8b1f4432F943c465A973FeDC6d7aa50Fc96f1f65", 56],
    ["0x6e4E624106Cb12E168E6533F8ec7c82263358940", 137],
    ["0x8b1f4432F943c465A973FeDC6d7aa50Fc96f1f65", 250],
    ["0x467719aD09025FcC6cF6F8311755809d45a5E5f3", 1284],
    ["0x23ee2343B892b1BB63503a4FAbc840E0e2C6810f", 8453],
    ["0x23ee2343B892b1BB63503a4FAbc840E0e2C6810f", 42161],
    ["0x44c784266cf024a60e8acF2427b9857Ace194C5d", 43114]
  ]
})

export const mcCBETH = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0xBe9895146f7AF43049ca1c1AE358B0541Ea49704", 1],
    ["0xadDb6A0412DE1BA0F936DCaeb8Aaa24578dcF3B2", 10],
    ["0x4b4327dB1600B8B1440163F667e199CEf35385f5", 137],
    ["0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22", 8453],
    ["0x1DEBd73E752bEaF79865Fd6446b0c970EaE7732f", 42161]
  ]
})

export const mcZRO = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x6985884C4392D348587B19cb9eAAf157F13271cd", 1],
    ["0x6985884C4392D348587B19cb9eAAf157F13271cd", 10],
    ["0x6985884C4392D348587B19cb9eAAf157F13271cd", 56],
    ["0x6985884C4392D348587B19cb9eAAf157F13271cd", 137],
    ["0x6985884C4392D348587B19cb9eAAf157F13271cd", 8453],
    ["0x6985884C4392D348587B19cb9eAAf157F13271cd", 42161],
    ["0x6985884C4392D348587B19cb9eAAf157F13271cd", 43114]
  ]
})

export const mc_1INCH = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x111111111117dC0aa78b770fA6A738034120C302", 1],
    ["0x111111111117dC0aa78b770fA6A738034120C302", 56],
    ["0x9c2C5fd7b07E95EE044DDeba0E97a665F142394f", 137],
    ["0xDDa6205Dc3f47e5280Eb726613B27374Eee9D130", 39797],
    ["0xd501281565bf7789224523144Fe5D98e8B28f267", 43114],
    ["0x58f1b044d8308812881a1433d9Bbeff99975e70C", 1666600000]
  ]
})

export const mcMORPHO = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x58D97B57BB95320F9a05dC918Aef65434969c2B2", 1],
    ["0xBAa5CC21fd487B8Fcc2F632f3F4E8D37262a0842", 8453]
  ]
})

export const mcLPT = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x58b6A8A3302369DAEc383334672404Ee733aB239", 1],
    ["0x289ba1701C2F088cf0faf8B3705246331cB8A839", 42161],
    ["0xBD3E698b51D340Cc53B0CC549b598c13e0172B7c", 1666600000]
  ]
})
