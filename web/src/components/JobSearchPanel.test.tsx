import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import JobSearchPanel from './JobSearchPanel';
import { extractResumeText, fetchBossCollectorScript, importJobs, startJobSearch } from '../api';

vi.mock('../api', () => ({
  extractResumeText: vi.fn(),
  fetchBossCollectorScript: vi.fn(),
  importJobs: vi.fn(),
  startJobSearch: vi.fn()
}));

const mockedExtractResumeText = vi.mocked(extractResumeText);
const mockedFetchBossCollectorScript = vi.mocked(fetchBossCollectorScript);
const mockedImportJobs = vi.mocked(importJobs);
const mockedStartJobSearch = vi.mocked(startJobSearch);

describe('JobSearchPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders smart role input and nationwide province-city-district fields', () => {
    render(<JobSearchPanel onSearchStarted={vi.fn()} />);

    expect(screen.getByLabelText('技术细节 / 想找方向')).toBeInTheDocument();
    expect(screen.getByLabelText('省份')).toBeInTheDocument();
    expect(screen.getByLabelText('城市')).toBeInTheDocument();
    expect(screen.getByLabelText('区/县')).toBeInTheDocument();
    expect(screen.getByLabelText('岗位类型')).toBeInTheDocument();
    expect(screen.getByLabelText('经验要求')).toBeInTheDocument();
    expect(screen.getByLabelText('最大数量')).toBeInTheDocument();
    expect(screen.getByLabelText('我的简历 / 能力画像')).toBeInTheDocument();
    expect(screen.getByText('稳定岗位源 + 免费本地分析')).toBeInTheDocument();
    expect(screen.getByText(/boss-collector-extension/)).toBeInTheDocument();
    expect(screen.queryByText(/不要求岗位标题逐字包含输入内容/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('智能生成搜索方向')).toHaveTextContent('AI Agent');
    expect(screen.getByRole('button', { name: /生成岗位列表/i })).toBeInTheDocument();
  });

  test('submits smart search direction and selected nationwide location', async () => {
    const onSearchStarted = vi.fn();
    mockedStartJobSearch.mockResolvedValueOnce({
      search_id: 'job_search_20260701_120000',
      status: 'Job search completed'
    });

    render(<JobSearchPanel onSearchStarted={onSearchStarted} />);

    fireEvent.change(screen.getByLabelText('技术细节 / 想找方向'), {
      target: { value: 'python+agent' }
    });
    fireEvent.change(screen.getByLabelText('区/县'), {
      target: { value: '420111' }
    });
    fireEvent.change(screen.getByLabelText('最大数量'), {
      target: { value: '3' }
    });

    fireEvent.click(screen.getByRole('button', { name: /生成岗位列表/i }));

    await waitFor(() => {
      expect(mockedStartJobSearch).toHaveBeenCalledWith({
        keywords: 'AI Agent LLM应用 RAG Python FastAPI 数据处理 实习 初级',
        locations: ['武汉 洪山区'],
        job_type: 'internship',
        experience_level: 'entry-level',
        max_jobs: 3,
        scrapers: ['boss'],
        candidate_profile: expect.stringContaining('大三计算机科学与技术')
      });
    });

    expect(await screen.findByText(/筛选完成，用时/)).toBeInTheDocument();
    expect(onSearchStarted).toHaveBeenCalledWith('job_search_20260701_120000');
  });

  test('resets city and district when province changes', () => {
    render(<JobSearchPanel onSearchStarted={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('省份'), {
      target: { value: '440000' }
    });

    expect(screen.getByLabelText('城市')).toHaveValue('440100');
    expect(screen.getByLabelText('区/县')).toHaveValue('none');
    expect(screen.getByRole('option', { name: '深圳市' })).toBeInTheDocument();
  });

  test('uploads a Word resume and fills the candidate profile', async () => {
    mockedExtractResumeText.mockResolvedValueOnce('项目经历：Python Agent 求职助手');
    render(<JobSearchPanel onSearchStarted={vi.fn()} />);

    const file = new File(['fake-docx'], 'resume.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });

    fireEvent.change(screen.getByLabelText(/上传 Word 简历/), {
      target: { files: [file] }
    });

    await waitFor(() => {
      expect(mockedExtractResumeText).toHaveBeenCalledWith(file);
      expect(screen.getByLabelText('我的简历 / 能力画像')).toHaveValue('项目经历：Python Agent 求职助手');
    });
  });

  test('imports real jobs pasted from a browser collector', async () => {
    const onSearchStarted = vi.fn();
    mockedImportJobs.mockResolvedValueOnce({
      search_id: 'job_import_20260702_120000',
      status: 'Imported jobs saved',
      job_count: 1
    });

    render(<JobSearchPanel onSearchStarted={onSearchStarted} />);

    fireEvent.change(screen.getByLabelText('真实岗位 JSON'), {
      target: {
        value: JSON.stringify([
          {
            name: 'Python开发实习生',
            company: '武汉云简科技',
            location: '武汉 江夏区',
            salary: '150-200元/天',
            link: 'https://www.zhipin.com/job_detail/abc.html'
          }
        ])
      }
    });

    fireEvent.click(screen.getByRole('button', { name: /导入真实岗位/i }));

    await waitFor(() => {
      expect(mockedImportJobs).toHaveBeenCalledWith(
        expect.objectContaining({
          jobs: [
            expect.objectContaining({
              name: 'Python开发实习生',
              company: '武汉云简科技'
            })
          ]
        })
      );
    });
    expect(onSearchStarted).toHaveBeenCalledWith('job_import_20260702_120000');
  });

  test('copies the BOSS page collector script from the search console', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true
    });
    mockedFetchBossCollectorScript.mockResolvedValueOnce('(() => fetch("/imports/jobs"))();');

    render(<JobSearchPanel onSearchStarted={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /复制 BOSS 采集脚本/i }));

    await waitFor(() => {
      expect(mockedFetchBossCollectorScript).toHaveBeenCalled();
      expect(writeText).toHaveBeenCalledWith('(() => fetch("/imports/jobs"))();');
    });
    expect(await screen.findByText(/已复制 BOSS 采集脚本/)).toBeInTheDocument();
  });
});
