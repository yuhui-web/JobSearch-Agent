import axios from 'axios';

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8011';
export const API_KEY =
  import.meta.env.VITE_API_KEY ?? 'dev-local-only-change-me';
export const API_WS_URL = API_BASE_URL.replace(/^http/, 'ws');

export interface InterviewLog {
  id: number;
  job_id?: number | null;
  job_title: string;
  company_name: string;
  interview_date?: string | null;
  outcome: string;
  failure_reason?: string | null;
  notes?: string | null;
  next_action?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface InterviewLogStats {
  total_logs: number;
  by_outcome: Record<string, number>;
  top_failure_reasons: Array<{
    failure_reason: string;
    count: number;
  }>;
}

export interface InterviewLogListResult {
  logs: InterviewLog[];
  count: number;
}

export interface FetchInterviewLogsParams {
  limit?: number;
  offset?: number;
  company_name?: string;
  outcome?: string;
  job_id?: number;
}

export interface CreateInterviewLogInput {
  job_id?: number;
  job_title: string;
  company_name: string;
  interview_date?: string;
  outcome: string;
  failure_reason?: string;
  notes?: string;
  next_action?: string;
}

export type CreateInterviewLogResult = InterviewLog | { id: number };

export interface JobSearchInput {
  keywords: string;
  locations: string[];
  job_type: string;
  experience_level: string;
  max_jobs: number;
  scrapers: string[];
  candidate_profile?: string;
}

export interface JobSearchStartResult {
  search_id: string;
  status: string;
  job_count?: number;
}

export interface BossMonitorInput extends JobSearchInput {
  interval_seconds: number;
}

export interface BossMonitorStatus {
  running: boolean;
  keywords: string;
  locations: string[];
  job_type: string;
  experience_level: string;
  max_jobs: number;
  scrapers: string[];
  interval_seconds: number;
  last_search_id?: string | null;
  last_job_count: number;
  last_run_at?: string | null;
  last_error?: string | null;
}

export interface ImportedJobInput {
  job_title?: string;
  title?: string;
  name?: string;
  company_name?: string;
  company?: string;
  location?: string;
  job_location?: string;
  salary?: string;
  source_url?: string;
  link?: string;
  tags?: string[];
  job_description?: string;
}

export interface ImportJobsInput {
  jobs: ImportedJobInput[];
  keywords?: string;
  locations?: string[];
  job_type?: string;
  experience_level?: string;
  max_jobs?: number;
  candidate_profile?: string;
  source?: string;
}

export interface SearchHistoryItem {
  search_id: string;
  keywords: string;
  locations: string[];
  job_type: string;
  experience_level: string;
  max_jobs?: number;
  scrapers?: string[];
  status: string;
  job_count?: number;
  has_results?: boolean;
  created_at?: string;
  timestamp?: string;
}

export interface SearchResultJob {
  id?: number;
  job_title?: string;
  company_name?: string;
  job_location?: string;
  salary?: string;
  job_description?: string;
  source_url?: string;
  amap_company_url?: string;
  apply_info?: string;
  source?: string;
  link_status?: 'verified_detail' | 'needs_verification' | string;
  ai_analysis?: {
    provider?: string;
    status?: string;
    match_score?: number | null;
    summary?: string;
    recommendation?: string;
    skill_gaps?: string[];
    resume_tips?: string[];
    resume_rewrite_bullets?: string[];
    self_introduction?: string;
    interview_questions?: string[];
  };
}

export interface DeleteSearchHistoryResult {
  success: boolean;
  deleted: number;
  removed_files?: number;
}

export interface AnalyzeBossTextInput {
  job_text: string;
  source_url?: string;
  candidate_profile?: string;
}

export interface CareerAnalyzeInput {
  candidate_profile: string;
  target_role: string;
  location: string;
  job_type: string;
  experience_level: string;
  requirement_text?: string;
  max_recommendations: number;
}

export interface CareerLearningPlanItem {
  topic: string;
  why: string;
  platform_keywords: {
    bilibili: string;
    baidu: string;
    douyin: string;
    xiaohongshu: string;
  };
}

export interface TrendBucket {
  name: string;
  count: number;
}

export interface JobMarketTrends {
  total_jobs: number;
  summary: string;
  keywords: TrendBucket[];
  cities: TrendBucket[];
  salary_ranges: TrendBucket[];
  company_types: TrendBucket[];
}

export interface CareerAnalysis {
  provider?: string;
  status?: string;
  summary: string;
  market_trends?: JobMarketTrends;
  best_fit_roles: string[];
  skill_gaps: string[];
  experience_gaps: string[];
  resume_fixes: string[];
  learning_plan: CareerLearningPlanItem[];
  hot_requirements: string[];
  next_actions: string[];
}

export interface CareerAnalyzeResult {
  target_role: string;
  location: string;
  job_type: string;
  experience_level: string;
  recommended_jobs: SearchResultJob[];
  market_trends?: JobMarketTrends;
  career_analysis: CareerAnalysis;
}

export interface ResumeExtractResult {
  text: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  count?: number;
}

function buildUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

export async function fetchInterviewLogs(
  params: FetchInterviewLogsParams = {}
): Promise<InterviewLogListResult> {
  const response = await axios.get<ApiEnvelope<InterviewLog[]>>(
    buildUrl('/interview-logs'),
    {
      params
    }
  );
  const { data, count } = response.data;

  return {
    logs: data,
    count: count ?? data.length
  };
}

export async function fetchInterviewStats(): Promise<InterviewLogStats> {
  const response = await axios.get<ApiEnvelope<InterviewLogStats>>(
    buildUrl('/interview-logs/stats')
  );

  return response.data.data;
}

export async function createInterviewLog(
  payload: CreateInterviewLogInput
): Promise<CreateInterviewLogResult> {
  const response = await axios.post<ApiEnvelope<InterviewLog>>(
    buildUrl('/interview-logs'),
    payload
  );

  return response.data.data;
}

export async function startJobSearch(
  payload: JobSearchInput
): Promise<JobSearchStartResult> {
  const response = await axios.post<JobSearchStartResult>(
    buildUrl('/search'),
    payload,
    {
      headers: {
        'X-API-Key': API_KEY
      }
    }
  );

  return response.data;
}

export async function importJobs(
  payload: ImportJobsInput
): Promise<JobSearchStartResult> {
  const response = await axios.post<JobSearchStartResult>(
    buildUrl('/imports/jobs'),
    payload
  );

  return response.data;
}

export async function fetchBossCollectorScript(): Promise<string> {
  const response = await axios.get<string>(
    buildUrl('/imports/boss-collector.js'),
    { responseType: 'text' }
  );

  return response.data;
}

export async function fetchBossMonitorStatus(): Promise<BossMonitorStatus> {
  const response = await axios.get<BossMonitorStatus>(
    buildUrl('/boss/monitor/status')
  );

  return response.data;
}

export async function startBossMonitor(
  payload: BossMonitorInput
): Promise<BossMonitorStatus> {
  const response = await axios.post<BossMonitorStatus>(
    buildUrl('/boss/monitor/start'),
    payload,
    {
      headers: {
        'X-API-Key': API_KEY
      }
    }
  );

  return response.data;
}

export async function stopBossMonitor(): Promise<BossMonitorStatus> {
  const response = await axios.post<BossMonitorStatus>(
    buildUrl('/boss/monitor/stop'),
    {},
    {
      headers: {
        'X-API-Key': API_KEY
      }
    }
  );

  return response.data;
}

export async function fetchSearchHistory(
  params: { limit?: number } = {}
): Promise<SearchHistoryItem[]> {
  const response = await axios.get<{ searches: SearchHistoryItem[] }>(
    buildUrl('/search/history'),
    {
      params
    }
  );

  return response.data.searches;
}

export async function fetchSearchResults(
  searchId: string
): Promise<SearchResultJob[]> {
  const response = await axios.get<SearchResultJob[]>(
    buildUrl(`/search/${searchId}`)
  );

  return Array.isArray(response.data) ? response.data : [];
}

export async function deleteSearchHistory(searchId: string): Promise<DeleteSearchHistoryResult> {
  const response = await axios.delete<DeleteSearchHistoryResult>(
    buildUrl(`/search/history/${searchId}`)
  );

  return response.data;
}

export async function clearSearchHistory(): Promise<DeleteSearchHistoryResult> {
  const response = await axios.delete<DeleteSearchHistoryResult>(
    buildUrl('/search/history')
  );

  return response.data;
}

export async function analyzeBossText(
  payload: AnalyzeBossTextInput
): Promise<SearchResultJob> {
  const response = await axios.post<ApiEnvelope<SearchResultJob>>(
    buildUrl('/boss/analyze-text'),
    payload
  );

  return response.data.data;
}

export async function analyzeCareerFit(
  payload: CareerAnalyzeInput
): Promise<CareerAnalyzeResult> {
  const response = await axios.post<ApiEnvelope<CareerAnalyzeResult>>(
    buildUrl('/career/analyze'),
    payload
  );

  return response.data.data;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export async function extractResumeText(file: File): Promise<string> {
  const response = await axios.post<ApiEnvelope<ResumeExtractResult>>(
    buildUrl('/resume/extract'),
    {
      file_name: file.name,
      content_base64: arrayBufferToBase64(await file.arrayBuffer())
    }
  );

  return response.data.data.text;
}
