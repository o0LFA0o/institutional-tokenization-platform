"use client";

import { useState } from "react";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import {
  formatEther,
  isAddress,
  parseEther,
} from "viem";
import { arbitrumSepolia } from "wagmi/chains";

import { addresses } from "@/lib/protocol";

const cashTokenAbi = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const accessControlAbi = [
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
] as const;

const DEFAULT_ADMIN_ROLE =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

export function FundDemoCash() {
  const {
    address,
    chainId,
    isConnected,
  } = useAccount();

  const publicClient = usePublicClient({
    chainId: arbitrumSepolia.id,
  });

  const [recipient, setRecipient] =
    useState("");

  const [amount, setAmount] =
    useState("1000");

  const [target, setTarget] =
    useState<`0x${string}` | undefined>();

  const [status, setStatus] =
    useState("");

  const [isConfirming, setIsConfirming] =
    useState(false);

  const { data: isAdmin } =
    useReadContract({
      address: addresses.identityRegistry,
      abi: accessControlAbi,
      functionName: "hasRole",
      args: address
        ? [DEFAULT_ADMIN_ROLE, address]
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
    data: balance,
    refetch: refetchBalance,
  } = useReadContract({
    address: addresses.cashToken,
    abi: cashTokenAbi,
    functionName: "balanceOf",
    args: target ? [target] : undefined,
    chainId: arbitrumSepolia.id,
    query: {
      enabled: Boolean(target),
    },
  });

  const {
    writeContractAsync,
    isPending,
    data: txHash,
    error,
  } = useWriteContract();

  if (
    !isConnected ||
    !address ||
    chainId !== arbitrumSepolia.id ||
    !isAdmin
  ) {
    return null;
  }

  const validAddress =
    isAddress(recipient);

  const validAmount =
    Number(amount) > 0;

  const busy =
    isPending || isConfirming;

  function inspectRecipient() {
    if (isAddress(recipient)) {
      setTarget(
        recipient as `0x${string}`
      );
    }
  }

  async function handleFund() {
    if (
      !isAddress(recipient) ||
      !validAmount ||
      !publicClient ||
      busy
    ) {
      return;
    }

    const account =
      recipient as `0x${string}`;

    setTarget(account);

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
        "Confirm demo cash funding in your wallet..."
      );

      const hash =
        await writeContractAsync({
          address: addresses.cashToken,
          abi: cashTokenAbi,
          functionName: "mint",
          args: [
            account,
            parseEther(amount),
          ],
          chainId: arbitrumSepolia.id,
          maxFeePerGas,
          maxPriorityFeePerGas,
        });

      setIsConfirming(true);

      setStatus(
        "Transaction submitted. Waiting for confirmation..."
      );

      await publicClient.waitForTransactionReceipt({
        hash,
      });

      await refetchBalance();

      setStatus(
        "Testnet settlement cash funded ✓"
      );
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <section className="mt-6 rounded-3xl border border-amber-400/15 bg-amber-400/[0.035] p-8">
      <p className="text-xs uppercase tracking-[0.2em] text-amber-300">
        Demo Settlement Preparation
      </p>

      <h2 className="mt-3 text-xl font-semibold">
        Fund Testnet Settlement Cash
      </h2>

      <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-500">
        MCASH is a testnet-only mock settlement token used
        to demonstrate atomic DvP. It is not a production
        stablecoin or real-world cash instrument.
      </p>

      <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_180px_auto]">
        <input
          value={recipient}
          onChange={(event) => {
            setRecipient(event.target.value);
            setTarget(undefined);
            setStatus("");
          }}
          onBlur={inspectRecipient}
          placeholder="0x participant address"
          className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 font-mono text-sm text-white outline-none transition focus:border-amber-300/50"
        />

        <input
          value={amount}
          onChange={(event) =>
            setAmount(event.target.value)
          }
          type="number"
          min="0"
          step="1"
          className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-300/50"
        />

        <button
          onClick={handleFund}
          disabled={
            !validAddress ||
            !validAmount ||
            busy
          }
          className="rounded-xl bg-amber-300 px-5 py-3 text-sm font-semibold text-black transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy
            ? "Processing..."
            : "Fund MCASH"}
        </button>
      </div>

      {target && (
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-5">
          <p className="text-xs text-zinc-500">
            MCASH Balance
          </p>

          <p className="mt-1 text-sm font-semibold">
            {balance !== undefined
              ? formatEther(balance)
              : "—"}
          </p>
        </div>
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
          View transaction: {txHash}
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
