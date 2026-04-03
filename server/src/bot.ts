import 'dotenv/config';
import { User } from './models/User.js';
import { Message } from './models/Message.js';
import { Conversation } from './models/Conversation.js';

const BOT_USERNAME = 'MacroBot';
const BOT_PASSWORD = 'MacroBot!Secret2024';
const GPT_USERNAME = 'GPT-5.4-mini';
const GPT_PASSWORD = 'GPT52!BotSecret2024!NoLogin';

let botUserId: string | null = null;
let gptBotUserId: string | null = null;

export async function ensureBotUser(): Promise<string> {
  // MacroBot
  let bot = await User.findOne({ username: BOT_USERNAME });
  if (!bot) {
    bot = await User.create({ username: BOT_USERNAME, password: BOT_PASSWORD, status: 'online' });
  }
  botUserId = bot._id.toString();

  // GPT-5.4-mini bot
  const gptBot = await User.findOneAndUpdate(
    { username: GPT_USERNAME },
    {
      $set: {
        status: 'online',
        statusType: 'available',
        isBot: true,
      },
      $setOnInsert: {
        username: GPT_USERNAME,
        password: GPT_PASSWORD,
        avatar: '/uploads/gpt-avatar.png',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  gptBotUserId = gptBot._id.toString();
  console.log('GPT-5.4-mini bot user ready:', gptBotUserId);

  return botUserId;
}

export function getBotUserId(): string | null {
  return botUserId;
}

export function getGptBotUserId(): string | null {
  return gptBotUserId;
}

export async function isGptConversation(conversationId: string): Promise<boolean> {
  if (!gptBotUserId) return false;
  const convo = await Conversation.findById(conversationId);
  if (!convo) return false;
  // Only dedicated 1-on-1 GPT conversation (exactly 2 participants, one is GPT)
  return convo.participants.length === 2 && convo.participants.some(p => p.toString() === gptBotUserId);
}

export async function handleGptMessage(conversationId: string, io: any, isMention: boolean = false): Promise<void> {
  if (!gptBotUserId) return;

  const { AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT, AZURE_OPENAI_API_VERSION } = process.env;
  if (!AZURE_OPENAI_API_KEY || !AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_DEPLOYMENT) {
    console.error('Azure OpenAI env vars not set');
    return;
  }

  // Ensure GPT-5.4-mini is a participant of this conversation
  try {
    const conv = await Conversation.findById(conversationId);
    if (conv && !conv.participants.some((p: any) => p.toString() === gptBotUserId)) {
      conv.participants.push(gptBotUserId as any);
      await conv.save();
    }
  } catch (e) {
    console.error('Failed to add GPT-5.4-mini to conversation:', e);
  }

  // Emit typing
  io.to(conversationId).emit('user_typing', { userId: gptBotUserId, conversationId });

  try {
    // Fetch last 20 messages for context
    const recentMsgs = await Message.find({ conversation: conversationId, isDeleted: false })
      .populate('sender', 'username isBot')
      .sort({ timestamp: -1 })
      .limit(20);

    const history = recentMsgs.reverse().map((m: any) => ({
      role: m.sender?.isBot || m.sender?.username === GPT_USERNAME ? 'assistant' : 'user',
      content: m.content,
    }));

    const apiUrl = `${AZURE_OPENAI_ENDPOINT.replace(/\/$/, '')}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION || '2024-12-01-preview'}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': AZURE_OPENAI_API_KEY,
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: (isMention ? '用户在群聊/对话中 @你，请针对性回复。' : '') + '你是 GPT-5.4-mini，一个友好、智能的 AI 助手。请用中文回答用户的问题。保持简洁友好的语气。' },
          ...history,
        ],
        max_completion_tokens: 1000,
        stream: true,
      }),
    });

    let replyContent: string;
    if (!response.ok) {
      console.error('Azure OpenAI error:', response.status, await response.text().catch(() => ''));
      replyContent = '抱歉，我暂时无法回复，请稍后再试 😅';
    } else {
      // Stream SSE response
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let sseBuffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split('\n');
          // Keep last potentially incomplete line in buffer
          sseBuffer = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const payload = trimmed.slice(6);
            if (payload === '[DONE]') continue;
            try {
              const json = JSON.parse(payload);
              const token = json.choices?.[0]?.delta?.content || '';
              if (token) {
                accumulated += token;
                io.to(conversationId).emit('gpt_stream_chunk', { conversationId, content: accumulated, done: false });
              }
            } catch {}
          }
        }
      } catch (streamErr) {
        console.error('Stream read error:', streamErr);
        if (accumulated) {
          accumulated += '\n\n[回复中断]';
        }
      }

      replyContent = accumulated || '抱歉，我暂时无法回复，请稍后再试 😅';
    }

    // Save and emit reply
    const botMsg = await Message.create({
      sender: gptBotUserId,
      conversation: conversationId,
      content: replyContent,
      type: 'text',
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: botMsg._id,
      updatedAt: new Date(),
    });

    const populated = await botMsg.populate('sender', '-password');
    io.to(conversationId).emit('gpt_stream_chunk', { conversationId, content: replyContent, done: true, messageId: botMsg._id.toString() });
    io.to(conversationId).emit('receive_message', populated);
  } catch (err) {
    console.error('GPT bot error:', err);
    // Send error message
    try {
      const errMsg = await Message.create({
        sender: gptBotUserId,
        conversation: conversationId,
        content: '抱歉，我暂时无法回复，请稍后再试 😅',
        type: 'text',
      });
      const populated = await errMsg.populate('sender', '-password');
      io.to(conversationId).emit('receive_message', populated);
    } catch {}
  }
}

const JOKES = [
  '为什么程序员总是分不清万圣节和圣诞节？因为 Oct 31 = Dec 25',
  '一个 SQL 走进酒吧，看到两张 tables，问：Can I JOIN you?',
  '程序员最讨厌什么季节？秋天，因为树开始掉 branch 了',
  '为什么 Java 开发者戴眼镜？因为他们看不到 C#',
  '什么是程序员的噩梦？"在我电脑上能跑啊！"',
  '"老婆，今天晚饭吃什么？" "随便。" 程序员：Math.random()',
  'TCP 走进酒吧说："给我来杯啤酒。" 酒保说："你要杯啤酒？" TCP 说："是的，我要杯啤酒。"',
  'HTTP 走进酒吧，酒保说："抱歉，我们不接待 PUT 请求。"',
  '为什么程序员不喜欢大自然？因为有太多 bugs',
  '有十种人理解二进制：懂的和不懂的',
  '"我的密码是：我老婆的生日" 系统提示：密码太弱',
  '产品经理：这个需求很简单。程序员：你再说一遍？',
];

const FUN_REPLIES = [
  '嘿！我是 MacroBot，有什么能帮你的吗？😄',
  '你好呀！虽然我是机器人，但我也有感情的（假装）🤖',
  '在呢在呢！我是你最可靠的机器人朋友！',
  '有人叫我？MacroBot 闪亮登场！✨',
  '你找我有什么事？我随时待命！💪',
  '我虽然不会写代码，但我会讲笑话呀～',
  '嗨！今天过得怎么样？需要我帮忙吗？',
  '收到！MacroBot 为您服务！🫡',
];

export function processBotCommand(content: string): string | null {
  const trimmed = content.trim();

  if (trimmed === '/help') {
    return '📋 **MacroBot 命令列表**\n' +
      '`/help` — 查看可用命令\n' +
      '`/time` — 当前服务器时间\n' +
      '`/joke` — 随机笑话\n' +
      '`/flip` — 抛硬币\n' +
      '`/roll` — 掷骰子\n' +
      '`/echo [文字]` — 复读机\n' +
      '`@MacroBot` — 和我聊天';
  }

  if (trimmed === '/time') {
    const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    return `🕐 当前服务器时间：${now}`;
  }

  if (trimmed === '/joke') {
    return `😂 ${JOKES[Math.floor(Math.random() * JOKES.length)]}`;
  }

  if (trimmed === '/flip') {
    const result = Math.random() < 0.5 ? '正面' : '反面';
    return `🪙 抛硬币结果：**${result}**！`;
  }

  if (trimmed === '/roll') {
    const result = Math.floor(Math.random() * 6) + 1;
    return `🎲 掷骰子结果：**${result}**！`;
  }

  if (trimmed.startsWith('/echo ')) {
    const text = trimmed.substring(6).trim();
    return text ? `🔊 ${text}` : '你想让我说什么？';
  }

  if (trimmed.startsWith('/echo')) {
    return '用法：`/echo [文字]`';
  }

  // @MacroBot mention
  if (content.includes('@MacroBot')) {
    return FUN_REPLIES[Math.floor(Math.random() * FUN_REPLIES.length)];
  }

  return null;
}
