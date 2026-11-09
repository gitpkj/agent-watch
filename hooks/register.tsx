import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { AgentRow } from '../types'

const PANE = 'agent-watch'
const TITLE = 'Agents'
const ACTIVE = new Set(['pending', 'running', 'waiting'])

// Bump the shape tag when AgentRow's fields change, so a reload drops
// rows an older version stored instead of misreading them.
const agents = atom({ plugin: 'agent-watch', key: 'agents' } as const, [], {
  shape: 'agents-3',
})
const now = atom({ plugin: 'agent-watch', key: 'now' } as const, 0)

const isActive = (row: AgentRow) => ACTIVE.has(row.status)

// Every card is dark with white type, and every agent is a little orange
// pixel bot. Each bot gets its own shade and its own hat, so the bots side
// by side never look alike.
const SHADES = ['#D97757', '#E58A5E', '#C8664A', '#E9996B', '#D2704E', '#DD8262']
const ORANGE = '#D97757'
const GREEN = '#3DAA74'
const AMBER = '#E0A030'
const RED = '#E5534B'
const CARD = '#17171C'
const EDGE = '#2A2A32'
const INK = '#16161B'
const WHITE = '#F4F4F5'
const MUTED = '#9A9AA6'
const HIDDEN = new Set(['SubagentHandback'])

type Look = { label: string; color: string; soft: string; state: 'run' | 'wait' | 'done' | 'fail' }

const lookOf = (row: AgentRow): Look => {
  if (row.status === 'running' || row.status === 'pending') return { label: 'Working', color: ORANGE, soft: '#F4A07E', state: 'run' }
  if (row.status === 'waiting') return { label: 'Waiting', color: AMBER, soft: '#F2C46D', state: 'wait' }
  if (row.status === 'idle') return { label: 'Idle', color: AMBER, soft: '#F2C46D', state: 'wait' }
  if (row.status === 'completed') return { label: 'Done', color: GREEN, soft: '#7EDDAE', state: 'done' }

  return { label: row.status === 'killed' ? 'Stopped' : 'Failed', color: RED, soft: '#F3908A', state: 'fail' }
}

const FONT = 'font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,sans-serif"'
const LOOP = 'repeatCount="indefinite"'

const esc = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text)

// The hats, one per bot: antenna, party hat, headphones, bow, sprout, crown.
// Drawn in the bot's own 56 by 48 frame, the head's top edge at y 16.
const hat = (kind: number, run: boolean) => {
  switch (kind % 6) {
    case 0:
      return `<rect x="27" y="4" width="2" height="12" fill="#8A8A94"/><circle cx="28" cy="4" r="4" fill="#FFD166">${run ? `<animate attributeName="opacity" values="1;0.3;1" dur="1.2s" ${LOOP}/>` : ''}</circle>`
    case 1:
      return `<polygon points="18,16 38,16 28,-4" fill="#5EC8E5"/><circle cx="25" cy="11" r="1.6" fill="#fff"/><circle cx="31" cy="6" r="1.6" fill="#fff"/><circle cx="28" cy="-4" r="3" fill="#FF8FB1"/>`
    case 2:
      return `<path d="M8 18V12a20 14 0 0 1 40 0v6" fill="none" stroke="#8B7CF6" stroke-width="4"/><rect x="3" y="10" width="8" height="12" rx="2" fill="#8B7CF6"/><rect x="45" y="10" width="8" height="12" rx="2" fill="#8B7CF6"/>`
    case 3:
      return `<polygon points="40,14 32,8 32,20" fill="#FF7AB6"/><polygon points="40,14 48,8 48,20" fill="#FF7AB6"/><rect x="38" y="12" width="4" height="4" fill="#E0559A"/>`
    case 4:
      return `<g>${run ? `<animateTransform attributeName="transform" type="rotate" values="-8 28 16;8 28 16;-8 28 16" dur="1.8s" ${LOOP}/>` : ''}<rect x="27" y="4" width="2" height="12" fill="#4CAF73"/><ellipse cx="22" cy="5" rx="6" ry="3" fill="#5BD08A" transform="rotate(-25 22 5)"/><ellipse cx="34" cy="3" rx="6" ry="3" fill="#5BD08A" transform="rotate(25 34 3)"/></g>`
    default:
      return `<polygon points="14,16 14,4 21,10 28,0 35,10 42,4 42,16" fill="#F5C542"/><circle cx="28" cy="11" r="2" fill="${RED}"/>`
  }
}

// One little pixel bot: a wide head-body, two claws, four legs and two eyes.
// While it works it bobs, walks, waves a claw and blinks; waiting it dozes;
// done it smiles with a green check; failed it gets crossed eyes.
const bot = (row: AgentRow, look: Look) => {
  const run = look.state === 'run'
  const body = look.state === 'fail' ? '#8C6658' : (SHADES[row.hue % SHADES.length] ?? ORANGE)
  const leg = (x: number, phase: 0 | 1) =>
    `<rect x="${x}" y="40" width="4" height="8" fill="${body}">${run ? `<animate attributeName="height" values="${phase ? '6;8;6' : '8;6;8'}" dur="0.45s" ${LOOP}/>` : ''}</rect>`
  const eye = (x: number) => {
    if (look.state === 'done') return `<path d="M${x - 1} 26l3-4 3 4" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="square"/>`
    if (look.state === 'fail') return `<path d="M${x - 1} 21l6 6M${x + 5} 21l-6 6" stroke="${INK}" stroke-width="2"/>`
    if (look.state === 'wait') return `<rect x="${x}" y="24" width="4" height="3" fill="${INK}"/>`

    return `<rect x="${x}" y="20" width="4" height="8" fill="${INK}"><animate attributeName="height" values="8;8;1;8" keyTimes="0;0.9;0.95;1" dur="3.2s" ${LOOP}/><animate attributeName="y" values="20;20;23.5;20" keyTimes="0;0.9;0.95;1" dur="3.2s" ${LOOP}/></rect>`
  }
  const badge =
    look.state === 'done'
      ? `<circle cx="56" cy="12" r="8" fill="${GREEN}" stroke="${CARD}" stroke-width="2"/><path d="M52.5 12.3l2.4 2.4 4.6-4.8" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
      : look.state === 'fail'
        ? `<circle cx="56" cy="12" r="8" fill="${RED}" stroke="${CARD}" stroke-width="2"/><path d="M53 9l6 6M59 9l-6 6" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`
        : look.state === 'wait'
          ? `<text x="54" y="10" ${FONT} font-size="11" font-weight="700" fill="${MUTED}">z<animate attributeName="y" values="12;2;12" dur="2.4s" ${LOOP}/><animate attributeName="opacity" values="0;1;0" dur="2.4s" ${LOOP}/></text>`
          : ''

  return `<g>${run ? `<animateTransform attributeName="transform" type="translate" values="0 0;0 -3;0 0" dur="0.9s" ${LOOP}/>` : ''}
${leg(12, 0)}${leg(20, 1)}${leg(32, 0)}${leg(40, 1)}
<rect x="0" y="24" width="8" height="8" fill="${body}"/>
<rect x="48" y="24" width="8" height="8" fill="${body}">${run ? `<animate attributeName="y" values="24;18;24" dur="0.9s" ${LOOP}/>` : ''}</rect>
<rect x="8" y="16" width="40" height="24" fill="${body}"/>
<rect x="8" y="16" width="40" height="4" fill="#fff" fill-opacity="0.12"/>
${eye(16)}${eye(36)}
${hat(row.hue, run)}
</g>${badge}`
}

// One agent's card: dark, rounded, its bot on the left, its title in white,
// a status pill and a slim bar that sweeps while it works. The timer and the
// tools go in a text row under the card, so the drawing only changes when
// the agent's state does and the bot's animation never restarts.
const card = (row: AgentRow, look: Look) => {
  const run = look.state === 'run'
  const title = esc(clip(row.description, 27))
  const sub = esc(clip(`${row.type} agent`, 36))
  const label = esc(look.label.toUpperCase())
  const pillW = 26 + label.length * 7
  const pillX = 344 - pillW
  const bar = run
    ? `<clipPath id="b"><rect x="100" y="80" width="244" height="4" rx="2"/></clipPath><g clip-path="url(#b)"><rect x="100" y="80" width="80" height="4" rx="2" fill="url(#o)"><animate attributeName="x" values="20;344" dur="1.6s" ${LOOP}/></rect></g>`
    : `<rect x="100" y="80" width="${look.state === 'wait' ? 126 : 252}" height="4" rx="2" fill="${look.color}" fill-opacity="0.75"/>`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 360 104" preserveAspectRatio="xMidYMin meet">
<defs>
<radialGradient id="glow"><stop offset="0" stop-color="${look.color}" stop-opacity="0.32"/><stop offset="1" stop-color="${look.color}" stop-opacity="0"/></radialGradient>
<linearGradient id="o" x1="0" x2="1"><stop offset="0" stop-color="${ORANGE}" stop-opacity="0"/><stop offset="0.5" stop-color="#F4A07E"/><stop offset="1" stop-color="${ORANGE}" stop-opacity="0"/></linearGradient>
</defs>
<rect x="0.5" y="0.5" width="359" height="103" rx="16" fill="${CARD}" stroke="${run ? ORANGE : EDGE}" stroke-opacity="${run ? 0.5 : 1}">${run ? `<animate attributeName="stroke-opacity" values="0.2;0.65;0.2" dur="2s" ${LOOP}/>` : ''}</rect>
<circle cx="47" cy="52" r="48" fill="url(#glow)" opacity="${run ? 1 : 0.45}">${run ? `<animate attributeName="opacity" values="0.6;1;0.6" dur="2s" ${LOOP}/>` : ''}</circle>
<ellipse cx="47" cy="86" rx="26" ry="4" fill="#000" fill-opacity="0.45"/>
<g transform="translate(12 20) scale(1.25)">${bot(row, look)}</g>
<rect x="${pillX}" y="14" width="${pillW}" height="20" rx="10" fill="${look.color}" fill-opacity="0.18"/>
<circle cx="${pillX + 11}" cy="24" r="3" fill="${look.soft}">${run ? `<animate attributeName="opacity" values="1;0.25;1" dur="1.2s" ${LOOP}/>` : ''}</circle>
<text x="${pillX + 19}" y="28" ${FONT} font-size="10.5" font-weight="700" letter-spacing="0.8" fill="${look.soft}">${label}</text>
<text x="100" y="50" ${FONT} font-size="15" font-weight="650" fill="${WHITE}">${title}</text>
<text x="100" y="68" ${FONT} font-size="12" font-weight="500" fill="${MUTED}">${sub}</text>
<rect x="100" y="80" width="244" height="4" rx="2" fill="${EDGE}"/>
${bar}
</svg>`
}

// The summary strip: dark, with the three counts in white.
const stats = (working: number, done: number, failed: number) => {
  const count = (x: number, n: number, label: string, color: string, pulse: boolean) => `
<circle cx="${x + 4}" cy="28" r="4" fill="${color}">${pulse ? `<animate attributeName="opacity" values="1;0.3;1" dur="1.2s" ${LOOP}/>` : ''}</circle>
<text x="${x + 14}" y="33" ${FONT} font-size="13"><tspan font-weight="700" fill="${WHITE}">${n}</tspan><tspan font-weight="500" fill="${MUTED}"> ${label}</tspan></text>`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 360 56" preserveAspectRatio="xMidYMin meet">
<rect x="0.5" y="0.5" width="359" height="55" rx="14" fill="${CARD}" stroke="${EDGE}"/>
<text x="18" y="33" ${FONT} font-size="11" font-weight="700" letter-spacing="1.4" fill="${MUTED}">AGENTS</text>
${count(110, working, 'working', ORANGE, working > 0)}${count(208, done, 'done', GREEN, false)}${count(280, failed, 'failed', failed > 0 ? RED : '#55555F', false)}
</svg>`
}

// The finished card's tool chips: the last few distinct tools, repeats
// counted ("Bash ×3"), MCP names cut to their last part, and the session's
// own bookkeeping tools left out.
const chipsOf = (recent: string[]) => {
  const counts = new Map<string, number>()
  for (const tool of recent) {
    if (HIDDEN.has(tool) || tool.startsWith('mcp__ccd_')) continue
    const name = tool.startsWith('mcp__') ? (tool.split('__').pop() ?? tool) : tool
    const n = (counts.get(name) ?? 0) + 1
    counts.delete(name)
    counts.set(name, n)
  }

  return [...counts].slice(-4).map(([name, n]) => (n > 1 ? `${name} ×${n}` : name))
}

const SPIN = ['◐', '◓', '◑', '◒']

const elapsed = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)

  return m > 0 ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`
}

const patch = ($: EngineInterface, id: string, fn: (row: AgentRow) => AgentRow) =>
  update($, agents, list => list.map(row => (row.id === id ? fn(row) : row)))

let ticker: Timer | undefined

// While any agent is active, tick once a second: refresh the clock the
// elapsed times read and pick up status changes from the engine's list.
async function tick($: EngineInterface) {
  const [time, live] = await Promise.all([$.clock.now(), $.agent.list()])
  const byId = new Map(live.map(info => [info.id, info]))
  await update($, now, () => time)
  const list = await update($, agents, rows =>
    rows.map(row => {
      const info = byId.get(row.id)
      if (!info || info.status === row.status) return row
      const ended = !ACTIVE.has(info.status) && info.status !== 'idle'

      return { ...row, status: info.status, endedAt: ended ? (row.endedAt ?? time) : undefined }
    }),
  )
  if (!list.some(isActive)) {
    ticker?.cancel()
    ticker = undefined
  }
}

function startTicker($: EngineInterface) {
  if (ticker) return
  ticker = $.clock.every(1000, () => void tick($))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'agent-watch',
      description: 'Show the subagents working in this session',
    })
    if ((await read($, agents)).some(isActive)) startTicker($)

    return next(e)
  })

  on('command.run', { command: 'agent-watch' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: 'Agents pane opened.' }
  })

  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    if ('agentId' in started && started.agentId) {
      const time = await $.clock.now()
      const row: AgentRow = {
        id: started.agentId,
        description: e.description || e.subagentType,
        type: e.subagentType,
        status: 'running',
        startedAt: time,
        toolCount: 0,
        recent: [],
        hue: (await read($, agents)).length % SHADES.length,
      }
      await update($, now, () => time)
      await update($, agents, list => [...list.filter(one => one.id !== row.id), row].slice(-50))
      void $.ui.open({ id: PANE, title: TITLE })
      startTicker($)
    }

    return started
  })

  on('tool.call', async ($, e, next) => {
    const id = e.agentId
    if (!id) return next(e)
    await patch($, id, row => ({
      ...row,
      tool: e.tool,
      toolCount: row.toolCount + 1,
      recent: HIDDEN.has(e.tool) ? row.recent : [...row.recent, e.tool].slice(-12),
    }))
    try {
      return await next(e)
    } finally {
      await patch($, id, row => (row.tool === e.tool ? { ...row, tool: undefined } : row))
    }
  })

  on('turn.complete', async ($, e, next) => {
    const id = e.agentId
    if (id) {
      const time = await $.clock.now()
      await patch($, id, row => ({
        ...row,
        status: e.isAborted ? 'killed' : 'completed',
        endedAt: time,
        tool: undefined,
      }))
      // The engine's list may still say otherwise (a teammate goes idle);
      // the next tick settles it.
      void tick($)
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const { Box, Text } = ui
    // The terminal table answers Svg with its alt text alone: draw text there.
    const Svg = e.surface !== 'terminal' && 'Svg' in ui ? ui.Svg : undefined

    const [list, time] = await Promise.all([read($, agents), read($, now)])
    // Each bot's look follows its start order, so agents started together
    // still get different bots.
    const order = new Map(list.map((row, i) => [row.id, i]))
    const styled = (row: AgentRow): AgentRow => ({ ...row, hue: (order.get(row.id) ?? 0) % SHADES.length })
    const working = list.filter(isActive)
    const rest = list.filter(row => !isActive(row)).reverse()
    const shown = [...working, ...rest].slice(0, 12).map(styled)
    const failed = rest.filter(row => lookOf(row).state === 'fail').length
    const busiest = Math.max(8, ...list.map(row => row.toolCount))

    const took = (row: AgentRow) => elapsed((row.endedAt ?? Math.max(time, row.startedAt)) - row.startedAt)

    // The terminal (no Svg): a plain colored list.
    if (!Svg) {
      return (
        <Box flexDirection="column">
          <Text bold>
            {working.length} working · {rest.length - failed} done{failed > 0 ? ` · ${failed} failed` : ''}
          </Text>
          {list.length === 0 && <Text dimColor>No subagents yet. They show up here as soon as one starts.</Text>}
          {shown.map(row => {
            const look = lookOf(row)
            const from = look.state === 'run' ? (SHADES[row.hue % SHADES.length] ?? ORANGE) : look.color
            const active = isActive(row)

            return (
              <Box key={row.id} flexDirection="column" borderStyle="round" borderColor={from} paddingX={1}>
                <Text bold>
                  <Text color={from}>{active ? SPIN[Math.floor(time / 1000) % SPIN.length] : look.state === 'done' ? '✓' : '✗'}</Text>{' '}
                  {row.description} <Text color={from}>[{look.label}]</Text>
                </Text>
                <Text dimColor>
                  {row.type} · {took(row)} · {row.toolCount} tools{active ? ` · ${row.tool ? `running ${row.tool}` : 'thinking'}` : ''}
                </Text>
              </Box>
            )
          })}
        </Box>
      )
    }

    return (
      <Box flexDirection="column" gap="md" padding="md" backgroundColor="#0E0E11" minHeight="100%">
        <Svg
          source={stats(working.length, rest.length - failed, failed)}
          alt={`${working.length} working, ${rest.length - failed} done, ${failed} failed`}
          height={56}
          isInteractive
        />
        {list.length === 0 && (
          <Text color={MUTED}>No subagents yet. They show up here as soon as one starts.</Text>
        )}
        {shown.map(row => {
          const look = lookOf(row)
          const active = isActive(row)

          return (
            <Box key={row.id} flexDirection="column" gap="xs">
              <Svg source={card(row, look)} alt={`${row.description}: ${look.label}`} height={104} isInteractive />
              <Box flexDirection="row" flexWrap="wrap" gap="xs" paddingX="sm" alignItems="center">
                <Text size="footnote" weight="semibold" color={WHITE} tabular>
                  ⏱ {took(row)}
                </Text>
                <Text size="footnote" color={MUTED}>
                  {' · '}
                  {row.toolCount} {row.toolCount === 1 ? 'tool' : 'tools'}
                </Text>
                {active && (
                  <Text size="footnote" color={look.soft} weight="medium">
                    {' · '}
                    {row.tool ? `▸ ${row.tool.startsWith('mcp__') ? row.tool.split('__').pop() : row.tool}` : 'Thinking…'}
                  </Text>
                )}
                {!active &&
                  chipsOf(row.recent).map(chip => (
                    <Text size="caption" backgroundColor="#26262D" color="#D4D4D8" weight="medium">
                      {` ${chip} `}
                    </Text>
                  ))}
              </Box>
            </Box>
          )
        })}
      </Box>
    )
  })
}
