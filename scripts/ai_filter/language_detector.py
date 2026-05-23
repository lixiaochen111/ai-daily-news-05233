import re
from typing import Literal


# Whitelist mappings
CN_SOURCES = {'少数派', '掘金', '优设网', 'sspai', 'juejin', 'uisdc', 'ai hot', 'aihot', '秋芝2046'}
EN_SOURCES = {'openai', 'anthropic', 'google', 'figma', 'ux collective', 'codrops',
              'awwwards', 'muzli', 'sidebar', 'webdesigner'}


def detect_language(title: str, source: str, site_name: str) -> Literal["zh", "en"]:
    """
    Detect content language by whitelist + character ratio.

    Args:
        title: Article title
        source: Source name
        site_name: Site domain name

    Returns:
        "zh" for Chinese, "en" for English
    """
    combined_text = f"{title} {source} {site_name}".lower()

    # Check whitelist first (highest priority)
    for cn_keyword in CN_SOURCES:
        if cn_keyword in combined_text:
            return "zh"

    for en_keyword in EN_SOURCES:
        if en_keyword in combined_text:
            return "en"

    # Fallback: character ratio analysis
    chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', combined_text))
    english_chars = len(re.findall(r'[a-zA-Z]', combined_text))
    total_chars = chinese_chars + english_chars

    if total_chars == 0:
        return "en"  # Default to English if no detectable characters

    chinese_ratio = chinese_chars / total_chars

    # >12% Chinese = zh, otherwise en
    return "zh" if chinese_ratio > 0.12 else "en"
