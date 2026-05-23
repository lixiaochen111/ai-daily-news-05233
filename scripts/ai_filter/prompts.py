"""AI analysis prompt builders for content classification and filtering.

This module provides functions to build prompts for:
1. Fast classification (GLM-4-Flash) - Chinese prompts for quick relevance checks
2. Deep analysis (DeepSeek-V4 Pro) - Multi-language prompts for detailed content scoring
"""

from typing import List, Literal, Optional


def build_classification_prompt(title: str, source: str) -> str:
    """Build a fast classification prompt for GLM-4-Flash.

    This prompt is optimized for quick binary classification:
    - Is this content relevant to "AI + Design"?
    - Does it have practical value for UI/UX designers?

    Args:
        title: Article title
        source: Source name

    Returns:
        Chinese prompt string requesting JSON response with:
        - is_relevant (bool)
        - confidence (float 0-1)
        - reason (str)
    """
    return f"""你是一个AI内容分类器。判断以下内容是否与"AI+设计"相关。

标题：{title}
来源：{source}

请分析：
1. 是否涉及AI工具、设计工具、UI/UX设计、前端开发、创意灵感？
2. 是否对UI/UX设计师有实用价值？

只回复JSON格式：
{{
  "is_relevant": true/false,
  "confidence": 0.0-1.0,
  "reason": "判断理由"
}}"""


def build_analysis_prompt(
    title: str,
    source: str,
    summary: Optional[str] = None,
    filter_focus: Optional[List[str]] = None,
    exclude_topics: Optional[List[str]] = None,
    language: Literal["zh", "en"] = "en"
) -> str:
    """Build a deep analysis prompt for DeepSeek-V4 Pro.

    This prompt provides detailed content scoring across multiple dimensions:
    - Design relevance (0-10)
    - Content quality (0-10)
    - Categories (multiple)
    - Target audience
    - Key insights

    Args:
        title: Article title
        source: Source name
        summary: Optional article summary/excerpt
        filter_focus: Optional list of topics to prioritize
        exclude_topics: Optional list of topics to deprioritize
        language: Language for the prompt ("zh" or "en")

    Returns:
        Prompt string requesting detailed JSON analysis
    """
    if language == "zh":
        return _build_analysis_prompt_zh(title, source, summary, filter_focus, exclude_topics)
    else:
        return _build_analysis_prompt_en(title, source, summary, filter_focus, exclude_topics)


def _build_analysis_prompt_zh(
    title: str,
    source: str,
    summary: Optional[str],
    filter_focus: Optional[List[str]],
    exclude_topics: Optional[List[str]]
) -> str:
    """Build Chinese deep analysis prompt."""
    prompt = f"""你是一个专业的AI内容分析师。请深度分析以下内容。

标题：{title}
来源：{source}"""

    if summary:
        prompt += f"\n摘要：{summary}"

    if filter_focus:
        focus_list = "、".join(filter_focus)
        prompt += f"\n\n重点关注：{focus_list}"

    if exclude_topics:
        exclude_list = "、".join(exclude_topics)
        prompt += f"\n排除话题：{exclude_list}"

    prompt += """

请从以下维度评分（0-10分）：

1. **设计相关度**：对UI/UX设计师的相关性和实用性
2. **内容质量**：信息深度、可操作性、创新性

请以JSON格式返回：
{
  "design_relevance": 0-10,
  "quality_score": 0-10,
  "categories": ["类别1", "类别2"],
  "target_audience": "目标读者描述",
  "key_insights": "关键洞察摘要",
  "recommendation": "一句话推荐理由（20-30字，说明为什么推荐这篇内容）"
}"""

    return prompt


def _build_analysis_prompt_en(
    title: str,
    source: str,
    summary: Optional[str],
    filter_focus: Optional[List[str]],
    exclude_topics: Optional[List[str]]
) -> str:
    """Build English deep analysis prompt."""
    prompt = f"""You are a professional AI content analyst. Please analyze the following content in depth.

Title: {title}
Source: {source}"""

    if summary:
        prompt += f"\nSummary: {summary}"

    if filter_focus:
        focus_list = ", ".join(filter_focus)
        prompt += f"\n\nFocus areas: {focus_list}"

    if exclude_topics:
        exclude_list = ", ".join(exclude_topics)
        prompt += f"\nExclude topics: {exclude_list}"

    prompt += """

Please evaluate the content across these dimensions (0-10 scale):

1. **Design Relevance**: Relevance and practical value for UI/UX designers
2. **Content Quality**: Information depth, actionability, innovation

Return your analysis in JSON format:
{
  "design_relevance": 0-10,
  "quality_score": 0-10,
  "categories": ["category1", "category2"],
  "target_audience": "description of target readers",
  "key_insights": "summary of key insights",
  "recommendation": "one-sentence reason why this content is recommended (20-30 words in Chinese)"
}"""

    return prompt
