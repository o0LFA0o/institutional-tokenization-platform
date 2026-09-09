# Institutional Tokenization Platform — Architecture

## 1. Purpose

The Institutional Tokenization Platform provides modular infrastructure for issuing, holding, transferring, and settling permissioned digital financial assets.

The current system models a permissioned tokenized financial instrument exchanged against tokenized cash using atomic Delivery-versus-Payment (DvP).

The architecture prioritizes:

- security
- modularity
- minimal on-chain state
- narrow contract responsibilities
- gas-conscious design
- auditability
- explicit trust boundaries
- replaceable components

The system deliberately avoids unnecessary protocol complexity.

---

## 2. Core Architecture

The protocol currently consists of four primary components.

### IdentityRegistry

Maintains the minimum authorization state required to determine whether an address may participate in permissioned asset transfers.

Responsibilities:

- authorize participants
- revoke participants
- expose participant authorization status
- emit authorization state changes
- restrict compliance operations through `COMPLIANCE_ROLE`

The registry stores only authorization state.

It does not store personal KYC documents, names, government identifiers, or other sensitive identity information on-chain.

### AssetToken

Represents a permissioned tokenized financial asset using ERC-20 semantics.

Responsibilities:

- represent asset ownership
- mint assets through `ISSUER_ROLE`
- burn assets through `ISSUER_ROLE`
- enforce participant transfer restrictions
- support emergency pause controls
- emit standard token events

The AssetToken delegates participant eligibility decisions to the IdentityRegistry.

Normal transfers require both sender and recipient to be authorized.

Minting requires the recipient to be authorized.

Issuer-controlled burning remains possible when a holder has been revoked, allowing redemption or other issuer-controlled lifecycle actions without permitting the revoked holder to voluntarily transfer the asset.

### SettlementEngine

Coordinates atomic exchange of an ERC-20 asset against an ERC-20 cash leg.

Responsibilities:

- validate settlement instructions
- verify seller authorization using EIP-712 signatures
- restrict execution to `SETTLER_ROLE`
- execute Delivery-versus-Payment atomically
- prevent duplicate settlement
- protect settlement execution against reentrancy
- interact with ERC-20 tokens using `SafeERC20`
- emit settlement completion records

The SettlementEngine does not own participant identity state or asset lifecycle state.

Participant eligibility is enforced by the AssetToken when the SettlementEngine attempts the asset transfer.

### MockCashToken

Represents the cash leg during development and testing.

It exists to model settlement behavior associated with instruments such as:

- tokenized deposits
- regulated stablecoins
- wholesale settlement tokens
- other tokenized cash instruments

It is not intended to implement a production stablecoin or deposit-token system.

Its unrestricted minting behavior exists only to support testing.

---

## 3. Dependency Model

Dependencies remain directional and minimal.

```text
IdentityRegistry
      ▲
      │
      │ authorization query
      │
AssetToken


SettlementEngine
      │
      ├──── ERC-20 interaction ──── AssetToken
      │
      └──── ERC-20 interaction ──── MockCashToken
```

The SettlementEngine does not directly query the IdentityRegistry.

Instead:

```text
SettlementEngine
       │
       │ attempts asset transfer
       ▼
AssetToken
       │
       │ checks eligibility
       ▼
IdentityRegistry
```

This keeps compliance enforcement inside the permissioned asset rather than duplicating identity logic inside the settlement layer.

A component should depend on another component's required behavior rather than its complete implementation.

---

## 4. State Ownership

Each piece of protocol state has one authoritative owner.

IdentityRegistry owns:

- participant authorization state
- compliance role assignments

AssetToken owns:

- balances
- total supply
- allowances
- pause state
- issuance and operational role assignments

SettlementEngine owns:

- settlement execution state
- settlement role assignments

MockCashToken owns:

- cash balances
- allowances
- total supply

State is not duplicated between modules unless a demonstrated security or performance requirement justifies it.

---

## 5. Access Model

The system separates operational authority from asset ownership.

### DEFAULT_ADMIN_ROLE

Responsible for high-level role administration.

In the modeled deployment, Faris acts as administrator.

This role should be highly restricted in a production deployment.

### COMPLIANCE_ROLE

May authorize or revoke participant eligibility.

In the modeled workflow, Wa'el acts as the compliance operator.

### ISSUER_ROLE

May mint and burn the permissioned asset.

In the modeled workflow, Luay acts as issuer.

### PAUSER_ROLE

May activate or remove emergency transfer restrictions.

In the modeled workflow, Faris holds the pausing authority.

### SETTLER_ROLE

May submit settlement transactions to the SettlementEngine.

The settler is modeled as a separate institutional settlement operator.

Holding `SETTLER_ROLE` does not authorize the operator to invent settlement terms on behalf of the seller.

A valid seller signature is still required.

Role permissions follow least privilege.

No role should receive capabilities it does not require.

---

## 6. Transfer Invariant

A permissioned asset must not be voluntarily transferred between unauthorized participants.

For a normal transfer:

```text
sender authorized
AND
recipient authorized
```

must both be true.

Minting and burning require separate treatment because the zero address is not a participant.

Conceptually:

```text
zero address → participant
        mint

participant → participant
      transfer

participant → zero address
        burn
```

The AssetToken applies the appropriate authorization rules to each operation.

A revoked holder cannot voluntarily send the permissioned asset.

The issuer may still burn assets from a revoked holder.

---

## 7. Settlement Invariant

A successful DvP settlement must result in both economic legs completing as one transaction.

Before:

```text
Seller
├── owns asset
└── does not own settlement cash

Buyer
├── owns cash
└── does not own allocated asset
```

After successful settlement:

```text
Seller
└── receives cash

Buyer
└── receives asset
```

The fundamental invariant is:

```text
ASSET LEG succeeds
AND
CASH LEG succeeds

        OR

ENTIRE TRANSACTION reverts
```

The protocol does not permit a persistent completed state where only one required leg has settled.

If either transfer fails, Ethereum transaction atomicity rolls back all preceding state changes within the settlement transaction.

This includes the settlement execution marker.

---

## 8. Signed Settlement Authorization

Settlement authorization uses EIP-712 typed structured data.

A settlement instruction contains:

```solidity
struct SettlementInstruction {
    bytes32 settlementId;
    address seller;
    address buyer;
    address assetToken;
    address cashToken;
    uint256 assetAmount;
    uint256 cashAmount;
}
```

The seller signs the exact structured instruction.

The EIP-712 domain binds the signature to:

- protocol name
- protocol version
- chain ID
- SettlementEngine contract address

The current domain identifies:

```text
name:    Institutional Tokenization Platform
version: 1
```

Conceptually:

```text
SettlementInstruction
          │
          ▼
   structured hash
          │
          +
    EIP-712 domain
          │
          ▼
     final digest
          │
          ▼
   seller signature
```

During execution, the SettlementEngine reconstructs the digest and uses ECDSA recovery to determine which address produced the signature.

Settlement requires:

```text
recovered signer == instruction.seller
```

Changing a signed settlement field changes the digest and therefore invalidates the original authorization.

### Seller Authorization vs Token Approval

These are deliberately separate concepts.

The EIP-712 signature means:

```text
"The seller authorized these exact settlement terms."
```

ERC-20 approval means:

```text
"The token owner permits this contract to move up to this amount."
```

An allowance is not treated as a cryptographic signature over the complete settlement instruction.

The current implementation uses seller-side EIP-712 authorization.

The buyer authorizes movement of the cash leg through ERC-20 allowance but does not currently sign the complete settlement instruction.

Bilateral signed authorization may be evaluated in a future version if required by the target institutional workflow.

---

## 9. Replay Protection

Each settlement contains a unique `bytes32 settlementId`.

The SettlementEngine maintains:

```text
settlementId → settled / unsettled
```

A successfully executed settlement ID cannot be executed again.

Conceptually:

```text
First submission
       │
       ▼
signature valid
       │
       ▼
settlement executes
       │
       ▼
settlementId = settled


Second submission
       │
       ▼
same settlementId
       │
       ▼
AlreadySettled
       │
       ▼
REVERT
```

Because the settlement marker is written inside the same atomic transaction as the asset and cash transfers, a failed settlement also rolls back that marker.

A failed transaction therefore does not consume the settlement ID.

---

## 10. Security Principles

### Least Privilege

Administrative, compliance, issuance, emergency, and settlement capabilities are separated according to responsibility.

### Signed Authorization

The seller cryptographically authorizes the exact settlement instruction using EIP-712.

### Domain Separation

Signatures are bound to an EIP-712 domain containing the chain ID and verifying SettlementEngine contract.

This reduces the risk of interpreting the same signature in an unintended execution domain.

### Atomicity

Both economic legs execute within one Ethereum transaction.

Failure of either leg reverts the complete settlement.

### Replay Protection

Successfully executed settlement IDs cannot be reused.

### Reentrancy Protection

Settlement execution uses OpenZeppelin `ReentrancyGuard`.

### Safe Token Interaction

ERC-20 settlement operations use OpenZeppelin `SafeERC20`.

### Permissioned Transfers

AssetToken enforces participant eligibility through IdentityRegistry.

### Emergency Controls

AssetToken supports role-controlled pausing.

### Minimal External Calls

External token interactions are kept narrow and explicit.

### No Sensitive Identity Data On-Chain

The protocol stores participant authorization status rather than underlying KYC documentation.

---

## 11. Efficiency and Modularity

The protocol favors constant-time state lookups.

Examples:

```text
address → authorization status

bytes32 → settlement execution status
```

The system avoids iterating through participant arrays to determine authorization.

Persistent storage writes are minimized where possible.

Events provide historical observability when information does not need to remain directly accessible as contract state.

Modules communicate through narrow responsibilities.

For example, AssetToken only needs to ask:

```text
"is this account authorized?"
```

It does not need to know:

- how KYC was performed
- which organization performed KYC
- where documents are stored
- why a participant was approved
- how institutional credentials were issued

This allows identity and compliance infrastructure to evolve independently from asset ownership logic.

---

## 12. Upgrade Philosophy

Version 0.1 uses simple, non-upgradeable contracts.

Proxy upgradeability introduces additional:

- trust assumptions
- storage-layout risks
- governance complexity
- attack surface
- audit requirements

The initial architecture favors explicit execution paths and smaller trust assumptions.

Modularity provides system-level replaceability before proxy-based upgradeability is introduced.

Upgrade mechanisms should only be added when a concrete operational requirement justifies them.

---

## 13. Implemented Transaction and Security Invariants

The current end-to-end transaction models:

```text
1. Faris configures protocol roles.

2. Wa'el authorizes Luay and Tarik.

3. Luay issues the permissioned NOTE asset.

4. Luay holds NOTE.

5. Tarik holds the mock cash asset.

6. Token owners approve the SettlementEngine
   for the required token movement.

7. Luay signs the exact SettlementInstruction
   using EIP-712.

8. An authorized settlement operator submits:
   instruction + signature.

9. SettlementEngine verifies the seller signature.

10. SettlementEngine attempts the asset leg.

11. AssetToken checks participant eligibility
    through IdentityRegistry.

12. NOTE moves from Luay to Tarik.

13. Cash moves from Tarik to Luay.

14. The settlement ID is marked executed.

15. If any required operation fails,
    the entire transaction rolls back.
```

The current test suite demonstrates:

1. Unauthorized addresses cannot receive permissioned assets.
2. Unauthorized callers cannot issue assets.
3. Revoked participants cannot perform restricted transfers.
4. Paused asset operations are blocked.
5. Settlement fails without sufficient asset balance.
6. Settlement fails without sufficient cash balance.
7. Settlement fails without required token approvals.
8. Failed settlement does not leave one economic leg completed.
9. Duplicate settlement IDs cannot execute twice.
10. Administrative operations respect assigned roles.
11. Unauthorized callers cannot execute settlement.
12. Role revocation removes the associated operational capability.
13. Issuer-controlled burning from a revoked holder remains possible.
14. EIP-712 signed settlement authorization is enforced by the SettlementEngine.

The current complete test suite contains:

```text
64 passing tests
0 failing tests
```

---

## 14. Non-Goals for Version 0.1

Version 0.1 does not attempt to implement:

- complete KYC infrastructure
- production custody infrastructure
- HSM or MPC key management
- cross-chain interoperability
- proxy upgradeability
- privacy-preserving identity
- complex corporate actions
- production stablecoin issuance
- production tokenized-deposit issuance
- order books
- matching engines
- AMMs
- lending markets
- governance tokens
- yield farming
- unnecessary frontend infrastructure

Potential future areas include:

- bilateral signed settlement authorization
- settlement expiration or deadlines
- EIP-1271 institutional smart-wallet signatures
- richer settlement audit events
- expanded role-lifecycle controls
- asset lifecycle functionality
- corporate actions
- deployment tooling
- additional security documentation

These features should only be introduced when a concrete institutional requirement justifies their additional complexity.
