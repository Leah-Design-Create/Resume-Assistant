import React, { useState } from 'react';
import type { Candidate, Project } from './types';

const defaultCandidate: Candidate = {
  name: '',
  title: '',
  location: '',
  experienceYears: '',
  coreProjects: 0,
  deliveryRate: '',
  skills: [],
  capabilities: [],
  avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=256&h=256&auto=format&fit=crop',
};

const defaultProject: Project = {
  id: '',
  title: '',
  description: '',
  tags: [],
  impact: '',
  imageUrl: 'https://images.unsplash.com/photo-1586769852836-bc069f19e1b6?q=80&w=800&auto=format&fit=crop',
  docUrl: '#',
};

interface AddResumeModalProps {
  onClose: () => void;
  onSaved: (newResumeId: string) => void;
}

export default function AddResumeModal({ onClose, onSaved }: AddResumeModalProps) {
  const [candidate, setCandidate] = useState<Candidate>({ ...defaultCandidate });
  const [projects, setProjects] = useState<Project[]>([{ ...defaultProject, id: `proj-${Date.now()}` }]);
  const [skillsText, setSkillsText] = useState('');
  const [capabilitiesText, setCapabilitiesText] = useState('前端架构:92, 后端工程化:88, 产品思维:85');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const updateCandidate = (patch: Partial<Candidate>) => {
    setCandidate((c) => ({ ...c, ...patch }));
  };

  const parseCapabilities = (text: string): { name: string; level: number }[] => {
    return text.split(/[,，]/).filter(Boolean).map((s) => {
      const [name, levelStr] = s.trim().split(/[:：]/);
      const level = Math.min(100, Math.max(0, parseInt(levelStr?.trim() || '0', 10) || 0));
      return { name: (name || '').trim() || '未命名', level };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!candidate.name.trim()) {
      setError('请填写姓名');
      return;
    }
    if (!candidate.title.trim()) {
      setError('请填写职位');
      return;
    }
    const candidateToSave: Candidate = {
      ...candidate,
      skills: skillsText.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
      capabilities: parseCapabilities(capabilitiesText),
      coreProjects: Number(candidate.coreProjects) || 0,
    };
    const projectsToSave: Project[] = projects.map((p, i) => ({
      ...p,
      id: p.id || `proj-${Date.now()}-${i}`,
      tags: Array.isArray(p.tags) ? p.tags : (typeof p.tags === 'string' ? (p.tags as string).split(/[,，]/).map((s) => s.trim()) : []),
    }));
    setSaving(true);
    try {
      const { createResume } = await import('./api');
      const created = await createResume(candidateToSave, projectsToSave);
      onSaved(created.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const updateProject = (index: number, patch: Partial<Project>) => {
    setProjects((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const addProject = () => {
    setProjects((prev) => [...prev, { ...defaultProject, id: `proj-${Date.now()}` }]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">添加简历</h2>
          <button type="button" className="p-2 text-slate-400 hover:bg-slate-100 rounded-full" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">姓名 *</label>
            <input type="text" value={candidate.name} onChange={(e) => updateCandidate({ name: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" placeholder="张三" required />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">职位 *</label>
            <input type="text" value={candidate.title} onChange={(e) => updateCandidate({ title: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" placeholder="高级全栈开发工程师" required />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">所在地</label>
            <input type="text" value={candidate.location} onChange={(e) => updateCandidate({ location: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" placeholder="上海 · 浦东" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">工作年限</label>
              <input type="text" value={candidate.experienceYears} onChange={(e) => updateCandidate({ experienceYears: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" placeholder="8+" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">核心项目数</label>
              <input type="number" value={candidate.coreProjects || ''} onChange={(e) => updateCandidate({ coreProjects: parseInt(e.target.value, 10) || 0 })} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" placeholder="6" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">交付率</label>
              <input type="text" value={candidate.deliveryRate} onChange={(e) => updateCandidate({ deliveryRate: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" placeholder="100%" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">技能（逗号分隔）</label>
            <input type="text" value={skillsText} onChange={(e) => setSkillsText(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" placeholder="React, Node.js, Python" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">能力评估（名称:分数，逗号分隔）</label>
            <input type="text" value={capabilitiesText} onChange={(e) => setCapabilitiesText(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" placeholder="前端架构:92, 后端:88" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">头像 URL</label>
            <input type="url" value={candidate.avatarUrl} onChange={(e) => updateCandidate({ avatarUrl: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" placeholder="https://..." />
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">项目经验</span>
              <button type="button" onClick={addProject} className="text-xs text-blue-600 font-semibold">+ 添加项目</button>
            </div>
            {projects.map((p, i) => (
              <div key={p.id} className="mb-4 p-4 rounded-xl border border-slate-100 space-y-2">
                <input type="text" value={p.title} onChange={(e) => updateProject(i, { title: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="项目名称" />
                <textarea value={p.description} onChange={(e) => updateProject(i, { description: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" rows={2} placeholder="项目描述" />
                <input type="text" value={Array.isArray(p.tags) ? p.tags.join(', ') : ''} onChange={(e) => updateProject(i, { tags: e.target.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean) })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="标签，逗号分隔" />
                <input type="text" value={p.impact} onChange={(e) => updateProject(i, { impact: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="成果/影响，如 35%" />
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold">取消</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-50">保存</button>
          </div>
        </form>
      </div>
    </div>
  );
}
