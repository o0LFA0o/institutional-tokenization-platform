import { network } from "hardhat";

const { ethers } = await network.create();

async function main() {
    const [deployer] = await ethers.getSigners();

    const buyerPrivateKey =
        process.env.ARBITRUM_BUYER_PRIVATE_KEY;

    if (!buyerPrivateKey) {
        throw new Error(
            "ARBITRUM_BUYER_PRIVATE_KEY is not loaded"
        );
    }

    const buyer = new ethers.Wallet(
        buyerPrivateKey,
        ethers.provider
    );

    const sellerAddress =
        await deployer.getAddress();

    const buyerAddress =
        await buyer.getAddress();

    const expectedBuyer =
        "0x97d29F995b918518Dcc2481F873C2DC432E4b0Dc";

    if (
        buyerAddress.toLowerCase() !==
        expectedBuyer.toLowerCase()
    ) {
        throw new Error(
            `Unexpected buyer wallet: ${buyerAddress}`
        );
    }

    const identityRegistryAddress =
        "0x1B6e4b00F58269dFb8a8954B2a1Fd17bfE3593E7";

    const assetTokenAddress =
        "0x8E27fb322ab06B890657B640B59b7870Db813c59";

    const cashTokenAddress =
        "0xe504Fd4568aDC3AcCd147d0b7848743F85Ae920f";

    const settlementEngineAddress =
        "0x435D03aC40aDC9c502d2Bed8B3B3F15862ECA9F6";

    const networkInfo =
        await ethers.provider.getNetwork();

    if (networkInfo.chainId !== 421614n) {
        throw new Error(
            `Wrong network: ${networkInfo.chainId}`
        );
    }

    console.log(
        "\n=== LIVE ARBITRUM SEPOLIA DvP DEMO ===\n"
    );

    console.log(
        "Seller / Issuer:",
        sellerAddress
    );

    console.log(
        "Buyer / Investor:",
        buyerAddress
    );

    const identityRegistry =
        await ethers.getContractAt(
            "IdentityRegistry",
            identityRegistryAddress,
            deployer
        );

    const assetToken =
        await ethers.getContractAt(
            "AssetToken",
            assetTokenAddress,
            deployer
        );

    const cashToken =
        await ethers.getContractAt(
            "MockCashToken",
            cashTokenAddress,
            deployer
        );

    const settlementEngine =
        await ethers.getContractAt(
            "SettlementEngine",
            settlementEngineAddress,
            deployer
        );

    // -------------------------------------------------------
    // 1. Authorize institutional participants
    // -------------------------------------------------------

    if (
        !(await identityRegistry.isAuthorized(
            sellerAddress
        ))
    ) {
        console.log(
            "\nAuthorizing seller..."
        );

        const tx =
            await identityRegistry.authorize(
                sellerAddress
            );

        console.log("Tx:", tx.hash);
        await tx.wait();
    }

    if (
        !(await identityRegistry.isAuthorized(
            buyerAddress
        ))
    ) {
        console.log(
            "\nAuthorizing buyer..."
        );

        const tx =
            await identityRegistry.authorize(
                buyerAddress
            );

        console.log("Tx:", tx.hash);
        await tx.wait();
    }

    console.log(
        "\nSeller authorized:",
        await identityRegistry.isAuthorized(
            sellerAddress
        )
    );

    console.log(
        "Buyer authorized: ",
        await identityRegistry.isAuthorized(
            buyerAddress
        )
    );

    // -------------------------------------------------------
    // 2. Issue tokenized institutional asset
    // -------------------------------------------------------

    const assetAmount =
        ethers.parseEther("100");

    let sellerAssetBalance =
        await assetToken.balanceOf(
            sellerAddress
        );

    if (sellerAssetBalance < assetAmount) {
        const mintAmount =
            assetAmount - sellerAssetBalance;

        console.log(
            "\nIssuing",
            ethers.formatEther(mintAmount),
            "TIN..."
        );

        const tx =
            await assetToken.mint(
                sellerAddress,
                mintAmount
            );

        console.log("Tx:", tx.hash);
        await tx.wait();
    }

    // -------------------------------------------------------
    // 3. Fund buyer with mock settlement cash
    // -------------------------------------------------------

    const cashAmount =
        ethers.parseEther("1000");

    let buyerCashBalance =
        await cashToken.balanceOf(
            buyerAddress
        );

    if (buyerCashBalance < cashAmount) {
        const mintAmount =
            cashAmount - buyerCashBalance;

        console.log(
            "\nFunding buyer with",
            ethers.formatEther(mintAmount),
            "MCASH..."
        );

        const tx =
            await cashToken.mint(
                buyerAddress,
                mintAmount
            );

        console.log("Tx:", tx.hash);
        await tx.wait();
    }

    // -------------------------------------------------------
    // 4. Approvals
    // -------------------------------------------------------

    const assetAllowance =
        await assetToken.allowance(
            sellerAddress,
            settlementEngineAddress
        );

    if (assetAllowance < assetAmount) {
        console.log(
            "\nSeller approving SettlementEngine..."
        );

        const tx =
            await assetToken.approve(
                settlementEngineAddress,
                assetAmount
            );

        console.log("Tx:", tx.hash);
        await tx.wait();
    }

    const buyerCashToken =
        cashToken.connect(buyer);

    const cashAllowance =
        await cashToken.allowance(
            buyerAddress,
            settlementEngineAddress
        );

    if (cashAllowance < cashAmount) {
        console.log(
            "\nBuyer approving SettlementEngine..."
        );

        const tx =
            await buyerCashToken.approve(
                settlementEngineAddress,
                cashAmount
            );

        console.log("Tx:", tx.hash);
        await tx.wait();
    }

    // -------------------------------------------------------
    // 5. Settlement instruction
    // -------------------------------------------------------

    const settlementId =
        ethers.id(
            "arbitrum-open-house-demo-001"
        );

    if (
        await settlementEngine.isSettled(
            settlementId
        )
    ) {
        console.log(
            "\nSettlement already completed."
        );

        return;
    }

    const instruction = {
        settlementId,
        seller: sellerAddress,
        buyer: buyerAddress,
        assetToken: assetTokenAddress,
        cashToken: cashTokenAddress,
        assetAmount,
        cashAmount,
    };

    const domain = {
        name:
            "Institutional Tokenization Platform",
        version: "1",
        chainId: networkInfo.chainId,
        verifyingContract:
            settlementEngineAddress,
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

    const signature =
        await deployer.signTypedData(
            domain,
            types,
            instruction
        );

    // -------------------------------------------------------
    // 6. Before settlement
    // -------------------------------------------------------

    console.log(
        "\n=== BEFORE SETTLEMENT ==="
    );

    console.log(
        "Seller TIN:",
        ethers.formatEther(
            await assetToken.balanceOf(
                sellerAddress
            )
        )
    );

    console.log(
        "Seller MCASH:",
        ethers.formatEther(
            await cashToken.balanceOf(
                sellerAddress
            )
        )
    );

    console.log(
        "Buyer TIN:",
        ethers.formatEther(
            await assetToken.balanceOf(
                buyerAddress
            )
        )
    );

    console.log(
        "Buyer MCASH:",
        ethers.formatEther(
            await cashToken.balanceOf(
                buyerAddress
            )
        )
    );

    // -------------------------------------------------------
    // 7. Atomic DvP
    // -------------------------------------------------------

    console.log(
        "\nExecuting atomic DvP settlement..."
    );

    const settlementTx =
        await settlementEngine.settle(
            instruction,
            signature
        );

    console.log(
        "Settlement tx:",
        settlementTx.hash
    );

    await settlementTx.wait();

    // -------------------------------------------------------
    // 8. After settlement
    // -------------------------------------------------------

    console.log(
        "\n=== AFTER SETTLEMENT ==="
    );

    console.log(
        "Seller TIN:",
        ethers.formatEther(
            await assetToken.balanceOf(
                sellerAddress
            )
        )
    );

    console.log(
        "Seller MCASH:",
        ethers.formatEther(
            await cashToken.balanceOf(
                sellerAddress
            )
        )
    );

    console.log(
        "Buyer TIN:",
        ethers.formatEther(
            await assetToken.balanceOf(
                buyerAddress
            )
        )
    );

    console.log(
        "Buyer MCASH:",
        ethers.formatEther(
            await cashToken.balanceOf(
                buyerAddress
            )
        )
    );

    console.log(
        "\nSettlement recorded:",
        await settlementEngine.isSettled(
            settlementId
        )
    );

    console.log(
        "\n=== LIVE DvP COMPLETE ✅ ===\n"
    );
}

await main();
