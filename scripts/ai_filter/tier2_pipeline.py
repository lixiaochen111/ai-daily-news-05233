"""
Tier 2 Pipeline - Full Three-Stage Filtering

For broad sources (Figma, OpenAI, etc.) that need comprehensive filtering:
1. Keyword initial screening
2. GLM-4-Flash fast classification
3. AI deep analysis

Filter criteria:
- Stage 1: Keywords match BASE_KEYWORDS or filter_focus, avoid exclude_topics
- Stage 2: GLM classifies as relevant
- Stage 3: design_relevance >= 0.7 (stricter than Tier 1's 0.6)
"""
import json
import os
from typing import Dict, Any, Optional, List

from scripts.ai_filter.easyrouter_client import EasyRouterClient
from scripts.ai_filter.glm_client import GLMClient, QuotaExceededError
from scripts.ai_filter.language_detector import detect_language
from scripts.ai_filter.prompts import build_classification_prompt, build_analysis_prompt


class Tier2Pipeline:
    """
    Tier 2 完整管道：三阶段筛选

    用于Figma、OpenAI等内容广泛的源。
    需要通过关键词初筛 → GLM快速分类 → AI深度分析。
    """

    # Base keywords for AI + Design filtering (strict - reduce false positives)
    BASE_KEYWORDS = [
        # Core AI keywords only (most specific)
        "ai", "artificial intelligence", "machine learning", "ml",
        "gpt", "chatgpt", "claude", "gemini", "deepseek", "llm",
        "neural network", "deep learning", "transformer", "diffusion",
        "openai", "anthropic", "stability ai", "midjourney", "dall-e",

        # AI + Design/Creative intersection
        "ai design", "generative design", "ai art", "generative art",
        "text-to-image", "image generation", "ai illustration",
        "ai video", "sora", "runway", "gen-2",

        # Note: Removed generic terms (design, ui, ux, figma, frontend, css)
        # to reduce false positives in general tech news
    ]

    def __init__(self):
        """Initialize Tier 2 pipeline with GLM and EasyRouter clients."""
        # GLM client for free initial classification
        self.glm_client = GLMClient()

        # EasyRouter client for paid deep analysis
        self.easyrouter_client = EasyRouterClient()

        # Model configuration from environment variables
        self.model_classify = os.getenv("AI_MODEL_CLASSIFY", "glm-4.7-flash")
        self.model_zh = os.getenv("AI_MODEL_ANALYZE_ZH", "deepseek-v4-pro")
        self.model_en = os.getenv("AI_MODEL_ANALYZE_EN", "deepseek-v4-pro")

        # Filter thresholds - stricter than Tier 1
        self.design_relevance_threshold = 0.7  # 7/10 (Tier 1 is 6/10)
        self.quality_score_threshold = 7       # 7/10

    def _keyword_filter(self, item: Dict[str, Any], source_config: Dict[str, Any]) -> bool:
        """
        Stage 1: Keyword-based filtering

        Args:
            item: Content item with title, url, source, site_name
            source_config: Source configuration with optional filter_focus and exclude_topics

        Returns:
            True if item passes keyword filter, False otherwise
        """
        # Combine all text for keyword matching
        text = " ".join([
            item.get("title", ""),
            item.get("source", ""),
            item.get("site_name", ""),
            item.get("summary", "")
        ]).lower()

        # Check exclude_topics first (highest priority)
        exclude_topics = source_config.get("exclude_topics", [])
        if exclude_topics:
            for topic in exclude_topics:
                if topic.lower() in text:
                    return False

        # Build keyword list: BASE_KEYWORDS + filter_focus
        keywords = self.BASE_KEYWORDS.copy()
        filter_focus = source_config.get("filter_focus", [])
        if filter_focus:
            keywords.extend([kw.lower() for kw in filter_focus])

        # Check if any keyword matches
        for keyword in keywords:
            if keyword.lower() in text:
                return True

        return False

    def _glm_classify_batch(self, items: List[Dict[str, Any]]) -> List[bool]:
        """
        Stage 2: GLM-4-Flash batch classification (optimized)

        Process multiple items in one API call to reduce network overhead
        and avoid rate limiting.

        Args:
            items: List of content items with title, url, source

        Returns:
            List of booleans (True if relevant, False if not, None if error)
        """
        if not items:
            return []

        # Build batch classification prompt
        system_prompt = "你是一个AI内容分类器，专注于判断内容是否与AI+设计相关。"

        # Format items as numbered list
        items_text = []
        for i, item in enumerate(items, 1):
            items_text.append(f"{i}. 标题：{item.get('title', '')}，来源：{item.get('source', '')}")

        user_prompt = f"""请判断以下每条新闻是否与AI+设计相关。

新闻列表：
{chr(10).join(items_text)}

返回JSON数组格式（按序号对应）：
[
  {{"id": 1, "is_relevant": true, "reason": "简短原因"}},
  {{"id": 2, "is_relevant": false, "reason": "简短原因"}},
  ...
]

判断标准：
- AI工具、产品、技术相关
- 设计工具、UI/UX、创意应用相关
- 排除：纯硬件、纯金融、娱乐八卦"""

        try:
            response = self.glm_client.call_model(
                model=self.model_classify,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.1,
                max_tokens=1000  # Enough for batch response
            )

            content = response["content"]

            # Parse batch response
            import re

            # Try to extract JSON array
            results = None

            # Strategy 1: Direct JSON array parse
            try:
                results = json.loads(content)
            except json.JSONDecodeError:
                pass

            # Strategy 2: Find JSON array in content
            if not results:
                array_match = re.search(r'\[\s*\{.*?\}\s*\]', content, re.DOTALL)
                if array_match:
                    try:
                        results = json.loads(array_match.group(0))
                    except json.JSONDecodeError:
                        pass

            if not results or not isinstance(results, list):
                print(f"⚠️  GLM batch response unparseable, degrading to single-item mode")
                return [None] * len(items)  # Trigger fallback

            # Map results back to items
            output = []
            for i in range(len(items)):
                # Find matching result by id
                result = next((r for r in results if r.get("id") == i + 1), None)
                if result:
                    output.append(result.get("is_relevant", False))
                else:
                    output.append(None)  # Missing result, will fallback

            return output

        except QuotaExceededError as e:
            print(f"⚠️  GLM quota exceeded: {e}")
            return [None] * len(items)

        except RuntimeError as e:
            error_msg = str(e)
            if "1301" in error_msg or "不安全或敏感内容" in error_msg:
                print(f"⚠️  GLM content safety triggered")
                return [None] * len(items)
            if "1234" in error_msg or "网络错误" in error_msg:
                print(f"⚠️  GLM network error")
                return [None] * len(items)
            if "Connection error" in error_msg:
                print(f"⚠️  GLM connection error")
                return [None] * len(items)
            print(f"⚠️  GLM batch API error: {e}")
            return [None] * len(items)

        except Exception as e:
            print(f"⚠️  GLM batch classification error: {e}")
            return [None] * len(items)

    def _glm_classify(self, item: Dict[str, Any]) -> bool:
        """
        Stage 2: GLM-4-Flash fast classification

        Args:
            item: Content item with title, url, source

        Returns:
            True if GLM classifies as relevant, False otherwise
            None if GLM unavailable (triggers degradation to skip this stage)
        """
        # Build classification prompt (always Chinese)
        system_prompt = "你是一个AI内容分类器，专注于判断内容是否与AI+设计相关。"
        user_prompt = build_classification_prompt(
            title=item.get("title", ""),
            source=item.get("source", "")
        )

        try:
            response = self.glm_client.call_model(
                model=self.model_classify,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.1,  # Very low temperature for consistent classification
                max_tokens=200
            )

            # Parse GLM response
            # GLM-4.7-Flash reasoning_content may contain thought process + JSON
            content = response["content"]

            # Try multiple JSON extraction strategies
            import re
            classification = None

            # Strategy 1: Direct JSON parse (content is pure JSON)
            try:
                classification = json.loads(content)
            except json.JSONDecodeError:
                pass

            # Strategy 2: Find JSON object with "is_relevant" (greedy match)
            if not classification:
                json_match = re.search(r'\{[^{}]*"is_relevant"[^{}]*\}', content, re.DOTALL)
                if json_match:
                    try:
                        classification = json.loads(json_match.group(0))
                    except json.JSONDecodeError:
                        pass

            # Strategy 3: Find last JSON-like block
            if not classification:
                # Look for all JSON-like blocks and try the last one
                json_blocks = re.findall(r'\{[^{}]+\}', content, re.DOTALL)
                for block in reversed(json_blocks):
                    try:
                        test_obj = json.loads(block)
                        if "is_relevant" in test_obj:
                            classification = test_obj
                            break
                    except json.JSONDecodeError:
                        continue

            # Strategy 4: Look for key-value pattern
            if not classification:
                # Try to find: "is_relevant": true/false
                match = re.search(r'"is_relevant"\s*:\s*(true|false)', content, re.IGNORECASE)
                if match:
                    classification = {"is_relevant": match.group(1).lower() == "true"}

            if not classification:
                # Still can't parse - log and reject
                print(f"⚠️  GLM response unparseable, content preview: {content[:100]}...")
                return False

            # Return classification result
            return classification.get("is_relevant", False)

        except QuotaExceededError as e:
            # GLM quota exceeded - return None to trigger degradation
            print(f"⚠️  GLM quota exceeded, degrading to skip GLM stage: {e}")
            return None

        except RuntimeError as e:
            # GLM API errors
            error_msg = str(e)

            # Content safety errors - skip item
            if "1301" in error_msg or "不安全或敏感内容" in error_msg:
                print(f"⚠️  GLM content safety triggered, skipping item")
                return None

            # Network errors (1234) - degrade
            if "1234" in error_msg or "网络错误" in error_msg:
                print(f"⚠️  GLM network error, degrading")
                return None

            # Connection errors - degrade
            if "Connection error" in error_msg:
                print(f"⚠️  GLM connection error, degrading")
                return None

            # Other API errors - reject
            print(f"⚠️  GLM API error: {e}")
            return False

        except (json.JSONDecodeError, KeyError, Exception) as e:
            # JSON parsing or other errors - reject to be safe
            print(f"⚠️  GLM classification error: {e}")
            return False

    def _ai_deep_analysis(self, item: Dict[str, Any], source_config: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Stage 3: AI deep analysis

        Args:
            item: Content item with title, url, source, summary
            source_config: Source configuration with optional filter_focus and exclude_topics

        Returns:
            AI analysis result dict if accepted, None if rejected
        """
        # Detect language
        language = detect_language(
            title=item.get("title", ""),
            source=item.get("source", ""),
            site_name=item.get("site_name", "")
        )

        # Select model based on language
        model = self.model_zh if language == "zh" else self.model_en

        # Build analysis prompt
        system_prompt = "You are a professional AI content analyst specializing in design and technology."
        user_prompt = build_analysis_prompt(
            title=item.get("title", ""),
            source=item.get("source", ""),
            summary=item.get("summary"),
            filter_focus=source_config.get("filter_focus"),
            exclude_topics=source_config.get("exclude_topics"),
            language=language
        )

        try:
            response = self.easyrouter_client.call_model(
                model=model,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.3,
                max_tokens=500
            )

            # Parse AI response (robust JSON extraction)
            import re
            content = response["content"]
            ai_analysis = None

            # Strategy 1: Direct JSON parse
            try:
                ai_analysis = json.loads(content)
            except json.JSONDecodeError:
                pass

            # Strategy 2: Extract from first { to last }
            if not ai_analysis:
                first_brace = content.find('{')
                last_brace = content.rfind('}')
                if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
                    json_candidate = content[first_brace:last_brace+1]
                    try:
                        ai_analysis = json.loads(json_candidate)
                    except json.JSONDecodeError:
                        pass

            # Strategy 3: Find JSON with design_relevance (support nested arrays)
            if not ai_analysis:
                json_match = re.search(r'\{.*?"design_relevance".*?\}', content, re.DOTALL)
                if json_match:
                    try:
                        ai_analysis = json.loads(json_match.group(0))
                    except json.JSONDecodeError:
                        pass

            if not ai_analysis:
                print(f"⚠️  Tier 2 AI response unparseable or empty: {content[:100] if content else 'empty'}...")
                return None

            # Extract scores
            design_relevance = ai_analysis.get("design_relevance", 0)  # 0-10 scale
            quality_score = ai_analysis.get("quality_score", 0)        # 0-10 scale

            # Normalize design_relevance to 0-1 scale
            design_relevance_normalized = design_relevance / 10.0

            # Apply Tier 2 filter criteria (stricter than Tier 1)
            if design_relevance_normalized >= self.design_relevance_threshold or quality_score >= self.quality_score_threshold:
                return {
                    "design_relevance": design_relevance_normalized,
                    "quality_score": quality_score,
                    "categories": ai_analysis.get("categories", []),
                    "target_audience": ai_analysis.get("target_audience", ""),
                    "key_insights": ai_analysis.get("key_insights", ""),
                    "recommendation": ai_analysis.get("recommendation", "")
                }
            else:
                # Reject: low relevance and low quality
                return None

        except ValueError as e:
            # EasyRouter not configured - cannot do deep analysis
            if "EASYROUTER_API_KEY" in str(e):
                print(f"⚠️  EasyRouter not configured, skipping Tier 2 deep analysis")
                return None
            raise
        except (json.JSONDecodeError, KeyError, Exception) as e:
            # If analysis fails, reject to be safe
            print(f"⚠️  Tier 2 AI analysis failed: {e}")
            return None

    def process_batch(self, items: List[Dict[str, Any]], source_config: Dict[str, Any]) -> List[Optional[Dict[str, Any]]]:
        """
        Process multiple items through the three-stage pipeline (optimized).

        Uses batch GLM classification to reduce API calls and improve speed.

        Args:
            items: List of content items with title, url, source, site_name
            source_config: Source configuration dictionary (can be None)

        Returns:
            List of enriched items (None if rejected)
        """
        if source_config is None:
            source_config = {}

        # Stage 1: Keyword filter (fast, local)
        # Limit to 100 items for free AI (GLM) processing
        keyword_passed = []
        for item in items:
            if self._keyword_filter(item, source_config):
                keyword_passed.append(item)
                if len(keyword_passed) >= 100:  # Max 100 for free AI
                    break

        if not keyword_passed:
            return [None] * len(items)

        print(f"🔍 Tier 2 batch: {len(items)} items → {len(keyword_passed)} passed keyword filter")

        # Stage 2: Batch GLM classification
        glm_results = self._glm_classify_batch(keyword_passed)

        # Filter items that passed GLM
        glm_passed = []
        glm_failed_count = sum(1 for r in glm_results if r is None)

        # If more than 50% failed to parse, GLM is unavailable - reject all for safety
        if glm_failed_count > len(glm_results) * 0.5:
            print(f"⚠️  GLM batch failed (>{glm_failed_count}/{len(glm_results)} unparseable), rejecting all Tier 2 items")
            glm_passed = []  # Reject all instead of pass through
        else:
            for item, result in zip(keyword_passed, glm_results):
                if result is None:
                    # Individual item parse failure - reject to be safe
                    continue
                elif result is True:
                    # GLM accepted
                    glm_passed.append(item)
                # If False, item is rejected

        print(f"🤖 GLM batch classification: {len(keyword_passed)} items → {len(glm_passed)} passed")

        # Stage 3: EasyRouter deep analysis (still individual, needs detailed scoring)
        output = []
        for i, item in enumerate(items):
            if item not in glm_passed:
                output.append(None)
                continue

            ai_analysis = self._ai_deep_analysis(item, source_config)
            if ai_analysis is None:
                output.append(None)
                continue

            # Enrich item
            enriched_item = item.copy()
            enriched_item["_tier"] = 2
            enriched_item["ai_tier"] = 2
            enriched_item["_source_config"] = source_config
            enriched_item["ai_design_relevance"] = ai_analysis["design_relevance"]
            enriched_item["ai_quality_score"] = ai_analysis["quality_score"]
            enriched_item["ai_categories"] = ai_analysis["categories"]
            enriched_item["ai_target_audience"] = ai_analysis["target_audience"]
            enriched_item["ai_key_insights"] = ai_analysis["key_insights"]
            enriched_item["ai_recommendation"] = ai_analysis.get("recommendation", "")
            output.append(enriched_item)

        print(f"✅ Tier 2 batch complete: {len(items)} items → {len([x for x in output if x])} accepted")
        return output

    def process_item(self, item: Dict[str, Any], source_config: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Process a single item through the full three-stage pipeline.

        NOTE: For better performance, use process_batch() for multiple items.

        Args:
            item: Content item with title, url, source, site_name
            source_config: Source configuration dictionary (can be None)

        Returns:
            Enriched item with AI metadata if accepted, None if rejected
        """
        # Handle missing source_config
        if source_config is None:
            source_config = {}

        # Stage 1: Keyword filter
        if not self._keyword_filter(item, source_config):
            return None

        # Stage 2: GLM classification (with degradation support)
        glm_result = self._glm_classify(item)
        if glm_result is None:
            # GLM unavailable (quota exceeded) - skip this stage, proceed to deep analysis
            # This is a graceful degradation: keyword filter already passed
            print(f"ℹ️  Skipping GLM stage for: {item.get('title', 'unknown')[:50]}...")
        elif glm_result is False:
            # GLM explicitly rejected this item
            return None
        # If glm_result is True, continue to deep analysis

        # Stage 3: AI deep analysis
        ai_analysis = self._ai_deep_analysis(item, source_config)
        if ai_analysis is None:
            return None

        # All stages passed - enrich item with metadata
        enriched_item = item.copy()

        # Add tier tracking
        enriched_item["_tier"] = 2
        enriched_item["ai_tier"] = 2
        enriched_item["_source_config"] = source_config

        # Add AI analysis metadata
        enriched_item["ai_design_relevance"] = ai_analysis["design_relevance"]
        enriched_item["ai_quality_score"] = ai_analysis["quality_score"]
        enriched_item["ai_categories"] = ai_analysis["categories"]
        enriched_item["ai_target_audience"] = ai_analysis["target_audience"]
        enriched_item["ai_key_insights"] = ai_analysis["key_insights"]

        return enriched_item
