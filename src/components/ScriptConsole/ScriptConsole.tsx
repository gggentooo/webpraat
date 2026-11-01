import React, { useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import {
  scriptTextAtom,
  isScriptRunningAtom,
  infoOutputAtom,
  objectsAtom,
  selectedIdsAtom,
  statusMessageAtom,
} from '../../store';
import { useI18n } from '../../hooks/useI18n';
import { getPraatWorker, downloadBlob } from '../../utils/audio';
import { praatLanguage } from './praatSyntax';

interface ScriptConsoleProps {
  onClose?: () => void;
}

export const ScriptConsole: React.FC<ScriptConsoleProps> = ({ onClose }) => {
  const { t } = useI18n();
  const [scriptText, setScriptText] = useAtom(scriptTextAtom);
  const [isScriptRunning, setIsScriptRunning] = useAtom(isScriptRunningAtom);
  const [, setInfoOutput] = useAtom(infoOutputAtom);
  const [, setObjects] = useAtom(objectsAtom);
  const [, setSelectedIds] = useAtom(selectedIdsAtom);
  const [, setStatusMessage] = useAtom(statusMessageAtom);

  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const runScriptRef = useRef<() => void>(() => {});

  const SAMPLE_SCRIPTS: Record<string, string> = {
    arithmetic: `# Praat Script: Arithmetic & Loops
clearinfo
writeInfoLine: "WebPraat Batch Calculation"
writeInfoLine: "----------------------------------------"
sum = 0
for i from 1 to 10
    square = i * i
    sum = sum + square
    appendInfoLine: "i = ", i, tab$, "square = ", square, tab$, "cumulative sum = ", sum
endfor
appendInfoLine: ""
appendInfoLine: "Total sum of squares: ", sum
`,
    procedures: `# Praat Script: Procedures and String Formatting
procedure printBanner: .text$
    appendInfoLine: "=== ", .text$, " ==="
endproc

procedure analyzeVowel: .vowel$, .f1, .f2
    appendInfoLine: "Vowel /", .vowel$, "/ -> F1: ", .f1, " Hz, F2: ", .f2, " Hz"
endproc

clearinfo
@printBanner: "Vowel Formant Chart"
@analyzeVowel: "i", 280, 2250
@analyzeVowel: "e", 400, 1920
@analyzeVowel: "a", 750, 1200
@analyzeVowel: "o", 450, 950
@analyzeVowel: "u", 300, 750
@printBanner: "Analysis Complete"
`,
    variables: `# Praat Script: Batch Variable Operations
clearinfo
writeInfoLine: "Statistical Summary:"
n = 5
v1 = 12.5
v2 = 18.2
v3 = 9.8
v4 = 15.3
v5 = 22.1

total = v1 + v2 + v3 + v4 + v5
mean = total / n

appendInfoLine: "Count: ", n
appendInfoLine: "Sum:   ", fixed$(total, 2)
appendInfoLine: "Mean:  ", fixed$(mean, 2)
`,
  };

  const handleRunScript = async () => {
    if (isScriptRunning) return;
    setIsScriptRunning(true);
    setStatusMessage(t.script.running);

    try {
      const worker = getPraatWorker();
      const output = await worker.executeScript(scriptText);

      // Append output to Info window
      if (output) {
        setInfoOutput((prev) => (prev ? prev + '\n' + output : output));
      }

      // Synchronize objects list with WASM state
      const currentObjects = await worker.getObjectsJson();
      if (currentObjects) {
        setObjects((prev) => {
          const existingMap = new Map(prev.map((o) => [o.id, o]));
          return currentObjects.map((obj) => {
            const existing = existingMap.get(obj.id);
            return {
              id: obj.id,
              className: obj.className,
              name: obj.name,
              duration: obj.duration ?? existing?.duration,
              sampleRate: obj.sampleRate ?? existing?.sampleRate,
              numChannels: obj.numChannels ?? existing?.numChannels,
              numSamples: obj.numSamples ?? existing?.numSamples,
              createdAt: existing?.createdAt ?? Date.now(),
            };
          });
        });

        const activeIdSet = new Set(currentObjects.map((o) => o.id));
        setSelectedIds((prev) => prev.filter((id) => activeIdSet.has(id)));
      }

      setStatusMessage(t.script.scriptCompleted);
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      setInfoOutput((prev) => (prev ? `${prev}\n${errMsg}` : errMsg));
      setStatusMessage(t.script.scriptError);
    } finally {
      setIsScriptRunning(false);
      setTimeout(() => setStatusMessage(''), 3000);
    }
  };

  runScriptRef.current = handleRunScript;

  // Initialize CodeMirror 6
  useEffect(() => {
    if (!editorContainerRef.current) return;

    const startState = EditorState.create({
      doc: scriptText,
      extensions: [
        basicSetup,
        praatLanguage,
        keymap.of([
          {
            key: 'Mod-Enter',
            run: () => {
              runScriptRef.current?.();
              return true;
            },
          },
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            setScriptText(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          '&': {
            height: '100%',
            fontSize: '13px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          },
          '.cm-scroller': {
            overflow: 'auto',
          },
          '.cm-content': {
            padding: '12px 4px',
          },
          '.cm-line': {
            padding: '0 4px',
          },
          '&.cm-focused': {
            outline: 'none',
          },
        }),
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: editorContainerRef.current,
    });

    editorViewRef.current = view;

    return () => {
      view.destroy();
      editorViewRef.current = null;
    };
  }, []);

  // Sync external changes to editor doc
  const updateEditorDoc = (newText: string) => {
    setScriptText(newText);
    if (editorViewRef.current) {
      const currentDoc = editorViewRef.current.state.doc.toString();
      if (currentDoc !== newText) {
        editorViewRef.current.dispatch({
          changes: { from: 0, to: currentDoc.length, insert: newText },
        });
      }
    }
  };

  const handleClearScript = () => {
    updateEditorDoc('');
  };

  const handleClearInfo = async () => {
    setInfoOutput('');
    try {
      const worker = getPraatWorker();
      await worker.clearInfoOutput();
    } catch {}
  };

  const handleSelectSample = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const key = e.target.value;
    if (key && SAMPLE_SCRIPTS[key]) {
      updateEditorDoc(SAMPLE_SCRIPTS[key]);
    }
    e.target.value = '';
  };

  const handleSaveScript = () => {
    const blob = new Blob([scriptText], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, 'script.praat');
  };

  const handleOpenScriptFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        updateEditorDoc(content);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex h-full w-full flex-col bg-white">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".praat,.txt"
        className="hidden"
        onChange={handleOpenScriptFile}
      />

      {/* Script Console Action Toolbar */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-slate-300 bg-slate-100 px-3 text-xs">
        <div className="flex items-center space-x-2">
          {/* Run Button */}
          <button
            type="button"
            onClick={handleRunScript}
            disabled={isScriptRunning}
            className={`flex items-center rounded border border-blue-600 bg-blue-600 px-3 py-1 font-semibold text-white shadow-xs transition hover:bg-blue-700 active:bg-blue-800 ${
              isScriptRunning ? 'cursor-not-allowed opacity-60' : ''
            }`}
            title={t.script.shortcutHint}
          >
            {isScriptRunning ? (
              <>
                <span className="mr-1.5 inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>{t.script.running}</span>
              </>
            ) : (
              <>
                <span className="mr-1">▶</span>
                <span>{t.script.run}</span>
              </>
            )}
          </button>

          <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
            ({t.script.shortcutHint})
          </span>

          <div className="h-4 border-r border-slate-300 mx-1" />

          {/* Clear Script */}
          <button
            type="button"
            onClick={handleClearScript}
            className="rounded border border-slate-300 bg-white px-2.5 py-1 text-slate-700 hover:bg-slate-50 active:bg-slate-100"
          >
            {t.script.clear}
          </button>

          {/* Clear Info */}
          <button
            type="button"
            onClick={handleClearInfo}
            className="rounded border border-slate-300 bg-white px-2.5 py-1 text-slate-700 hover:bg-slate-50 active:bg-slate-100"
          >
            {t.script.clearInfo}
          </button>

          {/* Sample Scripts Selector */}
          <select
            defaultValue=""
            onChange={handleSelectSample}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 outline-none hover:border-slate-400 cursor-pointer"
          >
            <option value="" disabled>
              {t.script.samples}
            </option>
            <option value="arithmetic">{t.script.sampleArithmetic}</option>
            <option value="procedures">{t.script.sampleProcedures}</option>
            <option value="variables">{t.script.sampleVariables}</option>
          </select>
        </div>

        <div className="flex items-center space-x-2">
          {/* Open Script File */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded border border-slate-300 bg-white px-2.5 py-1 text-slate-700 hover:bg-slate-50 active:bg-slate-100"
          >
            {t.script.openScript}
          </button>

          {/* Save Script File */}
          <button
            type="button"
            onClick={handleSaveScript}
            className="rounded border border-slate-300 bg-white px-2.5 py-1 text-slate-700 hover:bg-slate-50 active:bg-slate-100"
          >
            {t.script.saveScript}
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title={t.script.closeTab}
              className="ml-2 rounded px-2 py-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* CodeMirror Editor Container */}
      <div className="flex-1 overflow-hidden relative">
        <div ref={editorContainerRef} className="h-full w-full" />
      </div>
    </div>
  );
};
