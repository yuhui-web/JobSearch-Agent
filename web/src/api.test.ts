import axios from 'axios';
import { describe, expect, test, vi } from 'vitest';

import {
  API_BASE_URL,
  API_KEY,
  createInterviewLog,
  clearSearchHistory,
  deleteSearchHistory,
  fetchSearchHistory,
  fetchSearchResults,
  fetchInterviewLogs,
  fetchInterviewStats,
  fetchBossCollectorScript,
  importJobs,
  analyzeBossText,
  analyzeCareerFit,
  extractResumeText,
  fetchBossMonitorStatus,
  startBossMonitor,
  stopBossMonitor,
  startJobSearch
} from './api';

vi.mock('axios');

const mockedAxiosGet = vi.mocked(axios.get);
const mockedAxiosPost = vi.mocked(axios.post);
const mockedAxiosDelete = vi.mocked(axios.delete);
const authHeaders = {
  headers: {
    'X-API-Key': API_KEY
  }
};

describe('interview log api helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('fetchInterviewLogs requests the interview logs endpoint and unwraps data', async () => {
    mockedAxiosGet.mockResolvedValueOnce({
      data: {
        success: true,
        data: [
          {
            id: 1,
            job_title: 'Python Intern',
            company_name: 'Example Inc',
            outcome: 'rejected'
          }
        ],
        count: 1
      }
    });

    await expect(
      fetchInterviewLogs({ company_name: 'Example', limit: 25 })
    ).resolves.toEqual({
      logs: [
        {
          id: 1,
          job_title: 'Python Intern',
          company_name: 'Example Inc',
          outcome: 'rejected'
        }
      ],
      count: 1
    });

    expect(mockedAxiosGet).toHaveBeenCalledTimes(1);
    expect(mockedAxiosGet).toHaveBeenCalledWith(
      `${API_BASE_URL}/interview-logs`,
      {
        params: {
          company_name: 'Example',
          limit: 25
        },
        ...authHeaders
      }
    );
  });

  test('fetchInterviewStats requests the interview stats endpoint and unwraps data', async () => {
    mockedAxiosGet.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          total_logs: 2,
          by_outcome: {
            rejected: 1,
            passed: 1
          },
          top_failure_reasons: [
            {
              failure_reason: 'base_python',
              count: 1
            }
          ]
        }
      }
    });

    await expect(fetchInterviewStats()).resolves.toEqual({
      total_logs: 2,
      by_outcome: {
        rejected: 1,
        passed: 1
      },
      top_failure_reasons: [
        {
          failure_reason: 'base_python',
          count: 1
        }
      ]
    });

    expect(mockedAxiosGet).toHaveBeenCalledTimes(1);
    expect(mockedAxiosGet).toHaveBeenCalledWith(
      `${API_BASE_URL}/interview-logs/stats`,
      authHeaders
    );
  });

  test('createInterviewLog posts to the interview logs endpoint and unwraps data', async () => {
    const payload = {
      job_title: 'Python Intern',
      company_name: 'Example Inc',
      outcome: 'rejected',
      failure_reason: 'base_python',
      notes: 'Could not answer asyncio question well.',
      next_action: 'Review async basics'
    };

    mockedAxiosPost.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          id: 17,
          ...payload
        }
      }
    });

    await expect(createInterviewLog(payload)).resolves.toEqual({
      id: 17,
      ...payload
    });

    expect(mockedAxiosPost).toHaveBeenCalledTimes(1);
    expect(mockedAxiosPost).toHaveBeenCalledWith(
      `${API_BASE_URL}/interview-logs`,
      payload,
      authHeaders
    );
  });
});

describe('job search api helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('startJobSearch posts search criteria to the search endpoint', async () => {
    const payload = {
      keywords: 'python agent intern',
      locations: ['Remote'],
      job_type: 'internship',
      experience_level: 'entry-level',
      max_jobs: 5,
      scrapers: ['linkedin']
    };

    mockedAxiosPost.mockResolvedValueOnce({
      data: {
        search_id: 'job_search_20260629_120000',
        status: 'Job search started'
      }
    });

    await expect(startJobSearch(payload)).resolves.toEqual({
      search_id: 'job_search_20260629_120000',
      status: 'Job search started'
    });

    expect(mockedAxiosPost).toHaveBeenCalledWith(
      `${API_BASE_URL}/search`,
      payload,
      authHeaders
    );
  });

  test('fetchSearchHistory requests recent searches', async () => {
    mockedAxiosGet.mockResolvedValueOnce({
      data: {
        searches: [
          {
            search_id: 'job_search_20260629_120000',
            keywords: 'python agent intern',
            locations: ['Remote'],
            job_type: 'internship',
            experience_level: 'entry-level',
            max_jobs: 5,
            status: 'completed',
            job_count: 3,
            has_results: true
          }
        ]
      }
    });

    await expect(fetchSearchHistory({ limit: 5 })).resolves.toEqual([
      {
        search_id: 'job_search_20260629_120000',
        keywords: 'python agent intern',
        locations: ['Remote'],
        job_type: 'internship',
        experience_level: 'entry-level',
        max_jobs: 5,
        status: 'completed',
        job_count: 3,
        has_results: true
      }
    ]);

    expect(mockedAxiosGet).toHaveBeenCalledWith(
      `${API_BASE_URL}/search/history`,
      {
        params: {
          limit: 5
        },
        ...authHeaders
      }
    );
  });

  test('protected helpers attach api key auth headers consistently', async () => {
    mockedAxiosGet
      .mockResolvedValueOnce({ data: { searches: [] } })
      .mockResolvedValueOnce({ data: [] });
    mockedAxiosPost
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            job_title: 'Python Intern',
            company_name: 'Example AI'
          }
        }
      })
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            summary: 'match'
          }
        }
      })
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            text: 'resume text'
          }
        }
      });

    await fetchSearchHistory();
    await fetchSearchResults('job_search_20260706_120000');
    await analyzeBossText({ job_text: 'Python Intern at Example AI' });
    await analyzeCareerFit({
      candidate_profile: 'Python FastAPI',
      target_role: 'Python Intern'
    });
    await extractResumeText({
      name: 'resume.txt',
      arrayBuffer: () => Promise.resolve(new TextEncoder().encode('resume').buffer)
    } as File);

    for (const call of mockedAxiosGet.mock.calls) {
      expect(call[1]).toMatchObject({
        headers: {
          'X-API-Key': API_KEY
        }
      });
    }

    for (const call of mockedAxiosPost.mock.calls) {
      expect(call[2]).toMatchObject({
        headers: {
          'X-API-Key': API_KEY
        }
      });
    }
  });

  test('fetchSearchResults requests jobs for a search id', async () => {
    mockedAxiosGet.mockResolvedValueOnce({
      data: [
        {
          id: 30,
          job_title: 'Python Agent Intern',
          company_name: 'Example AI',
          job_location: 'Wuhan',
          source_url: 'https://www.linkedin.com/jobs/view/30/'
        }
      ]
    });

    await expect(
      fetchSearchResults('job_search_20260629_120000')
    ).resolves.toEqual([
      {
        id: 30,
        job_title: 'Python Agent Intern',
        company_name: 'Example AI',
        job_location: 'Wuhan',
        source_url: 'https://www.linkedin.com/jobs/view/30/'
      }
    ]);

    expect(mockedAxiosGet).toHaveBeenCalledWith(
      `${API_BASE_URL}/search/job_search_20260629_120000`,
      authHeaders
    );
  });

  test('deleteSearchHistory deletes one recent search', async () => {
    mockedAxiosDelete.mockResolvedValueOnce({
      data: {
        success: true,
        deleted: 1,
        removed_files: 1
      }
    });

    await expect(deleteSearchHistory('job_search_20260629_120000')).resolves.toEqual({
      success: true,
      deleted: 1,
      removed_files: 1
    });

    expect(mockedAxiosDelete).toHaveBeenCalledWith(
      `${API_BASE_URL}/search/history/job_search_20260629_120000`,
      authHeaders
    );
  });

  test('clearSearchHistory clears all recent searches', async () => {
    mockedAxiosDelete.mockResolvedValueOnce({
      data: {
        success: true,
        deleted: 3,
        removed_files: 3
      }
    });

    await expect(clearSearchHistory()).resolves.toEqual({
      success: true,
      deleted: 3,
      removed_files: 3
    });

    expect(mockedAxiosDelete).toHaveBeenCalledWith(
      `${API_BASE_URL}/search/history`,
      authHeaders
    );
  });

  test('importJobs posts real collected jobs to the imports endpoint', async () => {
    const payload = {
      keywords: 'python',
      locations: ['武汉 江夏区'],
      job_type: 'internship',
      experience_level: 'entry-level',
      max_jobs: 5,
      candidate_profile: 'Python Vue MySQL',
      jobs: [
        {
          name: 'Python开发实习生',
          company: '武汉云简科技',
          location: '武汉 江夏区',
          salary: '150-200元/天',
          link: 'https://www.zhipin.com/job_detail/abc.html'
        }
      ]
    };

    mockedAxiosPost.mockResolvedValueOnce({
      data: {
        search_id: 'job_import_20260702_120000',
        status: 'Imported jobs saved',
        job_count: 1
      }
    });

    await expect(importJobs(payload)).resolves.toEqual({
      search_id: 'job_import_20260702_120000',
      status: 'Imported jobs saved',
      job_count: 1
    });

    expect(mockedAxiosPost).toHaveBeenCalledWith(
      `${API_BASE_URL}/imports/jobs`,
      payload,
      authHeaders
    );
  });

  test('fetchBossCollectorScript reads the page-side BOSS collector script', async () => {
    mockedAxiosGet.mockResolvedValueOnce({
      data: '(() => fetch("/imports/jobs"))();'
    });

    await expect(fetchBossCollectorScript()).resolves.toBe('(() => fetch("/imports/jobs"))();');

    expect(mockedAxiosGet).toHaveBeenCalledWith(
      `${API_BASE_URL}/imports/boss-collector.js`,
      {
        responseType: 'text',
        ...authHeaders
      }
    );
  });

  test('fetchBossMonitorStatus requests the monitor status endpoint', async () => {
    mockedAxiosGet.mockResolvedValueOnce({
      data: {
        running: false,
        keywords: '',
        locations: [],
        job_type: '',
        experience_level: '',
        max_jobs: 0,
        scrapers: ['boss'],
        interval_seconds: 300,
        last_search_id: null,
        last_job_count: 0,
        last_run_at: null,
        last_error: null
      }
    });

    await expect(fetchBossMonitorStatus()).resolves.toEqual({
      running: false,
      keywords: '',
      locations: [],
      job_type: '',
      experience_level: '',
      max_jobs: 0,
      scrapers: ['boss'],
      interval_seconds: 300,
      last_search_id: null,
      last_job_count: 0,
      last_run_at: null,
      last_error: null
    });

    expect(mockedAxiosGet).toHaveBeenCalledWith(
      `${API_BASE_URL}/boss/monitor/status`,
      authHeaders
    );
  });

  test('startBossMonitor starts monitoring with api key auth', async () => {
    const payload = {
      keywords: 'python',
      locations: ['武汉'],
      job_type: 'internship',
      experience_level: 'entry-level',
      max_jobs: 5,
      scrapers: ['boss'],
      interval_seconds: 300
    };

    mockedAxiosPost.mockResolvedValueOnce({
      data: {
        running: true,
        ...payload,
        last_search_id: null,
        last_job_count: 0,
        last_run_at: null,
        last_error: null
      }
    });

    await expect(startBossMonitor(payload)).resolves.toMatchObject({
      running: true,
      keywords: 'python'
    });

    expect(mockedAxiosPost).toHaveBeenCalledWith(
      `${API_BASE_URL}/boss/monitor/start`,
      payload,
      authHeaders
    );
  });

  test('stopBossMonitor stops monitoring with api key auth', async () => {
    mockedAxiosPost.mockResolvedValueOnce({
      data: {
        running: false,
        keywords: 'python',
        locations: ['武汉'],
        job_type: 'internship',
        experience_level: 'entry-level',
        max_jobs: 5,
        scrapers: ['boss'],
        interval_seconds: 300,
        last_search_id: 'boss_monitor_20260703_120000_000000',
        last_job_count: 3,
        last_run_at: '2026-07-03T12:00:00',
        last_error: null
      }
    });

    await expect(stopBossMonitor()).resolves.toMatchObject({
      running: false,
      last_job_count: 3
    });

    expect(mockedAxiosPost).toHaveBeenCalledWith(
      `${API_BASE_URL}/boss/monitor/stop`,
      {},
      authHeaders
    );
  });
});
