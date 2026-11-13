const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deploySystem } = require("./helpers/deploySystem");

describe("IssuerAccessControl", function () {
  it("lets the administrator add and remove an issuer", async function () {
    const { accessControl, university } = await loadFixture(deploySystem);

    await accessControl.addIssuer(university.address);
    expect(await accessControl.isIssuer(university.address)).to.equal(true);

    await accessControl.removeIssuer(university.address);
    expect(await accessControl.isIssuer(university.address)).to.equal(false);
  });

  it("rejects issuer changes from a non-administrator", async function () {
    const { accessControl, university, outsider } = await loadFixture(deploySystem);

    await expect(accessControl.connect(outsider).addIssuer(university.address)).to.be.reverted;
    expect(await accessControl.isIssuer(university.address)).to.equal(false);
  });
});
