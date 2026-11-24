#!/usr/bin/env node
'use strict';

/**
 * Fake `agy acp` for the test-suite. It speaks the same ACP over stdio as the
 * real server (shapes copied from "Antigravity ACP Server" 1.5.15) and does
 * what each test asks through environment variables:
 *
 *   MOCK_AGY_RECORD     file where every request, answer and outcome is appended (JSON lines)
 *   MOCK_AGY_AUTH_FAIL  "1" → authenticate fails until a --login with the code GOOD succeeds
 *   MOCK_AGY_STATE      file that remembers whether --login succeeded
 *   MOCK_AGY_CRASH_ON   name of the method on which the process exits with code 3
 *   MOCK_AGY_SLOW       milliseconds to wait before answering each request
 *
 * A prompt chooses its behaviour with the word SCRIPT:<NAME>:
 *   TEXT (default)  THOUGHTS_ONLY  NO_TEXT  READ  EDIT  EDIT_THEN_RUN  MCP_TOOL
 *   SLOW (about 1.2 s)  QUESTION  HANG  CRASH  ERR
 */

const fs = require('fs');

const env = process.env;
const args = process.argv.slice(2);
const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const slow = Number(env.MOCK_AGY_SLOW) || 0;

const record = (entry) => {
  if (!env.MOCK_AGY_RECORD) return;
  try {
    fs.appendFileSync(env.MOCK_AGY_RECORD, `${JSON.stringify({ t: Date.now(), pid: process.pid, ...entry })}\n`);
  } catch {
    /* recording is best effort */
  }
};
process.on('exit', (code) => record({ evt: 'exit', code }));

/* ------------------------------------------------------------------ */
/* `agy acp --login`                                                   */
/* ------------------------------------------------------------------ */

function loginMode() {
  record({ evt: 'login_start' });
  process.stdout.write('Open this link in a browser to log in with Google:\n\n');
  process.stdout.write('  https://accounts.google.com/o/oauth2/auth?mock=1&state=login\n\n');
  process.stdout.write('Then paste the authorization code, or the full URL of the page you land on, and press Enter:\n\n');
  process.stdin.setEncoding('utf8');
  let buffer = '';
  process.stdin.on('data', (chunk) => {
    buffer += chunk;
    if (!buffer.includes('\n')) return;
    const line = buffer.split('\n')[0].trim();
    record({ evt: 'login_code', accepted: line.includes('GOOD') });
    if (line.includes('GOOD')) {
      if (env.MOCK_AGY_STATE) fs.writeFileSync(env.MOCK_AGY_STATE, JSON.stringify({ signedIn: true }));
      process.stdout.write('Logged in as test@example.invalid\n');
      process.exit(0);
    }
    process.stdout.write('couldn\'t log in: token exchange failed: oauth2: "invalid_grant" "Malformed auth code."\n');
    process.exit(1);
  });
  process.stdin.on('end', () => {
    record({ evt: 'login_cancelled' });
    process.exit(1);
  });
}

/* ------------------------------------------------------------------ */
/* ACP server                                                          */
/* ------------------------------------------------------------------ */

const MODES = [
  { value: 'default', name: 'Default', description: 'Ask before edits and commands, per your permission settings.' },
  { value: 'accept-edits', name: 'Accept edits', description: 'Approve file edits in the workspace without asking.' },
  { value: 'auto', name: 'Auto', description: 'Approve edits and safe commands; ask before irreversible actions.' },
  { value: 'plan', name: 'Plan', description: 'Plan carefully before executing a task.' },
];
const MODELS = [
  { value: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash' },
  { value: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6 (Thinking)' },
  { value: 'claude-opus-4-6-thinking', name: 'Claude Opus 4.6 (Thinking)' },
  { value: 'gpt-oss-120b-medium', name: 'GPT-OSS 120B (Medium)' },
];
const LEVELS = [
  { value: 'low', name: 'Low' },
  { value: 'medium', name: 'Medium' },
  { value: 'high', name: 'High' },
];
/** Only these offer a thinking level, as in the real account. */
const LEVEL_MODELS = new Set(['gemini-3.8-flash']);
const COMBINED = [
  { modelId: 'gemini-3.8-flash-high', name: 'Gemini 3.8 Flash (High)' },
  { modelId: 'gemini-3.8-flash-medium', name: 'Gemini 3.8 Flash (Medium)' },
  { modelId: 'gemini-3.8-flash-low', name: 'Gemini 3.8 Flash (Low)' },
  { modelId: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6 (Thinking)' },
  { modelId: 'claude-opus-4-6-thinking', name: 'Claude Opus 4.6 (Thinking)' },
  { modelId: 'gpt-oss-120b-medium', name: 'GPT-OSS 120B (Medium)' },
];

const sessions = new Map();
const clientAnswers = new Map();
let nextRequestId = 100000;
let nextSession = 0;
/** Prompts still open, by session: what `session/cancel` has to end. */
const openPrompts = new Map();

function signedIn() {
  if (env.MOCK_AGY_AUTH_FAIL !== '1') return true;
  try {
    return JSON.parse(fs.readFileSync(env.MOCK_AGY_STATE, 'utf8')).signedIn === true;
  } catch {
    return false;
  }
}

function configOptions(state) {
  const list = [{ id: 'model', name: 'Model', category: 'model', type: 'select', currentValue: state.model, options: MODELS }];
  if (LEVEL_MODELS.has(state.model)) list.push({ id: 'thought_level', name: 'Thinking Level', category: 'thought_level', type: 'select', currentValue: state.level, options: LEVELS });
  list.push({ id: 'mode', name: 'Mode', category: 'mode', type: 'select', currentValue: state.mode, options: MODES });
  return list;
}

const tier = { name: 'Mock Plan', id: 'mock-tier' };
const update = (sessionId, payload) => send({ jsonrpc: '2.0', method: 'session/update', params: { sessionId, update: payload } });

/** Ask the client something and wait for its answer. */
function ask(message) {
  return new Promise((resolve) => {
    clientAnswers.set(message.id, resolve);
    send(message);
  });
}

async function runTool(sessionId, kind, title, index, extra = {}) {
  const toolCallId = `call_${index}`;
  const toolCall = { toolCallId, title, kind, status: 'pending', ...extra };
  update(sessionId, { sessionUpdate: 'tool_call', toolCallId, title, kind, status: 'pending' });
  const answer = await ask({
    jsonrpc: '2.0',
    id: nextRequestId++,
    method: 'session/request_permission',
    params: {
      sessionId,
      toolCall,
      options: [
        { optionId: 'allow', name: 'Allow', kind: 'allow_once' },
        { optionId: 'allow_always', name: 'Allow always', kind: 'allow_always' },
        { optionId: 'reject', name: 'Reject', kind: 'reject_once' },
      ],
    },
  });
  const allowed = Boolean(answer && answer.result && answer.result.outcome && answer.result.outcome.outcome === 'selected' && String(answer.result.outcome.optionId).startsWith('allow'));
  record({ evt: 'permission', kind, title, allowed });
  await sleep(20);
  update(sessionId, { sessionUpdate: 'tool_call_update', toolCallId, status: allowed ? 'completed' : 'failed' });
  return allowed;
}

async function runPrompt(id, params) {
  const state = sessions.get(params.sessionId);
  const finish = (message) => {
    openPrompts.delete(params.sessionId);
    send(message);
  };
  const reply = (result) => finish({ jsonrpc: '2.0', id, result });
  const fail = (code, message) => finish({ jsonrpc: '2.0', id, error: { code, message } });
  if (!state) return fail(-32602, `Session not found: ${params.sessionId}`);
  const sid = params.sessionId;
  openPrompts.set(sid, { id });
  const text = (params.prompt || []).map((part) => (part && part.type === 'text' ? part.text : '')).join(' ');
  const script = (text.match(/SCRIPT:(\w+)/) || [])[1] || env.MOCK_AGY_SCRIPT || 'TEXT';
  const done = (stopReason = 'end_turn') => reply({ stopReason, _meta: { usage: { inputTokens: 12, outputTokens: 34 } } });
  const say = (message) => update(sid, { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: message } });
  record({ evt: 'script', script });
  update(sid, { sessionUpdate: 'session_info_update', title: 'Mock conversation title' });

  switch (script) {
    case 'SLOW':
      // About 1.2 s: longer than a short wait, to exercise the running / wait flow.
      say('Working');
      for (let i = 0; i < 12; i += 1) {
        await sleep(100);
        say('.');
      }
      return done();
    case 'TEXT':
      update(sid, { sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: 'Thinking about it… ' } });
      say('Hola. ');
      await sleep(30);
      say(`Recibí: ${text}`);
      update(sid, { sessionUpdate: 'usage_update', used: 1234, size: 1048576 });
      return done();
    case 'THOUGHTS_ONLY':
      update(sid, { sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: 'Still thinking.' } });
      return done();
    case 'NO_TEXT':
      update(sid, { sessionUpdate: 'tool_call', toolCallId: 'c1', title: 'List files', kind: 'search', status: 'completed' });
      return done();
    case 'READ':
      await runTool(sid, 'read', 'Read README.md', 1);
      say('Leído.');
      return done();
    case 'EDIT': {
      const ok = await runTool(sid, 'edit', 'Edit notes.txt', 1, { rawInput: { path: 'notes.txt', content: 'new line' }, locations: [{ path: 'notes.txt' }] });
      say(ok ? 'Edit applied.' : 'I could not edit the file.');
      return done();
    }
    case 'MCP_TOOL': {
      // An MCP tool as agy asks for it: kind "other", a readable title, and the raw input.
      const ok = await runTool(sid, 'other', 'Create document with WordCraft', 1, { rawInput: { name: 'report', formats: ['docx', 'pdf'] }, locations: [{ path: 'D:\\work\\report.docx' }] });
      say(ok ? 'Tool ran.' : 'Tool not allowed.');
      return done();
    }
    case 'EDIT_THEN_RUN': {
      const edited = await runTool(sid, 'edit', 'Edit notes.txt', 1);
      const ran = await runTool(sid, 'execute', 'Run tests', 2);
      say(`edited=${edited} ran=${ran}`);
      return done();
    }
    case 'QUESTION': {
      const answer = await ask({ jsonrpc: '2.0', id: nextRequestId++, method: 'session/request_input', params: { sessionId: sid, prompt: { question: 'Which file?' } } });
      record({ evt: 'question_answer', error: (answer && answer.error) || null });
      say('answer after question');
      return done();
    }
    case 'HANG':
      return undefined;
    case 'CRASH':
      process.exit(7);
    case 'ERR':
      return fail(-32602, 'Quota exceeded for this account');
    default:
      say(`unknown script ${script}`);
      return done();
  }
}

async function handle(message) {
  const { id, method, params = {} } = message;
  record({ dir: 'in', method, ...(method === 'initialize' ? { clientInfo: params.clientInfo } : {}), ...(method === 'session/new' ? { cwd: params.cwd, mcpServers: params.mcpServers } : {}), ...(/^session\/(set_|prompt|cancel)/.test(method) ? { params } : {}) });
  if (env.MOCK_AGY_CRASH_ON === method) {
    record({ evt: 'crash', method });
    process.exit(3);
  }
  if (slow) await sleep(slow);
  const reply = (result) => send({ jsonrpc: '2.0', id, result });
  const fail = (code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });

  switch (method) {
    case 'initialize':
      return reply({
        protocolVersion: 1,
        agentCapabilities: { loadSession: true, promptCapabilities: { image: true, audio: false, embeddedContext: true }, sessionCapabilities: { resume: {}, close: {}, load: {}, list: {} }, auth: { logout: {} } },
        agentInfo: { name: 'Mock Antigravity ACP Server', version: '1.5.15-mock' },
        authMethods: [{ id: 'oauth-personal', name: 'Log in with Google' }, { id: 'gemini-api-key', name: 'Gemini API key' }],
      });
    case 'authenticate':
      return signedIn() ? reply({ _meta: { antigravity: { tier } } }) : fail(-32000, 'Authentication required');
    case 'session/new': {
      nextSession += 1;
      const sessionId = `mock-${nextSession}`;
      sessions.set(sessionId, { id: sessionId, model: 'gemini-3.8-flash', level: 'high', mode: 'default' });
      return reply({
        sessionId,
        models: { availableModels: COMBINED, currentModelId: 'gemini-3.8-flash-high' },
        modes: { currentModeId: 'default', availableModes: MODES.map(({ value, name, description }) => ({ id: value, name, description })) },
        configOptions: configOptions(sessions.get(sessionId)),
        _meta: { antigravity: { tier } },
      });
    }
    case 'session/set_config_option': {
      const state = sessions.get(params.sessionId);
      if (!state) return fail(-32602, `Session not found: ${params.sessionId}`);
      if (params.configId === 'model') {
        const direct = MODELS.find((option) => option.value === params.value);
        const combo = direct ? null : COMBINED.find((option) => option.modelId === params.value);
        if (!direct && !combo) return fail(-32602, `Unknown model ID: ${params.value}`);
        if (direct) state.model = direct.value;
        else {
          const base = MODELS.map((option) => option.value).filter((value) => combo.modelId.startsWith(value) && value.length < combo.modelId.length).sort((a, b) => b.length - a.length)[0];
          state.model = base || combo.modelId;
          state.level = LEVELS.some((level) => level.value === combo.modelId.slice(base.length).replace(/^-/, '')) ? combo.modelId.slice(base.length).replace(/^-/, '') : state.level;
        }
        if (!LEVEL_MODELS.has(state.model)) state.level = null;
      } else if (params.configId === 'thought_level') {
        const modelName = (MODELS.find((option) => option.value === state.model) || {}).name;
        if (!LEVEL_MODELS.has(state.model)) return fail(-32602, `Thinking level "${params.value}" is not offered for model "${modelName}"`);
        if (!LEVELS.some((level) => level.value === params.value)) return fail(-32602, `Thinking level "${params.value}" is not offered for model "${modelName}"`);
        state.level = params.value;
      } else if (params.configId === 'mode') {
        const mode = MODES.find((option) => option.value === params.value);
        if (!mode) return fail(-32602, `Unknown mode: ${params.value}`);
        state.mode = mode.value;
      } else return fail(-32602, `Unknown config option: ${params.configId}`);
      update(params.sessionId, { sessionUpdate: 'config_option_update', configOptions: configOptions(state) });
      return reply({ configOptions: configOptions(state) });
    }
    case 'session/set_mode': {
      const state = sessions.get(params.sessionId);
      if (!state) return fail(-32602, `Session not found: ${params.sessionId}`);
      const mode = MODES.find((option) => option.value === params.modeId);
      if (!mode) return fail(-32602, `Unknown mode: ${params.modeId}`);
      state.mode = mode.value;
      update(params.sessionId, { sessionUpdate: 'current_mode_update', currentModeId: mode.value });
      return reply({});
    }
    case 'session/prompt':
      return runPrompt(id, params);
    case 'session/cancel': {
      // agy ends any open prompt of that session as "cancelled", parked on a permission or not.
      const open = openPrompts.get(params.sessionId);
      if (open) {
        openPrompts.delete(params.sessionId);
        send({ jsonrpc: '2.0', id: open.id, result: { stopReason: 'cancelled' } });
      }
      return reply({});
    }
    case 'session/close':
      sessions.delete(params.sessionId);
      return reply({});
    case 'session/list':
      return reply({ sessions: [] });
    default:
      if (id !== undefined) return fail(-32601, `Method not found: ${method}`);
      return undefined;
  }
}

function serverMode() {
  process.stdin.setEncoding('utf8');
  let buffer = '';
  process.stdin.on('data', (chunk) => {
    buffer += chunk;
    let nl;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      if (!line.trim()) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }
      if (message.id !== undefined && message.id !== null && typeof message.method === 'string') handle(message).catch((error) => process.stderr.write(`mock-agy: ${error.stack}\n`));
      else if (message.id !== undefined && message.id !== null) {
        const resolve = clientAnswers.get(message.id);
        clientAnswers.delete(message.id);
        if (resolve) resolve(message);
      }
    }
  });
  process.stdin.on('end', () => {
    record({ evt: 'stdin_end' });
    process.exit(0);
  });
}

if (args.includes('--login')) loginMode();
else serverMode();
