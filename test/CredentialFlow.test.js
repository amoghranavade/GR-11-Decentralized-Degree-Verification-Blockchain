const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deploySystem, registerStudent } = require("./helpers/deploySystem");

describe("Credential flow", function () {
  async function deployReadySystem() {
    const system = await deploySystem();
    const { accessControl, didRegistry, university, student } = system;
    await accessControl.addIssuer(university.address);
    await registerStudent(didRegistry, student);
    return system;
  }

  it("issues, verifies and revokes a credential", async function () {
    const { credentialStatus, auditLog, university, student, employer } =
      await loadFixture(deployReadySystem);
    const credentialHash = ethers.id("signed degree credential");

    await expect(
      credentialStatus.connect(university).issueCredential(credentialHash, student.address)
    )
      .to.emit(auditLog, "CredentialIssued")
      .withArgs(credentialHash, university.address, student.address, anyValue);
    expect(await credentialStatus.isValid(credentialHash)).to.equal(true);

    await expect(credentialStatus.connect(university).revokeCredential(credentialHash))
      .to.emit(auditLog, "CredentialRevoked")
      .withArgs(credentialHash, university.address, anyValue);
    expect(await credentialStatus.isRevoked(credentialHash)).to.equal(true);
    expect(await credentialStatus.isValid(credentialHash)).to.equal(false);

    await expect(credentialStatus.connect(employer).verifyAndLog(credentialHash))
      .to.emit(auditLog, "CredentialVerified")
      .withArgs(credentialHash, employer.address, false, anyValue);
  });

  it("blocks accounts that are not approved issuers", async function () {
    const { credentialStatus, student } = await loadFixture(deployReadySystem);

    await expect(
      credentialStatus.connect(student).issueCredential(ethers.id("fake degree"), student.address)
    ).to.be.revertedWith("Not an approved issuer");
  });
});
