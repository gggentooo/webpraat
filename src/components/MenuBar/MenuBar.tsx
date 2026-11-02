import React, { useState, useRef, useEffect } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  objectsAtom,
  selectedIdsAtom,
  modalAtom,
  infoOutputAtom,
  singleSelectedSoundAtom,
  singleSelectedTextGridAtom,
  statusMessageAtom,
  isProcessingAtom,
  activeTabAtom,
  scriptTextAtom,
  scriptNameAtom,
  scriptRevisionAtom,
} from '../../store';
import { useI18n } from '../../hooks/useI18n';
import { getPraatWorker, loadAudioFile, exportSoundToWavBlob, downloadBlob } from '../../utils/audio';
import { clearWorkspaceFromOpfs, saveWorkspaceToOpfs } from '../../utils/persistence';

export const MenuBar: React.FC = () => {
  const { t, locale, setLocale } = useI18n();
  const [objects, setObjects] = useAtom(objectsAtom);
  const [, setSelectedIds] = useAtom(selectedIdsAtom);
  const [, setModal] = useAtom(modalAtom);
  const [, setInfoOutput] = useAtom(infoOutputAtom);
  const [, setActiveTab] = useAtom(activeTabAtom);
  const [scriptText, setScriptText] = useAtom(scriptTextAtom);
  const setScriptName = useSetAtom(scriptNameAtom);
  const setScriptRevision = useSetAtom(scriptRevisionAtom);
  const [statusMessage, setStatusMessage] = useAtom(statusMessageAtom);
  const isProcessing = useAtomValue(isProcessingAtom);
  const selectedSound = useAtomValue(singleSelectedSoundAtom);
  const selectedTextGrid = useAtomValue(singleSelectedTextGridAtom);

  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scriptFileInputRef = useRef<HTMLInputElement>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMenuClick = (menuName: string) => {
    setActiveMenu((prev) => (prev === menuName ? null : menuName));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const worker = getPraatWorker();
    setStatusMessage(t.status.loading);

    try {
      for (let i = 0; i < files.length; ++i) {
        const file = files[i];
        if (file.name.toLowerCase().endsWith('.textgrid')) {
          const content = await file.text();
          const baseName = file.name.replace(/\.textgrid$/i, '');
          const tgId = await worker.readTextGridFromText(content, baseName);
          const name = await worker.getObjectName(tgId);
          const className = await worker.getObjectClass(tgId);
          const newObj = {
            id: tgId,
            className,
            name: name || baseName,
            createdAt: Date.now(),
          };
          setObjects((prev) => [...prev, newObj]);
          setSelectedIds([tgId]);
          setStatusMessage(t.status.textGridLoaded);
        } else {
          const info = await loadAudioFile(worker, file);
          const newObj = {
            id: info.id,
            className: info.className,
            name: info.name,
            duration: info.duration,
            sampleRate: info.sampleRate,
            numChannels: info.numChannels,
            numSamples: info.numSamples,
            createdAt: Date.now(),
          };
          setObjects((prev) => [...prev, newObj]);
          setSelectedIds([info.id]);
          setStatusMessage(t.status.soundLoaded);
        }
      }
    } catch (err: any) {
      alert(`Error opening file: ${err?.message || err}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setStatusMessage(''), 3000);
    }
  };

  const handleSaveWav = async () => {
    if (!selectedSound) return;
    try {
      const worker = getPraatWorker();
      const blob = await exportSoundToWavBlob(worker, selectedSound.id);
      downloadBlob(blob, `${selectedSound.name}.wav`);
    } catch (err: any) {
      alert(`Error saving WAV file: ${err?.message || err}`);
    }
  };

  const handleSaveTextGrid = async () => {
    if (!selectedTextGrid) return;
    try {
      const worker = getPraatWorker();
      const text = await worker.exportTextGridAsText(selectedTextGrid.id);
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      downloadBlob(blob, `${selectedTextGrid.name}.TextGrid`);
    } catch (err: any) {
      alert(`Error saving TextGrid file: ${err?.message || err}`);
    }
  };

  const handleSaveWorkspace = async () => {
    try {
      const worker = getPraatWorker();
      await saveWorkspaceToOpfs(worker, objects, scriptText);
      setStatusMessage(t.status.workspaceSaved);
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (err) {
      console.error('Failed to save workspace:', err);
    }
  };

  const handleClearWorkspace = async () => {
    try {
      await clearWorkspaceFromOpfs();
      setStatusMessage(t.status.workspaceCleared);
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (err) {
      console.error('Failed to clear workspace:', err);
    }
  };

  const handleNewPraatScript = () => {
    setScriptText('');
    setScriptName(t.script.untitledScript);
    setScriptRevision((r) => r + 1);
    setActiveTab('script');
    setStatusMessage(t.script.newScriptCreated);
    setTimeout(() => setStatusMessage(''), 3000);
    setActiveMenu(null);
  };

  const handleScriptFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    try {
      const content = await file.text();
      setScriptText(content);
      setScriptName(file.name);
      setScriptRevision((r) => r + 1);
      setActiveTab('script');
      setStatusMessage(`${t.script.scriptLoaded}: ${file.name}`);
      setTimeout(() => {
        alert(`${t.script.scriptLoadSuccess}\n${file.name}`);
      }, 30);
    } catch (err: any) {
      const reason = err?.message || String(err);
      setStatusMessage(t.script.scriptLoadError);
      alert(`${t.script.scriptLoadError}: ${reason}`);
    } finally {
      if (scriptFileInputRef.current) scriptFileInputRef.current.value = '';
      setTimeout(() => setStatusMessage(''), 3000);
    }
  };

  return (
    <div
      ref={menuBarRef}
      className="flex h-9 w-full items-center justify-between border-b border-slate-300 bg-slate-200 px-2 text-xs font-medium text-slate-800 select-none shadow-xs"
    >
      {/* Hidden File Input for "Read from file..." */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,.wav,.mp3,.flac,.ogg,.aiff,.TextGrid,.textgrid"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Hidden File Input for "Open Praat script..." */}
      <input
        ref={scriptFileInputRef}
        type="file"
        accept=".praat,.psc,.script,.txt,text/plain"
        className="hidden"
        onChange={handleScriptFileChange}
      />

      {/* Left Menu Items */}
      <div className="flex items-center space-x-0.5 shrink-0">
        <span className="mr-2 font-bold tracking-tight text-slate-900 px-1.5 py-0.5 bg-slate-300 rounded text-[11px]">
          WebPraat
        </span>

        {/* 1. Praat Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => handleMenuClick('praat')}
            className={`rounded px-2.5 py-1 whitespace-nowrap hover:bg-slate-300 ${
              activeMenu === 'praat' ? 'bg-slate-300 text-slate-900' : ''
            }`}
          >
            {t.menu.praat}
          </button>
          {activeMenu === 'praat' && (
            <div className="absolute left-0 top-full z-40 mt-0.5 min-w-56 w-max max-w-sm rounded border border-slate-300 bg-white py-1 shadow-lg text-slate-700">
              <button
                type="button"
                className="w-full px-3 py-1 text-left whitespace-nowrap hover:bg-blue-600 hover:text-white"
                onClick={handleNewPraatScript}
              >
                {t.commands.newPraatScript}
              </button>
              <button
                type="button"
                className="w-full px-3 py-1 text-left whitespace-nowrap hover:bg-blue-600 hover:text-white"
                onClick={() => {
                  setActiveMenu(null);
                  scriptFileInputRef.current?.click();
                }}
              >
                {t.commands.openPraatScript}
              </button>
              <div className="my-1 border-t border-slate-200" />
              <button
                type="button"
                className="w-full px-3 py-1 text-left whitespace-nowrap hover:bg-blue-600 hover:text-white"
                onClick={() => {
                  setActiveMenu(null);
                  void handleSaveWorkspace();
                }}
              >
                {t.commands.saveWorkspace}
              </button>
              <button
                type="button"
                className="w-full px-3 py-1 text-left whitespace-nowrap hover:bg-blue-600 hover:text-white"
                onClick={() => {
                  setActiveMenu(null);
                  void handleClearWorkspace();
                }}
              >
                {t.commands.clearWorkspace}
              </button>
              <div className="my-1 border-t border-slate-200" />
              <button
                type="button"
                className="w-full px-3 py-1 text-left whitespace-nowrap hover:bg-blue-600 hover:text-white"
                onClick={() => {
                  setInfoOutput('');
                  setActiveMenu(null);
                }}
              >
                {t.commands.clearInfo}
              </button>
              <div className="my-1 border-t border-slate-200" />
              <a
                href="https://github.com/gggentooo/webpraat"
                target="_blank"
                rel="noreferrer"
                className="block w-full px-3 py-1 text-left whitespace-nowrap hover:bg-blue-600 hover:text-white"
                onClick={() => setActiveMenu(null)}
              >
                {t.commands.sourceGithub}
              </a>
            </div>
          )}
        </div>

        {/* 2. New Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => handleMenuClick('new')}
            className={`rounded px-2.5 py-1 whitespace-nowrap hover:bg-slate-300 ${
              activeMenu === 'new' ? 'bg-slate-300 text-slate-900' : ''
            }`}
          >
            {t.menu.new}
          </button>
          {activeMenu === 'new' && (
            <div className="absolute left-0 top-full z-40 mt-0.5 min-w-64 w-max max-w-sm rounded border border-slate-300 bg-white py-1 shadow-lg text-slate-700">
              <button
                type="button"
                className="w-full px-3 py-1 text-left whitespace-nowrap hover:bg-blue-600 hover:text-white"
                onClick={() => {
                  setModal({ type: 'soundRecorder', initialValues: { channels: 1 } });
                  setActiveMenu(null);
                }}
              >
                {t.commands.recordMonoSound}
              </button>
              <button
                type="button"
                className="w-full px-3 py-1 text-left whitespace-nowrap hover:bg-blue-600 hover:text-white"
                onClick={() => {
                  setModal({ type: 'soundRecorder', initialValues: { channels: 2 } });
                  setActiveMenu(null);
                }}
              >
                {t.commands.recordStereoSound}
              </button>
              <div className="my-1 border-t border-slate-200" />
              <button
                type="button"
                className="w-full px-3 py-1 text-left whitespace-nowrap hover:bg-blue-600 hover:text-white"
                onClick={() => {
                  setModal({ type: 'pureTone' });
                  setActiveMenu(null);
                }}
              >
                {t.commands.createSoundAsPureTone}
              </button>
              <button
                type="button"
                className="w-full px-3 py-1 text-left whitespace-nowrap hover:bg-blue-600 hover:text-white"
                onClick={() => {
                  setModal({ type: 'createKlattGridFromVowel' });
                  setActiveMenu(null);
                }}
              >
                {t.commands.createKlattGridFromVowel}
              </button>
              <div className="my-1 border-t border-slate-200" />
              <button
                type="button"
                className="w-full px-3 py-1 text-left whitespace-nowrap hover:bg-blue-600 hover:text-white"
                onClick={() => {
                  setModal({ type: 'createSpeaker' });
                  setActiveMenu(null);
                }}
              >
                {t.commands.createSpeaker}
              </button>
              <button
                type="button"
                className="w-full px-3 py-1 text-left whitespace-nowrap hover:bg-blue-600 hover:text-white"
                onClick={() => {
                  setModal({ type: 'createArtword' });
                  setActiveMenu(null);
                }}
              >
                {t.commands.createArtword}
              </button>
            </div>
          )}
        </div>

        {/* 3. Open Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => handleMenuClick('open')}
            className={`rounded px-2.5 py-1 whitespace-nowrap hover:bg-slate-300 ${
              activeMenu === 'open' ? 'bg-slate-300 text-slate-900' : ''
            }`}
          >
            {t.menu.open}
          </button>
          {activeMenu === 'open' && (
            <div className="absolute left-0 top-full z-40 mt-0.5 min-w-52 w-max max-w-sm rounded border border-slate-300 bg-white py-1 shadow-lg text-slate-700">
              <button
                type="button"
                className="w-full px-3 py-1 text-left whitespace-nowrap hover:bg-blue-600 hover:text-white"
                onClick={() => {
                  setActiveMenu(null);
                  fileInputRef.current?.click();
                }}
              >
                {t.commands.readFromFile}
              </button>
            </div>
          )}
        </div>

        {/* 4. Save Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => handleMenuClick('save')}
            className={`rounded px-2.5 py-1 whitespace-nowrap hover:bg-slate-300 ${
              activeMenu === 'save' ? 'bg-slate-300 text-slate-900' : ''
            }`}
          >
            {t.menu.save}
          </button>
          {activeMenu === 'save' && (
            <div className="absolute left-0 top-full z-40 mt-0.5 min-w-56 w-max max-w-sm rounded border border-slate-300 bg-white py-1 shadow-lg text-slate-700">
              <button
                type="button"
                disabled={!selectedSound}
                className={`w-full px-3 py-1 text-left whitespace-nowrap ${
                  selectedSound
                    ? 'hover:bg-blue-600 hover:text-white'
                    : 'text-slate-400 cursor-not-allowed'
                }`}
                onClick={() => {
                  setActiveMenu(null);
                  void handleSaveWav();
                }}
              >
                {t.commands.saveAsWavFile}
              </button>
              <button
                type="button"
                disabled={!selectedTextGrid}
                className={`w-full px-3 py-1 text-left whitespace-nowrap ${
                  selectedTextGrid
                    ? 'hover:bg-blue-600 hover:text-white'
                    : 'text-slate-400 cursor-not-allowed'
                }`}
                onClick={() => {
                  setActiveMenu(null);
                  void handleSaveTextGrid();
                }}
              >
                {t.commands.saveAsTextGridFile}
              </button>
            </div>
          )}
        </div>

        {/* 5. Help Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => handleMenuClick('help')}
            className={`rounded px-2.5 py-1 whitespace-nowrap hover:bg-slate-300 ${
              activeMenu === 'help' ? 'bg-slate-300 text-slate-900' : ''
            }`}
          >
            {t.menu.help}
          </button>
          {activeMenu === 'help' && (
            <div className="absolute left-0 top-full z-40 mt-0.5 min-w-48 w-max max-w-sm rounded border border-slate-300 bg-white py-1 shadow-lg text-slate-700">
              <a
                href="https://www.fon.hum.uva.nl/praat/manual/Intro.html"
                target="_blank"
                rel="noreferrer"
                className="block w-full px-3 py-1 text-left whitespace-nowrap hover:bg-blue-600 hover:text-white"
                onClick={() => setActiveMenu(null)}
              >
                {t.commands.praatManual}
              </a>
              <button
                type="button"
                className="w-full px-3 py-1 text-left whitespace-nowrap hover:bg-blue-600 hover:text-white"
                onClick={() => {
                  setModal({ type: 'about' });
                  setActiveMenu(null);
                }}
              >
                {t.commands.aboutWebPraat}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Controls: Language Selector & Status */}
      <div className="flex items-center space-x-3 text-xs shrink-0">
        {isProcessing && (
          <span className="flex items-center space-x-1 text-blue-700">
            <span className="inline-block h-2 w-2 animate-ping rounded-full bg-blue-600" />
            <span>{t.status.loading}</span>
          </span>
        )}
        {!isProcessing && statusMessage && (
          <span className="text-slate-600 font-normal">{statusMessage}</span>
        )}

        <div className="flex items-center rounded border border-slate-300 bg-white p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => setLocale('en')}
            className={`rounded px-1.5 py-0.5 whitespace-nowrap ${
              locale === 'en'
                ? 'bg-blue-600 text-white font-semibold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLocale('ko')}
            className={`rounded px-1.5 py-0.5 whitespace-nowrap ${
              locale === 'ko'
                ? 'bg-blue-600 text-white font-semibold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            한국어
          </button>
        </div>
      </div>
    </div>
  );
};
