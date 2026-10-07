# Optional terminal workspace

Use the base package for an embedded chart, `createWidget` for a chart with
controls, and `loadTerminal()` when the host needs dockable panels. Terminal
tools load asynchronously from the widget tier. Trading forms have a second
loader, `loadTradingPanels()`. Neither loader adds a runtime dependency.

These APIs require a package build containing the terminal workspace changes.
Merging the source and publishing an npm release are separate steps. Until a
release containing these APIs is published, build the merged source rather than
assuming the current registry version contains them.

## Create a docked chart and depth panel

Give the host container a non-zero width and height, for example
`<div id="workspace" style="height: 700px"></div>`. Supply your own `DataFeed` for
chart history and live bars. Depth snapshots are a separate input.

```ts
import { loadTerminal } from 'openalgo-charts/widget';
import type { DataFeed } from 'openalgo-charts';

export async function mountWorkspace(container: HTMLElement, feed: DataFeed) {
  const { createTerminalWorkspace, createChartPanel, createStandaloneDomPanel } =
    await loadTerminal();
  const workspace = createTerminalWorkspace(container, { persist: false });
  await workspace.ready;

  const chart = createChartPanel({
    id: 'chart-main', symbol: 'RELIANCE', interval: '5m', feed,
    linkGroup: 'blue', widgetOptions: { exchange: 'NSE' },
  });
  const depth = createStandaloneDomPanel({
    id: 'depth-main', symbol: 'RELIANCE', tickSize: 0.05, linkGroup: 'blue',
  });

  workspace.addPanel(chart);
  workspace.addPanel(depth, chart.id, 'right');
  return { workspace, chart, depth };
}
```

Pass a container element, or its element ID without `#`, to
`createTerminalWorkspace`. A drop position can be `left`, `right`, `top`,
`bottom` or `center`. Center puts the panel in a tab stack. `floatPanel` detaches
a panel within the same page; it does not create a separate browser window.

Send authoritative depth snapshots through `depth.setDepth(snapshot)` and last
prices through `depth.setLtp(price)`. The ladder reuses visible rows and coalesces
updates per frame. Its price-level intensity bars represent the current depth
snapshot, not historical liquidity. A chart history feed alone does not supply
live depth. The host owns subscription changes and unsubscribe callbacks.

## Open tools from each chart

The `tools` option adds controls to the chart that owns them. The callback
receives that chart's current widget, so it can read the selected instrument at
click time instead of using a global symbol.

```ts
import { loadTerminal } from 'openalgo-charts/widget';
import type { DataFeed } from 'openalgo-charts';
import type { TerminalWorkspace } from 'openalgo-charts/widget';

export async function addChartWithDepthTool(workspace: TerminalWorkspace, feed: DataFeed) {
  const { createChartPanel, createStandaloneDomPanel } = await loadTerminal();
  const chart = createChartPanel({
    id: 'chart-tools', symbol: 'RELIANCE', interval: '5m', feed,
    widgetOptions: { exchange: 'NSE' },
    tools: [{
      label: 'Depth',
      open(widget, chartId) {
        const id = `${chartId}-depth`;
        if (workspace.getPanel(id)) {
          workspace.activateTab(id);
          return;
        }
        workspace.addPanel(createStandaloneDomPanel({
          id, symbol: widget.symbol(), tickSize: 0.05,
        }), chartId, 'right');
      },
    }],
  });
  workspace.addPanel(chart);
  return chart;
}
```

This example opens an independent ladder. To synchronize subsequent instrument
changes, assign both panels the same link group. Groups are `red`, `blue`,
`green`, `yellow` and `purple`; `null` keeps a panel independent. The host should
track both symbol and exchange when switching depth subscriptions, and resolve
the tick size or tick schedule from instrument metadata. The standalone ladder
does not resolve an exchange or create its own feed subscription.

## Restore and close a workspace

Persistence is opt-in. Pass `persist: 'your-workspace-key'` and a `storage`
adapter implementing the widget's `StorageLike` or `AsyncStorageLike` contract.
If storage is omitted, the persisting workspace uses browser storage when it
is available. No feed object or credentials should be put in panel state.

Supply `createPanel(id, info)` to reconstruct saved panels with their original
ID and type. Resolve feeds, account sources and callbacks from the current host,
not from saved JSON. For an `orders` panel, distinguish a ticket from a book
using its saved `state.kind`. Use `validatePanelState` for custom panel state.

Await `workspace.ready` before adding initial default panels. A restored empty
workspace is also a user choice: do not replace it automatically with defaults.
Maintain a host initialization marker if first-use defaults need to differ from
an intentionally empty layout.

Restoration validates document bounds, panel types, link groups, tree references
and supported panel state before applying a layout. `onRestoreError` reports
invalid state; `onStorageError` reports storage failures. `ready` settles even
when restoration fails, so inspect those callbacks to present recovery choices.
Use `clearSavedLayout()` for an explicit reset rather than overwriting an
unreadable saved document with a default layout.

`saveLayout()` returns a portable document; `restoreLayout(document)` reports
whether the document was accepted. `flush()` waits for queued persistence writes.
Before a host-controlled navigation, await `workspace.flush()`, stop external
market-data subscriptions, then call `workspace.destroy()`. Browser shutdown
cannot guarantee completion of an asynchronous remote write. The workspace
releases mounted panel handles, chart widgets, observers and its own listeners;
custom panels must release their resources in their handle's `destroy()`.

## Add trading controls separately

```ts
import { loadTerminal } from 'openalgo-charts/widget';

export async function loadOrderControls() {
  const { loadTradingPanels } = await loadTerminal();
  return loadTradingPanels();
}
```

The returned module provides these factories:

| Factory | Host inputs |
| --- | --- |
| `createOrderTicketPanel` | panel ID, symbol, exchange, visible account/mode label, order callbacks and optional account/capability sources |
| `createOrdersPanel` | panel ID, label, authoritative order snapshot subscription and optional cancellation callback |
| `createWatchlistDockPanel` | panel ID, existing `WidgetContext` and watchlist configuration |

Tickets reuse the widget form controls, theme tokens and translation callback.
Supply `account`, `mode`, `capabilities` and `subscribeCapabilities` so account
readiness and provider support can update the controls. Pass write callbacks
through the host's `OrderEngine` or its authorized adapter. Labels and disabled
buttons do not replace execution checks in the host.

Native bracket entry needs `placeBracket` and a provider-specific
`bracketSupport` check. The terminal does not implement synthetic OCO execution.
The host's order engine and provider remain responsible for advanced order
semantics. See [Accounts & Advanced Orders](https://marketcalls.github.io/openalgo-charts/docs/trading-accounts/).

Orders displayed with an account source need each row's `account` identity to
enable cancellation for the selected account. The orders subscription must
return an unsubscribe callback. Order drafts, credentials and account objects
are excluded from saved workspace documents.

The watchlist factory reuses the existing widget watchlist. The host owns its
supplied context's lifetime. `positions`, `news`, `data`, `objects` and `custom`
are supported panel types for host adapters; a panel type alone does not provide
a built-in connected service or trading form.

## Examples and delivery

Build the repository with `npm run build`, then serve it with
`node tests/e2e/serve.cjs`. Open
`http://localhost:4173/examples/terminal/index.html` for the native workspace or
`http://localhost:4173/examples/dockview/index.html` for the separate docking
integration example. Both use recorded chart bars and simulated depth. The
external docking library is only an example development dependency.

When serving ESM bundles directly, ship the widget bundle and all of its hashed
first-use modules from the same build. `loadTerminal()` and `loadTradingPanels()`
use dynamic imports, so preserve sibling paths and permit their origin in the
host's script policy. Handle a rejected loader promise in the host UI and allow
the user to retry or reload. These loading instructions apply to the ESM build;
the classic script build includes its widget parts in the script itself.

The recorded Chromium workload in `benchmarks/terminal-soak-2026-10-07.md`
describes the measured build and test conditions. It is a short synthetic
characterization; validate sustained sessions and target browsers with the
host's actual data and account adapters.
