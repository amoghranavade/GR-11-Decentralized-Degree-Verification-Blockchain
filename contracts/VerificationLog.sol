// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IVerificationLog} from "./interfaces/IVerificationLog.sol";

/// @title VerificationLog
/// @notice Only the CredentialStatus contract can write here, so every entry matches a real
/// on-chain action and nobody can add fake records.
contract VerificationLog is IVerificationLog {
    address public immutable admin;
    address public writer;

    modifier onlyWriter() {
        require(msg.sender == writer, "Not authorized");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    // Called once after deployment to link the CredentialStatus contract.
    function setWriter(address newWriter) external {
        require(msg.sender == admin, "Only admin");
        require(writer == address(0), "Writer already set");
        writer = newWriter;
    }

    function logIssued(bytes32 credentialHash, address issuer, address holder) external onlyWriter {
        emit CredentialIssued(credentialHash, issuer, holder, block.timestamp);
    }

    function logRevoked(bytes32 credentialHash, address issuer) external onlyWriter {
        emit CredentialRevoked(credentialHash, issuer, block.timestamp);
    }

    function logVerification(bytes32 credentialHash, address verifier, bool valid) external onlyWriter {
        emit CredentialVerified(credentialHash, verifier, valid, block.timestamp);
    }
}
