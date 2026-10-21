---
name: perpulangan-implementation
description: Use when planning or implementing approved perpulangan flow changes in this repository; keeps product rules, access boundaries, and phase tracking consistent.
---

# Perpulangan Implementation

Use this skill for product planning, implementation, review, or progress reporting for the pesantren holiday travel management application in this repository.

## Source of truth

- Read [`docs/perencanaan-revisi-flow-perpulangan.md`](../../../docs/perencanaan-revisi-flow-perpulangan.md) for approved product rules and implementation baseline.
- Read [`docs/perencanaan-revisi-roster-pulang-dan-cetak.md`](../../../docs/perencanaan-revisi-roster-pulang-dan-cetak.md) for the approved follow-on Revision 1 (Phases 8–11).
- Read [`docs/perencanaan-revisi-tarif-dan-registrasi-pembayaran.md`](../../../docs/perencanaan-revisi-tarif-dan-registrasi-pembayaran.md) for the finalized Revision 2 plan (Phases 12–14); implement only when the user explicitly starts that work.
- Read [`docs/perencanaan-status-event-dan-ux-mobile.md`](../../../docs/perencanaan-status-event-dan-ux-mobile.md) for the unified event-status and mobile-UX plan. Both contexts are final and approved; implement only the phase the user requests, in the documented order and update the tracker.
- Read [`docs/perencanaan-purge-registrasi-keluarga.md`](../../../docs/perencanaan-purge-registrasi-keluarga.md) for the approved admin-only permanent purge of connected family registrations/payments. Preserve its transitive group scope, active-event guard, financial sufficiency checks, password reauthentication, separate purge audit, refund/correction and ambiguous-allocation blockers, and retryable Supabase cleanup.
- Read [`docs/progress-implementasi-perpulangan.md`](../../../docs/progress-implementasi-perpulangan.md) before choosing work. Update it after each meaningful implementation or planning task so progress is visible across conversations.
- The approved plan takes precedence over older code behavior. Treat existing code as implementation to audit/migrate, not as the product rule.
- Do not silently alter an approved business rule. If the requested change conflicts with the plan, explain the conflict and ask only for the decision that cannot be inferred.

## Product invariants

- Event status is the administrative source of truth; event dates are informational and never determine default selection or write eligibility. At most one event is `ACTIVE`. The active event is the default global selection regardless of dates. If none is active, do not infer a writable event from dates; historical events may be explicitly selected for read/export only. `DRAFT` and `COMPLETED` events reject all event-bound create/update/delete operations, including late Return journeys, payments, refunds, corrections, and fleet/assignment changes. Event-master management remains a separate admin operation so a new event can be activated. Global master data and central treasury operations not tied to an event are not disabled by event selection. See the event-status context in [`docs/perencanaan-status-event-dan-ux-mobile.md`](../../../docs/perencanaan-status-event-dan-ux-mobile.md).
- For the approved mobile UX revision, selecting a sidebar route closes the mobile Sheet while preserving desktop behavior. Shared autocomplete/combobox controls must support pointer, touch, and keyboard selection inside dialogs without accidentally dismissing the parent dialog, and remain functional outside dialogs. Declare Indonesian as the root document language (`lang="id"`) and opt the operational UI out of automatic translation (`translate="no"`); verify the suspected Chrome Android Auto Translate interaction rather than treating it as confirmed. Preserve desktop tables while adding mobile card layouts for `/laporan` and `/keuangan`; the cards must expose the same data without requiring horizontal scroll. QA all five finance pages (`/pembayaran`, `/refund`, `/koreksi-keuangan`, `/laporan`, `/keuangan`) across narrow/wide phones, tablet, and desktop without changing business rules.

- A participant has one parent registration per event and separate Pulang (`OUTBOUND`) and Kembali (`RETURN`) journeys. A journey can be added later without duplicating the participant/event only while that event remains `ACTIVE`. One Pulang-pergi submission uses the same destination Korda in both directions; different destinations are submitted as separate one-way entries.
- Registration is owned by the destination Korda. Pusat (`admin`) and Korwil can register across origins within their destination scope. Display cross-Korda origin and destination clearly; approval is offline.
- Keep a santri's origin Korda, registrar/Korda, and journey destination as separate data. A Korda may search cross-origin santri using minimum identifying data but must not gain broad access to the origin Korda's profile.
- External participant profiles contain only name, gender, and address; the intended/destination Korda defines access. They have no origin Korda, phone, or guardian fields. All authorized roles may create a profile, and name, gender, address, and destination Korda are mandatory. Reject incomplete or invalid submissions with a clear list of missing fields; do not save a new draft. A valid submission is immediately COMPLETE and usable for registration without admin review. Legacy drafts may be completed by an authorized role within the destination Korda scope.
- The destination Korda owns a journey's tariff and any overpayment balance. Record participant/payer, origin Korda for santri when available, and destination Korda in the balance history; an external participant has no origin Korda and the UI must show that clearly. If one payment spans multiple destination Kordas and the excess cannot be unambiguously attributed, require explicit allocation per participant/journey. Saldo Lain cannot pay another journey and can only be returned through a refund record.
- One family payment may cover multiple children and journeys with one shared proof. Generate allocation details from payment allocations. If excess covers participants with different origin Kordas, require explicit allocation per participant; never infer the balance owner.
- All roles can process refunds only within their data scope. Record each refund as a new, traceable financial entry; never erase or overwrite the original payment. Corrections use reversal/correction entries.
- Permanent registration/payment purge is a separate admin-only maintenance action governed by its approved feature plan. Never allow a direct registration delete to bypass group closure, financial sufficiency, password reauthentication, and audit. Purge only ACTIVE events; block connected refund/correction or unattributable legacy allocations; preserve participant/master data; audit the full purged scope independently of deleted financial rows.
- All participant payments enter one central treasurer account. Financial reports track central receipts, actual refunds, and cash disbursements from the center to each destination Korda. Only Pusat/admin records an already completed disbursement; this is not a Korda withdrawal request or transfer instruction. Show central cash balance and each Korda's allocated, disbursed, and not-yet-disbursed amounts. Do not store a transfer method. Keep Saldo Lain separate in participant-level reporting, while recognizing its cash is held centrally until refund or disbursement.
- In Korda finance detail, distinguish registration money allocated to journey bills from excess registration payments recorded as Saldo Lain for that destination Korda. “Kas Korda” means this excess-payment balance, not a separate admin-entered fund or a post-expense cash balance. Both categories remain centrally held until disbursed; Korda does not record expenses. Show payment evidence and the Korda's allocation when a shared family payment covers multiple participants/journeys/Kordas. Existing disbursement is an actual amount handed to Korda; do not imply category-level payout allocation until that later feature is specified.
- In the Korda finance detail, group registration payment history by child identity, not by journey card. Summarize the child's bills/receipts and show each distinct payment allocated to them once, with every available payment evidence link; a family payment's displayed amount is only that child's allocation. Keep Saldo Lain history separate.
- Deduct a central fee of Rp10,000 per child per journey whose status is `REGISTERED` from the Korda's registration entitlement. Count every such journey regardless of whether its bill is unpaid, partial, fully paid, or has a refund allocation; `CANCELLED` journeys do not count. Keep gross billed amount, fee, net registration entitlement, actual receipts, excess-payment Saldo Lain, prior disbursement, and currently disbursable cash distinct in the finance detail UI; a bill-based entitlement is not cash already received. Do not apply this fee to Saldo Lain.
- Show the fee calculation in `/laporan` for its selected event and current Korda/direction filters; tagihan and fee remain position totals and do not change with activity-date filters. `/keuangan` is central/global across all events: show gross registered bills, fee, net registration entitlement, and actual recorded payment receipts separately, and put gross/fee/net columns on each Korda row. Never label gross billed amount as cash received.
- Keep the finance surfaces distinct: `/pembayaran` records receipts and their allocations; `/refund` records actual money returned; `/laporan` is read-only analysis; `/keuangan` controls central cash balance and completed disbursements to Kordas. Do not combine reporting filters/tables with cash control actions in one undifferentiated screen.
- Only Pusat/Korwil create or manage buses. All roles may assign participants within the bus/target-Korda scope. Korda assignment authority follows the journey destination/bus Korda, not the participant's origin. Enforce seat capacity on the server; capacity is absolute.
- Fleet planning may begin when operations considers destinations stable and data sufficiently valid. This is not a system percentage, metric, or registration lock. Registration and fleet updates can continue; later changes must be visible for review.
- First release needs printable manifests, not digital attendance. Tracker/GPS must not block local fleet planning.

## Revision 1 invariants — Phases 8–11

- The missing-participant and exclusion workflow applies only to Pulang (`OUTBOUND`). Eligible students are active (`Student.status = true`) and lack an active `OUTBOUND` journey for the event. A `RETURN`-only registration does not remove a student from the Pulang candidate list.
- Exclusions are event/student dispositions, separate from registration, journey, and billing. Only admin may create, edit, or cancel one. Require a reason enum (`Wisuda`, `Partisipan`, `Sedang Pulang`), record actor/time/history, and do not let an exclusion affect `RETURN`. Resolve an active exclusion with an audit trail when an `OUTBOUND` journey is registered.
- The `/rombongan` unassigned warning is scoped to the selected event and regional filters, separates `OUTBOUND` and `RETURN`, and links to assignable journeys. Excluded students have no journey and are not part of this count; canceled journeys are excluded.
- Print requires an explicitly selected journey direction and includes only active journeys with a `JourneyBusAssignment`. Read assignment data from Journey and `JourneyBusAssignment`, not the legacy Registration bus fields.
- Use canonical order `Korwil → destination Korda → bus → direction-specific drop-off/pickup point → name`. Assign dynamic numbers starting at 1 within each destination Korda. Calculate numbers from the complete eligible print roster before secondary display filters, and share one roster/numbering result among luggage cards, tickets, and attendance sheets. New documents recalculate after roster changes; old PDFs remain snapshots.
- Pack cards/tickets continuously across Kordas without a mandatory page break per Korda, while showing destination Korda on every item. Support A3+ at 329 × 483 mm. Show NIS on luggage cards and attendance sheets, leave it blank for external participants, and omit it from tickets. The user performs visual PDF inspection manually; do not treat that manual visual check as agent QA.

## Revision 2 invariants — Phases 12–14

- One DropPoint master price is the Pulang–Kembali package price. Do not halve or duplicate production master rows. Compute the direction-specific fare for each Journey snapshot: Pulang gets the floor half and Kembali gets the remaining rupiah, preserving the exact package total. One direction charges only its half; a later second direction adds only its half.
- Keep tariff display and server snapshot calculation on one shared rule. Master price edits must never rewrite existing Journey snapshots.
- The current registration form submits one participant at a time; do not re-enable batch registration unless the user asks. Family transfers remain available from `/pembayaran`. Registration may record one participant's payment in the same final submission. When payment is selected, require the transfer amount and evidence; if payment is skipped, create no Payment record. Existing Payment/PaymentAllocation/EvidenceFile/Supabase rules remain authoritative; do not create parallel payment semantics or ask for manual payer name.
- One evidence object may support one family payment covering multiple children/journeys; system-generated allocation notes remain mandatory. Partial payments identify the target journeys; excess balance must retain explicit ownership where ambiguous.
- Uploaded evidence is not linked to a payment until final server validation and database transaction succeed. Clean up an uploaded object if finalization fails.
- Verify the production database has no registrations/journeys/payments before tariff cutover as stated in the plan. If data exists, stop and plan ledger reconciliation; never mass-edit snapshots or financial entries.
- The demo registration/payment seeder currently avoids deletion. If changing demo snapshots, add an explicit, development-only reset for seed-owned demo records, report what will be removed, then reseed and verify idempotency. Never reset the whole database, master/student/account data, DropPoint prices, or production data as part of demo seeding.

## Phase workflow

Work one phase at a time by default. A user may explicitly request work across phases. Before coding, inspect the current tracker and repository state, then confirm the requested work fits the active phase. Do not mark a phase complete until its exit criteria and agreed verification are satisfied.

1. **Phase 0 — Baseline and implementation design.** Consolidate current repo audit, schema/data migration approach, access matrix, and implementation slices. Product flow is already approved; refine only details needed for the first slice.
2. **Phase 1 — Region quality and external participants.** Preserve API source values, flag unmapped/ambiguous regions, admin repair flow, external participant profile/draft queue, required-field validation, and duplicate checks.
3. **Phase 2 — Registration and journey access.** Introduce/prepare participant-event parent plus separate journeys, three registration modes, destination-Korda authorization, cross-Korda minimum search, later return registration, and location/tariff snapshots.
4. **Phase 3 — Payments, family allocations, Saldo Lain, and refunds.** Replace paid booleans with payment/allocation records, proof upload/access, automatic family allocation notes, destination-Korda balance ledger with origin/payer attribution, scoped refunds, append-only history, and legacy-payment reconciliation.
5. **Phase 4 — Separated finance modules.** Keep `/pembayaran` and `/refund` focused on their respective transactions; implement read-only financial analysis at `/laporan`; keep central cash, per-Korda held amounts, and completed disbursement records at `/keuangan`. Pusat/admin records completed disbursements; no Korda withdrawal request or transfer instruction is managed by the app.
6. **Phase 5 — Flexible fleet planning.** Restrict bus create/edit to Pusat/Korwil, decouple bus creation from Tracker, assign by journey, enforce capacity atomically on the server, flag changed assignments, and preserve printable manifests.
7. **Phase 6 — Operational views.** Replace placeholder dashboards with event and journey summaries, data completeness, unassigned passengers, and current printable manifests. Link to the dedicated financial reports in Phase 4. Do not add digital attendance unless requested.
8. **Phase 7 — Reconciliation and release readiness.** Reconcile legacy data and balances; confirm access and migration results, verify end-to-end flows, document deployment configuration/retention, and prepare a safe production rollout. Do not run destructive migration or production rollout without explicit authorization.

### Approved follow-on revision

Phases 1–7 remain closed. Revision 1 is finalized in `docs/perencanaan-revisi-roster-pulang-dan-cetak.md`; continue as new phases without rewriting completed history:

- **Phase 8 — Pulang candidates and exclusions.** Build event-scoped active-student candidates without `OUTBOUND` journey, including `RETURN`-only students; add admin-only event/student exclusions with required reason enum and audit; resolve exclusions when outbound registration is created. Do not create billing/journey records for exclusions.
- **Phase 9 — Unassigned journey warning.** Add event- and scope-aware `/rombongan` counts and links for registered journeys without bus, separated by direction.
- **Phase 10 — Canonical print roster and dynamic numbering.** Require direction, select active assigned journeys, use the canonical sort, and compute shared per-destination-Korda numbering before secondary filters.
- **Phase 11 — Print layout and integrated QA.** Apply roster output to luggage cards, tickets, and attendance; add cross-Korda packing and A3+; enforce NIS rules; record functional verification. The user inspects PDF appearance manually.

Revision 2 is planned in `docs/perencanaan-revisi-tarif-dan-registrasi-pembayaran.md`:

- **Phase 12 — Package tariff per direction.** Preserve package master prices, snapshot each direction's half, safely reset/reseed only demo fixtures in development, and verify the production pre-cutover state.
- **Phase 13 — Registration and payment in one flow.** Directly submit one participant or review a multi-participant batch, with optional payment and shared evidence at finalization.
- **Phase 14 — Integrated QA and cutover.** Verify fare/status/ledger consistency, family/partial/overpayment evidence flows, role scope, and deployment conditions.

The unified plan also contains the approved mobile UX revision, separate from the completed baseline and Revisions 1–2. Follow the UXM context in `docs/perencanaan-status-event-dan-ux-mobile.md`:

- **UXM-1 — Mobile navigation and region selection.** Close the sidebar Sheet after mobile navigation; fix pointer/touch/keyboard selection in nested region dialogs; audit the shared Autocomplete/Combobox usages.
- **UXM-2 — Mobile financial report layouts.** Add mobile cards for `/laporan` and `/keuangan`, preserving desktop tables and all displayed data.
- **UXM-3 — Responsive finance QA.** Verify UXM-1/UXM-2 and all five finance surfaces at phone, tablet, and desktop widths. UXM-3 follows UXM-1 and UXM-2.

Dependencies for Revision 1: Phases 8 and 9 are independent; Phase 11 depends on the shared roster/numbering work in Phase 10. Follow the phase order in the tracker unless the user explicitly requests otherwise.

Dependencies: Phase 1 data/identity work precedes Phase 2; Phase 2 is the foundation for Phases 3 and 5; Phase 4 depends on the Phase 3 finance ledger; Phase 6 depends on relevant registration, finance, and fleet data. Phase 7 follows the implemented slices. Independent work may proceed in parallel only when it does not violate these dependencies or produce conflicting schema changes.

## Progress tracking

- Use statuses `Belum dimulai`, `Sedang berjalan`, `Terblokir`, and `Selesai`. Mark blocked only when a real dependency or missing business decision prevents progress; write exactly what is needed to unblock it.
- Track each phase with: outcome, checklist of deliverables/exit criteria, current status, verification evidence, blockers/risks, and next action.
- Update the tracker in the same task that changes phase status. Keep completed history; do not rewrite completed work as if it never happened.
- In user-facing progress reports, state active phase, completed items, verification performed, unresolved blockers, and next milestone. Do not report a percentage unless it is calculated from the tracker checklist.
- If implementation changes the approved plan, update the plan and tracker together and explain the reason in the progress log.
- When working on Revision 1, update the matching Phase 8–11 tracker entry and preserve the completed Phase 1–7 record.

## Implementation discipline

- Enforce authorization and financial/capacity invariants in server actions and database constraints where possible; UI visibility alone is not security.
- Preserve unrelated working-tree changes. Inspect `git status` before editing and do not reset, discard, or overwrite user changes.
- Treat legacy payment booleans as unverified historical state. Do not invent received amounts from current tariffs or claim missing proof exists; put ambiguous history into reconciliation.
- Keep private evidence files in private object storage and authorize every preview/download against the underlying scoped allocation.
- Follow the current repository instructions and the user's test/verification request. Report what was actually checked and any migration or deployment risk.
