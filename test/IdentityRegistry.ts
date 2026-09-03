import { expect } from "chai";
import { network } from "hardhat";

async function deployRegistry() {
    const { ethers } = await network.create();
    const [faris, wael, luay, tarik] = await ethers.getSigners();

    const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry", faris);
    const registry = await IdentityRegistry.deploy(faris.address);

    return { ethers, faris, wael, luay, tarik, registry };
}

describe("IdentityRegistry", function () {
    it("grants the default admin role to Faris", async function () {
        const { registry, faris } = await deployRegistry();

        const defaultAdminRole = await registry.DEFAULT_ADMIN_ROLE();

        expect(
            await registry.hasRole(defaultAdminRole, faris.address)
        ).to.equal(true);
    });

    it("rejects the zero address as admin", async function () {
        const { ethers } = await network.create();

        const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");

        await expect(
            IdentityRegistry.deploy(ethers.ZeroAddress)
        ).to.be.revertedWithCustomError(IdentityRegistry, "InvalidAccount");
    });

    it("starts Tarik as unauthorized", async function () {
        const { registry, tarik } = await deployRegistry();

        expect(await registry.isAuthorized(tarik.address)).to.equal(false);
    });

    it("allows Faris to grant the compliance role to Wa'el", async function () {
        const { registry, faris, wael } = await deployRegistry();

        const complianceRole = await registry.COMPLIANCE_ROLE();

        await registry.grantRole(complianceRole, wael.address);

        expect(
            await registry.hasRole(complianceRole, wael.address)
        ).to.equal(true);
    });

    it("prevents Luay from granting the compliance role to Wa'el", async function () {
        const { registry, luay, wael } = await deployRegistry();

        const complianceRole = await registry.COMPLIANCE_ROLE();
        const defaultAdminRole = await registry.DEFAULT_ADMIN_ROLE();

        await expect(
            registry.connect(luay).grantRole(complianceRole, wael.address)
        )
            .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount")
            .withArgs(luay.address, defaultAdminRole);
    });

    it("allows Wa'el to authorize Tarik", async function () {
        const { registry, wael, tarik } = await deployRegistry();

        const complianceRole = await registry.COMPLIANCE_ROLE();

        await registry.grantRole(complianceRole, wael.address);

        await registry.connect(wael).authorize(tarik.address);

        expect(await registry.isAuthorized(tarik.address)).to.equal(true);
    });

    it("emits an audit event when Wa'el authorizes Tarik", async function () {
        const { registry, wael, tarik } = await deployRegistry();

        const complianceRole = await registry.COMPLIANCE_ROLE();

        await registry.grantRole(complianceRole, wael.address);

        await expect(
            registry.connect(wael).authorize(tarik.address)
        )
            .to.emit(registry, "ParticipantAuthorized")
            .withArgs(tarik.address, wael.address);
    });

    it("prevents Luay from authorizing Tarik without the compliance role", async function () {
        const { registry, luay, tarik } = await deployRegistry();

        const complianceRole = await registry.COMPLIANCE_ROLE();

        await expect(
            registry.connect(luay).authorize(tarik.address)
        )
            .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount")
            .withArgs(luay.address, complianceRole);
    });

    it("allows Wa'el to revoke Tarik", async function () {
        const { registry, wael, tarik } = await deployRegistry();

        const complianceRole = await registry.COMPLIANCE_ROLE();

        await registry.grantRole(complianceRole, wael.address);

        await registry.connect(wael).authorize(tarik.address);

        await registry.connect(wael).revoke(tarik.address);

        expect(await registry.isAuthorized(tarik.address)).to.equal(false);
    });

    it("emits an audit event when Wa'el revokes Tarik", async function () {
        const { registry, wael, tarik } = await deployRegistry();

        const complianceRole = await registry.COMPLIANCE_ROLE();

        await registry.grantRole(complianceRole, wael.address);
        await registry.connect(wael).authorize(tarik.address);

        await expect(
            registry.connect(wael).revoke(tarik.address)
        )
            .to.emit(registry, "ParticipantRevoked")
            .withArgs(tarik.address, wael.address);
    });

    it("prevents Wa'el from authorizing Tarik after losing the compliance role", async function () {
        const { registry, faris, wael, tarik } = await deployRegistry();

        const complianceRole = await registry.COMPLIANCE_ROLE();

        await registry.grantRole(complianceRole, wael.address);
        await registry.connect(faris).revokeRole(complianceRole, wael.address);

        await expect(
            registry.connect(wael).authorize(tarik.address)
        )
            .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount")
            .withArgs(wael.address, complianceRole);
    });

    it("prevents Luay from revoking Tarik without the compliance role", async function () {
        const { registry, wael, luay, tarik } = await deployRegistry();

        const complianceRole = await registry.COMPLIANCE_ROLE();

        await registry.grantRole(complianceRole, wael.address);
        await registry.connect(wael).authorize(tarik.address);

        await expect(
            registry.connect(luay).revoke(tarik.address)
        )
            .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount")
            .withArgs(luay.address, complianceRole);
    });

    it("prevents Wa'el from authorizing Tarik twice", async function () {
        const { registry, wael, tarik } = await deployRegistry();

        const complianceRole = await registry.COMPLIANCE_ROLE();

        await registry.grantRole(complianceRole, wael.address);

        await registry.connect(wael).authorize(tarik.address);

        await expect(
            registry.connect(wael).authorize(tarik.address)
        )
            .to.be.revertedWithCustomError(registry, "AlreadyAuthorized")
            .withArgs(tarik.address);
    });

    it("prevents Wa'el from revoking Tarik twice", async function () {
        const { registry, wael, tarik } = await deployRegistry();

        const complianceRole = await registry.COMPLIANCE_ROLE();

        await registry.grantRole(complianceRole, wael.address);

        await registry.connect(wael).authorize(tarik.address);
        await registry.connect(wael).revoke(tarik.address);

        await expect(
            registry.connect(wael).revoke(tarik.address)
        )
            .to.be.revertedWithCustomError(registry, "NotAuthorized")
            .withArgs(tarik.address);
    });

    it("prevents Wa'el from authorizing the zero address", async function () {
        const { ethers, registry, wael } = await deployRegistry();

        const complianceRole = await registry.COMPLIANCE_ROLE();

        await registry.grantRole(complianceRole, wael.address);

        await expect(
            registry.connect(wael).authorize(ethers.ZeroAddress)
        ).to.be.revertedWithCustomError(registry, "InvalidAccount");
    });

    it("prevents Wa'el from revoking the zero address", async function () {
        const { ethers, registry, wael } = await deployRegistry();

        const complianceRole = await registry.COMPLIANCE_ROLE();

        await registry.grantRole(complianceRole, wael.address);

        await expect(
            registry.connect(wael).revoke(ethers.ZeroAddress)
        ).to.be.revertedWithCustomError(registry, "InvalidAccount");
        });
});