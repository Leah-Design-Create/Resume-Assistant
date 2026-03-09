/**
 * 后端数据：候选人与项目（与前端 types 对齐）
 */
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
  highestDegree?: string;
  degreeSchool?: string;
  location: string;
  experienceYears: string;
  coreProjects: number;
  deliveryRate: string;
  skills: string[];
  capabilities: Skill[];
  avatarUrl: string;
}

export const CANDIDATE_DATA: Candidate = {
  name: "张三",
  title: "高级全栈开发工程师",
  highestDegree: "本科",
  degreeSchool: "某某大学",
  location: "上海 · 浦东",
  experienceYears: "8+",
  coreProjects: 6,
  deliveryRate: "100%",
  skills: ["React / Vue3", "Python (Django)", "Node.js", "Docker", "Kubernetes", "AWS Cloud"],
  capabilities: [
    { name: "前端架构", level: 92 },
    { name: "后端工程化", level: 88 },
    { name: "产品思维", level: 85 }
  ],
  avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=256&h=256&auto=format&fit=crop"
};

export const PROJECTS: Project[] = [
  {
    id: "supply-chain",
    title: "智能供应链中台系统",
    description: "负责核心微服务架构设计，通过异步任务队列优化，成功将订单处理吞吐量提升 35%，响应时间降低至 200ms 以内。",
    tags: ["Python", "React", "FastAPI", "Redis"],
    impact: "35%",
    imageUrl: "https://images.unsplash.com/photo-1586769852836-bc069f19e1b6?q=80&w=800&auto=format&fit=crop",
    docUrl: "#"
  }
];
