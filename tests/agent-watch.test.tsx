import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'agent-watch',
  component: 'Pane',
  requestId: 'agent-watch',
  props: {
    title: 'Agents',
    isFocused: false,
    bodyColumns: 50,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

test('the pane is empty before any subagent starts', async $ => {
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /No subagents yet/ }))?.text).toContain('No subagents yet')
  await ui.unmount()
})

test('a spawned subagent shows as working, then finished', async ($, on) => {
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('agent.list', () => ({ value: [] }))
  on('clock.now', () => ({ value: 1_000 }))
  on('agent.spawn', () => ({ model: 'haiku', agentId: 'a1' }))
  on('tool.call', () => ({ result: {} }))
  on('turn.complete', (_, e) => ({ text: e.answer }))

  await $.agent.spawn({ prompt: 'Look around', description: 'Scan the repo', subagentType: 'Explore' } as never)

  // Desktop draws pictures; each one says what it shows in its alt text.
  const alts = async (ui: { findAll: (q: { type: string }) => Promise<{ props: Record<string, unknown> }[]> }) =>
    (await ui.findAll({ type: 'Svg' })).map(one => String(one.props.alt)).join(' | ')

  const term = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await term.find({ type: 'Text', text: /working/ }))?.text).toContain('1 working')
  expect(await term.find({ type: 'Text', text: /Scan the repo/ })).toBeDefined()
  expect((await term.find({ type: 'Text', text: /thinking/ }))?.text).toContain('thinking')
  await term.unmount()

  let ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await alts(ui)).toContain('1 working, 0 done')
  expect(await alts(ui)).toContain('Scan the repo: Working')
  expect((await ui.find({ type: 'Text', text: /0 tools/ }))?.text).toContain('0 tools')
  expect((await ui.find({ type: 'Text', text: /Thinking/ }))?.text).toContain('Thinking')
  await ui.unmount()

  // @ts-ignore TS2589: the tool-call input type is too deep for tsc here
  const callTool = $.tool.call as (input: unknown) => Promise<unknown>
  await callTool({ tool: 'Grep', pattern: 'x', agentId: 'a1' })
  ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /1 tool/ }))?.text).toContain('1 tool')
  await ui.unmount()

  await $.turn.complete({ answer: 'done', durationMs: 5000, isAborted: false, turnId: 't1', agentId: 'a1' } as never)
  ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await alts(ui)).toContain('0 working, 1 done, 0 failed')
  expect(await alts(ui)).toContain('Scan the repo: Done')
  expect(await ui.find({ type: 'Text', text: /^ ?Grep ?$/ })).toBeDefined()
  await ui.unmount()
})
