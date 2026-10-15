# PRD：消息转发（Message Forwarding）

> **项目**: MacroHard Teams  
> **版本**: v1.0  
> **作者**: Pride（PM）  
> **日期**: 2026-06-17  
> **优先级**: 🟢 高  
> **预估复杂度**: 高（涉及新消息类型 + 目标选择器 + 跨模型操作）

---

## 1. 功能概述

在现有消息系统基础上（`Message` 模型支持 text/image/file、`ChannelMessage` 模型支持团队频道消息），增加消息转发能力。用户可以将单条或多条消息转发到其他 1对1 对话、群聊或团队频道，转发的消息带有来源标识，保留原始附件。

### 1.1 项目现有架构映射

| 层级 | 现有文件 | 消息转发改动范围 |
|------|---------|----------------|
| 消息模型 | `models/Message.ts` | 新增 `forward` 类型 + `forwardedFrom` 字段 |
| 频道消息模型 | `models/ChannelMessage.ts` | 同上 |
| 聊天 UI | `components/ChatArea.tsx` | 右键菜单新增"转发"、多选模式、转发对话框 |
| 频道聊天 | `components/ChannelChat.tsx` | 同上 |
| Socket 服务 | `server/src/socket.ts` | 新增 `forward_message` 事件处理 |
| REST API | `server/src/routes/` | 新增转发 API |
| 新组件 | — | `ForwardDialog.tsx`（目标选择器） |

---

## 2. 用户故事（User Stories）

### US-FW-01：单条消息转发
> **作为**聊天用户，**我想要**右键点击一条消息并选择"转发"，**以便**将这条消息发送到另一个对话或频道。

### US-FW-02：多条消息合并转发
> **作为**聊天用户，**我想要**选择多条消息并合并转发，**以便**将一段对话完整地分享给其他人。

### US-FW-03：选择转发目标
> **作为**转发操作的执行者，**我想要**在弹窗中搜索并选择目标对话/频道，**以便**快速找到我要转发到的位置。

### US-FW-04：识别转发消息
> **作为**消息接收者，**我想要**看到转发消息的来源标识（"[转发] 来自 XXX"），**以便**知道这条消息是转发的、原始发送者是谁。

### US-FW-05：合并转发消息展示
> **作为**消息接收者，**我想要**看到合并转发的消息以可折叠的"聊天记录"形式呈现，**以便**浏览多条转发内容。

### US-FW-06：转发保留附件
> **作为**消息转发者，**我想要**转发的消息保留原始图片和文件附件，**以便**接收者不丢失任何信息。

### US-FW-07：转发到团队频道
> **作为**团队成员，**我想要**将私聊消息转发到团队频道，**以便**与更多同事分享信息。

---

## 3. 详细交互流程

### 3.1 正常流程：单条消息转发

```
用户                                         系统
 │                                            │
 ├─ 右键点击消息 → 上下文菜单出现              │
 ├─ 点击 "➡️ 转发"                            │
 │                                            ├─ 弹出 ForwardDialog
 │                                            ├─ 加载: 最近对话 + 群聊 + 团队频道列表
 ├─ 在搜索框输入关键词过滤                     │
 │                                            ├─ 实时过滤匹配的对话/频道
 ├─ 点击选择一个目标                           │
 ├─ 点击 [转发] 确认按钮                       │
 │                                            ├─ 发送转发请求到后端
 │                                            ├─ 后端创建新消息(type='forward')
 │                                            ├─ 目标对话/频道收到转发消息
 │                                            ├─ 关闭 ForwardDialog
 │                                            ├─ toast: "消息已转发"
 │                                            │
```

### 3.2 正常流程：多条消息合并转发

```
用户                                         系统
 │                                            │
 ├─ 右键点击某消息 → 点击 "☑️ 多选"            │
 │                                            ├─ 进入多选模式
 │                                            ├─ 每条消息左侧出现 checkbox
 │                                            ├─ 底部出现操作栏: [合并转发(N)] [取消]
 ├─ 勾选多条消息（最多 30 条）                 │
 │                                            ├─ 操作栏实时更新已选数量
 ├─ 点击 [合并转发(N)]                         │
 │                                            ├─ 弹出 ForwardDialog（同上）
 ├─ 选择目标 → 点击 [转发]                     │
 │                                            ├─ 后端创建合并转发消息(type='merged_forward')
 │                                            ├─ 目标收到一条包含多条原始消息的聊天记录
 │                                            ├─ 退出多选模式
 │                                            ├─ toast: "已合并转发 N 条消息"
 │                                            │
```

### 3.3 跨模型转发：Conversation → Channel（及反向）

| 来源 | 目标 | 处理 |
|------|------|------|
| Conversation 消息 → Conversation | 在目标 Conversation 创建 Message 记录 |
| Conversation 消息 → Team Channel | 在目标 Channel 创建 ChannelMessage 记录 |
| Channel 消息 → Conversation | 在目标 Conversation 创建 Message 记录 |
| Channel 消息 → Channel | 在目标 Channel 创建 ChannelMessage 记录 |

### 3.4 异常/边界情况

| 场景 | 处理方式 |
|------|---------|
| **转发已撤回的消息** | 不允许。已撤回消息（isDeleted=true）的右键菜单不显示"转发"选项 |
| **转发到自己的当前对话** | 允许，但提示确认"确定转发到当前对话？" |
| **多选超过 30 条** | 达到 30 条后 checkbox 禁用，提示"最多选择 30 条消息" |
| **多选 0 条点击转发** | 按钮禁用态 |
| **转发的消息被再次转发** | 允许。保留最近一层的 forwardedFrom 信息 |
| **转发包含 @mention 的消息** | 转发后 @ 不生效（纯文本展示），避免在目标对话中意外通知不相关的人 |
| **网络错误** | toast "转发失败，请重试" |
| **对话列表为空**（极端新用户） | ForwardDialog 显示"暂无可转发的对话"提示 |
| **转发 bot 消息** | 允许。来源标识显示 bot 名称 |

---

## 4. 前端需求

### 4.1 新组件：`components/ForwardDialog.tsx`

**用途**：转发目标选择弹窗

**UI 结构**：
```
┌──────────────────────────────────┐
│ ➡️ 转发消息                   ✕ │
├──────────────────────────────────┤
│ 🔍 搜索对话或频道...            │
├──────────────────────────────────┤
│ 最近对话                        │
│  👤 张三                        │
│  👥 项目讨论群                   │
│  👤 李四                        │
├──────────────────────────────────┤
│ 团队频道                        │
│  📢 前端团队 / 常规              │
│  📢 后端团队 / 技术讨论          │
├──────────────────────────────────┤
│             [ 取消 ] [ 转发 ]    │
└──────────────────────────────────┘
```

**Props 接口**：
```typescript
interface ForwardDialogProps {
  open: boolean;
  onClose: () => void;
  messages: ForwardPayload[];  // 要转发的消息（单条或多条）
  mode: 'single' | 'merged';
  currentUserId: string;
}

interface ForwardPayload {
  messageId: string;
  content: string;
  type: 'text' | 'image' | 'file';
  senderName: string;
  senderId: string;
  timestamp: string;
  fileInfo?: { filename: string; size: number; mimeType: string };
  sourceType: 'conversation' | 'channel';
  sourceId: string;  // conversationId 或 channelId
}
```

**功能要求**：
- 调用 API 获取用户的 Conversation 列表 + 已加入 Team 的 Channel 列表
- 搜索框实时过滤（按对话名称/用户名/频道名匹配）
- 点击选中目标（单选，高亮选中项）
- 确认后调用转发 API
- 加载中显示 spinner，成功后自动关闭

### 4.2 `components/ChatArea.tsx` — 扩展

#### 4.2.1 右键菜单新增选项

在现有的 `contextMenu` 逻辑中（已有"回复"、"编辑"、"撤回"），新增：

```typescript
// 非已撤回消息才显示转发选项
{ !contextMenu.msg.isDeleted && (
  <>
    <div onClick={() => handleForward(contextMenu.msg)}>➡️ 转发</div>
    <div onClick={() => enterMultiSelect(contextMenu.msg)}>☑️ 多选</div>
  </>
)}
```

#### 4.2.2 多选模式

**新增状态**：
```typescript
const [multiSelectMode, setMultiSelectMode] = useState(false);
const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
```

**多选模式 UI**：
- 每条消息左侧出现 checkbox
- 底部固定操作栏：
  ```
  ┌─────────────────────────────────────────┐
  │ 已选 3 条  [合并转发]  [单条逐一转发]  [取消] │
  └─────────────────────────────────────────┘
  ```
- 合并转发上限 30 条
- 取消退出多选模式

#### 4.2.3 ForwardDialog 集成

```typescript
const [forwardDialog, setForwardDialog] = useState<{
  open: boolean;
  messages: ForwardPayload[];
  mode: 'single' | 'merged';
} | null>(null);
```

### 4.3 `components/ChannelChat.tsx` — 同步扩展

与 ChatArea.tsx 相同的转发逻辑需在频道聊天组件中同步实现（右键菜单 + 多选 + ForwardDialog）。

### 4.4 转发消息的渲染

#### 4.4.1 单条转发消息渲染

```
┌─────────────────────────────────┐
│ ➡️ [转发] 来自 张三              │
│ ─────────────────────────────── │
│ 这是原始消息内容...              │
│ （如有图片/文件，正常渲染）       │
└─────────────────────────────────┘
```

- 顶部灰色来源标签：`➡️ [转发] 来自 {原始发送者名称}`
- 左侧竖线装饰（类似引用样式），颜色 `#6264a7`
- 消息内容正常渲染（文本走 Markdown、图片可点击放大、文件显示下载卡片）

#### 4.4.2 合并转发消息渲染

```
┌─────────────────────────────────┐
│ 📋 [合并转发] 3 条消息            │
│ ┌─────────────────────────────┐ │
│ │ 张三: 你好                   │ │
│ │ 李四: 收到了                 │ │
│ │ 张三: 那我们开始吧            │ │
│ └─────────────────────────────┘ │
│         ▼ 查看全部               │
└─────────────────────────────────┘
```

- 顶部标签：`📋 [合并转发] N 条消息`
- 预览前 3 条（摘要形式：`发送者: 内容前30字...`）
- 点击"查看全部"展开所有消息（或弹出全屏查看弹窗）
- 展开后每条消息正常渲染（含图片/文件）

---

## 5. 后端需求

### 5.1 数据模型变更

#### 5.1.1 `models/Message.ts` — 扩展

```typescript
// type 枚举新增
type: 'text' | 'image' | 'file' | 'forward' | 'merged_forward'

// 新增字段
forwardedFrom?: {
  originalSender: mongoose.Types.ObjectId;  // 原始发送者
  originalSenderName: string;               // 冗余存名字避免每次 populate
  originalTimestamp: Date;                   // 原始发送时间
  sourceType: 'conversation' | 'channel';   // 来源类型
  sourceId: mongoose.Types.ObjectId;         // 来源 ID
};

// 合并转发专用
mergedMessages?: {
  originalSender: mongoose.Types.ObjectId;
  originalSenderName: string;
  content: string;
  type: 'text' | 'image' | 'file';
  timestamp: Date;
  fileInfo?: { filename: string; size: number; mimeType: string };
}[];
```

**Schema 追加**：
```typescript
forwardedFrom: {
  type: {
    originalSender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    originalSenderName: String,
    originalTimestamp: Date,
    sourceType: { type: String, enum: ['conversation', 'channel'] },
    sourceId: mongoose.Schema.Types.ObjectId,
  },
  default: null,
},
mergedMessages: {
  type: [{
    originalSender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    originalSenderName: String,
    content: String,
    type: { type: String, enum: ['text', 'image', 'file'] },
    timestamp: Date,
    fileInfo: {
      type: { filename: String, size: Number, mimeType: String },
      default: null,
    },
  }],
  default: null,
},
```

#### 5.1.2 `models/ChannelMessage.ts` — 同步扩展

与 Message.ts 相同的字段扩展（`type` 枚举 + `forwardedFrom` + `mergedMessages`）。

### 5.2 REST API 接口

#### 5.2.1 `POST /api/messages/forward` — 单条转发

**Request Body**：
```json
{
  "messageId": "原始消息 ID",
  "sourceType": "conversation | channel",
  "targetType": "conversation | channel",
  "targetId": "目标 conversation/channel ID"
}
```

**处理逻辑**：
1. 验证用户身份 & 权限（是否是源消息所在对话的参与者 + 目标对话的参与者）
2. 查询原始消息
3. 校验消息未被撤回（isDeleted !== true）
4. 根据 targetType 创建 Message 或 ChannelMessage：
   - `type: 'forward'`
   - `content: 原始消息的 content`
   - `forwardedFrom: { originalSender, originalSenderName, originalTimestamp, sourceType, sourceId }`
   - 如果原消息有 `fileInfo`，复制 `fileInfo`（文件 URL 不变，复用同一份上传）
5. 通过 Socket.IO 推送到目标对话/频道
6. 更新目标 Conversation 的 lastMessage

**Response**：
```json
{
  "success": true,
  "message": { /* 新创建的转发消息 */ }
}
```

#### 5.2.2 `POST /api/messages/forward/merge` — 合并转发

**Request Body**：
```json
{
  "messageIds": ["消息ID1", "消息ID2", "..."],
  "sourceType": "conversation | channel",
  "targetType": "conversation | channel",
  "targetId": "目标 ID"
}
```

**处理逻辑**：
1. 验证权限（同上）
2. 批量查询原始消息（按时间排序）
3. 校验：所有消息来自同一对话/频道，且均未撤回
4. 数量校验：1 ≤ messageIds.length ≤ 30
5. 创建新消息：
   - `type: 'merged_forward'`
   - `content: "[合并转发] N 条消息"`
   - `mergedMessages: [{ originalSender, originalSenderName, content, type, timestamp, fileInfo }]`
6. Socket 推送 + 更新 lastMessage

**Response**：
```json
{
  "success": true,
  "message": { /* 新创建的合并转发消息 */ }
}
```

#### 5.2.3 `GET /api/forward/targets` — 获取可转发目标列表

**Query Params**：`?search=关键词`（可选）

**Response**：
```json
{
  "conversations": [
    { "id": "...", "name": "张三", "isGroup": false, "avatar": "..." },
    { "id": "...", "name": "项目讨论群", "isGroup": true, "avatar": "..." }
  ],
  "channels": [
    { "id": "...", "name": "常规", "teamName": "前端团队", "teamId": "..." }
  ]
}
```

**处理逻辑**：
1. 查询用户参与的所有 Conversation（populate 参与者以获取名称/头像）
2. 查询用户所属的所有 Team → 获取其下的 Channel
3. 如有 search 参数，过滤匹配项
4. 按最近活跃排序

### 5.3 Socket.IO 事件（`server/src/socket.ts`）

| 事件名 | 方向 | 说明 |
|--------|------|------|
| `forward_message` | Client → Server | 客户端通知服务器转发完成（可选，如果用 REST 做主逻辑则 Socket 只负责推送） |
| `receive_message` | Server → Client | 复用现有事件推送转发消息到目标对话 |
| `receive_channel_message` | Server → Client | 复用现有事件推送转发消息到目标频道 |

**注意**：转发的主逻辑通过 REST API 完成，Socket 只负责实时推送。这样更易于做权限校验和错误处理。

### 5.4 路由文件

新建 `server/src/routes/forward.ts`（或在现有 `message` 路由中追加）：

```typescript
router.post('/forward', authMiddleware, forwardMessageHandler);
router.post('/forward/merge', authMiddleware, mergedForwardHandler);
router.get('/forward/targets', authMiddleware, getForwardTargets);
```

---

## 6. 验收标准（Acceptance Criteria）

### AC-FW-01：右键菜单入口
- [ ] 右键消息出现"转发"和"多选"选项
- [ ] 已撤回的消息不显示"转发"和"多选"
- [ ] 点击"转发"弹出 ForwardDialog

### AC-FW-02：ForwardDialog 功能
- [ ] 弹窗列出用户的所有对话（1对1 + 群聊）和已加入的团队频道
- [ ] 搜索框可按名称实时过滤
- [ ] 点击选中目标后高亮显示
- [ ] 未选择目标时"转发"按钮禁用
- [ ] 加载中显示 loading 状态

### AC-FW-03：单条转发
- [ ] 选择目标后点击"转发"，目标对话/频道收到转发消息
- [ ] 转发消息显示 `[转发] 来自 {原始发送者名称}`
- [ ] 转发的文本消息内容完整保留
- [ ] 转发的图片消息保留图片（可查看/放大）
- [ ] 转发的文件消息保留文件信息（可下载）
- [ ] 成功后 toast 提示"消息已转发"

### AC-FW-04：多选模式
- [ ] 点击"多选"进入多选模式，消息左侧显示 checkbox
- [ ] 可勾选多条消息，底部栏显示已选数量
- [ ] 最多选择 30 条，超出后 checkbox 禁用
- [ ] 点击"取消"退出多选模式

### AC-FW-05：合并转发
- [ ] 多选后点击"合并转发"，弹出 ForwardDialog
- [ ] 目标收到一条合并转发消息，显示 `[合并转发] N 条消息`
- [ ] 合并消息预览前 3 条摘要
- [ ] 点击"查看全部"可展开完整内容
- [ ] 展开后每条消息正常渲染（含图片/文件）

### AC-FW-06：跨类型转发
- [ ] 可以从 Conversation 转发到 Team Channel
- [ ] 可以从 Team Channel 转发到 Conversation
- [ ] 可以从 Conversation 转发到另一个 Conversation
- [ ] 可以从 Channel 转发到另一个 Channel

### AC-FW-07：权限校验
- [ ] 只能转发到自己参与的对话或已加入团队的频道
- [ ] 不能转发已撤回的消息
- [ ] 后端校验来源消息权限（是否有权查看）

### AC-FW-08：边界情况
- [ ] 转发到当前对话弹出确认提示
- [ ] 网络错误时显示"转发失败，请重试"
- [ ] 转发包含 @ 的消息不触发通知
- [ ] 转发的消息可以被再次转发

### AC-FW-09：ChannelChat 同步
- [ ] 团队频道的消息也支持右键转发和多选
- [ ] 功能与 ChatArea 一致

---

## 附录：技术要点提醒

1. **文件不重复上传**：转发消息复用原消息的 `content`（图片/文件 URL），不需要重新上传。`fileInfo` 直接复制。
2. **两套消息模型**：项目有 `Message`（Conversation 用）和 `ChannelMessage`（Channel 用），转发跨这两个模型时需要在正确的模型中创建记录。
3. **性能注意**：合并转发限制 30 条，避免单条消息体积过大。`mergedMessages` 数组内嵌在一条消息中，30 条是安全上限。
4. **搜索去抖**：ForwardDialog 的搜索输入建议 300ms debounce，避免频繁调用后端。
5. **排序**：ForwardDialog 列表按 `updatedAt` 降序排列（最近活跃的对话在前），提高选择效率。
