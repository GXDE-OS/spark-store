# 侧边栏入口配置 (Sidebar Config)

星火应用商店支持通过服务器上的 JSON 文件动态配置左侧侧边栏的入口项。

## 配置文件位置

将 `sidebar-config.json` 放置在服务器应用仓库的架构目录下：

```
# Spark 仓库
{baseUrl}/{arch}-store/sidebar-config.json

# APM 仓库  
{baseUrl}/{arch}-apm/sidebar-config.json
```

例如：
- `https://example.com/amd64-store/sidebar-config.json`
- `https://example.com/arm64-store/sidebar-config.json`

## JSON 格式

每个入口项为一个对象，包含以下字段：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | ✅ | 唯一标识符，对应分类名或自定义 ID |
| `name` | string | ✅ | 侧边栏显示的入口名称 |
| `icon` | string | ❌ | FontAwesome 图标类名，如 `fas fa-gamepad` |
| `type` | string | ❌ | 入口类型：`category`（分类筛选）、`search`（搜索关键词）、`link`（外部链接）。默认为 `category` |
| `value` | string | ❌ | 与 `type` 配合使用的值。`category` 类型为分类名，`search` 类型为搜索关键词。默认为 `id` 的值 |

## 示例配置

```json
[
  {
    "id": "games",
    "name": "游戏专区",
    "icon": "fas fa-gamepad",
    "type": "category",
    "value": "games"
  },
  {
    "id": "devtools",
    "name": "开发工具",
    "icon": "fas fa-code",
    "type": "category",
    "value": "development"
  },
  {
    "id": "office",
    "name": "办公学习",
    "icon": "fas fa-book",
    "type": "category",
    "value": "office"
  },
  {
    "id": "ai-search",
    "name": "AI 应用",
    "icon": "fas fa-robot",
    "type": "search",
    "value": "AI"
  }
]
```

## 入口类型说明

### `category` 类型
点击后在"全部应用"页面按指定分类筛选应用。`value` 字段对应 `categories.json` 中的分类键名。

### `search` 类型
点击后自动使用 `value` 字段的值进行搜索。适用于快速入口，如"AI 应用"、"微信"等热门关键词。

### `link` 类型（预留）
用于跳转到外部链接或内部页面。后续版本支持。

## 注意事项

- 如果两个仓库（Spark 和 APM）都存在 `sidebar-config.json`，相同的 `id` 会自动去重合并
- 配置文件不存在时，侧边栏不会显示额外的入口项，不影响正常使用
- 入口项显示在"首页推荐"和"全部应用"之间，以分隔线区分
- 每个入口项会显示对应分类或搜索下的应用数量
