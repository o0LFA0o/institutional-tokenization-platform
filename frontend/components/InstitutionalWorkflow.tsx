import { WalletAccessPanel } from "@/components/WalletAccessPanel";
import { AuthorizeParticipant } from "@/components/AuthorizeParticipant";
import { IssueAsset } from "@/components/IssueAsset";
import { FundDemoCash } from "@/components/FundDemoCash";
import { ApproveAssetSettlement } from "@/components/ApproveAssetSettlement";
import { ApproveCashSettlement } from "@/components/ApproveCashSettlement";
import { ExecuteSettlement } from "@/components/ExecuteSettlement";

export function InstitutionalWorkflow() {
  return (
    <section className="mt-10">
      <div className="mb-7">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
          Institutional Workflow
        </p>

        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
          From eligibility to final settlement
        </h2>

        <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-500">
          Each stage represents a distinct institutional function:
          compliance onboarding, asset issuance, settlement preparation,
          authorization, and final delivery-versus-payment.
        </p>
      </div>

      <WorkflowStage
        number="01"
        eyebrow="Compliance"
        title="Participant Eligibility"
        description="Verify the connected institution and authorize eligible participants before assets can move."
      >
        <WalletAccessPanel />
        <AuthorizeParticipant />
      </WorkflowStage>

      <WorkflowConnector />

      <WorkflowStage
        number="02"
        eyebrow="Issuance"
        title="Create the Tokenized Asset"
        description="Issue permissioned TIN assets and provision testnet settlement cash for the transaction."
      >
        <IssueAsset />
        <FundDemoCash />
      </WorkflowStage>

      <WorkflowConnector />

      <WorkflowStage
        number="03"
        eyebrow="Settlement Preparation"
        title="Authorize Both Legs"
        description="The asset seller and cash buyer grant the SettlementEngine narrowly scoped ERC-20 allowances."
      >
        <ApproveAssetSettlement />
        <ApproveCashSettlement />
      </WorkflowStage>

      <WorkflowConnector />

      <WorkflowStage
        number="04"
        eyebrow="Final Settlement"
        title="Authorize and Execute Atomic DvP"
        description="The seller signs the settlement terms using EIP-712, then an authorized settlement operator executes both legs atomically."
      >
        <ExecuteSettlement />
      </WorkflowStage>
    </section>
  );
}

function WorkflowStage({
  number,
  eyebrow,
  title,
  description,
  children,
}: {
  number: string;
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 md:p-7">
      <div className="flex gap-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/30 font-mono text-xs text-zinc-400">
          {number}
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            {eyebrow}
          </p>

          <h3 className="mt-2 text-xl font-semibold text-white">
            {title}
          </h3>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
            {description}
          </p>
        </div>
      </div>

      <div className="mt-2">
        {children}
      </div>
    </div>
  );
}

function WorkflowConnector() {
  return (
    <div className="flex h-12 items-center pl-[42px]">
      <div className="h-full w-px bg-gradient-to-b from-white/20 to-white/5" />
    </div>
  );
}
