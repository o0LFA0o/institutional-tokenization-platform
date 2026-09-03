// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {IIdentityRegistry} from "../interfaces/IIdentityRegistry.sol";

contract AssetToken is ERC20, AccessControl, Pausable {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    error InvalidIdentityRegistry();
    error InvalidAdmin();
    error InvalidIssuer();
    error InvalidPauser();
    error InvalidRecipient();
    error InvalidSender();

    IIdentityRegistry public immutable identityRegistry;

    constructor(
        string memory name_,
        string memory symbol_,
        address identityRegistry_,
        address admin_,
        address issuer_,
        address pauser_
    ) ERC20(name_, symbol_) {
        if (identityRegistry_ == address(0)) {
            revert InvalidIdentityRegistry();
        }

        if (admin_ == address(0)) {
            revert InvalidAdmin();
        }

        if (issuer_ == address(0)) {
            revert InvalidIssuer();
        }

        if (pauser_ == address(0)) {
            revert InvalidPauser();
        }

        identityRegistry = IIdentityRegistry(identityRegistry_);

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(ISSUER_ROLE, issuer_);
        _grantRole(PAUSER_ROLE, pauser_);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function mint(address to, uint256 amount) external onlyRole(ISSUER_ROLE) {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyRole(ISSUER_ROLE) {
        _burn(from, amount);
    }

    function _update(
        address from,
        address to,
        uint256 value
    ) internal override whenNotPaused {
        if (
            from != address(0) &&
            to != address(0) &&
            !identityRegistry.isAuthorized(from)
        ) {
            revert InvalidSender();
        }

        if (
            to != address(0) &&
            !identityRegistry.isAuthorized(to)
        ) {
            revert InvalidRecipient();
        }

        super._update(from, to, value);
    }
}