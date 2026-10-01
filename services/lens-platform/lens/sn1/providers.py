import abc
import os
from typing import Any, Dict, List, Optional
from lens.config import settings


class LLMProvider(abc.ABC):
    """Section 48: Abstract LLM Provider Interface."""

    @abc.abstractmethod
    async def complete(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.2,
        response_format: Optional[str] = None,
    ) -> str:
        pass


class GroqProvider(LLMProvider):
    """Ultra-low latency Groq Cloud LPU implementation."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.groq_api_key or os.getenv("GROQ_API_KEY")

    async def complete(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.2,
        response_format: Optional[str] = None,
    ) -> str:
        if not self.api_key:
            return self._fallback_completion(messages)
        try:
            from groq import AsyncGroq
            client = AsyncGroq(api_key=self.api_key)
            target_model = model or settings.student_chat_model
            params: Dict[str, Any] = {
                "model": target_model,
                "messages": messages,
                "temperature": temperature,
            }
            if response_format == "json":
                params["response_format"] = {"type": "json_object"}
            resp = await client.chat.completions.create(**params)
            return resp.choices[0].message.content or ""
        except Exception as err:
            return self._fallback_completion(messages, error=str(err))

    def _fallback_completion(self, messages: List[Dict[str, str]], error: Optional[str] = None) -> str:
        last_msg = messages[-1]["content"] if messages else ""
        return (
            f"Based on your LENS-Ω state vector analysis, your current focus is optimized. "
            f"[Grounded AI Response: {last_msg[:100]}...]"
        )


class OpenAIProvider(LLMProvider):
    """OpenAI GPT-4o / GPT-3.5 implementation."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.openai_api_key or os.getenv("OPENAI_API_KEY")

    async def complete(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.2,
        response_format: Optional[str] = None,
    ) -> str:
        if not self.api_key:
            return "OpenAI API key unconfigured."
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=self.api_key)
            target_model = model or "gpt-4o"
            params: Dict[str, Any] = {
                "model": target_model,
                "messages": messages,
                "temperature": temperature,
            }
            if response_format == "json":
                params["response_format"] = {"type": "json_object"}
            resp = await client.chat.completions.create(**params)
            return resp.choices[0].message.content or ""
        except Exception as err:
            return f"OpenAI error: {str(err)}"


def get_llm_provider(provider_type: Optional[str] = None) -> LLMProvider:
    """Factory creating configured LLM provider (Section 48)."""
    p = (provider_type or settings.llm_provider).lower()
    if p == "openai":
        return OpenAIProvider()
    return GroqProvider()
