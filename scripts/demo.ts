import { network } from "hardhat";

const { ethers } = await network.create();

async function main() {
    const [
        faris,
        wael,
        luay,
        tarik,
        settler,
    ] = await ethers.getSigners();

    console.log("\n=== Institutional Tokenization Demo ===\n");

    console.log("Actors:");
    console.log("Faris   (Admin):      ", faris.address);
    console.log("Wa'el   (Compliance): ", wael.address);
    console.log("Luay    (Issuer):     ", luay.address);
    console.log("Tarik   (Investor):   ", tarik.address);
    console.log("Settler (Operator):   ", settler.address);

    // 1. Deploy IdentityRegistry
    const IdentityRegistry =
        await ethers.getContractFactory("IdentityRegistry");

    const identityRegistry =
        await IdentityRegistry.deploy(faris.address);

    await identityRegistry.waitForDeployment();

    // 2. Deploy AssetToken
    const AssetToken =
        await ethers.getContractFactory("AssetToken");

    const assetToken =
        await AssetToken.deploy(
            "Tokenized Note",
            "NOTE",
            await identityRegistry.getAddress(),
            faris.address,
            luay.address,
            faris.address
        );

    await assetToken.waitForDeployment();

    // 3. Deploy MockCashToken
    const MockCashToken =
        await ethers.getContractFactory("MockCashToken");

    const cashToken =
        await MockCashToken.deploy();

    await cashToken.waitForDeployment();

    // 4. Deploy SettlementEngine
    const SettlementEngine =
        await ethers.getContractFactory("SettlementEngine");

    const settlementEngine =
        await SettlementEngine.deploy(
            faris.address,
            settler.address
        );

    await settlementEngine.waitForDeployment();

    console.log("\nContracts:");
    console.log(
        "IdentityRegistry: ",
        await identityRegistry.getAddress()
    );
    console.log(
        "AssetToken:       ",
        await assetToken.getAddress()
    );
    console.log(
        "MockCashToken:    ",
        await cashToken.getAddress()
    );
    console.log(
        "SettlementEngine: ",
        await settlementEngine.getAddress()
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

    console.log("\nParticipant authorization:");
    console.log(
        "Luay authorized: ",
        await identityRegistry.isAuthorized(luay.address)
    );
    console.log(
        "Tarik authorized: ",
        await identityRegistry.isAuthorized(tarik.address)
    );

    const noteAmount =
        ethers.parseEther("100");

    await assetToken
        .connect(luay)
        .mint(
            luay.address,
            noteAmount
        );

    console.log("\nAsset issuance:");
    console.log(
        "Luay NOTE balance:",
        ethers.formatEther(
            await assetToken.balanceOf(luay.address)
        )
    );

    const cashAmount =
        ethers.parseEther("1000");

    await cashToken
        .mint(
            tarik.address,
            cashAmount
        );

    console.log("\nCash funding:");
    console.log(
        "Tarik CASH balance:",
        ethers.formatEther(
            await cashToken.balanceOf(tarik.address)
        )
    );

    const settlementEngineAddress =
        await settlementEngine.getAddress();

    await assetToken
        .connect(luay)
        .approve(
            settlementEngineAddress,
            noteAmount
        );

    await cashToken
        .connect(tarik)
        .approve(
            settlementEngineAddress,
            cashAmount
        );

    console.log("\nSettlement approvals:");
    console.log(
        "Luay NOTE allowance:",
        ethers.formatEther(
            await assetToken.allowance(
                luay.address,
                settlementEngineAddress
            )
        )
    );
    console.log(
        "Tarik CASH allowance:",
        ethers.formatEther(
            await cashToken.allowance(
                tarik.address,
                settlementEngineAddress
            )
        )
    );

    const settlementInstruction = {
        settlementId: ethers.id("demo-settlement-001"),
        seller: luay.address,
        buyer: tarik.address,
        assetToken: await assetToken.getAddress(),
        cashToken: await cashToken.getAddress(),
        assetAmount: noteAmount,
        cashAmount: cashAmount,
    };

    const networkInfo =
        await luay.provider.getNetwork();

    const domain = {
        name: "Institutional Tokenization Platform",
        version: "1",
        chainId: networkInfo.chainId,
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
            settlementInstruction
        );

    console.log("\nSettlement instruction:");
    console.log(
        "Settlement ID:",
        settlementInstruction.settlementId
    );
    console.log(
        "Seller:       ",
        settlementInstruction.seller
    );
    console.log(
        "Buyer:        ",
        settlementInstruction.buyer
    );
    console.log(
        "Asset amount: ",
        ethers.formatEther(
            settlementInstruction.assetAmount
        ),
        "NOTE"
    );
    console.log(
        "Cash amount:  ",
        ethers.formatEther(
            settlementInstruction.cashAmount
        ),
        "CASH"
    );

    console.log("\nSeller authorization:");
    console.log(
        "Luay signed the settlement instruction."
    );
    console.log("Signature:", signature);

    console.log("\n=== BEFORE SETTLEMENT ===");

    console.log(
        "Luay NOTE:",
        ethers.formatEther(
            await assetToken.balanceOf(luay.address)
        )
    );
    console.log(
        "Luay CASH:",
        ethers.formatEther(
            await cashToken.balanceOf(luay.address)
        )
    );
    console.log(
        "Tarik NOTE:",
        ethers.formatEther(
            await assetToken.balanceOf(tarik.address)
        )
    );
    console.log(
        "Tarik CASH:",
        ethers.formatEther(
            await cashToken.balanceOf(tarik.address)
        )
    );

    console.log(
        "\nExecuting atomic DvP settlement..."
    );

    const settlementTx =
        await settlementEngine
            .connect(settler)
            .settle(
                settlementInstruction,
                signature
            );

    await settlementTx.wait();

    console.log("\n=== AFTER SETTLEMENT ===");

    console.log(
        "Luay NOTE:",
        ethers.formatEther(
            await assetToken.balanceOf(luay.address)
        )
    );
    console.log(
        "Luay CASH:",
        ethers.formatEther(
            await cashToken.balanceOf(luay.address)
        )
    );
    console.log(
        "Tarik NOTE:",
        ethers.formatEther(
            await assetToken.balanceOf(tarik.address)
        )
    );
    console.log(
        "Tarik CASH:",
        ethers.formatEther(
            await cashToken.balanceOf(tarik.address)
        )
    );

    console.log(
        "\nSettlement executed:",
        await settlementEngine.isSettled(
            settlementInstruction.settlementId
        )
    );

    console.log("\nDeployment complete.\n");
}

await main();