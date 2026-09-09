import { expect } from "chai";
import { network } from "hardhat";

describe("Settlement Integration", function () {
    async function signSettlementInstruction(
        signer: any,
        settlementEngine: any,
        instruction: any
    ) {
        const networkInfo =
            await signer.provider.getNetwork();

        const domain = {
            name: "Institutional Tokenization Platform",
            version: "1",
            chainId: networkInfo.chainId,
            verifyingContract:
                await settlementEngine.getAddress(),
        };

        const types = {
            SettlementInstruction: [
                {
                    name: "settlementId",
                    type: "bytes32",
                },
                {
                    name: "seller",
                    type: "address",
                },
                {
                    name: "buyer",
                    type: "address",
                },
                {
                    name: "assetToken",
                    type: "address",
                },
                {
                    name: "cashToken",
                    type: "address",
                },
                {
                    name: "assetAmount",
                    type: "uint256",
                },
                {
                    name: "cashAmount",
                    type: "uint256",
                },
            ],
        };

        return signer.signTypedData(
            domain,
            types,
            instruction
        );
    }

    async function deployIntegrationFixture({
        assetMint = 100n,
        cashMint = 1000n,
        assetApproval = 100n,
        cashApproval = 1000n,
        approveAsset = true,
        approveCash = true,
    } = {}) {
        const { ethers } = await network.create();

        const [
            faris,
            wael,
            settler,
            luay,
            tarik,
        ] = await ethers.getSigners();

        // 1. Deploy identity registry
        const IdentityRegistry =
            await ethers.getContractFactory(
                "IdentityRegistry"
            );

        const identityRegistry =
            await IdentityRegistry.deploy(
                faris.address
            );

        const complianceRole =
            await identityRegistry.COMPLIANCE_ROLE();

        await identityRegistry
            .connect(faris)
            .grantRole(
                complianceRole,
                wael.address
            );

        await identityRegistry
            .connect(wael)
            .authorize(luay.address);

        await identityRegistry
            .connect(wael)
            .authorize(tarik.address);

        // 2. Deploy permissioned asset token
        const AssetToken =
            await ethers.getContractFactory(
                "AssetToken"
            );

        const assetToken =
            await AssetToken.deploy(
                "Institutional Note",
                "NOTE",
                await identityRegistry.getAddress(),
                faris.address,
                luay.address,
                faris.address
            );

        // 3. Deploy mock cash token
        const MockCashToken =
            await ethers.getContractFactory(
                "MockCashToken"
            );

        const cashToken =
            await MockCashToken.deploy();

        // 4. Deploy settlement engine
        const SettlementEngine =
            await ethers.getContractFactory(
                "SettlementEngine"
            );

        const settlementEngine =
            await SettlementEngine.deploy(
                faris.address,
                settler.address
            );

        // 5. Mint asset to Luay
        if (assetMint > 0n) {
            await assetToken
                .connect(luay)
                .mint(
                    luay.address,
                    assetMint
                );
        }

        // 6. Mint cash to Tarik
        if (cashMint > 0n) {
            await cashToken.mint(
                tarik.address,
                cashMint
            );
        }

        // 7. Approvals
        if (approveAsset) {
            await assetToken
                .connect(luay)
                .approve(
                    await settlementEngine.getAddress(),
                    assetApproval
                );
        }

        if (approveCash) {
            await cashToken
                .connect(tarik)
                .approve(
                    await settlementEngine.getAddress(),
                    cashApproval
                );
        }

        return {
            ethers,
            faris,
            wael,
            settler,
            luay,
            tarik,
            identityRegistry,
            assetToken,
            cashToken,
            settlementEngine,
        };
    }

    function buildInstruction(
        settlementId: string,
        seller: string,
        buyer: string,
        assetToken: string,
        cashToken: string,
        assetAmount = 100n,
        cashAmount = 1000n
    ) {
        return {
            settlementId,
            seller,
            buyer,
            assetToken,
            cashToken,
            assetAmount,
            cashAmount,
        };
    }

    it(
        "settles asset and cash atomically",
        async function () {
            const {
                ethers,
                settler,
                luay,
                tarik,
                assetToken,
                cashToken,
                settlementEngine,
            } = await deployIntegrationFixture();

            const settlementId =
                ethers.id("SETTLEMENT_001");

            const instruction =
                buildInstruction(
                    settlementId,
                    luay.address,
                    tarik.address,
                    await assetToken.getAddress(),
                    await cashToken.getAddress()
                );

            const signature =
                await signSettlementInstruction(
                    luay,
                    settlementEngine,
                    instruction
                );

            await settlementEngine
                .connect(settler)
                .settle(
                    instruction,
                    signature
                );

            expect(
                await assetToken.balanceOf(
                    luay.address
                )
            ).to.equal(0n);

            expect(
                await assetToken.balanceOf(
                    tarik.address
                )
            ).to.equal(100n);

            expect(
                await cashToken.balanceOf(
                    tarik.address
                )
            ).to.equal(0n);

            expect(
                await cashToken.balanceOf(
                    luay.address
                )
            ).to.equal(1000n);

            expect(
                await settlementEngine.isSettled(
                    settlementId
                )
            ).to.equal(true);
        }
    );

    it(
        "reverts the entire settlement if the cash leg fails",
        async function () {
            const {
                ethers,
                settler,
                luay,
                tarik,
                assetToken,
                cashToken,
                settlementEngine,
            } = await deployIntegrationFixture({
                cashMint: 500n,
                cashApproval: 1000n,
            });

            const settlementId =
                ethers.id("SETTLEMENT_002");

            const instruction =
                buildInstruction(
                    settlementId,
                    luay.address,
                    tarik.address,
                    await assetToken.getAddress(),
                    await cashToken.getAddress()
                );

            const signature =
                await signSettlementInstruction(
                    luay,
                    settlementEngine,
                    instruction
                );

            await expect(
                settlementEngine
                    .connect(settler)
                    .settle(
                        instruction,
                        signature
                    )
            ).to.be.revert(ethers);

            expect(
                await assetToken.balanceOf(
                    luay.address
                )
            ).to.equal(100n);

            expect(
                await assetToken.balanceOf(
                    tarik.address
                )
            ).to.equal(0n);

            expect(
                await cashToken.balanceOf(
                    tarik.address
                )
            ).to.equal(500n);

            expect(
                await cashToken.balanceOf(
                    luay.address
                )
            ).to.equal(0n);

            expect(
                await settlementEngine.isSettled(
                    settlementId
                )
            ).to.equal(false);
        }
    );

    it(
        "reverts the entire settlement if the asset leg fails",
        async function () {
            const {
                ethers,
                settler,
                luay,
                tarik,
                assetToken,
                cashToken,
                settlementEngine,
            } = await deployIntegrationFixture({
                assetMint: 0n,
            });

            const settlementId =
                ethers.id("SETTLEMENT_003");

            const instruction =
                buildInstruction(
                    settlementId,
                    luay.address,
                    tarik.address,
                    await assetToken.getAddress(),
                    await cashToken.getAddress()
                );

            const signature =
                await signSettlementInstruction(
                    luay,
                    settlementEngine,
                    instruction
                );

            await expect(
                settlementEngine
                    .connect(settler)
                    .settle(
                        instruction,
                        signature
                    )
            ).to.be.revert(ethers);

            expect(
                await assetToken.balanceOf(
                    luay.address
                )
            ).to.equal(0n);

            expect(
                await assetToken.balanceOf(
                    tarik.address
                )
            ).to.equal(0n);

            expect(
                await cashToken.balanceOf(
                    tarik.address
                )
            ).to.equal(1000n);

            expect(
                await cashToken.balanceOf(
                    luay.address
                )
            ).to.equal(0n);

            expect(
                await settlementEngine.isSettled(
                    settlementId
                )
            ).to.equal(false);
        }
    );

    it(
        "reverts settlement if the seller has not approved the asset transfer",
        async function () {
            const {
                ethers,
                settler,
                luay,
                tarik,
                assetToken,
                cashToken,
                settlementEngine,
            } = await deployIntegrationFixture({
                approveAsset: false,
            });

            const settlementId =
                ethers.id("SETTLEMENT_004");

            const instruction =
                buildInstruction(
                    settlementId,
                    luay.address,
                    tarik.address,
                    await assetToken.getAddress(),
                    await cashToken.getAddress()
                );

            const signature =
                await signSettlementInstruction(
                    luay,
                    settlementEngine,
                    instruction
                );

            await expect(
                settlementEngine
                    .connect(settler)
                    .settle(
                        instruction,
                        signature
                    )
            ).to.be.revert(ethers);

            expect(
                await assetToken.balanceOf(
                    luay.address
                )
            ).to.equal(100n);

            expect(
                await assetToken.balanceOf(
                    tarik.address
                )
            ).to.equal(0n);

            expect(
                await cashToken.balanceOf(
                    tarik.address
                )
            ).to.equal(1000n);

            expect(
                await cashToken.balanceOf(
                    luay.address
                )
            ).to.equal(0n);

            expect(
                await settlementEngine.isSettled(
                    settlementId
                )
            ).to.equal(false);
        }
    );

    it(
        "reverts settlement if the buyer has not approved the cash transfer",
        async function () {
            const {
                ethers,
                settler,
                luay,
                tarik,
                assetToken,
                cashToken,
                settlementEngine,
            } = await deployIntegrationFixture({
                approveCash: false,
            });

            const settlementId =
                ethers.id("SETTLEMENT_005");

            const instruction =
                buildInstruction(
                    settlementId,
                    luay.address,
                    tarik.address,
                    await assetToken.getAddress(),
                    await cashToken.getAddress()
                );

            const signature =
                await signSettlementInstruction(
                    luay,
                    settlementEngine,
                    instruction
                );

            await expect(
                settlementEngine
                    .connect(settler)
                    .settle(
                        instruction,
                        signature
                    )
            ).to.be.revert(ethers);

            expect(
                await assetToken.balanceOf(
                    luay.address
                )
            ).to.equal(100n);

            expect(
                await assetToken.balanceOf(
                    tarik.address
                )
            ).to.equal(0n);

            expect(
                await cashToken.balanceOf(
                    tarik.address
                )
            ).to.equal(1000n);

            expect(
                await cashToken.balanceOf(
                    luay.address
                )
            ).to.equal(0n);

            expect(
                await settlementEngine.isSettled(
                    settlementId
                )
            ).to.equal(false);
        }
    );

    it(
        "reverts settlement if the buyer is no longer authorized",
        async function () {
            const {
                ethers,
                wael,
                settler,
                luay,
                tarik,
                identityRegistry,
                assetToken,
                cashToken,
                settlementEngine,
            } = await deployIntegrationFixture();

            await identityRegistry
                .connect(wael)
                .revoke(tarik.address);

            const settlementId =
                ethers.id("SETTLEMENT_006");

            const instruction =
                buildInstruction(
                    settlementId,
                    luay.address,
                    tarik.address,
                    await assetToken.getAddress(),
                    await cashToken.getAddress()
                );

            const signature =
                await signSettlementInstruction(
                    luay,
                    settlementEngine,
                    instruction
                );

            await expect(
                settlementEngine
                    .connect(settler)
                    .settle(
                        instruction,
                        signature
                    )
            ).to.be.revert(ethers);

            expect(
                await assetToken.balanceOf(
                    luay.address
                )
            ).to.equal(100n);

            expect(
                await assetToken.balanceOf(
                    tarik.address
                )
            ).to.equal(0n);

            expect(
                await cashToken.balanceOf(
                    tarik.address
                )
            ).to.equal(1000n);

            expect(
                await cashToken.balanceOf(
                    luay.address
                )
            ).to.equal(0n);

            expect(
                await settlementEngine.isSettled(
                    settlementId
                )
            ).to.equal(false);
        }
    );

    it(
        "reverts settlement if the seller is no longer authorized",
        async function () {
            const {
                ethers,
                wael,
                settler,
                luay,
                tarik,
                identityRegistry,
                assetToken,
                cashToken,
                settlementEngine,
            } = await deployIntegrationFixture();

            await identityRegistry
                .connect(wael)
                .revoke(luay.address);

            const settlementId =
                ethers.id("SETTLEMENT_007");

            const instruction =
                buildInstruction(
                    settlementId,
                    luay.address,
                    tarik.address,
                    await assetToken.getAddress(),
                    await cashToken.getAddress()
                );

            /*
             * Important:
             * Luay can still cryptographically sign even though
             * compliance has revoked his transfer eligibility.
             */
            const signature =
                await signSettlementInstruction(
                    luay,
                    settlementEngine,
                    instruction
                );

            await expect(
                settlementEngine
                    .connect(settler)
                    .settle(
                        instruction,
                        signature
                    )
            ).to.be.revert(ethers);

            expect(
                await assetToken.balanceOf(
                    luay.address
                )
            ).to.equal(100n);

            expect(
                await assetToken.balanceOf(
                    tarik.address
                )
            ).to.equal(0n);

            expect(
                await cashToken.balanceOf(
                    tarik.address
                )
            ).to.equal(1000n);

            expect(
                await cashToken.balanceOf(
                    luay.address
                )
            ).to.equal(0n);

            expect(
                await settlementEngine.isSettled(
                    settlementId
                )
            ).to.equal(false);
        }
    );

    it(
        "reverts settlement if the asset token is paused",
        async function () {
            const {
                ethers,
                faris,
                settler,
                luay,
                tarik,
                assetToken,
                cashToken,
                settlementEngine,
            } = await deployIntegrationFixture();

            await assetToken
                .connect(faris)
                .pause();

            const settlementId =
                ethers.id("SETTLEMENT_008");

            const instruction =
                buildInstruction(
                    settlementId,
                    luay.address,
                    tarik.address,
                    await assetToken.getAddress(),
                    await cashToken.getAddress()
                );

            const signature =
                await signSettlementInstruction(
                    luay,
                    settlementEngine,
                    instruction
                );

            await expect(
                settlementEngine
                    .connect(settler)
                    .settle(
                        instruction,
                        signature
                    )
            ).to.be.revert(ethers);

            expect(
                await assetToken.balanceOf(
                    luay.address
                )
            ).to.equal(100n);

            expect(
                await assetToken.balanceOf(
                    tarik.address
                )
            ).to.equal(0n);

            expect(
                await cashToken.balanceOf(
                    tarik.address
                )
            ).to.equal(1000n);

            expect(
                await cashToken.balanceOf(
                    luay.address
                )
            ).to.equal(0n);

            expect(
                await settlementEngine.isSettled(
                    settlementId
                )
            ).to.equal(false);
        }
    );

    it(
        "prevents the same settlement from being executed twice",
        async function () {
            const {
                ethers,
                settler,
                luay,
                tarik,
                assetToken,
                cashToken,
                settlementEngine,
            } = await deployIntegrationFixture({
                assetMint: 200n,
                cashMint: 2000n,
                assetApproval: 200n,
                cashApproval: 2000n,
            });

            const settlementId =
                ethers.id("SETTLEMENT_009");

            const instruction =
                buildInstruction(
                    settlementId,
                    luay.address,
                    tarik.address,
                    await assetToken.getAddress(),
                    await cashToken.getAddress()
                );

            const signature =
                await signSettlementInstruction(
                    luay,
                    settlementEngine,
                    instruction
                );

            // First execution succeeds.
            await settlementEngine
                .connect(settler)
                .settle(
                    instruction,
                    signature
                );

            /*
             * The same valid signed instruction is replayed.
             * Signature verification still passes, but the
             * settlement ID has already been consumed.
             */
            await expect(
                settlementEngine
                    .connect(settler)
                    .settle(
                        instruction,
                        signature
                    )
            )
                .to.be.revertedWithCustomError(
                    settlementEngine,
                    "AlreadySettled"
                )
                .withArgs(settlementId);

            expect(
                await assetToken.balanceOf(
                    luay.address
                )
            ).to.equal(100n);

            expect(
                await assetToken.balanceOf(
                    tarik.address
                )
            ).to.equal(100n);

            expect(
                await cashToken.balanceOf(
                    tarik.address
                )
            ).to.equal(1000n);

            expect(
                await cashToken.balanceOf(
                    luay.address
                )
            ).to.equal(1000n);

            expect(
                await settlementEngine.isSettled(
                    settlementId
                )
            ).to.equal(true);
        }
    );
});