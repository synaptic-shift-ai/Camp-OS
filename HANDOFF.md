# Handoff — pricing integrity, tax engine, and what comes next

**Branch:** `claude/admiring-volta-povm5j` — clean, pushed, 19 commits ahead of `develop`.
**Gates:** `npm run check` clean (0 errors, 1003 pre-existing warnings). 2518 tests passing, 3 skipped.
**Plan file:** `/root/.claude/plans/refactored-greeting-nygaard.md` — the detailed version of all of this.
**No PR opened.** Nothing has been merged.

---

## Goal

CampLife feature parity sufficient to migrate Willow Lake off CampLife. Not the Feb 2026 MVP list,
which is essentially met.

Planning the first parity item (**S-1**, sellable items + reservation folio) surfaced two
prerequisites, both of which have been worked. A third was found and is not yet approved.

---

## S-0 — Pricing configuration integrity ✅ COMPLETE (11 commits, ~10 days)

The pricing path hardcoded business data that settings already existed to govern, and in one case
charged guests less than it quoted them. A folio cannot itemize a stay faithfully on top of that.

**What it fixed, beyond the planned scope:**

- **Online bookings quoted fees they never charged.** `guest/reservations/create` computed a cabin
  cleaning fee and a 10% service fee, assigned both to the breakdown, then built the total without
  them. Guests were undercharged.
- **`actions.ts` had a degraded fallback** that wrote `total_amount` and raised a payment
  installment from a guessed 7/28 night split — billing guests on assumed thresholds.
- **40 hardcoded threshold literals** (week = 7, month = 28) removed; `DEFAULT_TAX_RATE = 0.085`
  deleted outright.
- **Four pricing engines held divergent fee/discount/tax logic.** Each rule now has one home:
  `src/lib/config/{fee-rules,tax-rules,rate-periods,discount-rules}.ts`.
- **`pricing-enhanced.ts` taxed fees marked non-taxable** — it accumulated a taxable subtotal and
  never read it.
- **The configured pet fee was charged twice** once generic fees were applied online.
- **The confirmation PDF did not foot** once fees existed.
- The row→quote mapping was written three times with different casts; now one `toQuoteStayInput`.

**Key artefacts:**
- `src/modules/BookingEngine/application/queries/QuoteStayQuery.ts` — the single pricing authority
  for the guest path. Called by `POST /api/guest/quote` and `reservations/create`.
- `src/lib/config/*-rules.ts` — four pure, tested rule modules.
- An **805-configuration invariant matrix**, mutation-verified, asserting quoted === stored
  `total_amount` === amount charged.
- `npm run test:db` gates the six live-Supabase integration tests (previously hidden in a config
  exclusion).

---

## S-3 — Tax engine ◐ 4 of 6 done (5 commits, ~8 days)

Tax was **one rate and one name on a property** (`pricing_config.tax_rate` / `tax_name`). That
cannot express the country this has to be sold into: Ohio taxes a stay under 30 nights and exempts
it at 30+, Indiana applies a flat rate with no gate, and a state/county/city stack must be
**remitted separately**. Tax had to become a list of lines.

| | Status |
|---|---|
| **S-3.1** migration | ✅ `c6f22a1` |
| **S-3.2** rule module | ✅ `2abfde8` |
| **S-3.3** aggregate + repo + admin API | ✅ `5f750cb`, `4a271ba` |
| **S-3.4** server pricing | ✅ `b0389f0` — **server paths only** |
| **S-3.5** settings UI | ❌ not started |
| **S-3.6** per-tax rows + exemptions | ❌ not started |

### What exists now

**Four tables** (`supabase/migrations/20261108120000_add_tax_engine_tables.sql`):
- `property_taxes` — name, authority, `rate_type` (`percentage|per_night|flat`), `rate_bp` (basis
  points) or `amount_cents`, `min_nights`/`max_nights` gate, `basis`/`priority` for compounding,
  per-tax `discounts_reduce_taxable_amount`, `exemptible`, `effective_from`/`to`, `enabled`.
- `tax_categories` — classification only, **no rate**. Seeded 5 per property.
- `tax_applicability` — tax × category.
- `guest_tax_exemptions` (+ `_taxes`) — certificate on file, per property.

Plus `upsert_property_tax` (`20261108130000_...sql`) — writes a tax and its applicability in one
transaction, because a tax must always name at least one category.

**Ohio and Indiana are pure configuration.** Ohio = one row, `max_nights: 29`. A 35-night stay
produces no tax line. Add a county row and both appear, independently remittable.

**Rules settled** (in `src/lib/config/tax-rules.ts`, 45 tests, mutation-verified on 8 breaks):
1. A tax with a duration gate never reaches a charge with no night count, so Ohio's lodging gate
   cannot land on firewood.
2. Effective dates resolve against the **charge's own date**, never today.
3. Each authority rounds on its own — on 111¢ at 5.75% + 3.00% that is 9¢, where one combined
   8.75% rate gives 10¢.
4. A filtered-out tax yields **no line**; a waived one yields a **zero line marked exempt**.
5. An exemption requires a guest, so a walk-in folio cannot be exempt.
6. `discounts_reduce_taxable_amount` is per tax, not per property.

**Code:** `PropertyTax` aggregate + `SupabasePropertyTaxRepository` in `PropertyManagement`;
`StayTaxLines` in `BookingEngine/domain/services/` is the shared assembly both server pricing paths
use; admin API at `api/v1/properties/[propertyId]/taxes/`.

### Defects found and fixed while building it

- **My own SQL bug:** an unqualified `code` in the category-lookup subquery bound to
  `tax_categories.code`, making the comparison `c.code = c.code` and the unknown-code check pass
  always. Fixed and verified against a real PostgreSQL 16 cluster.
- **`PropertyTax.update()` blanked fields a partial request body omitted** — a partial body types
  every key as possibly `undefined`, and a naive spread wrote them.
- **`reservations/create` reads with the guest's own client.** `property_taxes` is staff-readable
  only, so a guest would have got zero rows and been charged a stay with **no tax at all**. Now
  reads via service role.
- **Extensions kept the single rate.** A property adding a county tax would collect it on the
  booking and not on the extension. Both paths now share `StayTaxLines`.

### Deliberate temporary code — REMOVE LATER

`resolveStayTaxes` in `src/modules/BookingEngine/domain/services/StayTaxLines.ts` synthesises one
lodging tax from `pricing_config.tax_rate` when a property has no `property_taxes` rows. This
bridges deployment only: code can reach production before the migration is applied, and a property
still carrying a rate must keep collecting it. **It is the second source of truth this work exists
to eliminate.** Delete it once the migration is applied everywhere.

### Operational note

`src/contracts/db.ts` was updated by generating types from a throwaway local PostgreSQL cluster
holding only these migrations, then splicing the five table blocks and one RPC entry into the
committed file in the repo's (older) generator format. **Run `npm run gen:db` against the real
linked project once the migrations are applied**, and expect it to reformat the file.

The RPC's argument types are overridden per CLAUDE.md D-4, with the reason in the file: a Postgres
signature carries no nullability, so the generator types all 17 arguments non-null while 7 are
genuinely nullable.

---

## S-4 — One pricing service ⚠️ PROPOSED, NOT APPROVED

**This is where work stopped.** Written up in the plan file; no code written.

S-3.4 was meant to cover "guest and staff paths both". It covered the server. Wiring it showed why
the staff path could not simply be included.

### The measured problem

| Where | Runs | Used by | Tax source |
|---|---|---|---|
| `QuoteStayQuery.ts` (524 lines) | server | guest quote, guest booking | tax lines ✅ |
| `pricing-enhanced.ts` (733 lines, `lib/booking/`) | server | extensions, renewals | tax lines ✅ |
| `pricing-summary.tsx` (732 lines) | **browser** | staff booking | legacy rate, computed twice (`:445`, `:479`) |

`BookingEngine/domain/services/PricingCalculator.ts` is the destination the codebase's own docs
name ("will be migrated to this service during API consolidation (Phase 4)"). It has **zero
callers**; `calculatePrice` and `getBaseNightlyRate` warn and return zeros. `lib/booking/` is
11,692 lines marked legacy and scheduled for deletion (R-1), and two of three pricing paths live
inside it.

**The live correctness hole:** `pricing-summary.tsx:449` calls `onTotalChange(...)` →
`reservations/new/page.tsx:774` posts it as `totalAmountCents` →
`CreateManualReservationCommand.ts:191` writes it to `total_amount` verbatim. **A staff-created
reservation's total, tax included, is computed in a browser and trusted by the server.** This does
not bite yet only because there is no settings UI with which to add a second tax — which is exactly
why S-3.5 was moved behind S-4.

### Proposed scope (≈10 days)

S-4.1 `StayPricingService` in BookingEngine · S-4.2 authenticated
`POST /api/v1/properties/[propertyId]/quote` · S-4.3 staff form renders the server breakdown ·
S-4.4 `CreateManualReservationCommand` computes `total_amount` and the DTO field is removed ·
S-4.5 extensions call the service, `pricing-enhanced.ts` collapses, dead stubs retired.

**Deliberately out:** reservation *creation* is also split four ways (guest route, manual command,
`lib/booking/reservation.ts` via `lib/booking/api.ts`, `actions.ts`). Real duplication, not a money
hole; folding it in makes this a multi-week booking rewrite with a customer testing in production.

### Open question at the moment work stopped

The user was asked how far the refactor should go — pricing spine only, pricing + reservation
creation, or staging the spine so the risky staff-form part becomes a separate decision. **They
stopped work before answering.** They did answer the data question: **leave existing reservations
alone, it is test data, fix forward.**

---

## Standing constraints — do not violate

- **CLAUDE.md**: no references to Claude, Anthropic, or AI in commits, code comments, or
  user-facing content. GH-2 forbids AI attribution, "Generated with" footers, Co-Authored-By AI
  lines and robot emojis in commit messages. Honoured in all 19 commits.
- **Never hardcode business data.** Stated emphatically by the user. Every fee, rate, threshold and
  taxability decision reads from configuration.
- **R-1:** do not add new code to `lib/booking/`. Editing existing logic there is fine.
- **M-5:** `src/modules/Catalog/` must be agreed before being created. **Still unapproved** — the
  duplication check was done and passed (no existing module owns `SellableItem` or
  `RevenueCenter`), but sign-off was never given.
- **Do not reconfigure the `main` branch ruleset.** The user: "the required checks are well
  intended even if they need to be reconfigured and I'm not ready to do that yet."
- **Do not create a PR** unless asked.
- **Leaked credentials** appeared in earlier WhatsApp exports in this project's history (AWS access
  key + secret, Supabase service_role keys, AWS console logins, Stripe publishable key, CampLife
  credentials, a Willow Lake admin password, Taskade and SMTP passwords). Do not repeat the values.
  The outstanding recommendation is to rotate them and revoke the AWS key.
- 9 merged branches are still awaiting deletion (blocked on permissions).

---

## S-1 — Sellable items + folio (the original goal, not started)

Design decisions already made with the user: charge-only, no tender; inventory flag and stock field
but no movement; revenue center first class; catalog-driven UI replacing the two existing free-text
POS dialogs; the folio itemizes everything **including the stay**; stay charges freeze at check-in
with a manager override written to the activity log; line-item tables with journal-entry-grade
granularity (who, when, origin, payment method) in the schema from day one.

`tax_categories` already exists, so the catalog is unblocked on that count. What Phase 2's folio
waits on is **one breakdown shape to itemize** — hence S-4 first.

### Research already done for Phase 1 — do not redo

**M-5 duplication check: PASSED, no overlap.** All 58 tables were inventoried; none models a
sellable product, a goods price list, stock, or a place of sale. Two things are adjacent and should
be **consumed, not re-created**:

- `UserDefinedFee` (`src/lib/config/types.ts:91+`, stored in `properties.pricing_config` jsonb) is
  the closest shape — title, value, `is_taxable`, `display_order`, `enabled`. But it is
  *stay-attached*: triggered by stay conditions, no row identity, no quantity or unit, no revenue
  centre. Firewood at the camp store cannot be expressed as one. **Mirror its field shape** so the
  two read as one system, and decide explicitly whether `SellableItem` eventually subsumes it.
- The tax engine already anticipates goods. `tax_categories` seeds `retail`, `prepared_food` and
  `service`; `TaxableCharge` in `src/lib/config/tax-rules.ts:153` documents itself as *"a stay, a
  fee, or a store sale"* with `nights: null` for goods, and is tested that way. `SellableItem`
  should carry a `tax_categories.code` reference rather than invent its own taxability flag.

**Correction to something I said earlier in this session.** I described the POS surface as "two
working dialogs". One is dead:

- `src/components/dashboard/pos/pos-transaction-dialog.tsx` (399 lines) — **never imported
  anywhere.** Verified. Decide whether to delete it or make it the catalog till.
- `src/components/dashboard/pos/reservation-pos-transaction-dialog.tsx` (191 lines) — live, mounted
  once at `reservation-ledger-page.tsx:318`.

**What a POS sale is today:** the operator types a free-text description and a dollar amount.
Nothing else — no quantity, no unit price, no item identity, no tax, no revenue centre, no payment
method choice. It writes **two** `financial_transactions` rows (`type: 'charge'` then
`type: 'payment'`, both `source: 'pos'`, both `payment_method: 'cash'` hardcoded) via two
sequential non-transactional POSTs, so a failure on the second orphans an unpaid charge. The
description lands in `notes`, which is the only record of what was sold — so "Firewood", "firewood
bundle" and "FW bundle" are three unaggregatable strings. There is **no `category` column on
`financial_transactions` and no link to `tax_categories`**, so POS sales are currently untaxed and
uncategorised. The clean seam is to add `item_id`, `quantity`, `unit_price_cents`,
`revenue_center_id` and a tax category alongside `notes`, keeping `notes` as the one-off override —
not to replace the transaction model.

**Adding a `catalog.*` permission has 4–8 touch points, two of which fail silently:**

1. `src/lib/rbac/permissions.ts` — the `PermissionKey` union plus `OWNER_`, `ADMIN_` and
   `MANAGER_PERMISSIONS` sets (three separate literals).
2. `src/lib/rbac/staff-categories.ts` — `front_desk` (it already holds
   `financial.create_charge`), **and** the `all` set, which is a hand-maintained union of the other
   categories, not computed. Miss it and the union silently diverges.
3. `src/lib/rbac/role-category-module-access.ts` — maps a UI checkbox to a `PermissionKey`. The
   outer type is `Partial<...>`, so **omitting the block compiles and fails at runtime**: the
   checkbox grants nothing.
4. `staff-access-dialog.tsx` — the picker rows. This one is a non-`Partial` `Record`, so a missing
   module key is a compile error. The `id` strings must match step 3 exactly.
5. If Catalog becomes a dashboard nav module: `dashboard-nav-modules.ts`,
   `dashboard-layout-context.ts:242` (exhaustive `satisfies Record<...>`, compile error if missed),
   and a new `src/lib/dashboard/catalog-module-access.ts` following the existing per-module pattern.
6. `permissions.test.ts` asserts individual keys and **never the full set**, so nothing fails when a
   key is half-wired. Add explicit assertions.
7. **No database migration is needed** — `property_role_categories.access` is schema-free jsonb.
8. Do **not** touch `src/modules/StaffManagement/domain/value-objects/Permissions.ts` or
   `src/types/api/v1/schemas/staff.ts`. They are a separate legacy colon-separated permission system
   (`'financial:manage'`), explicitly marked legacy in its own header. Both files export a type
   literally named `PermissionKey`, so importing from the wrong path typechecks against the wrong
   union.

**A pre-existing bug to not copy.** `src/app/api/v1/financial/charges/route.ts:102-107` requires
`minimumRole: 'admin'` *and* `permission: 'financial.record_payment'`. Role ranks are
owner 40 / admin 30 / manager 20 / staff 10, so this locks out managers and `front_desk` staff who
do hold that permission. It also checks `record_payment` rather than `financial.create_charge`,
which is defined at `permissions.ts:46` and — verified — **used nowhere**. If Catalog adds a sell
endpoint, choose the role/permission pair deliberately.

---

## Also flagged, not yet addressed

- `book/[slug]/page.tsx:437` — a promotional per-night discounted price computed outside the quote
  path. → P-02
- `financial_invoices` is dead code with a confirmed round-trip bug: `Invoice.toPersistence():442`
  calls `item.toJSON()`, which `InvoiceLineItem` never defines, so the base writes
  `unitPrice: {amountInCents}` while `fromJSON()` reads `data.unitPriceCents` and throws. Logged so
  nobody builds on it.
- `SupabaseTransactionRepository` has no tenant filter on `findById`, `findByReservation`,
  `findByInvoice`, `findByProcessorEventId` — it relies on RLS, which the service-role client used
  by the charges route bypasses.
- No read path filters `is_voided` on transactions, so voided rows surface everywhere.
- Domain events are raised and dropped: `save()` does not publish, handlers call
  `clearDomainEvents()`.
- **Willow Lake's actual tax configuration** is still needed from the user: which authorities they
  remit to, each rate, and whether Ohio's 30-night exemption is the only duration gate that applies.
  Worth confirming whether the statute's "30 days" means `max_nights: 29` or `30`.
