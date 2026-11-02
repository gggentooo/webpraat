/**
 * Phase 9 Acceptance Tests:
 * Interactive Scripting, Form/Pause Dialogs & Local Directory Mounting.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import praatWorkerApi from './workers/praatWorker';
import { en } from './config/locales/en';
import { ko } from './config/locales/ko';

describe('Phase 9: Interactive Scripting, Forms, Pause & VFS Mounting', () => {
  beforeAll(async () => {
    const ok = await praatWorkerApi.init();
    expect(ok).toBe(true);
  });

  describe('1. Form Parsing & Parameter Extraction', () => {
    it('parses form parameters from Praat script including types and defaults', async () => {
      const script = `
form 수동 전사 보조 — 순차 작업
    comment 폴더 경로를 비워두면 scripts/ 상위를 사용합니다.
    sentence Wav_folder
    sentence Textgrid_folder /default/path
    integer Start_from 1
    boolean Skip_done 1
    choice Action 2
    button Stop
    button Next
endform

writeInfoLine: "Form loaded"
`;
      const formInfo = await praatWorkerApi.parseScriptForm(script);
      expect(formInfo.hasForm).toBe(true);
      expect(formInfo.title).toBe('수동 전사 보조 — 순차 작업');
      expect(formInfo.parameters.length).toBeGreaterThanOrEqual(4);

      const pWav = formInfo.parameters.find((p) => p.varName === 'wav_folder');
      expect(pWav).toBeDefined();
      expect(pWav?.type).toBe('sentence');

      const pTg = formInfo.parameters.find((p) => p.varName === 'textgrid_folder');
      expect(pTg).toBeDefined();
      expect(pTg?.defaultValue).toBe('/default/path');

      const pStart = formInfo.parameters.find((p) => p.varName === 'start_from');
      expect(pStart).toBeDefined();
      expect(pStart?.type).toBe('integer');
      expect(pStart?.defaultValue).toBe('1');

      const pSkip = formInfo.parameters.find((p) => p.varName === 'skip_done');
      expect(pSkip).toBeDefined();
      expect(pSkip?.type).toBe('boolean');
      expect(pSkip?.defaultValue).toBe('1');
    });

    it('returns hasForm: false when script has no form', async () => {
      const script = `
writeInfoLine: "No form here"
`;
      const formInfo = await praatWorkerApi.parseScriptForm(script);
      expect(formInfo.hasForm).toBe(false);
      expect(formInfo.parameters.length).toBe(0);
    });
  });

  describe('2. Script Parameter Binding (executeScriptWithArgs)', () => {
    it('binds lowercase and uppercase form variables into the script interpreter', async () => {
      const script = `
form Test Form
    sentence Wav_folder
    integer Start_from 1
    boolean Skip_done 1
endform

writeInfoLine: "wav_folder: ", wav_folder$
appendInfoLine: "start_from: ", start_from
appendInfoLine: "skip_done: ", skip_done
`;
      const args = JSON.stringify({
        wav_folder: '/path/to/my/audio',
        start_from: '5',
        skip_done: '0',
      });

      const res = await praatWorkerApi.executeScriptWithArgs(script, args);
      expect(res.status).toBe('COMPLETED');
      expect(res.info).toContain('wav_folder: /path/to/my/audio');
      expect(res.info).toContain('start_from: 5');
      expect(res.info).toContain('skip_done: 0');
    });
  });

  describe('3. Virtual Filesystem (VFS) & Directory Operations', () => {
    it('writes files to VFS and creates Strings file list in Praat script', async () => {
      // Write dummy text files into VFS
      await praatWorkerApi.writeVfsFile('/workspace/test_vfs/file1.txt', 'hello');
      await praatWorkerApi.writeVfsFile('/workspace/test_vfs/file2.txt', 'world');

      await praatWorkerApi.setCurrentDirectory('/workspace/test_vfs');

      const script = `
Create Strings as file list: "fileList", "*.txt"
n = Get number of strings
writeInfoLine: "Found strings: ", n
name1$ = Get string: 1
appendInfoLine: "First file: ", name1$
Remove
`;
      const res = await praatWorkerApi.executeScriptWithArgs(script, '{}');
      if (res.status !== 'COMPLETED') {
        console.error('Test 4.1 script error:', res.error);
      }
      expect(res.status).toBe('COMPLETED');
      expect(res.info).toContain('Found strings: 2');
      expect(res.info).toContain('First file: file1.txt');
    });

    it('supports fileReadable() check for files in VFS', async () => {
      await praatWorkerApi.writeVfsFile('/workspace/check/exists.txt', 'content');

      const script = `
ok1 = fileReadable("/workspace/check/exists.txt")
ok2 = fileReadable("/workspace/check/nonexistent.txt")
writeInfoLine: "exists: ", ok1, ", nonexistent: ", ok2
`;
      const res = await praatWorkerApi.executeScriptWithArgs(script, '{}');
      if (res.status !== 'COMPLETED') {
        console.error('Test 4.1 script error:', res.error);
      }
      expect(res.status).toBe('COMPLETED');
      expect(res.info).toContain('exists: 1, nonexistent: 0');
    });
  });

  describe('4. Headless Sound & TextGrid File Recognizers and Actions', () => {
    it('recognizes and loads WAV file from VFS using Read from file:', async () => {
      // Create a sound and save it to VFS
      const samples = new Float64Array(1000);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin((2 * Math.PI * 440 * i) / 10000);
      }
      const soundId = await praatWorkerApi.createSound(samples, 1000, 1, 10000, 'source_sound');
      const wavBytes = await praatWorkerApi.exportSoundAsWav(soundId);
      await praatWorkerApi.destroyObject(soundId);

      await praatWorkerApi.writeVfsFile('/workspace/test_audio/audio.wav', wavBytes);

      const script = `
Read from file: "/workspace/test_audio/audio.wav"
sound_id = selected("Sound")
dur = Get total duration
writeInfoLine: "Loaded sound dur: ", fixed$(dur, 2)
Remove
`;
      const res = await praatWorkerApi.executeScriptWithArgs(script, '{}');
      if (res.status !== 'COMPLETED') {
        console.error('Test 4.1 script error:', res.error);
      }
      expect(res.status).toBe('COMPLETED');
      expect(res.info).toContain('Loaded sound dur: 0.10');
    });

    it('recognizes and inspects TextGrid intervals in script', async () => {
      const soundId = await praatWorkerApi.createSound(new Float64Array(1000), 1000, 1, 10000, 'base_sound');
      const tgId = await praatWorkerApi.soundToTextGrid(soundId, 'word phone', '');
      await praatWorkerApi.textgridInsertBoundary(tgId, 1, 0.05);
      await praatWorkerApi.textgridSetIntervalText(tgId, 1, 1, 'hello');
      const tgText = await praatWorkerApi.exportTextGridAsText(tgId);
      await praatWorkerApi.destroyObject(tgId);
      await praatWorkerApi.destroyObject(soundId);

      await praatWorkerApi.writeVfsFile('/workspace/test_tg/sample.TextGrid', tgText);

      const script = `
Read from file: "/workspace/test_tg/sample.TextGrid"
tg_id = selected("TextGrid")
nTiers = Get number of tiers
nInt = Get number of intervals: 1
lab$ = Get label of interval: 1, 1
writeInfoLine: "tiers: ", nTiers, ", intervals: ", nInt, ", label: ", lab$
Remove
`;
      const res = await praatWorkerApi.executeScriptWithArgs(script, '{}');
      if (res.status !== 'COMPLETED') {
        console.error('Test 4.1 script error:', res.error);
      }
      expect(res.status).toBe('COMPLETED');
      expect(res.info).toContain('tiers: 2, intervals: 2, label: hello');
    });
  });

  describe('5. Script Editor Action Dispatch ("Edit" / "View & Edit")', () => {
    it('dispatches editor open event when script calls Edit on Sound + TextGrid', async () => {
      const soundId = await praatWorkerApi.createSound(new Float64Array(500), 500, 1, 10000, 'edit_test_sound');
      const tgId = await praatWorkerApi.soundToTextGrid(soundId, 'tier1', '');

      const script = `
selectObject: ${soundId}, ${tgId}
Edit
writeInfoLine: "Editor invoked"
`;
      const res = await praatWorkerApi.executeScriptWithArgs(script, '{}');
      if (res.status !== 'COMPLETED') {
        console.error('Test 4.1 script error:', res.error);
      }
      expect(res.status).toBe('COMPLETED');

      const event = await praatWorkerApi.getLastEditorEvent();
      expect(event).not.toBeNull();
      expect(event?.action).toBe('open');
      expect(event?.editor).toBe('TextGridEditor');
      expect(event?.soundId).toBe(soundId);
      expect(event?.textGridId).toBe(tgId);

      await praatWorkerApi.destroyObject(tgId);
      await praatWorkerApi.destroyObject(soundId);
    });
  });

  describe('6. Non-Blocking Coroutine Pause & Resume Cycle', () => {
    it('pauses script execution at beginPause/endPause and resumes on button click', async () => {
      const script = `
writeInfoLine: "Starting step 1"
beginPause: "Interactive Step"
    comment: "Please inspect the audio"
    comment: "Press Next to proceed"
clicked = endPause: "Stop", "Next", 2

writeInfoLine: "Resumed! Button clicked: ", clicked
`;
      // Initial execution -> pauses
      const res1 = await praatWorkerApi.executeScriptWithArgs(script, '{}');
      expect(res1.status).toBe('PAUSED');
      expect(res1.pauseData).toBeDefined();
      expect(res1.pauseData?.title).toBe('Interactive Step');
      expect(res1.pauseData?.buttons).toEqual(['Stop', 'Next']);
      expect(res1.pauseData?.defaultButton).toBe(2);

      // Resume with button 2 ("Next")
      const res2 = await praatWorkerApi.resumeScript(2);
      expect(res2.status).toBe('COMPLETED');
      expect(res2.info).toContain('Resumed! Button clicked: 2');
    });

    it('allows script to be aborted cleanly when paused', async () => {
      const script = `
writeInfoLine: "Will pause"
beginPause: "Abort Test"
    comment: "Will abort here"
clicked = endPause: "Cancel", "Continue", 1
writeInfoLine: "Should never reach here"
`;
      const res1 = await praatWorkerApi.executeScriptWithArgs(script, '{}');
      expect(res1.status).toBe('PAUSED');

      const ok = await praatWorkerApi.abortScript();
      expect(ok).toBe(true);

      // Execute next script without hanging or corruption
      const res2 = await praatWorkerApi.executeScriptWithArgs('writeInfoLine: "Clean state"', '{}');
      expect(res2.status).toBe('COMPLETED');
      expect(res2.info).toContain('Clean state');
    });
  });

  describe('7. End-to-End Transcription Script Simulation (00_open_for_transcription.praat)', () => {
    it('runs the full batch transcription loop with pause, edit, and resume', async () => {
      // 1. Prepare synthetic wav and TextGrid in VFS
      const samples = new Float64Array(500);
      const sId = await praatWorkerApi.createSound(samples, 500, 1, 10000, 'item01');
      const wavData = await praatWorkerApi.exportSoundAsWav(sId);
      const tgId = await praatWorkerApi.soundToTextGrid(sId, 'sentence', '');
      const tgData = await praatWorkerApi.exportTextGridAsText(tgId);
      await praatWorkerApi.destroyObject(tgId);
      await praatWorkerApi.destroyObject(sId);

      const baseDir = '/workspace/transcription_e2e';
      await praatWorkerApi.writeVfsFile(`${baseDir}/item01.wav`, wavData);
      await praatWorkerApi.writeVfsFile(`${baseDir}/textgrids/item01.TextGrid`, tgData);
      await praatWorkerApi.setCurrentDirectory(baseDir);

      const script = `
form 수동 전사 보조 — 순차 작업
    sentence Wav_folder
    sentence Textgrid_folder
    integer Start_from 1
    boolean Skip_done 0
endform

if wav_folder$ = ""
    wav_folder$ = defaultDirectory$
endif
if textgrid_folder$ = ""
    textgrid_folder$ = defaultDirectory$ + "/textgrids"
endif

Create Strings as file list: "wavList", wav_folder$ + "/*.wav"
list_id = selected("Strings")
n_files = Get number of strings

writeInfoLine: "Found wav files: ", n_files

for f from 1 to n_files
    selectObject: list_id
    wav_name$ = Get string: f
    base_name$ = wav_name$ - ".wav"
    tg_path$ = textgrid_folder$ + "/" + base_name$ + ".TextGrid"
    wav_path$ = wav_folder$ + "/" + wav_name$

    Read from file: wav_path$
    sound_id = selected("Sound")

    Read from file: tg_path$
    tg_id = selected("TextGrid")

    selectObject: sound_id, tg_id
    Edit

    beginPause: "전사 작업"
        comment: "현재 파일: " + base_name$
    clicked = endPause: "Stop", "Next", 2

    selectObject: sound_id, tg_id
    Remove
endfor

selectObject: list_id
Remove

appendInfoLine: "Batch finished successfully"
`;
      // Execute with form arguments
      const args = JSON.stringify({
        wav_folder: baseDir,
        textgrid_folder: `${baseDir}/textgrids`,
        start_from: '1',
        skip_done: '0',
      });

      const res1 = await praatWorkerApi.executeScriptWithArgs(script, args);
      expect(res1.status).toBe('PAUSED');
      expect(res1.pauseData?.title).toBe('전사 작업');
      expect(res1.pauseData?.comments).toContain('현재 파일: item01');

      // Check that Edit dispatched TextGridEditor open event
      const editorEvent = await praatWorkerApi.getLastEditorEvent();
      expect(editorEvent).not.toBeNull();
      expect(editorEvent?.editor).toBe('TextGridEditor');

      // Simulate student clicking [Next] (button 2)
      const res2 = await praatWorkerApi.resumeScript(2);
      expect(res2.status).toBe('COMPLETED');
      expect(res2.info).toContain('Batch finished successfully');
    });
  });

  describe('8. Localization Key Parity', () => {
    it('verifies 100% key parity between English and Korean locale dictionaries', () => {
      function compareKeys(objEn: Record<string, any>, objKo: Record<string, any>, path = '') {
        const enKeys = Object.keys(objEn);
        const koKeys = Object.keys(objKo);

        for (const k of enKeys) {
          const currentPath = path ? `${path}.${k}` : k;
          expect(koKeys, `Missing key in Korean dictionary: ${currentPath}`).toContain(k);
          if (typeof objEn[k] === 'object' && objEn[k] !== null && !Array.isArray(objEn[k])) {
            compareKeys(objEn[k], objKo[k], currentPath);
          }
        }

        for (const k of koKeys) {
          const currentPath = path ? `${path}.${k}` : k;
          expect(enKeys, `Extraneous key in Korean dictionary: ${currentPath}`).toContain(k);
        }
      }

      compareKeys(en, ko);
    });
  });
});
