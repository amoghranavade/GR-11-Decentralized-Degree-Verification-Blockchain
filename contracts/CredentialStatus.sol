// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ICredentialStatus} from "./interfaces/ICredentialStatus.sol";
import {IIssuerAccessControl} from "./interfaces/IIssuerAccessControl.sol";
import {IDIDRegistry} from "./interfaces/IDIDRegistry.sol";
import {IVerificationLog} from "./interfaces/IVerificationLog.sol";

/// @title CredentialStatus
/// @notice Universities anchor the hash of each signed credential here and can revoke it later.
/// The credential itself (name, degree, grades) never goes on-chain.
contract CredentialStatus is ICredentialStatus {
    IIssuerAccessControl public immutable accessControl;
    IDIDRegistry public immutable didRegistry;
    IVerificationLog public immutable auditLog;

    mapping(bytes32 => Credential) private _credentials;

    // issuer => word index => 256 revocation bits
    mapping(address => mapping(uint256 => uint256)) private _revocationBits;
    mapping(address => uint256) public nextStatusIndex;

    constructor(address accessControl_, address didRegistry_, address auditLog_) {
        accessControl = IIssuerAccessControl(accessControl_);
        didRegistry = IDIDRegistry(didRegistry_);
        auditLog = IVerificationLog(auditLog_);
    }

    function issueCredential(bytes32 credentialHash, address holder) external returns (uint256 statusIndex) {
        require(accessControl.isIssuer(msg.sender), "Not an approved issuer");
        require(didRegistry.isActive(holder), "Holder has no active DID");
        require(_credentials[credentialHash].issuer == address(0), "Credential already exists");

        statusIndex = nextStatusIndex[msg.sender]++;
        _credentials[credentialHash] = Credential(msg.sender, holder, uint64(block.timestamp), statusIndex);
        auditLog.logIssued(credentialHash, msg.sender, holder);
    }

    function revokeCredential(bytes32 credentialHash) external {
        Credential storage cred = _credentials[credentialHash];
        require(cred.issuer == msg.sender, "Only the issuer can revoke");
        require(!_isRevoked(cred), "Already revoked");

        _revocationBits[cred.issuer][cred.statusIndex / 256] |= (1 << (cred.statusIndex % 256));
        auditLog.logRevoked(credentialHash, msg.sender);
    }

    function verifyAndLog(bytes32 credentialHash) external returns (bool valid) {
        valid = isValid(credentialHash);
        auditLog.logVerification(credentialHash, msg.sender, valid);
    }

    function isRevoked(bytes32 credentialHash) external view returns (bool) {
        return _isRevoked(_credentials[credentialHash]);
    }

    function isValid(bytes32 credentialHash) public view returns (bool) {
        Credential storage cred = _credentials[credentialHash];
        return cred.issuer != address(0) && !_isRevoked(cred);
    }

    function getCredential(bytes32 credentialHash) external view returns (Credential memory) {
        return _credentials[credentialHash];
    }

    function _isRevoked(Credential storage cred) private view returns (bool) {
        uint256 word = _revocationBits[cred.issuer][cred.statusIndex / 256];
        return (word & (1 << (cred.statusIndex % 256))) != 0;
    }
}
