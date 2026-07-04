import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import App from './App';

vi.mock('./components/InterviewLogManager', () => ({
  default: () => <h1>面试日志</h1>
}));

vi.mock('./components/JobSearchPanel', () => ({
  default: () => <h2>职位搜索</h2>
}));

vi.mock('./components/SearchHistoryPanel', () => ({
  default: () => <h2>搜索结果</h2>
}));

vi.mock('./components/BossTextAnalyzer', () => ({
  default: () => <h2>简历岗位匹配分析</h2>
}));

test('renders the job search workspace sections', () => {
  render(<App />);

  expect(screen.getByRole('heading', { name: '求职代理' })).toBeInTheDocument();
  expect(screen.getByText('根据简历筛选最适合的实习方向')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '职位搜索' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '搜索结果' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '简历岗位匹配分析' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '面试日志' })).toBeInTheDocument();
});
