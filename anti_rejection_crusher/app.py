import os
import json
from typing import Any

from flask import Flask, jsonify, render_template, request
from werkzeug.exceptions import RequestEntityTooLarge

from ai_client import AIClient, AIServiceError


app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 8 * 1024 * 1024


@app.errorhandler(RequestEntityTooLarge)
def handle_file_too_large(_: RequestEntityTooLarge) -> Any:
    return jsonify({"error": "请求体过大，请精简内容后重试。"}), 413


@app.route("/")
def index() -> str:
    return render_template("index.html")


@app.route("/health")
def health() -> Any:
    return jsonify({"ok": True})


@app.route("/health/ai")
def health_ai() -> Any:
    try:
        client = AIClient.from_env()
        return jsonify({"ok": True, "base_url": client.base_url, "model": client.model})
    except AIServiceError as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


@app.route("/api/rebound", methods=["POST"])
def rebound() -> Any:
    reject_text = (request.form.get("reject_text") or "").strip()
    resume_text = (request.form.get("resume_text") or "").strip()
    job_desc = (request.form.get("job_desc") or "").strip()
    tone = (request.form.get("tone") or "高情商")
    company_name = (request.form.get("company_name") or "这家公司").strip() or "这家公司"

    if not reject_text:
        return jsonify({"error": "请至少输入拒信内容。"}), 400
    if not resume_text:
        return jsonify({"error": "请粘贴简历内容，便于复盘分析。"}), 400
    if not job_desc:
        return jsonify({"error": "请粘贴岗位要求，便于归因分析。"}), 400

    try:
        client = AIClient.from_env()
        data = client.generate_rebound_report(
            reject_text=reject_text,
            resume_text=resume_text,
            job_desc=job_desc,
            tone=tone,
            company_name=company_name,
            reject_image=None,
        )
        return jsonify(data)
    except AIServiceError as exc:
        return jsonify({"error": str(exc)}), 500
    except Exception:
        return jsonify({"error": "服务暂时开小差了，请稍后再试。"}), 500


@app.route("/api/chat", methods=["POST"])
def chat() -> Any:
    payload = request.get_json(silent=True) or {}
    message = str(payload.get("message") or "").strip()
    flavor = str(payload.get("flavor") or "heal").strip().lower()
    history_raw = payload.get("history")

    history: list[dict[str, str]] = []
    if isinstance(history_raw, list):
        history = [item for item in history_raw if isinstance(item, dict)]

    if not message:
        return jsonify({"error": "请输入内容后再发送。"}), 400

    try:
        client = AIClient.from_env()
        reply = client.generate_emotion_chat_reply(flavor=flavor, message=message, history=history)
        return jsonify({"reply": reply})
    except AIServiceError as exc:
        return jsonify({"error": str(exc)}), 500
    except Exception:
        return jsonify({"error": "聊天服务暂时不可用，请稍后再试。"}), 500


@app.route("/api/diagnose", methods=["POST"])
def diagnose() -> Any:
    data = request.get_json(silent=True)
    if data is None:
        # 兼容 form-data
        data = {
            "track": request.form.get("track"),
            "language": request.form.get("language"),
            "pain_point": request.form.get("pain_point"),
        }

    track = str(data.get("track") or "knowledge").strip().lower()
    language = str(data.get("language") or "java").strip().lower()
    pain_point = str(data.get("pain_point") or "").strip()

    if not pain_point:
        return jsonify({"error": "请先输入你遇到的痛点问题。"}), 400

    try:
        client = AIClient.from_env()
        result = client.generate_track_diagnosis(track=track, pain_point=pain_point, language=language)
        # 保证返回可序列化对象
        return jsonify(json.loads(json.dumps(result, ensure_ascii=False)))
    except AIServiceError as exc:
        return jsonify({"error": str(exc)}), 500
    except Exception:
        return jsonify({"error": "诊断服务暂时不可用，请稍后再试。"}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=True)
