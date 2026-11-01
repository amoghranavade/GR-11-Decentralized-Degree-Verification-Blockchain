const { ethers } = require("hardhat");

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

  // The log only accepts writes from CredentialStatus.
  await (await auditLog.setWriter(await credentialStatus.getAddress())).wait();

  console.table({
    IssuerAccessControl: await accessControl.getAddress(),
    DIDRegistry: await didRegistry.getAddress(),
    VerificationLog: await auditLog.getAddress(),
    CredentialStatus: await credentialStatus.getAddress(),
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
