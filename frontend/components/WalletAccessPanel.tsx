"use client";

import { useEffect, useState } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { keccak256, stringToHex } from "viem";
import { arbitrumSepolia } from "wagmi/chains";

import { addresses } from "@/lib/protocol";

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

const identityRegistryAbi = [
  {
    type: "function",
    name: "isAuthorized",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const COMPLIANCE_ROLE = keccak256(
  stringToHex("COMPLIANCE_ROLE")
);

const ISSUER_ROLE = keccak256(
  stringToHex("ISSUER_ROLE")
);

const PAUSER_ROLE = keccak256(
  stringToHex("PAUSER_ROLE")
);

const SETTLER_ROLE = keccak256(
  stringToHex("SETTLER_ROLE")
);

const DEFAULT_ADMIN_ROLE =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function Permission({
  label,
  active,
}: {
  label: string;
  active: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 py-3 last:border-0">
      <span className="text-sm text-zinc-400">{label}</span>

      <span
        className={
          active
            ? "text-sm font-semibold text-emerald-300"
            : "text-sm font-semibold text-zinc-600"
        }
      >
        {active ? "Yes ✓" : "No"}
      </span>
    </div>
  );
}

export function WalletAccessPanel() {
  const [mounted, setMounted] = useState(false);

  const {
    address,
    isConnected,
    chainId,
  } = useAccount();

  useEffect(() => {
    setMounted(true);
  }, []);

  const enabled =
    mounted &&
    isConnected &&
    Boolean(address) &&
    chainId === arbitrumSepolia.id;

  const {
    data,
    isPending,
    isError,
  } = useReadContracts({
    contracts: address
      ? [
          {
            address: addresses.identityRegistry,
            abi: identityRegistryAbi,
            functionName: "isAuthorized",
            args: [address],
            chainId: arbitrumSepolia.id,
          },
          {
            address: addresses.identityRegistry,
            abi: accessControlAbi,
            functionName: "hasRole",
            args: [COMPLIANCE_ROLE, address],
            chainId: arbitrumSepolia.id,
          },
          {
            address: addresses.assetToken,
            abi: accessControlAbi,
            functionName: "hasRole",
            args: [ISSUER_ROLE, address],
            chainId: arbitrumSepolia.id,
          },
          {
            address: addresses.assetToken,
            abi: accessControlAbi,
            functionName: "hasRole",
            args: [PAUSER_ROLE, address],
            chainId: arbitrumSepolia.id,
          },
          {
            address: addresses.settlementEngine,
            abi: accessControlAbi,
            functionName: "hasRole",
            args: [SETTLER_ROLE, address],
            chainId: arbitrumSepolia.id,
          },
          {
            address: addresses.identityRegistry,
            abi: accessControlAbi,
            functionName: "hasRole",
            args: [DEFAULT_ADMIN_ROLE, address],
            chainId: arbitrumSepolia.id,
          },
          {
            address: addresses.assetToken,
            abi: accessControlAbi,
            functionName: "hasRole",
            args: [DEFAULT_ADMIN_ROLE, address],
            chainId: arbitrumSepolia.id,
          },
          {
            address: addresses.settlementEngine,
            abi: accessControlAbi,
            functionName: "hasRole",
            args: [DEFAULT_ADMIN_ROLE, address],
            chainId: arbitrumSepolia.id,
          },
        ]
      : [],
    query: {
      enabled,
    },
  });

  if (!mounted) {
    return null;
  }

  if (!isConnected || !address) {
    return (
      <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
          Connected Wallet Access
        </p>

        <h2 className="mt-3 text-xl font-semibold">
          Connect a wallet to inspect permissions
        </h2>

        <p className="mt-3 text-sm text-zinc-500">
          Wallet permissions are read directly from the deployed Arbitrum contracts.
        </p>
      </section>
    );
  }

  if (chainId !== arbitrumSepolia.id) {
    return (
      <section className="mt-6 rounded-3xl border border-amber-400/20 bg-amber-400/[0.05] p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-amber-300">
          Connected Wallet
        </p>

        <h2 className="mt-3 font-mono text-xl">
          {shortAddress(address)}
        </h2>

        <p className="mt-4 text-sm text-zinc-400">
          Switch to Arbitrum Sepolia to inspect protocol permissions.
        </p>
      </section>
    );
  }

  const authorized = Boolean(data?.[0]?.result);
  const complianceOperator = Boolean(data?.[1]?.result);
  const issuer = Boolean(data?.[2]?.result);
  const pauser = Boolean(data?.[3]?.result);
  const settler = Boolean(data?.[4]?.result);

  const protocolAdmin =
    Boolean(data?.[5]?.result) &&
    Boolean(data?.[6]?.result) &&
    Boolean(data?.[7]?.result);

  return (
    <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:justify-between">

        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Connected Wallet Access
          </p>

          <h2 className="mt-3 font-mono text-xl font-semibold">
            {shortAddress(address)}
          </h2>

          <div className="mt-4 flex items-center gap-2 text-sm text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Arbitrum Sepolia
          </div>
        </div>

        <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-black/20 px-5">
          {isPending ? (
            <p className="py-5 text-sm text-zinc-500">
              Reading on-chain permissions...
            </p>
          ) : isError ? (
            <p className="py-5 text-sm text-red-300">
              Unable to read wallet permissions.
            </p>
          ) : (
            <>
              <Permission
                label="Identity Authorized"
                active={authorized}
              />

              <Permission
                label="Compliance Operator"
                active={complianceOperator}
              />

              <Permission
                label="Asset Issuer"
                active={issuer}
              />

              <Permission
                label="Settlement Operator"
                active={settler}
              />

              <Permission
                label="Emergency Pauser"
                active={pauser}
              />

              <Permission
                label="Protocol Administrator"
                active={protocolAdmin}
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
