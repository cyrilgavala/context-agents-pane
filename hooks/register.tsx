import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { AgentRow, AgentSample, ContextRow, ContextUsage } from '../types'

const PANE = 'context-agents'

// One glyph and color per agent status; the status word is always shown beside it.
const STATUS_GLYPH: Record<string, { icon: string; color?: string }> = {
  running: { icon: '●', color: 'success' },
  pending: { icon: '◌', color: 'warning' },
  waiting: { icon: '◐', color: 'warning' },
  idle: { icon: '○' },
  completed: { icon: '✓', color: 'success' },
  failed: { icon: '✗', color: 'error' },
  killed: { icon: '■' },
  session: { icon: '◆' },
}

// Change the tag when a stored field's shape changes, so an earlier version's value is declined.
const context = atom(
  { plugin: 'context-agents-pane', key: 'context' } as const,
  { used: 0, window: 0, percent: 0, isCompactWindow: false },
  { shape: 'context-2' },
)
const agents = atom(
  { plugin: 'context-agents-pane', key: 'agents' } as const,
  { rows: [], at: 0 } as AgentSample,
  { shape: 'agents-2' },
)
const breakdown = atom({ plugin: 'context-agents-pane', key: 'breakdown' } as const, [], { shape: 'breakdown-1' })

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'context-agents',
      description: 'Show the context window and running agents in a pane',
    })
    await $.command.register({
      name: 'context-agents-reload',
      description: 'Close and reopen the context and agents pane',
    })
    void $.ui.open({ id: PANE, title: 'Context & agents' })

    const sample = async () => {
      // 'summary' estimates locally and sends no requests, so it is cheap every tick.
      const { context: usage } = await $.session.usage({ breakdown: 'summary' })
      let list: Awaited<ReturnType<typeof $.agent.list>>
      try {
        list = await $.agent.list()
      } catch (error) {
        await update($, agents, prev => ({ ...prev, at: Date.now(), error: String(error) }))
        return
      }
      const parts: ContextRow[] = (usage.breakdown?.categories ?? []).map(c => ({
        name: c.name,
        tokens: c.tokens,
        kind: c.kind,
      }))
      // The window compaction actually runs at: /autocompact or an env var can make it smaller than the model's limit.
      const cap = usage.breakdown?.rawMaxTokens ?? usage.window
      const used = usage.tokens ?? 0
      const ctx: ContextUsage = {
        used,
        window: cap,
        percent: cap > 0 ? Math.round((used / cap) * 100) : 0,
        isCompactWindow: usage.breakdown?.autocompactSource !== undefined && usage.breakdown.autocompactSource !== 'auto',
      }
      const rows: AgentRow[] = list.map(a => ({
        id: a.id,
        type: a.type,
        status: a.status,
        label: a.name ?? a.description,
      }))
      await update($, context, () => ctx)
      await update($, agents, () => ({ rows, at: Date.now() }))
      await update($, breakdown, () => parts)
    }
    const tick = () => {
      sample().catch(async error => {
        await update($, agents, prev => ({ ...prev, at: Date.now(), error: String(error) }))
      })
    }
    $.clock.every(2000, tick)
    tick()

    return next(e)
  })

  on('command.run', { command: 'context-agents' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Context & agents' })

    return { text: 'Context & agents pane opened.' }
  })

  on('command.run', { command: 'context-agents-reload' }, async $ => {
    await $.ui.close({ id: PANE })
    await $.ui.open({ id: PANE, title: 'Context & agents' })

    return { text: 'Context & agents pane reloaded.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const usage = await read($, context)
    const sampled = await read($, agents)
    // $.agent.list() omits the main loop, so the conversation is always listed first; its state is not exposed.
    const rows: AgentRow[] = [{ id: 'main', type: 'main', status: 'session', label: 'this conversation' }, ...sampled.rows]
    const parts = await read($, breakdown)
    const used = parts.filter(p => p.kind === 'used').sort((a, b) => b.tokens - a.tokens)
    const rest = parts.filter(p => p.kind === 'buffer' || p.kind === 'free')
    const width = Math.max(20, (e.viewport?.width ?? 40) - 2)
    const percent = Math.min(100, Math.max(0, usage.percent))
    const filled = Math.round((percent / 100) * width)
    // Color follows state; the words beside it carry the same state so color is never the only cue.
    const level = percent >= 90 ? 'error' : percent >= 70 ? 'warning' : 'success'
    const note = percent >= 90 ? 'near limit' : percent >= 70 ? 'high' : ''
    const rule = (title: string) => `── ${title} ${'─'.repeat(Math.max(0, width - title.length - 4))}`

    return (
      <Box flexDirection="column" paddingX={1} gap={1}>
        <Box flexDirection="column">
          <Text dimColor>{rule('Context')}</Text>
          <Box justifyContent="space-between">
            <Text bold>
              {usage.used.toLocaleString()} / {usage.window.toLocaleString()}
            </Text>
            <Text color={level} bold>
              {percent}% {note}
            </Text>
          </Box>
          <Text color={level}>{'█'.repeat(filled)}</Text>
          <Text dimColor>{'░'.repeat(width - filled)}</Text>
          {usage.isCompactWindow && <Text dimColor>auto-compact window · /autocompact</Text>}
          <Box flexDirection="column" paddingTop={1}>
            {used.map(p => (
              <Box justifyContent="space-between">
                <Text>{p.name}</Text>
                <Text>{p.tokens.toLocaleString()}</Text>
              </Box>
            ))}
            {rest.map(p => (
              <Box justifyContent="space-between">
                <Text dimColor>{p.name}</Text>
                <Text dimColor>{p.tokens.toLocaleString()}</Text>
              </Box>
            ))}
          </Box>
        </Box>
        <Box flexDirection="column">
          <Text dimColor>{rule(`Agents · ${rows.length}`)}</Text>
          {rows.length === 0 && <Text dimColor>none running</Text>}
          {rows.map(a => {
            const glyph = STATUS_GLYPH[a.status] ?? { icon: '·', color: undefined }
            return (
              <Box flexDirection="column">
                <Box gap={1}>
                  <Text color={glyph.color}>{glyph.icon}</Text>
                  <Text color={glyph.color}>{a.status}</Text>
                  <Text dimColor>{a.type}</Text>
                </Box>
                <Text dimColor>{'  ' + a.label.slice(0, width - 4)}</Text>
              </Box>
            )
          })}
        </Box>
        <Text dimColor>
          {sampled.error
            ? `sample failed: ${sampled.error.slice(0, width - 14)}`
            : `updated ${sampled.at ? new Date(sampled.at).toLocaleTimeString() : 'never'}`}
        </Text>
      </Box>
    )
  })
}
