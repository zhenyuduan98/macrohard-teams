import { Router, Response } from 'express';
import { Team } from '../models/Team.js';
import { Channel } from '../models/Channel.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Create team
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, memberIds } = req.body;
    if (!name) return res.status(400).json({ error: '团队名称必填' });

    const members = [req.userId!, ...(memberIds || []).filter((id: string) => id !== req.userId)];
    const team = await Team.create({ name, description: description || '', admin: req.userId, members });

    // Create default channel
    const channel = await Channel.create({ name: '常规', team: team._id, type: 'general' });
    team.channels.push(channel._id as any);
    await team.save();

    const populated = await Team.findById(team._id)
      .populate('members', '-password')
      .populate('admin', '-password')
      .populate('channels');
    res.status(201).json(populated);
  } catch {
    res.status(500).json({ error: '创建团队失败' });
  }
});

// List user's teams
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const teams = await Team.find({ members: req.userId })
      .populate('members', '-password')
      .populate('admin', '-password')
      .populate('channels')
      .sort({ createdAt: -1 });
    res.json(teams);
  } catch {
    res.status(500).json({ error: '获取团队列表失败' });
  }
});

// Get team details
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('members', '-password')
      .populate('admin', '-password')
      .populate('channels');
    if (!team) return res.status(404).json({ error: '团队不存在' });
    res.json(team);
  } catch {
    res.status(500).json({ error: '获取团队详情失败' });
  }
});

// Update team (admin only)
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: '团队不存在' });
    if (team.admin.toString() !== req.userId) return res.status(403).json({ error: '只有管理员可以修改团队' });

    const { name, description } = req.body;
    if (name) team.name = name;
    if (description !== undefined) team.description = description;
    await team.save();

    const populated = await Team.findById(team._id)
      .populate('members', '-password')
      .populate('admin', '-password')
      .populate('channels');
    res.json(populated);
  } catch {
    res.status(500).json({ error: '更新团队失败' });
  }
});

// Add members
router.post('/:id/members', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: '团队不存在' });

    const { userIds } = req.body;
    if (!userIds || !Array.isArray(userIds)) return res.status(400).json({ error: '缺少用户ID' });

    for (const uid of userIds) {
      if (!team.members.some(m => m.toString() === uid)) {
        team.members.push(uid);
      }
    }
    await team.save();

    const populated = await Team.findById(team._id)
      .populate('members', '-password')
      .populate('admin', '-password')
      .populate('channels');
    res.json(populated);
  } catch {
    res.status(500).json({ error: '添加成员失败' });
  }
});

// Remove member
router.delete('/:id/members/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: '团队不存在' });

    team.members = team.members.filter(m => m.toString() !== req.params.userId) as any;
    await team.save();

    const populated = await Team.findById(team._id)
      .populate('members', '-password')
      .populate('admin', '-password')
      .populate('channels');
    res.json(populated);
  } catch {
    res.status(500).json({ error: '移除成员失败' });
  }
});

// Create channel in team
router.post('/:id/channels', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: '团队不存在' });

    const { name, type, description } = req.body;
    if (!name) return res.status(400).json({ error: '频道名称必填' });

    const channel = await Channel.create({
      name,
      team: team._id,
      type: type || 'general',
      description: description || '',
    });
    team.channels.push(channel._id as any);
    await team.save();

    res.status(201).json(channel);
  } catch {
    res.status(500).json({ error: '创建频道失败' });
  }
});

// Delete channel
router.delete('/:id/channels/:channelId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: '团队不存在' });

    team.channels = team.channels.filter(c => c.toString() !== req.params.channelId) as any;
    await team.save();
    await Channel.findByIdAndDelete(req.params.channelId);

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: '删除频道失败' });
  }
});

export default router;
