import { useEffect, useState } from 'react';
import {
  API_WS_URL,
  clearSearchHistory,
  deleteSearchHistory,
  fetchBossMonitorStatus,
  fetchSearchHistory,
  fetchSearchResults,
  startBossMonitor,
  stopBossMonitor,
  type BossMonitorStatus,
  type SearchHistoryItem,
  type SearchResultJob
} from '../api';

type SearchHistoryPanelProps = {
  refreshKey: number;
};

function statusLabel(status: string) {
  if (status === 'completed') return '已生成';
  if (status === 'started') return '生成中';
  if (status === 'error') return '失败';
  return status;
}

function resultTitle(job: SearchResultJob) {
  return job.job_title && job.job_title !== 'NA' ? job.job_title : '待核验岗位';
}

function resultCompany(job: SearchResultJob) {
  return job.company_name && job.company_name !== 'NA' ? job.company_name : '待核验公司';
}

function jobKey(searchId: string, job: SearchResultJob, index: number) {
  return `${searchId}-${index}-${job.id ?? job.source_url ?? resultTitle(job)}`;
}

function communicationUrl(job: SearchResultJob) {
  const url = job.apply_info || job.source_url || '';
  if (!url) return '';
  if (job.source === 'curated' && job.link_status !== 'verified_detail') return '';
  if (url.includes('/job_detail/')) return url;
  if (!url.includes('zhipin.com')) return url;
  return '';
}

function linkStatusLabel(job: SearchResultJob, directCommunicationUrl: string) {
  if (directCommunicationUrl) return '可沟通';
  if (job.link_status === 'needs_verification') return '待核验';
  return '待确认';
}

export function sourceLabel(job: SearchResultJob, search?: SearchHistoryItem) {
  if (search?.search_id.startsWith('boss_monitor_')) return 'BOSS 监控';
  if (job.source === 'observed_boss') return '历史样本';
  if (job.source === 'boss_monitor') return 'BOSS 监控';
  if (job.source === 'boss') return 'BOSS 实时';
  if (job.source === 'web_search') return '公开搜索';
  if (job.source === 'company_candidate') return '非实时候选';
  if (job.source === 'smart_search') return '搜索入口';
  if (job.source === 'curated') return '精选';
  return job.source || '岗位';
}

function sourceDetail(job: SearchResultJob, search?: SearchHistoryItem) {
  if (search?.search_id.startsWith('boss_monitor_') || job.source === 'boss_monitor') {
    return '来源：BOSS 页面监控同步，不是本地数据库造假';
  }
  if (job.source === 'observed_boss' || job.source === 'boss_import') {
    return '来源：BOSS 导入历史，建议点平台核验';
  }
  if (job.source === 'boss') return '来源：BOSS 实时搜索';
  if (job.source === 'web_search') return '来源：公开搜索';
  return job.source ? `来源：${job.source}` : '来源：岗位候选';
}

export function selectVisibleSearches(
  history: SearchHistoryItem[],
  monitorStatus: BossMonitorStatus | null
) {
  const hasVisibleResults = (search: SearchHistoryItem) =>
    Boolean(search.has_results) || Number(search.job_count ?? 0) > 0;

  if (monitorStatus?.last_search_id) {
    return history.filter(
      (search) => search.search_id === monitorStatus.last_search_id && hasVisibleResults(search)
    );
  }

  const monitorSearch = history.find(
    (search) => search.search_id.startsWith('boss_monitor_') && hasVisibleResults(search)
  );
  if (monitorSearch) return [monitorSearch];

  if (monitorStatus?.running) return [];

  return history;
}

function fallbackSearchUrl(job: SearchResultJob, search: SearchHistoryItem) {
  if (job.source_url?.includes('zhipin.com/web/geek/job')) {
    return job.source_url;
  }

  const location = search.locations?.[0] ?? '';
  const keyword = encodeURIComponent(`${resultTitle(job)} ${resultCompany(job)} ${location}`);
  return `https://www.zhipin.com/web/geek/job?query=${keyword}&city=101200100`;
}

function amapCompanyUrl(job: SearchResultJob, search: SearchHistoryItem) {
  if (job.amap_company_url) return job.amap_company_url;
  const location = job.job_location || search.locations?.[0] || '';
  const query = encodeURIComponent(`${resultCompany(job)} ${resultTitle(job)} ${location} 公司`);
  return `https://www.amap.com/search?query=${query}`;
}

function analysisLabel(provider?: string) {
  if (provider === 'ollama-local') return 'Ollama本地模型';
  return provider === 'deepseek' ? 'DeepSeek' : '本地分析';
}

function displaySalary(salary?: string | null) {
  const value = (salary ?? '').trim();
  if (!value) return '';
  if (/[\uE000-\uF8FF□�]/.test(value) || (value.match(/\?/g) ?? []).length >= 2) {
    return '薪资到 BOSS 核验';
  }
  return value;
}

function fitSummary(job: SearchResultJob) {
  if (!job.ai_analysis) return '等待简历匹配';
  const score = job.ai_analysis.match_score ?? '--';
  const summary = job.ai_analysis.summary || '该岗位与当前简历有一定匹配度，建议先核验岗位是否仍在招。';
  return `简历匹配 ${score} 分 · ${summary}`;
}

function monitorTimeLabel(value?: string | null) {
  if (!value) return '尚未拉取';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function SearchHistoryPanel({ refreshKey }: SearchHistoryPanelProps) {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [resultsBySearch, setResultsBySearch] = useState<Record<string, SearchResultJob[]>>({});
  const [expandedJobKey, setExpandedJobKey] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [mutationMessage, setMutationMessage] = useState('');
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [monitorStatus, setMonitorStatus] = useState<BossMonitorStatus | null>(null);
  const [monitorMessage, setMonitorMessage] = useState('');
  const [monitorBusy, setMonitorBusy] = useState(false);

  async function loadHistory(ignore = false) {
    setStatus('loading');
    setError('');

    try {
      const searches = await fetchSearchHistory({ limit: 10 });
      const resultEntries = await Promise.all(
        searches
          .filter((search) => search.has_results)
          .map(async (search) => [
            search.search_id,
            await fetchSearchResults(search.search_id)
          ] as const)
      );

      if (!ignore) {
        setHistory(searches);
        setResultsBySearch(Object.fromEntries(resultEntries));
        setStatus('ready');
      }
    } catch (loadError) {
      if (!ignore) {
        setError(loadError instanceof Error ? loadError.message : '加载搜索历史失败。');
        setStatus('error');
      }
    }
  }

  useEffect(() => {
    let ignore = false;
    void loadHistory(ignore);

    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    let ignore = false;
    fetchBossMonitorStatus()
      .then((nextStatus) => {
        if (!ignore) setMonitorStatus(nextStatus);
      })
      .catch(() => {
        if (!ignore) setMonitorMessage('BOSS 自动监控状态暂时不可用');
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    const socket = new WebSocket(`${API_WS_URL}/ws`);
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'boss_monitor_status') {
          setMonitorStatus(message.data);
        }
        if (message.type === 'boss_monitor_update') {
          const count = message.data?.job_count ?? 0;
          setMonitorMessage(`BOSS 自动监控已刷新，新增一轮 ${count} 个岗位`);
          void loadHistory();
          void fetchBossMonitorStatus().then(setMonitorStatus);
        }
      } catch {
        // Ignore messages from other websocket flows.
      }
    };
    socket.onerror = () => {
      setMonitorMessage('BOSS 自动监控推送连接暂时不可用');
    };
    return () => {
      socket.close();
    };
  }, []);

  async function handleDelete(searchId: string) {
    setMutatingId(searchId);
    setMutationMessage('');
    try {
      await deleteSearchHistory(searchId);
      setExpandedJobKey(null);
      setMutationMessage('已删除这条最近岗位记录。');
      await loadHistory();
    } catch (deleteError) {
      setMutationMessage(deleteError instanceof Error ? deleteError.message : '删除失败。');
    } finally {
      setMutatingId(null);
    }
  }

  async function handleClearAll() {
    setMutatingId('all');
    setMutationMessage('');
    try {
      await clearSearchHistory();
      setExpandedJobKey(null);
      setHistory([]);
      setResultsBySearch({});
      setMutationMessage('已清空最近岗位。');
    } catch (clearError) {
      setMutationMessage(clearError instanceof Error ? clearError.message : '清空失败。');
    } finally {
      setMutatingId(null);
    }
  }

  async function handleStartMonitor() {
    const latestSearch = history.find((search) => !search.search_id.startsWith('boss_monitor_'));
    if (!latestSearch) {
      setMonitorMessage('先生成一次岗位列表，再启动 BOSS 自动监控');
      return;
    }
    setMonitorBusy(true);
    setMonitorMessage('');
    try {
      const nextStatus = await startBossMonitor({
        keywords: latestSearch.keywords,
        locations: latestSearch.locations,
        job_type: latestSearch.job_type,
        experience_level: latestSearch.experience_level,
        max_jobs: latestSearch.max_jobs ?? 5,
        scrapers: ['boss'],
        interval_seconds: 300
      });
      setMonitorStatus(nextStatus);
      setMonitorMessage('BOSS 自动监控已启动，会每 5 分钟刷新一次');
    } catch (startError) {
      setMonitorMessage(startError instanceof Error ? startError.message : '启动 BOSS 自动监控失败');
    } finally {
      setMonitorBusy(false);
    }
  }

  async function handleStopMonitor() {
    setMonitorBusy(true);
    setMonitorMessage('');
    try {
      const nextStatus = await stopBossMonitor();
      setMonitorStatus(nextStatus);
      setMonitorMessage('BOSS 自动监控已停止');
    } catch (stopError) {
      setMonitorMessage(stopError instanceof Error ? stopError.message : '停止 BOSS 自动监控失败');
    } finally {
      setMonitorBusy(false);
    }
  }

  const visibleSearches = selectVisibleSearches(history, monitorStatus);
  const activeVisibleSearch = visibleSearches[0];
  const activeVisibleJobs = activeVisibleSearch ? resultsBySearch[activeVisibleSearch.search_id] : undefined;
  const monitorDisplayCount = activeVisibleJobs
    ? activeVisibleJobs.length
    : activeVisibleSearch?.job_count ?? monitorStatus?.last_job_count ?? 0;

  return (
    <section className="panel panel--full search-results-panel">
      <div className="panel__heading panel__heading--split">
        <div>
          <p className="eyebrow">Opportunity Board</p>
          <h2>最近搜索岗位</h2>
        </div>
        <div className="panel-heading-actions">
          <p className="muted">
            先生成岗位候选，再去平台核验是否仍在招；公司入口同时提供高德地图搜索。
          </p>
          <button
            type="button"
            className="button-secondary button-compact button-danger"
            disabled={!history.length || mutatingId === 'all'}
            onClick={handleClearAll}
          >
            {mutatingId === 'all' ? '清空中...' : '清空最近岗位'}
          </button>
        </div>
      </div>

      {mutationMessage ? <p className="status">{mutationMessage}</p> : null}
      <div className="boss-monitor-card">
        <div>
          <p className="eyebrow">BOSS Live Monitor</p>
          <strong>{monitorStatus?.running ? '自动拉取中' : '自动监控未启动'}</strong>
          <p className="muted">
            {monitorStatus?.running
              ? `${monitorStatus.keywords || '最近搜索'} · ${monitorStatus.locations?.join(', ') || '未指定城市'}`
              : '使用最近一次搜索条件，后台定时拉取 BOSS 新岗位并推送到这里'}
          </p>
        </div>
        <div className="boss-monitor-card__meta">
          <span className={monitorStatus?.running ? 'pill' : 'pill pill--muted'}>
            {monitorStatus?.running ? '运行中' : '已停止'}
          </span>
          <span>上次：{monitorTimeLabel(monitorStatus?.last_run_at)}</span>
          <span>{monitorDisplayCount} 个岗位</span>
        </div>
        <div className="boss-monitor-card__actions">
          {monitorStatus?.running ? (
            <button
              type="button"
              className="button-secondary button-compact"
              disabled={monitorBusy}
              onClick={() => void handleStopMonitor()}
            >
              {monitorBusy ? '处理中...' : '停止监控'}
            </button>
          ) : (
            <button
              type="button"
              className="button-secondary button-compact"
              disabled={monitorBusy || history.length === 0}
              onClick={() => void handleStartMonitor()}
            >
              {monitorBusy ? '启动中...' : '启动自动监控'}
            </button>
          )}
        </div>
      </div>
      {monitorMessage ? <p className="status">{monitorMessage}</p> : null}
      {monitorStatus?.last_error ? <p className="status status--error">{monitorStatus.last_error}</p> : null}

      {status === 'loading' && history.length === 0 ? (
        <div className="empty-state">
          <strong>正在同步岗位雷达...</strong>
          <p>新任务开始后，岗位会直接出现在这里。</p>
        </div>
      ) : status === 'error' && history.length === 0 ? (
        <p className="status status--error">{error}</p>
      ) : visibleSearches.length > 0 ? (
        <div className="history-list">
          {visibleSearches.map((search, searchIndex) => {
            const jobs = resultsBySearch[search.search_id] ?? [];
            return (
              <article className="history-card" key={search.search_id}>
                <div className="history-card__summary">
                  <div>
                    <p className="eyebrow">Search #{String(searchIndex + 1).padStart(2, '0')}</p>
                    <strong>{search.keywords}</strong>
                    <p className="muted">{search.locations.join(', ')}</p>
                  </div>
                  <div className="history-card__meta">
                    <span className="pill">{statusLabel(search.status)}</span>
                    <span>{search.job_count ?? jobs.length ?? 0} 个岗位</span>
                    <button
                      type="button"
                      className="button-secondary button-compact"
                      disabled={mutatingId === search.search_id}
                      onClick={() => void handleDelete(search.search_id)}
                    >
                      {mutatingId === search.search_id ? '删除中...' : '删除'}
                    </button>
                  </div>
                </div>

                {jobs.length ? (
                  <ul className="job-result-list">
                    {jobs.map((job, index) => {
                      const key = jobKey(search.search_id, job, index);
                      const isExpanded = expandedJobKey === key;
                      const directCommunicationUrl = communicationUrl(job);
                      const linkLabel = linkStatusLabel(job, directCommunicationUrl);
                      return (
                        <li className="job-result-card job-result-card--candidate" key={key}>
                          <div className="job-result-card__body">
                            <div className="job-result-card__kicker">
                              <span>{sourceLabel(job, search)}</span>
                              <span
                                className={
                                  directCommunicationUrl
                                    ? 'link-status link-status--verified'
                                    : 'link-status link-status--pending'
                                }
                              >
                                {linkLabel}
                              </span>
                            </div>
                            <div className="job-result-card__title">
                              <strong>{resultTitle(job)}</strong>
                            </div>
                            <p className="job-company">{resultCompany(job)}</p>
                            <div className="job-meta-line">
                              {job.job_location ? <span>{job.job_location}</span> : null}
                              {displaySalary(job.salary) ? <span>{displaySalary(job.salary)}</span> : null}
                              <span>{sourceDetail(job, search)}</span>
                            </div>
                            <p className="job-fit-summary">{fitSummary(job)}</p>
                            {isExpanded ? (
                              <div className="job-detail-box">
                                {job.ai_analysis ? (
                                  <div className="analysis-card">
                                    <strong>
                                      {analysisLabel(job.ai_analysis.provider)}：
                                      {job.ai_analysis.match_score ?? '--'} 分
                                    </strong>
                                    <p>{job.ai_analysis.summary}</p>
                                    {job.ai_analysis.recommendation ? (
                                      <p className="muted">建议：{job.ai_analysis.recommendation}</p>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                          <div className="job-actions">
                            <button
                              type="button"
                              className="button-secondary"
                              onClick={() => setExpandedJobKey(isExpanded ? null : key)}
                            >
                              {isExpanded ? '收起详情' : '查看详情'}
                            </button>
                            {directCommunicationUrl ? (
                              <a
                                aria-label={`沟通岗位：${resultTitle(job)}`}
                                className="job-link"
                                href={directCommunicationUrl}
                                rel="noreferrer"
                                target="_blank"
                              >
                                立即沟通
                              </a>
                            ) : (
                              <a
                                aria-label={`平台搜索：${resultTitle(job)}`}
                                className="job-link job-link--fallback"
                                href={fallbackSearchUrl(job, search)}
                                rel="noreferrer"
                                target="_blank"
                              >
                                平台搜索
                              </a>
                            )}
                            <a
                              aria-label={`高德找公司：${resultCompany(job)}`}
                              className="job-link job-link--map"
                              href={amapCompanyUrl(job, search)}
                              rel="noreferrer"
                              target="_blank"
                            >
                              高德找公司
                            </a>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="empty-state empty-state--compact">
                    <strong>实时源没有返回岗位</strong>
                    <p>BOSS 或公开搜索源可能被安全验证拦截，系统不会再用本地样本冒充真实岗位。请放宽地区/关键词，或点击平台搜索手动核验。</p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <strong>还没有搜索记录</strong>
          <p>先在左侧生成岗位列表，这里会展示公司、薪资、地点、高德公司入口和平台核验入口。</p>
        </div>
      )}
    </section>
  );
}
