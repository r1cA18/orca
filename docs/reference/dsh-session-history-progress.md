# DSH session history

## Objective and scope

Make DSH v4 conversation records discoverable and searchable as DSH, independently
of the provider/model inside the runtime. Implementation lives on
`feature/dsh-session-history`, based on upstream commit
`18f674e69ff6708b634f53d668582d3943acb74d`.

The reader decodes concatenated Zstandard frames, rejects corrupt or incomplete
sequences, excludes runtime-context injections from user messages, and feeds
user/assistant/tool messages into the existing transcript consumer. It supports
custom `DSH_HOME` discovery and preserves that home in resume commands.

## Verification

- The targeted suite passed 43 tests across eight files, including real saved
  transcripts supplied through a private opt-in fixture manifest.
- Four saved subscription conversations passed reader/search checks; two came
  through the custom runtime launcher.
- The full Node TypeScript project check and CLI TypeScript build passed.
- Main, preload and renderer production builds passed. The main bundle was
  rebuilt after the custom-home fix.
- Isolated and normal-profile hidden Electron app checks read the saved records
  through `window.api.aiVault.listSessions`, matching all four session IDs and
  exact assistant replies with zero scan issues.
- The normal-profile check used the actual custom DSH home and kept shared hook
  files unchanged. This was application IPC acceptance, not a visual UI audit.

The default-home app check initially missed a process boundary: the scanner child
filtered out `DSH_HOME`. Desktop and execution-host relay allowlists now preserve
it, with Windows case-folding and spawn regression coverage. Those assertions
failed before the fix and passed afterward.

The truncated-frame regression uses the existing Node test pool because Bun
accepts a malformed tail that the production Node/Electron decoder rejects.
Assertions were not weakened to accommodate the test runtime.

## Limits and rollout

- Stock Orca has not been replaced. Use a separate-profile build of this branch.
- Raw compressed files are not opened as text through the Open Log action.
- Interactive TUI resume and remote-host app acceptance remain unverified.
- Core dispatch through the new subscription transport is outside this change.
- Credentials, local paths, account bindings and real transcripts stay outside
  the repository. Synthetic fixtures are committed; saved-record acceptance is
  opt-in through `ORCA_DSH_TRANSCRIPT_FIXTURES`.

## Personal fork publication

The personal fork is `r1cA18/orca`; upstream is `stablyai/orca`. The original
implementation and verification are preserved on `feature/dsh-session-history`.
The first pre-push quality gate flagged type assertions in the decoder and its
UTF-8 fixture. The decoder now checks the returned buffer and consumed byte
count at runtime, and the fixture no longer requires a cast. Run the final
changed checks against the pinned upstream base before publishing.
