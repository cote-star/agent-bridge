# Release Notes

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
