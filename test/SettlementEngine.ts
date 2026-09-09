import { expect } from "chai";
import { network } from "hardhat";

describe("SettlementEngine", function () {
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

    async function deploySettlementEngine() {
        const { ethers } = await network.create();

        const [
            faris,
            settler,
            seller,
            buyer,
            other,
            assetToken,
            cashToken,
        ] = await ethers.getSigners();

        const SettlementEngine =
            await ethers.getContractFactory(
                "SettlementEngine"
            );

        const settlementEngine =
            await SettlementEngine.deploy(
                faris.address,
                settler.address
            );

        const settlementId =
            ethers.id("SETTLEMENT_001");

        const instruction = {
            settlementId,
            seller: seller.address,
            buyer: buyer.address,
            assetToken: assetToken.address,
            cashToken: cashToken.address,
            assetAmount: 100n,
            cashAmount: 1000n,
        };

        return {
            ethers,
            faris,
            settler,
            seller,
            buyer,
            other,
            assetToken,
            cashToken,
            settlementEngine,
            settlementId,
            instruction,
        };
    }

    async function deployFundedSettlement() {
        const { ethers } = await network.create();

        const [
            faris,
            settler,
            seller,
            buyer,
        ] = await ethers.getSigners();

        const SettlementEngine =
            await ethers.getContractFactory(
                "SettlementEngine"
            );

        const settlementEngine =
            await SettlementEngine.deploy(
                faris.address,
                settler.address
            );

        const MockCashToken =
            await ethers.getContractFactory(
                "MockCashToken"
            );

        const assetToken =
            await MockCashToken.deploy();

        const cashToken =
            await MockCashToken.deploy();

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
            assetToken:
                await assetToken.getAddress(),
            cashToken:
                await cashToken.getAddress(),
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

    it(
        "starts with a settlement as unsettled",
        async function () {
            const {
                settlementEngine,
                settlementId,
            } = await deploySettlementEngine();

            expect(
                await settlementEngine.isSettled(
                    settlementId
                )
            ).to.equal(false);
        }
    );

    it(
        "marks a settlement as settled",
        async function () {
            const {
                settler,
                seller,
                settlementEngine,
                settlementId,
                instruction,
            } = await deployFundedSettlement();

            const signature =
                await signSettlementInstruction(
                    seller,
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
                await settlementEngine.isSettled(
                    settlementId
                )
            ).to.equal(true);
        }
    );

    it(
        "prevents the same settlement from being settled twice",
        async function () {
            const {
                settler,
                seller,
                settlementEngine,
                settlementId,
                instruction,
            } = await deployFundedSettlement();

            const signature =
                await signSettlementInstruction(
                    seller,
                    settlementEngine,
                    instruction
                );

            await settlementEngine
                .connect(settler)
                .settle(
                    instruction,
                    signature
                );

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
        }
    );

    it(
        "emits a settlement completion event",
        async function () {
            const {
                settler,
                seller,
                settlementEngine,
                settlementId,
                instruction,
            } = await deployFundedSettlement();

            const signature =
                await signSettlementInstruction(
                    seller,
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
            )
                .to.emit(
                    settlementEngine,
                    "SettlementCompleted"
                )
                .withArgs(
                    settlementId,
                    settler.address
                );
        }
    );

    it(
        "rejects a zero settlement ID",
        async function () {
            const {
                ethers,
                settler,
                settlementEngine,
                instruction,
            } = await deploySettlementEngine();

            const invalidInstruction = {
                ...instruction,
                settlementId: ethers.ZeroHash,
            };

            await expect(
                settlementEngine
                    .connect(settler)
                    .settle(
                        invalidInstruction,
                        "0x"
                    )
            ).to.be.revertedWithCustomError(
                settlementEngine,
                "InvalidSettlementId"
            );
        }
    );

    it(
        "rejects a zero seller address",
        async function () {
            const {
                ethers,
                settler,
                settlementEngine,
                instruction,
            } = await deploySettlementEngine();

            const invalidInstruction = {
                ...instruction,
                seller: ethers.ZeroAddress,
            };

            await expect(
                settlementEngine
                    .connect(settler)
                    .settle(
                        invalidInstruction,
                        "0x"
                    )
            ).to.be.revertedWithCustomError(
                settlementEngine,
                "InvalidSeller"
            );
        }
    );

    it(
        "rejects a zero buyer address",
        async function () {
            const {
                ethers,
                settler,
                settlementEngine,
                instruction,
            } = await deploySettlementEngine();

            const invalidInstruction = {
                ...instruction,
                buyer: ethers.ZeroAddress,
            };

            await expect(
                settlementEngine
                    .connect(settler)
                    .settle(
                        invalidInstruction,
                        "0x"
                    )
            ).to.be.revertedWithCustomError(
                settlementEngine,
                "InvalidBuyer"
            );
        }
    );

    it(
        "rejects a zero asset token address",
        async function () {
            const {
                ethers,
                settler,
                settlementEngine,
                instruction,
            } = await deploySettlementEngine();

            const invalidInstruction = {
                ...instruction,
                assetToken: ethers.ZeroAddress,
            };

            await expect(
                settlementEngine
                    .connect(settler)
                    .settle(
                        invalidInstruction,
                        "0x"
                    )
            ).to.be.revertedWithCustomError(
                settlementEngine,
                "InvalidAssetToken"
            );
        }
    );

    it(
        "rejects a zero cash token address",
        async function () {
            const {
                ethers,
                settler,
                settlementEngine,
                instruction,
            } = await deploySettlementEngine();

            const invalidInstruction = {
                ...instruction,
                cashToken: ethers.ZeroAddress,
            };

            await expect(
                settlementEngine
                    .connect(settler)
                    .settle(
                        invalidInstruction,
                        "0x"
                    )
            ).to.be.revertedWithCustomError(
                settlementEngine,
                "InvalidCashToken"
            );
        }
    );

    it(
        "rejects a zero asset amount",
        async function () {
            const {
                settler,
                settlementEngine,
                instruction,
            } = await deploySettlementEngine();

            const invalidInstruction = {
                ...instruction,
                assetAmount: 0n,
            };

            await expect(
                settlementEngine
                    .connect(settler)
                    .settle(
                        invalidInstruction,
                        "0x"
                    )
            ).to.be.revertedWithCustomError(
                settlementEngine,
                "InvalidAssetAmount"
            );
        }
    );

    it(
        "rejects a zero cash amount",
        async function () {
            const {
                settler,
                settlementEngine,
                instruction,
            } = await deploySettlementEngine();

            const invalidInstruction = {
                ...instruction,
                cashAmount: 0n,
            };

            await expect(
                settlementEngine
                    .connect(settler)
                    .settle(
                        invalidInstruction,
                        "0x"
                    )
            ).to.be.revertedWithCustomError(
                settlementEngine,
                "InvalidCashAmount"
            );
        }
    );

    it(
        "rejects settlement from an unauthorized caller",
        async function () {
            const {
                ethers,
                seller,
                other,
                settlementEngine,
                instruction,
            } = await deploySettlementEngine();

            const signature =
                await signSettlementInstruction(
                    seller,
                    settlementEngine,
                    instruction
                );

            await expect(
                settlementEngine
                    .connect(other)
                    .settle(
                        instruction,
                        signature
                    )
            ).to.be.revertedWithCustomError(
                settlementEngine,
                "AccessControlUnauthorizedAccount"
            ).withArgs(
                other.address,
                await settlementEngine.SETTLER_ROLE()
            );
        }
    );

    it(
        "rejects a zero admin address",
        async function () {
            const { ethers } =
                await network.create();

            const [
                faris,
                settler,
            ] = await ethers.getSigners();

            const SettlementEngine =
                await ethers.getContractFactory(
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
        }
    );

    it(
        "rejects a zero settler address",
        async function () {
            const { ethers } =
                await network.create();

            const [
                faris,
            ] = await ethers.getSigners();

            const SettlementEngine =
                await ethers.getContractFactory(
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
        }
    );

    it("rejects a settlement signed by someone other than the seller", async function () {
        const { ethers } = await network.create();

        const [admin, settler, luay, tarik, ahmed] =
            await ethers.getSigners();

        const SettlementEngine =
            await ethers.getContractFactory("SettlementEngine");

        const settlementEngine =
            await SettlementEngine.deploy(
                admin.address,
                settler.address
            );

        const instruction = {
            settlementId: ethers.id("wrong-signer-test"),
            seller: luay.address,
            buyer: tarik.address,
            assetToken: ethers.Wallet.createRandom().address,
            cashToken: ethers.Wallet.createRandom().address,
            assetAmount: ethers.parseEther("100"),
            cashAmount: ethers.parseEther("1000"),
        };

        const signature =
            await signSettlementInstruction(
                ahmed,
                settlementEngine,
                instruction
            );

        await expect(
            settlementEngine
                .connect(settler)
                .settle(instruction, signature)
        ).to.be.revertedWithCustomError(
            settlementEngine,
            "InvalidSignature"
        );
    });

    it("rejects settlement terms modified after the seller signs", async function () {
        const { ethers } = await network.create();

        const [admin, settler, luay, tarik] =
            await ethers.getSigners();

        const SettlementEngine =
            await ethers.getContractFactory("SettlementEngine");

        const settlementEngine =
            await SettlementEngine.deploy(
                admin.address,
                settler.address
            );

        const signedInstruction = {
            settlementId: ethers.id("tampered-instruction-test"),
            seller: luay.address,
            buyer: tarik.address,
            assetToken: ethers.Wallet.createRandom().address,
            cashToken: ethers.Wallet.createRandom().address,
            assetAmount: ethers.parseEther("100"),
            cashAmount: ethers.parseEther("1000"),
        };

        const signature =
            await signSettlementInstruction(
                luay,
                settlementEngine,
                signedInstruction
            );

        const tamperedInstruction = {
            ...signedInstruction,
            cashAmount: ethers.parseEther("10000"),
        };

        await expect(
            settlementEngine
                .connect(settler)
                .settle(tamperedInstruction, signature)
        ).to.be.revertedWithCustomError(
            settlementEngine,
            "InvalidSignature"
        );
    });

    it("rejects a signature created for a different SettlementEngine", async function () {
        const { ethers } = await network.create();

        const [admin, settler, luay, tarik] =
            await ethers.getSigners();

        const SettlementEngine =
            await ethers.getContractFactory("SettlementEngine");

        const settlementEngineA =
            await SettlementEngine.deploy(
                admin.address,
                settler.address
            );

        const settlementEngineB =
            await SettlementEngine.deploy(
                admin.address,
                settler.address
            );

        const instruction = {
            settlementId: ethers.id("different-engine-test"),
            seller: luay.address,
            buyer: tarik.address,
            assetToken: ethers.Wallet.createRandom().address,
            cashToken: ethers.Wallet.createRandom().address,
            assetAmount: ethers.parseEther("100"),
            cashAmount: ethers.parseEther("1000"),
        };

        const signature =
            await signSettlementInstruction(
                luay,
                settlementEngineA,
                instruction
            );

        await expect(
            settlementEngineB
                .connect(settler)
                .settle(instruction, signature)
        ).to.be.revertedWithCustomError(
            settlementEngineB,
            "InvalidSignature"
        );
    });

    it("rejects a signature created for a different chain ID", async function () {
        const { ethers } = await network.create();

        const [admin, settler, luay, tarik] =
            await ethers.getSigners();

        const SettlementEngine =
            await ethers.getContractFactory("SettlementEngine");

        const settlementEngine =
            await SettlementEngine.deploy(
                admin.address,
                settler.address
            );

        const instruction = {
            settlementId: ethers.id("different-chain-test"),
            seller: luay.address,
            buyer: tarik.address,
            assetToken: ethers.Wallet.createRandom().address,
            cashToken: ethers.Wallet.createRandom().address,
            assetAmount: ethers.parseEther("100"),
            cashAmount: ethers.parseEther("1000"),
        };

        const networkInfo =
            await luay.provider.getNetwork();

        const wrongChainId =
            networkInfo.chainId + 1n;

        const domain = {
            name: "Institutional Tokenization Platform",
            version: "1",
            chainId: wrongChainId,
            verifyingContract:
                await settlementEngine.getAddress(),
        };

        const types = {
            SettlementInstruction: [
                { name: "settlementId", type: "bytes32" },
                { name: "seller", type: "address" },
                { name: "buyer", type: "address" },
                { name: "assetToken", type: "address" },
                { name: "cashToken", type: "address" },
                { name: "assetAmount", type: "uint256" },
                { name: "cashAmount", type: "uint256" },
            ],
        };

        const signature =
            await luay.signTypedData(
                domain,
                types,
                instruction
            );

        await expect(
            settlementEngine
                .connect(settler)
                .settle(instruction, signature)
        ).to.be.revertedWithCustomError(
            settlementEngine,
            "InvalidSignature"
        );
    });
});