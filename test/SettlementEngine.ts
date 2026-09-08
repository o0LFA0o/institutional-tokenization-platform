import { expect } from "chai";
import { network } from "hardhat";

describe("SettlementEngine", function () {
    async function deployFundedSettlement() {
        const { ethers } = await network.create();

        const [
            faris,
            settler,
            seller,
            buyer,
        ] = await ethers.getSigners();

        const SettlementEngine = await ethers.getContractFactory(
            "SettlementEngine"
        );

        const settlementEngine = await SettlementEngine.deploy(
            faris.address,
            settler.address
        );

        const MockCashToken = await ethers.getContractFactory(
            "MockCashToken"
        );

        const assetToken = await MockCashToken.deploy();
        const cashToken = await MockCashToken.deploy();

        await assetToken.mint(
            seller.address,
            100n
        );

        await cashToken.mint(
            buyer.address,
            1000n
        );

        await assetToken
            .connect(seller)
            .approve(
                await settlementEngine.getAddress(),
                100n
            );

        await cashToken
            .connect(buyer)
            .approve(
                await settlementEngine.getAddress(),
                1000n
            );

        const settlementId =
            ethers.id("SETTLEMENT_001");

        const instruction = {
            settlementId,
            seller: seller.address,
            buyer: buyer.address,
            assetToken: await assetToken.getAddress(),
            cashToken: await cashToken.getAddress(),
            assetAmount: 100n,
            cashAmount: 1000n,
        };

        return {
            ethers,
            faris,
            settler,
            seller,
            buyer,
            settlementEngine,
            assetToken,
            cashToken,
            settlementId,
            instruction,
        };
    }

    it("starts with a settlement as unsettled", async function () {
        const { ethers } = await network.create();

        const [faris, settler] = await ethers.getSigners();

        const SettlementEngine = await ethers.getContractFactory(
            "SettlementEngine"
        );

        const settlementEngine = await SettlementEngine.deploy(
            faris.address,
            settler.address
        );

        const settlementId = ethers.id("SETTLEMENT_001");

        expect(
            await settlementEngine.isSettled(settlementId)
        ).to.equal(false);
    });

    it("marks a settlement as settled", async function () {
        const {
            settler,
            settlementEngine,
            settlementId,
            instruction,
        } = await deployFundedSettlement();

        await settlementEngine
            .connect(settler)
            .settle(instruction);

        expect(
            await settlementEngine.isSettled(settlementId)
        ).to.equal(true);
    });

    it("prevents the same settlement from being settled twice", async function () {
        const {
            settler,
            settlementEngine,
            settlementId,
            instruction,
        } = await deployFundedSettlement();

        await settlementEngine
            .connect(settler)
            .settle(instruction);

        await expect(
            settlementEngine
                .connect(settler)
                .settle(instruction)
        )
            .to.be.revertedWithCustomError(
                settlementEngine,
                "AlreadySettled"
            )
            .withArgs(settlementId);
    });

    it("emits a settlement completion event", async function () {
        const {
            settler,
            settlementEngine,
            settlementId,
            instruction,
        } = await deployFundedSettlement();

        await expect(
            settlementEngine
                .connect(settler)
                .settle(instruction)
        )
            .to.emit(
                settlementEngine,
                "SettlementCompleted"
            )
            .withArgs(
                settlementId,
                settler.address
            );
    });

    it("rejects a zero settlement ID", async function () {
        const { ethers } = await network.create();

        const [
            faris,
            settler,
            luay,
            tarik,
        ] = await ethers.getSigners();

        const SettlementEngine = await ethers.getContractFactory(
            "SettlementEngine"
        );

        const settlementEngine = await SettlementEngine.deploy(
            faris.address,
            settler.address
        );

        const instruction = {
            settlementId: ethers.ZeroHash,
            seller: luay.address,
            buyer: tarik.address,
            assetToken: ethers.ZeroAddress,
            cashToken: ethers.ZeroAddress,
            assetAmount: 0n,
            cashAmount: 0n,
        };

        await expect(
            settlementEngine
                .connect(settler)
                .settle(instruction)
        ).to.be.revertedWithCustomError(
            settlementEngine,
            "InvalidSettlementId"
        );
    });

    it("rejects a zero seller address", async function () {
        const { ethers } = await network.create();

        const [
            faris,
            settler,
            ,
            tarik,
        ] = await ethers.getSigners();

        const SettlementEngine = await ethers.getContractFactory(
            "SettlementEngine"
        );

        const settlementEngine = await SettlementEngine.deploy(
            faris.address,
            settler.address
        );

        const instruction = {
            settlementId: ethers.id("SETTLEMENT_001"),
            seller: ethers.ZeroAddress,
            buyer: tarik.address,
            assetToken: ethers.ZeroAddress,
            cashToken: ethers.ZeroAddress,
            assetAmount: 0n,
            cashAmount: 0n,
        };

        await expect(
            settlementEngine
                .connect(settler)
                .settle(instruction)
        ).to.be.revertedWithCustomError(
            settlementEngine,
            "InvalidSeller"
        );
    });

    it("rejects a zero buyer address", async function () {
        const { ethers } = await network.create();

        const [
            faris,
            settler,
            luay,
        ] = await ethers.getSigners();

        const SettlementEngine = await ethers.getContractFactory(
            "SettlementEngine"
        );

        const settlementEngine = await SettlementEngine.deploy(
            faris.address,
            settler.address
        );

        const instruction = {
            settlementId: ethers.id("SETTLEMENT_001"),
            seller: luay.address,
            buyer: ethers.ZeroAddress,
            assetToken: ethers.ZeroAddress,
            cashToken: ethers.ZeroAddress,
            assetAmount: 0n,
            cashAmount: 0n,
        };

        await expect(
            settlementEngine
                .connect(settler)
                .settle(instruction)
        ).to.be.revertedWithCustomError(
            settlementEngine,
            "InvalidBuyer"
        );
    });

    it("rejects a zero asset token address", async function () {
        const { ethers } = await network.create();

        const [
            faris,
            settler,
            luay,
            tarik,
        ] = await ethers.getSigners();

        const SettlementEngine = await ethers.getContractFactory(
            "SettlementEngine"
        );

        const settlementEngine = await SettlementEngine.deploy(
            faris.address,
            settler.address
        );

        const instruction = {
            settlementId: ethers.id("SETTLEMENT_001"),
            seller: luay.address,
            buyer: tarik.address,
            assetToken: ethers.ZeroAddress,
            cashToken: ethers.ZeroAddress,
            assetAmount: 0n,
            cashAmount: 0n,
        };

        await expect(
            settlementEngine
                .connect(settler)
                .settle(instruction)
        ).to.be.revertedWithCustomError(
            settlementEngine,
            "InvalidAssetToken"
        );
    });

    it("rejects a zero cash token address", async function () {
        const { ethers } = await network.create();

        const [
            faris,
            settler,
            luay,
            tarik,
            assetTokenPlaceholder,
        ] = await ethers.getSigners();

        const SettlementEngine = await ethers.getContractFactory(
            "SettlementEngine"
        );

        const settlementEngine = await SettlementEngine.deploy(
            faris.address,
            settler.address
        );

        const instruction = {
            settlementId: ethers.id("SETTLEMENT_001"),
            seller: luay.address,
            buyer: tarik.address,
            assetToken: assetTokenPlaceholder.address,
            cashToken: ethers.ZeroAddress,
            assetAmount: 0n,
            cashAmount: 0n,
        };

        await expect(
            settlementEngine
                .connect(settler)
                .settle(instruction)
        ).to.be.revertedWithCustomError(
            settlementEngine,
            "InvalidCashToken"
        );
    });

    it("rejects a zero asset amount", async function () {
        const { ethers } = await network.create();

        const [
            faris,
            settler,
            luay,
            tarik,
            assetTokenPlaceholder,
            cashTokenPlaceholder,
        ] = await ethers.getSigners();

        const SettlementEngine = await ethers.getContractFactory(
            "SettlementEngine"
        );

        const settlementEngine = await SettlementEngine.deploy(
            faris.address,
            settler.address
        );

        const instruction = {
            settlementId: ethers.id("SETTLEMENT_001"),
            seller: luay.address,
            buyer: tarik.address,
            assetToken: assetTokenPlaceholder.address,
            cashToken: cashTokenPlaceholder.address,
            assetAmount: 0n,
            cashAmount: 0n,
        };

        await expect(
            settlementEngine
                .connect(settler)
                .settle(instruction)
        ).to.be.revertedWithCustomError(
            settlementEngine,
            "InvalidAssetAmount"
        );
    });

    it("rejects a zero cash amount", async function () {
        const { ethers } = await network.create();

        const [
            faris,
            settler,
            luay,
            tarik,
            assetTokenPlaceholder,
            cashTokenPlaceholder,
        ] = await ethers.getSigners();

        const SettlementEngine = await ethers.getContractFactory(
            "SettlementEngine"
        );

        const settlementEngine = await SettlementEngine.deploy(
            faris.address,
            settler.address
        );

        const instruction = {
            settlementId: ethers.id("SETTLEMENT_001"),
            seller: luay.address,
            buyer: tarik.address,
            assetToken: assetTokenPlaceholder.address,
            cashToken: cashTokenPlaceholder.address,
            assetAmount: 100n,
            cashAmount: 0n,
        };

        await expect(
            settlementEngine
                .connect(settler)
                .settle(instruction)
        ).to.be.revertedWithCustomError(
            settlementEngine,
            "InvalidCashAmount"
        );
    });

    it("rejects settlement from an unauthorized caller", async function () {
        const { ethers } = await network.create();

        const [
            faris,
            settler,
            unauthorizedCaller,
            luay,
            tarik,
            assetTokenPlaceholder,
            cashTokenPlaceholder,
        ] = await ethers.getSigners();

        const SettlementEngine = await ethers.getContractFactory(
            "SettlementEngine"
        );

        const settlementEngine = await SettlementEngine.deploy(
            faris.address,
            settler.address
        );

        const instruction = {
            settlementId: ethers.id("SETTLEMENT_001"),
            seller: luay.address,
            buyer: tarik.address,
            assetToken: assetTokenPlaceholder.address,
            cashToken: cashTokenPlaceholder.address,
            assetAmount: 100n,
            cashAmount: 1000n,
        };

        await expect(
            settlementEngine
                .connect(unauthorizedCaller)
                .settle(instruction)
        ).to.revert(ethers);
    });

    it("rejects a zero admin address", async function () {
        const { ethers } = await network.create();

        const [, settler] = await ethers.getSigners();

        const SettlementEngine = await ethers.getContractFactory(
            "SettlementEngine"
        );

        await expect(
            SettlementEngine.deploy(
                ethers.ZeroAddress,
                settler.address
            )
        ).to.be.revertedWithCustomError(
            SettlementEngine,
            "InvalidAdmin"
        );
    });

    it("rejects a zero settler address", async function () {
        const { ethers } = await network.create();

        const [faris] = await ethers.getSigners();

        const SettlementEngine = await ethers.getContractFactory(
            "SettlementEngine"
        );

        await expect(
            SettlementEngine.deploy(
                faris.address,
                ethers.ZeroAddress
            )
        ).to.be.revertedWithCustomError(
            SettlementEngine,
            "InvalidSettler"
        );
    });
});