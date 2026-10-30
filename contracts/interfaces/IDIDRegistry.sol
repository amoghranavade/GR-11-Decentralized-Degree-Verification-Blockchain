// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IDIDRegistry
/// @notice Registry of decentralized identifiers (DIDs). A DID here is simply the holder's
/// Ethereum address, similar to ERC-1056 (did:ethr). The DID document (public keys and
/// service endpoints) lives off-chain on IPFS. The registry stores a reference to it and its hash.
interface IDIDRegistry {
    struct DIDRecord {
        address controller; // key currently allowed to manage the DID
        bytes32 documentHash; // hash of the DID document, to detect tampering
        string documentURI; // where the DID document is stored, e.g. ipfs://<CID>
        uint64 updatedAt;
        bool active;
    }

    event DIDRegistered(address indexed identity, address indexed controller, bytes32 documentHash, string documentURI);
    event DIDDocumentUpdated(address indexed identity, bytes32 documentHash, string documentURI);
    event DIDControllerChanged(address indexed identity, address indexed newController);
    event DIDDeactivated(address indexed identity);

    /// Registers msg.sender as a new DID.
    function registerDID(bytes32 documentHash, string calldata documentURI) external;

    function updateDocument(address identity, bytes32 newDocumentHash, string calldata newDocumentURI) external;

    /// Key rotation: hands control of the DID to a different key.
    function changeController(address identity, address newController) external;

    function deactivateDID(address identity) external;

    function getDID(address identity) external view returns (DIDRecord memory);

    function isActive(address identity) external view returns (bool);
}
