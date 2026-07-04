import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react';
import chinaAreaData from 'china-area-data';
import { extractResumeText, fetchBossCollectorScript, importJobs, startJobSearch } from '../api';

type JobSearchPanelProps = {
  onSearchStarted: (searchId: string) => void;
};

type FormState = {
  keywords: string;
  provinceCode: string;
  cityCode: string;
  districtCode: string;
  job_type: string;
  experience_level: string;
  max_jobs: string;
  candidate_profile: string;
};

type AreaData = Record<string, Record<string, string>>;

const areaData = chinaAreaData as AreaData;
const COUNTRY_CODE = '86';
const DEFAULT_PROVINCE_CODE = '420000';
const DEFAULT_CITY_CODE = '420100';
const DEFAULT_DISTRICT_CODE = '420111';
const NO_DISTRICT_CODE = 'none';
const NO_DISTRICT_LABEL = '不限区县';

const initialFormState: FormState = {
  keywords: 'python agent',
  provinceCode: DEFAULT_PROVINCE_CODE,
  cityCode: DEFAULT_CITY_CODE,
  districtCode: DEFAULT_DISTRICT_CODE,
  job_type: 'internship',
  experience_level: 'entry-level',
  max_jobs: '5',
  candidate_profile:
    '大三计算机科学与技术，想找 Python/Agent/后端开发实习；学过 Web 前端设计、MySQL、Vue、接口自动化、C 语言、Java 语言等。'
};

function areaEntries(parentCode: string) {
  return Object.entries(areaData[parentCode] ?? {});
}

function getFirstChildCode(parentCode: string, fallbackCode: string) {
  return areaEntries(parentCode)[0]?.[0] ?? fallbackCode;
}

function getDistrictEntries(cityCode: string) {
  const entries = areaEntries(cityCode).filter(([, name]) => name !== '市辖区' && name !== '县');
  return [[NO_DISTRICT_CODE, NO_DISTRICT_LABEL], ...entries] as Array<[string, string]>;
}

function areaName(code: string) {
  if (code === NO_DISTRICT_CODE) return NO_DISTRICT_LABEL;
  return areaData[COUNTRY_CODE]?.[code] ?? areaData[code.slice(0, 2) + '0000']?.[code] ?? findAreaName(code);
}

function findAreaName(code: string) {
  for (const children of Object.values(areaData)) {
    if (children[code]) return children[code];
  }
  return '';
}

function shortCityName(cityName: string) {
  return cityName.replace(/市$/, '').replace(/地区$/, '').replace(/自治州$/, '');
}

function buildLocation(form: FormState) {
  const city = shortCityName(areaName(form.cityCode));
  const district = form.districtCode === NO_DISTRICT_CODE ? '' : areaName(form.districtCode);
  return [city, district].filter(Boolean).join(' ');
}

function normalizeRoleInput(value: string) {
  return value.trim().toLowerCase().replace(/＋/g, '+').replace(/\s+/g, ' ');
}

function smartJobDirection(value: string, jobType: string, experienceLevel: string) {
  const text = normalizeRoleInput(value);
  const roleTerms: string[] = [];
  const suffixes: string[] = [];

  if (/(agent|llm|rag|大模型|智能体|deepseek)/i.test(text)) {
    roleTerms.push('AI Agent', 'LLM应用', 'RAG');
  }
  if (/python|py|爬虫|fastapi|flask|数据/.test(text)) {
    roleTerms.push('Python', 'FastAPI', '数据处理');
  }
  if (/java|spring|springboot|mybatis/.test(text)) {
    roleTerms.push('Java', 'Spring Boot', '后端');
  }
  if (/c#|csharp|\.net|dotnet|asp\.net/.test(text)) {
    roleTerms.push('C#', '.NET', 'ASP.NET');
  }
  if (/c\+\+|cpp|嵌入式/.test(text) || text === 'c' || text.includes('c语言')) {
    roleTerms.push('C语言', 'C++', '嵌入式');
  }
  if (/vue|react|前端|javascript|typescript|html|css/.test(text)) {
    roleTerms.push('前端', 'Vue', 'React');
  }
  if (/全栈|fullstack|full stack/.test(text)) {
    roleTerms.push('全栈', 'Web开发');
  }

  if (jobType === 'internship') suffixes.push('实习');
  if (jobType === 'full-time') suffixes.push('全职');
  if (experienceLevel === 'entry-level') suffixes.push('初级');
  if (experienceLevel === 'mid-level') suffixes.push('1-3年');

  const uniqueTerms = Array.from(new Set(roleTerms));
  if (uniqueTerms.length === 0) return value.trim();
  return [...uniqueTerms, ...suffixes].join(' ');
}

function parseImportedJobs(raw: string) {
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.jobs)) return parsed.jobs;
  throw new Error('请粘贴岗位数组，或包含 jobs 数组的 JSON。');
}

export default function JobSearchPanel({ onSearchStarted }: JobSearchPanelProps) {
  const [form, setForm] = useState<FormState>(initialFormState);
  const [isSearching, setIsSearching] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isCopyingCollector, setIsCopyingCollector] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [message, setMessage] = useState('');
  const [elapsedMs, setElapsedMs] = useState(0);

  const provinceOptions = useMemo(() => areaEntries(COUNTRY_CODE), []);
  const cityOptions = useMemo(() => areaEntries(form.provinceCode), [form.provinceCode]);
  const districtOptions = useMemo(() => getDistrictEntries(form.cityCode), [form.cityCode]);
  const smartKeywords = useMemo(
    () => smartJobDirection(form.keywords, form.job_type, form.experience_level),
    [form.keywords, form.job_type, form.experience_level]
  );

  useEffect(() => {
    if (!isSearching) return undefined;
    const startedAt = Date.now();
    setElapsedMs(0);
    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 100);
    return () => window.clearInterval(timer);
  }, [isSearching]);

  function updateField(field: keyof FormState) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setForm((current) => {
        if (field === 'provinceCode') {
          const nextCityCode = getFirstChildCode(value, current.cityCode);
          const nextDistrictCode = getDistrictEntries(nextCityCode)[0]?.[0] ?? NO_DISTRICT_CODE;
          return {
            ...current,
            provinceCode: value,
            cityCode: nextCityCode,
            districtCode: nextDistrictCode
          };
        }

        if (field === 'cityCode') {
          return {
            ...current,
            cityCode: value,
            districtCode: getDistrictEntries(value)[0]?.[0] ?? NO_DISTRICT_CODE
          };
        }

        return {
          ...current,
          [field]: value
        };
      });
    };
  }

  async function handleResumeFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage('正在解析简历...');
    try {
      const text = await extractResumeText(file);
      setForm((current) => ({
        ...current,
        candidate_profile: text
      }));
      setMessage(`已读取简历：${file.name}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '简历解析失败。');
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSearching(true);
    const startedAt = performance.now();
    setMessage('正在根据简历筛选岗位、匹配地区和生成分析...');

    try {
      const [result] = await Promise.all([
        startJobSearch({
          keywords: smartKeywords,
          locations: [buildLocation(form)],
          job_type: form.job_type,
          experience_level: form.experience_level,
          max_jobs: Number(form.max_jobs),
          scrapers: ['boss'],
          candidate_profile: form.candidate_profile
        }),
        new Promise((resolve) => window.setTimeout(resolve, 700))
      ]);

      const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);
      setMessage(`筛选完成，用时 ${seconds} 秒：${result.search_id}`);
      onSearchStarted(result.search_id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '启动搜索失败。');
    } finally {
      setIsSearching(false);
    }
  }

  async function handleImportJobs() {
    setIsImporting(true);
    setMessage('正在导入真实岗位...');

    try {
      const jobs = parseImportedJobs(importJson);
      const result = await importJobs({
        jobs,
        keywords: smartKeywords || form.keywords,
        locations: [buildLocation(form)],
        job_type: form.job_type,
        experience_level: form.experience_level,
        max_jobs: Number(form.max_jobs),
        candidate_profile: form.candidate_profile,
        source: 'boss_import'
      });

      setMessage(`已导入 ${result.job_count ?? jobs.length} 个真实岗位：${result.search_id}`);
      onSearchStarted(result.search_id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '导入真实岗位失败，请检查 JSON。');
    } finally {
      setIsImporting(false);
    }
  }

  async function handleCopyBossCollector() {
    setIsCopyingCollector(true);
    setMessage('正在准备 BOSS 页面采集脚本...');

    try {
      const script = await fetchBossCollectorScript();
      if (!navigator.clipboard?.writeText) {
        throw new Error('当前浏览器不支持自动复制，请打开 /imports/boss-collector.js 手动复制。');
      }
      await navigator.clipboard.writeText(script);
      setMessage('已复制 BOSS 采集脚本：打开 BOSS 岗位列表页，按 F12 到 Console 粘贴运行。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '复制 BOSS 采集脚本失败。');
    } finally {
      setIsCopyingCollector(false);
    }
  }

  return (
    <section className="panel search-panel">
      <div className="panel__heading">
        <div>
          <p className="eyebrow">Search Console</p>
          <h2>岗位搜索控制台</h2>
        </div>
        <span className="source-badge">稳定岗位源 + 免费本地分析</span>
      </div>
      <form className="form" onSubmit={handleSubmit}>
        <div className="profile-box">
          <div>
            <p className="eyebrow">Candidate Signal</p>
            <strong>先上传或粘贴你的简历，后面的匹配建议才会围绕你来算。</strong>
          </div>
          <label htmlFor="resume_file" className="file-drop">
            上传 Word 简历（.docx）或文本
            <input
              id="resume_file"
              name="resume_file"
              type="file"
              accept=".docx,.txt,.md,.markdown,.json"
              onChange={handleResumeFile}
            />
          </label>
        </div>
        <div className="collector-box">
          <div>
            <p className="eyebrow">Live Collector</p>
            <strong>推荐：安装 Chrome 扩展采集真实岗位</strong>
            <p className="muted">
              后台直连 BOSS 会被安全验证拦截。请加载
              <code> boss-collector-extension </code>
              后在 BOSS 页面点“导入到求职代理”，真实公司会进入最近岗位。
            </p>
          </div>
          <button
            type="button"
            className="button-secondary"
            disabled={isCopyingCollector}
            onClick={() => void handleCopyBossCollector()}
          >
            {isCopyingCollector ? '复制中...' : '复制 BOSS 采集脚本'}
          </button>
        </div>
        <label htmlFor="candidate_profile">
          我的简历 / 能力画像
          <textarea
            id="candidate_profile"
            name="candidate_profile"
            rows={6}
            value={form.candidate_profile}
            onChange={updateField('candidate_profile')}
            placeholder="例如：大三计科，学过 Java、Python、MySQL、Vue，有课程项目，想找开发实习..."
          />
        </label>
        <label htmlFor="keywords">
          技术细节 / 想找方向
          <input
            id="keywords"
            name="keywords"
            type="text"
            value={form.keywords}
            onChange={updateField('keywords')}
            placeholder="例如：会 Python、想做 Agent；或 C# .NET 后端；或 Vue + MySQL"
            required
          />
        </label>
        <div className="smart-query-card" aria-label="智能生成搜索方向">
          <span>智能生成搜索方向</span>
          <strong>{smartKeywords || '输入技术细节后自动生成'}</strong>
        </div>
        <div className="real-job-import">
          <div>
            <p className="eyebrow">Real Job Import</p>
            <strong>从 BOSS 页面或海投助手导入真实公司和岗位</strong>
            <p className="muted">粘贴采集到的岗位 JSON，系统会写入最近岗位，并重新做简历匹配。</p>
          </div>
          <label htmlFor="real_jobs_json">
            真实岗位 JSON
            <textarea
              id="real_jobs_json"
              name="real_jobs_json"
              rows={4}
              value={importJson}
              onChange={(event) => setImportJson(event.target.value)}
              placeholder='例如：[{"name":"Python开发实习生","company":"武汉云简科技","location":"武汉 江夏区","salary":"150-200元/天","link":"https://www.zhipin.com/job_detail/..."}]'
            />
          </label>
          <button
            type="button"
            className="button-secondary"
            disabled={isImporting || !importJson.trim()}
            onClick={() => void handleImportJobs()}
          >
            {isImporting ? '导入中...' : '导入真实岗位'}
          </button>
        </div>
        <div className="form__row form__row--triple">
          <label htmlFor="provinceCode">
            省份
            <select
              id="provinceCode"
              name="provinceCode"
              value={form.provinceCode}
              onChange={updateField('provinceCode')}
            >
              {provinceOptions.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="cityCode">
            城市
            <select id="cityCode" name="cityCode" value={form.cityCode} onChange={updateField('cityCode')}>
              {cityOptions.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="districtCode">
            区/县
            <select
              id="districtCode"
              name="districtCode"
              value={form.districtCode}
              onChange={updateField('districtCode')}
            >
              {districtOptions.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form__row">
          <label htmlFor="job_type">
            岗位类型
            <select id="job_type" name="job_type" value={form.job_type} onChange={updateField('job_type')}>
              <option value="internship">实习</option>
              <option value="full-time">全职</option>
              <option value="part-time">兼职</option>
              <option value="contract">合同</option>
            </select>
          </label>
          <label htmlFor="experience_level">
            经验要求
            <select
              id="experience_level"
              name="experience_level"
              value={form.experience_level}
              onChange={updateField('experience_level')}
            >
              <option value="entry-level">入门级</option>
              <option value="mid-level">中级</option>
              <option value="senior">高级</option>
            </select>
          </label>
        </div>
        <label htmlFor="max_jobs">
          最大数量
          <input
            id="max_jobs"
            name="max_jobs"
            type="number"
            min="1"
            max="50"
            value={form.max_jobs}
            onChange={updateField('max_jobs')}
          />
        </label>
        <div className="form__actions">
          <button
            type="submit"
            disabled={isSearching}
            onMouseDown={(event) => event.preventDefault()}
          >
            {isSearching ? '正在生成岗位...' : '生成岗位列表'}
          </button>
        </div>
      </form>
      {isSearching ? (
        <p className="status status--loading">
          正在根据简历筛选岗位，用时 {(elapsedMs / 1000).toFixed(1)} 秒
        </p>
      ) : null}
      {message ? <p className="status">{message}</p> : null}
    </section>
  );
}
