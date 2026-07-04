import os
import re
import time
from datetime import datetime
from html import unescape
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import quote, urljoin

import requests

from src.utils.deepseek_client import DeepSeekClient
from src.utils.job_database import JobDatabase


BOSS_CITY_CODES = {
    "武汉": "101200100",
    "姝︽眽": "101200100",
    "北京": "101010100",
    "上海": "101020100",
    "广州": "101280100",
    "深圳": "101280600",
    "杭州": "101210100",
    "成都": "101270100",
}


def _boss_city_code_for_location(location: str) -> str:
    clean = (location or "").strip()
    if clean in BOSS_CITY_CODES:
        return BOSS_CITY_CODES[clean]
    for city, code in BOSS_CITY_CODES.items():
        if city and city in clean:
            return code
    return ""


CURATED_WUHAN_AGENT_JOBS: List[Dict[str, Any]] = [
    {
        "source": "curated",
        "source_url": "https://www.zhipin.com/web/geek/job?query=AI%20Agent%E5%BC%80%E5%8F%91%E5%B7%A5%E7%A8%8B%E5%B8%88%20%E5%BE%AE%E6%B4%BE&city=101200100",
        "link_status": "needs_verification",
        "job_title": "AI Agent开发工程师",
        "company_name": "微派",
        "job_location": "武汉 洪山区",
        "salary": "8-12K·13薪",
        "job_description": "Python LLM API Agent DeepSeek RAG",
        "tags": ["Python", "Agent", "DeepSeek", "LLM"],
    },
    {
        "source": "curated",
        "source_url": "https://www.zhipin.com/web/geek/job?query=Python%20Agent%20%E9%A2%86%E9%93%84%E6%99%BA%E8%83%BD%E7%A7%91%E6%8A%80&city=101200100",
        "link_status": "needs_verification",
        "job_title": "大模型应用实习生（Python）",
        "company_name": "领铄智能科技",
        "job_location": "武汉 洪山区",
        "salary": "240-300元/天",
        "job_description": "Python RAG Agent LLM internship",
        "tags": ["Python", "RAG", "Agent", "瀹炰範"],
    },
    {
        "source": "curated",
        "source_url": "https://www.zhipin.com/web/geek/job?query=Python%E8%BD%AF%E4%BB%B6%E5%BC%80%E5%8F%91%E5%B7%A5%E7%A8%8B%E5%B8%88%20%E5%B2%9A%E5%9B%BE%E6%B1%BD%E8%BD%A6&city=101200100",
        "link_status": "needs_verification",
        "job_title": "Python软件开发工程师-实习生",
        "company_name": "岚图汽车",
        "job_location": "武汉 汉阳区",
        "salary": "140-160元/天",
        "job_description": "Python PyQt Agent RAG Prompt internship",
        "tags": ["Python", "Agent", "RAG", "Prompt"],
    },
]


OBSERVED_WUHAN_JOBS: List[Dict[str, Any]] = [
    {
        "source": "observed_boss",
        "link_status": "needs_verification",
        "job_title": "全栈开发实习生",
        "company_name": "武汉云简科技",
        "job_location": "武汉",
        "salary": "150-200元/天",
        "job_description": "Vue Python Java MySQL Web 全栈 实习",
        "tags": ["全栈", "Vue", "Python", "MySQL", "实习"],
    },
    {
        "source": "observed_boss",
        "link_status": "needs_verification",
        "job_title": "python实习生（27届）",
        "company_name": "万域动力",
        "job_location": "武汉 洪山区 珞狮南路",
        "salary": "100-150元/天",
        "job_description": "Python 数据处理 算法 实习",
        "tags": ["Python", "实习", "数据处理"],
    },
    {
        "source": "observed_boss",
        "link_status": "needs_verification",
        "job_title": "Python实习生",
        "company_name": "可循智能",
        "job_location": "武汉 江夏区 流芳",
        "salary": "150-200元/天",
        "job_description": "Python Java MySQL HTML5 实习",
        "tags": ["Python", "Java", "MySQL", "HTML5", "实习"],
    },
    {
        "source": "observed_boss",
        "link_status": "needs_verification",
        "job_title": "Python实习生",
        "company_name": "广置科技",
        "job_location": "武汉 江夏区 流芳",
        "salary": "150-200元/天",
        "job_description": "Python Java MySQL HTML5 实习",
        "tags": ["Python", "Java", "MySQL", "HTML5", "实习"],
    },
    {
        "source": "observed_boss",
        "link_status": "needs_verification",
        "job_title": "python实习生",
        "company_name": "武汉魅鑫信息技术",
        "job_location": "武汉 洪山区 珞狮南路",
        "salary": "260-270元/天",
        "job_description": "Python 自动化脚本 数据采集 实习",
        "tags": ["Python", "自动化", "数据采集", "实习"],
    },
    {
        "source": "observed_boss",
        "link_status": "needs_verification",
        "job_title": "Python算法实习生",
        "company_name": "大晟极",
        "job_location": "武汉 江夏区",
        "salary": "150-300元/天",
        "job_description": "Python 算法 数据结构 实习",
        "tags": ["Python", "算法", "实习"],
    },
    {
        "source": "observed_boss",
        "link_status": "needs_verification",
        "job_title": "Java开发实习生",
        "company_name": "准星科技",
        "job_location": "武汉",
        "salary": "100-150元/天",
        "job_description": "Java MySQL Web 后端 接口 实习",
        "tags": ["Java", "后端", "MySQL", "接口", "实习"],
    },
] + CURATED_WUHAN_AGENT_JOBS


LOCATION_COMPANY_CANDIDATES: Dict[str, List[Dict[str, str]]] = {
    "东西湖区": [
        {"company_name": "武汉临空港科技服务有限公司", "salary": "150-220元/天"},
        {"company_name": "武汉网安基地科技服务有限公司", "salary": "180-260元/天"},
        {"company_name": "武汉海创云谷科技有限公司", "salary": "120-200元/天"},
        {"company_name": "武汉光合智造科技有限公司", "salary": "150-240元/天"},
        {"company_name": "武汉东西湖数字产业服务中心", "salary": "120-180元/天"},
    ],
    "洪山区": [
        {"company_name": "微派", "salary": "8-12K·13薪"},
        {"company_name": "领铄智能科技", "salary": "240-300元/天"},
        {"company_name": "万域动力", "salary": "100-150元/天"},
        {"company_name": "武汉魅鑫信息技术", "salary": "260-270元/天"},
    ],
    "江夏区": [
        {"company_name": "可循智能", "salary": "150-200元/天"},
        {"company_name": "广置科技", "salary": "150-200元/天"},
        {"company_name": "大晟极", "salary": "150-300元/天"},
    ],
    "汉阳区": [
        {"company_name": "岚图汽车", "salary": "140-160元/天"},
        {"company_name": "武汉智行软件科技有限公司", "salary": "120-200元/天"},
    ],
    "武汉": [
        {"company_name": "武汉云简科技", "salary": "150-200元/天"},
        {"company_name": "准星科技", "salary": "100-150元/天"},
        {"company_name": "武汉智能科技有限公司", "salary": "150-200元/天"},
    ],
}


def _company_candidate_for_location(location: str, index: int) -> Dict[str, str]:
    clean_location = location or "武汉"
    for district, companies in LOCATION_COMPANY_CANDIDATES.items():
        if district in clean_location and companies:
            return companies[index % len(companies)]
    companies = LOCATION_COMPANY_CANDIDATES["武汉"]
    return companies[index % len(companies)]


SMART_ROLE_TEMPLATES: Dict[str, List[Dict[str, Any]]] = {
    "java": [
        {"job_title": "Java开发实习生", "job_description": "Java Spring Boot MySQL", "tags": ["Java", "MySQL", "实习"]},
        {"job_title": "后端开发实习生（Java）", "job_description": "Java backend database", "tags": ["Java", "后端", "实习"]},
        {"job_title": "Java软件开发实习生", "job_description": "Java Web SQL", "tags": ["Java", "Web", "实习"]},
    ],
    "python": [
        {"job_title": "Python实习生", "job_description": "Python script data automation", "tags": ["Python", "实习"]},
        {"job_title": "Python开发实习生", "job_description": "Python FastAPI Flask crawler", "tags": ["Python", "FastAPI", "实习"]},
        {"job_title": "爬虫/数据处理实习生（Python）", "job_description": "Python crawler data", "tags": ["Python", "爬虫", "实习"]},
    ],
    "agent": [
        {"job_title": "AI Agent开发实习生", "job_description": "Python LLM Agent RAG", "tags": ["Python", "Agent", "LLM"]},
        {"job_title": "大模型应用实习生", "job_description": "LLM RAG Agent", "tags": ["LLM", "RAG", "Agent"]},
        {"job_title": "LLM应用开发实习生", "job_description": "LLM Python tools", "tags": ["LLM", "Python"]},
    ],
    "frontend": [
        {"job_title": "前端开发实习生", "job_description": "Vue React JavaScript", "tags": ["Vue", "React", "实习"]},
        {"job_title": "Vue前端实习生", "job_description": "Vue components", "tags": ["Vue", "实习"]},
        {"job_title": "Web前端开发实习生", "job_description": "Web frontend CSS", "tags": ["Web", "实习"]},
    ],
    "fullstack": [
        {"job_title": "全栈开发实习生", "job_description": "Vue Python Java MySQL", "tags": ["全栈", "Vue", "MySQL", "实习"]},
        {"job_title": "Web全栈实习生", "job_description": "Web fullstack database", "tags": ["Web", "全栈", "实习"]},
    ],
    "dotnet": [
        {"job_title": "C# .NET开发实习生", "job_description": "C# .NET ASP.NET MySQL", "tags": ["C#", ".NET", "实习"]},
        {"job_title": "ASP.NET后端开发实习生", "job_description": "ASP.NET C# SQL Server", "tags": ["ASP.NET", "C#", "后端"]},
        {"job_title": "C#软件开发实习生", "job_description": "C# WinForm Web API", "tags": ["C#", "Web API", "实习"]},
    ],
    "cpp": [
        {"job_title": "C++开发实习生", "job_description": "C++ Linux 数据结构", "tags": ["C++", "Linux", "实习"]},
        {"job_title": "嵌入式软件实习生", "job_description": "C C++ embedded", "tags": ["C语言", "C++", "嵌入式"]},
    ],
    "c": [
        {"job_title": "C语言开发实习生", "job_description": "C language embedded software", "tags": ["C语言", "软件开发", "实习"]},
        {"job_title": "嵌入式软件实习生", "job_description": "C C++ MCU", "tags": ["C语言", "嵌入式", "实习"]},
    ],
}


SMART_ROLE_PRIORITY = ["fullstack", "dotnet", "cpp", "c", "agent", "java", "python", "frontend"]


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _norm(value: str) -> str:
    return (value or "").lower()


def build_boss_search_url(keywords: str, location: str) -> str:
    city_code = _boss_city_code_for_location(location)
    url = f"https://www.zhipin.com/web/geek/job?query={quote((keywords or '').strip())}"
    if city_code:
        url += f"&city={city_code}"
    return url


def build_boss_search_url_for_title(title: str, location: str) -> str:
    return build_boss_search_url(title, location)


def build_amap_company_search_url(
    company_name: str = "",
    job_title: str = "",
    location: str = "",
) -> str:
    """Build a 高德地图 company discovery URL without needing an API key."""
    company = (company_name or "").strip()
    title = (job_title or "").strip()
    city = (location or "").strip()
    if company in {"BOSS 平台实时结果", "平台搜索待核验", "NA"}:
        company = ""
    query = " ".join(part for part in [company, title, city, "公司"] if part).strip()
    return "https://www.amap.com/search?query=" + quote(query or "招聘 公司")


def attach_company_map_url(job: Dict[str, Any], location: str = "") -> Dict[str, Any]:
    """Attach a no-key Amap company lookup entry used by the frontend."""
    hydrated = dict(job)
    amap_url = build_amap_company_search_url(
        company_name=str(hydrated.get("company_name") or ""),
        job_title=str(hydrated.get("job_title") or ""),
        location=str(hydrated.get("job_location") or location or ""),
    )
    boss_url = hydrated.get("source_url") or build_boss_search_url_for_title(
        f"{hydrated.get('job_title') or ''} {hydrated.get('company_name') or ''}",
        str(hydrated.get("job_location") or location or "武汉"),
    )
    hydrated["amap_company_url"] = amap_url
    hydrated["company_discovery"] = {
        "mode": "boss_plus_amap",
        "boss_url": boss_url,
        "amap_url": amap_url,
        "query": " ".join(
            part
            for part in [
                str(hydrated.get("company_name") or "").strip(),
                str(hydrated.get("job_title") or "").strip(),
                str(hydrated.get("job_location") or location or "").strip(),
            ]
            if part
        ),
        "note": "先用 BOSS 岗位线索确认招聘，再用高德地图核验公司位置和通勤。",
    }
    return hydrated


def _role_keys(keywords: str, candidate_profile: Optional[str] = None, search_plan: Optional[List[Dict[str, Any]]] = None) -> List[str]:
    requested = _norm(keywords or "")
    requested_keys: List[str] = []
    if any(token in requested for token in ["全栈", "鍏ㄦ爤", "fullstack", "full stack"]):
        requested_keys.append("fullstack")
    if any(token in requested for token in ["c#", "csharp", ".net", "dotnet", "asp.net"]):
        requested_keys.append("dotnet")
    if any(token in requested for token in ["c++", "cpp"]):
        requested_keys.append("cpp")
    if requested.strip() in {"c", "c语言", "c 语言"}:
        requested_keys.append("c")
    if "java" in requested:
        requested_keys.append("java")
    if "python" in requested:
        requested_keys.append("python")
    if any(token in requested for token in ["agent", "llm", "rag", "大模型", "澶фā鍨?"]):
        requested_keys.append("agent")
    if any(token in requested for token in ["前端", "鍓嶇", "frontend", "vue", "react", "javascript"]):
        requested_keys.append("frontend")
    if requested_keys:
        return list(dict.fromkeys(requested_keys))

    text = _norm(" ".join([keywords or "", candidate_profile or "", " ".join(str(p) for p in search_plan or [])]))
    keys: List[str] = []
    if any(token in text for token in ["全栈", "鍏ㄦ爤", "fullstack", "full stack"]):
        keys.append("fullstack")
    if any(token in text for token in ["c#", "csharp", ".net", "dotnet", "asp.net"]):
        keys.append("dotnet")
    if any(token in text for token in ["c++", "cpp"]):
        keys.append("cpp")
    if "java" in text:
        keys.append("java")
    if "python" in text:
        keys.append("python")
    if any(token in text for token in ["agent", "llm", "rag", "大模型", "澶фā鍨?"]):
        keys.append("agent")
    if any(token in text for token in ["前端", "鍓嶇", "frontend", "vue", "react", "javascript"]):
        keys.append("frontend")
    return list(dict.fromkeys(keys)) or ["python"]


def _job_haystack(job: Dict[str, Any]) -> str:
    return _norm(
        " ".join(
            [
                job.get("job_title", ""),
                job.get("company_name", ""),
                job.get("job_location", ""),
                job.get("job_description", ""),
                " ".join(job.get("tags", [])),
            ]
        )
    )


def _matches_role(job: Dict[str, Any], keys: List[str]) -> bool:
    haystack = _job_haystack(job)
    title = _norm(job.get("job_title", ""))
    if "fullstack" in keys:
        return any(token in haystack for token in ["全栈", "鍏ㄦ爤", "fullstack", "vue python", "vue java"])
    if "dotnet" in keys:
        return any(token in haystack for token in ["c#", "csharp", ".net", "dotnet", "asp.net", "c＃"])
    if "cpp" in keys:
        return any(token in haystack for token in ["c++", "cpp"])
    if "agent" in keys:
        return any(token in haystack for token in ["agent", "llm", "rag", "大模型", "澶фā鍨?"])
    if "java" in keys:
        return "java" in title
    if "python" in keys:
        return "python" in haystack and "agent" not in haystack and "llm" not in haystack and "rag" not in haystack
    if "frontend" in keys:
        return any(token in haystack for token in ["前端", "鍓嶇", "frontend", "vue", "react", "javascript"])
    return True


def _expanded_search_terms(keywords: str, job_type: str, experience_level: str) -> str:
    requested = _norm(keywords or "")
    terms: List[str] = []
    keys = _role_keys(keywords)
    if "agent" in keys:
        terms.extend(["AI Agent", "LLM", "大模型应用"])
    if "python" in keys:
        terms.extend(["Python", "后端", "数据处理"])
    if "java" in keys:
        terms.extend(["Java", "Spring Boot", "后端"])
    if "frontend" in keys:
        terms.extend(["前端", "Vue", "React"])
    if "fullstack" in keys:
        terms.extend(["全栈", "Web开发"])
    if "dotnet" in keys:
        terms.extend(["C#", ".NET", "ASP.NET"])
    if "cpp" in keys or "c" in keys:
        terms.extend(["C语言", "C++", "嵌入式", "软件开发"])
    if not terms and keywords:
        terms.extend(re.findall(r"[a-zA-Z0-9+#.]+|[\u4e00-\u9fff]{2,}", requested))
    if job_type == "internship":
        terms.append("实习")
    if experience_level == "entry-level":
        terms.append("初级")
    return " ".join(list(dict.fromkeys(term for term in terms if term)))


def _rank(job: Dict[str, Any], keywords: str, locations: List[str], candidate_profile: Optional[str], search_plan: Optional[List[Dict[str, Any]]]) -> int:
    haystack = _job_haystack(job)
    score = 0
    for token in re.findall(r"[a-zA-Z0-9+#.]+|[\u4e00-\u9fff]{2,}", " ".join([keywords or "", candidate_profile or "", str(search_plan or "")]).lower()):
        if token and token in haystack:
            score += 4
    if any(location and location in job.get("job_location", "") for location in locations or ["姝︽眽"]):
        score += 8
    if "实习" in haystack or "瀹炰範" in haystack:
        score += 3
    return score


def search_observed_real_company_jobs(
    keywords: str,
    locations: List[str],
    max_jobs: int = 5,
    candidate_profile: Optional[str] = None,
    job_type: str = "internship",
    experience_level: str = "entry-level",
    search_plan: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    keys = _role_keys(keywords, candidate_profile, search_plan)
    scored: List[tuple[int, Dict[str, Any]]] = []
    for job in OBSERVED_WUHAN_JOBS:
        if not _matches_role(job, keys):
            continue
        item = dict(job)
        item["source_url"] = build_boss_search_url_for_title(f"{item['job_title']} {item['company_name']}", (locations or ["姝︽眽"])[0])
        item["scraped_at"] = _now()
        item = attach_company_map_url(item, (locations or ["武汉"])[0])
        scored.append((_rank(item, keywords, locations, candidate_profile, search_plan), item))
    scored.sort(key=lambda row: row[0], reverse=True)
    return [job for _, job in scored[:max_jobs]]


def build_smart_search_jobs(
    keywords: str,
    locations: List[str],
    max_jobs: int = 5,
    candidate_profile: Optional[str] = None,
    job_type: str = "internship",
    experience_level: str = "entry-level",
    search_plan: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    location = (locations or ["武汉"])[0]
    plans = search_plan or []
    rows: List[Dict[str, Any]] = []
    seen_titles = set()
    if plans:
        for plan in plans:
            title = str(plan.get("job_title") or "").strip()
            if not title:
                continue
            if title in seen_titles:
                continue
            seen_titles.add(title)
            company = _company_candidate_for_location(location, len(rows))
            rows.append(
                attach_company_map_url(
                    {
                        "source": "company_candidate",
                        "source_url": build_boss_search_url_for_title(str(plan.get("search_query") or title), location),
                        "link_status": "needs_verification",
                        "job_title": title,
                        "company_name": company["company_name"],
                        "job_location": location,
                        "salary": company["salary"],
                        "job_description": str(plan.get("reason") or "根据简历、技术方向和区县生成的公司候选，请通过 BOSS/高德核验是否仍在招聘。"),
                        "tags": [str(tag) for tag in plan.get("tags", [])],
                        "scraped_at": _now(),
                    },
                    location,
                )
            )
            if len(rows) >= max_jobs:
                return rows
    role_keys = _role_keys(keywords, candidate_profile, search_plan)
    ordered_keys = [key for key in SMART_ROLE_PRIORITY if key in role_keys]
    ordered_keys.extend(key for key in role_keys if key not in ordered_keys)
    for key in ordered_keys:
        for template in SMART_ROLE_TEMPLATES.get(key, []):
            if template["job_title"] in seen_titles:
                continue
            seen_titles.add(template["job_title"])
            company = _company_candidate_for_location(location, len(rows))
            rows.append(
                attach_company_map_url(
                    {
                        "source": "company_candidate",
                        "source_url": build_boss_search_url_for_title(f"{template['job_title']} {keywords}", location),
                        "link_status": "needs_verification",
                        "job_title": template["job_title"],
                        "company_name": company["company_name"],
                        "job_location": location,
                        "salary": company["salary"],
                        "job_description": template["job_description"],
                        "tags": template.get("tags", []),
                        "scraped_at": _now(),
                    },
                    location,
                )
            )
            if len(rows) >= max_jobs:
                return rows
    return rows


def _clean_html_text(value: str) -> str:
    text = re.sub(r"<script[\s\S]*?</script>", "", value or "", flags=re.I)
    text = re.sub(r"<style[\s\S]*?</style>", "", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = unescape(text).replace("&nbsp;", " ")
    return re.sub(r"\s+", " ", text).strip()


def _first_text(card: str, class_keywords: List[str]) -> str:
    for keyword in class_keywords:
        pattern = (
            r'<(?P<tag>[a-zA-Z0-9]+)[^>]*class=["\'][^"\']*'
            + re.escape(keyword)
            + r'[^"\']*["\'][^>]*>(?P<content>[\s\S]*?)</(?P=tag)>'
        )
        match = re.search(pattern, card, flags=re.I)
        if match:
            value = _clean_html_text(match.group("content"))
            if value:
                return value
    return ""


def _first_href(card: str) -> Optional[str]:
    match = re.search(r'href=["\']([^"\']*/job_detail/[^"\']+)["\']', card, flags=re.I)
    if not match:
        match = re.search(r'href=["\']([^"\']+)["\']', card, flags=re.I)
    return urljoin("https://www.zhipin.com", match.group(1)) if match else None


def parse_boss_job_cards(html: str, max_jobs: int = 5) -> List[Dict[str, Any]]:
    starts = [match.start() for match in re.finditer(r'class=["\'][^"\']*job-card', html or "", flags=re.I)]
    if not starts:
        starts = [match.start() for match in re.finditer(r'href=["\'][^"\']*/job_detail/', html or "", flags=re.I)]
    chunks = []
    for index, start in enumerate(starts):
        end = starts[index + 1] if index + 1 < len(starts) else min(len(html), start + 6000)
        chunks.append(html[start:end])
    jobs: List[Dict[str, Any]] = []
    for card in chunks:
        source_url = _first_href(card)
        job_title = _first_text(card, ["job-name", "job-title"])
        company_name = _first_text(card, ["company-name", "boss-name"])
        if not JobDatabase.has_valid_job_identity(job_title, company_name):
            continue
        jobs.append(
            attach_company_map_url(
                {
                    "source": "boss",
                    "source_url": source_url,
                    "link_status": "verified_detail" if source_url and "/job_detail/" in source_url else "needs_verification",
                    "scraped_at": _now(),
                    "job_title": job_title,
                    "company_name": company_name,
                    "job_location": _first_text(card, ["job-area", "job-location", "location"]),
                    "salary": _first_text(card, ["salary"]),
                    "job_description": "",
                    "tags": [],
                }
            )
        )
        if len(jobs) >= max_jobs:
            break
    return jobs


class BossSearchBlocked(RuntimeError):
    pass


def is_boss_security_verification_url(url: str) -> bool:
    normalized = (url or "").lower()
    return "zhipin.com" in normalized and (
        "/security" in normalized or "security.html" in normalized or "/passport/" in normalized
    )


def is_boss_automation_enabled() -> bool:
    return os.getenv("BOSS_AUTOMATION_ENABLED", "false").lower() in {"1", "true", "yes"}


def search_curated_agent_jobs(keywords: str, locations: List[str], max_jobs: int = 5) -> List[Dict[str, Any]]:
    rows = []
    for job in CURATED_WUHAN_AGENT_JOBS:
        item = dict(job)
        item["scraped_at"] = _now()
        rows.append(item)
    return rows[:max_jobs]


def get_boss_browser_settings() -> Dict[str, Any]:
    return {
        "headless": os.getenv("BOSS_HEADLESS", "false").lower() not in {"0", "false", "no"},
        "user_data_dir": str(Path(os.getenv("BOSS_USER_DATA_DIR", "browser-data/boss"))),
        "manual_check_seconds": int(os.getenv("BOSS_MANUAL_CHECK_SECONDS", "60")),
        "user_agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
        ),
    }


def search_boss_jobs(keywords: str, locations: List[str], max_jobs: int = 5) -> List[Dict[str, Any]]:
    try:
        from playwright.sync_api import sync_playwright
    except Exception as exc:
        raise BossSearchBlocked("Playwright unavailable for BOSS automation.") from exc
    settings = get_boss_browser_settings()
    jobs: List[Dict[str, Any]] = []
    with sync_playwright() as playwright:
        context = playwright.chromium.launch_persistent_context(
            settings["user_data_dir"],
            headless=settings["headless"],
            user_agent=settings["user_agent"],
            locale="zh-CN",
            viewport={"width": 1366, "height": 900},
        )
        page = context.pages[0] if context.pages else context.new_page()
        try:
            for location in locations or ["姝︽眽"]:
                page.goto(build_boss_search_url(keywords, location), wait_until="domcontentloaded", timeout=30000)
                if is_boss_security_verification_url(page.url):
                    deadline = time.time() + max(1, settings["manual_check_seconds"])
                    while time.time() < deadline and is_boss_security_verification_url(page.url):
                        page.wait_for_timeout(1000)
                    if is_boss_security_verification_url(page.url):
                        raise BossSearchBlocked("BOSS 自动采集被拦截 security verification")
                page.wait_for_timeout(2500)
                if is_boss_security_verification_url(page.url):
                    deadline = time.time() + max(1, settings["manual_check_seconds"])
                    while time.time() < deadline and is_boss_security_verification_url(page.url):
                        page.wait_for_timeout(1000)
                    if is_boss_security_verification_url(page.url):
                        raise BossSearchBlocked("BOSS 自动采集被拦截 security verification")
                jobs.extend(parse_boss_job_cards(page.content(), max_jobs=max_jobs - len(jobs)))
                if len(jobs) >= max_jobs:
                    break
        finally:
            context.close()
    return jobs[:max_jobs]


def _strip_search_html(value: str) -> str:
    return _clean_html_text(value).strip(" -_|")


def _extract_company_from_search_text(title: str, snippet: str) -> str:
    combined = _strip_search_html(f"{title} {snippet}")
    patterns = [
        r"([A-Za-z0-9\u4e00-\u9fff（）()·]{2,40}(?:科技|信息|智能|汽车|软件|网络|数据|集团|有限公司|有限责任公司))",
        r"(?:公司|企业|company)[:： ]+([A-Za-z0-9\u4e00-\u9fff（）()·]{2,40})",
    ]
    for pattern in patterns:
        match = re.search(pattern, combined, flags=re.I)
        if match:
            company = match.group(1).strip(" -_|，,。")
            if company and "BOSS" not in company.upper():
                return company
    return ""


def _extract_job_title_from_search_text(title: str, keyword: str) -> str:
    clean_title = re.sub(r"[-_|—].*$", "", _strip_search_html(title)).strip()
    return clean_title[:60] if clean_title else (keyword.strip() or "Job")


def search_web_real_company_jobs(
    keywords: str,
    locations: List[str],
    max_jobs: int = 5,
    candidate_profile: Optional[str] = None,
    job_type: str = "internship",
    experience_level: str = "entry-level",
    search_plan: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    location = (locations or ["武汉"])[0]
    expanded_terms = _expanded_search_terms(keywords, job_type, experience_level)
    query = " ".join([location, expanded_terms or keywords, "BOSS直聘 公司 岗位"]).strip()
    search_url = "https://www.bing.com/search?q=" + quote(query)
    try:
        response = requests.get(search_url, headers={"User-Agent": get_boss_browser_settings()["user_agent"]}, timeout=8)
        response.raise_for_status()
    except Exception:
        return []
    blocks = re.findall(r"<li class=\"b_algo\"[\s\S]*?</li>", response.text, flags=re.I)
    candidates: List[Dict[str, Any]] = []
    seen = set()
    for block in blocks:
        link_match = re.search(r"<a[^>]+href=\"([^\"]+)\"[^>]*>([\s\S]*?)</a>", block, flags=re.I)
        if not link_match:
            continue
        source_url = unescape(link_match.group(1))
        title = _strip_search_html(link_match.group(2))
        snippet_match = re.search(r"<p[^>]*>([\s\S]*?)</p>", block, flags=re.I)
        snippet = _strip_search_html(snippet_match.group(1)) if snippet_match else ""
        company_name = _extract_company_from_search_text(title, snippet)
        job_title = _extract_job_title_from_search_text(title, keywords)
        if not JobDatabase.has_valid_job_identity(job_title, company_name):
            continue
        identity = (job_title, company_name)
        if identity in seen:
            continue
        seen.add(identity)
        candidates.append(
            attach_company_map_url(
                {
                    "source": "web_search",
                    "source_url": source_url,
                    "link_status": "needs_verification",
                    "job_title": job_title,
                    "company_name": company_name,
                    "job_location": location,
                    "salary": "以平台为准",
                    "job_description": snippet or query,
                    "tags": [keywords, location, "公开搜索"],
                    "scraped_at": _now(),
                },
                location,
            )
        )
        if len(candidates) >= max_jobs:
            break
    return candidates


def run_boss_deepseek_search(
    keywords: str,
    locations: List[str],
    max_jobs: int,
    candidate_profile: Optional[str] = None,
    job_type: str = "internship",
    experience_level: str = "entry-level",
    deepseek_client: Optional[DeepSeekClient] = None,
) -> List[Dict[str, Any]]:
    deepseek = deepseek_client or DeepSeekClient()
    try:
        raw_plan = deepseek.plan_job_search(
            keywords=keywords,
            locations=locations,
            job_type=job_type,
            experience_level=experience_level,
            candidate_profile=candidate_profile,
            max_jobs=max_jobs,
        )
        search_plan = raw_plan if isinstance(raw_plan, list) else []
    except Exception:
        search_plan = []

    source_note = ""
    jobs: List[Dict[str, Any]] = []
    if is_boss_automation_enabled():
        try:
            jobs = search_boss_jobs(keywords, locations, max_jobs)
        except Exception as exc:
            source_note = f"BOSS 自动采集被拦截 {exc}"
            jobs = []

    if len(jobs) < max_jobs:
        jobs.extend(
            search_web_real_company_jobs(
                keywords,
                locations,
                max_jobs - len(jobs),
                candidate_profile,
                job_type,
                experience_level,
                search_plan,
            )
        )

    jobs = [
        job for job in jobs
        if job.get("source") in {"boss", "web_search"}
        and JobDatabase.has_valid_job_identity(job.get("job_title", ""), job.get("company_name", ""))
    ][:max_jobs]

    enriched_jobs = []
    for job in jobs:
        if source_note:
            job["source_note"] = source_note
        try:
            job["ai_analysis"] = deepseek.analyze_job(job, candidate_profile=candidate_profile)
        except Exception as exc:
            job["ai_analysis"] = {
                "provider": "deepseek",
                "status": "fallback",
                "match_score": None,
                "summary": "DeepSeek analysis failed.",
                "recommendation": str(exc),
            }
        enriched_jobs.append(job)
    return enriched_jobs
