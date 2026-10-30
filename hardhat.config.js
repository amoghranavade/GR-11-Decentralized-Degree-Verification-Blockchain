require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const { AMOY_RPC_URL, PRIVATE_KEY } = process.env;

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    amoy: {
      url: AMOY_RPC_URL || "https://polygon-amoy.drpc.org",
      chainId: 80002,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
  gasReporter: { enabled: process.env.REPORT_GAS === "true" },
};
