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

The fork has not replaced the installed application. Local History and interactive
TUI resume passed isolated acceptance. Core subscription dispatch and remote-host
application acceptance remain outside the verified scope.

## Upstream maintenance

Track published stable releases, not every upstream main-branch commit. Keep the
upstream source and the small integration delta distinct. The initial fork was
based on upstream main, which can diverge from a stable release. Merging both
histories can reintroduce upstream-only changes and conflicts. Reapply only the
committed delta from `config/fork-upstream-base` onto the selected release instead.

Run `node config/scripts/fork-update-preflight.mjs <fetched-release-ref>` to
compute that candidate tree without changing HEAD, the index or working files.
This requires Git with `merge-tree --write-tree --merge-base` support and enough
fetched history to establish a common ancestor. Uncommitted changes are excluded.
The command never downloads, executes candidate code, publishes or installs an app.

The JSON report records the exact fork/base/upstream commits and distinguishes:

- `up-to-date`: the upstream release is already included; no downgrade proposal.
- `ready-for-validation`: the delta applies and the coarse review guards pass;
  dependency installation, tests, builds and application acceptance are still required.
- `review-required`: more than 200 files or 15,000 changed lines, or changes in
  the recorded profile-state, signing, packaging or updater paths. These are
  conservative triage limits, not a compatibility guarantee.
- `conflict`: the custom delta cannot be reapplied automatically; no candidate
  tree is offered for promotion.
- `error`: ancestry, refs or the Git operation could not be verified.

`.github/workflows/fork-upstream-check.yml` runs the same check daily or manually
with read-only repository permissions and retains a report. A review/conflict
result fails the check. This is preflight only: it does not merge, release or
replace the installed app. The workflow must be on the repository's default
branch and enabled before its schedule runs. Do not enable all inherited
upstream release workflows; they assume upstream-owned credentials and services.

The remaining pipeline is: preflight -> candidate dependency/test/build checks ->
isolated DSH History/resume acceptance -> signed personal release -> app update.
Pin the new upstream base only after validation and acceptance of that candidate.
Retain the previous accepted build and its compatible stopped-profile backup.
A binary rollback alone is not a database migration rollback.

Before production cutover, configure the personal release feed throughout the
updater, establish a stable signing identity, and choose one installation owner.
The upstream Homebrew cask or updater must not overwrite the personal build.
Migrate once with Orca stopped using its supported profile-state backup/recovery
path. Verify settings, workspaces, account homes and resume after that migration.
Do not promise preserved Keychain/TCC grants across a change of signing identity.
The installed upstream app remains in use until these gates are complete.

## Personal macOS release

The current integration branch is `feature/personal-stable`, based on `v1.4.247`.
`src/shared/app-distribution.json` controls application update and publishing
repository ownership. Upstream policy-data feeds keep their upstream source.
Personal stable/RC/dev selections all stay within the personal repository.

On macOS, `node config/scripts/personal-mac-release.mjs setup` opens the Apple
Account page and a local dialog to register a notarization Keychain profile.
Generate an app-specific password in Apple's Sign-In and Security settings;
this is separate from the normal Apple Account password. The helper selects the
matching Developer ID team and does not export the signing private key.

After validation, build locally with
`node config/scripts/personal-mac-release.mjs build 1.4.247-personal.1`.
Revisions must be positive and tied to the checkout's package version. Keep
release tags immutable. This command does not publish or install anything.
It reuses the normal macOS release build, signs/notarizes using Keychain, and
keeps the updater manifest channel named `latest`.

Credentials remain local. A hosted build runner would need separate explicit
credential provisioning; the repository does not export keys to GitHub.
See [Apple's app-specific password instructions](https://support.apple.com/102654)
and [notarization workflow](https://developer.apple.com/documentation/security/customizing-the-notarization-workflow).

The personal build requires the complete orcad deployment template. Install the
root and `mobile` dependencies from their frozen lockfiles and build desktop
assets first. For the initial stable base, native slots come from the successful
upstream v1.4.247 release run `41569939151`. Its macOS release run
`41571626758` identifies that parent explicitly. Native slot manifests and file
hashes are checked by `merge-orcad-prebuilds.mjs`; Windows process-tree, CLI
launcher and security artifacts are staged in their normal `.build` directories.
`build-orcad-template.mjs` then builds the server JavaScript from this fork and
validates the complete target matrix. These upstream native inputs are not a
replacement for the fork's server code or remote-host acceptance.

The certificate selector accepts either the full Keychain identity or its
name/team suffix. It passes the suffix to electron-builder, which rejects the
`Developer ID Application:` prefix. The initial real packaging attempt exposed
that contract; it was corrected without changing certificate selection or
weakening signature verification.
