import { network } from "hardhat";

const { ethers } = await network.create();

async function main() {
    const [deployer] = await ethers.getSigners();

    const deployerAddress = await deployer.getAddress();
    const networkInfo = await ethers.provider.getNetwork();
    const balance = await ethers.provider.getBalance(deployerAddress);

    console.log("\n=== Arbitrum Deployment ===\n");
    console.log("Chain ID: ", networkInfo.chainId.toString());
    console.log("Deployer: ", deployerAddress);
    console.log("Balance:  ", ethers.formatEther(balance), "ETH");

    // -------------------------------------------------------
    // 1. Identity Registry
    // -------------------------------------------------------

    console.log("\nDeploying IdentityRegistry...");

    const identityRegistry = await ethers.deployContract(
        "IdentityRegistry",
        [deployerAddress],
        deployer
    );

    await identityRegistry.waitForDeployment();

    const identityRegistryAddress =
        await identityRegistry.getAddress();

    console.log(
        "IdentityRegistry:",
        identityRegistryAddress
    );

    // Bootstrap deployer as compliance operator
    const complianceRole =
        await identityRegistry.COMPLIANCE_ROLE();

    const grantComplianceTx =
        await identityRegistry.grantRole(
            complianceRole,
            deployerAddress
        );

    await grantComplianceTx.wait();

    console.log(
        "Compliance role granted to deployer."
    );

    // -------------------------------------------------------
    // 2. Permissioned RWA Token
    // -------------------------------------------------------

    console.log("\nDeploying AssetToken...");

    const assetToken = await ethers.deployContract(
        "AssetToken",
        [
            "Tokenized Institutional Note",
            "TIN",
            identityRegistryAddress,
            deployerAddress, // admin
            deployerAddress, // issuer
            deployerAddress, // pauser
        ],
        deployer
    );

    await assetToken.waitForDeployment();

    const assetTokenAddress =
        await assetToken.getAddress();

    console.log(
        "AssetToken:",
        assetTokenAddress
    );

    // -------------------------------------------------------
    // 3. Mock Settlement Cash
    // -------------------------------------------------------

    console.log("\nDeploying MockCashToken...");

    const cashToken = await ethers.deployContract(
        "MockCashToken",
        [],
        deployer
    );

    await cashToken.waitForDeployment();

    const cashTokenAddress =
        await cashToken.getAddress();

    console.log(
        "MockCashToken:",
        cashTokenAddress
    );

    // -------------------------------------------------------
    // 4. Settlement Engine
    // -------------------------------------------------------

    console.log("\nDeploying SettlementEngine...");

    const settlementEngine =
        await ethers.deployContract(
            "SettlementEngine",
            [
                deployerAddress, // admin
                deployerAddress, // settler
            ],
            deployer
        );

    await settlementEngine.waitForDeployment();

    const settlementEngineAddress =
        await settlementEngine.getAddress();

    console.log(
        "SettlementEngine:",
        settlementEngineAddress
    );

    // -------------------------------------------------------
    // Summary
    // -------------------------------------------------------

    console.log("\n=== DEPLOYMENT COMPLETE ===\n");

    console.log(
        "IdentityRegistry: ",
        identityRegistryAddress
    );

    console.log(
        "AssetToken:       ",
        assetTokenAddress
    );

    console.log(
        "MockCashToken:    ",
        cashTokenAddress
    );

    console.log(
        "SettlementEngine: ",
        settlementEngineAddress
    );

    console.log(
        "\nSave these addresses for the frontend and HackQuest submission.\n"
    );
}

await main();
