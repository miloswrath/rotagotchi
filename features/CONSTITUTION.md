# Rotagotchi Constitution

## Core Principles

### I. Commit-Triggered Enforcement
Rotagotchi MUST start its enforcement flow from GitHub commit webhooks and
associate the flow with the commit metadata (repo, author, hash, size). This
binding is non-negotiable and must not rely on manual user input.
Rationale: the tamagotchi is accountable to real work.

### II. Proportional Degenerative Time
Required degenerative watch time MUST be proportional to commit size using a
documented, deterministic metric and conversion rate. Any change to the metric
or rate is a constitutional amendment.
Rationale: the punishment must scale with the work performed.

### III. Mandatory Watch Gate
Users MUST complete the required degenerative watch time before resuming work.
The gate MUST actively prevent work-related activity until the owed time is
satisfied.
Rationale: the system only works if it can enforce the cost of commits.

### IV. Avatar Vitality Coupling
Avatar life/health MUST be directly driven by time spent watching degenerative
content. If the required time is not completed, vitality MUST decay; completion
MUST restore or sustain vitality according to the defined model.
Rationale: the avatar reflects compliance in real time.

### V. Deterministic Activity Classification
Work vs. non-work activity MUST be classified using explicit allow/deny lists on
active tabs. The blacklist takes precedence; unknowns default to non-work. All
classification rules MUST be documented and auditable.
Rationale: enforcement depends on consistent classification.

## Operational Policy

- **Commit Size Metric**: The system MUST define how commit size is calculated
  (default: lines added + lines deleted from webhook metadata). The metric MUST
  be documented and consistent across commits.
- **Time Mapping**: The system MUST define the conversion from commit size to
  required watch time (e.g., seconds per line), including rounding rules and
  any minimum/maximum caps.
- **Content Lists**: The whitelist identifies work-related domains/apps; the
  blacklist identifies degenerative content. Changes to these lists MUST be
  version-controlled and reviewed.
- **Monitoring Scope**: Active tab monitoring MUST only capture the minimum
  metadata needed for classification (domain/app/title) and MUST NOT log page
  contents.

## Development Workflow & Enforcement

- **Enforcement State**: On commit receipt, the system MUST enter an "owing"
  state until the required watch time is satisfied.
- **Watch Time Accounting**: Time accrues only while the active tab is
  classified as degenerative content; it MUST pause otherwise.
- **Avatar Updates**: Vitality updates MUST be derived from watch-time events
  and persisted so the avatar state survives restarts.
- **Bypass Control**: Any administrative bypass MUST be explicit, logged, and
  disabled by default.

## Governance

- **Amendments**: Changes require a PR that updates this constitution and any
  dependent templates/docs, plus reviewer approval from maintainers.
- **Versioning**: Semantic versioning is mandatory. MAJOR = breaking principle
  changes/removals; MINOR = new principle or material expansion; PATCH =
  clarifications and non-semantic edits.
- **Compliance Review**: Every plan/spec MUST include a constitution check.
  Features that violate principles must document justification and mitigation.
- **Supremacy**: This constitution overrides conflicting guidance elsewhere.

**Version**: 1.0.0 | **Ratified**: 2026-03-10 | **Last Amended**: 2026-03-10
