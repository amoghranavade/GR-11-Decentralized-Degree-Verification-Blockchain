// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ICredentialStatus
/// @notice Anchors the hash of each signed credential and tracks revocation with one bit per
/// credential, based on the W3C Bitstring Status List idea.
interface ICredentialStatus {
    struct Credential {
        address issuer;
        address holder;
        uint64 issuedAt;
        uint256 statusIndex; // position of this credential in the issuer's revocation bitmap
    }

    /// Only an approved issuer can call this, and the holder must have an active DID.
    function issueCredential(bytes32 credentialHash, address holder) external returns (uint256 statusIndex);

    /// Only the university that issued the credential can revoke it.
    function revokeCredential(bytes32 credentialHash) external;

    /// Same check as isValid, but also records the verification in the audit log.
    function verifyAndLog(bytes32 credentialHash) external returns (bool valid);

    function isRevoked(bytes32 credentialHash) external view returns (bool);

    function isValid(bytes32 credentialHash) external view returns (bool);

    function getCredential(bytes32 credentialHash) external view returns (Credential memory);
}
