const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Credential flow", function () {
  async function deployAll() {
    const [admin, university, student, employer] = await ethers.getSigners();

    const accessControl = await ethers.deployContract("IssuerAccessControl", [admin.address]);
    const didRegistry = await ethers.deployContract("DIDRegistry");
    const auditLog = await ethers.deployContract("VerificationLog");
    const credentialStatus = await ethers.deployContract("CredentialStatus", [
      await accessControl.getAddress(),
      await didRegistry.getAddress(),
      await auditLog.getAddress(),
    ]);

    await auditLog.setWriter(await credentialStatus.getAddress());
    await accessControl.addIssuer(university.address);
    await didRegistry
      .connect(student)
      .registerDID(ethers.id("student DID document"), "ipfs://student-did-document");

    return { credentialStatus, auditLog, university, student, employer };
  }

  it("issues, verifies and revokes a credential", async function () {
    const { credentialStatus, auditLog, university, student, employer } = await deployAll();
    const credentialHash = ethers.id("signed degree credential");

    await credentialStatus.connect(university).issueCredential(credentialHash, student.address);
    expect(await credentialStatus.isValid(credentialHash)).to.equal(true);

    await credentialStatus.connect(university).revokeCredential(credentialHash);
    expect(await credentialStatus.isRevoked(credentialHash)).to.equal(true);
    expect(await credentialStatus.isValid(credentialHash)).to.equal(false);

    await expect(credentialStatus.connect(employer).verifyAndLog(credentialHash))
      .to.emit(auditLog, "CredentialVerified");
  });

  it("blocks accounts that are not approved issuers", async function () {
    const { credentialStatus, student } = await deployAll();

    await expect(
      credentialStatus.connect(student).issueCredential(ethers.id("fake degree"), student.address)
    ).to.be.revertedWith("Not an approved issuer");
  });
});
