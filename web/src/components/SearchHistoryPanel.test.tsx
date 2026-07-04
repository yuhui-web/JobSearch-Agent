import { describe, expect, test } from 'vitest';
import { selectVisibleSearches, sourceLabel } from './SearchHistoryPanel';
import type { BossMonitorStatus, SearchHistoryItem } from '../api';

describe('SearchHistoryPanel selectors', () => {
  test('shows only the latest monitor batch when monitor results exist', () => {
    const history: SearchHistoryItem[] = [
      {
        search_id: 'job_import_20260703_131827',
        keywords: 'python',
        locations: ['武汉'],
        job_type: 'internship',
        experience_level: 'entry-level',
        status: 'completed',
        job_count: 59,
        has_results: true
      },
      {
        search_id: 'boss_monitor_20260703_153000_000000',
        keywords: 'python agent',
        locations: ['武汉 江岸区'],
        job_type: 'internship',
        experience_level: 'entry-level',
        status: 'completed',
        job_count: 5,
        has_results: true
      },
      {
        search_id: 'boss_monitor_20260703_152000_000000',
        keywords: 'python agent',
        locations: ['武汉 东西湖区'],
        job_type: 'internship',
        experience_level: 'entry-level',
        status: 'completed',
        job_count: 5,
        has_results: true
      }
    ];
    const monitorStatus: BossMonitorStatus = {
      running: true,
      keywords: 'python agent',
      locations: ['武汉 江岸区'],
      job_type: 'internship',
      experience_level: 'entry-level',
      max_jobs: 5,
      scrapers: ['boss'],
      interval_seconds: 300,
      last_search_id: 'boss_monitor_20260703_153000_000000',
      last_job_count: 5,
      last_run_at: '2026-07-03T15:30:00',
      last_error: null
    };

    expect(selectVisibleSearches(history, monitorStatus).map((search) => search.search_id)).toEqual([
      'boss_monitor_20260703_153000_000000'
    ]);
  });

  test('labels jobs from monitor searches as monitor data even for old files', () => {
    const monitorSearch: SearchHistoryItem = {
      search_id: 'boss_monitor_20260703_153000_000000',
      keywords: 'python',
      locations: ['武汉'],
      job_type: 'internship',
      experience_level: 'entry-level',
      status: 'completed'
    };

    expect(sourceLabel({ source: 'boss_import' }, monitorSearch)).toBe('BOSS 监控');
  });

  test('does not render an empty monitor batch as a details card', () => {
    const history: SearchHistoryItem[] = [
      {
        search_id: 'boss_monitor_20260703_153610_954177',
        keywords: 'C# .NET ASP.NET 实习 初级',
        locations: ['武汉 东西湖区'],
        job_type: 'internship',
        experience_level: 'entry-level',
        status: 'completed',
        job_count: 0,
        has_results: false
      }
    ];
    const monitorStatus: BossMonitorStatus = {
      running: true,
      keywords: 'C# .NET ASP.NET 实习 初级',
      locations: ['武汉 东西湖区'],
      job_type: 'internship',
      experience_level: 'entry-level',
      max_jobs: 5,
      scrapers: ['boss'],
      interval_seconds: 300,
      last_search_id: 'boss_monitor_20260703_153610_954177',
      last_job_count: 0,
      last_run_at: '2026-07-03T15:36:12',
      last_error: null
    };

    expect(selectVisibleSearches(history, monitorStatus)).toEqual([]);
  });
});
