import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { buildShellSocketUrl } from '../services/shell';

interface ShellModalProps {
  open: boolean;
  deviceId: string;
  deviceName: string;
  onClose: () => void;
}

type ConnState = 'connecting' | 'open' | 'closed' | 'error';

// Modale a schermo intero con terminale interattivo (xterm.js) collegato via
// WebSocket alla shell SSH del device. Riservata agli admin.
export function ShellModal({ open, deviceId, deviceName, onClose }: ShellModalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<ConnState>('connecting');
  const [statusText, setStatusText] = useState<string>('');

  useEffect(() => {
    if (!open || !containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      fontSize: 13,
      theme: { background: '#0b1020' },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    try {
      fit.fit();
    } catch {
      /* dimensioni non ancora disponibili */
    }

    setState('connecting');
    setStatusText('Connessione in corso…');

    const url = buildShellSocketUrl(deviceId, {
      cols: term.cols,
      rows: term.rows,
    });
    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';

    const sendResize = () => {
      try {
        fit.fit();
      } catch {
        /* ignora */
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }),
        );
      }
    };

    ws.onopen = () => {
      setState('open');
      setStatusText('Connesso');
      sendResize();
      term.focus();
    };

    ws.onmessage = (ev: MessageEvent) => {
      if (typeof ev.data === 'string') {
        term.write(ev.data);
      } else {
        term.write(new Uint8Array(ev.data as ArrayBuffer));
      }
    };

    ws.onerror = () => {
      setState('error');
      setStatusText('Errore di connessione');
    };

    ws.onclose = (ev: CloseEvent) => {
      setState('closed');
      const reason = ev.reason ? `: ${ev.reason}` : '';
      setStatusText(`Sessione chiusa${reason}`);
      term.write(`\r\n\x1b[33m[sessione chiusa${reason}]\x1b[0m\r\n`);
    };

    const dataSub = term.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    const onWindowResize = () => sendResize();
    window.addEventListener('resize', onWindowResize);

    return () => {
      window.removeEventListener('resize', onWindowResize);
      dataSub.dispose();
      try {
        ws.close();
      } catch {
        /* gia' chiuso */
      }
      term.dispose();
    };
  }, [open, deviceId]);

  if (!open) return null;

  const badgeColor =
    state === 'open'
      ? 'bg-green-500'
      : state === 'connecting'
        ? 'bg-yellow-500'
        : 'bg-red-500';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/70 p-2 sm:p-4">
      <div className="flex flex-1 flex-col overflow-hidden rounded-lg bg-[#0b1020] shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-700 px-4 py-2">
          <div className="flex items-center gap-2 text-sm text-gray-200">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${badgeColor}`} />
            <span className="font-medium">Shell — {deviceName}</span>
            <span className="text-gray-400">{statusText}</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-md bg-gray-700 px-3 py-1 text-sm text-gray-100 hover:bg-gray-600"
          >
            Chiudi
          </button>
        </div>
        <div ref={containerRef} className="flex-1 overflow-hidden p-2" />
      </div>
    </div>
  );
}
