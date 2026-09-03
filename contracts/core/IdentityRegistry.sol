// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

import {IIdentityRegistry} from "../interfaces/IIdentityRegistry.sol";

contract IdentityRegistry is IIdentityRegistry, AccessControl {
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");


    mapping(address => bool) private _authorized;
    
    error InvalidAccount();
    error AlreadyAuthorized(address account);
    error NotAuthorized(address account);

    event ParticipantAuthorized(address indexed account, address indexed operator);
    event ParticipantRevoked(address indexed account, address indexed operator);

    constructor(address admin) {
        if (admin == address(0)) {
            revert InvalidAccount();
        }

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function authorize(address account) external onlyRole(COMPLIANCE_ROLE) {
        if (account == address(0)) {
            revert InvalidAccount();
        }

        if (_authorized[account]) {
            revert AlreadyAuthorized(account);
        }
        
        _authorized[account] = true;

        emit ParticipantAuthorized(account, msg.sender);
    }

    function revoke(address account) external onlyRole(COMPLIANCE_ROLE) {
        if (account == address(0)) {
            revert InvalidAccount();
        }

        if (!_authorized[account]) {
            revert NotAuthorized(account);
        }

        _authorized[account] = false;

        emit ParticipantRevoked(account, msg.sender);    
    }

    function isAuthorized(address account) external view override returns (bool) {
        return _authorized[account];
    }
}