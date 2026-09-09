# Institutional Tokenization Platform

A modular smart-contract platform for **permissioned digital asset issuance and atomic Delivery-versus-Payment (DvP) settlement** on EVM-compatible networks.

The project models core infrastructure used in institutional digital-asset systems: participant authorization, permissioned asset ownership, role-controlled issuance, signed settlement instructions, and atomic exchange of tokenized assets against tokenized cash.

It is designed as an infrastructure-focused reference implementation rather than a consumer DeFi application.

---

## Overview

Traditional financial-market infrastructure separates several responsibilities:

- participant eligibility and compliance
- asset issuance and ownership
- cash movement
- trade authorization
- settlement execution
- administrative and emergency controls

This project models those responsibilities as separate smart-contract modules rather than combining them into a single monolithic contract.

The initial implementation supports a simplified institutional transaction:

1. A compliance officer authorizes eligible participants.
2. An issuer creates a permissioned tokenized asset.
3. A seller signs the exact settlement terms using EIP-712 typed structured data.
4. An authorized settlement operator submits the signed instruction.
5. The SettlementEngine verifies the seller's authorization.
6. The asset and cash legs execute atomically.
7. If either leg fails, the entire transaction reverts.

The result is a permissioned settlement workflow where **either both sides of the exchange complete or neither does**.

---

## Architecture

```text
                    ┌──────────────────────┐
                    │   IdentityRegistry   │
                    │                      │
                    │ Participant          │
                    │ authorization state  │
                    └──────────┬───────────┘
                               │
                               │ eligibility
                               ▼
┌──────────────────┐    ┌──────────────────┐
│    AssetToken    │    │ SettlementEngine │
│                  │    │                  │
│ Permissioned     │◄───│ Atomic DvP       │
│ ERC-20 asset     │    │ settlement       │
│                  │    │                  │
│ Mint / Burn      │    │ EIP-712          │
│ Pause            │    │ authorization    │
└──────────────────┘    └────────┬─────────┘
                                 │
                                 │ transferFrom
                                 ▼
                        ┌──────────────────┐
                        │  MockCashToken   │
                        │                  │
                        │ Test cash leg    │
                        └──────────────────┘
```

### IdentityRegistry

Maintains minimal on-chain participant authorization state.

Responsibilities:

- authorize participants
- revoke participants
- expose authorization status to other contracts
- restrict compliance actions using role-based access control
- emit authorization and revocation events

Sensitive KYC information is intentionally **not stored on-chain**.

The registry records only whether an address is currently authorized.

---

### AssetToken

A permissioned ERC-20 representing a tokenized financial asset.

Responsibilities:

- role-controlled issuance
- issuer-controlled burning
- transfers between authorized participants
- transfer restrictions based on IdentityRegistry status
- emergency pause/unpause controls

The token delegates participant eligibility decisions to the IdentityRegistry instead of duplicating compliance state.

This keeps identity policy separate from asset ownership logic.

---

### SettlementEngine

Coordinates atomic exchange between a tokenized asset and an ERC-20 cash leg.

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

The seller signs the exact instruction using **EIP-712 typed structured data**.

An authorized settlement operator then submits:

```solidity
settle(instruction, signature)
```

Before settlement, the engine verifies:

- the instruction contains valid non-zero fields
- the caller holds `SETTLER_ROLE`
- the EIP-712 signature corresponds to the seller
- the settlement ID has not already been executed

The engine then performs:

```text
Asset:
seller ───────────────► buyer

Cash:
buyer  ───────────────► seller
```

Both transfers occur inside the same Ethereum transaction.

If either transfer fails, all state changes are reverted.

---

### MockCashToken

A development-only ERC-20 used to represent the cash leg during testing.

It can model the settlement behavior of instruments such as:

- tokenized deposits
- regulated stablecoins
- wholesale settlement tokens

It is **not intended to represent a production stablecoin or deposit token implementation**.

---

## Signed Settlement Authorization

Settlement instructions use OpenZeppelin's EIP-712 and ECDSA implementations.

The EIP-712 domain binds a signature to:

- the protocol name
- protocol version
- chain ID
- deployed SettlementEngine address

This prevents a valid signature from being interpreted as authorization for an unrelated contract or domain.

Conceptually:

```text
Settlement Terms
       │
       ▼
Structured EIP-712 Message
       │
       ▼
Domain Binding
       │
       ▼
Seller Signature
       │
       ▼
SettlementEngine
       │
       ▼
Recover Signer
       │
       ▼
recoveredSigner == seller
```

A valid signature proves that the seller authorized the exact signed settlement instruction.

The current implementation uses **seller-side authorization**. Buyer approval of the cash token authorizes token movement but is not treated as a cryptographic signature over the complete settlement terms.

Bilateral signed settlement authorization is outside the current v0.1 scope.

---

## Atomic Delivery-versus-Payment

The core settlement invariant is:

> **The asset transfer and cash transfer must either both succeed or both fail.**

The SettlementEngine first marks the settlement as executed and then attempts both token transfers.

Because all operations occur within one transaction, any later revert also rolls back the settlement marker and any earlier token movement.

Example:

```text
1. Settlement begins

2. Asset transfer succeeds
   Luay ──100 NOTE──► Tarik

3. Cash transfer fails
   Tarik ──1000 CASH─X─► Luay

4. Transaction reverts

FINAL STATE:

Luay:   100 NOTE
Tarik:  0 NOTE

Tarik:  1000 CASH
Luay:   0 CASH

settled[id] = false
```

There is no partial settlement state.

---

## Permission Model

The platform separates operational responsibilities using OpenZeppelin `AccessControl`.

| Role | Responsibility |
|---|---|
| `DEFAULT_ADMIN_ROLE` | Administrative role management |
| `COMPLIANCE_ROLE` | Participant authorization and revocation |
| `ISSUER_ROLE` | Asset issuance and redemption/burning |
| `PAUSER_ROLE` | Emergency asset-transfer controls |
| `SETTLER_ROLE` | Submission of settlement transactions |

This separation models institutional least-privilege principles and avoids giving a single operational actor unnecessary authority.

---

## Security Properties

The current implementation focuses on several explicit security properties.

### Permissioned transfers

Asset transfers require eligible participants according to the IdentityRegistry.

Revoked participants cannot voluntarily transfer permissioned assets.

### Signed instructions

Settlement terms are cryptographically bound to the seller using EIP-712.

Changing a signed field changes the digest and invalidates the authorization.

### Replay protection

Every settlement contains a unique `settlementId`.

Successfully executed IDs cannot be settled again.

### Atomicity

The asset and cash legs execute within one transaction.

Failure of either leg reverts the complete settlement.

### Reentrancy protection

Settlement execution uses OpenZeppelin `ReentrancyGuard`.

### Safe token interaction

ERC-20 settlement transfers use OpenZeppelin `SafeERC20`.

### Emergency controls

Permissioned asset movement can be paused by an authorized operator.

### Minimal identity state

Personal KYC information is not stored on-chain.

Only authorization status is maintained.

---

## Example Transaction

Consider a simplified tokenized-note transaction.

```text
Participants

Faris  → Platform administrator
Wa'el  → Compliance officer
Luay   → Note issuer / seller
Tarik  → Investor / buyer
Settler → Authorized settlement operator
```

### 1. Participant authorization

Wa'el authorizes Luay and Tarik through the IdentityRegistry.

```text
IdentityRegistry

Luay   → AUTHORIZED
Tarik  → AUTHORIZED
```

### 2. Asset issuance

Luay issues 100 NOTE.

```text
Luay
└── 100 NOTE
```

Tarik holds 1,000 units of the mock cash token.

```text
Tarik
└── 1,000 CASH
```

### 3. Settlement authorization

Luay signs:

```text
Seller:       Luay
Buyer:        Tarik
Asset:        NOTE
Asset amount: 100
Cash:         CASH
Cash amount:  1,000
Settlement:   unique settlement ID
```

### 4. Settlement

The authorized settlement operator submits the instruction and Luay's signature.

```text
                 SettlementEngine
                       │
              verify EIP-712 signature
                       │
                       ▼
             ┌───────────────────┐
             │                   │
             ▼                   ▼

Luay ──100 NOTE──► Tarik

Luay ◄─1000 CASH── Tarik
```

### 5. Final state

```text
Luay
├── 0 NOTE
└── 1,000 CASH

Tarik
├── 100 NOTE
└── 0 CASH

Settlement ID
└── EXECUTED
```

---

## Testing

The project currently contains **64 passing tests** covering unit and integration behavior.

```bash
npx hardhat test
```

Coverage includes:

- identity authorization
- identity revocation
- compliance-role enforcement
- role revocation
- permissioned minting
- permissioned transfers
- issuer-controlled burning
- emergency pause behavior
- settlement validation
- settlement-role enforcement
- EIP-712 seller authorization
- atomic asset/cash exchange
- insufficient asset balances
- insufficient cash balances
- missing token approvals
- revoked buyers
- revoked sellers
- paused assets
- settlement replay protection
- transaction rollback behavior

The integration suite verifies that the contracts behave correctly as a system rather than only in isolation.

---

## Technology

- Solidity `0.8.34`
- Hardhat `3`
- TypeScript
- ethers.js `6`
- OpenZeppelin Contracts
- Mocha
- Chai
- EIP-712
- ECDSA
- ERC-20
- AccessControl
- SafeERC20
- ReentrancyGuard
- Pausable

---

## Design Principles

The platform follows several architectural constraints:

**Modular state ownership**

Each contract owns a narrow category of state.

**Minimal dependencies**

Contracts depend only on the interfaces required to perform their responsibilities.

**No duplicated compliance state**

AssetToken queries IdentityRegistry rather than maintaining its own authorization mapping.

**Least privilege**

Administrative, compliance, issuance, emergency, and settlement responsibilities are separated.

**Minimal on-chain identity data**

The protocol does not attempt to place full KYC records on-chain.

**No premature upgradeability**

The initial version is intentionally non-upgradeable to keep trust assumptions and execution paths explicit.

**No unnecessary protocol surface**

The project intentionally avoids unrelated DeFi features such as AMMs, yield farming, governance tokens, lending pools, or retail trading functionality.

---

## Current Scope

The current implementation demonstrates the core transaction path:

```text
Participant Authorization
          ↓
Permissioned Asset Issuance
          ↓
EIP-712 Settlement Authorization
          ↓
Atomic Asset / Cash Settlement
          ↓
Replay Protection
```

The project is intended as a focused foundation for exploring institutional digital-asset infrastructure rather than a complete production financial system.

---

## Non-Goals

The current version does not attempt to implement:

- complete KYC/AML infrastructure
- custody infrastructure
- production stablecoins or deposit tokens
- privacy-preserving identity
- cross-chain settlement
- proxy upgradeability
- order books or matching engines
- AMMs
- lending markets
- yield farming
- governance tokens
- complex corporate actions
- production key-management infrastructure

These concerns would require additional operational, legal, security, and infrastructure assumptions beyond the scope of this implementation.

---

## Repository Structure

```text
contracts/
├── core/
│   ├── AssetToken.sol
│   ├── IdentityRegistry.sol
│   └── SettlementEngine.sol
├── interfaces/
│   ├── IIdentityRegistry.sol
│   └── ISettlementEngine.sol
└── mocks/
    └── MockCashToken.sol

test/
├── AssetToken.ts
├── IdentityRegistry.ts
├── MockCashToken.ts
├── SettlementEngine.ts
└── SettlementIntegration.ts

docs/
└── architecture.md
```

---

## Status

Current development milestone:

**Permissioned asset issuance + signed atomic DvP settlement**

- IdentityRegistry implemented
- Permissioned AssetToken implemented
- Role-based controls implemented
- Emergency pause controls implemented
- SettlementEngine implemented
- SafeERC20 settlement implemented
- Reentrancy protection implemented
- EIP-712 seller authorization implemented
- Settlement replay protection implemented
- Atomic DvP integration tests implemented
- 64 tests passing

Further development will remain focused on institutional digital-asset infrastructure and explicit security properties rather than expanding into unrelated Web3 functionality.