const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("VerificationLog", function () {
  async function deployLog() {
    const [admin, writer, outsider, issuer, holder] = await ethers.getSigners();
    const auditLog = await ethers.deployContract("VerificationLog");
    await auditLog.waitForDeployment();
    return { auditLog, admin, writer, outsider, issuer, holder };
  }

  it("allows only the deployment administrator to configure the writer", async function () {
    const { auditLog, writer, outsider } = await loadFixture(deployLog);

    await expect(auditLog.connect(outsider).setWriter(writer.address)).to.be.revertedWith(
      "Only admin"
    );
    await auditLog.setWriter(writer.address);
    expect(await auditLog.writer()).to.equal(writer.address);
  });

  it("configures the writer only once", async function () {
    const { auditLog, writer, outsider } = await loadFixture(deployLog);
    await auditLog.setWriter(writer.address);

    await expect(auditLog.setWriter(outsider.address)).to.be.revertedWith("Writer already set");
  });

  it("rejects log entries from an unauthorized account", async function () {
    const { auditLog, writer, outsider, issuer, holder } = await loadFixture(deployLog);
    await auditLog.setWriter(writer.address);

    await expect(
      auditLog
        .connect(outsider)
        .logIssued(ethers.id("unauthorized log"), issuer.address, holder.address)
    ).to.be.revertedWith("Not authorized");
  });

  it("accepts log entries from the configured writer", async function () {
    const { auditLog, writer, issuer, holder } = await loadFixture(deployLog);
    const credentialHash = ethers.id("authorized log");
    await auditLog.setWriter(writer.address);

    await expect(auditLog.connect(writer).logIssued(credentialHash, issuer.address, holder.address))
      .to.emit(auditLog, "CredentialIssued");
  });
});
