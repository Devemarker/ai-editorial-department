import type { Collection } from 'chromadb';
import { getChromaClient, WORLD_COLLECTION } from '../vector/chroma.js';
import { llm } from '../llm/openai.js';
import type { WorldKnowledgeItem } from '../types/index.js';

let collection: Collection | null = null;

async function getCollection(): Promise<Collection> {
  if (!collection) {
    const client = getChromaClient();
    collection = await client.getOrCreateCollection({ name: WORLD_COLLECTION });
  }
  return collection;
}

export class WorldKnowledgeRepository {
  async add(content: string, metadata: Record<string, string> = {}): Promise<WorldKnowledgeItem> {
    const col = await getCollection();
    const id = `world_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const embedding = await llm.embed([content]);

    await col.add({
      ids: [id],
      embeddings: embedding,
      documents: [content],
      metadatas: [metadata],
    });

    return { id, content, metadata };
  }

  async addBatch(items: Array<{ content: string; metadata?: Record<string, string> }>): Promise<WorldKnowledgeItem[]> {
    const col = await getCollection();
    const texts = items.map((i) => i.content);
    const embeddings = await llm.embed(texts);
    const ids = items.map(
      (_, i) => `world_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${i}`
    );
    const metadatas = items.map((i) => i.metadata || {});

    await col.add({
      ids,
      embeddings,
      documents: texts,
      metadatas,
    });

    return items.map((item, i) => ({
      id: ids[i],
      content: item.content,
      metadata: item.metadata || {},
    }));
  }

  async search(query: string, nResults: number = 5): Promise<WorldKnowledgeItem[]> {
    const col = await getCollection();
    const queryEmbedding = await llm.embed([query]);

    const results = await col.query({
      queryEmbeddings: queryEmbedding,
      nResults,
    });

    const ids = results.ids[0] || [];
    const documents = (results.documents[0] || []).filter((d): d is string => d !== null);
    const metadatas = (results.metadatas?.[0] || []) as Record<string, string>[];

    return ids.map((id, i) => ({
      id,
      content: documents[i] || '',
      metadata: metadatas[i] || {},
    }));
  }

  async delete(id: string): Promise<boolean> {
    const col = await getCollection();
    try {
      await col.delete({ ids: [id] });
      return true;
    } catch {
      return false;
    }
  }
}

export const worldKnowledgeRepository = new WorldKnowledgeRepository();
