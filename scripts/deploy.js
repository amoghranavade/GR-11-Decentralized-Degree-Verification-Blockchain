const fs = require("node:fs/promises");
const path = require("node:path");
const hre = require("hardhat");

const { artifacts, ethers, network } = hre;

async function writeFrontendDeployment(contracts) {
  const providerNetwork = await ethers.provider.getNetwork();
  const deployment = {
    network: network.name,
    chainId: Number(providerNetwork.chainId),
    contracts: {},
  };

  for (const [name, contract] of Object.entries(contracts)) {
    const artifact = await artifacts.readArtifact(name);
    deployment.contracts[name] = {
      address: await contract.getAddress(),
      abi: artifact.abi,
    };
  }

  const outputPath = path.join(__dirname, "..", "frontend", "public", "deployment.json");
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(deployment, null, 2)}\n`);
  return outputPath;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const accessControl = await ethers.deployContract("IssuerAccessControl", [deployer.address]);
  await accessControl.waitForDeployment();

  const didRegistry = await ethers.deployContract("DIDRegistry");
  await didRegistry.waitForDeployment();

  const auditLog = await ethers.deployContract("VerificationLog");
  await auditLog.waitForDeployment();

  const credentialStatus = await ethers.deployContract("CredentialStatus", [
    await accessControl.getAddress(),
    await didRegistry.getAddress(),
    await auditLog.getAddress(),
  ]);
  await credentialStatus.waitForDeployment();

  await (await auditLog.setWriter(await credentialStatus.getAddress())).wait();

  const contracts = {
    IssuerAccessControl: accessControl,
    DIDRegistry: didRegistry,
    VerificationLog: auditLog,
    CredentialStatus: credentialStatus,
  };
  const addresses = Object.fromEntries(
    await Promise.all(
      Object.entries(contracts).map(async ([name, contract]) => [name, await contract.getAddress()])
    )
  );
  const outputPath = await writeFrontendDeployment(contracts);

  console.table(addresses);
  console.log(`Frontend deployment: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
