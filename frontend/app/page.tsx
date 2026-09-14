import { WalletButton } from "@/components/WalletButton";
import { WalletAccessPanel } from "@/components/WalletAccessPanel";
import { AuthorizeParticipant } from "@/components/AuthorizeParticipant";
import { IssueAsset } from "@/components/IssueAsset";
import { FundDemoCash } from "@/components/FundDemoCash";

import {
  addresses,
  getProtocolSnapshot,
  settlementTransaction,
} from "@/lib/protocol";

export const dynamic = "force-dynamic";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function Status({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
        active
          ? "bg-emerald-400/10 text-emerald-300"
          : "bg-red-400/10 text-red-300"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          active ? "bg-emerald-400" : "bg-red-400"
        }`}
      />
      {children}
    </span>
  );
}

export default async function Home() {
  const protocol = await getProtocolSnapshot();

  return (
    <main className="min-h-screen bg-[#080b10] text-white">
      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
        <header className="flex flex-col gap-6 border-b border-white/10 pb-8 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-400">
              Institutional Digital Assets
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-5xl">
              Institutional Tokenization Platform
            </h1>

            <p className="mt-4 max-w-2xl leading-7 text-zinc-400">
              Permissioned real-world asset issuance and atomic
              delivery-versus-payment settlement on Arbitrum.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Status active>Arbitrum Sepolia</Status>

            <Status active={protocol.ok}>
              {protocol.ok ? "Protocol Live" : "RPC Unavailable"}
            </Status>

            <WalletButton />
          </div>
        </header>

        <WalletAccessPanel />

        <AuthorizeParticipant />

        <IssueAsset />

        <FundDemoCash />

        <section className="mt-10 grid gap-6 lg:grid-cols-[1.3fr_.7fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              Tokenized Asset
            </p>

            <div className="mt-3 flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-semibold">
                  Tokenized Institutional Note
                </h2>

                <p className="mt-2 text-sm text-zinc-500">
                  Permissioned ERC-20 real-world asset
                </p>
              </div>

              <span className="rounded-xl bg-blue-400/10 px-4 py-2 font-semibold text-blue-300">
                TIN
              </span>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-4">
              <Metric label="Asset Amount" value="100 TIN" />
              <Metric label="Cash Leg" value="1,000 MCASH" />
              <Metric label="Settlement" value="Atomic DvP" />
              <Metric label="Chain" value="Arbitrum" />
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              Settlement Status
            </p>

            <div className="mt-5">
              <Status active={protocol.ok && protocol.settled}>
                {protocol.ok && protocol.settled
                  ? "Settlement Complete"
                  : "Unable to verify"}
              </Status>
            </div>

            <p className="mt-6 text-sm leading-6 text-zinc-400">
              Status is read directly from the live SettlementEngine
              contract on Arbitrum Sepolia.
            </p>
          </div>
        </section>

        <section className="mt-6 grid gap-6 md:grid-cols-2">
          <Participant
            title="Seller / Issuer"
            address={addresses.seller}
            authorized={protocol.ok && protocol.sellerAuthorized}
            asset={protocol.ok ? protocol.sellerAsset : "—"}
            cash={protocol.ok ? protocol.sellerCash : "—"}
          />

          <Participant
            title="Buyer / Investor"
            address={addresses.buyer}
            authorized={protocol.ok && protocol.buyerAuthorized}
            asset={protocol.ok ? protocol.buyerAsset : "—"}
            cash={protocol.ok ? protocol.buyerCash : "—"}
          />
        </section>

        <section className="mt-6 rounded-3xl border border-blue-400/15 bg-blue-400/[0.05] p-8 md:p-10">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-400">
              Atomic Delivery-versus-Payment
            </p>

            <h2 className="mt-3 text-2xl font-semibold">
              Asset and cash settle in one transaction
            </h2>
          </div>

          <div className="mx-auto mt-10 grid max-w-4xl items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
            <FlowCard label="Seller" value="100 TIN" />

            <div className="text-center">
              <p className="text-blue-300">100 TIN →</p>
              <div className="my-3 rounded-full border border-white/10 px-4 py-2 text-xs font-semibold">
                ATOMIC DvP
              </div>
              <p className="text-emerald-300">← 1,000 MCASH</p>
            </div>

            <FlowCard label="Investor" value="1,000 MCASH" />
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                On-Chain Proof
              </p>

              <h2 className="mt-2 text-2xl font-semibold">
                Publicly verifiable settlement
              </h2>
            </div>

            <a
              href={`https://sepolia.arbiscan.io/tx/${settlementTransaction}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
            >
              View on Arbiscan ↗
            </a>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Proof
              label="Settlement Engine"
              value={addresses.settlementEngine}
            />
            <Proof
              label="Settlement Transaction"
              value={settlementTransaction}
            />
          </div>
        </section>

        <footer className="mt-10 border-t border-white/10 pt-6 text-center text-xs text-zinc-600">
          Institutional Tokenization Platform · Arbitrum Open House
        </footer>
      </div>
    </main>
  );
}

  function Metric({
    label,
    value,
  }: {
    label: string;
    value: string;
  }) {
    return (
      <div>
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="mt-1 text-lg font-semibold">{value}</p>
      </div>
    );
  }

  function Participant({
    title,
    address,
    authorized,
    asset,
    cash,
  }: {
    title: string;
    address: string;
    authorized: boolean;
    asset: string;
    cash: string;
  }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8">
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
        {title}
      </p>

      <p className="mt-3 font-mono text-lg">
        {shortAddress(address)}
      </p>

      <div className="mt-5">
        <Status active={authorized}>
          {authorized ? "Compliance Verified" : "Not Verified"}
        </Status>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-6">
        <Metric label="TIN Balance" value={asset} />
        <Metric label="MCASH Balance" value={cash} />
      </div>
    </div>
  );
}

function FlowCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-center">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}

function Proof({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 p-5">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-2 break-all font-mono text-sm text-zinc-200">
        {value}
      </p>
    </div>
  );
}
