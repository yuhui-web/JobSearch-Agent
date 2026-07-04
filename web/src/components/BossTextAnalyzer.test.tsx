import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import BossTextAnalyzer from './BossTextAnalyzer';
import { analyzeCareerFit, extractResumeText } from '../api';

vi.mock('../api', () => ({
  analyzeCareerFit: vi.fn(),
  extractResumeText: vi.fn()
}));

const mockedAnalyzeCareerFit = vi.mocked(analyzeCareerFit);
const mockedExtractResumeText = vi.mocked(extractResumeText);

describe('BossTextAnalyzer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('analyzes resume first and recommends suitable companies with learning gaps', async () => {
    mockedAnalyzeCareerFit.mockResolvedValueOnce({
      target_role: 'Java实习',
      location: '武汉',
      job_type: 'internship',
      experience_level: 'entry-level',
      recommended_jobs: [
        {
          job_title: 'Java开发实习生',
          company_name: '准星科技',
          job_location: '武汉',
          salary: '100-150元/天',
          source: 'observed_boss'
        }
      ],
      market_trends: {
        total_jobs: 1,
        summary: '市场最近更关注 Java，主要集中在 武汉。',
        keywords: [{ name: 'Java', count: 1 }],
        cities: [{ name: '武汉', count: 1 }],
        salary_ranges: [{ name: '100-150元/天', count: 1 }],
        company_types: [{ name: '软件服务', count: 1 }]
      },
      career_analysis: {
        summary: '更适合 Java 后端实习。',
        market_trends: {
          total_jobs: 1,
          summary: '市场最近更关注 Java，主要集中在 武汉。',
          keywords: [{ name: 'Java', count: 1 }],
          cities: [{ name: '武汉', count: 1 }],
          salary_ranges: [{ name: '100-150元/天', count: 1 }],
          company_types: [{ name: '软件服务', count: 1 }]
        },
        best_fit_roles: ['Java开发实习生'],
        skill_gaps: ['SpringBoot 项目深度'],
        experience_gaps: ['缺少 3 个月以上实习经历'],
        resume_fixes: ['把 Java/MySQL 项目放到简历前半部分'],
        learning_plan: [
          {
            topic: 'SpringBoot + MyBatis 项目',
            why: '多数 Java 实习任职要求会出现',
            platform_keywords: {
              bilibili: 'SpringBoot MyBatis 实战 项目',
              baidu: 'Java 实习 SpringBoot 任职要求',
              douyin: 'Java实习项目 SpringBoot',
              xiaohongshu: 'Java实习 简历 项目'
            }
          }
        ],
        hot_requirements: ['Java 基础', 'MySQL', 'SpringBoot'],
        next_actions: ['先补一个 SpringBoot CRUD 项目']
      }
    });

    render(<BossTextAnalyzer />);

    expect(screen.getByRole('heading', { name: '简历岗位匹配分析' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('技术细节 / 想找方向'), {
      target: { value: 'Java实习' }
    });
    fireEvent.change(screen.getByLabelText('我的简历 / 能力画像'), {
      target: { value: '大三计科，学过 Java、MySQL、Vue。' }
    });
    fireEvent.change(screen.getByLabelText('岗位任职要求样本（可选）'), {
      target: { value: '要求 Java 基础、MySQL、SpringBoot。' }
    });

    fireEvent.click(screen.getByRole('button', { name: '分析适合我的岗位' }));

    await waitFor(() => {
      expect(mockedAnalyzeCareerFit).toHaveBeenCalledWith({
        candidate_profile: '大三计科，学过 Java、MySQL、Vue。',
        target_role: 'Java Spring Boot 后端 实习 初级',
        location: '武汉 东西湖区',
        job_type: 'internship',
        experience_level: 'entry-level',
        requirement_text: '要求 Java 基础、MySQL、SpringBoot。',
        max_recommendations: 15
      });
    });

    expect(await screen.findByText('准星科技')).toBeInTheDocument();
    expect(screen.getByText('岗位趋势雷达')).toBeInTheDocument();
    expect(screen.getByText('市场最近更关注 Java，主要集中在 武汉。')).toBeInTheDocument();
    expect(screen.getByText('软件服务')).toBeInTheDocument();
    expect(screen.getByText('SpringBoot 项目深度')).toBeInTheDocument();
    expect(screen.getByText(/SpringBoot MyBatis 实战 项目/)).toBeInTheDocument();
  });

  test('renders learning roadmap as a mind map after analysis', async () => {
    mockedAnalyzeCareerFit.mockResolvedValueOnce({
      target_role: 'Python internship',
      location: 'Wuhan',
      job_type: 'internship',
      experience_level: 'entry-level',
      recommended_jobs: [],
      market_trends: {
        total_jobs: 0,
        summary: '还没有真实岗位样本，无法形成可靠市场趋势。',
        keywords: [],
        cities: [],
        salary_ranges: [],
        company_types: []
      },
      career_analysis: {
        summary: 'Python fit report',
        best_fit_roles: ['Python intern'],
        skill_gaps: ['crawler basics'],
        experience_gaps: ['real Python project'],
        resume_fixes: ['add Python project'],
        learning_plan: [
          {
            topic: 'Python crawler',
            why: 'Needed by data collection roles',
            platform_keywords: {
              bilibili: 'Python crawler tutorial',
              baidu: 'Python requests beautifulsoup',
              douyin: 'Python crawler practice',
              xiaohongshu: 'Python crawler notes'
            }
          }
        ],
        hot_requirements: ['Python'],
        next_actions: ['Build a crawler demo']
      }
    });

    render(<BossTextAnalyzer />);
    fireEvent.click(screen.getByRole('button', { name: /分析适合我的岗位/ }));

    expect(await screen.findByText('学习路线思维导图')).toBeInTheDocument();
    expect(screen.getByText('Python crawler')).toBeInTheDocument();
    expect(screen.getByText(/Python crawler tutorial/)).toBeInTheDocument();
  });

  test('uploads a Word resume before running career analysis', async () => {
    mockedExtractResumeText.mockResolvedValueOnce('大三计科，做过 Java 后端项目。');
    render(<BossTextAnalyzer />);

    const file = new File(['fake-docx'], 'resume.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
    fireEvent.change(screen.getByLabelText(/上传 Word 简历/), {
      target: { files: [file] }
    });

    await waitFor(() => {
      expect(mockedExtractResumeText).toHaveBeenCalledWith(file);
      expect(screen.getByLabelText('我的简历 / 能力画像')).toHaveValue(
        '大三计科，做过 Java 后端项目。'
      );
    });
  });
});
