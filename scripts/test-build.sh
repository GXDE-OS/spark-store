#!/usr/bin/env bash
#
# 测试打包脚本
#
# 用途：本地测试打包时，自动将 deb 版本号（位于 debian/changelog 顶部）的
#       最后一段数字 +1，并追加 "-test" 标签，随后执行 dpkg-buildpackage。
#
# 示例：
#   当前 debian/changelog 顶部版本为 5.2.1.0
#   运行一次 -> 5.2.1.1-test（产物 spark-store_5.2.1.1-test_amd64.deb）
#   再运行一次 -> 5.2.1.2-test
#
# 注意：
#   - 此脚本仅用于本地测试，不会修改 package.json（其 version 为 semver 格式，
#     而 deb 测试版本如 5.3.0.8-test 会被 electron-builder 拒绝）。
#   - 为保证打包后「关于」页面显示版本与 deb 版本一致，脚本会临时向
#     electron-builder.yml 追加 extraMetadata.version（electron-builder 会将其写入
#     app.asar 内的 package.json，Electron 的 app.getVersion() 即从中读取），
#     打包完成后自动恢复，异常退出时由 trap 兜底恢复。
#   - 每次运行都会改写 debian/changelog，属于未跟踪的工作区改动，按需自行还原。
#   - 如需恢复正式版本，将 debian/changelog 顶部版本改回即可。

set -euo pipefail

# 定位仓库根目录（脚本位于 scripts/ 下）
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CHANGELOG="debian/changelog"

if [ ! -f "$CHANGELOG" ]; then
  echo "错误：未找到 $CHANGELOG" >&2
  exit 1
fi

# 读取 changelog 首行并解析版本号，形如：
#   spark-store (5.2.1.0) UNRELEASED; urgency=medium
#   spark-store (5.2.1.1-test) UNRELEASED; urgency=medium
top_line="$(head -n1 "$CHANGELOG")"
# 提取括号内的版本号，避免使用 [[ =~ ]] 处理字面括号引发的语法问题
old_ver="$(printf '%s' "$top_line" | sed -E 's/^[^ ]+ \(([^)]+)\).*/\1/')"
if [[ -z "$old_ver" || "$old_ver" == "$top_line" ]]; then
  echo "错误：无法从 $CHANGELOG 首行解析版本号: $top_line" >&2
  exit 1
fi

# 分离上游版本与 Debian 修订号：
#   Debian 版本格式为 "上游版本-修订号"，修订号以最后一个 '-' 分隔。
#   上游版本只允许点号（如 5.2.1.0），'-test' 这类标签属于修订号，每次测试覆盖为固定 "test"。
if [[ "$old_ver" == *-* ]]; then
  upstream="${old_ver%-*}"
else
  upstream="$old_ver"
fi

# 上游版本形如 X.Y.Z.W，将最后一个点号分隔的数字段 +1
if [[ "$upstream" =~ ^(.*)\.([0-9]+)$ ]]; then
  prefix="${BASH_REMATCH[1]}"
  last="${BASH_REMATCH[2]}"
  # 10# 强制按十进制解析，避免以 0 开头的段被当作八进制
  new_last=$((10#$last + 1))
  new_upstream="${prefix}.${new_last}"
else
  echo "错误：上游版本号不符合 X.Y.Z.W 格式: $upstream" >&2
  exit 1
fi

new_ver="${new_upstream}-test"

echo "版本号: ${old_ver} -> ${new_ver}"

# 仅替换首行括号内的版本号（转义点号，避免被正则当作任意字符）
old_ver_esc="${old_ver//./\\.}"
sed -i -E "1s/\\(${old_ver_esc}\\)/(${new_ver})/" "$CHANGELOG"

# Electron 二进制下载镜像（本机到 GitHub 不通，使用 npmmirror 镜像）
export ELECTRON_MIRROR="${ELECTRON_MIRROR:-https://registry.npmmirror.com/-/binary/electron/}"

# 同步应用内版本号：临时向 electron-builder.yml 追加 extraMetadata.version。
# electron-builder 会把它合并进 app.asar 内的 package.json，
# 「关于」页面经 IPC 调用的 app.getVersion() 即读取该值。
EB_YML="electron-builder.yml"
EB_YML_BAK="${EB_YML}.bak-test-build"

# 清理上次异常中断可能残留的 extraMetadata 块（追加内容始终位于文件末尾）
if grep -q "^extraMetadata:" "$EB_YML"; then
  echo "清理 $EB_YML 中残留的 extraMetadata 块"
  sed -i '/^extraMetadata:/,$d' "$EB_YML"
fi
cp "$EB_YML" "$EB_YML_BAK"
restore_eb_yml() {
  mv -f "$EB_YML_BAK" "$EB_YML" 2>/dev/null || true
}
trap restore_eb_yml EXIT
printf 'extraMetadata:\n  version: "%s"\n' "$new_ver" >> "$EB_YML"

# 清理旧的 electron-builder 产物，避免 release/ 下多个版本目录被 make install
# 的 release/*/linux*-unpacked/* 通配一并拷入 deb，造成内容污染
rm -rf release/

echo "开始测试打包（版本 ${new_ver}）..."
dpkg-buildpackage -us -uc -b

# 打包成功，立即恢复 electron-builder.yml 并解除 trap
restore_eb_yml
trap - EXIT

echo "完成。产物: ../spark-store_${new_ver}_amd64.deb"
