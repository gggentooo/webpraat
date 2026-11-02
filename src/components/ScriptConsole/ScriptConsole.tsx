import React, { useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import {
  scriptTextAtom,
  scriptNameAtom,
  scriptRevisionAtom,
  isScriptRunningAtom,
  infoOutputAtom,
  objectsAtom,
  selectedIdsAtom,
  statusMessageAtom,
  pictureCommandsAtom,
  pictureViewportAtom,
  picturePenAtom,
} from '../../store';
import { useI18n } from '../../hooks/useI18n';
import { getPraatWorker, downloadBlob } from '../../utils/audio';
import { parsePraatPictureScriptCommands } from '../../utils/pictureRenderer';
import { praatLanguage } from './praatSyntax';

interface ScriptConsoleProps {
  onClose?: () => void;
}

export const ScriptConsole: React.FC<ScriptConsoleProps> = ({ onClose }) => {
  const { t } = useI18n();
  const [scriptText, setScriptText] = useAtom(scriptTextAtom);
  const [scriptName, setScriptName] = useAtom(scriptNameAtom);
  const [scriptRevision, setScriptRevision] = useAtom(scriptRevisionAtom);
  const [isScriptRunning, setIsScriptRunning] = useAtom(isScriptRunningAtom);
  const [, setInfoOutput] = useAtom(infoOutputAtom);
  const [, setObjects] = useAtom(objectsAtom);
  const [, setSelectedIds] = useAtom(selectedIdsAtom);
  const [, setStatusMessage] = useAtom(statusMessageAtom);
  const [, setPictureCommands] = useAtom(pictureCommandsAtom);
  const [pictureViewport, setPictureViewport] = useAtom(pictureViewportAtom);
  const [picturePen, setPicturePen] = useAtom(picturePenAtom);

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
    picture: `# Praat Script: Vowel Space Vector Plot in Praat Picture
Erase all
Select outer viewport: 0, 6, 0, 5
Axes: 2500, 500, 900, 200
Colour: "Black"
Line width: 1.5
Draw inner box
Text top: "no", "Cardinal Vowel F1-F2 Space"

Colour: "Blue"
Paint circle: "Blue", 2250, 280, 35
Text: 2250, "centre", 230, "half", "/i/"

Colour: "Red"
Paint circle: "Red", 1200, 750, 35
Text: 1200, "centre", 810, "half", "/a/"

Colour: "Teal"
Paint circle: "Teal", 750, 300, 35
Text: 750, "centre", 250, "half", "/u/"

Colour: "Grey"
Dashed line
Draw line: 2250, 280, 1200, 750
Draw line: 1200, 750, 750, 300
Draw line: 750, 300, 2250, 280
Solid line
writeInfoLine: "Drew vowel triangle to Praat Picture!"
`,
  };

  const handleRunScript = async () => {
    if (isScriptRunning) return;
    setIsScriptRunning(true);
    setStatusMessage(t.script.running);

    try {
      const codeToRun = editorViewRef.current
        ? editorViewRef.current.state.doc.toString()
        : scriptText;

      const parsedPic = parsePraatPictureScriptCommands(
        codeToRun,
        pictureViewport,
        picturePen
      );

      if (parsedPic.hasPictureCommands) {
        setPictureViewport(parsedPic.finalViewport);
        setPicturePen(parsedPic.finalPen);
        setPictureCommands((prev) =>
          parsedPic.eraseAll ? parsedPic.commands : [...prev, ...parsedPic.commands]
        );
      }

      const hasRemainingExecutable = parsedPic.remainingDspScript
        .split(/\r?\n/)
        .some((l) => {
          const trimmed = l.trim();
          return trimmed.length > 0 && !trimmed.startsWith('#') && !trimmed.startsWith(';');
        });

      const resetsInfo = /(?:^|\n)\s*(?:clearinfo|writeInfo(?:Line)?\b)/im.test(codeToRun);

      const worker = getPraatWorker();
      let hadScriptError = false;
      if (hasRemainingExecutable) {
        const output = await worker.executeScript(parsedPic.remainingDspScript);
        if (output && /^Error:/i.test(output.trim())) {
          hadScriptError = true;
        }
        if (resetsInfo && !hadScriptError) {
          setInfoOutput(output || '');
        } else if (output) {
          setInfoOutput((prev) => (prev ? prev + '\n' + output : output));
        }
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

      setStatusMessage(hadScriptError ? t.script.scriptError : t.script.scriptCompleted);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external updates (e.g., MenuBar New/Open Praat script or OPFS restore) into CodeMirror
  useEffect(() => {
    const view = editorViewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (currentDoc !== scriptText) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: scriptText },
      });
    }
  }, [scriptText, scriptRevision]);

  // Focus the CodeMirror editor when explicitly creating or opening a script
  useEffect(() => {
    if (scriptRevision > 0) {
      editorViewRef.current?.focus();
    }
  }, [scriptRevision]);

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

  const handleNewScript = () => {
    updateEditorDoc('');
    setScriptName(t.script.untitledScript);
    setScriptRevision((r) => r + 1);
    setStatusMessage(t.script.newScriptCreated);
    setTimeout(() => setStatusMessage(''), 3000);
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
      setScriptName(`${key}.praat`);
    }
    e.target.value = '';
  };

  const handleSaveScript = () => {
    const content = editorViewRef.current
      ? editorViewRef.current.state.doc.toString()
      : scriptText;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const filename = scriptName && scriptName.trim() ? scriptName.trim() : t.script.untitledScript;
    downloadBlob(blob, filename.includes('.') ? filename : `${filename}.praat`);
  };

  const handleOpenScriptFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    try {
      const content = await file.text();
      updateEditorDoc(content);
      setScriptName(file.name);
      setScriptRevision((r) => r + 1);
      setStatusMessage(`${t.script.scriptLoaded}: ${file.name}`);
      setTimeout(() => {
        alert(`${t.script.scriptLoadSuccess}\n${file.name}`);
      }, 30);
    } catch (err: any) {
      const reason = err?.message || String(err);
      setStatusMessage(t.script.scriptLoadError);
      alert(`${t.script.scriptLoadError}: ${reason}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setStatusMessage(''), 3000);
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-white">
      <input
        ref={fileInputRef}
        type="file"
        accept=".praat,.psc,.script,.txt,text/plain"
        className="hidden"
        onChange={handleOpenScriptFile}
      />

      <div className="flex h-10 shrink-0 items-center justify-between border-b border-slate-300 bg-slate-100 px-3 text-xs overflow-x-auto">
        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={handleRunScript}
            disabled={isScriptRunning}
            className={`flex items-center rounded border border-blue-600 bg-blue-600 px-3 py-1 font-semibold text-white shadow-xs transition hover:bg-blue-700 active:bg-blue-800 whitespace-nowrap shrink-0 ${
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

          <span className="text-[11px] text-slate-400 font-mono hidden sm:inline whitespace-nowrap">
            ({t.script.shortcutHint})
          </span>

          <div className="h-4 border-r border-slate-300 mx-1 shrink-0" />

          <span
            className="rounded border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] text-slate-700 whitespace-nowrap shrink-0"
            title={scriptName}
          >
            {scriptName || t.script.untitledScript}
          </span>

          <button
            type="button"
            onClick={handleNewScript}
            className="rounded border border-slate-300 bg-white px-2.5 py-1 text-slate-700 hover:bg-slate-50 active:bg-slate-100 whitespace-nowrap shrink-0"
          >
            {t.script.newScript}
          </button>

          <button
            type="button"
            onClick={handleClearScript}
            className="rounded border border-slate-300 bg-white px-2.5 py-1 text-slate-700 hover:bg-slate-50 active:bg-slate-100 whitespace-nowrap shrink-0"
          >
            {t.script.clear}
          </button>

          <button
            type="button"
            onClick={handleClearInfo}
            className="rounded border border-slate-300 bg-white px-2.5 py-1 text-slate-700 hover:bg-slate-50 active:bg-slate-100 whitespace-nowrap shrink-0"
          >
            {t.script.clearInfo}
          </button>

          <select
            defaultValue=""
            onChange={handleSelectSample}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 outline-none hover:border-slate-400 cursor-pointer whitespace-nowrap shrink-0"
          >
            <option value="" disabled>
              {t.script.samples}
            </option>
            <option value="arithmetic">{t.script.sampleArithmetic}</option>
            <option value="procedures">{t.script.sampleProcedures}</option>
            <option value="variables">{t.script.sampleVariables}</option>
            <option value="picture">{t.script.samplePicture}</option>
          </select>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded border border-slate-300 bg-white px-2.5 py-1 text-slate-700 hover:bg-slate-50 active:bg-slate-100 whitespace-nowrap shrink-0"
          >
            {t.script.openScript}
          </button>

          <button
            type="button"
            onClick={handleSaveScript}
            className="rounded border border-slate-300 bg-white px-2.5 py-1 text-slate-700 hover:bg-slate-50 active:bg-slate-100 whitespace-nowrap shrink-0"
          >
            {t.script.saveScript}
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title={t.script.closeTab}
              className="ml-2 rounded px-2 py-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800 whitespace-nowrap shrink-0"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <div ref={editorContainerRef} className="h-full w-full" />
      </div>
    </div>
  );
};
