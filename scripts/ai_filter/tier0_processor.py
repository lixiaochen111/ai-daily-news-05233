"""
Tier 0 Processor - Direct Publish with AI Summarization

For editorially-curated sources (e.g., UX Collective), content is already human-selected.
No AI filtering needed, but generate AI summary for all items.
"""
import os
from typing import Dict, List, Any, Optional

from scripts.ai_filter.easyrouter_client import EasyRouterClient
from scripts.ai_filter.language_detector import detect_language


class Tier0Processor:
    """
    Tier 0 处理器：直接发布+AI总结

    对于编辑精选源（如UX Collective），这些内容已经过人工筛选，
    质量有保证，无需AI筛选，但需要生成AI推荐理由。
    """

    def __init__(self):
        """Initialize Tier 0 processor with EasyRouter client."""
        self.easyrouter_client = EasyRouterClient()
        self.model_zh = os.getenv("AI_MODEL_ANALYZE_ZH", "deepseek-v4-pro")
        self.model_en = os.getenv("AI_MODEL_ANALYZE_EN", "deepseek-v4-pro")

    def _generate_summary(self, item: Dict[str, Any]) -> Optional[str]:
        """Generate AI summary for Tier 0 item.

        Args:
            item: Content item with title, source, etc.

        Returns:
            One-sentence recommendation in Chinese, or None if failed
        """
        try:
            # Detect language
            language = detect_language(
                title=item.get("title", ""),
                source=item.get("source", ""),
                site_name=item.get("site_name", "")
            )

            model = self.model_zh if language == "zh" else self.model_en

            # Build simple summary prompt
            system_prompt = "You are a content analyst. Generate a one-sentence recommendation in Chinese (20-30 words)."
            user_prompt = f"""Title: {item.get("title", "")}
Source: {item.get("source", "")}

Generate a one-sentence reason (in Chinese, 20-30 words) why this content is worth reading for UI/UX designers."""

            response = self.easyrouter_client.call_model(
                model=model,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.5,
                max_tokens=100
            )

            return response["content"].strip()

        except Exception as e:
            print(f"⚠️  Tier 0 summary generation failed: {e}")
            return None

    def process(self, item: Dict[str, Any], source_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        处理单个Tier 0内容项，添加元数据

        Args:
            item: 原始内容项
            source_config: 源配置字典 (can be None)

        Returns:
            添加了元数据的内容项
        """
        # Handle missing source_config
        if source_config is None:
            source_config = {}

        processed_item = item.copy()

        # Add internal tier tracking
        processed_item["_tier"] = 0
        processed_item["_source_config"] = source_config

        # Add AI filter metadata
        processed_item["ai_tier"] = 0
        processed_item["ai_must_publish"] = True

        # Generate AI summary (recommendation reason)
        summary = self._generate_summary(item)
        if summary:
            processed_item["ai_recommendation"] = summary

        return processed_item

    def process_batch(self, items: List[Dict[str, Any]], source_config: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        批量处理Tier 0内容

        Args:
            items: 内容项列表
            source_config: 源配置字典

        Returns:
            处理后的内容项列表
        """
        return [self.process(item, source_config) for item in items]
