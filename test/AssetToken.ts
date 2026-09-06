import { expect } from "chai";
import { network } from "hardhat";

async function deployAssetToken() {
    const { ethers } = await network.create();

    const [faris, wael, luay, tarik] = await ethers.getSigners();

    const IdentityRegistry = await ethers.getContractFactory(
        "IdentityRegistry",
        faris
    );

    const registry = await IdentityRegistry.deploy(faris.address);

    const AssetToken = await ethers.getContractFactory(
        "AssetToken",
        faris
    );

    const asset = await AssetToken.deploy(
        "Luay Institutional Note",
        "LIN",
        await registry.getAddress(),
        faris.address,
        luay.address,
        faris.address
    );

    return {
        ethers,
        faris,
        wael,
        luay,
        tarik,
        registry,
        asset
    };
}

describe("AssetToken", function () {
    it("deploys with the correct name and symbol", async function () {
        const {
            faris,
            luay,
            registry,
            asset
        } = await deployAssetToken();

        expect(await asset.name()).to.equal("Luay Institutional Note");
        expect(await asset.symbol()).to.equal("LIN");

        expect(await asset.identityRegistry()).to.equal(
            await registry.getAddress()
        );

        const adminRole = await asset.DEFAULT_ADMIN_ROLE();

        expect(
            await asset.hasRole(adminRole, faris.address)
        ).to.equal(true);

        const issuerRole = await asset.ISSUER_ROLE();

        expect(
            await asset.hasRole(issuerRole, luay.address)
        ).to.equal(true);

        const pauserRole = await asset.PAUSER_ROLE();

        expect(
            await asset.hasRole(pauserRole, faris.address)
        ).to.equal(true);

        expect(await asset.paused()).to.equal(false);
    });

    it("allows Faris to pause the token", async function () {
        const {
            faris,
            asset
        } = await deployAssetToken();

        await asset.connect(faris).pause();

        expect(await asset.paused()).to.equal(true);
    });

    it("prevents Luay from pausing the token", async function () {
        const {
            luay,
            asset
        } = await deployAssetToken();

        const pauserRole = await asset.PAUSER_ROLE();

        await expect(
            asset.connect(luay).pause()
        )
            .to.be.revertedWithCustomError(
                asset,
                "AccessControlUnauthorizedAccount"
            )
            .withArgs(luay.address, pauserRole);
    });

    it("allows Faris to unpause the token", async function () {
        const {
            faris,
            asset
        } = await deployAssetToken();

        await asset.connect(faris).pause();
        await asset.connect(faris).unpause();

        expect(await asset.paused()).to.equal(false);
    });

    it("prevents Luay from unpausing the token", async function () {
        const {
            faris,
            luay,
            asset
        } = await deployAssetToken();

        await asset.connect(faris).pause();

        const pauserRole = await asset.PAUSER_ROLE();

        await expect(
            asset.connect(luay).unpause()
        )
            .to.be.revertedWithCustomError(
                asset,
                "AccessControlUnauthorizedAccount"
            )
            .withArgs(luay.address, pauserRole);
    });

    it("allows Luay to mint tokens to authorized Tarik", async function () {
        const {
            faris,
            wael,
            luay,
            tarik,
            registry,
            asset
        } = await deployAssetToken();

        const complianceRole = await registry.COMPLIANCE_ROLE();

        await registry
            .connect(faris)
            .grantRole(complianceRole, wael.address);

        await registry
            .connect(wael)
            .authorize(tarik.address);

        await asset
            .connect(luay)
            .mint(tarik.address, 100n);

        expect(
            await asset.balanceOf(tarik.address)
        ).to.equal(100n);
            });

    it("prevents Luay from minting tokens to unauthorized Tarik", async function () {
        const {
            luay,
            tarik,
            asset
        } = await deployAssetToken();

        await expect(
            asset
                .connect(luay)
                .mint(tarik.address, 100n)
        ).to.be.revertedWithCustomError(
            asset,
            "InvalidRecipient"
        );
    });

    it("prevents Faris from minting without the issuer role", async function () {
        const {
            faris,
            wael,
            tarik,
            registry,
            asset
        } = await deployAssetToken();

        const complianceRole = await registry.COMPLIANCE_ROLE();

        await registry
            .connect(faris)
            .grantRole(complianceRole, wael.address);

        await registry
            .connect(wael)
            .authorize(tarik.address);

        const issuerRole = await asset.ISSUER_ROLE();

        await expect(
            asset
                .connect(faris)
                .mint(tarik.address, 100n)
        )
            .to.be.revertedWithCustomError(
                asset,
                "AccessControlUnauthorizedAccount"
            )
            .withArgs(faris.address, issuerRole);
    });

    it("prevents minting while the token is paused", async function () {
        const {
            faris,
            wael,
            luay,
            tarik,
            registry,
            asset
        } = await deployAssetToken();

        const complianceRole = await registry.COMPLIANCE_ROLE();

        await registry
            .connect(faris)
            .grantRole(complianceRole, wael.address);

        await registry
            .connect(wael)
            .authorize(tarik.address);

        await asset
            .connect(faris)
            .pause();

        await expect(
            asset
                .connect(luay)
                .mint(tarik.address, 100n)
        ).to.be.revertedWithCustomError(
            asset,
            "EnforcedPause"
        );
    });

    it("allows transfers between authorized participants", async function () {
        const {
            faris,
            wael,
            luay,
            tarik,
            registry,
            asset
        } = await deployAssetToken();

        const complianceRole = await registry.COMPLIANCE_ROLE();

        await registry
            .connect(faris)
            .grantRole(complianceRole, wael.address);

        await registry
            .connect(wael)
            .authorize(tarik.address);

        await registry
            .connect(wael)
            .authorize(luay.address);

        await asset
            .connect(luay)
            .mint(tarik.address, 100n);

        await asset
            .connect(tarik)
            .transfer(luay.address, 40n);

        expect(
            await asset.balanceOf(tarik.address)
        ).to.equal(60n);

        expect(
            await asset.balanceOf(luay.address)
        ).to.equal(40n);
    });

    it("prevents transfers to unauthorized participants", async function () {
        const {
            faris,
            wael,
            luay,
            tarik,
            registry,
            asset
        } = await deployAssetToken();

        const complianceRole = await registry.COMPLIANCE_ROLE();

        await registry
            .connect(faris)
            .grantRole(complianceRole, wael.address);

        await registry
            .connect(wael)
            .authorize(tarik.address);

        await asset
            .connect(luay)
            .mint(tarik.address, 100n);

        await expect(
            asset
                .connect(tarik)
                .transfer(luay.address, 40n)
        ).to.be.revertedWithCustomError(
            asset,
            "InvalidRecipient"
        );
    });

    it("prevents revoked participants from sending tokens", async function () {
        const {
            faris,
            wael,
            luay,
            tarik,
            registry,
            asset
        } = await deployAssetToken();

        const complianceRole = await registry.COMPLIANCE_ROLE();

        await registry
            .connect(faris)
            .grantRole(complianceRole, wael.address);

        await registry
            .connect(wael)
            .authorize(tarik.address);

        await registry
            .connect(wael)
            .authorize(luay.address);

        await asset
            .connect(luay)
            .mint(tarik.address, 100n);

        await registry
            .connect(wael)
            .revoke(tarik.address);

        await expect(
            asset
                .connect(tarik)
                .transfer(luay.address, 40n)
        ).to.be.revertedWithCustomError(
            asset,
            "InvalidSender"
        );
    });

    it("prevents transfers while the token is paused", async function () {
        const {
            faris,
            wael,
            luay,
            tarik,
            registry,
            asset
        } = await deployAssetToken();

        const complianceRole = await registry.COMPLIANCE_ROLE();

        await registry
            .connect(faris)
            .grantRole(complianceRole, wael.address);

        await registry
            .connect(wael)
            .authorize(tarik.address);

        await registry
            .connect(wael)
            .authorize(luay.address);

        await asset
            .connect(luay)
            .mint(tarik.address, 100n);

        await asset
            .connect(faris)
            .pause();

        await expect(
            asset
                .connect(tarik)
                .transfer(luay.address, 40n)
        ).to.be.revertedWithCustomError(
            asset,
            "EnforcedPause"
        );
    });

    it("allows Luay to burn tokens from authorized Tarik", async function () {
        const {
            faris,
            wael,
            luay,
            tarik,
            registry,
            asset
        } = await deployAssetToken();

        const complianceRole = await registry.COMPLIANCE_ROLE();

        await registry
            .connect(faris)
            .grantRole(complianceRole, wael.address);

        await registry
            .connect(wael)
            .authorize(tarik.address);

        await asset
            .connect(luay)
            .mint(tarik.address, 100n);

        await asset
            .connect(luay)
            .burn(tarik.address, 40n);

        expect(
            await asset.balanceOf(tarik.address)
        ).to.equal(60n);

        expect(
            await asset.totalSupply()
        ).to.equal(60n);
    });

    it("prevents Faris from burning without the issuer role", async function () {
        const {
            faris,
            wael,
            luay,
            tarik,
            registry,
            asset
        } = await deployAssetToken();

        const complianceRole = await registry.COMPLIANCE_ROLE();

        await registry
            .connect(faris)
            .grantRole(complianceRole, wael.address);

        await registry
            .connect(wael)
            .authorize(tarik.address);

        await asset
            .connect(luay)
            .mint(tarik.address, 100n);

        const issuerRole = await asset.ISSUER_ROLE();

        await expect(
            asset
                .connect(faris)
                .burn(tarik.address, 40n)
        )
            .to.be.revertedWithCustomError(
                asset,
                "AccessControlUnauthorizedAccount"
            )
            .withArgs(faris.address, issuerRole);
    });

    it("prevents burning while the token is paused", async function () {
        const {
            faris,
            wael,
            luay,
            tarik,
            registry,
            asset
        } = await deployAssetToken();

        const complianceRole = await registry.COMPLIANCE_ROLE();

        await registry
            .connect(faris)
            .grantRole(complianceRole, wael.address);

        await registry
            .connect(wael)
            .authorize(tarik.address);

        await asset
            .connect(luay)
            .mint(tarik.address, 100n);

        await asset
            .connect(faris)
            .pause();

        await expect(
            asset
                .connect(luay)
                .burn(tarik.address, 40n)
        ).to.be.revertedWithCustomError(
            asset,
            "EnforcedPause"
        );
    });

    it("allows Luay to burn tokens from revoked Tarik", async function () {
        const {
            faris,
            wael,
            luay,
            tarik,
            registry,
            asset
        } = await deployAssetToken();

        const complianceRole = await registry.COMPLIANCE_ROLE();

        await registry
            .connect(faris)
            .grantRole(complianceRole, wael.address);

        await registry
            .connect(wael)
            .authorize(tarik.address);

        await asset
            .connect(luay)
            .mint(tarik.address, 100n);

        await registry
            .connect(wael)
            .revoke(tarik.address);

        await asset
            .connect(luay)
            .burn(tarik.address, 40n);

        expect(
            await asset.balanceOf(tarik.address)
        ).to.equal(60n);
    });

    it("rejects the zero address as the identity registry", async function () {
        const { ethers } = await network.create();

        const [faris, luay] = await ethers.getSigners();

        const AssetToken = await ethers.getContractFactory(
            "AssetToken",
            faris
        );

        await expect(
            AssetToken.deploy(
                "Luay Institutional Note",
                "LIN",
                ethers.ZeroAddress,
                faris.address,
                luay.address,
                faris.address
            )
        ).to.be.revertedWithCustomError(
            AssetToken,
            "InvalidIdentityRegistry"
        );
    });

    it("rejects the zero address as admin", async function () {
        const { ethers } = await network.create();

        const [faris, luay] = await ethers.getSigners();

        const IdentityRegistry = await ethers.getContractFactory(
            "IdentityRegistry",
            faris
        );

        const registry = await IdentityRegistry.deploy(faris.address);

        const AssetToken = await ethers.getContractFactory(
            "AssetToken",
            faris
        );

        await expect(
            AssetToken.deploy(
                "Luay Institutional Note",
                "LIN",
                await registry.getAddress(),
                ethers.ZeroAddress,
                luay.address,
                faris.address
            )
        ).to.be.revertedWithCustomError(
            AssetToken,
            "InvalidAdmin"
        );
    });

    it("rejects the zero address as issuer", async function () {
        const { ethers } = await network.create();

        const [faris] = await ethers.getSigners();

        const IdentityRegistry = await ethers.getContractFactory(
            "IdentityRegistry",
            faris
        );

        const registry = await IdentityRegistry.deploy(faris.address);

        const AssetToken = await ethers.getContractFactory(
            "AssetToken",
            faris
        );

        await expect(
            AssetToken.deploy(
                "Luay Institutional Note",
                "LIN",
                await registry.getAddress(),
                faris.address,
                ethers.ZeroAddress,
                faris.address
            )
        ).to.be.revertedWithCustomError(
            AssetToken,
            "InvalidIssuer"
        );
    });

    it("rejects the zero address as pauser", async function () {
        const { ethers } = await network.create();

        const [faris, luay] = await ethers.getSigners();

        const IdentityRegistry = await ethers.getContractFactory(
            "IdentityRegistry",
            faris
        );

        const registry = await IdentityRegistry.deploy(faris.address);

        const AssetToken = await ethers.getContractFactory(
            "AssetToken",
            faris
        );

        await expect(
            AssetToken.deploy(
                "Luay Institutional Note",
                "LIN",
                await registry.getAddress(),
                faris.address,
                luay.address,
                ethers.ZeroAddress
            )
        ).to.be.revertedWithCustomError(
            AssetToken,
            "InvalidPauser"
        );
    });

    it("prevents Luay from minting after losing the issuer role", async function () {
        const {
            faris,
            wael,
            luay,
            tarik,
            registry,
            asset
        } = await deployAssetToken();

        const complianceRole = await registry.COMPLIANCE_ROLE();

        await registry
            .connect(faris)
            .grantRole(complianceRole, wael.address);

        await registry
            .connect(wael)
            .authorize(tarik.address);

        const issuerRole = await asset.ISSUER_ROLE();

        await asset
            .connect(faris)
            .revokeRole(issuerRole, luay.address);

        await expect(
            asset
                .connect(luay)
                .mint(tarik.address, 100n)
        )
            .to.be.revertedWithCustomError(
                asset,
                "AccessControlUnauthorizedAccount"
            )
            .withArgs(luay.address, issuerRole);
    });

    it("prevents Faris from pausing after losing the pauser role", async function () {
        const {
            faris,
            asset
        } = await deployAssetToken();

        const pauserRole = await asset.PAUSER_ROLE();

        await asset
            .connect(faris)
            .revokeRole(pauserRole, faris.address);

        await expect(
            asset
                .connect(faris)
                .pause()
        )
            .to.be.revertedWithCustomError(
                asset,
                "AccessControlUnauthorizedAccount"
            )
            .withArgs(faris.address, pauserRole);
    });
});