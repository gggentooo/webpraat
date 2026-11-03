/**
 * Hook for executing Praat scripts, handling forms, pauses, VFS mounting,
 * and dispatching editor events across WebPraat components.
 */

import { useAtom, useSetAtom, useAtomValue } from 'jotai';
import {
  isScriptRunningAtom,
  statusMessageAtom,
  infoOutputAtom,
  objectsAtom,
  selectedIdsAtom,
  editorSoundIdAtom,
  editorTextGridIdAtom,
  activeTabAtom,
  mountedDirectoryAtom,
  scriptFormModalAtom,
  scriptPauseStateAtom,
  pictureCommandsAtom,
  pictureViewportAtom,
  picturePenAtom,
  scriptExportModalAtom,
  activeEditorSaveCallbackAtom,
} from '../store';
import { useI18n } from './useI18n';
import { getPraatWorker, downloadBlob } from '../utils/audio';
import { mountLocalFolder, writeHostFile } from '../utils/vfs';
import { parsePraatPictureScriptCommands } from '../utils/pictureRenderer';
import type { ScriptExecutionResult } from '../types/wasm';

export function useScriptExecution() {
  const { t } = useI18n();
  const [isScriptRunning, setIsScriptRunning] = useAtom(isScriptRunningAtom);
  const setStatusMessage = useSetAtom(statusMessageAtom);
  const setInfoOutput = useSetAtom(infoOutputAtom);
  const setObjects = useSetAtom(objectsAtom);
  const setSelectedIds = useSetAtom(selectedIdsAtom);
  const setEditorSoundId = useSetAtom(editorSoundIdAtom);
  const setEditorTextGridId = useSetAtom(editorTextGridIdAtom);
  const setActiveTab = useSetAtom(activeTabAtom);
  const [mountedDir, setMountedDir] = useAtom(mountedDirectoryAtom);
  const setScriptFormModal = useSetAtom(scriptFormModalAtom);
  const [scriptPauseState, setScriptPauseState] = useAtom(scriptPauseStateAtom);
  const setPictureCommands = useSetAtom(pictureCommandsAtom);
  const [pictureViewport, setPictureViewport] = useAtom(pictureViewportAtom);
  const [picturePen, setPicturePen] = useAtom(picturePenAtom);
  const setScriptExportModal = useSetAtom(scriptExportModalAtom);
  const activeEditorSaveCallback = useAtomValue(activeEditorSaveCallbackAtom);

  const syncObjects = async (worker: any) => {
    try {
      const currentObjects = await worker.getObjectsJson();
      if (currentObjects) {
        setObjects((prev) => {
          const existingMap = new Map(prev.map((o) => [o.id, o]));
          return currentObjects.map((obj: any) => {
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
        const activeIdSet = new Set(currentObjects.map((o: any) => o.id));
        setSelectedIds((prev) => prev.filter((id) => activeIdSet.has(id)));
      }
    } catch (err) {
      console.warn('Failed to sync Praat objects:', err);
    }
  };

  const syncModifiedFiles = async (worker: any) => {
    try {
      const baseDir = mountedDir ? mountedDir.path : '/workspace';
      const modifiedFiles = await worker.getModifiedVfsFiles(baseDir);
      if (!modifiedFiles || modifiedFiles.length === 0) return;

      if (mountedDir?.handle && !mountedDir.readOnly) {
        let savedCount = 0;
        for (const file of modifiedFiles) {
          const ok = await writeHostFile(mountedDir.handle, file.path, file.data);
          if (ok) savedCount++;
        }
        await worker.resetVfsSnapshot(baseDir);

        if (savedCount === 1) {
          const msg = t.script.fileSavedToDisk.replace('{file}', modifiedFiles[0].path);
          setStatusMessage(msg);
        } else if (savedCount > 1) {
          const msg = t.script.filesSavedToDisk.replace('{count}', String(savedCount));
          setStatusMessage(msg);
        }
      } else {
        if (modifiedFiles.length === 1) {
          const single = modifiedFiles[0];
          const blob = new Blob([single.data as BlobPart], { type: 'application/octet-stream' });
          const fileName = single.path.split('/').pop() || 'output';
          downloadBlob(blob, fileName);
          setStatusMessage(t.script.fileDownloaded.replace('{file}', fileName));
          await worker.resetVfsSnapshot(baseDir);
        } else {
          setScriptExportModal(modifiedFiles);
          setStatusMessage(
            t.script.filesReadyForDownload.replace('{count}', String(modifiedFiles.length))
          );
        }
      }
    } catch (err) {
      console.warn('Failed to sync modified VFS files:', err);
    }
  };

  const handleExecutionResult = async (
    res: ScriptExecutionResult,
    resetsInfo: boolean,
    worker: any
  ) => {
    // 1. Process text info output
    const output = res.info || '';
    const hadScriptError = res.status === 'ERROR' || Boolean(res.error);

    if (hadScriptError) {
      const errMsg = res.error || 'Script execution error';
      setInfoOutput((prev) => (prev ? `${prev}\n${errMsg}` : errMsg));
      setStatusMessage(t.script.scriptError);
    } else if (resetsInfo) {
      setInfoOutput(output);
    } else if (output) {
      setInfoOutput((prev) => (prev ? `${prev}\n${output}` : output));
    }

    // 2. Synchronize objects list with WASM
    await syncObjects(worker);

    // 3. Check for Editor Open Event dispatched by script
    try {
      const editorEvent = await worker.getLastEditorEvent();
      if (editorEvent && editorEvent.action === 'open') {
        if (editorEvent.editor === 'TextGridEditor' && editorEvent.textGridId) {
          if (editorEvent.soundId) {
            setEditorSoundId(editorEvent.soundId);
          }
          setEditorTextGridId(editorEvent.textGridId);
          setActiveTab('textGridEditor');
        } else if (editorEvent.editor === 'SoundEditor' && editorEvent.soundId) {
          setEditorSoundId(editorEvent.soundId);
          setActiveTab('soundEditor');
        }
      }
    } catch (err) {
      console.warn('Failed to check editor open event:', err);
    }

    // 4. Synchronize modified/created VFS files with host disk or browser export fallback
    await syncModifiedFiles(worker);

    // 5. Update status & pause state
    if (res.status === 'PAUSED' && res.pauseData) {
      setScriptPauseState({ data: res.pauseData, scriptText: '' });
      setStatusMessage(t.script.scriptPaused);
    } else if (res.status === 'COMPLETED') {
      setScriptPauseState(null);
      setStatusMessage(t.script.scriptCompleted);
      setTimeout(() => setStatusMessage(''), 3000);
    } else {
      setScriptPauseState(null);
    }
  };

  const runScript = async (
    codeToRun: string,
    argsJson?: string
  ): Promise<void> => {
    if (isScriptRunning) return;
    setIsScriptRunning(true);
    setStatusMessage(t.script.running);

    const worker = getPraatWorker();

    try {
      // 1. Picture command parsing
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

      if (!hasRemainingExecutable) {
        setStatusMessage(t.script.scriptCompleted);
        setIsScriptRunning(false);
        return;
      }

      const resetsInfo = /(?:^|\n)\s*(?:clearinfo|writeInfo(?:Line)?\b)/im.test(codeToRun);

      // 2. If argsJson is not explicitly provided, check if script defines a form
      if (argsJson === undefined) {
        const formInfo = await worker.parseScriptForm(parsedPic.remainingDspScript);
        if (formInfo && formInfo.hasForm && formInfo.parameters.length > 0) {
          setIsScriptRunning(false);
          setScriptFormModal({
            formInfo,
            scriptText: parsedPic.remainingDspScript,
          });
          return;
        }
      }

      // 3. Execute script with arguments
      const res = await worker.executeScriptWithArgs(
        parsedPic.remainingDspScript,
        argsJson || '{}'
      );
      await handleExecutionResult(res, resetsInfo, worker);
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      setInfoOutput((prev) => (prev ? `${prev}\n${errMsg}` : errMsg));
      setStatusMessage(t.script.scriptError);
      setScriptPauseState(null);
    } finally {
      setIsScriptRunning(false);
    }
  };

  const resumeScript = async (clickedButton: number): Promise<void> => {
    const worker = getPraatWorker();
    setIsScriptRunning(true);
    setStatusMessage(t.script.running);

    // Phase 10: Auto-save active editor changes before script resumes and removes objects
    if (activeEditorSaveCallback) {
      try {
        await activeEditorSaveCallback();
        setStatusMessage(t.script.autoSaveStep);
      } catch (err) {
        console.warn('Auto-save step failed before resuming script:', err);
      }
    }

    try {
      const res = await worker.resumeScript(clickedButton);
      await handleExecutionResult(res, false, worker);
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      setInfoOutput((prev) => (prev ? `${prev}\n${errMsg}` : errMsg));
      setStatusMessage(t.script.scriptError);
      setScriptPauseState(null);
    } finally {
      setIsScriptRunning(false);
    }
  };

  const abortScript = async (): Promise<void> => {
    const worker = getPraatWorker();
    try {
      await worker.abortScript();
      await syncObjects(worker);
    } catch (err) {
      console.warn('Failed to abort script:', err);
    } finally {
      setScriptPauseState(null);
      setIsScriptRunning(false);
      setStatusMessage(t.script.scriptAborted);
    }
  };

  const mountFolder = async (): Promise<void> => {
    const worker = getPraatWorker();
    try {
      const result = await mountLocalFolder(worker);
      if (result) {
        setMountedDir(result);
        setStatusMessage(`${t.status.folderMounted}: ${result.name}`);
      }
    } catch (err: any) {
      console.error('Folder mount failed:', err);
      alert(`Folder mount failed: ${err?.message || err}`);
    }
  };

  return {
    runScript,
    resumeScript,
    abortScript,
    mountFolder,
    isScriptRunning,
    scriptPauseState,
    mountedDir,
  };
}
