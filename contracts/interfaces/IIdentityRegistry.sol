// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

interface IIdentityRegistry {
    function isAuthorized(address account) external view returns (bool);
}