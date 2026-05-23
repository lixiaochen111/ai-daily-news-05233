"""EasyRouter API client wrapper for unified LLM access.

This module provides a simple wrapper around EasyRouter's OpenAI-compatible API
to access models like GLM-4-Flash, DeepSeek-V4 Pro, and GPT-4o Mini.
"""

import os
from typing import Any, Dict

import requests


class EasyRouterClient:
    """Client for interacting with EasyRouter API.

    Reads configuration from environment variables:
    - EASYROUTER_API_KEY: API key for authentication
    - EASYROUTER_BASE_URL: Base URL for the API (e.g., https://api.easyrouter.ai/v1)
    """

    def __init__(self):
        """Initialize EasyRouter client with environment variables."""
        self.api_key = os.environ.get('EASYROUTER_API_KEY')
        self.base_url = os.environ.get('EASYROUTER_BASE_URL')

        # Note: Don't raise error here - let it fail lazily when actually called
        # This allows the system to work with only GLM (free tier)

    def call_model(
        self,
        model: str,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 500
    ) -> Dict[str, Any]:
        """Call a model via EasyRouter API.

        Args:
            model: Model identifier (e.g., 'gpt-4o-mini', 'glm-4-flash')
            system_prompt: System prompt to set model behavior
            user_prompt: User prompt/query
            temperature: Sampling temperature (0-1)
            max_tokens: Maximum tokens in response

        Returns:
            Dictionary containing:
                - content: Model response text
                - tokens: Total tokens used

        Raises:
            Exception: If API call fails
        """
        # Check if configured at call time (lazy validation)
        if not self.api_key:
            raise ValueError('EASYROUTER_API_KEY environment variable is required for deep analysis')
        if not self.base_url:
            raise ValueError('EASYROUTER_BASE_URL environment variable is required for deep analysis')

        url = f"{self.base_url}/chat/completions"
        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        }

        payload = {
            'model': model,
            'messages': [
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_prompt}
            ],
            'temperature': temperature,
            'max_tokens': max_tokens
        }

        try:
            response = requests.post(url, json=payload, headers=headers, timeout=30)
            response.raise_for_status()

            data = response.json()

            return {
                'content': data['choices'][0]['message']['content'],
                'tokens': data['usage']['total_tokens']
            }
        except requests.exceptions.RequestException as e:
            raise Exception(f'EasyRouter API call failed: {str(e)}') from e
        except (KeyError, IndexError) as e:
            raise Exception(f'Unexpected API response format: {str(e)}') from e
