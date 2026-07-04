import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import chinaAreaData from 'china-area-data';
import { analyzeCareerFit, extractResumeText, type CareerAnalyzeResult, type JobMarketTrends } from '../api';

type AreaData = Record<string, Record<string, string>>;

const areaData = chinaAreaData as AreaData;
const COUNTRY_CODE = '86';
const DEFAULT_PROVINCE_CODE = '420000';
const DEFAULT_CITY_CODE = '420100';
const DEFAULT_DISTRICT_CODE = '420112';
const NO_DISTRICT_CODE = 'none';
const NO_DISTRICT_LABEL = '不限区县';

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

function findAreaName(code: string) {
  for (const children of Object.values(areaData)) {
    if (children[code]) return children[code];
  }
  return '';
}

function areaName(code: string) {
  if (code === NO_DISTRICT_CODE) return NO_DISTRICT_LABEL;
  return areaData[COUNTRY_CODE]?.[code] ?? areaData[code.slice(0, 2) + '0000']?.[code] ?? findAreaName(code);
}

function shortCityName(cityName: string) {
  return cityName.replace(/市$/, '').replace(/地区$/, '').replace(/自治州$/, '');
}

function buildLocation(cityCode: string, districtCode: string) {
  const city = shortCityName(areaName(cityCode));
  const district = districtCode === NO_DISTRICT_CODE ? '' : areaName(districtCode);
  return [city, district].filter(Boolean).join(' ');
}

function normalizeRoleInput(value: string) {
  return value.trim().toLowerCase().replace(/，/g, '+').replace(/\s+/g, ' ');
}

function smartJobDirection(value: string, jobType: string, experienceLevel: string) {
  const text = normalizeRoleInput(value);
  const roleTerms: string[] = [];
  const suffixes: string[] = [];

  if (/(agent|llm|rag|大模型|智能体|deepseek)/i.test(text)) roleTerms.push('AI Agent', 'LLM应用', 'RAG');
  if (/python|py|爬虫|fastapi|flask|数据/.test(text)) roleTerms.push('Python', 'FastAPI', '数据处理');
  if (/java|spring|springboot|mybatis/.test(text)) roleTerms.push('Java', 'Spring Boot', '后端');
  if (/c#|csharp|\.net|dotnet|asp\.net/.test(text)) roleTerms.push('C#', '.NET', 'ASP.NET');
  if (/c\+\+|cpp|嵌入式/.test(text) || text === 'c' || text.includes('c语言')) roleTerms.push('C语言', 'C++', '嵌入式');
  if (/vue|react|前端|javascript|typescript|html|css/.test(text)) roleTerms.push('前端', 'Vue', 'React');
  if (/全栈|fullstack|full stack/.test(text)) roleTerms.push('全栈', 'Web开发');

  if (jobType === 'internship') suffixes.push('实习');
  if (jobType === 'full-time') suffixes.push('全职');
  if (experienceLevel === 'entry-level') suffixes.push('初级');
  if (experienceLevel === 'mid-level') suffixes.push('1-3年');

  const uniqueTerms = Array.from(new Set(roleTerms));
  if (uniqueTerms.length === 0) return value.trim();
  return [...uniqueTerms, ...suffixes].join(' ');
}

const defaultRequirementText = `任职要求：
1. 2027届毕业生，本科及以上学历，计算机软件、通讯相关专业；
2. 有扎实的 Java 或 Python 语言基础；
3. 有 Oracle/MySQL 数据库使用经验；
4. 熟悉 SpringBoot、MyBatis、Vue、HTML、CSS、JavaScript 等优先；
5. 至少能实习 3 个月以上，沟通能力和学习能力较好。`;

function TrendPillList({ items }: { items: JobMarketTrends[keyof Pick<JobMarketTrends, 'keywords' | 'cities' | 'salary_ranges' | 'company_types'>] }) {
  if (!items.length) return <p className="muted">暂无足够样本</p>;

  return (
    <div className="trend-pill-list">
      {items.map((item) => (
        <span className="trend-pill" key={item.name}>
          {item.name}
          <small>{item.count}</small>
        </span>
      ))}
    </div>
  );
}

function MarketTrendsCard({ trends }: { trends?: JobMarketTrends }) {
  if (!trends) return null;

  return (
    <section className="market-trends-card">
      <div>
        <p className="eyebrow">Market Signal</p>
        <h4>岗位趋势雷达</h4>
        <p className="market-trends-card__summary">
          {trends.total_jobs > 0
            ? trends.summary
            : '还没有真实岗位样本，先用简历和任职要求做方向分析。'}
        </p>
      </div>

      <div className="market-trend-grid">
        <div className="market-trend-group">
          <h5>热门关键词</h5>
          <TrendPillList items={trends.keywords} />
        </div>
        <div className="market-trend-group">
          <h5>城市 / 区县</h5>
          <TrendPillList items={trends.cities} />
        </div>
        <div className="market-trend-group">
          <h5>薪资区间</h5>
          <TrendPillList items={trends.salary_ranges} />
        </div>
        <div className="market-trend-group">
          <h5>公司类型</h5>
          <TrendPillList items={trends.company_types} />
        </div>
      </div>
    </section>
  );
}

export default function BossTextAnalyzer() {
  const [candidateProfile, setCandidateProfile] = useState(
    '大三计算机科学与技术，学过 Java、Python、MySQL、Vue 和接口自动化，想找武汉实习。'
  );
  const [targetRole, setTargetRole] = useState('Python实习');
  const [provinceCode, setProvinceCode] = useState(DEFAULT_PROVINCE_CODE);
  const [cityCode, setCityCode] = useState(DEFAULT_CITY_CODE);
  const [districtCode, setDistrictCode] = useState(DEFAULT_DISTRICT_CODE);
  const [jobType, setJobType] = useState('internship');
  const [experienceLevel, setExperienceLevel] = useState('entry-level');
  const [requirementText, setRequirementText] = useState(defaultRequirementText);
  const [result, setResult] = useState<CareerAnalyzeResult | null>(null);
  const [status, setStatus] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const provinceOptions = useMemo(() => areaEntries(COUNTRY_CODE), []);
  const cityOptions = useMemo(() => areaEntries(provinceCode), [provinceCode]);
  const districtOptions = useMemo(() => getDistrictEntries(cityCode), [cityCode]);
  const smartKeywords = useMemo(
    () => smartJobDirection(targetRole, jobType, experienceLevel),
    [targetRole, jobType, experienceLevel]
  );
  const selectedLocation = useMemo(() => buildLocation(cityCode, districtCode), [cityCode, districtCode]);

  async function handleResumeFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setStatus('正在解析简历...');
    try {
      setCandidateProfile(await extractResumeText(file));
      setStatus(`已读取简历：${file.name}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '简历解析失败。');
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsAnalyzing(true);
    setResult(null);
    setStatus('正在根据简历、岗位类型和任职要求做匹配分析...');

    try {
      const analysis = await analyzeCareerFit({
        candidate_profile: candidateProfile,
        target_role: smartKeywords,
        location: selectedLocation,
        job_type: jobType,
        experience_level: experienceLevel,
        requirement_text: requirementText || undefined,
        max_recommendations: 15
      });
      setResult(analysis);
      setStatus('分析完成：已生成公司候选、技能缺口和学习路线。');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '分析失败，请检查后端是否启动。');
    } finally {
      setIsAnalyzing(false);
    }
  }

  const analysis = result?.career_analysis;
  const marketTrends = result?.market_trends ?? analysis?.market_trends;

  return (
    <section className="panel panel--accent career-fit-panel">
      <div className="panel__heading">
        <div>
          <p className="eyebrow">Resume Fit Agent</p>
          <h2>简历岗位匹配分析</h2>
        </div>
        <span className="source-badge">免费本地分析</span>
      </div>
      <p className="source-note">
        先根据你的简历筛选适合的岗位和公司，再比较任职要求，输出缺少的经验、热门需求和学习路线。
      </p>

      <div className="career-fit-workbench">
        <form className="form career-fit-form" onSubmit={handleSubmit}>
          <div className="profile-box">
            <div>
              <p className="eyebrow">Candidate Signal</p>
              <strong>简历是筛选器，不是附件。先让 Agent 看懂你，再推荐岗位。</strong>
            </div>
            <label className="file-drop">
              上传 Word 简历（.docx）或文本
              <input type="file" accept=".docx,.txt,.md,.markdown,.json" onChange={handleResumeFile} />
            </label>
          </div>

          <label>
            我的简历 / 能力画像
            <textarea
              rows={5}
              value={candidateProfile}
              onChange={(event) => setCandidateProfile(event.target.value)}
              placeholder="粘贴你的简历、项目经历、技能栈、求职目标..."
            />
          </label>

          <div className="form__row">
            <label>
              技术细节 / 想找方向
              <input value={targetRole} onChange={(event) => setTargetRole(event.target.value)} />
            </label>
          </div>

          <div className="smart-query-card" aria-label="智能生成搜索方向">
            <span>智能生成搜索方向</span>
            <strong>{smartKeywords || '输入技术细节后自动生成'}</strong>
          </div>

          <div className="form__row form__row--triple">
            <label>
              省份
              <select
                value={provinceCode}
                onChange={(event) => {
                  const nextProvinceCode = event.target.value;
                  const nextCityCode = getFirstChildCode(nextProvinceCode, cityCode);
                  setProvinceCode(nextProvinceCode);
                  setCityCode(nextCityCode);
                  setDistrictCode(getDistrictEntries(nextCityCode)[0]?.[0] ?? NO_DISTRICT_CODE);
                }}
              >
                {provinceOptions.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              城市
              <select
                value={cityCode}
                onChange={(event) => {
                  const nextCityCode = event.target.value;
                  setCityCode(nextCityCode);
                  setDistrictCode(getDistrictEntries(nextCityCode)[0]?.[0] ?? NO_DISTRICT_CODE);
                }}
              >
                {cityOptions.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              区/县
              <select value={districtCode} onChange={(event) => setDistrictCode(event.target.value)}>
                {districtOptions.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="form__row">
            <label>
              岗位类型
              <select value={jobType} onChange={(event) => setJobType(event.target.value)}>
                <option value="internship">实习</option>
                <option value="full-time">全职</option>
                <option value="campus">校招</option>
              </select>
            </label>
            <label>
              经验要求
              <select value={experienceLevel} onChange={(event) => setExperienceLevel(event.target.value)}>
                <option value="entry-level">入门级</option>
                <option value="junior">初级</option>
                <option value="mid-level">中级</option>
              </select>
            </label>
          </div>

          <label>
            岗位任职要求样本（可选）
            <textarea
              rows={7}
              value={requirementText}
              onChange={(event) => setRequirementText(event.target.value)}
              placeholder="粘贴你看到的几段任职要求，Agent 会总结热门需求和你的缺口..."
            />
          </label>

          <div className="form__actions">
            <button type="submit" disabled={isAnalyzing}>
              {isAnalyzing ? '分析中...' : '分析适合我的岗位'}
            </button>
          </div>
          {status && <p className="status">{status}</p>}
        </form>

        <div className="career-fit-result-pane" aria-label="简历岗位分析结果">
          {!result || !analysis ? (
            <div className="empty-state career-fit-empty">
              <strong>等待生成职业报告</strong>
              <p>上传或粘贴简历，选择岗位名称、岗位类型和经验要求后，右侧会直接生成公司候选、技能缺口和学习路线。</p>
            </div>
          ) : (
            <article className="analysis-result-card career-report">
              <div className="career-report__summary">
                <p className="eyebrow">Career Report</p>
                <h3>{analysis.summary}</h3>
              </div>

              <MarketTrendsCard trends={marketTrends} />

              <div className="career-report__grid">
                <section>
                  <h4>推荐公司 / 岗位候选</h4>
                  {result.recommended_jobs.length > 0 ? (
                    <ul className="career-company-list career-company-list--compact">
                      {result.recommended_jobs.map((job) => (
                        <li key={`${job.company_name}-${job.job_title}`}>
                          <div className="career-company-list__main">
                            <strong>{job.company_name}</strong>
                            <span>{job.job_title}</span>
                            <small>
                              {job.job_location || result.location}
                              {job.salary ? ` · ${job.salary}` : ''}
                            </small>
                          </div>
                          <div className="career-company-list__actions">
                            <a
                              className="inline-map-link"
                              href={
                                job.amap_company_url ||
                                `https://www.amap.com/search?query=${encodeURIComponent(
                                  `${job.company_name || job.job_title} ${job.job_location || result.location} 公司`
                                )}`
                              }
                              rel="noreferrer"
                              target="_blank"
                            >
                              高德找公司
                            </a>
                            <a
                              className="inline-map-link inline-map-link--platform"
                              href={`https://www.zhipin.com/web/geek/job?query=${encodeURIComponent(
                                `${job.job_title || result.target_role} ${job.company_name || ''} ${job.job_location || result.location}`
                              )}`}
                              rel="noreferrer"
                              target="_blank"
                            >
                              平台核验
                            </a>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="career-company-empty">
                      <strong>真实岗位源暂时没有返回公司</strong>
                      <p>
                        这里不会再用假公司兜底。等 BOSS、公开搜索或高德入口返回真实公司后，会显示公司名、岗位、薪资和核验入口。
                      </p>
                    </div>
                  )}
                </section>

                <section>
                  <h4>最适合的岗位方向</h4>
                  <div className="tag-cloud">
                    {analysis.best_fit_roles.map((role) => (
                      <span key={role}>{role}</span>
                    ))}
                  </div>
                </section>
              </div>

              <div className="career-report__action-deck" aria-label="分析适合我的岗位后的下一步">
                <article>
                  <span>01 Fit</span>
                  <strong>先投这些方向</strong>
                  <p>推荐方向：{analysis.best_fit_roles.slice(0, 3).join(' / ') || result.target_role}</p>
                </article>
                <article>
                  <span>02 Gap</span>
                  <strong>优先补齐短板</strong>
                  <p>技能优先级：{analysis.skill_gaps.slice(0, 2).join('；') || '先补岗位 JD 里重复出现的硬技能。'}</p>
                </article>
                <article>
                  <span>03 Move</span>
                  <strong>今天就能行动</strong>
                  <p>今日动作：{analysis.learning_plan[0]?.topic || '选一个项目经历，按岗位要求补成可讲故事。'}</p>
                </article>
              </div>

              <div className="career-report__grid">
                <section>
                  <h4>缺少的技能能力</h4>
                  <ul>{analysis.skill_gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul>
                </section>
                <section>
                  <h4>缺少的经验</h4>
                  <ul>{analysis.experience_gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul>
                </section>
              </div>

              <section>
                <h4>简历应该怎么改</h4>
                <ul>{analysis.resume_fixes.map((fix) => <li key={fix}>{fix}</li>)}</ul>
              </section>

              <section>
                <h4>学习路线思维导图</h4>
                <div className="learning-mindmap" aria-label="学习路线思维导图">
                  <div className="mindmap-center">
                    <span>Agent</span>
                    <strong>补齐岗位差距</strong>
                  </div>
                  <div className="mindmap-branches">
                    {analysis.learning_plan.map((item) => (
                      <article className="mindmap-node" key={item.topic}>
                        <strong>{item.topic}</strong>
                        <p>{item.why}</p>
                        <div className="mindmap-platforms">
                          <span>哔哩哔哩：{item.platform_keywords.bilibili}</span>
                          <span>百度：{item.platform_keywords.baidu}</span>
                          <span>抖音：{item.platform_keywords.douyin}</span>
                          <span>小红书：{item.platform_keywords.xiaohongshu}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </section>

              <section>
                <h4>热门岗位需求</h4>
                <div className="tag-cloud">
                  {analysis.hot_requirements.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </section>

              <section>
                <h4>下一步行动</h4>
                <ul>{analysis.next_actions.map((action) => <li key={action}>{action}</li>)}</ul>
              </section>
            </article>
          )}
        </div>
      </div>
    </section>
  );
}
