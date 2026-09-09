// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

interface ISettlementEngine {
    struct SettlementInstruction {
        bytes32 settlementId;
        address seller;
        address buyer;
        address assetToken;
        address cashToken;
        uint256 assetAmount;
        uint256 cashAmount;
    }

    function isSettled(
        bytes32 settlementId
    ) external view returns (bool);

    function settle(
        SettlementInstruction calldata instruction,
        bytes calldata signature
    ) external;
}