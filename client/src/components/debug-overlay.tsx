import { useState, useEffect, useCallback } from 'react';

interface Snapshot {
  label: string;
  timestamp: number;
  scrollTop: number;
  bodyScrollTop: number;
  htmlScrollTop: number;
  windowScrollY: number;
  headerRect: { top: number; height: number; bottom: number } | null;
  mainRect: { top: number; height: number; bottom: number } | null;
  bodyStyles: {
    overflow: string;
    position: string;
    top: string;
    paddingRight: string;
    height: string;
    marginTop: string;
  };
  htmlStyles: {
    overflow: string;
    position: string;
    marginTop: string;
  };
  mainStyles: {
    overflow: string;
    overflowY: string;
    paddingTop: string;
    marginTop: string;
    top: string;
    touchAction: string;
  };
  headerStyles: {
    top: string;
    height: string;
    paddingTop: string;
    position: string;
    transform: string;
  };
  safeAreaTop: string;
  visualViewport: { offsetTop: number; height: number; scale: number } | null;
  innerHeight: number;
  outerHeight: number;
  dikaPresent: boolean;
  dikaOverlayPresent: boolean;
}

function captureSnapshot(label: string): Snapshot {
  const mainEl = document.querySelector('.app-main-scroll') as HTMLElement | null;
  const headerEl = document.querySelector('.mobile-fixed-header') as HTMLElement | null;

  const mainRect = mainEl?.getBoundingClientRect() ?? null;
  const headerRect = headerEl?.getBoundingClientRect() ?? null;

  const bodyCS = window.getComputedStyle(document.body);
  const htmlCS = window.getComputedStyle(document.documentElement);
  const mainCS = mainEl ? window.getComputedStyle(mainEl) : null;
  const headerCS = headerEl ? window.getComputedStyle(headerEl) : null;

  let safeAreaTop = 'unknown';
  try {
    const temp = document.createElement('div');
    temp.style.position = 'fixed';
    temp.style.top = '0';
    temp.style.height = 'env(safe-area-inset-top, 0px)';
    temp.style.visibility = 'hidden';
    document.body.appendChild(temp);
    safeAreaTop = temp.getBoundingClientRect().height + 'px';
    document.body.removeChild(temp);
  } catch {}

  return {
    label,
    timestamp: Date.now(),
    scrollTop: mainEl?.scrollTop ?? -1,
    bodyScrollTop: document.body.scrollTop,
    htmlScrollTop: document.documentElement.scrollTop,
    windowScrollY: window.scrollY,
    headerRect: headerRect ? { top: headerRect.top, height: headerRect.height, bottom: headerRect.bottom } : null,
    mainRect: mainRect ? { top: mainRect.top, height: mainRect.height, bottom: mainRect.bottom } : null,
    bodyStyles: {
      overflow: bodyCS.overflow,
      position: bodyCS.position,
      top: bodyCS.top,
      paddingRight: bodyCS.paddingRight,
      height: bodyCS.height,
      marginTop: bodyCS.marginTop,
    },
    htmlStyles: {
      overflow: htmlCS.overflow,
      position: htmlCS.position,
      marginTop: htmlCS.marginTop,
    },
    mainStyles: {
      overflow: mainCS?.overflow ?? 'N/A',
      overflowY: mainCS?.overflowY ?? 'N/A',
      paddingTop: mainCS?.paddingTop ?? 'N/A',
      marginTop: mainCS?.marginTop ?? 'N/A',
      top: mainCS?.top ?? 'N/A',
      touchAction: mainCS?.touchAction ?? 'N/A',
    },
    headerStyles: {
      top: headerCS?.top ?? 'N/A',
      height: headerCS?.height ?? 'N/A',
      paddingTop: headerCS?.paddingTop ?? 'N/A',
      position: headerCS?.position ?? 'N/A',
      transform: headerCS?.transform ?? 'N/A',
    },
    safeAreaTop,
    visualViewport: window.visualViewport ? {
      offsetTop: window.visualViewport.offsetTop,
      height: window.visualViewport.height,
      scale: window.visualViewport.scale,
    } : null,
    innerHeight: window.innerHeight,
    outerHeight: window.outerHeight,
    dikaPresent: !!document.querySelector('[data-testid="drawer-dika"]'),
    dikaOverlayPresent: !!document.querySelector('[data-testid="overlay-dika"]'),
  };
}

function diffSnapshots(a: Snapshot, b: Snapshot): string[] {
  const diffs: string[] = [];
  const compare = (path: string, va: any, vb: any) => {
    if (typeof va === 'object' && va !== null && typeof vb === 'object' && vb !== null) {
      for (const key of new Set([...Object.keys(va), ...Object.keys(vb)])) {
        compare(`${path}.${key}`, va[key], vb[key]);
      }
    } else if (va !== vb) {
      diffs.push(`${path}: ${JSON.stringify(va)} -> ${JSON.stringify(vb)}`);
    }
  };

  const keys: (keyof Snapshot)[] = [
    'scrollTop', 'bodyScrollTop', 'htmlScrollTop', 'windowScrollY',
    'headerRect', 'mainRect', 'bodyStyles', 'htmlStyles',
    'mainStyles', 'headerStyles', 'safeAreaTop', 'visualViewport',
    'innerHeight', 'outerHeight', 'dikaPresent', 'dikaOverlayPresent'
  ];
  for (const key of keys) {
    compare(key, a[key], b[key]);
  }
  return diffs;
}

export function DebugOverlay() {
  const [visible, setVisible] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [diffs, setDiffs] = useState<string[]>([]);

  const takeSnapshot = useCallback((label: string) => {
    const snap = captureSnapshot(label);
    setSnapshots(prev => {
      const next = [...prev, snap];
      if (next.length >= 2) {
        setDiffs(diffSnapshots(next[next.length - 2], next[next.length - 1]));
      }
      return next;
    });
  }, []);

  useEffect(() => {
    (window as any).__debugTakeSnapshot = takeSnapshot;
    (window as any).__debugShowOverlay = () => setVisible(true);
    return () => {
      delete (window as any).__debugTakeSnapshot;
      delete (window as any).__debugShowOverlay;
    };
  }, [takeSnapshot]);

  if (!visible) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: 80,
          left: 4,
          zIndex: 999999,
          background: 'red',
          color: 'white',
          padding: '4px 8px',
          borderRadius: 4,
          fontSize: 10,
          fontWeight: 'bold',
          opacity: 0.9,
        }}
        onClick={() => setVisible(true)}
      >
        DBG
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999999,
        background: 'rgba(0,0,0,0.95)',
        color: '#0f0',
        fontFamily: 'monospace',
        fontSize: 11,
        padding: '60px 8px 8px',
        overflow: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <button
          onClick={() => takeSnapshot('BEFORE Dika')}
          style={{ background: '#333', color: '#0f0', border: '1px solid #0f0', padding: '6px 10px', borderRadius: 4, fontSize: 11 }}
        >
          Snap BEFORE
        </button>
        <button
          onClick={() => takeSnapshot('AFTER Dika')}
          style={{ background: '#333', color: '#ff0', border: '1px solid #ff0', padding: '6px 10px', borderRadius: 4, fontSize: 11 }}
        >
          Snap AFTER
        </button>
        <button
          onClick={() => takeSnapshot('CURRENT')}
          style={{ background: '#333', color: '#0ff', border: '1px solid #0ff', padding: '6px 10px', borderRadius: 4, fontSize: 11 }}
        >
          Snap NOW
        </button>
        <button
          onClick={() => { setSnapshots([]); setDiffs([]); }}
          style={{ background: '#333', color: '#f00', border: '1px solid #f00', padding: '6px 10px', borderRadius: 4, fontSize: 11 }}
        >
          Clear
        </button>
        <button
          onClick={() => setVisible(false)}
          style={{ background: '#333', color: '#fff', border: '1px solid #fff', padding: '6px 10px', borderRadius: 4, fontSize: 11 }}
        >
          Hide
        </button>
      </div>

      {diffs.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ color: '#ff0', fontWeight: 'bold', marginBottom: 4 }}>CHANGES DETECTED:</div>
          {diffs.map((d, i) => (
            <div key={i} style={{ color: '#f80', wordBreak: 'break-all' }}>{d}</div>
          ))}
        </div>
      )}

      {snapshots.map((snap, idx) => (
        <div key={idx} style={{ marginBottom: 12, borderBottom: '1px solid #333', paddingBottom: 8 }}>
          <div style={{ color: '#fff', fontWeight: 'bold' }}>{snap.label} (#{idx + 1})</div>
          <div>scrollTop: {snap.scrollTop}</div>
          <div>body.scrollTop: {snap.bodyScrollTop} | html.scrollTop: {snap.htmlScrollTop}</div>
          <div>window.scrollY: {snap.windowScrollY}</div>
          <div>safeAreaTop: {snap.safeAreaTop}</div>
          <div>innerH: {snap.innerHeight} | outerH: {snap.outerHeight}</div>
          <div>header rect: {snap.headerRect ? `top=${snap.headerRect.top} h=${snap.headerRect.height}` : 'N/A'}</div>
          <div>main rect: {snap.mainRect ? `top=${snap.mainRect.top} h=${snap.mainRect.height}` : 'N/A'}</div>
          <div>body: pos={snap.bodyStyles.position} ovf={snap.bodyStyles.overflow} top={snap.bodyStyles.top} mt={snap.bodyStyles.marginTop}</div>
          <div>html: pos={snap.htmlStyles.position} ovf={snap.htmlStyles.overflow} mt={snap.htmlStyles.marginTop}</div>
          <div>main: ovf={snap.mainStyles.overflow}/{snap.mainStyles.overflowY} pt={snap.mainStyles.paddingTop} mt={snap.mainStyles.marginTop} touch={snap.mainStyles.touchAction}</div>
          <div>header: pos={snap.headerStyles.position} top={snap.headerStyles.top} h={snap.headerStyles.height} pt={snap.headerStyles.paddingTop}</div>
          <div>viewport: {snap.visualViewport ? `offTop=${snap.visualViewport.offsetTop} h=${snap.visualViewport.height}` : 'N/A'}</div>
          <div>dika: {snap.dikaPresent ? 'YES' : 'no'} | overlay: {snap.dikaOverlayPresent ? 'YES' : 'no'}</div>
        </div>
      ))}

      {snapshots.length === 0 && (
        <div style={{ color: '#888', marginTop: 20 }}>
          Instructions:{'\n'}
          1. Hide this overlay{'\n'}
          2. On the normal page, tap "Snap BEFORE"{'\n'}
          3. Open Dika, then close it{'\n'}
          4. Tap "Snap AFTER"{'\n'}
          5. Open this overlay to see what changed
        </div>
      )}
    </div>
  );
}
