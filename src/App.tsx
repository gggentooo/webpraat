import { useAtom, useAtomValue } from 'jotai';
import {
  activeTabAtom,
  editorSoundIdAtom,
  editorTextGridIdAtom,
  objectsAtom,
  statusMessageAtom,
  isProcessingAtom,
} from './store';
import { useI18n } from './hooks/useI18n';
import { MenuBar } from './components/MenuBar/MenuBar';
import { ObjectsPanel } from './components/ObjectsPanel/ObjectsPanel';
import { InfoWindow } from './components/InfoWindow/InfoWindow';
import { ModalDialog } from './components/shared/ModalDialog';
import { SoundEditor } from './components/SoundEditor/SoundEditor';
import { TextGridEditor } from './components/TextGridEditor/TextGridEditor';

export default function App() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useAtom(activeTabAtom);
  const [editorSoundId, setEditorSoundId] = useAtom(editorSoundIdAtom);
  const [editorTextGridId, setEditorTextGridId] = useAtom(editorTextGridIdAtom);
  const objects = useAtomValue(objectsAtom);
  const statusMessage = useAtomValue(statusMessageAtom);
  const isProcessing = useAtomValue(isProcessingAtom);

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
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-200 font-sans text-slate-800">
      {/* 1. Top MenuBar */}
      <header className="h-9 shrink-0">
        <MenuBar />
      </header>

      {/* 2. Middle Workspace Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Pane: Praat Objects Window (List + Dynamic Actions) */}
        <aside className="w-[500px] shrink-0 border-r border-slate-300 bg-white flex flex-col shadow-xs">
          <ObjectsPanel />
        </aside>

        {/* Right Pane: Workspace / Editor / Praat Picture */}
        <main className="flex flex-1 flex-col overflow-hidden bg-slate-100">
          {/* Editor Header / Tab bar */}
          <div className="flex h-7 shrink-0 items-center border-b border-slate-300 bg-slate-200 px-2 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('objects')}
              className={`flex items-center px-3 py-1 rounded-t border-t border-x ${
                activeTab === 'objects' || activeTab === 'picture'
                  ? 'border-slate-300 bg-white text-slate-800 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-800'
              }`}
            >
              <span>{t.app.pictureTitle}</span>
            </button>

            {editorSound && (
              <div
                className={`ml-1 flex items-center rounded-t border-t border-x px-3 py-1 ${
                  activeTab === 'soundEditor'
                    ? 'border-slate-300 bg-white text-blue-700 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-800'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveTab('soundEditor')}
                  className="mr-2"
                >
                  {editorSound.name} ({t.editor.soundEditorTitle})
                </button>
                <button
                  type="button"
                  onClick={handleCloseEditor}
                  title={t.editor.closeEditor}
                  className="text-slate-400 hover:text-red-600 rounded px-1"
                >
                  ✕
                </button>
              </div>
            )}

            {editorTextGrid && (
              <div
                className={`ml-1 flex items-center rounded-t border-t border-x px-3 py-1 ${
                  activeTab === 'textGridEditor'
                    ? 'border-slate-300 bg-white text-blue-700 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-800'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveTab('textGridEditor')}
                  className="mr-2"
                >
                  {editorTextGrid.name} ({t.editor.textGridEditorTitle})
                </button>
                <button
                  type="button"
                  onClick={handleCloseTextGridEditor}
                  title={t.editor.closeEditor}
                  className="text-slate-400 hover:text-red-600 rounded px-1"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Tab Content Body */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'soundEditor' && editorSound ? (
              <SoundEditor sound={editorSound} onClose={handleCloseEditor} />
            ) : activeTab === 'textGridEditor' && editorTextGrid ? (
              <TextGridEditor
                sound={editorSound}
                textGrid={editorTextGrid}
                onClose={handleCloseTextGridEditor}
              />
            ) : (
              /* Default Praat Picture Drawing Area */
              <div className="h-full w-full p-4 overflow-auto">
                <div className="flex h-full flex-col rounded border border-slate-300 bg-white shadow-xs">
                  <div className="flex h-7 items-center justify-between border-b border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600">
                    <span>{t.app.pictureTitle}</span>
                    <span className="text-[11px] font-normal text-slate-400">
                      [0..12] × [0..12]
                    </span>
                  </div>
                  <div className="flex flex-1 items-center justify-center p-6">
                    <div className="relative aspect-square h-full max-h-[460px] rounded border border-slate-300 bg-white p-4 shadow-inner flex flex-col justify-between">
                      <div className="text-[10px] text-slate-400 font-mono">12.0</div>
                      <div className="flex flex-col items-center justify-center text-center">
                        <span className="font-semibold text-slate-500 text-sm">
                          {t.app.pictureTitle}
                        </span>
                        <span className="mt-1 text-xs text-slate-400">
                          {t.app.subtitle}
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span>0.0</span>
                        <span>12.0</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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

      {/* 5. Global Modal Dialog */}
      <ModalDialog />
    </div>
  );
}
