import { useRef, useState } from 'react';
import BossTextAnalyzer from './components/BossTextAnalyzer';
import InterviewLogManager from './components/InterviewLogManager';
import JobSearchPanel from './components/JobSearchPanel';
import SearchHistoryPanel from './components/SearchHistoryPanel';

export default function App() {
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const productLayoutRef = useRef<HTMLDivElement | null>(null);

  const scrollToSelector = (selector: string) => {
    document.querySelector<HTMLElement>(selector)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-header__copy">
          <p className="eyebrow">AI Job Ops Desk</p>
          <h1>求职代理</h1>
          <p className="app-header__lead">
            先用简历筛选适合的岗位和公司，再用免费本地分析比较任职要求，输出技能缺口、学习路线、
            简历改写和面试准备。重点不是替你点搜索，而是帮你判断“我现在最该投什么、补什么”。
          </p>
        </div>
        <div className="mission-card" aria-label="当前流程">
          <span className="mission-card__label">今天的主线</span>
          <strong>根据简历筛选最适合的实习方向</strong>
          <p>上传简历 → 选择目标岗位 → 分析任职要求 → 补齐经验 → 跟踪反馈</p>
        </div>
      </header>

      <section className="hero-strip" aria-label="workflow overview">
        <button type="button" className="hero-step-card" onClick={() => scrollToSelector('.product-layout')}>
          <span>01</span>
          <strong>匹配岗位</strong>
          <p>结合岗位类型、经验要求和任职要求样本，推荐更适合你的公司候选。</p>
        </button>
        <button type="button" className="hero-step-card" onClick={() => scrollToSelector('.career-workspace')}>
          <span>02</span>
          <strong>上传简历</strong>
          <p>Word 简历会被解析成能力画像，后续匹配不再凭感觉。</p>
        </button>
        <button type="button" className="hero-step-card" onClick={() => scrollToSelector('.interview-workspace')}>
          <span>03</span>
          <strong>补齐经验</strong>
          <p>把缺少的技能、项目和学习关键词整理成下一步行动。</p>
        </button>
      </section>

      <div className="product-layout" ref={productLayoutRef}>
        <aside className="command-rail">
          <JobSearchPanel
            onSearchStarted={() => {
              setHistoryRefreshKey((current) => current + 1);
              window.requestAnimationFrame(() => {
                productLayoutRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
              });
            }}
          />
        </aside>
        <section className="main-stage" aria-label="岗位结果工作区">
          <SearchHistoryPanel refreshKey={historyRefreshKey} />
        </section>
      </div>

      <section className="career-workspace" aria-label="简历岗位匹配智能体">
        <BossTextAnalyzer />
      </section>

      <section className="interview-workspace" aria-label="面试日志工作区">
        <InterviewLogManager />
      </section>
    </main>
  );
}
