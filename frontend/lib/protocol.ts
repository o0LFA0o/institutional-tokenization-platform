import {
  createPublicClient,
  formatUnits,
  http,
  keccak256,
  stringToHex,
} from "viem";
import { arbitrumSepolia } from "viem/chains";

export const addresses = {
  seller: "0xc2be95D904303f169013A846Dc41731a06aa66Db",
  buyer: "0x97d29F995b918518Dcc2481F873C2DC432E4b0Dc",
  identityRegistry: "0x1B6e4b00F58269dFb8a8954B2a1Fd17bfE3593E7",
  assetToken: "0x8E27fb322ab06B890657B640B59b7870Db813c59",
  cashToken: "0xe504Fd4568aDC3AcCd147d0b7848743F85Ae920f",
  settlementEngine: "0x435D03aC40aDC9c502d2Bed8B3B3F15862ECA9F6",
} as const;

export const settlementTransaction =
  "0xe361914bcfaa9223c5723c5321989e8fd07e7a059baf62b6d0e80d87f3825eb7";

export const settlementId = keccak256(
  stringToHex("arbitrum-open-house-demo-001")
);

const identityRegistryAbi = [
  {
    type: "function",
    name: "isAuthorized",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const settlementEngineAbi = [
  {
    type: "function",
    name: "isSettled",
    stateMutability: "view",
    inputs: [{ name: "settlementId", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const client = createPublicClient({
  chain: arbitrumSepolia,
  transport: http("https://sepolia-rollup.arbitrum.io/rpc"),
});

export async function getProtocolSnapshot() {
  try {
    const [
      sellerAuthorized,
      buyerAuthorized,
      settled,
      sellerAsset,
      buyerAsset,
      sellerCash,
      buyerCash,
    ] = await Promise.all([
      client.readContract({
        address: addresses.identityRegistry,
        abi: identityRegistryAbi,
        functionName: "isAuthorized",
        args: [addresses.seller],
      }),
      client.readContract({
        address: addresses.identityRegistry,
        abi: identityRegistryAbi,
        functionName: "isAuthorized",
        args: [addresses.buyer],
      }),
      client.readContract({
        address: addresses.settlementEngine,
        abi: settlementEngineAbi,
        functionName: "isSettled",
        args: [settlementId],
      }),
      client.readContract({
        address: addresses.assetToken,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [addresses.seller],
      }),
      client.readContract({
        address: addresses.assetToken,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [addresses.buyer],
      }),
      client.readContract({
        address: addresses.cashToken,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [addresses.seller],
      }),
      client.readContract({
        address: addresses.cashToken,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [addresses.buyer],
      }),
    ]);

    return {
      ok: true as const,
      sellerAuthorized,
      buyerAuthorized,
      settled,
      sellerAsset: formatUnits(sellerAsset, 18),
      buyerAsset: formatUnits(buyerAsset, 18),
      sellerCash: formatUnits(sellerCash, 18),
      buyerCash: formatUnits(buyerCash, 18),
    };
  } catch (error) {
    console.error("Arbitrum read failed:", error);

    return {
      ok: false as const,
    };
  }
}
