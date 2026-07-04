import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react';
import {
  createInterviewLog,
  fetchInterviewLogs,
  fetchInterviewStats,
  type InterviewLog,
  type InterviewLogStats
} from '../api';

type FormState = {
  job_title: string;
  company_name: string;
  outcome: string;
  failure_reason: string;
  notes: string;
  next_action: string;
};

const initialFormState: FormState = {
  job_title: '',
  company_name: '',
  outcome: 'rejected',
  failure_reason: '',
  notes: '',
  next_action: ''
};

export default function InterviewLogManager() {
  const [form, setForm] = useState<FormState>(initialFormState);
  const [logs, setLogs] = useState<InterviewLog[]>([]);
  const [stats, setStats] = useState<InterviewLogStats | null>(null);
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading'
  );
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function loadDashboard(): Promise<{ success: boolean; error?: string }> {
    setLoadStatus('loading');
    setLoadError('');

    try {
      const [logsResult, statsResult] = await Promise.all([
        fetchInterviewLogs({ limit: 20 }),
        fetchInterviewStats()
      ]);

      setLogs(logsResult.logs);
      setStats(statsResult);
      setLoadStatus('ready');
      return { success: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '加载面试日志失败。';
      setLoadStatus('error');
      setLoadError(message);
      return { success: false, error: message };
    }
  }

  function updateField(field: keyof FormState) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((current) => ({
        ...current,
        [field]: event.target.value
      }));
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage('正在保存面试日志...');

    try {
      await createInterviewLog({
        job_title: form.job_title,
        company_name: form.company_name,
        outcome: form.outcome,
        failure_reason: form.failure_reason,
        notes: form.notes,
        next_action: form.next_action
      });

      setForm(initialFormState);
      const refreshed = await loadDashboard();
      if (refreshed.success) {
        setMessage('已保存');
      } else {
        setMessage(
          `已保存，但刷新失败：${refreshed.error || '未知错误'}`
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : '保存面试日志失败。'
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="dashboard">
      <header className="dashboard__header">
        <div>
          <p className="eyebrow">面试追踪</p>
          <h1>面试日志</h1>
          <p className="dashboard__lede">
            记录面试结果和失败原因，把下一步复习动作留下来。
          </p>
        </div>
      </header>

      <div className="dashboard__grid">
        <section className="card">
          <h2>登记面试</h2>
          <form className="form" onSubmit={handleSubmit}>
            <label htmlFor="job_title">
              岗位名称
              <input
                id="job_title"
                name="job_title"
                type="text"
                value={form.job_title}
                onChange={updateField('job_title')}
                required
              />
            </label>
            <label htmlFor="company_name">
              公司名称
              <input
                id="company_name"
                name="company_name"
                type="text"
                value={form.company_name}
                onChange={updateField('company_name')}
                required
              />
            </label>
            <label htmlFor="outcome">
              结果
              <select
                id="outcome"
                name="outcome"
                value={form.outcome}
                onChange={updateField('outcome')}
              >
                <option value="rejected">被拒绝</option>
                <option value="passed">通过</option>
                <option value="waiting">等待中</option>
              </select>
            </label>
            <label htmlFor="failure_reason">
              失败原因
              <input
                id="failure_reason"
                name="failure_reason"
                type="text"
                value={form.failure_reason}
                onChange={updateField('failure_reason')}
              />
            </label>
            <label htmlFor="notes">
              备注
              <textarea
                id="notes"
                name="notes"
                rows={4}
                value={form.notes}
                onChange={updateField('notes')}
              />
            </label>
            <label htmlFor="next_action">
              下一步行动
              <input
                id="next_action"
                name="next_action"
                type="text"
                value={form.next_action}
                onChange={updateField('next_action')}
              />
            </label>
            <div className="form__actions">
              <button type="submit" disabled={isSaving}>
                {isSaving ? '保存中...' : '保存日志'}
              </button>
            </div>
          </form>
          {message ? <p className="status">{message}</p> : null}
          {loadStatus === 'error' ? (
            <p className="status status--error">{loadError}</p>
          ) : null}
        </section>

        <section className="card">
          <h2>面试统计</h2>
          {loadStatus === 'loading' && !stats ? (
            <p className="muted">正在加载统计...</p>
          ) : loadStatus === 'error' && !stats ? (
            <p className="muted">无法加载统计。</p>
          ) : stats ? (
            <div className="stats">
              <div className="stats__primary">{stats.total_logs} 条日志</div>
              <dl className="stats__list">
                {Object.entries(stats.by_outcome).map(([outcome, count]) => (
                  <div key={outcome}>
                    <dt>{outcome}</dt>
                    <dd>{count}</dd>
                  </div>
                ))}
              </dl>
              <div>
                <h3>Top failure reasons</h3>
                {stats.top_failure_reasons.length > 0 ? (
                  <ul className="list">
                    {stats.top_failure_reasons.map((reason) => (
                      <li key={reason.failure_reason}>
                        <span>{reason.failure_reason}</span>
                        <strong>{reason.count}</strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">还没有失败原因。</p>
                )}
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <section className="card card--full">
        <h2>最近日志</h2>
        {loadStatus === 'loading' && logs.length === 0 ? (
          <p className="muted">正在加载最近日志...</p>
        ) : loadStatus === 'error' && logs.length === 0 ? (
          <p className="muted">无法加载面试日志。</p>
        ) : logs.length > 0 ? (
          <div className="log-list">
            {logs.map((log) => (
              <article key={log.id} className="log-card">
                <div className="log-card__title">
                  <strong>{log.job_title}</strong>
                  <span>{log.company_name}</span>
                </div>
                <p className="pill">{log.outcome}</p>
                {log.failure_reason ? (
                  <p>
                    <span className="label">失败原因：</span> {log.failure_reason}
                  </p>
                ) : null}
                {log.notes ? (
                  <p>
                    <span className="label">备注：</span> {log.notes}
                  </p>
                ) : null}
                {log.next_action ? (
                  <p>
                    <span className="label">下一步：</span> {log.next_action}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">还没有面试日志。</p>
        )}
      </section>
    </section>
  );
}
