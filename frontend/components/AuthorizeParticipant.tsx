"use client";

import { useState } from "react";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import {
  isAddress,
  keccak256,
  stringToHex,
} from "viem";
import { arbitrumSepolia } from "wagmi/chains";

import { addresses } from "@/lib/protocol";

const identityRegistryAbi = [
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
    name: "isAuthorized",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "authorize",
    stateMutability: "nonpayable",
    inputs: [
      { name: "account", type: "address" },
    ],
    outputs: [],
  },
] as const;

const COMPLIANCE_ROLE = keccak256(
  stringToHex("COMPLIANCE_ROLE")
);

export function AuthorizeParticipant() {
  const { address, chainId, isConnected } =
    useAccount();

  const publicClient = usePublicClient({
    chainId: arbitrumSepolia.id,
  });  

  const [participant, setParticipant] =
    useState("");

  const [submittedAddress, setSubmittedAddress] =
    useState<`0x${string}` | undefined>();

  const {
    data: hasComplianceRole,
  } = useReadContract({
    address: addresses.identityRegistry,
    abi: identityRegistryAbi,
    functionName: "hasRole",
    args: address
      ? [COMPLIANCE_ROLE, address]
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
    data: participantAuthorized,
    refetch: refetchAuthorization,
  } = useReadContract({
    address: addresses.identityRegistry,
    abi: identityRegistryAbi,
    functionName: "isAuthorized",
    args: submittedAddress
      ? [submittedAddress]
      : undefined,
    chainId: arbitrumSepolia.id,
    query: {
      enabled: Boolean(submittedAddress),
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
    !hasComplianceRole
  ) {
    return null;
  }

  async function handleAuthorize() {
    if (!isAddress(participant)) {
      return;
    }

    const target =
      participant as `0x${string}`;

    setSubmittedAddress(target);

  if (!publicClient) {
    throw new Error("Arbitrum Sepolia client unavailable");
  }

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

  const hash = await writeContractAsync({
    address: addresses.identityRegistry,
    abi: identityRegistryAbi,
    functionName: "authorize",
    args: [target],
    chainId: arbitrumSepolia.id,
    maxFeePerGas,
    maxPriorityFeePerGas,
  });

    console.log("Authorization tx:", hash);

    setTimeout(() => {
      refetchAuthorization();
    }, 4000);
  }

  const validAddress = isAddress(participant);

  return (
    <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-8">
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
        Compliance Actions
      </p>

      <h2 className="mt-3 text-xl font-semibold">
        Authorize Participant
      </h2>

      <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
        Add an address to the on-chain institutional
        identity registry.
      </p>

      <div className="mt-6 flex flex-col gap-3 md:flex-row">
        <input
          value={participant}
          onChange={(event) =>
            setParticipant(event.target.value)
          }
          placeholder="0x participant address"
          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 font-mono text-sm text-white outline-none transition focus:border-blue-400/50"
        />

        <button
          onClick={handleAuthorize}
          disabled={
            !validAddress ||
            isPending
          }
          className="rounded-xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending
            ? "Confirming..."
            : "Authorize"}
        </button>
      </div>

      {!validAddress &&
        participant.length > 0 && (
          <p className="mt-3 text-sm text-red-300">
            Enter a valid EVM address.
          </p>
        )}

      {participantAuthorized && (
        <p className="mt-4 text-sm font-semibold text-emerald-300">
          Participant is authorized ✓
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
        <p className="mt-4 text-sm text-red-300">
          Transaction failed: {error.message}
        </p>
      )}
    </section>
  );
}
