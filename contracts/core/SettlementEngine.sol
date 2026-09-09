// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {ISettlementEngine} from "../interfaces/ISettlementEngine.sol";

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract SettlementEngine is
    ISettlementEngine,
    AccessControl,
    ReentrancyGuard,
    EIP712
{
    using SafeERC20 for IERC20;

    bytes32 public constant SETTLER_ROLE = keccak256("SETTLER_ROLE");

    bytes32 private constant SETTLEMENT_INSTRUCTION_TYPEHASH =
        keccak256(
            "SettlementInstruction(bytes32 settlementId,address seller,address buyer,address assetToken,address cashToken,uint256 assetAmount,uint256 cashAmount)"
        );

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
    error InvalidSignature();

    event SettlementCompleted(
        bytes32 indexed settlementId,
        address indexed operator
    );

    constructor(
        address admin_,
        address settler_
    ) EIP712("Institutional Tokenization Platform", "1") {
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

    function _hashSettlementInstruction(
        SettlementInstruction calldata instruction
    ) private view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    SETTLEMENT_INSTRUCTION_TYPEHASH,
                    instruction.settlementId,
                    instruction.seller,
                    instruction.buyer,
                    instruction.assetToken,
                    instruction.cashToken,
                    instruction.assetAmount,
                    instruction.cashAmount
                )
            )
        );
    }

    function settle(
        SettlementInstruction calldata instruction,
        bytes calldata signature
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

        bytes32 digest =
            _hashSettlementInstruction(instruction);

        address recoveredSigner =
            ECDSA.recover(digest, signature);

        if (recoveredSigner != instruction.seller) {
            revert InvalidSignature();
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