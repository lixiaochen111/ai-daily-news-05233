"""
三级白名单路由器
根据来源配置将内容分类到不同处理层级
"""
import yaml
from typing import Tuple, Optional, Dict, Any


class WhitelistRouter:
    """
    三级白名单路由器

    根据source、url、title匹配patterns，返回：
    - tier级别：-1（黑名单），0（直接发布），1（AI分析），2（完整筛选）
    - source_config：匹配到的源配置字典
    """

    def __init__(self, config_path: str = "config/source-whitelist.yaml"):
        """
        初始化路由器

        Args:
            config_path: 白名单配置文件路径
        """
        with open(config_path, 'r', encoding='utf-8') as f:
            self.config = yaml.safe_load(f)

        # 加载各层级源配置
        self.tier_0_sources = self.config.get("tier_0_sources", [])
        self.tier_1_sources = self.config.get("tier_1_sources", [])
        self.tier_2_sources = self.config.get("tier_2_sources", [])
        self.blacklist_sources = self.config.get("blacklist_sources", [])

    def classify_item(self, item: Dict[str, Any]) -> Tuple[int, Optional[Dict]]:
        """
        分类内容到对应tier

        匹配优先级：
        1. 黑名单（最高优先级） → -1
        2. Tier 0（编辑精选源） → 0
        3. Tier 1（高质量源） → 1
        4. Tier 2（广域官方源） → 2
        5. 未匹配源（默认） → 2

        Args:
            item: 内容项，包含source、url、title字段

        Returns:
            (tier_level, source_config):
            - tier_level: -1（黑名单），0（直接发布），1（AI分析），2（完整筛选）
            - source_config: 匹配到的源配置字典，未匹配或黑名单时为None
        """
        # 提取字段并转小写用于不区分大小写匹配
        source = item.get("source", "").lower()
        url = item.get("url", "").lower()
        title = item.get("title", "").lower()

        # 组合所有字段用于模式匹配
        combined = f"{source} {url} {title}"

        # 1. 检查黑名单（最高优先级）
        for blacklist_item in self.blacklist_sources:
            patterns = blacklist_item.get("patterns", [])
            for pattern in patterns:
                if pattern.lower() in combined:
                    # 黑名单返回配置信息（包含reason）
                    return (-1, blacklist_item)

        # 2. 检查 Tier 0（编辑精选源）
        for source_config in self.tier_0_sources:
            patterns = source_config.get("patterns", [])
            for pattern in patterns:
                if pattern.lower() in combined:
                    return (0, source_config)

        # 3. 检查 Tier 1（高质量源）
        for source_config in self.tier_1_sources:
            patterns = source_config.get("patterns", [])
            for pattern in patterns:
                if pattern.lower() in combined:
                    return (1, source_config)

        # 4. 检查 Tier 2（广域官方源）
        for source_config in self.tier_2_sources:
            patterns = source_config.get("patterns", [])
            for pattern in patterns:
                if pattern.lower() in combined:
                    return (2, source_config)

        # 5. 默认：未知源 → Tier 2（完整筛选）
        return (2, None)
