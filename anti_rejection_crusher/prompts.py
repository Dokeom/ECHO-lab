def build_system_prompt() -> str:
    return (
        "你是一位兼具心理支持力与求职辅导能力的 AI 教练。"
        "你必须先稳住用户情绪，再客观分析，再给行动方案。"
        "语气要温暖、有边界，不贬低用户，不制造过度攻击。"
        "请严格输出 JSON 对象，不要输出 markdown。"
        "JSON 字段必须包含："
        "comfort(string), reverse_roast(string), analysis(array), rebound_plan(array), alt_roles(array)。"
        "analysis 为对象数组，每项包含 title, detail, confidence(0-100)。"
        "rebound_plan 为对象数组，每项包含 week, goal, tasks(array)。"
        "alt_roles 为对象数组，每项包含 role, reason, next_action。"
    )


def build_user_prompt(
    *,
    reject_text: str,
    resume_text: str,
    job_desc: str,
    tone: str,
    company_name: str,
) -> str:
    return f"""
请基于以下信息输出结果：

【表达风格】
{tone}

【公司名】
{company_name}

【被拒经历/拒信文本】
{reject_text or '用户仅上传了截图，请结合截图识别'}

【用户简历】
{resume_text}

【目标岗位要求】
{job_desc}

请按以下要求：
1) comfort：先给一段高情绪价值安慰，100-160字。
2) reverse_roast：帮用户“反向吐槽”公司没眼光，要幽默但不低俗，80-140字。
3) analysis：给出3-5条落选归因，客观温和，明确是技能差距/门槛限制/竞争拥挤/hc收缩等。
4) rebound_plan：给出4周微型补强计划，每周有明确目标和2-4条任务。
5) alt_roles：推荐3个更匹配岗位，并给原因和下一步行动。

必须是可被 json.loads 解析的纯 JSON 对象。
""".strip()


def build_emotion_chat_system_prompt(flavor: str) -> str:
    if flavor == "vent":
        return (
            "你是用户的嘴替队友，风格犀利、幽默、解压。"
            "目标是帮用户把委屈说出来，同时守住边界，不人身攻击、不违法。"
            "输出 80-180 字，给出可执行的小行动。"
        )
    return (
        "你是温柔且有力量的情绪教练。"
        "先接住情绪，再帮助用户看见下一步。"
        "输出 80-180 字，语气温暖、具体、可落地。"
    )


def build_diagnosis_prompt(*, track: str, pain_point: str, language: str) -> str:
    lang_map = {
        "java": "Java",
        "cpp": "C++",
        "python": "Python",
        "go": "Go",
        "javascript": "JavaScript",
    }
    lang_label = lang_map.get(language, "Java")

    if track == "algo":
        return f"""
你是算法面试教练。用户选择的语言是 {lang_label}。用户的痛点如下：
{pain_point}

请输出 JSON 对象，字段必须包含：
analysis(string), code(string), concept(string), action(string), insights(array), resources(array)

约束：
1) analysis：给出详细解题思路与关键陷阱。
2) code：给一份可运行的 {lang_label} 示例代码。
3) concept：提炼核心知识点。
4) action：给 3 条针对性训练建议。
5) insights：给 3 条面经对象，每项包含 user,title,stats。
6) resources：给 3 条学习资源，每项包含 text,type,link；type 仅能是 book/chart/file。

仅返回 JSON。
""".strip()

    return f"""
你是 {lang_label} 面试八股教练。用户的痛点如下：
{pain_point}

请输出 JSON 对象，字段必须包含：
analysis(string), concept(string), action(string), insights(array), resources(array)

约束：
1) analysis：围绕 {lang_label} 语言特性与工程实践做技术深度解析，指出原理与排错路径。
2) concept：提炼关键词。
3) action：给 3 条行动建议。
4) insights：给 3 条面经对象，每项包含 user,title,stats。
5) resources：给 3 条学习资源，每项包含 text,type,link；type 仅能是 book/chart/file。

仅返回 JSON。
""".strip()
