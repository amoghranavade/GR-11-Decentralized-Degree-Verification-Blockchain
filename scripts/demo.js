const { ethers } = require("hardhat");

function findEvent(receipt, contract, eventName) {
  for (const log of receipt.logs) {
    try {
      const event = contract.interface.parseLog(log);
      if (event?.name === eventName) {
        return event;
      }
    } catch {}
  }
  throw new Error(`${eventName} event not found`);
}

function requireValue(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const [admin, university, student, employer, unauthorizedIssuer] = await ethers.getSigners();

  console.log("\nDecentralized Degree Verification - Interim Demo\n");

  const accessControl = await ethers.deployContract("IssuerAccessControl", [admin.address]);
  const didRegistry = await ethers.deployContract("DIDRegistry");
  const auditLog = await ethers.deployContract("VerificationLog");
  const credentialStatus = await ethers.deployContract("CredentialStatus", [
    await accessControl.getAddress(),
    await didRegistry.getAddress(),
    await auditLog.getAddress(),
  ]);
  await auditLog.setWriter(await credentialStatus.getAddress());
  console.log("[1/7] Contracts deployed and linked");

  await accessControl.addIssuer(university.address);
  requireValue(await accessControl.isIssuer(university.address), "University approval failed");
  console.log("[2/7] Administrator approved university");

  const documentHash = ethers.id("group-11-student-did-document");
  await didRegistry
    .connect(student)
    .registerDID(documentHash, "ipfs://group-11-student-did-document");
  requireValue(await didRegistry.isActive(student.address), "Student DID registration failed");
  console.log("[3/7] Student registered an active DID");

  const credentialHash = ethers.id("group-11-degree-credential-001");
  await credentialStatus.connect(university).issueCredential(credentialHash, student.address);
  const validBeforeRevocation = await credentialStatus.isValid(credentialHash);
  requireValue(validBeforeRevocation, "Issued credential should be valid");
  console.log("[4/7] University issued credential");
  console.log(`      Credential valid: ${validBeforeRevocation}`);

  const verificationTransaction = await credentialStatus
    .connect(employer)
    .verifyAndLog(credentialHash);
  const verificationReceipt = await verificationTransaction.wait();
  const verificationEvent = findEvent(verificationReceipt, auditLog, "CredentialVerified");
  requireValue(verificationEvent.args.valid, "Verification event should report a valid credential");
  console.log("[5/7] Employer verified credential");
  console.log(`      Verification event: ${verificationEvent.args.valid}`);

  let unauthorizedBlocked = false;
  try {
    const transaction = await credentialStatus
      .connect(unauthorizedIssuer)
      .issueCredential(ethers.id("unauthorized-credential"), student.address);
    await transaction.wait();
  } catch {
    unauthorizedBlocked = true;
  }
  requireValue(unauthorizedBlocked, "Unauthorized issuer was not blocked");
  console.log("[6/7] Unauthorized issuance blocked");

  await credentialStatus.connect(university).revokeCredential(credentialHash);
  const validAfterRevocation = await credentialStatus.isValid(credentialHash);
  requireValue(!validAfterRevocation, "Revoked credential should be invalid");

  const revokedVerificationTransaction = await credentialStatus
    .connect(employer)
    .verifyAndLog(credentialHash);
  const revokedVerificationReceipt = await revokedVerificationTransaction.wait();
  const revokedVerificationEvent = findEvent(
    revokedVerificationReceipt,
    auditLog,
    "CredentialVerified"
  );
  requireValue(
    !revokedVerificationEvent.args.valid,
    "Verification event should report a revoked credential"
  );
  console.log("[7/7] University revoked credential");
  console.log(`      Credential valid after revocation: ${validAfterRevocation}`);
  console.log(`      Verification event after revocation: ${revokedVerificationEvent.args.valid}`);
  console.log("\nDemo completed successfully\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
