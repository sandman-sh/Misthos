module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 5042002,
    },
    arcTestnet: {
      url: process.env.NEXT_PUBLIC_ARC_RPC_URL || "https://arc-node.thecanteenapp.com/",
      chainId: 5042002,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
};
