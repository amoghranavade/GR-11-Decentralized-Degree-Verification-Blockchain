// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IDIDRegistry} from "./interfaces/IDIDRegistry.sol";

/// @title DIDRegistry
/// @notice Students register a DID and manage its keys. Only a reference to the DID document
/// and its hash are stored here, the document itself stays off-chain.
contract DIDRegistry is IDIDRegistry {
    mapping(address => DIDRecord) private _records;

    modifier onlyController(address identity) {
        require(_records[identity].active, "DID not active");
        require(_records[identity].controller == msg.sender, "Not the DID controller");
        _;
    }

    function registerDID(bytes32 documentHash, string calldata documentURI) external {
        require(_records[msg.sender].controller == address(0), "DID already registered");

        _records[msg.sender] = DIDRecord(msg.sender, documentHash, documentURI, uint64(block.timestamp), true);
        emit DIDRegistered(msg.sender, msg.sender, documentHash, documentURI);
    }

    function updateDocument(address identity, bytes32 newDocumentHash, string calldata newDocumentURI)
        external
        onlyController(identity)
    {
        DIDRecord storage record = _records[identity];
        record.documentHash = newDocumentHash;
        record.documentURI = newDocumentURI;
        record.updatedAt = uint64(block.timestamp);
        emit DIDDocumentUpdated(identity, newDocumentHash, newDocumentURI);
    }

    function changeController(address identity, address newController) external onlyController(identity) {
        require(newController != address(0), "Zero address");

        _records[identity].controller = newController;
        _records[identity].updatedAt = uint64(block.timestamp);
        emit DIDControllerChanged(identity, newController);
    }

    // Deactivation is permanent. The same address cannot register again.
    function deactivateDID(address identity) external onlyController(identity) {
        _records[identity].active = false;
        _records[identity].updatedAt = uint64(block.timestamp);
        emit DIDDeactivated(identity);
    }

    function getDID(address identity) external view returns (DIDRecord memory) {
        return _records[identity];
    }

    function isActive(address identity) external view returns (bool) {
        return _records[identity].active;
    }
}
