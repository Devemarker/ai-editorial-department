#!/usr/bin/env node
import { pipeline, taskQueue } from './pipeline/index.js';
import { dashboard } from './dashboard/index.js';
import { chiefEditorAgent } from './agents/chiefEditor.js';
import { memoryService } from './memory/memoryService.js';
import type { ProjectInput } from './types/index.js';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'init': {
      const title = args[1] || '未命名项目';
      const outline = args.slice(2).join(' ') || '待补充';

      const input: ProjectInput = {
        title,
        outline,
        characters: [],
      };

      const result = await chiefEditorAgent.initializeProject(input);
      console.log(`\n✅ 项目 "${result.title}" 初始化完成`);
      console.log(`   人物数：${result.characterCount}`);
      console.log(`   世界观知识：${result.worldKnowledgeCount}`);
      break;
    }

    case 'status': {
      const characters = memoryService.getAllCharacters();
      const events = memoryService.getAllEvents();
      const pipelineStatus = pipeline.getStatus();

      console.log(`\n📊 项目状态`);
      console.log(`   人物数：${characters.length}`);
      console.log(`   事件数：${events.length}`);
      console.log(`\n📋 流水线状态`);
      console.log(`   总任务：${pipelineStatus.total}`);
      console.log(`   待处理：${pipelineStatus.pending}`);
      console.log(`   处理中：${pipelineStatus.processing}`);
      console.log(`   已完成：${pipelineStatus.completed}`);

      if (characters.length > 0) {
        console.log('\n👤 人物状态：');
        for (const char of characters) {
          console.log(`   - ${char.name}: ${char.currentState}`);
        }
      }
      break;
    }

    case 'generate': {
      const chapterNumber = parseInt(args[1] || '1', 10);
      const title = args[2] || '未命名项目';
      const outline = args.slice(3).join(' ') || '待补充';

      const projectInput: ProjectInput = {
        title,
        outline,
        characters: memoryService.getAllCharacters().map((c) => ({
          name: c.name,
          description: c.description,
        })),
      };

      pipeline.setProjectInput(projectInput);

      console.log(`\n📝 正在生成第${chapterNumber}章...`);
      const task = await pipeline.createChapter(chapterNumber);
      console.log(`   任务ID: ${task.id}`);
      console.log('   状态: pending -> writing...');
      break;
    }

    case 'pipeline:status': {
      const status = pipeline.getStatus();
      const tasks = taskQueue.getAllTasks();

      console.log(`\n📋 流水线状态`);
      console.log(`   总任务：${status.total}`);
      console.log(`   待处理：${status.pending}`);
      console.log(`   处理中：${status.processing}`);
      console.log(`   已完成：${status.completed}`);

      if (tasks.length > 0) {
        console.log('\n📝 任务列表：');
        for (const task of tasks) {
          console.log(`   [${task.status}] 第${task.chapterNumber}章 - ${task.id}`);
        }
      }
      break;
    }

    case 'dashboard': {
      dashboard.showFullDashboard();
      break;
    }

    case 'dashboard:tasks': {
      dashboard.showTaskList();
      break;
    }

    case 'dashboard:chapter': {
      const chapterNumber = parseInt(args[1] || '1', 10);
      dashboard.showChapterDetail(chapterNumber);
      break;
    }

    case 'dashboard:rewrite': {
      const chapterNumber = parseInt(args[1] || '1', 10);
      await dashboard.rewriteChapter(chapterNumber);
      break;
    }

    default:
      console.log(`
  AI 编辑部系统 CLI

  用法：
    npm run cli -- init <标题> <大纲>
    npm run cli -- status
    npm run cli -- generate <章节号> [标题] [大纲]
    npm run cli -- pipeline:status
    npm run cli -- dashboard
    npm run cli -- dashboard:tasks
    npm run cli -- dashboard:chapter <章节号>
    npm run cli -- dashboard:rewrite <章节号>

  示例：
    npm run cli -- init 我的小说 "一个关于勇气和友谊的故事"
    npm run cli -- status
    npm run cli -- generate 1 我的小说 "继续故事的发展"
    npm run cli -- pipeline:status
    npm run cli -- dashboard
    npm run cli -- dashboard:chapter 1
    npm run cli -- dashboard:rewrite 1
      `);
  }
}

main().catch(console.error);
