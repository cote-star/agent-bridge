# Release Notes

## v0.5.4 (2026-02-10)

### Highlights
- Final documentation language and clarity pass across repository docs.
- Aligns phrasing around context-pack behavior for private repositories.

### Changed
- Polished wording in README, protocol, context-pack policy, and agent instruction docs for consistency and precision.
- Clarified that pack-first flows open project files as needed and do not require making code public.
- Minor grammar and heading consistency refinements across docs.

### Upgrade Notes
- No CLI behavior, schema, or runtime changes.
- Safe documentation-only patch release.

## v0.5.3 (2026-02-10)

### Highlights
- Clarifies context-pack wording for private-project users.
- Removes "open source files" phrasing that could be misread as requiring public code.

### Changed
- The README context-pack section now explicitly states that private repositories are fully supported without making code public.
- `CLAUDE.md` and `CONTEXT_PACK.md` now use "project files" wording for pack-first deep dives.
- Context-pack policy wording updated to clarify that local-only data is not published in package artifacts.

### Upgrade Notes
- No CLI behavior or output-contract changes.
- Safe documentation-only patch release.

## v0.5.2 (2026-02-10)

### Highlights
- Adds full metadata polish for npm and crates.io publication quality.
- Declares Rust MSRV explicitly so crates metadata shows a known `rust-version`.
- Improves demo maintainability by removing hardcoded package versions from demo text.

### Added
- `rust-version = "1.74"` in `cli/Cargo.toml`.
- `documentation = "https://docs.rs/agent-bridge"` in `cli/Cargo.toml`.
- npm metadata refinements: `preferGlobal`, Node `engines`, and expanded discoverability keywords.

### Changed
- Normalized npm `homepage` to `#readme`.
- Demo scripts and assets remain functionally unchanged, but visual labels no longer hardcode release version text.

### Upgrade Notes
- No runtime CLI behavior changes.
- Safe patch upgrade for both npm and crates users.

## v0.5.1 (2026-02-10)

### Highlights
- Improves demo readability in GitHub README with sharper text rendering.
- Adds a dedicated context-pack demo flow in the same terminal visual style.

### Changed
- Tuned demo recorder defaults for README display (`1080x640`) and explicit high-effort lossless WebP encoding.
- Increased terminal text weight in demo players to improve legibility after scaling.
- Updated context-pack demo layout to two panes for clearer text density.

### Upgrade Notes
- No CLI behavior changes.
- Rebuilt demo assets in `docs/demo-*.webp` and context-pack metadata snapshots.

## v0.5.0 (2026-02-10)

### Highlights
- Promotes context-pack to a first-class release feature for token-efficient, agent-first repo understanding.
- Adds Node and Rust parity for `bridge context-pack` commands.
- Finalizes docs and demo coverage so new users can adopt context-pack safely.

### Added
- `bridge context-pack build|sync-main|install-hooks|rollback|check-freshness`.
- `bridge setup --context-pack` bootstrap workflow.
- Agent instruction flow that prioritizes `.agent-context/current/` for end-to-end repo understanding tasks.

### Changed
- README now has a dedicated Context Pack section describing what it is, why to use it, recommended workflow, main-only sync policy, usage boundaries, and recovery model.
- Added context-pack demo steps and quick setup references in README.

### Fixes
- Reduced context-pack snapshot churn for unchanged builds.
- Improved hook install behavior with explicit `core.hooksPath` override warning.
- Improved freshness checks and CI alignment for context-pack update discipline.

### Upgrade Notes
- No breaking CLI changes for existing `read`, `list`, `search`, `compare`, `report`, `setup`, `doctor`, or `trash-talk` users.
- To enable context-pack automation in an existing repo:

```bash
bridge setup --context-pack
# or
bridge context-pack build
bridge context-pack install-hooks
```
