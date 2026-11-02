import { useEffect, useRef } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  activeTabAtom,
  editorSoundIdAtom,
  editorTextGridIdAtom,
  objectsAtom,
  selectedIdsAtom,
  scriptTextAtom,
  scriptNameAtom,
  scriptRevisionAtom,
  statusMessageAtom,
  isProcessingAtom,
  workspaceHydratedAtom,
  scriptFormModalAtom,
} from './store';
import { useI18n } from './hooks/useI18n';
import { useScriptExecution } from './hooks/useScriptExecution';
import { MenuBar } from './components/MenuBar/MenuBar';
import { ObjectsPanel } from './components/ObjectsPanel/ObjectsPanel';
import { InfoWindow } from './components/InfoWindow/InfoWindow';
import { ModalDialog } from './components/shared/ModalDialog';
import { SoundRecorderModal } from './components/SoundRecorder/SoundRecorderModal';
import { ScriptFormModal } from './components/ScriptConsole/ScriptFormModal';
import { ScriptPauseWindow } from './components/ScriptConsole/ScriptPauseWindow';
import { SoundEditor } from './components/SoundEditor/SoundEditor';
import { TextGridEditor } from './components/TextGridEditor/TextGridEditor';
import { ScriptConsole } from './components/ScriptConsole/ScriptConsole';
import { PictureWindow } from './components/PictureWindow/PictureWindow';
import { getPraatWorker } from './utils/audio';
import { loadWorkspaceFromOpfs, saveWorkspaceToOpfs } from './utils/persistence';

export default function App() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useAtom(activeTabAtom);
  const [editorSoundId, setEditorSoundId] = useAtom(editorSoundIdAtom);
  const [editorTextGridId, setEditorTextGridId] = useAtom(editorTextGridIdAtom);
  const [objects, setObjects] = useAtom(objectsAtom);
  const setSelectedIds = useSetAtom(selectedIdsAtom);
  const [scriptText, setScriptText] = useAtom(scriptTextAtom);
  const scriptName = useAtomValue(scriptNameAtom);
  const setScriptRevision = useSetAtom(scriptRevisionAtom);
  const [statusMessage, setStatusMessage] = useAtom(statusMessageAtom);
  const isProcessing = useAtomValue(isProcessingAtom);
  const [hydrated, setHydrated] = useAtom(workspaceHydratedAtom);
  const [scriptFormModal, setScriptFormModal] = useAtom(scriptFormModalAtom);

  const { runScript, resumeScript, abortScript, scriptPauseState } = useScriptExecution();

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore cached workspace from OPFS on startup
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const worker = getPraatWorker();
        const restored = await loadWorkspaceFromOpfs(worker);
        if (!cancelled && restored) {
          if (restored.objects.length > 0) {
            setObjects(restored.objects);
            setSelectedIds([restored.objects[0].id]);
            setStatusMessage(t.status.workspaceRestored);
          }
          if (restored.scriptText) {
            setScriptText(restored.scriptText);
            setScriptRevision((r) => r + 1);
          }
        }
      } catch (err) {
        console.warn('OPFS workspace restore skipped:', err);
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-persist workspace objects & script to OPFS after hydration
  useEffect(() => {
    if (!hydrated) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      const worker = getPraatWorker();
      void saveWorkspaceToOpfs(worker, objects, scriptText);
    }, 800);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [hydrated, objects, scriptText]);

  const editorSound = objects.find((o) => o.id === editorSoundId);
  const editorTextGrid = objects.find((o) => o.id === editorTextGridId);

  const handleCloseEditor = () => {
    setActiveTab('objects');
    setEditorSoundId(null);
  };

  const handleCloseTextGridEditor = () => {
    setActiveTab('objects');
    setEditorTextGridId(null);
  };

  return (
    <div className="w-full h-full overflow-auto bg-slate-200 flex">
      {/* Outermost GUI Wrapper with Minimum Width and Height Restraints */}
      <div className="flex h-full w-full min-w-[1200px] min-h-[680px] shrink-0 flex-col overflow-hidden bg-slate-200 font-sans text-slate-800">
        {/* 1. Top MenuBar */}
        <header className="h-9 shrink-0">
          <MenuBar />
        </header>

        {/* 2. Middle Workspace Area */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Left Pane: Praat Objects Window (List + Dynamic Actions) */}
          <aside className="w-[500px] shrink-0 border-r border-slate-300 bg-white flex flex-col shadow-xs">
            <ObjectsPanel />
          </aside>

          {/* Right Pane: Workspace / Editor / Praat Picture */}
          <main className="flex flex-1 flex-col overflow-hidden bg-slate-100 min-w-0">
          {/* Editor Header / Tab bar */}
          <div className="flex h-7 shrink-0 items-center border-b border-slate-300 bg-slate-200 px-2 text-xs font-medium overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('picture')}
              className={`flex items-center px-3 py-1 rounded-t border-t border-x whitespace-nowrap shrink-0 ${
                activeTab === 'objects' || activeTab === 'picture'
                  ? 'border-slate-300 bg-white text-slate-800 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-800'
              }`}
            >
              <span>{t.app.pictureTitle}</span>
            </button>

            {editorSound && (
              <div
                className={`ml-1 flex items-center rounded-t border-t border-x px-3 py-1 whitespace-nowrap shrink-0 ${
                  activeTab === 'soundEditor'
                    ? 'border-slate-300 bg-white text-blue-700 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-800'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveTab('soundEditor')}
                  className="mr-2 whitespace-nowrap"
                >
                  {editorSound.name} ({t.editor.soundEditorTitle})
                </button>
                <button
                  type="button"
                  onClick={handleCloseEditor}
                  title={t.editor.closeEditor}
                  className="text-slate-400 hover:text-red-600 rounded px-1 shrink-0"
                >
                  ✕
                </button>
              </div>
            )}

            {editorTextGrid && (
              <div
                className={`ml-1 flex items-center rounded-t border-t border-x px-3 py-1 whitespace-nowrap shrink-0 ${
                  activeTab === 'textGridEditor'
                    ? 'border-slate-300 bg-white text-blue-700 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-800'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveTab('textGridEditor')}
                  className="mr-2 whitespace-nowrap"
                >
                  {editorTextGrid.name} ({t.editor.textGridEditorTitle})
                </button>
                <button
                  type="button"
                  onClick={handleCloseTextGridEditor}
                  title={t.editor.closeEditor}
                  className="text-slate-400 hover:text-red-600 rounded px-1 shrink-0"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Praat Script Tab */}
            <div
              className={`ml-1 flex items-center rounded-t border-t border-x px-3 py-1 whitespace-nowrap shrink-0 ${
                activeTab === 'script'
                  ? 'border-slate-300 bg-white text-blue-700 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-800'
              }`}
            >
              <button
                type="button"
                onClick={() => setActiveTab('script')}
                className="mr-1 whitespace-nowrap"
              >
                {t.script.title}
                {activeTab === 'script' && scriptName ? ` (${scriptName})` : ''}
              </button>
              {activeTab === 'script' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('objects')}
                  title={t.script.closeTab}
                  className="text-slate-400 hover:text-red-600 rounded px-1 shrink-0"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Tab Content Body */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {activeTab === 'soundEditor' && editorSound ? (
              <SoundEditor sound={editorSound} onClose={handleCloseEditor} />
            ) : activeTab === 'textGridEditor' && editorTextGrid ? (
              <TextGridEditor
                sound={editorSound}
                textGrid={editorTextGrid}
                onClose={handleCloseTextGridEditor}
              />
            ) : activeTab === 'script' ? (
              <ScriptConsole onClose={() => setActiveTab('objects')} />
            ) : (
              <PictureWindow />
            )}
          </div>
        </main>
      </div>

      {/* 3. Bottom Pane: Praat Info Window */}
      <footer className="h-44 shrink-0 border-t border-slate-300 bg-white shadow-xs">
        <InfoWindow />
      </footer>

      {/* 4. Bottom Status Line */}
      <div className="flex h-5 shrink-0 items-center justify-between border-t border-slate-300 bg-slate-200 px-3 text-[11px] text-slate-600 select-none">
        <div className="flex items-center space-x-2">
          <span>{statusMessage || t.status.ready}</span>
        </div>
        {isProcessing && (
          <div className="flex items-center space-x-1 text-blue-700 font-medium">
            <span className="animate-spin inline-block h-2.5 w-2.5 rounded-full border border-blue-600 border-t-transparent" />
            <span>{t.status.loading}</span>
          </div>
        )}
      </div>

      {/* 5. Global Modal Dialogs & Script Windows */}
      <ModalDialog />
      <SoundRecorderModal />
      {scriptFormModal && (
        <ScriptFormModal
          formInfo={scriptFormModal.formInfo}
          onSubmit={(args) => {
            const code = scriptFormModal.scriptText;
            setScriptFormModal(null);
            void runScript(code, JSON.stringify(args));
          }}
          onCancel={() => setScriptFormModal(null)}
        />
      )}
      {scriptPauseState && (
        <ScriptPauseWindow
          pauseData={scriptPauseState.data}
          onResume={(btn) => {
            void resumeScript(btn);
          }}
          onAbort={() => {
            void abortScript();
          }}
        />
      )}
      </div>
    </div>
  );
}
