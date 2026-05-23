"""
GLM API Client

Wrapper for Zhipu AI's GLM-4.7-Flash model (free tier).
Uses Zhipu AI's official SDK.

Default API key is provided for all users (shared quota).
Users can optionally configure their own key for dedicated quota.
"""

import os
import time

try:
    from zhipuai import ZhipuAI
except ImportError:
    # Fallback to OpenAI SDK (may have compatibility issues)
    from openai import OpenAI
    ZhipuAI = None


class GLMClient:
    """
    Client for accessing Zhipu AI's GLM models via OpenAI-compatible API.

    Official documentation: https://docs.bigmodel.cn/cn/guide/models/free/glm-4.7-flash

    Features:
    - Default shared API key (no configuration needed)
    - Optional user-provided key for dedicated quota
    - Request rate limiting protection
    - Graceful degradation on quota exhaustion
    """

    # Default shared API key (provided by project)
    # All users share this free quota
    DEFAULT_API_KEY = "a6a06824dfbf42b29e5af74334bbeb6f.BMbBvfB7obgYbgTG"

    # Rate limiting: max requests per minute (shared quota protection)
    MAX_REQUESTS_PER_MINUTE = 30

    def __init__(self, api_key=None):
        """
        Initialize GLM client.

        Args:
            api_key: Optional Zhipu AI API key.
                     Priority: passed key > env var > default shared key
        """
        # Priority: explicit parameter > environment variable > default
        self.api_key = (
            api_key or
            os.getenv("GLM_API_KEY") or
            self.DEFAULT_API_KEY
        )

        # Track if using default shared key
        self.using_shared_key = (self.api_key == self.DEFAULT_API_KEY)

        # Initialize Zhipu AI client
        if ZhipuAI:
            # Use official Zhipu AI SDK (preferred)
            self.client = ZhipuAI(api_key=self.api_key)
            self.using_official_sdk = True
        else:
            # Fallback to OpenAI SDK (compatibility not guaranteed)
            self.client = OpenAI(
                api_key=self.api_key,
                base_url="https://open.bigmodel.cn/api/paas/v4"
            )
            self.using_official_sdk = False

        # Rate limiting state
        self._request_times = []

    def _check_rate_limit(self):
        """
        Check and enforce rate limiting.

        Returns:
            bool: True if request is allowed, False if rate limit exceeded
        """
        now = time.time()

        # Remove requests older than 1 minute
        self._request_times = [t for t in self._request_times if now - t < 60]

        # Check if limit exceeded
        if len(self._request_times) >= self.MAX_REQUESTS_PER_MINUTE:
            return False

        # Record this request
        self._request_times.append(now)
        return True

    def call_model(
        self,
        model="glm-4.7-flash",
        system_prompt="",
        user_prompt="",
        temperature=0.7,
        max_tokens=2000
    ):
        """
        Call GLM model with given prompts.

        Args:
            model: Model identifier (default: glm-4.7-flash)
            system_prompt: System prompt to set model behavior
            user_prompt: User prompt/query
            temperature: Sampling temperature (0.0-1.0)
            max_tokens: Maximum tokens in response

        Returns:
            dict: Response with 'content' and 'usage' keys

        Raises:
            RuntimeError: If API call fails
            QuotaExceededError: If rate limit or quota exceeded
        """
        # Check rate limit (only for shared key)
        if self.using_shared_key and not self._check_rate_limit():
            raise QuotaExceededError(
                "Rate limit exceeded for shared GLM quota. "
                "Please wait a moment or configure your own API key."
            )

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": user_prompt})

        try:
            response = self.client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens
            )

            # GLM-4.7-Flash returns content in reasoning_content, not content
            message = response.choices[0].message
            content = message.content or message.reasoning_content or ""

            return {
                "content": content,
                "usage": {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens
                }
            }
        except Exception as e:
            error_msg = str(e)

            # Check for quota/rate limit errors
            if "429" in error_msg or "1305" in error_msg or "访问量过大" in error_msg:
                raise QuotaExceededError(
                    f"GLM quota or rate limit exceeded: {error_msg}"
                )

            # Other errors
            raise RuntimeError(f"GLM API call failed: {error_msg}")


class QuotaExceededError(Exception):
    """Raised when GLM quota or rate limit is exceeded."""
    pass
