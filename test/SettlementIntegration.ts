import { expect } from "chai";
import { network } from "hardhat";
import { AssetToken__factory, IdentityRegistry__factory, MockCashToken__factory, SettlementEngine__factory } from "../types/ethers-contracts/index.js";
import { EtherSymbol } from "ethers";
import { threadCpuUsage } from "process";

describe("Settlement Integration", function () {
    it("settles asset and cash atomically", async function () {
        const { ethers } = await network.create();

        const [
            faris,
            wael,
            settler,
            luay,
            tarik,
        ] = await ethers.getSigners();

        // 1. Deploy identity registry
        const IdentityRegistry = await ethers.getContractFactory(
            "IdentityRegistry"
        );

        const identityRegistry = await IdentityRegistry.deploy(
            faris.address
        );

        const complianceRole = 
            await identityRegistry.COMPLIANCE_ROLE();
        
        await identityRegistry
                .connect(faris)
                .grantRole(complianceRole, wael.address);

        await identityRegistry
                .connect(wael)
                .authorize(luay.address);

        await identityRegistry
            .connect(wael)
            .authorize(tarik.address);
        
        // 2. Deploy permissioned asset token
        const AssetToken = await ethers.getContractFactory(
            "AssetToken"
        );

        const assetToken = await AssetToken.deploy(
            "Institutional Note",
            "NOTE",
            await identityRegistry.getAddress(),
            faris.address,
            luay.address,
            faris.address
        );

        // 3. Deploy mock cash token

        const MockCashToken = await ethers.getContractFactory(
            "MockCashToken"
        );

        const cashToken = await MockCashToken.deploy();

        // 4. Deploy settlement engine
        const SettlementEngine = await ethers.getContractFactory(
            "SettlementEngine"
        );

        const settlementEngine = await SettlementEngine.deploy(
            faris.address,
            settler.address
        );

        // 5. Give Luay the asset
        await assetToken
            .connect(luay)
            .mint(
                luay.address,
                100n
            );

        // 6. Give Tarik the cash

        await cashToken.mint(
            tarik.address,
            1000n
        );

        // 7. Approve SettlementEngine
        await assetToken
            .connect(luay)
            .approve(
                await settlementEngine.getAddress(),
                100n
            );

        await cashToken
            .connect(tarik)
            .approve(
                await settlementEngine.getAddress(),
                1000n
            );

        // 8. Build settlement instruction
        const settlementId = 
            ethers.id("SETTLEMENT _001");

        const instruction = {
            settlementId,
            seller: luay.address,
            buyer: tarik.address,
            assetToken: await assetToken.getAddress(),
            cashToken: await cashToken.getAddress(),
            assetAmount: 100n,
            cashAmount: 1000n,
        };

        // 9. Execute settlement
        await settlementEngine
            .connect(settler)
            .settle(instruction);

        // 10. Verify final balances
        expect(
            await assetToken.balanceOf(luay.address)
        ).to.equal(0n);

        expect(
            await assetToken.balanceOf(tarik.address)
        ).to.equal(100n);

        expect(
            await cashToken.balanceOf(tarik.address)
        ).to.equal(0n);

        expect(
            await cashToken.balanceOf(luay.address)
        ).to.equal(1000n);

        expect(
            await settlementEngine.isSettled(settlementId)
        ).to.equal(true);
    });

    it("reverts the entire settlement if the cash leg fails", async function () {
        const { ethers } = await network.create();

        const [
            faris,
            wael,
            settler,
            luay,
            tarik,
        ] = await ethers.getSigners();

        const IdentityRegistry = await ethers.getContractFactory(
            "IdentityRegistry"
        );
        
        const identityRegistry = await IdentityRegistry.deploy(
            faris.address
        );

        const complianceRole = 
            await identityRegistry.COMPLIANCE_ROLE();

        await identityRegistry
            .connect(faris)
            .grantRole(complianceRole, wael.address);

        await identityRegistry
            .connect(wael)
            .authorize(luay.address);

        await identityRegistry
            .connect(wael)
            .authorize(tarik.address);

        const AssetToken = await ethers.getContractFactory(
            "AssetToken"
        );

        const assetToken = await AssetToken.deploy(
            "Institutional Note",
            "NOTE",
            await identityRegistry.getAddress(),
            faris.address,
            luay.address,
            faris.address
        );

        const MockCashToken = await ethers.getContractFactory(
            "MockCashToken"
        );

        const cashToken = await MockCashToken.deploy();

        const SettlementEngine = await ethers.getContractFactory(
            "SettlementEngine"
        );

        const settlementEngine = await SettlementEngine.deploy(
            faris.address,
            settler.address
        );

        await assetToken
            .connect(luay)
            .mint(
                luay.address,
                100n
            );

        // Tarik only gets 500, but settlement requires 1000.
        await cashToken.mint(
            tarik.address,
            500n
        );

        await assetToken
            .connect(luay)
            .approve(
                await settlementEngine.getAddress(),
                100n
            );
        
        await cashToken
            .connect(tarik)
            .approve(
                await settlementEngine.getAddress(),
                1000n
            );
        
        const settlementId = 
            ethers.id("SETTLEMENT_002");

        const instruction = {
            settlementId,
            seller: luay.address,
            buyer: tarik.address,
            assetToken: await assetToken.getAddress(),
            cashToken: await cashToken.getAddress(),
            assetAmount: 100n,
            cashAmount: 1000n,
        };

        await expect(
            settlementEngine
                .connect(settler)
                .settle(instruction)
        ).to.revert(ethers);

        expect(
            await assetToken.balanceOf(luay.address)
        ).to.equal(100n);

        expect(
            await assetToken.balanceOf(tarik.address)
        ).to.equal(0n);

        expect(
            await cashToken.balanceOf(tarik.address)
        ).to.equal(500n);

        expect(
            await cashToken.balanceOf(luay.address)
        ).to.equal(0n);

        expect(
            await settlementEngine.isSettled(settlementId)
        ).to.equal(false);
    });

    it("reverts the entire settlement if the asset leg fails", async function () {
        const { ethers } = await network.create();

        const [
            faris,
            wael,
            settler,
            luay,
            tarik,
        ] = await ethers.getSigners();

        const IdentityRegistry = await ethers.getContractFactory(
            "IdentityRegistry"
        );

        const identityRegistry = await IdentityRegistry.deploy(
            faris.address
        );

        const complianceRole =
            await identityRegistry.COMPLIANCE_ROLE();

        await identityRegistry
            .connect(faris)
            .grantRole(complianceRole, wael.address);

        await identityRegistry
            .connect(wael)
            .authorize(luay.address);

        await identityRegistry
            .connect(wael)
            .authorize(tarik.address);

        const AssetToken = await ethers.getContractFactory(
            "AssetToken"
        );

        const assetToken = await AssetToken.deploy(
            "Institutional Note",
            "NOTE",
            await identityRegistry.getAddress(),
            faris.address,
            luay.address,
            faris.address
        );

        const MockCashToken = await ethers.getContractFactory(
            "MockCashToken"
        );

        const cashToken = await MockCashToken.deploy();

        const SettlementEngine = await ethers.getContractFactory(
            "SettlementEngine"
        );

        const settlementEngine = await SettlementEngine.deploy(
            faris.address,
            settler.address
        );

        // Tarik has enough cash.
        await cashToken.mint(
            tarik.address,
            1000n
        );

        await assetToken
            .connect(luay)
            .approve(
                await settlementEngine.getAddress(),
                100n
            );

        await cashToken
            .connect(tarik)
            .approve(
                await settlementEngine.getAddress(),
                1000n
            );
        
            const settlementId = 
                ethers.id("SETTLEMENT_003");

            const instruction = {
                settlementId,
                seller: luay.address,
                buyer: tarik.address,
                assetToken: await assetToken.getAddress(),
                cashToken: await cashToken.getAddress(),
                assetAmount: 100n,
                cashAmount: 1000n,
            };

        await expect(
            settlementEngine
                .connect(settler)
                .settle(instruction)
        ).to.revert(ethers);

        expect(
            await assetToken.balanceOf(luay.address)
        ).to.equal(0n);

        expect(
            await assetToken.balanceOf(tarik.address)
        ).to.equal(0n);

        expect(
            await cashToken.balanceOf(tarik.address)
        ).to.equal(1000n);

        expect(
            await cashToken.balanceOf(luay.address)
        ).to.equal(0n);

        expect(
            await settlementEngine.isSettled(settlementId)
        ).to.equal(false);
    });

    it("reverts settlement if the seller has not approved the asset transfer", async function () {
        const { ethers } = await network.create();

        const [
            faris,
            wael,
            settler,
            luay,
            tarik,
        ] = await ethers.getSigners();

        const IdentityRegistry = await ethers.getContractFactory(
            "IdentityRegistry"
        );

        const identityRegistry = await IdentityRegistry.deploy(
            faris.address
        );

        const complianceRole =
            await identityRegistry.COMPLIANCE_ROLE();

        await identityRegistry
            .connect(faris)
            .grantRole(complianceRole, wael.address);

        await identityRegistry
            .connect(wael)
            .authorize(luay.address);

        await identityRegistry
            .connect(wael)
            .authorize(tarik.address);

        const AssetToken = await ethers.getContractFactory(
            "AssetToken"
        );

        const assetToken = await AssetToken.deploy(
            "Institutional Note",
            "NOTE",
            await identityRegistry.getAddress(),
            faris.address,
            luay.address,
            faris.address
        );

        const MockCashToken = await ethers.getContractFactory(
            "MockCashToken"
        );

        const cashToken = await MockCashToken.deploy();

        const SettlementEngine = await ethers.getContractFactory(
            "SettlementEngine"
        );

        const settlementEngine = await SettlementEngine.deploy(
            faris.address,
            settler.address
        );

        // Luay has enough NOTE.
        await assetToken
            .connect(luay)
            .mint(
                luay.address,
                100n
            );

        // Tarik has enough cash.
        await cashToken.mint(
            tarik.address,
            1000n
        );

        // IMPORTANT:
        // Luay does NOT approve the SettlementEngine.

        // Tarik does approve his cash.
        await cashToken
            .connect(tarik)
            .approve(
                await settlementEngine.getAddress(),
                1000n
            );

        const settlementId =
            ethers.id("SETTLEMENT_004");

        const instruction = {
            settlementId,
            seller: luay.address,
            buyer: tarik.address,
            assetToken: await assetToken.getAddress(),
            cashToken: await cashToken.getAddress(),
            assetAmount: 100n,
            cashAmount: 1000n,
        };

        await expect(
            settlementEngine
                .connect(settler)
                .settle(instruction)
        ).to.revert(ethers);

        expect(
            await assetToken.balanceOf(luay.address)
        ).to.equal(100n);

        expect(
            await assetToken.balanceOf(tarik.address)
        ).to.equal(0n);

        expect(
            await cashToken.balanceOf(tarik.address)
        ).to.equal(1000n);

        expect(
            await cashToken.balanceOf(luay.address)
        ).to.equal(0n);

        expect(
            await settlementEngine.isSettled(settlementId)
        ).to.equal(false);
    });

    it("reverts settlement if the buyer has not approved the cash transfer", async function () {
        const { ethers } = await network.create();

        const [
            faris,
            wael,
            settler,
            luay,
            tarik,
        ] = await ethers.getSigners();

        const IdentityRegistry = await ethers.getContractFactory(
            "IdentityRegistry"
        );

        const identityRegistry = await IdentityRegistry.deploy(
            faris.address
        );

        const complianceRole =
            await identityRegistry.COMPLIANCE_ROLE();

        await identityRegistry
            .connect(faris)
            .grantRole(complianceRole, wael.address);

        await identityRegistry
            .connect(wael)
            .authorize(luay.address);

        await identityRegistry
            .connect(wael)
            .authorize(tarik.address);

        const AssetToken = await ethers.getContractFactory(
            "AssetToken"
        );

        const assetToken = await AssetToken.deploy(
            "Institutional Note",
            "NOTE",
            await identityRegistry.getAddress(),
            faris.address,
            luay.address,
            faris.address
        );

        const MockCashToken = await ethers.getContractFactory(
            "MockCashToken"
        );

        const cashToken = await MockCashToken.deploy();

        const SettlementEngine = await ethers.getContractFactory(
            "SettlementEngine"
        );

        const settlementEngine = await SettlementEngine.deploy(
            faris.address,
            settler.address
        );

        await assetToken
            .connect(luay)
            .mint(
                luay.address,
                100n
            );

        await cashToken.mint(
            tarik.address,
            1000n
        );

        // Luay approves the asset transfer.
        await assetToken
            .connect(luay)
            .approve(
                await settlementEngine.getAddress(),
                100n
            );

        // IMPORTANT:
        // Tarik does NOT approve the SettlementEngine.

        const settlementId =
            ethers.id("SETTLEMENT_005");

        const instruction = {
            settlementId,
            seller: luay.address,
            buyer: tarik.address,
            assetToken: await assetToken.getAddress(),
            cashToken: await cashToken.getAddress(),
            assetAmount: 100n,
            cashAmount: 1000n,
        };

        await expect(
            settlementEngine
                .connect(settler)
                .settle(instruction)
        ).to.revert(ethers);

        expect(
            await assetToken.balanceOf(luay.address)
        ).to.equal(100n);

        expect(
            await assetToken.balanceOf(tarik.address)
        ).to.equal(0n);

        expect(
            await cashToken.balanceOf(tarik.address)
        ).to.equal(1000n);

        expect(
            await cashToken.balanceOf(luay.address)
        ).to.equal(0n);

        expect(
            await settlementEngine.isSettled(settlementId)
        ).to.equal(false);
    });

    it("reverts settlement if the buyer is no longer authorized", async function () {
        const { ethers } = await network.create();

        const [
            faris,
            wael,
            settler,
            luay,
            tarik,
        ] = await ethers.getSigners();

        const IdentityRegistry = await ethers.getContractFactory(
            "IdentityRegistry"
        );

        const identityRegistry = await IdentityRegistry.deploy(
            faris.address
        );

        const complianceRole =
            await identityRegistry.COMPLIANCE_ROLE();

        await identityRegistry
            .connect(faris)
            .grantRole(complianceRole, wael.address);

        await identityRegistry
            .connect(wael)
            .authorize(luay.address);

        await identityRegistry
            .connect(wael)
            .authorize(tarik.address);

        const AssetToken = await ethers.getContractFactory(
            "AssetToken"
        );

        const assetToken = await AssetToken.deploy(
            "Institutional Note",
            "NOTE",
            await identityRegistry.getAddress(),
            faris.address,
            luay.address,
            faris.address
        );

        const MockCashToken = await ethers.getContractFactory(
            "MockCashToken"
        );

        const cashToken = await MockCashToken.deploy();

        const SettlementEngine = await ethers.getContractFactory(
            "SettlementEngine"
        );

        const settlementEngine = await SettlementEngine.deploy(
            faris.address,
            settler.address
        );

        await assetToken
            .connect(luay)
            .mint(
                luay.address,
                100n
            );

        await cashToken.mint(
            tarik.address,
            1000n
        );

        await assetToken
            .connect(luay)
            .approve(
                await settlementEngine.getAddress(),
                100n
            );

        await cashToken
            .connect(tarik)
            .approve(
                await settlementEngine.getAddress(),
                1000n
            );

        // Tarik was approved before, but compliance revokes him.
        await identityRegistry
            .connect(wael)
            .revoke(tarik.address);

        const settlementId =
            ethers.id("SETTLEMENT_006");

        const instruction = {
            settlementId,
            seller: luay.address,
            buyer: tarik.address,
            assetToken: await assetToken.getAddress(),
            cashToken: await cashToken.getAddress(),
            assetAmount: 100n,
            cashAmount: 1000n,
        };

        await expect(
            settlementEngine
                .connect(settler)
                .settle(instruction)
        ).to.revert(ethers);

        expect(
            await assetToken.balanceOf(luay.address)
        ).to.equal(100n);

        expect(
            await assetToken.balanceOf(tarik.address)
        ).to.equal(0n);

        expect(
            await cashToken.balanceOf(tarik.address)
        ).to.equal(1000n);

        expect(
            await cashToken.balanceOf(luay.address)
        ).to.equal(0n);

        expect(
            await settlementEngine.isSettled(settlementId)
        ).to.equal(false);
    });

    it("reverts settlement if the seller is no longer authorized", async function () {
        const { ethers } = await network.create();

        const [
            faris,
            wael,
            settler,
            luay,
            tarik,
        ] = await ethers.getSigners();

        const IdentityRegistry = await ethers.getContractFactory(
            "IdentityRegistry"
        );

        const identityRegistry = await IdentityRegistry.deploy(
            faris.address
        );

        const complianceRole =
            await identityRegistry.COMPLIANCE_ROLE();

        await identityRegistry
            .connect(faris)
            .grantRole(complianceRole, wael.address);

        await identityRegistry
            .connect(wael)
            .authorize(luay.address);

        await identityRegistry
            .connect(wael)
            .authorize(tarik.address);

        const AssetToken = await ethers.getContractFactory(
            "AssetToken"
        );

        const assetToken = await AssetToken.deploy(
            "Institutional Note",
            "NOTE",
            await identityRegistry.getAddress(),
            faris.address,
            luay.address,
            faris.address
        );

        const MockCashToken = await ethers.getContractFactory(
            "MockCashToken"
        );

        const cashToken = await MockCashToken.deploy();

        const SettlementEngine = await ethers.getContractFactory(
            "SettlementEngine"
        );

        const settlementEngine = await SettlementEngine.deploy(
            faris.address,
            settler.address
        );

        await assetToken
            .connect(luay)
            .mint(
                luay.address,
                100n
            );

        await cashToken.mint(
            tarik.address,
            1000n
        );

        await assetToken
            .connect(luay)
            .approve(
                await settlementEngine.getAddress(),
                100n
            );

        await cashToken
            .connect(tarik)
            .approve(
                await settlementEngine.getAddress(),
                1000n
            );

        // Luay was approved when he received the asset,
        // but compliance revokes him before settlement.
        await identityRegistry
            .connect(wael)
            .revoke(luay.address);

        const settlementId =
            ethers.id("SETTLEMENT_007");

        const instruction = {
            settlementId,
            seller: luay.address,
            buyer: tarik.address,
            assetToken: await assetToken.getAddress(),
            cashToken: await cashToken.getAddress(),
            assetAmount: 100n,
            cashAmount: 1000n,
        };

        await expect(
            settlementEngine
                .connect(settler)
                .settle(instruction)
        ).to.revert(ethers);

        expect(
            await assetToken.balanceOf(luay.address)
        ).to.equal(100n);

        expect(
            await assetToken.balanceOf(tarik.address)
        ).to.equal(0n);

        expect(
            await cashToken.balanceOf(tarik.address)
        ).to.equal(1000n);

        expect(
            await cashToken.balanceOf(luay.address)
        ).to.equal(0n);

        expect(
            await settlementEngine.isSettled(settlementId)
        ).to.equal(false);
    });

    it("reverts settlement if the asset token is paused", async function () {
        const { ethers } = await network.create();

        const [
            faris,
            wael,
            settler,
            luay,
            tarik,
        ] = await ethers.getSigners();

        const IdentityRegistry = await ethers.getContractFactory(
            "IdentityRegistry"
        );

        const identityRegistry = await IdentityRegistry.deploy(
            faris.address
        );

        const complianceRole =
            await identityRegistry.COMPLIANCE_ROLE();

        await identityRegistry
            .connect(faris)
            .grantRole(complianceRole, wael.address);

        await identityRegistry
            .connect(wael)
            .authorize(luay.address);

        await identityRegistry
            .connect(wael)
            .authorize(tarik.address);

        const AssetToken = await ethers.getContractFactory(
            "AssetToken"
        );

        const assetToken = await AssetToken.deploy(
            "Institutional Note",
            "NOTE",
            await identityRegistry.getAddress(),
            faris.address,
            luay.address,
            faris.address
        );

        const MockCashToken = await ethers.getContractFactory(
            "MockCashToken"
        );

        const cashToken = await MockCashToken.deploy();

        const SettlementEngine = await ethers.getContractFactory(
            "SettlementEngine"
        );

        const settlementEngine = await SettlementEngine.deploy(
            faris.address,
            settler.address
        );

        await assetToken
            .connect(luay)
            .mint(
                luay.address,
                100n
            );

        await cashToken.mint(
            tarik.address,
            1000n
        );

        await assetToken
            .connect(luay)
            .approve(
                await settlementEngine.getAddress(),
                100n
            );

        await cashToken
            .connect(tarik)
            .approve(
                await settlementEngine.getAddress(),
                1000n
            );

        // Faris has the PAUSER_ROLE.
        await assetToken
            .connect(faris)
            .pause();

        const settlementId =
            ethers.id("SETTLEMENT_008");

        const instruction = {
            settlementId,
            seller: luay.address,
            buyer: tarik.address,
            assetToken: await assetToken.getAddress(),
            cashToken: await cashToken.getAddress(),
            assetAmount: 100n,
            cashAmount: 1000n,
        };

        await expect(
            settlementEngine
                .connect(settler)
                .settle(instruction)
        ).to.revert(ethers);

        expect(
            await assetToken.balanceOf(luay.address)
        ).to.equal(100n);

        expect(
            await assetToken.balanceOf(tarik.address)
        ).to.equal(0n);

        expect(
            await cashToken.balanceOf(tarik.address)
        ).to.equal(1000n);

        expect(
            await cashToken.balanceOf(luay.address)
        ).to.equal(0n);

        expect(
            await settlementEngine.isSettled(settlementId)
        ).to.equal(false);
    });

    it("prevents the same settlement from being executed twice", async function () {
        const { ethers } = await network.create();

        const [
            faris,
            wael,
            settler,
            luay,
            tarik,
        ] = await ethers.getSigners();

        const IdentityRegistry = await ethers.getContractFactory(
            "IdentityRegistry"
        );

        const identityRegistry = await IdentityRegistry.deploy(
            faris.address
        );

        const complianceRole =
            await identityRegistry.COMPLIANCE_ROLE();

        await identityRegistry
            .connect(faris)
            .grantRole(complianceRole, wael.address);

        await identityRegistry
            .connect(wael)
            .authorize(luay.address);

        await identityRegistry
            .connect(wael)
            .authorize(tarik.address);

        const AssetToken = await ethers.getContractFactory(
            "AssetToken"
        );

        const assetToken = await AssetToken.deploy(
            "Institutional Note",
            "NOTE",
            await identityRegistry.getAddress(),
            faris.address,
            luay.address,
            faris.address
        );

        const MockCashToken = await ethers.getContractFactory(
            "MockCashToken"
        );

        const cashToken = await MockCashToken.deploy();

        const SettlementEngine = await ethers.getContractFactory(
            "SettlementEngine"
        );

        const settlementEngine = await SettlementEngine.deploy(
            faris.address,
            settler.address
        );

        await assetToken
            .connect(luay)
            .mint(
                luay.address,
                200n
            );

        await cashToken.mint(
            tarik.address,
            2000n
        );

        await assetToken
            .connect(luay)
            .approve(
                await settlementEngine.getAddress(),
                200n
            );

        await cashToken
            .connect(tarik)
            .approve(
                await settlementEngine.getAddress(),
                2000n
            );

        const settlementId =
            ethers.id("SETTLEMENT_009");

        const instruction = {
            settlementId,
            seller: luay.address,
            buyer: tarik.address,
            assetToken: await assetToken.getAddress(),
            cashToken: await cashToken.getAddress(),
            assetAmount: 100n,
            cashAmount: 1000n,
        };

        // First execution succeeds.
        await settlementEngine
            .connect(settler)
            .settle(instruction);

        // Second execution with the same settlement ID must fail.
        await expect(
            settlementEngine
                .connect(settler)
                .settle(instruction)
        ).to.be.revertedWithCustomError(
            settlementEngine,
            "AlreadySettled"
        ).withArgs(settlementId);

        expect(
            await assetToken.balanceOf(luay.address)
        ).to.equal(100n);

        expect(
            await assetToken.balanceOf(tarik.address)
        ).to.equal(100n);

        expect(
            await cashToken.balanceOf(tarik.address)
        ).to.equal(1000n);

        expect(
            await cashToken.balanceOf(luay.address)
        ).to.equal(1000n);

        expect(
            await settlementEngine.isSettled(settlementId)
        ).to.equal(true);
    });
});