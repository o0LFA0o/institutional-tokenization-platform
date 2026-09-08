import { expect } from "chai";
import { network } from "hardhat";

describe("MockCashToken", function () {
    it("deploys with the correct name and symbol", async function () {
        const { ethers } = await network.create();

        const MockCashToken = await ethers.getContractFactory(
            "MockCashToken"
        );

        const cashToken = await MockCashToken.deploy();

        expect(await cashToken.name()).to.equal("Mock Cash Token");
        expect(await cashToken.symbol()).to.equal("MCASH");
    });

    it("mints cash tokens to an account", async function () {
        const { ethers } = await network.create();

        const [tarik] = await ethers.getSigners();

        const MockCashToken = await ethers.getContractFactory(
            "MockCashToken"
        );

        const cashToken = await MockCashToken.deploy();

        await cashToken.mint(
            tarik.address,
            1000n
        );

        expect(
            await cashToken.balanceOf(tarik.address)
        ).to.equal(1000n);
    });
});