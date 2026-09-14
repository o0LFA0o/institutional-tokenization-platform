const settlementTx =
  "0xa521817b833d37587588d0f93438a32b61d5fd6c60ce1e479c739116b4d63926";

export function HackathonOverview() {
  return (
    <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-8">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-medium text-blue-300">
              Arbitrum Sepolia
            </span>

            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
              Live On-Chain
            </span>

            <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-300">
              Testnet Prototype
            </span>
          </div>

          <h2 className="mt-6 text-3xl font-semibold tracking-tight text-white">
            Permissioned RWA issuance and atomic settlement
          </h2>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-400">
            A compliance-aware institutional digital asset prototype
            demonstrating participant authorization, tokenized asset
            issuance, EIP-712 settlement authorization, and atomic
            delivery-versus-payment on Arbitrum.
          </p>
        </div>

        <a
          href={`https://sepolia.arbiscan.io/tx/${settlementTx}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.1]"
        >
          View DvP Proof ↗
        </a>
      </div>

      <div className="mt-8 grid gap-3 md:grid-cols-4">
        <Feature
          number="01"
          title="Identity"
          description="Authorize eligible institutional participants."
        />

        <Feature
          number="02"
          title="Issuance"
          description="Mint permissioned tokenized real-world assets."
        />

        <Feature
          number="03"
          title="Authorization"
          description="Seller signs structured EIP-712 settlement terms."
        />

        <Feature
          number="04"
          title="Atomic DvP"
          description="Asset and cash legs execute in one transaction."
        />
      </div>

      <div className="mt-8 rounded-2xl border border-white/10 bg-black/30 p-6">
        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
          Confirmed Interactive Settlement
        </p>

        <div className="mt-5 grid gap-5 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <div>
            <p className="text-xs text-zinc-500">Seller delivers</p>
            <p className="mt-1 text-2xl font-semibold text-white">
              100 TIN
            </p>
          </div>

          <div className="text-center">
            <div className="text-lg text-zinc-500">⇄</div>
            <p className="mt-1 text-xs font-medium uppercase tracking-[0.15em] text-emerald-300">
              Atomic
            </p>
          </div>

          <div className="md:text-right">
            <p className="text-xs text-zinc-500">Buyer delivers</p>
            <p className="mt-1 text-2xl font-semibold text-white">
              1,000 MCASH
            </p>
          </div>
        </div>

        <div className="mt-5 border-t border-white/10 pt-5">
          <p className="break-all font-mono text-xs text-zinc-500">
            {settlementTx}
          </p>
        </div>
      </div>
    </section>
  );
}

function Feature({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <p className="text-xs font-mono text-zinc-600">{number}</p>
      <p className="mt-4 font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-500">
        {description}
      </p>
    </div>
  );
}
