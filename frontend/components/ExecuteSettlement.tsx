"use client";

import { useEffect, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useSignTypedData,
  useWriteContract,
} from "wagmi";
import {
  formatEther,
  keccak256,
  parseEther,
  recoverTypedDataAddress,
  stringToHex,
} from "viem";
import { arbitrumSepolia } from "wagmi/chains";

import { addresses } from "@/lib/protocol";

const SELLER =
  "0xdd0302aeDec811b7337209EdfcD9F0dCC327798E" as const;

const BUYER =
  "0xc2be95D904303f169013A846Dc41731a06aa66Db" as const;

const ASSET_AMOUNT = parseEther("100");
const CASH_AMOUNT = parseEther("1000");

const SETTLEMENT_ID = keccak256(
  stringToHex("arbitrum-open-house-ui-demo-001")
);

const SETTLER_ROLE = keccak256(
  stringToHex("SETTLER_ROLE")
);

const domain = {
  name: "Institutional Tokenization Platform",
  version: "1",
  chainId: arbitrumSepolia.id,
  verifyingContract: addresses.settlementEngine,
} as const;

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
} as const;

const instruction = {
  settlementId: SETTLEMENT_ID,
  seller: SELLER,
  buyer: BUYER,
  assetToken: addresses.assetToken,
  cashToken: addresses.cashToken,
  assetAmount: ASSET_AMOUNT,
  cashAmount: CASH_AMOUNT,
} as const;

const settlementAbi = [
  {
    type: "function",
    name: "hasRole",
    stateMutability: "view",
    inputs: [
      { name: "role", type: "bytes32" },
      { name: "account", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "isSettled",
    stateMutability: "view",
    inputs: [
      { name: "settlementId", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "settle",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "instruction",
        type: "tuple",
        components: [
          { name: "settlementId", type: "bytes32" },
          { name: "seller", type: "address" },
          { name: "buyer", type: "address" },
          { name: "assetToken", type: "address" },
          { name: "cashToken", type: "address" },
          { name: "assetAmount", type: "uint256" },
          { name: "cashAmount", type: "uint256" },
        ],
      },
      {
        name: "signature",
        type: "bytes",
      },
    ],
    outputs: [],
  },
] as const;

const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export function ExecuteSettlement() {
  const {
    address,
    chainId,
    isConnected,
  } = useAccount();

  const publicClient = usePublicClient({
    chainId: arbitrumSepolia.id,
  });

  const {
    signTypedDataAsync,
    isPending: isSigning,
  } = useSignTypedData();

  const {
    writeContractAsync,
    isPending: isWriting,
    data: txHash,
    error,
  } = useWriteContract();

  const [signature, setSignature] =
    useState<`0x${string}` | undefined>();

  const [status, setStatus] =
    useState("");

  const [isConfirming, setIsConfirming] =
    useState(false);

  useEffect(() => {
    const saved =
      window.localStorage.getItem(
        "itp-demo-settlement-signature"
      );

    if (saved?.startsWith("0x")) {
      setSignature(
        saved as `0x${string}`
      );
    }
  }, []);

  const {
    data: settled,
    refetch: refetchSettled,
  } = useReadContract({
    address: addresses.settlementEngine,
    abi: settlementAbi,
    functionName: "isSettled",
    args: [SETTLEMENT_ID],
    chainId: arbitrumSepolia.id,
  });

  const { data: hasSettlerRole } =
    useReadContract({
      address: addresses.settlementEngine,
      abi: settlementAbi,
      functionName: "hasRole",
      args: address
        ? [SETTLER_ROLE, address]
        : undefined,
      chainId: arbitrumSepolia.id,
      query: {
        enabled:
          Boolean(address) &&
          isConnected &&
          chainId === arbitrumSepolia.id,
      },
    });

  const {
    data: sellerAssetBalance,
    refetch: refetchSellerAsset,
  } = useReadContract({
    address: addresses.assetToken,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [SELLER],
    chainId: arbitrumSepolia.id,
  });

  const {
    data: buyerCashBalance,
    refetch: refetchBuyerCash,
  } = useReadContract({
    address: addresses.cashToken,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [BUYER],
    chainId: arbitrumSepolia.id,
  });

  const {
    data: sellerAllowance,
    refetch: refetchSellerAllowance,
  } = useReadContract({
    address: addresses.assetToken,
    abi: erc20Abi,
    functionName: "allowance",
    args: [
      SELLER,
      addresses.settlementEngine,
    ],
    chainId: arbitrumSepolia.id,
  });

  const {
    data: buyerAllowance,
    refetch: refetchBuyerAllowance,
  } = useReadContract({
    address: addresses.cashToken,
    abi: erc20Abi,
    functionName: "allowance",
    args: [
      BUYER,
      addresses.settlementEngine,
    ],
    chainId: arbitrumSepolia.id,
  });

  if (
    !isConnected ||
    !address ||
    chainId !== arbitrumSepolia.id
  ) {
    return null;
  }

  const connectedIsSeller =
    address.toLowerCase() ===
    SELLER.toLowerCase();

  const assetReady =
    sellerAssetBalance !== undefined &&
    sellerAssetBalance >= ASSET_AMOUNT &&
    sellerAllowance !== undefined &&
    sellerAllowance >= ASSET_AMOUNT;

  const cashReady =
    buyerCashBalance !== undefined &&
    buyerCashBalance >= CASH_AMOUNT &&
    buyerAllowance !== undefined &&
    buyerAllowance >= CASH_AMOUNT;

  const busy =
    isSigning ||
    isWriting ||
    isConfirming;

  async function handleSign() {
    if (
      !connectedIsSeller ||
      settled
    ) {
      return;
    }

    setStatus(
      "Confirm the settlement instruction signature..."
    );

    const signed =
      await signTypedDataAsync({
        domain,
        types,
        primaryType:
          "SettlementInstruction",
        message: instruction,
      });

    const recovered =
      await recoverTypedDataAddress({
        domain,
        types,
        primaryType:
          "SettlementInstruction",
        message: instruction,
        signature: signed,
      });

    if (
      recovered.toLowerCase() !==
      SELLER.toLowerCase()
    ) {
      throw new Error(
        "Signature does not match seller."
      );
    }

    setSignature(signed);

    window.localStorage.setItem(
      "itp-demo-settlement-signature",
      signed
    );

    setStatus(
      "Seller authorization signed ✓ Switch to the settlement operator wallet."
    );
  }

  async function handleSettle() {
    if (
      !publicClient ||
      !signature ||
      !hasSettlerRole ||
      !assetReady ||
      !cashReady ||
      settled ||
      busy
    ) {
      return;
    }

    const recovered =
      await recoverTypedDataAddress({
        domain,
        types,
        primaryType:
          "SettlementInstruction",
        message: instruction,
        signature,
      });

    if (
      recovered.toLowerCase() !==
      SELLER.toLowerCase()
    ) {
      throw new Error(
        "Stored signature is invalid."
      );
    }

    try {
      const fees =
        await publicClient.estimateFeesPerGas();

      const maxFeePerGas =
        fees.maxFeePerGas +
        fees.maxFeePerGas / 4n;

      const maxPriorityFeePerGas =
        fees.maxPriorityFeePerGas
          ? fees.maxPriorityFeePerGas +
            fees.maxPriorityFeePerGas / 4n
          : undefined;

      setStatus(
        "Confirm atomic DvP settlement in your wallet..."
      );

      const hash =
        await writeContractAsync({
          address:
            addresses.settlementEngine,
          abi: settlementAbi,
          functionName: "settle",
          args: [
            instruction,
            signature,
          ],
          chainId: arbitrumSepolia.id,
          maxFeePerGas,
          maxPriorityFeePerGas,
        });

      setIsConfirming(true);

      setStatus(
        "Settlement submitted. Waiting for confirmation..."
      );

      await publicClient.waitForTransactionReceipt({
        hash,
      });

      await Promise.all([
        refetchSettled(),
        refetchSellerAsset(),
        refetchBuyerCash(),
        refetchSellerAllowance(),
        refetchBuyerAllowance(),
      ]);

      window.localStorage.removeItem(
        "itp-demo-settlement-signature"
      );

      setStatus(
        "Atomic DvP settlement complete ✓"
      );
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <section className="mt-6 rounded-3xl border border-violet-400/20 bg-violet-400/[0.04] p-8">
      <p className="text-xs uppercase tracking-[0.2em] text-violet-300">
        Atomic Settlement
      </p>

      <h2 className="mt-3 text-2xl font-semibold">
        Execute Delivery-versus-Payment
      </h2>

      <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-500">
        The seller authorizes a fixed settlement
        instruction using EIP-712. A settlement
        operator then executes both asset and cash
        legs atomically through the SettlementEngine.
      </p>

      <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Info
          label="Asset"
          value="100 TIN"
          ready={assetReady}
        />

        <Info
          label="Cash"
          value="1,000 MCASH"
          ready={cashReady}
        />

        <Info
          label="Seller Signature"
          value={
            signature
              ? "Signed"
              : "Required"
          }
          ready={Boolean(signature)}
        />

        <Info
          label="Settlement"
          value={
            settled
              ? "Complete"
              : "Pending"
          }
          ready={Boolean(settled)}
        />
      </div>

      <div className="mt-7 flex flex-wrap gap-3">
        {connectedIsSeller &&
          !settled && (
            <button
              onClick={handleSign}
              disabled={
                busy ||
                !assetReady
              }
              className="rounded-xl bg-violet-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSigning
                ? "Signing..."
                : signature
                ? "Re-sign Settlement"
                : "Sign Settlement Instruction"}
            </button>
          )}

        {hasSettlerRole &&
          !settled && (
            <button
              onClick={handleSettle}
              disabled={
                busy ||
                !signature ||
                !assetReady ||
                !cashReady
              }
              className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isWriting ||
              isConfirming
                ? "Settling..."
                : "Execute Atomic DvP"}
            </button>
          )}
      </div>

      {connectedIsSeller &&
        !signature &&
        assetReady && (
          <p className="mt-4 text-sm text-zinc-400">
            Step 1: Sign as the seller. No gas is
            spent when signing the EIP-712 message.
          </p>
        )}

      {!connectedIsSeller &&
        hasSettlerRole &&
        !signature &&
        !settled && (
          <p className="mt-4 text-sm text-amber-300">
            Seller signature required. Switch to
            the seller wallet and sign first.
          </p>
        )}

      {signature &&
        hasSettlerRole &&
        !settled && (
          <p className="mt-4 text-sm text-emerald-300">
            Seller authorization verified. Settlement
            is ready for execution ✓
          </p>
        )}

      {status && (
        <p className="mt-4 text-sm text-zinc-300">
          {status}
        </p>
      )}

      {txHash && (
        <a
          href={`https://sepolia.arbiscan.io/tx/${txHash}`}
          target="_blank"
          rel="noreferrer"
          className="mt-4 block break-all font-mono text-xs text-blue-300"
        >
          View settlement transaction: {txHash}
        </a>
      )}

      {error && (
        <p className="mt-4 break-words text-sm text-red-300">
          Transaction failed: {error.message}
        </p>
      )}
    </section>
  );
}

function Info({
  label,
  value,
  ready,
}: {
  label: string;
  value: string;
  ready: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <p className="text-xs text-zinc-500">
        {label}
      </p>

      <p
        className={`mt-2 font-semibold ${
          ready
            ? "text-emerald-300"
            : "text-zinc-300"
        }`}
      >
        {value}
        {ready ? " ✓" : ""}
      </p>
    </div>
  );
}
