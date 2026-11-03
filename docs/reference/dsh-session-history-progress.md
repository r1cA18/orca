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

## Upstream maintenance preparation

The owner requested minimal migration work and automatic upstream tracking, with
manual handling for conflicts and substantial changes. A separate
`feature/upstream-maintenance` branch now carries a non-mutating preflight and a
read-only scheduled workflow definition. The schedule is not enabled or deployed
to the default branch. Application replacement and update-feed changes are pending.

The latest stable release inspected was `v1.4.247`, commit
`97b9bb3613a333450a38057d745628323f3ad185`. A direct history merge produced three
conflicts in upstream permission handling unrelated to the DSH patch. Reapplying
only the committed fork delta from its recorded upstream base produced a clean
candidate tree. The base-to-release difference spans 3,102 files and 210,184
changed lines, including profile-state and updater changes, so preflight requires
review. This is not an accepted or built upgrade.

The production updater still points to upstream, and macOS release packaging
expects upstream's signing identity. Personal release feed, signing, one-time
profile migration, package ownership and an actual second-version update remain
necessary before unattended application updates can be claimed.

Preflight verification passed all eight temporary-repository tests: candidate
contents, preservation of dirty work, conflicts, sensitive-path review, large
changes, already-included releases, divergent upstream histories and invalid
bases/ancestry. The real stable release produced a review-required report with
zero patch conflicts. These checks do not validate the candidate application.
The owner selected signed personal releases as the distribution direction.

## Stable release and personal distribution

Reapplied the three personal commits onto upstream `v1.4.247` in
`feature/personal-stable`. The recorded upstream base now matches that release.
The previous feature branches remain available; the installed app is unchanged.

The stable checkout passed 63 DSH tests across eight files, including the four
saved subscription records. Main/preload/renderer and CLI builds passed, as did
the Node typecheck. A hidden isolated Electron application returned all four
records through History IPC with matching replies and zero scan issues.
The generated resume commands restored the Codex and Claude launcher records in
DSH TUI through node-pty; both exited zero after Ctrl+C without force or a prompt
submission. Earlier raw Python PTY trials did not shut down reliably and are not
the acceptance evidence.

A retained production backup was copied privately and opened by the new database
code. Schema version 3 was supported, all 32 profile documents validated, and
their payloads/hashes remained identical. This checks a backup copy; production
cutover still requires a fresh stopped-profile backup and post-launch checks.

Application update feeds, release selection and packaging now use the personal
repository declared in `src/shared/app-distribution.json`. Upstream agent-state
and WSL policy feeds remain upstream. The targeted feed/signing suite passed
165 tests before the additional channel-routing regression. Signed builds use
the selected Developer ID's team rather than upstream's team. The release
credential preflight accepts a local identity and a notarization Keychain profile.

`personal-mac-release.mjs setup` opens the Apple Account page and a local macOS
dialog. It sends the supplied app-specific password through a private PTY to
notarytool; it does not put the password in process arguments, logs or output.
The owner requested this UI after the initial terminal login returned HTTP 401.
The GUI transport and signing helper passed six focused tests. No authentication
values are stored in the repository.

The local build command takes an explicit upstream-based personal revision,
produces artifacts for the current Mac architecture, and disables publication.
The publisher and updater use `latest-mac.yml` even for personal prerelease
versions. Artifact signing/notarization, release publication, automatic scheduling
and production installation are still pending.

The notarization setup saved the local Keychain profile successfully. The final
changed gate passed 24 of 25 checks; related unit-test selection timed out after
three minutes. Explicit updater/distribution coverage passed 404 of 406 tests;
the two failures were in the unchanged WSL move driver, whose five tests all
passed in isolation. This is not a fully green combined run.

Real packaging uncovered the certificate-name prefix rejected by electron-builder.
The helper now strips that prefix after selecting the matching Developer ID and
requires a full server deployment template to avoid dropping remote provisioning.
The initial build also required installing the separate frozen mobile lockfile.
Native inputs for the server template were obtained from the successful upstream
v1.4.247 release run and validated through the existing slot/hash verifier.
The server JavaScript is built locally from the fork. Signing/notarization and
production migration remain pending until their actual checks complete.

Pre-publication review reproduced another edge case in three assertions: personal
revision tags were treated as RCs and rejected by the latest stable fallback,
which would make checks fail when the first personal build has no newer release.
The personal revision format is now treated as stable for selection and fallback,
without allowing ordinary RCs. GitHub publication must use a regular latest
release. No affected build has been published or installed.

Apple accepted the first complete arm64 app's notarization. Its packaging run
then attempted an unintended x64 target because the upstream configuration
explicitly lists both architectures. The helper now supplies architecture-specific
DMG and ZIP targets, verified through electron-builder's actual CLI parser. The
accepted artifact predates the personal-version correction and will not be
published; the corrected source needs a fresh signed build.

## Final package and monitoring

Payload commit `d92c43654` successfully produced the corrected Apple Silicon
DMG/ZIP and updater manifest for `1.4.247-personal.1`. Apple accepted the final
notarization. Stapler, deep/strict signature verification and Gatekeeper checks
passed; manifest sizes and SHA-512 values match both artifacts.

Hidden Playwright acceptance launched that signed package with a disposable
home/profile and read all four saved DSH sessions with matching replies and
zero issues. The app version matched and its window remained hidden. The test
uses a mock Keychain and does not verify migration of existing Keychain grants.
All nine server native target slots were validated; remote application acceptance
and an actual second-version application update remain unverified.

After explicit owner approval, the repository default branch changed to
`feature/personal-stable`. Actions was temporarily disabled while 73 inherited
workflows were individually disabled, then restored with only the personal
upstream preflight enabled. A regression check reproduced five unguarded updater
and release-routing paths; the review guard now includes them. The initial
hosted monitoring run is pending. No production app/profile has been replaced.
