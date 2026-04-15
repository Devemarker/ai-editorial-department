// LLM 类型
export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface LLMResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMProvider {
  complete(prompt: string, options?: LLMOptions): Promise<LLMResponse>;
  embed(texts: string[]): Promise<number[][]>;
}

// 智能体消息类型
export interface AgentMessage {
  id: string;
  agent: string;
  type: string;
  content: string;
  timestamp: number;
}

// 章节类型
export interface Chapter {
  id: string;
  number: number;
  title: string;
  content: string;
  status: 'draft' | 'edited' | 'proofread' | 'approved';
  createdAt: number;
  updatedAt: number;
}

// 人物状态类型
export interface CharacterState {
  id: string;
  name: string;
  description: string;
  currentState: string;
  relationships: Record<string, string>;
  createdAt: number;
  updatedAt: number;
}

// 事件时间线
export interface StoryEvent {
  id: string;
  chapterId: string;
  description: string;
  timestampInStory: number;
  createdAt: number;
}

// 世界观规则
export interface WorldRule {
  id: string;
  rule: string;
  description: string;
  createdAt: number;
}

// 记忆检索结果
export interface MemorySearchResult {
  characters: CharacterState[];
  events: StoryEvent[];
  worldKnowledge: WorldKnowledgeItem[];
}

export interface WorldKnowledgeItem {
  id: string;
  content: string;
  metadata: Record<string, string>;
}

// 人物创建/更新 DTO
export interface CreateCharacterInput {
  name: string;
  description?: string;
  currentState?: string;
  relationships?: Record<string, string>;
}

export interface UpdateCharacterInput {
  description?: string;
  currentState?: string;
  relationships?: Record<string, string>;
}

// 事件创建 DTO
export interface CreateEventInput {
  chapterId: string;
  description: string;
  timestampInStory?: number;
}

// 项目输入
export interface ProjectInput {
  title: string;
  genre?: string;
  outline: string;
  characters: CreateCharacterInput[];
  worldSetting?: string;
}

// 章节规划
export interface ChapterPlan {
  number: number;
  title: string;
  keyPoints: string[];
  characterStates: Record<string, string>;
}

// 智能体结果
export interface AgentResult {
  success: boolean;
  content?: string;
  error?: string;
}

// 章节生成结果
export interface ChapterDraft {
  chapterId: string;
  number: number;
  title: string;
  content: string;
  plan: ChapterPlan;
}

// 流水线状态
export type PipelineStatus =
  | 'pending'
  | 'writing'
  | 'editing'
  | 'proofreading'
  | 'approved'
  | 'rejected';

// 流水线任务
export interface PipelineTask {
  id: string;
  chapterNumber: number;
  status: PipelineStatus;
  chapterId?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

// 流水线事件
export type PipelineEvent =
  | { type: 'task:created'; taskId: string; chapterNumber: number }
  | { type: 'task:writing'; taskId: string }
  | { type: 'task:written'; taskId: string; chapterId: string }
  | { type: 'task:editing'; taskId: string }
  | { type: 'task:edited'; taskId: string }
  | { type: 'task:proofreading'; taskId: string }
  | { type: 'task:proofread'; taskId: string }
  | { type: 'task:approved'; taskId: string }
  | { type: 'task:rejected'; taskId: string; reason: string }
  | { type: 'task:error'; taskId: string; error: string };

// 流水线配置
export interface PipelineConfig {
  autoWriting: boolean;
  autoEditing: boolean;
  autoProofreading: boolean;
  requireApproval: boolean;
}

// 检测问题类型
export type IssueType = 'character_conflict' | 'world_rule_violation' | 'plot_repetition';

// 检测问题严重程度
export type IssueSeverity = 'critical' | 'major' | 'minor';

// 检测问题
export interface QualityIssue {
  id: string;
  type: IssueType;
  severity: IssueSeverity;
  description: string;
  chapterId?: string;
  relatedContent?: string;
  suggestedFix?: string;
  createdAt: number;
}

// 检测报告
export interface QualityReport {
  id: string;
  checkpointNumber: number;
  totalChapters: number;
  issues: QualityIssue[];
  characterConsistency: number; // 0-100
  worldRuleCompliance: number; // 0-100
  plotUniqueness: number; // 0-100
  overallScore: number; // 0-100
  passed: boolean;
  createdAt: number;
}

// 检测配置
export interface QualityConfig {
  checkpointInterval: number; // 默认 5
  autoFix: boolean;
  requireHumanReview: boolean;
}

// 内容编辑结果
export interface ContentEditResult {
  chapterId: string;
  originalContent: string;
  editedContent: string;
  changes: ContentChange[];
  feedback?: string;
}

// 内容变更
export interface ContentChange {
  type: 'structure' | 'logic' | 'rhythm' | 'coherence';
  original: string;
  edited: string;
  reason: string;
}

// 校对润色结果
export interface ProofreadResult {
  chapterId: string;
  originalContent: string;
  polishedContent: string;
  corrections: ProofreadCorrection[];
}

// 校对修正
export interface ProofreadCorrection {
  type: 'grammar' | 'punctuation' | 'spelling' | 'style';
  original: string;
  corrected: string;
  reason: string;
}

// 故事架构建议
export interface StoryArchitectResult {
  chapterNumber: number;
  plotSuggestions: PlotSuggestion[];
  rhythmAnalysis?: RhythmAnalysis;
}

// 情节建议
export interface PlotSuggestion {
  type: 'add' | 'remove' | 'modify';
  description: string;
  reason: string;
}

// 节奏分析
export interface RhythmAnalysis {
  pacing: 'slow' | 'moderate' | 'fast';
  tension: 'low' | 'medium' | 'high';
  suggestions: string[];
}
