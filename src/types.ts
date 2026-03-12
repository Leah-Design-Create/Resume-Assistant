import { LucideIcon } from 'lucide-react';

export interface Project {
  id: string;
  title: string;
  description: string;
  tags: string[];
  impact: string;
  imageUrl: string;
  docUrl: string;
}

export interface Skill {
  name: string;
  level: number;
}

export interface Candidate {
  name: string;
  title: string; // 求职意向
  highestDegree?: string; // 最高学历，如 硕士、本科
  degreeSchool?: string; // 最高学历毕业学校
  location: string;
  experienceYears: string;
  coreProjects: number;
  deliveryRate: string;
  skills: string[];
  capabilities: Skill[];
  avatarUrl: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  project?: Project;
  /** 项目经验时返回全部项目列表 */
  projects?: Project[];
}

export interface Suggestion {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
}
