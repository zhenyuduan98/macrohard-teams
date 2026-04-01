import { User } from './models/User.js';

const BOT_USERNAME = 'MacroBot';
const BOT_PASSWORD = 'MacroBot!Secret2024';

let botUserId: string | null = null;

export async function ensureBotUser(): Promise<string> {
  if (botUserId) return botUserId;
  let bot = await User.findOne({ username: BOT_USERNAME });
  if (!bot) {
    bot = await User.create({ username: BOT_USERNAME, password: BOT_PASSWORD, status: 'online' });
  }
  botUserId = bot._id.toString();
  return botUserId;
}

export function getBotUserId(): string | null {
  return botUserId;
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
