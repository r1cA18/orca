cask "orca-personal" do
  version "1.4.247-personal.1"
  sha256 "a681880e6d0879ee31113477f3fe5481b68004da657a84c86bac28fb07760d6d"

  url "https://github.com/r1cA18/orca/releases/download/v#{version}/orca-macos-arm64.dmg"
  name "Orca Personal"
  desc "Personal Orca build with DSH session history"
  homepage "https://github.com/r1cA18/orca"

  auto_updates true
  depends_on arch: :arm64
  conflicts_with cask: ["orca", "orca@rc"]

  app "Orca.app"
  binary "#{appdir}/Orca.app/Contents/Resources/bin/orca"
end
