"use client";

import { useEffect, useState } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletButton() {
  const [mounted, setMounted] = useState(false);

  const {
    address,
    chainId,
    isConnected,
  } = useAccount();

  const {
    connect,
    connectors,
    isPending: isConnecting,
  } = useConnect();

  const {
    disconnect,
  } = useDisconnect();

  const {
    switchChain,
    isPending: isSwitching,
  } = useSwitchChain();

  useEffect(() => {
    setMounted(true);
  }, []);

  /*
   * Keep the SSR output and first browser render identical.
   */
  if (!mounted) {
    return (
      <button
        disabled
        className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-zinc-500"
      >
        Connect Wallet
      </button>
    );
  }

  if (!isConnected || !address) {
    const connector = connectors[0];

    return (
      <button
        onClick={() => {
          if (connector) {
            connect({ connector });
          }
        }}
        disabled={!connector || isConnecting}
        className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isConnecting
          ? "Connecting..."
          : "Connect Wallet"}
      </button>
    );
  }

  if (chainId !== arbitrumSepolia.id) {
    return (
      <button
        onClick={() =>
          switchChain({
            chainId: arbitrumSepolia.id,
          })
        }
        disabled={isSwitching}
        className="rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-300 disabled:opacity-50"
      >
        {isSwitching
          ? "Switching..."
          : "Switch to Arbitrum Sepolia"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2.5">
        <p className="font-mono text-sm font-semibold text-emerald-300">
          {shortAddress(address)}
        </p>
      </div>

      <button
        onClick={() => disconnect()}
        className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-zinc-400 transition hover:bg-white/[0.05] hover:text-white"
      >
        Disconnect
      </button>
    </div>
  );
}
