// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IIssuerAccessControl
/// @notice Keeps the list of universities (registrars) that are allowed to issue credentials.
interface IIssuerAccessControl {
    function addIssuer(address issuer) external;

    function removeIssuer(address issuer) external;

    function isIssuer(address account) external view returns (bool);
}
