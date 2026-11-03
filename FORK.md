# Personal Orca fork

This fork tracks [stablyai/orca](https://github.com/stablyai/orca) and carries
integration changes for an independently managed agent harness.

## Repository workflow

- `origin` points to `r1cA18/orca`.
- `upstream` points to `stablyai/orca`.
- Keep `main` aligned with upstream. Develop changes on `feature/`, `fix/`, or
  `docs/` branches and review them against their upstream base.
- The initial DSH integration is on `feature/dsh-session-history`, based on
  upstream commit `18f674e69ff6708b634f53d668582d3943acb74d`.
- Keep upstream's license and copyright notices. Do not commit credentials,
  local account bindings, saved personal conversations, or runtime databases.

## DSH integration

The fork reads DeepSeek Harness v4 conversation files into Orca History and
search, including concatenated Zstandard frames and relocated `DSH_HOME` roots.
It filters runtime context injections out of user messages and preserves the
session's DSH home when building a TUI resume command.

Provider authentication, model routing and billing belong to the harness.
Orca consumes persisted conversations without importing provider credentials.
A provider succeeding does not by itself prove History ingestion; both paths
have separate acceptance checks.

See [implementation and verification](docs/reference/dsh-session-history-progress.md).

## Local development

Follow `AGENTS.md` and the upstream contributor guide. Use the repository's
pinned package manager and runtime. Run `pnpm check:changed` against the feature's
upstream base immediately before pushing, with scoped follow-up checks if the
selection becomes disproportionate.

Use a separate Orca user-data directory when testing alongside the installed
application. Shared agent hooks are user-wide even when Orca profiles differ;
turn off automatic hook reconciliation in a preview profile before starting it
against a real home directory. Agent-launched app tests must set
`ORCA_BACKGROUND_LAUNCH=1` and keep windows hidden.

The fork has not replaced the installed application. Interactive TUI resume,
Core dispatch through the subscription transport, and remote-host application
acceptance remain outside the verified scope.
