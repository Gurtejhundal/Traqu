"""Exercise the actual SDK over stdio with a disposable workspace, never real data."""
from contextlib import asynccontextmanager
from pathlib import Path
import hashlib
import json
import os
import sqlite3
import shutil
import subprocess
import sys
import tempfile
import unittest

from mcp import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client

SERVER = Path(__file__).resolve().parents[1] / 'backend' / 'mcp_server.py'


@asynccontextmanager
async def connect(directory, *flags, launcher=False):
    # A cloud database inherited from a shell must never be contacted.
    env = {**os.environ, 'DATABASE_URL': 'postgresql://invalid.invalid/do-not-open', 'VERCEL': '1'}
    command = shutil.which('node') if launcher else sys.executable
    entry = SERVER.parent.parent / 'scripts' / 'mcp.cjs' if launcher else SERVER
    args = [str(entry), '--data-dir', str(directory), *flags]
    if os.getenv('TRAQU_TEST_MCP'):
        command, args = os.environ['TRAQU_TEST_MCP'], ['--data-dir', str(directory), *flags]
    parameters = StdioServerParameters(command=command, args=args, env=env)
    async with stdio_client(parameters) as streams:
        async with ClientSession(*streams) as client:
            await client.initialize()
            yield client


async def call(client, tool_name, **arguments):
    result = await client.call_tool(tool_name, arguments)
    if result.is_error:
        raise AssertionError(result.content)
    return json.loads(result.content[0].text)


class StdioIntegration(unittest.IsolatedAsyncioTestCase):
    async def test_daily_workflow_persistence_readonly_and_owner_isolation(self):
        with tempfile.TemporaryDirectory(prefix='traqu mcp ') as temporary:
            directory = Path(temporary) / 'workspace #1'
            async with connect(directory, '--allow-write', '--create') as client:
                tools = (await client.list_tools()).tools
                self.assertIn('set_task_status', [tool.name for tool in tools])
                guide = await client.read_resource('traqu://roadmap-guide')
                self.assertIn('Day', guide.contents[0].text)
                text = '# Week 1: Foundations\n## Day 1 - 2026-11-11\n- [ ] Learn vectors\n## Day 2 - 2026-11-12\n- [ ] Solve an array problem'
                preview = await call(client, 'preview_roadmap', text=text)
                self.assertTrue(preview)
                roadmap = await call(client, 'create_roadmap', name='MCP daily plan', text=text)
                rid = roadmap['id']
                metadata = await call(client, 'get_roadmap', roadmap_id=rid)
                self.assertEqual(len(metadata['sections']), 2)
                tasks = await call(client, 'list_tasks', roadmap_id=rid, limit=1)
                self.assertEqual(tasks['total'], 2)
                self.assertEqual(tasks['next_offset'], 1)
                tid = tasks['items'][0]['id']
                await call(client, 'add_task_note', task_id=tid, text='Explain the boundary cases.')
                await call(client, 'rename_task', task_id=tid, title='Learn C++ vectors')
                for _ in range(2):
                    await call(client, 'set_task_status', task_id=tid, is_done=True, timezone='Asia/Kolkata')
                activity = await call(client, 'get_activity', timezone='Asia/Kolkata')
                self.assertEqual(activity['total_completions'], 1)
                await call(client, 'set_task_status', task_id=tid, is_done=False, timezone='Asia/Kolkata')
                self.assertEqual((await call(client, 'get_activity'))['total_completions'], 0)
                added = await call(client, 'add_task', roadmap_id=rid, timeframe_id=metadata['sections'][0]['id'], title='Write one vector example')
                self.assertTrue(added['id'])
                self.assertTrue((await client.call_tool('list_tasks', {'roadmap_id': rid, 'limit': 101})).is_error)
            path = directory / 'roadmap.db'
            with sqlite3.connect(path) as database:
                database.execute("INSERT INTO roadmaps(user_id,name,raw_text,document_json,revision,created_at) VALUES('another-owner','Private other workspace','','[]',1,'2026-11-11')")
            before = hashlib.sha256(path.read_bytes()).digest()
            async with connect(directory, launcher=True) as client:
                names = {tool.name for tool in (await client.list_tools()).tools}
                self.assertNotIn('create_roadmap', names)
                self.assertNotIn('set_task_status', names)
                self.assertTrue((await client.call_tool('create_roadmap', {'name':'Blocked','text':'- [ ] Test'})).is_error)
                self.assertEqual((await call(client, 'list_roadmaps'))['total'], 1)
                tasks = (await call(client, 'list_tasks', roadmap_id=rid))['items']
                self.assertEqual(tasks[0]['title'], 'Learn C++ vectors')
                self.assertEqual(tasks[0]['blocks'][0]['data']['text'], 'Explain the boundary cases.')
                self.assertEqual(len(tasks), 3)
                self.assertTrue((await call(client, 'workspace_info'))['read_only'])
                await call(client, 'preview_roadmap', text='## Day 1\n- [ ] Plan tomorrow')
            self.assertEqual(before, hashlib.sha256(path.read_bytes()).digest())

    def test_missing_workspace_does_not_create_database(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary) / 'missing'
            result = subprocess.run(([os.environ['TRAQU_TEST_MCP']] if os.getenv('TRAQU_TEST_MCP') else [sys.executable, str(SERVER)]) + ['--data-dir', str(directory)], capture_output=True, text=True, timeout=20)
            self.assertEqual(result.returncode, 2)
            self.assertEqual(result.stdout, '')
            self.assertFalse(directory.exists())


if __name__ == '__main__':
    unittest.main()
