import base64
import json
import os
from pathlib import Path
import re
from typing import Any, Dict, Optional

from dotenv import dotenv_values, load_dotenv
import requests

from prompts import (
    build_diagnosis_prompt,
    build_emotion_chat_system_prompt,
    build_system_prompt,
    build_user_prompt,
)


class AIServiceError(Exception):
    pass


class AIClient:
    def __init__(self, api_key: str, model: str, base_url: Optional[str] = None) -> None:
        self.api_key = api_key
        self.model = model
        self.base_url = (base_url or "https://aiping.cn/api/v1").rstrip("/")

    @classmethod
    def from_env(cls) -> "AIClient":
        env_path = Path(__file__).resolve().with_name(".env")
        file_env = dotenv_values(env_path)

        # Load local .env first, then optional external defaults.
        load_dotenv(dotenv_path=env_path)
        load_dotenv()

        # Project-local .env has highest priority to avoid external env overriding provider config.
        api_key = (file_env.get("AI_API_KEY") or os.getenv("AI_API_KEY") or "").strip()
        model = (file_env.get("AI_MODEL") or os.getenv("AI_MODEL") or "GLM-4.7-Flash").strip()
        base_url = (file_env.get("AI_BASE_URL") or os.getenv("AI_BASE_URL") or "").strip() or None

        if not api_key:
            raise AIServiceError("未配置 AI_API_KEY，请先在 .env 中填写你的平台密钥。")
        return cls(api_key=api_key, model=model, base_url=base_url)

    def generate_rebound_report(
        self,
        *,
        reject_text: str,
        resume_text: str,
        job_desc: str,
        tone: str,
        company_name: str,
        reject_image: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        user_prompt = build_user_prompt(
            reject_text=reject_text,
            resume_text=resume_text,
            job_desc=job_desc,
            tone=tone,
            company_name=company_name,
        )

        user_content: list[dict[str, Any]] = [{"type": "text", "text": user_prompt}]

        if reject_image:
            b64 = base64.b64encode(reject_image["bytes"]).decode("utf-8")
            image_url = f"data:{reject_image['content_type']};base64,{b64}"
            user_content.append(
                {
                    "type": "text",
                    "text": "附加了一张拒信截图，请你识别关键信息后再分析。",
                }
            )
            user_content.append(
                {
                    "type": "image_url",
                    "image_url": {"url": image_url},
                }
            )

        payload = {
            "model": self.model,
            "temperature": 0.8,
            "messages": [
                {"role": "system", "content": build_system_prompt()},
                {"role": "user", "content": user_content},
            ],
            "response_format": {"type": "json_object"},
        }

        raw = self._post_chat_completion(payload)

        parsed = self._parse_report_json(raw)
        parsed = self._normalize_report(parsed, raw)

        self._validate(parsed)
        return parsed

    def generate_emotion_chat_reply(
        self,
        *,
        flavor: str,
        message: str,
        history: Optional[list[Dict[str, str]]] = None,
    ) -> str:
        safe_flavor = flavor if flavor in {"vent", "heal"} else "heal"
        messages: list[Dict[str, Any]] = [
            {"role": "system", "content": build_emotion_chat_system_prompt(safe_flavor)}
        ]

        if history:
            for item in history[-10:]:
                role = str(item.get("role") or "").strip().lower()
                content = str(item.get("text") or "").strip()
                if role not in {"user", "assistant"} or not content:
                    continue
                messages.append({"role": role, "content": content})

        messages.append({"role": "user", "content": message})

        payload = {
            "model": self.model,
            "temperature": 0.85,
            "messages": messages,
        }
        reply = self._post_chat_completion(payload).strip()
        if not reply:
            raise AIServiceError("AI 未返回有效回复，请稍后重试。")
        return reply

    def generate_track_diagnosis(self, *, track: str, pain_point: str, language: str) -> Dict[str, Any]:
        safe_track = "algo" if track == "algo" else "knowledge"
        safe_language = self._normalize_language(language)
        prompt = build_diagnosis_prompt(track=safe_track, pain_point=pain_point, language=safe_language)

        payload = {
            "model": self.model,
            "temperature": 0.7,
            "messages": [
                {
                    "role": "system",
                    "content": "你是一位严谨的面试教练。请严格返回 JSON 对象，不要输出 markdown。",
                },
                {"role": "user", "content": prompt},
            ],
            "response_format": {"type": "json_object"},
        }

        raw = self._post_chat_completion(payload)
        parsed = self._parse_json_object(raw)
        return self._normalize_diagnosis(parsed, safe_track, safe_language)

    def _normalize_language(self, language: str) -> str:
        value = (language or "").strip().lower()
        allowed = {"java", "cpp", "python", "go", "javascript"}
        return value if value in allowed else "java"

    def _parse_report_json(self, raw: str) -> Dict[str, Any]:
        return self._parse_json_object(raw)

    def _parse_json_object(self, raw: str) -> Dict[str, Any]:
        # 1) 优先解析严格JSON
        try:
            data = json.loads(raw)
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            pass

        # 2) 兼容```json ... ```代码块
        fence = re.search(r"```(?:json)?\s*(\{[\s\S]*\})\s*```", raw, flags=re.IGNORECASE)
        if fence:
            try:
                data = json.loads(fence.group(1))
                if isinstance(data, dict):
                    return data
            except json.JSONDecodeError:
                pass

        # 3) 兜底提取首个{...}片段
        start = raw.find("{")
        end = raw.rfind("}")
        if start != -1 and end != -1 and end > start:
            chunk = raw[start : end + 1]
            try:
                data = json.loads(chunk)
                if isinstance(data, dict):
                    return data
            except json.JSONDecodeError:
                pass

        preview = raw.strip().replace("\n", " ")[:240]
        raise AIServiceError(f"AI 返回格式异常，无法解析为JSON。原始片段：{preview}")

    def _normalize_diagnosis(self, data: Dict[str, Any], track: str, language: str) -> Dict[str, Any]:
        normalized: Dict[str, Any] = dict(data)

        normalized["analysis"] = str(normalized.get("analysis") or "请补充具体问题后重试。")
        normalized["concept"] = str(normalized.get("concept") or "核心概念待补充")
        normalized["action"] = str(normalized.get("action") or "建议先拆解问题，再做小步练习。")

        insights = normalized.get("insights")
        if not isinstance(insights, list) or not insights:
            normalized["insights"] = [
                {
                    "user": "Prep_User_01",
                    "title": "同类问题复盘：从卡点到可复述",
                    "stats": "1.2k 阅读 · 60 收藏",
                },
                {
                    "user": "Prep_User_02",
                    "title": "高频追问拆解与答题模板",
                    "stats": "980 阅读 · 44 收藏",
                },
                {
                    "user": "Prep_User_03",
                    "title": "一周针对性训练记录",
                    "stats": "760 阅读 · 39 收藏",
                },
            ]

        resources = normalized.get("resources")
        if not isinstance(resources, list) or not resources:
            normalized["resources"] = [
                {"text": "系统化学习清单", "type": "book", "link": "#"},
                {"text": "高频问题图谱", "type": "chart", "link": "#"},
                {"text": "实战练习模板", "type": "file", "link": "#"},
            ]

        if track == "algo":
            code_fallback = "// 暂无代码，建议补充题目细节"
            if language == "python":
                code_fallback = "# 暂无代码，建议补充题目细节"
            normalized["code"] = str(normalized.get("code") or code_fallback)

        return normalized

    def _normalize_report(self, data: Dict[str, Any], raw: str) -> Dict[str, Any]:
        # 部分模型在结构化输出不稳定时，补齐最小字段避免直接500。
        normalized = dict(data)

        if not isinstance(normalized.get("comfort"), str):
            normalized["comfort"] = str(normalized.get("comfort") or "先稳住情绪，你不是被否定，而是这次匹配度未命中。")

        if not isinstance(normalized.get("reverse_roast"), str):
            normalized["reverse_roast"] = str(normalized.get("reverse_roast") or "这不是你不行，是岗位与阶段目标不一致。")

        if not isinstance(normalized.get("analysis"), (dict, list, str)):
            normalized["analysis"] = "建议围绕技能匹配、项目表达、岗位关键词进行复盘。"

        if not isinstance(normalized.get("rebound_plan"), (dict, list, str)):
            normalized["rebound_plan"] = "第1周补短板，第2周改简历，第3周模拟面试，第4周定向投递。"

        alt_roles = normalized.get("alt_roles")
        if not isinstance(alt_roles, list):
            normalized["alt_roles"] = [
                "同赛道相邻岗位",
                "技能重合度更高岗位",
                "门槛更匹配的进阶岗位",
            ]
        elif len(alt_roles) == 0:
            normalized["alt_roles"] = [
                "同赛道相邻岗位",
                "技能重合度更高岗位",
                "门槛更匹配的进阶岗位",
            ]

        # 对象被塞进字符串时，尽量保留原始信息，便于前端展示与排错。
        if isinstance(normalized.get("analysis"), str) and len(normalized["analysis"].strip()) < 2:
            normalized["analysis"] = raw[:1200]

        return normalized

    def _post_chat_completion(self, payload: Dict[str, Any]) -> str:
        url = f"{self.base_url}/chat/completions"

        # AI Ping文档示例使用原始API Key；部分平台要求Bearer前缀，这里做一次401回退。
        header_candidates = [
            {"Authorization": self.api_key, "Content-Type": "application/json"},
            {
                "Authorization": self.api_key
                if self.api_key.lower().startswith("bearer ")
                else f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
        ]

        errors: list[str] = []
        for headers in header_candidates:
            try:
                resp = requests.post(url, headers=headers, json=payload, timeout=90)
            except requests.RequestException as exc:
                raise AIServiceError(f"AI 服务调用失败（base_url={self.base_url}）：{exc}") from exc

            if resp.status_code == 401:
                errors.append(f"认证失败({resp.status_code})：{resp.text}")
                continue

            if resp.status_code >= 400:
                snippet = resp.text[:600]
                low = snippet.lower()
                if "vision not support" in low or "model features vision" in low:
                    raise AIServiceError("当前模型不支持图片识别，请移除截图后重试，或切换支持视觉能力的模型。")
                raise AIServiceError(f"AI 服务返回异常({resp.status_code})：{snippet}")

            try:
                body = resp.json()
            except ValueError as exc:
                raise AIServiceError("AI 返回了非JSON响应，请检查接口地址是否正确。") from exc

            choices = body.get("choices") if isinstance(body, dict) else None
            if not choices:
                raise AIServiceError("AI 未返回 choices 字段，请检查模型或接口兼容性。")

            message = choices[0].get("message", {}) if isinstance(choices[0], dict) else {}
            content = message.get("content")
            if isinstance(content, str):
                return content

            if isinstance(content, list):
                text_parts: list[str] = []
                for part in content:
                    if isinstance(part, dict) and part.get("type") == "text" and isinstance(part.get("text"), str):
                        text_parts.append(part["text"])
                merged = "".join(text_parts).strip()
                if merged:
                    return merged

            raise AIServiceError("AI 未返回有效文本内容。")

        raise AIServiceError("; ".join(errors) or "AI 认证失败，请检查 API Key。")

    def _validate(self, data: Dict[str, Any]) -> None:
        needed = ["comfort", "reverse_roast", "analysis", "rebound_plan", "alt_roles"]
        for key in needed:
            if key not in data:
                raise AIServiceError(f"AI 返回缺少字段：{key}")
