import json
import os
import re
from typing import Any, Dict, List, Optional

import requests


DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash"
DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com"
DEFAULT_OLLAMA_MODEL = "qwen2.5:7b"
DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434"


class DeepSeekClient:
    """Small OpenAI-compatible DeepSeek client for job search planning and fit analysis."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
        session: Any = None,
    ):
        mode = os.getenv("DEEPSEEK_MODE", "local").strip().lower()
        use_api_flag = os.getenv("DEEPSEEK_USE_API", "").strip().lower()
        use_api = mode == "api" or use_api_flag in {"1", "true", "yes", "api"}
        explicit_test_client = api_key is not None and session is not None
        self.api_key = (api_key or os.getenv("DEEPSEEK_API_KEY")) if (use_api or explicit_test_client) else None
        self.model = model or os.getenv("DEEPSEEK_MODEL", DEFAULT_DEEPSEEK_MODEL)
        self.base_url = (base_url or os.getenv("DEEPSEEK_BASE_URL", DEFAULT_DEEPSEEK_BASE_URL)).rstrip("/")
        self.ollama_model = os.getenv("OLLAMA_MODEL", DEFAULT_OLLAMA_MODEL).strip()
        self.ollama_base_url = os.getenv("OLLAMA_BASE_URL", DEFAULT_OLLAMA_BASE_URL).rstrip("/")
        provider = os.getenv("AI_PROVIDER", "").strip().lower()
        self.use_ollama = (
            not self.api_key
            and provider in {"ollama", "local-ollama", "free", "local"}
            and os.getenv("OLLAMA_DISABLED", "").strip().lower() not in {"1", "true", "yes"}
        )
        if session is not None:
            self.session = session
        elif os.getenv("DEEPSEEK_DISABLE_PROXY", "false").lower() in {"1", "true", "yes"}:
            self.session = requests.Session()
            self.session.trust_env = False
        else:
            self.session = requests

    def plan_job_search(
        self,
        keywords: str,
        locations: Optional[List[str]] = None,
        job_type: str = "internship",
        experience_level: str = "entry-level",
        candidate_profile: Optional[str] = None,
        max_jobs: int = 5,
    ) -> List[Dict[str, Any]]:
        """Turn a job-title keyword and resume into platform search entries."""
        if not self.api_key:
            ollama_plan = self._try_ollama_search_plan(
                keywords=keywords,
                locations=locations,
                job_type=job_type,
                experience_level=experience_level,
                candidate_profile=candidate_profile,
                max_jobs=max_jobs,
            )
            if ollama_plan:
                return ollama_plan
            return self._fallback_search_plan(
                keywords=keywords,
                locations=locations,
                job_type=job_type,
                experience_level=experience_level,
                candidate_profile=candidate_profile,
                max_jobs=max_jobs,
            )

        prompt = self._build_search_plan_prompt(
            keywords=keywords,
            locations=locations,
            job_type=job_type,
            experience_level=experience_level,
            candidate_profile=candidate_profile,
            max_jobs=max_jobs,
        )
        response = self.session.post(
            f"{self.base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": self.model,
                "messages": [
                    {
                        "role": "system",
                        "content": "你是求职搜索规划 Agent。只输出 JSON，不要编造具体公司。",
                    },
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.1,
            },
            timeout=45,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        parsed = self._parse_json_content(content)
        return self._normalize_search_plan(parsed, max_jobs=max_jobs) or self._fallback_search_plan(
            keywords=keywords,
            locations=locations,
            job_type=job_type,
            experience_level=experience_level,
            candidate_profile=candidate_profile,
            max_jobs=max_jobs,
        )

    def analyze_job(self, job: Dict[str, Any], candidate_profile: Optional[str] = None) -> Dict[str, Any]:
        if not self.api_key:
            ollama_analysis = self._try_ollama_job_analysis(job, candidate_profile=candidate_profile)
            if ollama_analysis:
                return ollama_analysis
            analysis = self._normalize_analysis({}, job, candidate_profile=candidate_profile)
            analysis["provider"] = "local-free"
            analysis["status"] = "fallback"
            return analysis

        prompt = self._build_prompt(job, candidate_profile=candidate_profile)
        response = self.session.post(
            f"{self.base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": self.model,
                "messages": [
                    {
                        "role": "system",
                        "content": "你是面向大三计算机学生的求职 Agent，只输出 JSON。",
                    },
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.2,
            },
            timeout=45,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        analysis = self._parse_json_content(content)
        analysis = self._normalize_analysis(analysis, job, candidate_profile=candidate_profile)
        analysis["provider"] = "deepseek"
        analysis["status"] = "ready"
        return analysis

    def analyze_career_fit(
        self,
        candidate_profile: str,
        target_role: str,
        location: str = "武汉",
        job_type: str = "internship",
        experience_level: str = "entry-level",
        requirement_text: Optional[str] = None,
        recommended_jobs: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        if not self.api_key:
            ollama_analysis = self._try_ollama_career_analysis(
                candidate_profile=candidate_profile,
                target_role=target_role,
                location=location,
                job_type=job_type,
                experience_level=experience_level,
                requirement_text=requirement_text,
                recommended_jobs=recommended_jobs or [],
            )
            if ollama_analysis:
                return ollama_analysis
            return self._fallback_career_analysis(
                candidate_profile=candidate_profile,
                target_role=target_role,
                requirement_text=requirement_text,
            )

        prompt = self._build_career_fit_prompt(
            candidate_profile=candidate_profile,
            target_role=target_role,
            location=location,
            job_type=job_type,
            experience_level=experience_level,
            requirement_text=requirement_text,
            recommended_jobs=recommended_jobs or [],
        )
        response = self.session.post(
            f"{self.base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": self.model,
                "messages": [
                    {
                        "role": "system",
                        "content": "你是面向大三计算机学生的职业匹配 Agent，只输出 JSON。",
                    },
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.2,
            },
            timeout=45,
        )
        response.raise_for_status()
        parsed = self._parse_json_content(response.json()["choices"][0]["message"]["content"])
        return self._normalize_career_analysis(parsed, candidate_profile, target_role, requirement_text)

    def _build_search_plan_prompt(
        self,
        keywords: str,
        locations: Optional[List[str]],
        job_type: str,
        experience_level: str,
        candidate_profile: Optional[str],
        max_jobs: int,
    ) -> str:
        profile = (candidate_profile or "").strip() or "未上传简历。"
        city_text = "、".join(locations or [])
        return f"""
请根据候选人简历和搜索条件，生成适合去招聘平台搜索的岗位名称。

关键规则：
1. 用户关键词表示“想找的岗位名/方向”，不要把它当成普通技能词乱扩展。
2. 岗位类型必须生效：如果是 internship，就优先输出实习生/校招/应届/助理/初级方向。
3. 简历用于筛选和排序：优先输出候选人更可能匹配的岗位；如果简历和关键词冲突，以关键词为主，再给出原因。
4. 不要输出具体公司名，不要伪造真实岗位，只输出搜索入口需要的岗位名称和搜索词。

用户关键词：{keywords}
城市：{city_text}
岗位类型：{job_type}
经验要求：{experience_level}
最多输出：{max_jobs}
候选人简历：
{profile[:5000]}

只返回 JSON，格式：
{{
  "search_intent": "一句话说明理解到的求职方向",
  "recommended_titles": [
    {{
      "job_title": "岗位名称",
      "search_query": "用于招聘平台搜索的关键词",
      "reason": "为什么这个方向适合当前简历和搜索条件",
      "tags": ["技能或筛选标签"]
    }}
  ]
}}
""".strip()

    def _build_career_fit_prompt(
        self,
        candidate_profile: str,
        target_role: str,
        location: str,
        job_type: str,
        experience_level: str,
        requirement_text: Optional[str],
        recommended_jobs: List[Dict[str, Any]],
    ) -> str:
        jobs_text = json.dumps(recommended_jobs[:8], ensure_ascii=False)
        return f"""
请根据学生简历、目标岗位、岗位类型、经验要求和任职要求样本，做一份职业匹配分析。
这不是实时搜索任务，不要编造公司；公司候选只能参考我提供的 recommended_jobs。

候选人简历：
{candidate_profile[:6000]}

目标岗位：{target_role}
城市：{location}
岗位类型：{job_type}
经验要求：{experience_level}
任职要求样本：
{(requirement_text or "未提供，请根据目标岗位常见要求分析。")[:4000]}

可推荐公司候选：
{jobs_text}

只返回 JSON，字段必须完整：
summary: 一句话说明最适合的方向
best_fit_roles: 字符串数组，最适合的 3 个岗位名称
skill_gaps: 字符串数组，缺少的技术能力
experience_gaps: 字符串数组，缺少的项目/实习/作品集经验
resume_fixes: 字符串数组，简历应该怎么改
learning_plan: 数组，每项包含 topic、why、platform_keywords；platform_keywords 必须包含 bilibili、baidu、douyin、xiaohongshu 四个字段
hot_requirements: 字符串数组，总结热门任职要求关键词
next_actions: 字符串数组，接下来 7 天可以做的动作
""".strip()

    def _normalize_search_plan(self, parsed: Dict[str, Any], max_jobs: int) -> List[Dict[str, Any]]:
        raw_titles = parsed.get("recommended_titles") if isinstance(parsed, dict) else None
        if not isinstance(raw_titles, list):
            return []

        plans: List[Dict[str, Any]] = []
        seen = set()
        for item in raw_titles:
            if not isinstance(item, dict):
                continue
            title = str(item.get("job_title") or item.get("title") or "").strip()
            if not title or title in seen:
                continue
            seen.add(title)
            search_query = str(item.get("search_query") or title).strip()
            tags = item.get("tags") if isinstance(item.get("tags"), list) else []
            plans.append(
                {
                    "job_title": title,
                    "search_query": search_query,
                    "reason": str(item.get("reason") or item.get("rationale") or "根据简历和搜索条件推荐。").strip(),
                    "tags": [str(tag) for tag in tags if str(tag).strip()],
                }
            )
            if len(plans) >= max_jobs:
                break
        return plans

    def _call_ollama_json(self, system: str, prompt: str, timeout: int = 90) -> Dict[str, Any]:
        if not self.use_ollama:
            return {}
        try:
            response = requests.post(
                f"{self.ollama_base_url}/api/chat",
                json={
                    "model": self.ollama_model,
                    "stream": False,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": prompt},
                    ],
                    "format": "json",
                    "options": {"temperature": 0.1},
                },
                timeout=timeout,
            )
            response.raise_for_status()
            content = response.json().get("message", {}).get("content", "")
            return self._parse_json_content(content)
        except Exception:
            return {}

    def _try_ollama_search_plan(
        self,
        keywords: str,
        locations: Optional[List[str]],
        job_type: str,
        experience_level: str,
        candidate_profile: Optional[str],
        max_jobs: int,
    ) -> List[Dict[str, Any]]:
        parsed = self._call_ollama_json(
            "你是求职搜索规划 Agent。只输出 JSON，不要编造具体公司。",
            self._build_search_plan_prompt(
                keywords=keywords,
                locations=locations,
                job_type=job_type,
                experience_level=experience_level,
                candidate_profile=candidate_profile,
                max_jobs=max_jobs,
            ),
        )
        return self._normalize_search_plan(parsed, max_jobs=max_jobs)

    def _try_ollama_job_analysis(
        self, job: Dict[str, Any], candidate_profile: Optional[str] = None
    ) -> Dict[str, Any]:
        parsed = self._call_ollama_json(
            "你是面向计算机学生的求职匹配 Agent。只输出 JSON。",
            self._build_prompt(job, candidate_profile=candidate_profile),
        )
        if not parsed:
            return {}
        analysis = self._normalize_analysis(parsed, job, candidate_profile=candidate_profile)
        analysis["provider"] = "ollama-local"
        analysis["status"] = "ready"
        return analysis

    def _try_ollama_career_analysis(
        self,
        candidate_profile: str,
        target_role: str,
        location: str,
        job_type: str,
        experience_level: str,
        requirement_text: Optional[str],
        recommended_jobs: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        parsed = self._call_ollama_json(
            "你是面向计算机学生的职业匹配 Agent。只输出 JSON。",
            self._build_career_fit_prompt(
                candidate_profile=candidate_profile,
                target_role=target_role,
                location=location,
                job_type=job_type,
                experience_level=experience_level,
                requirement_text=requirement_text,
                recommended_jobs=recommended_jobs,
            ),
        )
        if not parsed:
            return {}
        analysis = self._normalize_career_analysis(parsed, candidate_profile, target_role, requirement_text)
        analysis["provider"] = "ollama-local"
        analysis["status"] = "ready"
        return analysis

    def _fallback_search_plan(
        self,
        keywords: str,
        locations: Optional[List[str]],
        job_type: str,
        experience_level: str,
        candidate_profile: Optional[str],
        max_jobs: int,
    ) -> List[Dict[str, Any]]:
        requested = (keywords or "").strip() or "Python"
        haystack = f"{requested} {candidate_profile or ''}".lower()
        internship = job_type in {"internship", "实习", "intern", "campus"} or experience_level in {
            "entry-level",
            "入门级",
            "应届",
        }
        suffix = "实习生" if internship and not re.search(r"实习|intern|校招|应届", requested, re.I) else ""
        role_map = [
            ("全栈", ["全栈", "fullstack", "full-stack"], ["全栈开发", "Web全栈", "前后端开发"]),
            ("java", ["java", "spring"], ["Java开发", "后端开发（Java）", "Java软件开发"]),
            ("python", ["python", "fastapi", "flask", "django", "爬虫"], ["Python开发", "Python", "爬虫/数据处理（Python）"]),
            ("前端", ["前端", "frontend", "vue", "react", "javascript"], ["前端开发", "Vue前端", "Web前端开发"]),
            ("测试", ["测试", "test", "qa"], ["软件测试", "测试开发", "自动化测试"]),
        ]

        titles: List[str] = []
        for _, aliases, base_titles in role_map:
            if any(alias.lower() in haystack for alias in aliases):
                titles = [f"{title}{suffix}" for title in base_titles]
                break
        if not titles:
            titles = [f"{requested}{suffix}", f"{requested}助理", f"初级{requested}"]

        city = (locations or [""])[0]
        return [
            {
                "job_title": title,
                "search_query": f"{title} {city}".strip(),
                "reason": "免费本地分析根据岗位关键词、岗位类型和简历技能生成的搜索方向。",
                "tags": [requested, job_type, experience_level],
            }
            for title in titles[:max_jobs]
        ]

    def _build_prompt(self, job: Dict[str, Any], candidate_profile: Optional[str] = None) -> str:
        profile = (candidate_profile or "").strip() or (
            "未上传简历；仅知道候选人是计算机相关学生，请主要根据用户搜索关键词和岗位 JD 判断匹配度，"
            "不要默认其目标是 Agent 或大模型方向。"
        )
        return f"""
请分析这个岗位是否适合下面这位学生，重点看岗位要求和学生现有经历是否匹配。
学生画像：{profile}

岗位信息：
- 职位：{job.get("job_title") or job.get("title")}
- 公司：{job.get("company_name") or job.get("company")}
- 地点：{job.get("job_location") or job.get("location")}
- 薪资：{job.get("salary")}
- 描述：{job.get("job_description") or job.get("description") or job.get("tags")}

请只返回 JSON，不要 Markdown。所有字段都必须返回；数组字段在信息足够时至少给 3 条，不要省略。字段：
match_score: 0-100 的整数
summary: 一句话总结
skill_gaps: 字符串数组
resume_tips: 字符串数组，必须结合学生画像给出具体改简历建议
resume_rewrite_bullets: 字符串数组，给出 3 条可以直接放进简历项目经历或技能描述里的定制化要点
self_introduction: 字符串，生成 60 秒以内、面向这个岗位的中文自我介绍
interview_questions: 字符串数组
recommendation: 建议投递 / 谨慎投递 / 不建议投递
""".strip()

    def _parse_json_content(self, content: str) -> Dict[str, Any]:
        cleaned = content.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            cleaned = cleaned.replace("json\n", "", 1).replace("JSON\n", "", 1)
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            return {
                "match_score": None,
                "summary": cleaned,
                "skill_gaps": [],
                "resume_tips": [],
                "resume_rewrite_bullets": [],
                "self_introduction": "",
                "interview_questions": [],
                "recommendation": "需要人工确认",
            }

    def _normalize_analysis(
        self,
        analysis: Dict[str, Any],
        job: Dict[str, Any],
        candidate_profile: Optional[str] = None,
    ) -> Dict[str, Any]:
        normalized = dict(analysis) if isinstance(analysis, dict) else {}
        title = str(job.get("job_title") or job.get("title") or "这个岗位").strip()
        company = str(job.get("company_name") or job.get("company") or "目标公司").strip()
        description = str(job.get("job_description") or job.get("description") or "").strip()
        profile = (candidate_profile or "").strip()

        def ensure_list(key: str) -> List[str]:
            value = normalized.get(key)
            if isinstance(value, list):
                items = [str(item).strip() for item in value if str(item).strip()]
            elif isinstance(value, str) and value.strip():
                items = [value.strip()]
            else:
                items = []
            normalized[key] = items
            return items

        skill_gaps = ensure_list("skill_gaps")
        resume_tips = ensure_list("resume_tips")
        rewrite_bullets = ensure_list("resume_rewrite_bullets")
        interview_questions = ensure_list("interview_questions")

        if not skill_gaps:
            skill_gaps.extend(self._fallback_skill_gaps(description, profile))
        if not resume_tips:
            resume_tips.extend(
                [
                    f"把简历项目经历改成更贴近「{title}」的职责，用 Python/数据库/接口等关键词描述具体产出。",
                    "每段经历补充使用过的技术栈、完成的功能、遇到的问题和可量化结果。",
                    f"针对 {company} 的岗位要求，把课程项目或实习经历中最相关的 2-3 点放到简历靠前位置。",
                ]
            )
        if not rewrite_bullets:
            rewrite_bullets.extend(
                [
                    f"围绕「{title}」方向，使用 Python/Java/MySQL 等技术完成课程或项目模块开发，具备基础编码与问题排查能力。",
                    "参与 Web 前端、数据库或接口自动化相关项目，能够根据需求完成页面、数据表和接口联调工作。",
                    "具备计算机科学与技术专业基础，熟悉常见开发流程，愿意在实习中快速补齐岗位所需技术栈。",
                ]
            )
        if not interview_questions:
            interview_questions.extend(
                [
                    "请介绍一个你做过的项目，你负责哪一部分，遇到过什么问题？",
                    "如果让你用 Python 处理一批数据或调用接口，你会怎么设计流程？",
                    f"你为什么想投递「{title}」，你觉得自己和岗位要求最匹配的点是什么？",
                ]
            )
        if not str(normalized.get("self_introduction") or "").strip():
            normalized["self_introduction"] = (
                f"面试官您好，我是计算机科学与技术专业学生，正在寻找{title}相关实习。"
                "我有 Python、Java、MySQL 和 Web 开发基础，做过课程项目和接口相关实践，"
                f"希望在 {company} 的岗位中继续提升工程能力并参与真实业务开发。"
            )
        if "summary" not in normalized or not str(normalized.get("summary") or "").strip():
            normalized["summary"] = "该岗位与候选人的计算机基础和项目经历有一定匹配度，需要重点补齐岗位 JD 中的具体技能。"
        if "recommendation" not in normalized or not str(normalized.get("recommendation") or "").strip():
            normalized["recommendation"] = "建议投递"
        if normalized.get("match_score") is None:
            normalized["match_score"] = self._fallback_match_score(job, profile)
        return normalized

    def _fallback_match_score(self, job: Dict[str, Any], candidate_profile: str) -> int:
        job_text = " ".join(
            str(value or "")
            for value in [
                job.get("job_title"),
                job.get("company_name"),
                job.get("job_description"),
                " ".join(str(tag) for tag in job.get("tags", []) or []),
            ]
        ).lower()
        profile_text = candidate_profile.lower()
        signals = {
            "python": ["python", "fastapi", "flask", "爬虫", "数据处理"],
            "java": ["java", "spring", "springboot", "mybatis"],
            "frontend": ["vue", "react", "javascript", "typescript", "html", "css", "前端"],
            "database": ["mysql", "sql", "redis", "数据库"],
            "agent": ["agent", "llm", "rag", "大模型", "智能体", "deepseek"],
            "cpp": ["c++", "c语言", "嵌入式"],
        }
        score = 55
        for aliases in signals.values():
            job_has_signal = any(alias in job_text for alias in aliases)
            profile_has_signal = any(alias in profile_text for alias in aliases)
            if job_has_signal and profile_has_signal:
                score += 8
            elif job_has_signal:
                score -= 4
        if any(word in job_text for word in ["实习", "intern", "校招"]) and any(
            word in profile_text for word in ["大三", "学生", "实习", "应届"]
        ):
            score += 8
        return max(35, min(92, score))

    def _fallback_skill_gaps(self, job_description: str, candidate_profile: str) -> List[str]:
        text = f"{job_description} {candidate_profile}".lower()
        gaps: List[str] = []
        for label, aliases in [
            ("Python 项目经验", ["python"]),
            ("数据库与 SQL 实践", ["mysql", "sql", "数据库"]),
            ("接口开发或联调经验", ["api", "接口", "fastapi", "flask"]),
            ("算法与数据处理能力", ["算法", "数据处理", "数据结构"]),
            ("Web 前端基础", ["html", "css", "javascript", "vue", "react"]),
        ]:
            if any(alias in text for alias in aliases):
                gaps.append(label)
        return gaps[:3] or ["需要结合岗位 JD 进一步确认核心技能缺口"]

    def _normalize_career_analysis(
        self,
        analysis: Dict[str, Any],
        candidate_profile: str,
        target_role: str,
        requirement_text: Optional[str],
    ) -> Dict[str, Any]:
        normalized = dict(analysis) if isinstance(analysis, dict) else {}
        fallback = self._fallback_career_analysis(candidate_profile, target_role, requirement_text)

        def list_field(key: str) -> List[Any]:
            value = normalized.get(key)
            if isinstance(value, list):
                items = [item for item in value if item]
            elif isinstance(value, str) and value.strip():
                items = [value.strip()]
            else:
                items = []
            normalized[key] = items or fallback[key]
            return normalized[key]

        for key in [
            "best_fit_roles",
            "skill_gaps",
            "experience_gaps",
            "resume_fixes",
            "hot_requirements",
            "next_actions",
        ]:
            list_field(key)

        learning_plan = normalized.get("learning_plan")
        if not isinstance(learning_plan, list) or not learning_plan:
            normalized["learning_plan"] = fallback["learning_plan"]
        else:
            normalized["learning_plan"] = [
                self._normalize_learning_item(item, target_role) for item in learning_plan if isinstance(item, dict)
            ] or fallback["learning_plan"]

        if not str(normalized.get("summary") or "").strip():
            normalized["summary"] = fallback["summary"]
        normalized["provider"] = "deepseek"
        normalized["status"] = "ready"
        return normalized

    def _normalize_learning_item(self, item: Dict[str, Any], target_role: str) -> Dict[str, Any]:
        topic = str(item.get("topic") or f"{target_role} 项目补强").strip()
        platform_keywords = item.get("platform_keywords") if isinstance(item.get("platform_keywords"), dict) else {}
        return {
            "topic": topic,
            "why": str(item.get("why") or "这是目标岗位常见任职要求。").strip(),
            "platform_keywords": {
                "bilibili": str(platform_keywords.get("bilibili") or f"{topic} 实战 项目").strip(),
                "baidu": str(platform_keywords.get("baidu") or f"{target_role} 任职要求 {topic}").strip(),
                "douyin": str(platform_keywords.get("douyin") or f"{topic} 学习路线").strip(),
                "xiaohongshu": str(platform_keywords.get("xiaohongshu") or f"{target_role} 简历 {topic}").strip(),
            },
        }

    def _fallback_career_analysis(
        self,
        candidate_profile: str,
        target_role: str,
        requirement_text: Optional[str],
    ) -> Dict[str, Any]:
        text = f"{candidate_profile} {target_role} {requirement_text or ''}".lower()
        target_text = f"{target_role} {requirement_text or ''}".lower()
        is_python = "python" in target_text or "python" in text
        is_java = ("java" in target_text or "spring" in target_text) or (
            not is_python and ("java" in text or "spring" in text)
        )
        if is_java:
            skills = ["SpringBoot 项目深度", "MyBatis/MySQL 综合实践", "Redis 或接口联调经验"]
            hot = ["Java 基础", "SpringBoot", "MyBatis", "MySQL", "Vue", "至少实习 3 个月"]
            topic = "SpringBoot + MyBatis + MySQL 后端项目"
            roles = ["Java开发实习生", "后端开发实习生", "全栈开发实习生"]
        elif is_python:
            skills = ["Python Web 项目经验", "FastAPI/Flask 接口开发", "爬虫或数据处理项目"]
            hot = ["Python 基础", "MySQL", "FastAPI/Flask", "爬虫", "数据处理", "接口联调"]
            topic = "Python FastAPI + MySQL 项目"
            roles = ["Python开发实习生", "数据分析实习生", "后端开发实习生"]
        else:
            skills = ["岗位方向项目作品", "数据库与接口实践", "可展示的实习/项目经历"]
            hot = ["编程基础", "数据库", "项目经验", "沟通协作", "实习稳定性"]
            topic = f"{target_role} 入门项目"
            roles = [target_role, "软件开发实习生", "测试开发实习生"]

        return {
            "summary": f"根据当前简历，优先匹配 {roles[0]}，需要用项目经验补强任职要求中的硬技能。",
            "best_fit_roles": roles,
            "skill_gaps": skills,
            "experience_gaps": ["缺少与目标岗位直接对应的完整项目", "缺少真实实习或可量化产出", "缺少把课程经历包装成业务项目的表达"],
            "resume_fixes": [
                "把与目标岗位最相关的技术栈放到简历前半部分。",
                "每个项目按“背景-技术-动作-结果”改写，避免只罗列课程名。",
                "补充可量化结果，例如接口数量、页面数量、数据量、性能提升或 Bug 修复数量。",
            ],
            "learning_plan": [
                {
                    "topic": topic,
                    "why": "岗位任职要求通常会直接考察这个项目链路。",
                    "platform_keywords": {
                        "bilibili": f"{topic} 实战 项目",
                        "baidu": f"{target_role} 任职要求 {topic}",
                        "douyin": f"{topic} 学习路线",
                        "xiaohongshu": f"{target_role} 简历 项目包装",
                    },
                }
            ],
            "hot_requirements": hot,
            "next_actions": [
                f"先做一个 {topic}，并写进简历。",
                "整理 3 段任职要求，提取重复出现的技能关键词。",
                "用一页 Markdown 记录项目亮点、技术难点和面试问答。",
            ],
            "provider": "local-free",
            "status": "fallback",
        }
