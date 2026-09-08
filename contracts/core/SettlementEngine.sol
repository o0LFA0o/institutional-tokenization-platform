// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {ISettlementEngine} from "../interfaces/ISettlementEngine.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract SettlementEngine is ISettlementEngine, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant SETTLER_ROLE = keccak256("SETTLER_ROLE");

    mapping(bytes32 => bool) private _settled;

    error AlreadySettled(bytes32 settlementId);

    error InvalidSettlementId();

    error InvalidSeller();

    error InvalidBuyer();

    error InvalidAssetToken();

    error InvalidCashToken();

    error InvalidAssetAmount();

    error InvalidCashAmount();

    error InvalidAdmin();

    error InvalidSettler();

    event SettlementCompleted(
    bytes32 indexed settlementId,
    address indexed operator
    );

    constructor(
        address admin_,
        address settler_
    ) {
        if (admin_ == address(0)) {
            revert InvalidAdmin();
        }

        if (settler_ == address(0)) {
            revert InvalidSettler();
        }

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(SETTLER_ROLE, settler_);
    }

    function isSettled(
        bytes32 settlementId
    ) external view override returns (bool) {
        return _settled[settlementId];
    }

    function settle(
        SettlementInstruction calldata instruction
    ) external override onlyRole(SETTLER_ROLE) nonReentrant {
        if (instruction.settlementId == bytes32(0)) {
            revert InvalidSettlementId();
        }

        if (instruction.seller == address(0)) {
           revert InvalidSeller();
        }

        if (instruction.buyer == address(0)) {
           revert InvalidBuyer();
        }

        if (instruction.assetToken == address(0)) {
            revert InvalidAssetToken();
        }

        if (instruction.cashToken == address(0)) {
            revert InvalidCashToken();
        }

        if (instruction.assetAmount == 0) {
            revert InvalidAssetAmount();
        }

        if (instruction.cashAmount == 0) {
            revert InvalidCashAmount();
        }
        
        if (_settled[instruction.settlementId]) {
            revert AlreadySettled(instruction.settlementId);
        }

        _settled[instruction.settlementId] = true;

        IERC20(instruction.assetToken).safeTransferFrom(
            instruction.seller,
            instruction.buyer,
            instruction.assetAmount
        );

        IERC20(instruction.cashToken).safeTransferFrom(
            instruction.buyer,
            instruction.seller,
            instruction.cashAmount
        );

        emit SettlementCompleted(
            instruction.settlementId,
            msg.sender
        );
    }
}