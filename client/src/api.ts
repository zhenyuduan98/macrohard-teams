import axios from 'axios';

import { API_BASE as API } from './utils/config';

function headers() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchConversations() {
  const r = await axios.get(`${API}/conversations`, { headers: headers() });
  return r.data;
}

export async function createConversation(participantId: string) {
  const r = await axios.post(`${API}/conversations`, { participantId }, { headers: headers() });
  return r.data;
}

export async function createGroupConversation(name: string, participants: string[]) {
  const r = await axios.post(`${API}/conversations/group`, { name, participants }, { headers: headers() });
  return r.data;
}

export async function updateConversation(id: string, data: { name?: string; addMembers?: string[]; removeMembers?: string[] }) {
  const r = await axios.put(`${API}/conversations/${id}`, data, { headers: headers() });
  return r.data;
}

export async function fetchGroupMembers(conversationId: string) {
  const r = await axios.get(`${API}/conversations/${conversationId}/members`, { headers: headers() });
  return r.data;
}

export async function fetchMessages(conversationId: string, before?: string, type?: string) {
  const params: any = { limit: 50 };
  if (before) params.before = before;
  if (type) params.type = type;
  const r = await axios.get(`${API}/messages/${conversationId}`, { headers: headers(), params });
  return r.data;
}

export async function fetchUsers() {
  const r = await axios.get(`${API}/users`, { headers: headers() });
  return r.data;
}

export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const r = await axios.post(`${API}/upload`, form, {
    headers: { ...headers(), 'Content-Type': 'multipart/form-data' },
  });
  return r.data.url;
}

export async function uploadFile(file: File): Promise<{ url: string; filename: string; size: number; mimeType: string }> {
  const form = new FormData();
  form.append('file', file);
  const r = await axios.post(`${API}/upload`, form, {
    headers: { ...headers(), 'Content-Type': 'multipart/form-data' },
  });
  return r.data;
}

export async function searchMessages(q: string) {
  const r = await axios.get(`${API}/messages/search`, { headers: headers(), params: { q } });
  return r.data;
}

export async function uploadAvatar(file: File): Promise<string> {
  const form = new FormData();
  form.append('avatar', file);
  const r = await axios.put(`${API}/auth/avatar`, form, {
    headers: { ...headers(), 'Content-Type': 'multipart/form-data' },
  });
  return r.data.avatar;
}

export async function updateStatus(statusText: string, statusType: string): Promise<any> {
  const r = await axios.put(`${API}/auth/status`, { statusText, statusType }, { headers: headers() });
  return r.data;
}

export async function editMessage(messageId: string, content: string) {
  const r = await axios.put(`${API}/messages/${messageId}`, { content }, { headers: headers() });
  return r.data;
}

export async function deleteMessage(messageId: string) {
  const r = await axios.delete(`${API}/messages/${messageId}`, { headers: headers() });
  return r.data;
}

// Team APIs
export async function fetchTeams() {
  const r = await axios.get(`${API}/teams`, { headers: headers() });
  return r.data;
}

export async function createTeam(name: string, description: string, memberIds: string[]) {
  const r = await axios.post(`${API}/teams`, { name, description, memberIds }, { headers: headers() });
  return r.data;
}

export async function fetchTeamDetail(teamId: string) {
  const r = await axios.get(`${API}/teams/${teamId}`, { headers: headers() });
  return r.data;
}

export async function addTeamMembers(teamId: string, userIds: string[]) {
  const r = await axios.post(`${API}/teams/${teamId}/members`, { userIds }, { headers: headers() });
  return r.data;
}

export async function removeTeamMember(teamId: string, userId: string) {
  const r = await axios.delete(`${API}/teams/${teamId}/members/${userId}`, { headers: headers() });
  return r.data;
}

export async function createChannel(teamId: string, name: string, type?: string) {
  const r = await axios.post(`${API}/teams/${teamId}/channels`, { name, type: type || 'general' }, { headers: headers() });
  return r.data;
}

export async function deleteChannel(teamId: string, channelId: string) {
  const r = await axios.delete(`${API}/teams/${teamId}/channels/${channelId}`, { headers: headers() });
  return r.data;
}
