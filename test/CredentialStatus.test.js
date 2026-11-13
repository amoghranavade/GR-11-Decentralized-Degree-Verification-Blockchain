const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deploySystem, registerStudent } = require("./helpers/deploySystem");

describe("CredentialStatus", function () {
  async function deployReadySystem() {
    const system = await deploySystem();
    const { accessControl, didRegistry, university, student } = system;
    await accessControl.addIssuer(university.address);
    await registerStudent(didRegistry, student);
    return system;
  }

  it("issues a credential to a holder with an active DID", async function () {
    const { credentialStatus, auditLog, university, student } =
      await loadFixture(deployReadySystem);
    const credentialHash = ethers.id("credential-001");

    await expect(
      credentialStatus.connect(university).issueCredential(credentialHash, student.address)
    )
      .to.emit(auditLog, "CredentialIssued")
      .withArgs(credentialHash, university.address, student.address, anyValue);

    const credential = await credentialStatus.getCredential(credentialHash);
    expect(credential.issuer).to.equal(university.address);
    expect(credential.holder).to.equal(student.address);
    expect(await credentialStatus.isValid(credentialHash)).to.equal(true);
  });

  it("rejects an unapproved issuer", async function () {
    const { credentialStatus, student, outsider } = await loadFixture(deployReadySystem);

    await expect(
      credentialStatus
        .connect(outsider)
        .issueCredential(ethers.id("unauthorized credential"), student.address)
    ).to.be.revertedWith("Not an approved issuer");
  });

  it("rejects a holder without an active DID", async function () {
    const { credentialStatus, accessControl, university, outsider } =
      await loadFixture(deploySystem);
    await accessControl.addIssuer(university.address);

    await expect(
      credentialStatus
        .connect(university)
        .issueCredential(ethers.id("inactive holder"), outsider.address)
    ).to.be.revertedWith("Holder has no active DID");
  });

  it("rejects a duplicate credential hash", async function () {
    const { credentialStatus, university, student } = await loadFixture(deployReadySystem);
    const credentialHash = ethers.id("duplicate credential");
    await credentialStatus.connect(university).issueCredential(credentialHash, student.address);

    await expect(
      credentialStatus.connect(university).issueCredential(credentialHash, student.address)
    ).to.be.revertedWith("Credential already exists");
  });

  it("allows only the original issuer to revoke", async function () {
    const {
      credentialStatus,
      accessControl,
      university,
      secondUniversity,
      student,
    } = await loadFixture(deployReadySystem);
    const credentialHash = ethers.id("issuer controlled revocation");
    await accessControl.addIssuer(secondUniversity.address);
    await credentialStatus.connect(university).issueCredential(credentialHash, student.address);

    await expect(
      credentialStatus.connect(secondUniversity).revokeCredential(credentialHash)
    ).to.be.revertedWith("Only the issuer can revoke");
  });

  it("revokes a credential once and records the event", async function () {
    const { credentialStatus, auditLog, university, student } =
      await loadFixture(deployReadySystem);
    const credentialHash = ethers.id("revoked credential");
    await credentialStatus.connect(university).issueCredential(credentialHash, student.address);

    await expect(credentialStatus.connect(university).revokeCredential(credentialHash))
      .to.emit(auditLog, "CredentialRevoked")
      .withArgs(credentialHash, university.address, anyValue);
    expect(await credentialStatus.isValid(credentialHash)).to.equal(false);

    await expect(
      credentialStatus.connect(university).revokeCredential(credentialHash)
    ).to.be.revertedWith("Already revoked");
  });

  it("logs valid and revoked verification results", async function () {
    const { credentialStatus, auditLog, university, student, employer } =
      await loadFixture(deployReadySystem);
    const credentialHash = ethers.id("verified credential");
    await credentialStatus.connect(university).issueCredential(credentialHash, student.address);

    await expect(credentialStatus.connect(employer).verifyAndLog(credentialHash))
      .to.emit(auditLog, "CredentialVerified")
      .withArgs(credentialHash, employer.address, true, anyValue);

    await credentialStatus.connect(university).revokeCredential(credentialHash);
    await expect(credentialStatus.connect(employer).verifyAndLog(credentialHash))
      .to.emit(auditLog, "CredentialVerified")
      .withArgs(credentialHash, employer.address, false, anyValue);
  });
});
