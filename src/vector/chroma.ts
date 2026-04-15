import { ChromaClient, Collection } from 'chromadb';
import { config } from '../config/index.js';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

let client: ChromaClient | null = null;
let chromaAvailable = true;

export function getChromaClient(): ChromaClient {
  if (!client) {
    // 确保目录存在
    const chromaPath = config.chromaPath;
    const dir = dirname(chromaPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // ChromaDB JS 1.8.x 使用服务器模式
    // path 可以是 HTTP URL 或本地路径
    // 本地路径需要 ChromaDB 服务器运行
    client = new ChromaClient({
      path: config.chromaPath,
    });
  }
  return client;
}

// 检查 ChromaDB 是否可用
export function isChromaAvailable(): boolean {
  return chromaAvailable;
}

// 标记 ChromaDB 不可用（连接失败时）
export function setChromaUnavailable(): void {
  chromaAvailable = false;
}

// 默认集合名称
export const WORLD_COLLECTION = 'world_knowledge';
export const CHARACTER_COLLECTION = 'character_profiles';

export async function getOrCreateCollection(
  name: string
): Promise<Collection> {
  const chroma = getChromaClient();
  return await chroma.getOrCreateCollection({ name });
}

// 便捷封装：添加世界观知识
export async function addWorldKnowledge(
  texts: string[],
  embeddings: number[][],
  metadatas: Record<string, string>[]
): Promise<void> {
  if (!chromaAvailable) {
    console.warn('[ChromaDB] 未连接，跳过添加世界观知识');
    return;
  }
  try {
    const collection = await getOrCreateCollection(WORLD_COLLECTION);
    await collection.add({
      ids: texts.map((_, i) => `world_${Date.now()}_${i}`),
      embeddings,
      documents: texts,
      metadatas,
    });
  } catch (err) {
    console.error('[ChromaDB] 添加世界观知识失败:', err);
    setChromaUnavailable();
  }
}

// 便捷封装：语义检索
export async function searchWorldKnowledge(
  query: string,
  nResults: number = 5
): Promise<{ documents: string[]; metadatas: Record<string, string>[] }> {
  if (!chromaAvailable) {
    console.warn('[ChromaDB] 未连接，返回空结果');
    return { documents: [], metadatas: [] };
  }
  try {
    const collection = await getOrCreateCollection(WORLD_COLLECTION);
    const results = await collection.query({
      queryTexts: [query],
      nResults,
    });
    return {
      documents: (results.documents[0] || []).filter((d): d is string => d !== null),
      metadatas: (results.metadatas?.[0] || []) as Record<string, string>[],
    };
  } catch (err) {
    console.error('[ChromaDB] 语义检索失败:', err);
    setChromaUnavailable();
    return { documents: [], metadatas: [] };
  }
}
