import React, { useState, useEffect } from 'react';
import axios from 'axios';

import { API_BASE as API } from '../utils/config';
const headers = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const DAYS = ['日', '一', '二', '三', '四', '五', '六'];
const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

export default function CalendarView() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [events, setEvents] = useState<any[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', date: '', startTime: '', endTime: '', description: '' });

  const loadEvents = async () => {
    try {
      const r = await axios.get(`${API}/events`, { headers: headers(), params: { month: month + 1, year } });
      setEvents(r.data);
    } catch {}
  };

  useEffect(() => { loadEvents(); }, [month, year]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const today = new Date();
  const isToday = (d: number) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;

  const eventsOnDay = (d: number) => events.filter(e => {
    const ed = new Date(e.date);
    return ed.getDate() === d && ed.getMonth() === month && ed.getFullYear() === year;
  });

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); setSelectedDay(null); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); setSelectedDay(null); };

  const createEvent = async () => {
    if (!form.title) { alert('请输入标题'); return; }
    if (!form.date) { alert('请选择日期'); return; }
    try {
      await axios.post(`${API}/events`, form, { headers: headers() });
      setShowForm(false);
      setForm({ title: '', date: '', startTime: '', endTime: '', description: '' });
      loadEvents();
    } catch {}
  };

  const deleteEvent = async (id: string) => {
    try {
      await axios.delete(`${API}/events/${id}`, { headers: headers() });
      loadEvents();
    } catch {}
  };

  // Upcoming events (next 7 days)
  const upcoming = events.filter(e => {
    const ed = new Date(e.date);
    const diff = ed.getTime() - today.getTime();
    return diff >= 0 && diff <= 7 * 86400000;
  });

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: 4,
    background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box',
  };

  return (
    <div style={{ flex: 1, display: 'flex', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
      <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: 'var(--text-primary)' }}>📅 日历</h2>
          <button onClick={() => { setShowForm(true); setForm(f => ({ ...f, date: `${year}-${String(month+1).padStart(2,'0')}-${String(selectedDay||today.getDate()).padStart(2,'0')}` })); }}
            style={{ background: '#6264a7', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}>
            + 新建事件
          </button>
        </div>

        {/* Month navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 12 }}>
          <button onClick={prevMonth} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-primary)' }}>←</button>
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{year}年 {MONTHS[month]}</span>
          <button onClick={nextMonth} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-primary)' }}>→</button>
        </div>

        {/* Calendar grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {DAYS.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-secondary)', padding: '4px 0', fontWeight: 600 }}>{d}</div>
          ))}
          {cells.map((day, i) => (
            <div key={i} onClick={() => day && setSelectedDay(day)}
              style={{
                textAlign: 'center', padding: '8px 0', cursor: day ? 'pointer' : 'default',
                borderRadius: 4, minHeight: 36, position: 'relative',
                background: day && selectedDay === day ? '#6264a7' : day && isToday(day) ? 'var(--bg-hover)' : 'transparent',
                color: day && selectedDay === day ? '#fff' : 'var(--text-primary)',
                fontWeight: day && isToday(day) ? 700 : 400,
              }}>
              {day || ''}
              {day && eventsOnDay(day).length > 0 && (
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: selectedDay === day ? '#fff' : '#6264a7', margin: '2px auto 0' }} />
              )}
            </div>
          ))}
        </div>

        {/* Upcoming */}
        <div style={{ marginTop: 20 }}>
          <h3 style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8 }}>即将到来</h3>
          {upcoming.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>暂无近期事件</div>
          ) : upcoming.map(e => (
            <div key={e._id} style={{ padding: '8px 12px', background: 'var(--bg-primary)', borderRadius: 6, marginBottom: 6, borderLeft: '3px solid #6264a7' }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{e.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {new Date(e.date).toLocaleDateString('zh-CN')} {e.startTime && `${e.startTime}`}{e.endTime && ` - ${e.endTime}`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Side panel for selected day */}
      {selectedDay !== null && (
        <div style={{ width: 280, borderLeft: '1px solid var(--border-color)', padding: 16, overflowY: 'auto', background: 'var(--bg-primary)' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, color: 'var(--text-primary)' }}>{month + 1}月{selectedDay}日</h3>
          {eventsOnDay(selectedDay).length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>无事件</div>
          ) : eventsOnDay(selectedDay).map(e => (
            <div key={e._id} style={{ padding: 10, background: 'var(--bg-secondary)', borderRadius: 6, marginBottom: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{e.title}</div>
              {e.startTime && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{e.startTime}{e.endTime && ` - ${e.endTime}`}</div>}
              {e.description && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{e.description}</div>}
              <button onClick={() => deleteEvent(e._id)} style={{ marginTop: 6, fontSize: 12, color: '#c4314b', background: 'none', border: 'none', cursor: 'pointer' }}>删除</button>
            </div>
          ))}
        </div>
      )}

      {/* Create event form modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setShowForm(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-primary)', borderRadius: 8, padding: 24, width: 360, maxWidth: '90vw' }}>
            <h3 style={{ margin: '0 0 16px', color: 'var(--text-primary)' }}>新建事件</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input placeholder="标题" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} />
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="time" placeholder="开始" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} style={inputStyle} />
                <input type="time" placeholder="结束" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} style={inputStyle} />
              </div>
              <textarea placeholder="描述（可选）" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowForm(false)} style={{ padding: '6px 16px', border: '1px solid var(--border-color)', background: 'none', borderRadius: 4, cursor: 'pointer', color: 'var(--text-primary)' }}>取消</button>
                <button onClick={createEvent} style={{ padding: '6px 16px', background: '#6264a7', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>创建</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
