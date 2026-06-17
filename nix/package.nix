{
  lib,
  buildNpmPackage,
  importNpmLock,
  electron,
  makeWrapper,
  aria2,
  apm,
  coreutils,
  gnugrep,
  which,
  xdg-utils,
  bash,
}:

buildNpmPackage rec {
  pname = "spark-store";
  version = "5.1.1";

  src = lib.cleanSourceWith {
    src = ../.;
    filter =
      path: type:
      let
        baseName = baseNameOf path;
      in
      !(lib.elem baseName [
        ".git"
        "dist"
        "dist-electron"
        "node_modules"
        "release"
        "result"
      ]);
  };

  npmDeps = importNpmLock {
    npmRoot = ../.;
  };
  npmConfigHook = importNpmLock.npmConfigHook;

  nativeBuildInputs = [
    makeWrapper
  ];

  env = {
    ELECTRON_SKIP_BINARY_DOWNLOAD = "1";
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
  };

  buildPhase = ''
    runHook preBuild

    npm run build:vite

    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall

    appDir="$out/share/spark-store"

    npm prune --omit=dev --ignore-scripts

    substituteInPlace extras/shell-caller.sh \
      --replace-fail "/usr/bin/apm" "${lib.getExe' apm "apm"}"

    mkdir -p "$appDir" "$out/bin"
    cp -r dist dist-electron package.json node_modules extras icons "$appDir"/

    chmod -R u+w "$appDir"
    find "$appDir/extras" -type f -exec chmod +x {} \;

    substituteInPlace "$appDir/dist-electron/main/index.js" \
      --replace-fail "/opt/spark-store/extras/shell-caller.sh" "$appDir/extras/shell-caller.sh" \
      --replace-fail "/opt/spark-store/extras/app-launcher" "$appDir/extras/app-launcher"

    install -Dm644 pkg/usr/share/applications/spark-store.desktop \
      "$out/share/applications/spark-store.desktop"

    install -Dm644 icons/spark-store.svg \
      "$out/share/icons/hicolor/scalable/apps/spark-store.svg"

    install -Dm644 icons/spark-store.png \
      "$out/share/icons/hicolor/512x512/apps/spark-store.png"

    install -Dm644 extras/store.spark-app.spark-store.policy \
      "$out/share/polkit-1/actions/store.spark-app.spark-store.policy"

    substituteInPlace "$out/share/polkit-1/actions/store.spark-app.spark-store.policy" \
      --replace-fail "/opt/spark-store/extras/shell-caller.sh" "$appDir/extras/shell-caller.sh"

    cat > "$out/bin/spark-store" <<EOF
#!${bash}/bin/bash
export PATH="${lib.makeBinPath [
  aria2
  coreutils
  gnugrep
  which
  xdg-utils
]}:\$PATH"

electron_args=(--no-sandbox)
app_args=()

root_path="\$(${coreutils}/bin/readlink -f /proc/self/root)"
if [ "\$root_path" != "/" ]; then
  app_args+=(--no-apm)
fi

if [ "\''${IS_ACE_ENV:-}" = "1" ]; then
  app_args+=(--no-apm)
fi

if ! command -v apt >/dev/null 2>&1; then
  app_args+=(--no-spark)
fi

if [ -r /etc/os-release ] && ${gnugrep}/bin/grep -q "ID=aosc" /etc/os-release; then
  app_args+=(--no-spark)
fi

exec ${electron}/bin/electron "\''${electron_args[@]}" "$appDir" "\''${app_args[@]}" "\$@"
EOF
    chmod +x "$out/bin/spark-store"

    patchShebangs "$appDir/extras"

    runHook postInstall
  '';

  postFixup = ''
    appDir="$out/share/spark-store"

    wrapProgram "$appDir/extras/shell-caller.sh" \
      --prefix PATH : ${
        lib.makeBinPath [
          aria2
          bash
          coreutils
          which
          xdg-utils
        ]
      }

    substituteInPlace "$appDir/extras/.shell-caller.sh-wrapped" \
      --replace-fail "#!/bin/bash" "#!${bash}/bin/bash"
  '';

  meta = {
    description = "Client for Spark App Store";
    homepage = "https://spark-app.store";
    license = lib.licenses.gpl3Only;
    mainProgram = "spark-store";
    platforms = lib.platforms.linux;
  };
}
