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
  parseEther,
} from "viem";
import { arbitrumSepolia } from "wagmi/chains";

import { addresses } from "@/lib/protocol";

const cashTokenAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
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
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const CASH_AMOUNT = parseEther("1000");

export function ApproveCashSettlement() {
  const {
    address,
    chainId,
    isConnected,
  } = useAccount();

  const publicClient = usePublicClient({
    chainId: arbitrumSepolia.id,
  });

  const [status, setStatus] = useState("");
  const [isConfirming, setIsConfirming] =
    useState(false);

  const {
    data: balance,
    refetch: refetchBalance,
  } = useReadContract({
    address: addresses.cashToken,
    abi: cashTokenAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: arbitrumSepolia.id,
    query: {
      enabled:
        Boolean(address) &&
        isConnected &&
        chainId === arbitrumSepolia.id,
    },
  });

  const {
    data: allowance,
    refetch: refetchAllowance,
  } = useReadContract({
    address: addresses.cashToken,
    abi: cashTokenAbi,
    functionName: "allowance",
    args: address
      ? [
          address,
          addresses.settlementEngine,
        ]
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
    writeContractAsync,
    isPending,
    data: txHash,
    error,
  } = useWriteContract();

  if (
    !isConnected ||
    !address ||
    chainId !== arbitrumSepolia.id
  ) {
    return null;
  }

  const enoughCash =
    balance !== undefined &&
    balance >= CASH_AMOUNT;

  const approved =
    allowance !== undefined &&
    allowance >= CASH_AMOUNT;

  const busy =
    isPending || isConfirming;

  async function handleApprove() {
    if (
      !publicClient ||
      busy ||
      !enoughCash ||
      approved
    ) {
      return;
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
        "Confirm 1,000 MCASH approval in your wallet..."
      );

      const hash =
        await writeContractAsync({
          address: addresses.cashToken,
          abi: cashTokenAbi,
          functionName: "approve",
          args: [
            addresses.settlementEngine,
            CASH_AMOUNT,
          ],
          chainId: arbitrumSepolia.id,
          maxFeePerGas,
          maxPriorityFeePerGas,
        });

      setIsConfirming(true);

      setStatus(
        "Approval submitted. Waiting for confirmation..."
      );

      await publicClient.waitForTransactionReceipt({
        hash,
      });

      await refetchAllowance();
      await refetchBalance();

      setStatus(
        "SettlementEngine approved for 1,000 MCASH ✓"
      );
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <section className="mt-6 rounded-3xl border border-emerald-400/15 bg-emerald-400/[0.035] p-8">
      <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">
        Settlement Preparation
      </p>

      <h2 className="mt-3 text-xl font-semibold">
        Approve Cash Payment
      </h2>

      <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-500">
        Authorize the SettlementEngine to transfer
        exactly 1,000 MCASH from this wallet when
        atomic DvP executes.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <p className="text-xs text-zinc-500">
            Wallet MCASH
          </p>
          <p className="mt-1 text-lg font-semibold">
            {balance !== undefined
              ? formatEther(balance)
              : "—"}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <p className="text-xs text-zinc-500">
            Required
          </p>
          <p className="mt-1 text-lg font-semibold">
            1,000 MCASH
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <p className="text-xs text-zinc-500">
            Allowance
          </p>
          <p
            className={`mt-1 text-lg font-semibold ${
              approved
                ? "text-emerald-300"
                : "text-zinc-300"
            }`}
          >
            {allowance !== undefined
              ? `${formatEther(allowance)} MCASH`
              : "—"}
          </p>
        </div>
      </div>

      <button
        onClick={handleApprove}
        disabled={
          busy ||
          !enoughCash ||
          approved
        }
        className="mt-6 rounded-xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {approved
          ? "1,000 MCASH Approved ✓"
          : busy
          ? "Processing..."
          : "Approve 1,000 MCASH"}
      </button>

      {!enoughCash &&
        balance !== undefined && (
          <p className="mt-4 text-sm text-red-300">
            This wallet does not hold enough MCASH.
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
