/**
 * 生成唯一 ID
 * @param prefix - ID 前缀，默认为 'id'
 * @returns 格式: prefix_timestamp_randomString
 */
export function generateId(prefix: string = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
