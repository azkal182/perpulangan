---
name: perpulangan-implementation
description: Use when planning or implementing approved perpulangan flow changes in this repository; keeps product rules, access boundaries, and phase tracking consistent.
---

# Perpulangan Implementation

Use this skill for product planning, implementation, review, or progress reporting for the pesantren holiday travel management application in this repository.

## Source of truth

- Read [`docs/perencanaan-revisi-flow-perpulangan.md`](../../../docs/perencanaan-revisi-flow-perpulangan.md) for approved product rules and implementation baseline.
- Read [`docs/perencanaan-revisi-roster-pulang-dan-cetak.md`](../../../docs/perencanaan-revisi-roster-pulang-dan-cetak.md) for the approved follow-on Revision 1 (Phases 8–11).
- Read [`docs/progress-implementasi-perpulangan.md`](../../../docs/progress-implementasi-perpulangan.md) before choosing work. Update it after each meaningful implementation or planning task so progress is visible across conversations.
- The approved plan takes precedence over older code behavior. Treat existing code as implementation to audit/migrate, not as the product rule.
- Do not silently alter an approved business rule. If the requested change conflicts with the plan, explain the conflict and ask only for the decision that cannot be inferred.

## Product invariants

- A participant has one parent registration per event and separate Pulang (`OUTBOUND`) and Kembali (`RETURN`) journeys. A journey can be added later without duplicating the participant/event. One Pulang-pergi submission uses the same destination Korda in both directions; different destinations are submitted as separate one-way entries.
- Registration is owned by the destination Korda. Pusat (`admin`) and Korwil can register across origins within their destination scope. Display cross-Korda origin and destination clearly; approval is offline.
- Keep a santri's origin Korda, registrar/Korda, and journey destination as separate data. A Korda may search cross-origin santri using minimum identifying data but must not gain broad access to the origin Korda's profile.
- External participant profiles contain only name, gender, and address; the intended/destination Korda defines access. They have no origin Korda, phone, or guardian fields. All authorized roles may create a profile, and name, gender, address, and destination Korda are mandatory. Reject incomplete or invalid submissions with a clear list of missing fields; do not save a new draft. A valid submission is immediately COMPLETE and usable for registration without admin review. Legacy drafts may be completed by an authorized role within the destination Korda scope.
- The destination Korda owns a journey's tariff and any overpayment balance. Record participant/payer, origin Korda for santri when available, and destination Korda in the balance history; an external participant has no origin Korda and the UI must show that clearly. If one payment spans multiple destination Kordas and the excess cannot be unambiguously attributed, require explicit allocation per participant/journey. Saldo Lain cannot pay another journey and can only be returned through a refund record.
- One family payment may cover multiple children and journeys with one shared proof. Generate allocation details from payment allocations. If excess covers participants with different origin Kordas, require explicit allocation per participant; never infer the balance owner.
- All roles can process refunds only within their data scope. Record each refund as a new, traceable financial entry; never erase or overwrite the original payment. Corrections use reversal/correction entries.
- All participant payments enter one central treasurer account. Financial reports track central receipts, actual refunds, and cash disbursements from the center to each destination Korda. Only Pusat/admin records an already completed disbursement; this is not a Korda withdrawal request or transfer instruction. Show central cash balance and each Korda's allocated, disbursed, and not-yet-disbursed amounts. Do not store a transfer method. Keep Saldo Lain separate in participant-level reporting, while recognizing its cash is held centrally until refund or disbursement.
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
