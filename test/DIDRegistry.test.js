const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deploySystem, registerStudent } = require("./helpers/deploySystem");

describe("DIDRegistry", function () {
  it("registers a student DID", async function () {
    const { didRegistry, student } = await loadFixture(deploySystem);
    const { documentHash, documentURI } = await registerStudent(didRegistry, student);
    const record = await didRegistry.getDID(student.address);

    expect(record.controller).to.equal(student.address);
    expect(record.documentHash).to.equal(documentHash);
    expect(record.documentURI).to.equal(documentURI);
    expect(record.active).to.equal(true);
  });

  it("rejects duplicate registration", async function () {
    const { didRegistry, student } = await loadFixture(deploySystem);
    await registerStudent(didRegistry, student);

    await expect(
      didRegistry
        .connect(student)
        .registerDID(ethers.id("replacement document"), "ipfs://replacement-document")
    ).to.be.revertedWith("DID already registered");
  });

  it("allows only the controller to update the DID document", async function () {
    const { didRegistry, student, outsider } = await loadFixture(deploySystem);
    await registerStudent(didRegistry, student);

    await expect(
      didRegistry
        .connect(outsider)
        .updateDocument(student.address, ethers.id("unauthorized"), "ipfs://unauthorized")
    ).to.be.revertedWith("Not the DID controller");

    const newHash = ethers.id("updated document");
    await didRegistry
      .connect(student)
      .updateDocument(student.address, newHash, "ipfs://updated-document");
    expect((await didRegistry.getDID(student.address)).documentHash).to.equal(newHash);
  });

  it("rotates control to a new key", async function () {
    const { didRegistry, student, outsider } = await loadFixture(deploySystem);
    await registerStudent(didRegistry, student);

    await didRegistry.connect(student).changeController(student.address, outsider.address);
    await expect(
      didRegistry
        .connect(student)
        .updateDocument(student.address, ethers.id("old key"), "ipfs://old-key")
    ).to.be.revertedWith("Not the DID controller");

    await didRegistry
      .connect(outsider)
      .updateDocument(student.address, ethers.id("new key"), "ipfs://new-key");
    expect((await didRegistry.getDID(student.address)).controller).to.equal(outsider.address);
  });

  it("permanently deactivates a DID", async function () {
    const { didRegistry, student } = await loadFixture(deploySystem);
    await registerStudent(didRegistry, student);

    await didRegistry.connect(student).deactivateDID(student.address);
    expect(await didRegistry.isActive(student.address)).to.equal(false);
    await expect(
      didRegistry
        .connect(student)
        .registerDID(ethers.id("second registration"), "ipfs://second-registration")
    ).to.be.revertedWith("DID already registered");
  });
});
