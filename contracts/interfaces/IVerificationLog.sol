// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IVerificationLog
/// @notice Audit trail of issue, revoke and verify actions. Entries only contain hashes and
/// addresses, never personal data.
interface IVerificationLog {
    event CredentialIssued(bytes32 indexed credentialHash, address indexed issuer, address indexed holder, uint256 timestamp);
    event CredentialRevoked(bytes32 indexed credentialHash, address indexed issuer, uint256 timestamp);
    event CredentialVerified(bytes32 indexed credentialHash, address indexed verifier, bool valid, uint256 timestamp);

    function logIssued(bytes32 credentialHash, address issuer, address holder) external;

    function logRevoked(bytes32 credentialHash, address issuer) external;

    function logVerification(bytes32 credentialHash, address verifier, bool valid) external;
}
