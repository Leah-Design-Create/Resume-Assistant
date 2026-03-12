import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  MoreHorizontal, 
  Network, 
  BrainCircuit, 
  Building2, 
  Calendar, 
  MapPin, 
  TrendingUp, 
  ExternalLink, 
  Mic,
  MicOff,
  Send, 
  FileText, 
  User,
  ChevronDown,
  Plus,
  Upload,
  Trash2,
  Link2,
  Image
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { sendChatMessage, fetchResumes, fetchResumeDetail, uploadResumePdf, deleteResume, downloadResumePdf, updateResumeAvatar } from './api';
import type { ResumeItem } from './api';
import type { ResumeDetail } from './api';
import { Message, Suggestion } from './types';
import AddResumeModal from './AddResumeModal';
import { getPdfFirstPageAsImageUrlForDetection } from './pdfAvatar';
import { detectFaceBoxInImage } from './faceDetection';

const SUGGESTIONS: Suggestion[] = [
  { id: 'projects', label: '项目经验', icon: Network, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  { id: 'skills', label: '核心技能', icon: BrainCircuit, color: 'text-purple-600', bgColor: 'bg-purple-50' },
  { id: 'experience', label: '公司经历', icon: Building2, color: 'text-orange-600', bgColor: 'bg-orange-50' },
  { id: 'availability', label: '到岗时间', icon: Calendar, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
];

export default function App() {
  const [resumes, setResumes] = useState<ResumeItem[]>([]);
  const [currentResumeId, setCurrentResumeId] = useState<string | null>(null);
  const [currentResume, setCurrentResume] = useState<ResumeDetail | null>(null);
  const [resumeDropdownOpen, setResumeDropdownOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [viewOnly, setViewOnly] = useState(false); // true = HR 通过分享链接打开，无法使用下拉框管理功能
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [skipAvatarForPdf, setSkipAvatarForPdf] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const candidate = currentResume?.candidate;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idFromUrl = params.get('resumeId');
    const hasManage = params.get('manage') === '1';
    setViewOnly(!!idFromUrl && !hasManage);
    fetchResumes().then((list) => {
      setResumes(list);
      if (idFromUrl && list.some((r) => r.id === idFromUrl)) {
        setCurrentResumeId(idFromUrl);
      } else if (list.length > 0 && !currentResumeId) {
        setCurrentResumeId(list[0].id);
      }
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!currentResumeId) return;
    const url = new URL(window.location.href);
    url.searchParams.set('resumeId', currentResumeId);
    if (!viewOnly) url.searchParams.set('manage', '1');
    window.history.replaceState(null, '', url.toString());
  }, [currentResumeId, viewOnly]);

  useEffect(() => () => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
  }, []);

  useEffect(() => {
    if (!currentResumeId) {
      setCurrentResume(null);
      setMessages([{ id: 'welcome', role: 'assistant', content: '请选择或添加一份简历，即可开始对话。' }]);
      return;
    }
    fetchResumeDetail(currentResumeId).then((detail) => {
      setCurrentResume(detail);
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: `你好！我是${detail.candidate.name}的简历助手。你可以问我关于 TA 的项目经验、专业技能、学历与求职意向或工作经历。`
      }]);
    }).catch(() => {
      setCurrentResume(null);
      setMessages([{ id: 'welcome', role: 'assistant', content: '加载简历失败，请重试或添加新简历。' }]);
    });
  }, [currentResumeId]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleAddResumeSaved = (newResumeId: string) => {
    setAddModalOpen(false);
    fetchResumes().then(setResumes);
    setCurrentResumeId(newResumeId);
  };

  const handlePdfSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      if (file && !file.name.toLowerCase().endsWith('.pdf')) {
        setMessages((prev) => [...prev, { id: 'pdf-err', role: 'assistant', content: '请选择 PDF 文件（.pdf）' }]);
      }
      return;
    }
    setPdfUploading(true);
    setMessages((prev) => [...prev, { id: 'pdf-loading', role: 'assistant', content: '正在识别 PDF，请稍候…' }]);
    try {
      let avatarImage: string | null = null;
      let faceBox: { x: number; y: number; width: number; height: number } | null = null;
      if (!skipAvatarForPdf) {
        avatarImage = await getPdfFirstPageAsImageUrlForDetection(file);
        faceBox = avatarImage ? await detectFaceBoxInImage(avatarImage) : null;
      }
      const result = await uploadResumePdf(file, avatarImage ?? undefined, faceBox ?? undefined);
      setMessages((prev) => prev.filter((m) => m.id !== 'pdf-loading'));
      await fetchResumes().then(setResumes);
      setCurrentResumeId(result.id);
      setCurrentResume({
        candidate: result.candidate,
        projects: result.projects,
        rawText: result.rawText
      });
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: `已识别并导入「${result.candidate.name}」的简历，你可以根据简历内容向我提问。`
      }]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => prev.filter((m) => m.id !== 'pdf-loading').concat([{
        id: 'pdf-err',
        role: 'assistant',
        content: err instanceof Error ? err.message : 'PDF 上传识别失败，请重试。'
      }]));
    } finally {
      setPdfUploading(false);
    }
  };

  const resizeImageToDataUrl = (file: File, maxSize = 200): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = document.createElement('img');
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        const scale = Math.min(maxSize / img.naturalWidth, maxSize / img.naturalHeight, 1);
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('无法创建画布')); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.88));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片加载失败')); };
      img.src = url;
    });

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !currentResumeId) return;
    if (!file.type.startsWith('image/')) {
      setMessages((prev) => [...prev, { id: 'av-err', role: 'assistant', content: '请选择图片文件（如 JPG、PNG）' }]);
      return;
    }
    setAvatarUploading(true);
    setResumeDropdownOpen(false);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      const data = await updateResumeAvatar(currentResumeId, dataUrl);
      setCurrentResume({
        candidate: data.candidate,
        projects: data.projects,
        rawText: data.rawText
      });
    } catch (err) {
      setMessages((prev) => [...prev, { id: 'av-err', role: 'assistant', content: err instanceof Error ? err.message : '头像更新失败' }]);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || !currentResumeId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    try {
      const { content, project, projects } = await sendChatMessage(text, currentResumeId);
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content,
        ...(projects?.length ? { projects } : project ? { project } : {})
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Chat API Error:', error);
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: error instanceof Error ? error.message : '网络错误，请检查后端服务是否已启动（npm run server）。'
      };
      setMessages(prev => [...prev, aiMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const toggleVoiceInput = () => {
    const SpeechRecognitionAPI =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognition }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition }).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setMessages((prev) => prev.concat([{
        id: `voice-${Date.now()}`,
        role: 'assistant',
        content: '当前浏览器不支持语音识别，请使用 Chrome 或 Edge 等支持语音输入的浏览器。'
      }]));
      return;
    }

    if (isRecording) {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.lang = 'zh-CN';
    recognition.interimResults = true;

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let full = '';
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) full += e.results[i][0].transcript;
      }
      if (full.trim()) setInputValue((prev) => (prev ? `${prev}${full}` : full));
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => {
      recognitionRef.current = null;
      setIsRecording(false);
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsRecording(true);
    } catch {
      setIsRecording(false);
    }
  };

  return (
    <div className="h-screen w-full bg-slate-100/50 font-display flex items-center justify-center p-4 md:p-8">
      <div className="flex h-full w-full max-w-[1440px] gap-6 overflow-hidden">
        {/* Left Column: Chat Area */}
        <main className="flex flex-col flex-[2.6] min-w-0 bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-200/60 relative overflow-hidden">
          {/* Header */}
          <header className="flex items-center justify-between px-8 py-6 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Bot size={24} />
            </div>
            <div className="relative">
              {viewOnly ? (
                <div className="flex items-center gap-2">
                  <div>
                    <h1 className="font-bold text-lg text-slate-900">
                      {candidate ? `${candidate.name}的简历助手` : '选择简历'}
                    </h1>
                    <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">简历智能助手 · AI Assistant</p>
                  </div>
                </div>
              ) : (
                <>
              <button
                type="button"
                onClick={() => setResumeDropdownOpen((o) => !o)}
                className="flex items-center gap-2 text-left"
              >
                <div>
                  <h1 className="font-bold text-lg text-slate-900">
                    {candidate ? `${candidate.name}的简历助手` : '选择简历'}
                  </h1>
                  <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">简历智能助手 · AI Assistant</p>
                </div>
                <ChevronDown size={18} className="text-slate-400" />
              </button>
              {resumeDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setResumeDropdownOpen(false)} />
                  <div className="absolute left-0 top-full mt-1 w-56 bg-white rounded-xl border border-slate-200 shadow-lg py-1 z-20">
                    {resumes.map((r) => (
                      <div
                        key={r.id}
                        className={`group flex items-center gap-1 px-4 py-2.5 text-sm hover:bg-slate-50 ${currentResumeId === r.id ? 'bg-blue-50 text-blue-700' : 'text-slate-700'}`}
                      >
                        <button
                          type="button"
                          onClick={() => { setCurrentResumeId(r.id); setResumeDropdownOpen(false); }}
                          className="flex-1 text-left min-w-0"
                        >
                          <div className="font-medium truncate">{r.name}</div>
                          <div className="text-xs text-slate-500 truncate">{r.title}</div>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`确定删除「${r.name}」的简历？此操作不可恢复。`)) {
                              deleteResume(r.id).then(() => {
                                fetchResumes().then((list) => {
                                  setResumes(list);
                                  if (currentResumeId === r.id) {
                                    const next = list.find((x) => x.id !== r.id);
                                    setCurrentResumeId(next?.id ?? null);
                                  }
                                  setResumeDropdownOpen(false);
                                });
                              }).catch((err) => {
                                setMessages((prev) => [...prev, { id: 'del-err', role: 'assistant', content: err instanceof Error ? err.message : '删除失败' }]);
                              });
                            }
                          }}
                          className="p-1.5 rounded text-slate-400 hover:bg-red-50 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="删除简历"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => { setAddModalOpen(true); setResumeDropdownOpen(false); }}
                      className="w-full px-4 py-2.5 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                    >
                      <Plus size={16} /> 添加简历
                    </button>
                    <button
                      type="button"
                      disabled={pdfUploading}
                      onClick={() => { setResumeDropdownOpen(false); fileInputRef.current?.click(); }}
                      className="w-full px-4 py-2.5 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2 disabled:opacity-50"
                    >
                      <Upload size={16} /> {pdfUploading ? '识别中…' : '上传 PDF 简历'}
                    </button>
                    {currentResumeId && (
                      <button
                        type="button"
                        disabled={avatarUploading}
                        onClick={() => { setResumeDropdownOpen(false); avatarInputRef.current?.click(); }}
                        className="w-full px-4 py-2.5 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2 disabled:opacity-50"
                      >
                        <Image size={16} /> {avatarUploading ? '上传中…' : '上传头像'}
                      </button>
                    )}
                    <label className="flex items-center gap-2 px-4 py-2 text-xs text-slate-500 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={skipAvatarForPdf}
                        onChange={(e) => setSkipAvatarForPdf(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      上传时不识别头像（头像留空）
                    </label>
                  </div>
                </>
              )}
                </>
              )}
            </div>
          </div>
          {/* 文件输入放在下拉外，避免选文件时已被卸载导致无反应 */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={handlePdfSelect}
          />
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarSelect}
          />
          <div className="relative">
            <button
              type="button"
              onClick={() => { setMoreMenuOpen((o) => !o); setResumeDropdownOpen(false); }}
              className="p-2 hover:bg-slate-50 rounded-full transition-colors text-slate-400"
              title="更多"
            >
              <MoreHorizontal size={20} />
            </button>
            {moreMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMoreMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl border border-slate-200 shadow-lg py-1 z-20">
                  <button
                    type="button"
                    disabled={!currentResumeId}
                    onClick={() => {
                      if (!currentResumeId) return;
                      const url = new URL(window.location.href);
                      url.searchParams.set('resumeId', currentResumeId);
                      url.searchParams.delete('manage');
                      window.navigator.clipboard.writeText(url.toString()).then(() => {
                        setMessages((prev) => [...prev, { id: `link-${Date.now()}`, role: 'assistant', content: '已复制当前简历链接。' }]);
                      }).catch(() => {
                        setMessages((prev) => [...prev, { id: `link-${Date.now()}`, role: 'assistant', content: '复制失败，请手动复制地址栏链接。' }]);
                      });
                      setMoreMenuOpen(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Link2 size={16} /> 复制链接
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMessages(candidate
                        ? [{ id: 'welcome', role: 'assistant', content: `你好！我是${candidate.name}的简历助手。你可以问我关于 TA 的项目经验、专业技能、学历与求职意向或工作经历。` }]
                        : [{ id: 'welcome', role: 'assistant', content: '请选择或添加一份简历，即可开始对话。' }]);
                      setMoreMenuOpen(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Trash2 size={16} /> 清空当前对话
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Chat Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 hide-scrollbar">
          {/* Suggestion Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {SUGGESTIONS.map((s) => (
              <button 
                key={s.id}
                onClick={() => handleSendMessage(s.label)}
                className="group flex flex-col items-center gap-2 p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all"
              >
                <div className={`size-10 rounded-full ${s.bgColor} flex items-center justify-center ${s.color} group-hover:scale-110 transition-transform`}>
                  <s.icon size={20} />
                </div>
                <span className="text-xs font-semibold text-slate-700">{s.label}</span>
              </button>
            ))}
          </div>

          {/* Chat Bubbles */}
          <div className="flex flex-col gap-6">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div 
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-start gap-3`}
                >
                  {msg.role === 'assistant' && (
                    <div className="size-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                      <Bot size={18} />
                    </div>
                  )}
                  
                  <div className={`max-w-[85%] ${msg.role === 'user' ? 'w-auto' : 'w-full'}`}>
                    <div className={`px-4 py-3 rounded-2xl shadow-sm ${
                      msg.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-tr-none' 
                        : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none'
                    }`}>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>

                    {(msg.projects?.length ? msg.projects : msg.project ? [msg.project] : []).map((proj) => (
                      <motion.div
                        key={proj.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mt-3 bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden"
                      >
                        <div className="p-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-slate-900">{proj.title}</h3>
                            {proj.impact && String(proj.impact).toUpperCase() !== 'N/A' && (
                              <span className="bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                <TrendingUp size={12} /> {proj.impact}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {proj.tags.map(tag => (
                              <span key={tag} className="px-2 py-1 bg-slate-50 text-[10px] font-bold text-slate-500 rounded uppercase">{tag}</span>
                            ))}
                          </div>
                          <p className="text-sm text-slate-500 leading-relaxed">
                            {proj.description}
                          </p>
                          {proj.imageUrl && (
                            <div className="h-40 w-full rounded-xl bg-slate-50 overflow-hidden">
                              <img 
                                src={proj.imageUrl} 
                                alt={proj.title} 
                                className="w-full h-full object-cover opacity-90"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          )}
                          <a
                            href={proj.docUrl || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-2.5 bg-slate-50 text-blue-600 text-xs font-bold rounded-xl hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 border border-transparent hover:border-slate-200"
                          >
                            查看完整项目文档 <ExternalLink size={14} />
                          </a>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {msg.role === 'user' && (
                    <div className="size-8 rounded-full bg-slate-200 overflow-hidden shrink-0">
                      <div className="w-full h-full bg-blue-100 flex items-center justify-center text-blue-600">
                        <User size={18} />
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
              {isTyping && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start items-center gap-3"
                >
                  <div className="size-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                    <Bot size={18} />
                  </div>
                  <div className="flex gap-1">
                    <span className="size-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="size-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="size-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Input Box */}
        <div className="p-6 pt-2 shrink-0">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSendMessage(inputValue); }}
            className="relative flex items-center bg-slate-50 rounded-2xl border border-slate-200 p-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-400 transition-all"
          >
            <button
              type="button"
              onClick={toggleVoiceInput}
              title={isRecording ? '停止语音输入' : '语音输入'}
              className={`p-2 rounded-lg transition-colors ${isRecording ? 'bg-red-100 text-red-600' : 'text-slate-400 hover:text-blue-600'}`}
            >
              {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
            <input 
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 px-2 text-slate-700 placeholder:text-slate-400" 
              placeholder={candidate ? `向${candidate.name}提问...` : '请先选择简历'}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
            <button 
              type="submit"
              disabled={!inputValue.trim() || isTyping || !currentResumeId}
              className="size-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-md hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </main>

      {/* Right Column: Resume Snapshot */}
      <aside className="hidden lg:flex flex-col shrink-0 w-[340px] max-w-[360px] bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-200/60 overflow-hidden">
        {!candidate ? (
          <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-500">
            <div>
              <p className="font-semibold mb-1">暂无简历</p>
              <p className="text-sm mb-4">点击左上角「选择简历」或「添加简历」开始</p>
              <button
                type="button"
                onClick={() => setAddModalOpen(true)}
                className="text-blue-600 font-semibold text-sm flex items-center justify-center gap-1 mx-auto"
              >
                <Plus size={18} /> 添加简历
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* 右侧栏：分区清晰，留白适中 */}
            <div className="shrink-0 px-6 pt-6 pb-5 text-center border-b border-slate-100/80">
              <div className="relative inline-block mb-4">
                <div className="size-16 rounded-full border-2 border-slate-200 overflow-hidden bg-slate-50 mx-auto flex items-center justify-center">
                  {candidate.avatarUrl ? (
                    <img src={candidate.avatarUrl} alt={candidate.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : null}
                </div>
                {candidate.avatarUrl && <div className="absolute bottom-0 right-0 size-3 bg-emerald-500 border-2 border-white rounded-full" />}
              </div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">{candidate.name}</h2>
              {(candidate.highestDegree || candidate.degreeSchool) && (
                <p className="mt-2 text-slate-600 text-xs">
                  {[candidate.highestDegree, candidate.degreeSchool].filter(Boolean).join(' · ')}
                </p>
              )}
              {candidate.title ? (
                <p className="mt-1.5 text-blue-600 font-semibold text-sm">{candidate.title}</p>
              ) : null}
              {candidate.location ? (
                <div className="mt-2.5 flex items-center justify-center gap-1 text-slate-500 text-xs">
                  <MapPin size={12} className="shrink-0" /> <span>{candidate.location}</span>
                </div>
              ) : null}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-6 space-y-7 hide-scrollbar">
              <section className="space-y-4">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">专业技能</h3>
                <div className="flex flex-wrap gap-2.5">
                  {(candidate.skills || []).map((skill) => (
                    <span key={skill} className="px-3 py-1.5 text-[11px] font-medium rounded-lg bg-slate-100 text-slate-600">
                      {skill}
                    </span>
                  ))}
                </div>
              </section>
              <section className="p-5 rounded-xl bg-slate-50/90 border border-slate-100 space-y-4">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">能力评估</h3>
                <div className="space-y-4">
                  {(candidate.capabilities || []).map((cap) => (
                    <div key={cap.name}>
                      <div className="flex justify-between items-baseline mb-1.5">
                        <span className="text-xs font-medium text-slate-700">{cap.name}</span>
                        <span className="text-xs font-semibold text-blue-600 tabular-nums">{cap.level}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${cap.level}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} className="h-full bg-blue-500 rounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </>
        )}

        {candidate && (
          <div className="shrink-0 p-5 pt-4 border-t border-slate-100 bg-white">
            <button
              type="button"
              onClick={async () => {
                if (!currentResumeId) return;
                try {
                  await downloadResumePdf(currentResumeId, `${candidate?.name ?? '简历'}-简历.pdf`);
                } catch (e) {
                  const msg = e instanceof Error ? e.message : '';
                  setMessages((prev) => [...prev, { id: `dl-${Date.now()}`, role: 'assistant', content: msg || '下载失败，请重试。' }]);
                }
              }}
              className="w-full py-2.5 bg-blue-600 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors shadow-sm"
            >
              <FileText size={16} /> 下载 PDF 简历
            </button>
          </div>
        )}
      </aside>

      {addModalOpen && (
        <AddResumeModal
          onClose={() => setAddModalOpen(false)}
          onSaved={handleAddResumeSaved}
        />
      )}
    </div>
  </div>
  );
}
