import { config } from './config/index.js';
import { initDb, closeDb } from './db/sqlite.js';
import { getChromaClient } from './vector/chroma.js';
import { llm } from './llm/openai.js';

async function main() {
  console.log('🚀 AI 编辑部系统启动中...');
  console.log('');

  // 初始化数据库
  console.log('📦 初始化 SQLite 数据库...');
  initDb();
  console.log('✅ SQLite 初始化完成');
  console.log('');

  // 验证 ChromaDB 连接
  console.log('🔍 连接 ChromaDB...');
  try {
    const chroma = getChromaClient();
    await chroma.heartbeat();
    console.log('✅ ChromaDB 连接成功');
  } catch (err) {
    console.warn('⚠️ ChromaDB 连接失败（可能需要 ChromaDB 服务）:', err);
  }
  console.log('');

  // 验证 LLM
  console.log('🤖 验证 LLM 连接...');
  try {
    const test = await llm.embed(['连接测试']);
    console.log('✅ LLM 连接成功，向量维度:', test[0]?.length);
  } catch (err) {
    console.error('❌ LLM 连接失败:', err);
    process.exit(1);
  }
  console.log('');

  console.log('🎉 AI 编辑部系统已就绪！');
  console.log(`📍 服务地址: http://localhost:${config.port}`);
}

main().catch((err) => {
  console.error('启动失败:', err);
  process.exit(1);
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n👋 关闭中...');
  closeDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 关闭中...');
  closeDb();
  process.exit(0);
});
