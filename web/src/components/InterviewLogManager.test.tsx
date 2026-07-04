import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import InterviewLogManager from './InterviewLogManager';
import {
  createInterviewLog,
  fetchInterviewLogs,
  fetchInterviewStats
} from '../api';

vi.mock('../api', () => ({
  createInterviewLog: vi.fn(),
  fetchInterviewLogs: vi.fn(),
  fetchInterviewStats: vi.fn()
}));

const mockedFetchInterviewLogs = vi.mocked(fetchInterviewLogs);
const mockedFetchInterviewStats = vi.mocked(fetchInterviewStats);
const mockedCreateInterviewLog = vi.mocked(createInterviewLog);

describe('InterviewLogManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('loads stats and recent logs on mount', async () => {
    mockedFetchInterviewLogs.mockResolvedValue({
      logs: [
        {
          id: 1,
          job_title: 'Python Intern',
          company_name: 'Example Inc',
          outcome: 'rejected',
          failure_reason: 'asyncio',
          notes: 'Struggled with concurrency basics.',
          next_action: 'Review async fundamentals'
        }
      ],
      count: 1
    });
    mockedFetchInterviewStats.mockResolvedValue({
      total_logs: 1,
      by_outcome: {
        rejected: 1
      },
      top_failure_reasons: [
        {
          failure_reason: 'asyncio',
          count: 1
        }
      ]
    });

    render(<InterviewLogManager />);

    expect(screen.getByLabelText('岗位名称')).toBeInTheDocument();
    expect(screen.getByText('面试统计')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Python Intern')).toBeInTheDocument();
      expect(screen.getByText('Example Inc')).toBeInTheDocument();
      expect(screen.getByText('1 条日志')).toBeInTheDocument();
      expect(screen.getAllByText('asyncio')).toHaveLength(2);
    });

    expect(mockedFetchInterviewLogs).toHaveBeenCalledTimes(1);
    expect(mockedFetchInterviewStats).toHaveBeenCalledTimes(1);
  });

  test('submits a new log and refreshes data', async () => {
    mockedFetchInterviewLogs.mockResolvedValue({
      logs: [],
      count: 0
    });
    mockedFetchInterviewStats.mockResolvedValue({
      total_logs: 0,
      by_outcome: {},
      top_failure_reasons: []
    });
    mockedCreateInterviewLog.mockResolvedValue({
      id: 7,
      job_title: 'Backend Intern',
      company_name: 'Acme',
      outcome: 'passed'
    });

    render(<InterviewLogManager />);

    await waitFor(() => {
      expect(mockedFetchInterviewLogs).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText('岗位名称'), {
      target: { value: 'Backend Intern' }
    });
    fireEvent.change(screen.getByLabelText('公司名称'), {
      target: { value: 'Acme' }
    });
    fireEvent.change(screen.getByLabelText('结果'), {
      target: { value: 'passed' }
    });
    fireEvent.change(screen.getByLabelText('失败原因'), {
      target: { value: '' }
    });
    fireEvent.change(screen.getByLabelText('备注'), {
      target: { value: 'Strong systems design discussion.' }
    });
    fireEvent.change(screen.getByLabelText('下一步行动'), {
      target: { value: 'Prep follow-up questions' }
    });

    fireEvent.click(screen.getByRole('button', { name: '保存日志' }));

    await waitFor(() => {
      expect(mockedCreateInterviewLog).toHaveBeenCalledWith({
        job_title: 'Backend Intern',
        company_name: 'Acme',
        outcome: 'passed',
        failure_reason: '',
        notes: 'Strong systems design discussion.',
        next_action: 'Prep follow-up questions'
      });
    });

    await waitFor(() => {
      expect(mockedFetchInterviewLogs).toHaveBeenCalledTimes(2);
      expect(mockedFetchInterviewStats).toHaveBeenCalledTimes(2);
    });
  });

  test('shows an error when the initial dashboard load fails', async () => {
    mockedFetchInterviewLogs.mockRejectedValue(new Error('logs offline'));
    mockedFetchInterviewStats.mockRejectedValue(new Error('stats offline'));

    render(<InterviewLogManager />);

    await waitFor(() => {
      expect(screen.getByText('logs offline')).toBeInTheDocument();
    });

    expect(screen.queryByText('还没有面试日志。')).not.toBeInTheDocument();
    expect(screen.queryByText('正在加载统计...')).not.toBeInTheDocument();
  });

  test('reports refresh failures after a successful save', async () => {
    mockedFetchInterviewLogs.mockResolvedValue({
      logs: [],
      count: 0
    });
    mockedFetchInterviewStats.mockResolvedValue({
      total_logs: 0,
      by_outcome: {},
      top_failure_reasons: []
    });
    mockedCreateInterviewLog.mockResolvedValue({
      id: 7,
      job_title: 'Backend Intern',
      company_name: 'Acme',
      outcome: 'passed'
    });

    render(<InterviewLogManager />);

    await waitFor(() => {
      expect(mockedFetchInterviewLogs).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByText('还没有面试日志。')).toBeInTheDocument();
    });

    mockedFetchInterviewLogs.mockRejectedValueOnce(new Error('refresh offline'));
    mockedFetchInterviewStats.mockRejectedValueOnce(new Error('refresh offline'));

    fireEvent.change(screen.getByLabelText('岗位名称'), {
      target: { value: 'Backend Intern' }
    });
    fireEvent.change(screen.getByLabelText('公司名称'), {
      target: { value: 'Acme' }
    });
    fireEvent.click(screen.getByRole('button', { name: '保存日志' }));

    await waitFor(() => {
      expect(screen.getByText(/已保存，但刷新失败/i)).toBeInTheDocument();
    });
  });
});
