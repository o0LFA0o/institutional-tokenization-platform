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
  keccak256,
  parseEther,
  stringToHex,
} from "viem";
import { arbitrumSepolia } from "wagmi/chains";

import { addresses } from "@/lib/protocol";

const assetTokenAbi = [
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

const identityRegistryAbi = [
  {
    type: "function",
    name: "isAuthorized",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const ISSUER_ROLE = keccak256(
  stringToHex("ISSUER_ROLE")
);

export function IssueAsset() {
  const { address, chainId, isConnected } = useAccount();

  const publicClient = usePublicClient({
    chainId: arbitrumSepolia.id,
  });

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("100");
  const [target, setTarget] =
    useState<`0x${string}` | undefined>();

  const [status, setStatus] = useState("");
  const [isConfirming, setIsConfirming] =
    useState(false);

  const { data: hasIssuerRole } = useReadContract({
    address: addresses.assetToken,
    abi: assetTokenAbi,
    functionName: "hasRole",
    args: address
      ? [ISSUER_ROLE, address]
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
    data: recipientAuthorized,
    refetch: refetchAuthorization,
  } = useReadContract({
    address: addresses.identityRegistry,
    abi: identityRegistryAbi,
    functionName: "isAuthorized",
    args: target ? [target] : undefined,
    chainId: arbitrumSepolia.id,
    query: {
      enabled: Boolean(target),
    },
  });

  const {
    data: recipientBalance,
    refetch: refetchBalance,
  } = useReadContract({
    address: addresses.assetToken,
    abi: assetTokenAbi,
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
    !hasIssuerRole
  ) {
    return null;
  }

  const validAddress = isAddress(recipient);
  const validAmount = Number(amount) > 0;
  const busy = isPending || isConfirming;

  function inspectRecipient() {
    if (isAddress(recipient)) {
      setTarget(recipient as `0x${string}`);
    }
  }

  async function handleMint() {
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
    setStatus("Checking participant...");

    const authorized =
      await publicClient.readContract({
        address: addresses.identityRegistry,
        abi: identityRegistryAbi,
        functionName: "isAuthorized",
        args: [account],
      });

    if (!authorized) {
      setStatus(
        "Recipient is not authorized in the Identity Registry."
      );
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
        "Confirm issuance in your wallet..."
      );

      const hash =
        await writeContractAsync({
          address: addresses.assetToken,
          abi: assetTokenAbi,
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

      await refetchAuthorization();
      await refetchBalance();

      setStatus(
        "Asset issued successfully ✓"
      );
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-8">
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
        Issuer Actions
      </p>

      <h2 className="mt-3 text-xl font-semibold">
        Issue Tokenized Institutional Note
      </h2>

      <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
        Mint permissioned TIN assets to an
        authorized institutional participant.
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
          placeholder="0x recipient address"
          className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 font-mono text-sm text-white outline-none transition focus:border-blue-400/50"
        />

        <input
          value={amount}
          onChange={(event) =>
            setAmount(event.target.value)
          }
          type="number"
          min="0"
          step="1"
          className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400/50"
        />

        <button
          onClick={handleMint}
          disabled={
            !validAddress ||
            !validAmount ||
            busy
          }
          className="rounded-xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy
            ? "Processing..."
            : "Issue TIN"}
        </button>
      </div>

      {target && (
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-5">
          <div className="flex flex-wrap gap-8">
            <div>
              <p className="text-xs text-zinc-500">
                Identity Status
              </p>

              <p
                className={`mt-1 text-sm font-semibold ${
                  recipientAuthorized
                    ? "text-emerald-300"
                    : "text-red-300"
                }`}
              >
                {recipientAuthorized
                  ? "Authorized ✓"
                  : "Not Authorized"}
              </p>
            </div>

            <div>
              <p className="text-xs text-zinc-500">
                TIN Balance
              </p>

              <p className="mt-1 text-sm font-semibold">
                {recipientBalance !== undefined
                  ? formatEther(recipientBalance)
                  : "—"}
              </p>
            </div>
          </div>
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
          className="mt-4 block break-all font-mono text-xs text-blue-300 hover:text-blue-200"
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
