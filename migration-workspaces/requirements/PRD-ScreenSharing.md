# PRD：屏幕共享（Screen Sharing）

> **项目**: MacroHard Teams  
> **版本**: v1.0  
> **作者**: Pride（PM）  
> **日期**: 2026-06-17  
> **优先级**: 🟢 高  
> **预估复杂度**: 中高（涉及 WebRTC 轨道管理 + UI 布局变化）

---

## 1. 功能概述

基于现有 WebRTC 1对1通话系统（`useWebRTC.ts` → `CallContext.tsx` → `CallUI.tsx` → `socket.ts`），扩展屏幕共享能力。用户在视频/语音通话中可一键共享自己的屏幕，对方以大画面展示共享内容、小画面（PiP）展示摄像头，实现远程协作、演示、问题排查等场景。

### 1.1 项目现有架构映射

| 层级 | 现有文件 | 屏幕共享改动范围 |
|------|---------|----------------|
| WebRTC Hook | `hooks/useWebRTC.ts` | 新增 `startScreenShare()` / `stopScreenShare()` / `screenStream` 状态 |
| 通话上下文 | `contexts/CallContext.tsx` | 暴露屏幕共享状态 & 方法、处理 Socket 事件 |
| 通话 UI | `components/CallUI.tsx` | 新增共享按钮、大/小画面布局切换、共享状态指示 |
| 信令服务 | `server/src/socket.ts` | 新增 `screen_share_start` / `screen_share_stop` 事件转发 |

---

## 2. 用户故事（User Stories）

### US-SS-01：发起屏幕共享
> **作为**通话中的用户，**我想要**点击一个按钮开始共享我的屏幕，**以便**对方能看到我的屏幕内容来协作沟通。

### US-SS-02：查看对方的屏幕共享
> **作为**通话中的接收方，**我想要**看到对方共享的屏幕以大画面呈现、摄像头画面变为小窗，**以便**我能清楚看到对方展示的内容。

### US-SS-03：停止屏幕共享
> **作为**正在共享屏幕的用户，**我想要**通过 UI 按钮或浏览器原生的"停止共享"按钮来结束共享，**以便**恢复正常通话画面。

### US-SS-04：感知共享状态
> **作为**通话参与方，**我想要**清楚地知道谁在共享屏幕（通过图标和文字提示），**以便**我对当前通话状态有准确认知。

### US-SS-05：权限异常处理
> **作为**尝试共享屏幕的用户，**如果**我拒绝了浏览器权限弹窗或浏览器不支持，**我希望**看到清晰的错误提示而非空白/卡死，**以便**我知道发生了什么。

---

## 3. 详细交互流程

### 3.1 正常流程：发起屏幕共享

```
用户 A（共享者）                            用户 B（接收者）
    │                                          │
    ├─ 点击工具栏 [🖥 共享屏幕] 按钮            │
    ├─ 浏览器弹出 getDisplayMedia 选择窗口      │
    ├─ 选择要共享的屏幕/窗口/标签页              │
    ├─ 获取 screenStream 成功                   │
    ├─ 将 screenTrack 替换/添加到 PeerConnection │
    ├─ Socket: emit('screen_share_start')  ────►│
    │                                          ├─ 收到 screen_share_start 事件
    │                                          ├─ 标记 remoteIsSharing = true
    ├─ 本地 UI: 大画面 = 屏幕，小窗 = 本地摄像头  │
    │                                          ├─ UI: 大画面 = 远程屏幕流，小窗 = 远程摄像头
    │                                          ├─ 顶部显示 "对方正在共享屏幕"
    ├─ 共享按钮变为激活态（高亮 + "正在共享"）     │
    │                                          │
```

### 3.2 正常流程：停止屏幕共享

```
用户 A（共享者）                            用户 B（接收者）
    │                                          │
    ├─ 方式1: 点击 [停止共享] 按钮              │
    │  或                                      │
    ├─ 方式2: 点击浏览器原生 "停止共享" 按钮      │
    │  （监听 screenTrack.onended 事件）         │
    ├─ 停止 screenStream 所有轨道               │
    ├─ 恢复 cameraTrack 到 PeerConnection       │
    ├─ Socket: emit('screen_share_stop')  ─────►│
    │                                          ├─ 收到 screen_share_stop 事件
    │                                          ├─ 标记 remoteIsSharing = false
    ├─ 本地 UI: 恢复正常视频通话布局              ├─ UI: 恢复正常视频通话布局
    │                                          │
```

### 3.3 异常/边界情况

| 场景 | 处理方式 |
|------|---------|
| **用户拒绝权限**（点击取消/拒绝） | 捕获 `NotAllowedError`，toast 提示"屏幕共享已取消"，不改变通话状态 |
| **浏览器不支持 getDisplayMedia** | 检测 `navigator.mediaDevices.getDisplayMedia` 是否存在，不存在则共享按钮置灰 + tooltip "当前浏览器不支持屏幕共享" |
| **共享中对方挂断** | `endCall` 流程中 cleanup 自动停止 screenStream |
| **共享中自己挂断** | 同上，cleanup 清理所有流 |
| **共享中切换静音/摄像头** | 屏幕共享流不受 toggleMute / toggleCamera 影响（它们只操作 localStream 中的音视频轨道） |
| **在语音通话中共享** | 允许。共享后 CallUI 切换到视频布局模式（大画面 = 屏幕流） |
| **重复点击共享按钮** | 如果已在共享状态，点击变为"停止共享"；不允许发起新的 getDisplayMedia |
| **共享期间浏览器 tab 切换** | screenStream 保持活跃（getDisplayMedia 的默认行为），无需特殊处理 |
| **对方网络中断** | 依赖现有 WebRTC ICE 重连机制，屏幕流与其他轨道一同受影响 |

---

## 4. 前端需求

### 4.1 `hooks/useWebRTC.ts` — 扩展

**新增状态**：
```typescript
const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
const [isScreenSharing, setIsScreenSharing] = useState(false);
const screenStreamRef = useRef<MediaStream | null>(null);
```

**新增方法**：

| 方法 | 说明 |
|------|------|
| `startScreenShare(): Promise<boolean>` | 调用 `navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })`，获取屏幕流；用 `RTCRtpSender.replaceTrack()` 将 screenTrack 替换 PeerConnection 中的 videoTrack；监听 `screenTrack.onended` 自动触发 `stopScreenShare()`；返回 true/false 表示是否成功 |
| `stopScreenShare(): void` | 停止 screenStream 所有轨道；用 `replaceTrack()` 恢复原始 cameraTrack；重置状态 |

**cleanup 扩展**：
- 在现有 `cleanup()` 中增加对 `screenStreamRef.current` 的清理

**导出扩展**：
```typescript
return {
  // ... 现有导出
  screenStream, isScreenSharing,
  startScreenShare, stopScreenShare,
};
```

### 4.2 `contexts/CallContext.tsx` — 扩展

**CallCtx 接口新增**：
```typescript
interface CallCtx {
  // ... 现有字段
  screenStream: MediaStream | null;
  isScreenSharing: boolean;       // 本地是否在共享
  remoteIsSharing: boolean;       // 对方是否在共享
  startScreenShare: () => void;
  stopScreenShare: () => void;
}
```

**新增状态**：
```typescript
const [remoteIsSharing, setRemoteIsSharing] = useState(false);
```

**startScreenShare 封装**：
```typescript
const handleStartScreenShare = useCallback(async () => {
  const success = await webrtc.startScreenShare();
  if (success && callInfo) {
    socket?.emit('screen_share_start', { targetUserId: callInfo.targetUserId });
  }
}, [socket, webrtc, callInfo]);
```

**stopScreenShare 封装**：
```typescript
const handleStopScreenShare = useCallback(() => {
  webrtc.stopScreenShare();
  if (callInfo) {
    socket?.emit('screen_share_stop', { targetUserId: callInfo.targetUserId });
  }
}, [socket, webrtc, callInfo]);
```

**Socket 监听新增**：
```typescript
socket.on('remote_screen_share_start', () => setRemoteIsSharing(true));
socket.on('remote_screen_share_stop', () => setRemoteIsSharing(false));
```

**endCall / cleanup 扩展**：
- endCall 时重置 `remoteIsSharing = false`
- cleanup 中自动调用 `stopScreenShare`

### 4.3 `components/CallUI.tsx` — UI 变更

#### 4.3.1 工具栏新增按钮

在现有 `🎤` / `📷` / `📞` 按钮组中，新增屏幕共享按钮（位于摄像头按钮和挂断按钮之间）：

```
[ 🎤 静音 ] [ 📷 摄像头 ] [ 🖥 共享屏幕 ] [ 📞 挂断 ]
```

- **默认态**: 半透明白底，图标 `🖥`，tooltip "共享屏幕"
- **共享中态**: 蓝色高亮背景 `#6264a7`，tooltip "停止共享"
- **不支持态**: 灰色置灰，tooltip "当前浏览器不支持屏幕共享"
- 点击逻辑：`isScreenSharing ? stopScreenShare() : startScreenShare()`

#### 4.3.2 视频画面布局

**当有屏幕共享时（本地共享 或 对方共享）**：

```
┌──────────────────────────────────────┐
│                                      │
│        大画面（屏幕共享流）             │
│                                      │
│                                      │
│                       ┌────────┐     │
│                       │ 小窗   │     │
│                       │ 摄像头 │     │
│                       └────────┘     │
└──────────────────────────────────────┘
```

- **大画面 `<video>`**：展示屏幕共享流（本地共享时显示 screenStream，对方共享时显示 remoteStream 中的屏幕轨道）
- **小窗 PiP `<video>`**：展示摄像头流
  - 位置：右下角，160×120px，圆角 8px，白色边框 2px
  - 可拖拽（可选 v2）
- `object-fit: contain`（屏幕共享用 contain 而非 cover，确保完整显示）

**恢复正常通话**：移除大画面逻辑，恢复现有的远程/本地视频布局。

#### 4.3.3 共享状态指示条

在通话画面顶部中央显示状态条：

- **本地共享时**: `"🖥 你正在共享屏幕"` — 绿色背景条
- **对方共享时**: `"🖥 {对方名称} 正在共享屏幕"` — 蓝色背景条
- 无共享时不显示

样式：
```css
position: absolute;
top: 20px;
left: 50%;
transform: translateX(-50%);
background: rgba(98, 100, 167, 0.9);  /* 或 绿色 #4caf50 */
color: #fff;
padding: 6px 16px;
border-radius: 20px;
font-size: 14px;
z-index: 10;
```

### 4.4 错误处理 UI

使用 toast / 临时通知条（复用现有项目的 alert 方式，或后续统一替换为 toast 组件）：

| 错误 | 提示文案 |
|------|---------|
| `NotAllowedError` | "屏幕共享已取消" |
| `NotFoundError` | "未找到可共享的屏幕" |
| `NotSupportedError` / API 不存在 | "当前浏览器不支持屏幕共享" |
| 其他异常 | "屏幕共享启动失败，请重试" |

---

## 5. 后端需求

### 5.1 Socket.IO 事件（`server/src/socket.ts`）

屏幕共享是纯前端 WebRTC 行为，后端只需**转发信令事件**，无需处理媒体流。

#### 新增事件

| 事件名 | 方向 | 数据 | 说明 |
|--------|------|------|------|
| `screen_share_start` | Client → Server | `{ targetUserId: string }` | 通知对方"我开始共享屏幕" |
| `remote_screen_share_start` | Server → Client | `{}` | 转发给目标用户 |
| `screen_share_stop` | Client → Server | `{ targetUserId: string }` | 通知对方"我停止共享屏幕" |
| `remote_screen_share_stop` | Server → Client | `{}` | 转发给目标用户 |

#### 实现（在 `socket.ts` 的 `io.on('connection')` 回调内追加）

```typescript
socket.on('screen_share_start', (data: { targetUserId: string }) => {
  const targetSocketId = onlineUsers.get(data.targetUserId);
  if (targetSocketId) {
    io.to(targetSocketId).emit('remote_screen_share_start', { userId });
  }
});

socket.on('screen_share_stop', (data: { targetUserId: string }) => {
  const targetSocketId = onlineUsers.get(data.targetUserId);
  if (targetSocketId) {
    io.to(targetSocketId).emit('remote_screen_share_stop', { userId });
  }
});
```

### 5.2 数据模型变更

**无**。屏幕共享是实时行为，不需要持久化。

### 5.3 API 接口变更

**无**。不需要新的 REST API。

---

## 6. 验收标准（Acceptance Criteria）

### AC-SS-01：基本共享功能
- [ ] 视频通话中，工具栏显示"共享屏幕"按钮
- [ ] 点击后弹出浏览器的屏幕/窗口选择界面
- [ ] 选择后，对方收到屏幕共享流并显示
- [ ] 共享者本地也能看到自己的屏幕共享画面

### AC-SS-02：画面布局
- [ ] 屏幕共享启动后，共享画面显示为大画面（object-fit: contain）
- [ ] 摄像头画面缩小为右下角 PiP 小窗（160×120）
- [ ] 停止共享后，恢复正常视频通话布局

### AC-SS-03：停止共享
- [ ] 点击"停止共享"按钮可正常停止
- [ ] 点击浏览器原生"停止共享"弹窗的停止按钮也能正常停止
- [ ] 停止后双方 UI 恢复正常通话布局

### AC-SS-04：状态指示
- [ ] 共享中，共享者看到"你正在共享屏幕"状态条
- [ ] 共享中，接收者看到"XXX 正在共享屏幕"状态条
- [ ] 共享按钮在共享状态下变为高亮/激活态
- [ ] 无共享时状态条不显示

### AC-SS-05：语音通话中共享
- [ ] 在语音通话中也可以发起屏幕共享
- [ ] 共享后 UI 自动切换到包含视频画面的布局

### AC-SS-06：错误处理
- [ ] 用户取消权限弹窗 → 显示"屏幕共享已取消"，通话不受影响
- [ ] 浏览器不支持 getDisplayMedia → 按钮置灰，tooltip 说明原因
- [ ] 其他异常 → 显示通用错误提示

### AC-SS-07：通话结束清理
- [ ] 共享中挂断电话 → screenStream 自动停止，不残留浏览器的屏幕捕获指示
- [ ] 对方挂断 → 本地 screenStream 自动清理

### AC-SS-08：不干扰现有功能
- [ ] 共享中切换静音 → 正常工作，屏幕共享不受影响
- [ ] 共享中切换摄像头开关 → 正常工作，屏幕共享不受影响
- [ ] 不影响现有的通话发起、接听、拒绝、挂断流程

---

## 附录：技术要点提醒

1. **`replaceTrack()` vs `addTrack()`**：推荐使用 `RTCRtpSender.replaceTrack()` 替换视频轨道，避免重新协商（renegotiation），减少信令复杂度。
2. **`onended` 事件**：`getDisplayMedia` 返回的 track 在用户通过浏览器 UI 停止时会触发 `onended`，必须监听此事件来同步状态。
3. **音频轨道**：`getDisplayMedia({ video: true, audio: false })` — 本版本不捕获系统音频，避免回声和音轨混乱。系统音频共享可作为 v2 功能。
4. **`object-fit: contain`**：屏幕共享大画面使用 `contain` 而非 `cover`，确保完整显示共享内容不被裁剪。
