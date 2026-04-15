/**
 * 从 LLM 响应中解析 JSON
 * 支持从自由文本中提取 JSON 对象
 *
 * @param response - LLM 返回的原始文本
 * @param fallback - 解析失败时返回的默认值
 * @returns 解析后的对象或默认值
 */
export function parseJsonResponse<T>(response: string, fallback: T): T {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    console.error('[LLM] JSON 解析失败:', err);
  }
  return fallback;
}
