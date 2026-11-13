const { ethers } = require("hardhat");

async function deploySystem() {
  const [admin, university, student, employer, outsider, secondUniversity] =
    await ethers.getSigners();

  const accessControl = await ethers.deployContract("IssuerAccessControl", [admin.address]);
  const didRegistry = await ethers.deployContract("DIDRegistry");
  const auditLog = await ethers.deployContract("VerificationLog");
  const credentialStatus = await ethers.deployContract("CredentialStatus", [
    await accessControl.getAddress(),
    await didRegistry.getAddress(),
    await auditLog.getAddress(),
  ]);

  await Promise.all([
    accessControl.waitForDeployment(),
    didRegistry.waitForDeployment(),
    auditLog.waitForDeployment(),
    credentialStatus.waitForDeployment(),
  ]);
  await auditLog.setWriter(await credentialStatus.getAddress());

  return {
    accessControl,
    didRegistry,
    auditLog,
    credentialStatus,
    admin,
    university,
    student,
    employer,
    outsider,
    secondUniversity,
  };
}

async function registerStudent(didRegistry, student) {
  const documentHash = ethers.id("student DID document");
  const documentURI = "ipfs://student-did-document";
  await didRegistry.connect(student).registerDID(documentHash, documentURI);
  return { documentHash, documentURI };
}

module.exports = { deploySystem, registerStudent };
