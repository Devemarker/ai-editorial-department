import { describe, it, expect } from 'vitest';
import { skipLLM } from '../../tests/setup.js';

describe('LLM Provider', () => {
  if (skipLLM) {
    it.skip('需要 OPENAI_API_KEY 环境变量才能运行', () => {});
    return;
  }

  it('应能生成嵌入向量', async () => {
    const { llm } = await import('../llm/openai.js');
    const embeddings = await llm.embed(['hello world']);
    expect(embeddings).toHaveLength(1);
    // text-embedding-3-small 维度是 1536
    expect(embeddings[0]).toHaveLength(1536);
  });

  it('应能生成文本', async () => {
    const { llm } = await import('../llm/openai.js');
    const response = await llm.complete('Say "test" only', { maxTokens: 10 });
    expect(response.text.toLowerCase()).toContain('test');
  });
});
