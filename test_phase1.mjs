// test_phase1.mjs - Phase 1 Acceptance Test for WebPraat
import createPraatModule from './public/praatlib.js';

async function runTest() {
    console.log('Loading praatlib WASM module...');
    const Module = await createPraatModule();
    console.log('WASM module loaded successfully.');

    // Wrap bridge functions
    const praat_bridge_init = Module.cwrap('praat_bridge_init', 'number', []);
    const praat_bridge_create_sound = Module.cwrap('praat_bridge_create_sound', 'number', ['number', 'number', 'number', 'number', 'string']);
    const praat_bridge_destroy_object = Module.cwrap('praat_bridge_destroy_object', null, ['number']);
    const praat_bridge_get_object_count = Module.cwrap('praat_bridge_get_object_count', 'number', []);
    const praat_bridge_get_object_name = Module.cwrap('praat_bridge_get_object_name', 'string', ['number']);
    const praat_bridge_get_object_class = Module.cwrap('praat_bridge_get_object_class', 'string', ['number']);
    const praat_bridge_sound_get_duration = Module.cwrap('praat_bridge_sound_get_duration', 'number', ['number']);
    const praat_bridge_sound_get_sample_rate = Module.cwrap('praat_bridge_sound_get_sample_rate', 'number', ['number']);
    const praat_bridge_sound_get_num_samples = Module.cwrap('praat_bridge_sound_get_num_samples', 'number', ['number']);
    const praat_bridge_sound_get_num_channels = Module.cwrap('praat_bridge_sound_get_num_channels', 'number', ['number']);
    const praat_bridge_sound_to_pitch = Module.cwrap('praat_bridge_sound_to_pitch', 'number', ['number', 'number', 'number', 'number']);
    const praat_bridge_sound_to_formant = Module.cwrap('praat_bridge_sound_to_formant', 'number', ['number', 'number', 'number', 'number', 'number']);
    const praat_bridge_sound_to_spectrogram = Module.cwrap('praat_bridge_sound_to_spectrogram', 'number', ['number', 'number', 'number', 'number', 'number']);
    const praat_bridge_pitch_get_mean = Module.cwrap('praat_bridge_pitch_get_mean', 'number', ['number', 'number', 'number']);
    const praat_bridge_pitch_get_value_at_time = Module.cwrap('praat_bridge_pitch_get_value_at_time', 'number', ['number', 'number']);

    // 1. Initialize Praat bridge
    console.log('1. Initializing Praat bridge...');
    const initRes = praat_bridge_init();
    if (initRes !== 1) {
        throw new Error('praat_bridge_init failed');
    }
    console.log('   Initialized successfully.');

    // 2. Synthesize a 440 Hz sine wave tone (1 second, 44100 Hz sample rate)
    const fs = 44100;
    const duration = 1.0;
    const n = Math.floor(fs * duration);
    const targetF0 = 440.0;
    const samples = new Float64Array(n);

    for (let i = 0; i < n; ++i) {
        samples[i] = 0.8 * Math.sin(2 * Math.PI * targetF0 * (i / fs));
    }

    // Allocate on WASM heap
    const bytes = n * 8;
    const ptr = Module._malloc(bytes);
    Module.HEAPF64.set(samples, ptr >> 3);

    console.log('2. Creating Sound object from buffer...');
    const soundId = praat_bridge_create_sound(ptr, n, 1, fs, 'tone440');
    Module._free(ptr);

    if (soundId <= 0) {
        throw new Error(`Failed to create Sound object, returned id: ${soundId}`);
    }
    console.log(`   Sound object created with ID: ${soundId}`);

    // Verify Sound metadata
    const name = praat_bridge_get_object_name(soundId);
    const className = praat_bridge_get_object_class(soundId);
    const dur = praat_bridge_sound_get_duration(soundId);
    const sRate = praat_bridge_sound_get_sample_rate(soundId);
    const numSamples = praat_bridge_sound_get_num_samples(soundId);
    const numChannels = praat_bridge_sound_get_num_channels(soundId);

    console.log(`   Name: ${name}, Class: ${className}, Duration: ${dur}s, SampleRate: ${sRate}Hz, Samples: ${numSamples}, Channels: ${numChannels}`);

    if (name !== 'tone440') throw new Error(`Expected name 'tone440', got '${name}'`);
    if (className !== 'Sound') throw new Error(`Expected class 'Sound', got '${className}'`);
    if (Math.abs(dur - 1.0) > 1e-4) throw new Error(`Expected duration 1.0, got ${dur}`);
    if (sRate !== 44100) throw new Error(`Expected sample rate 44100, got ${sRate}`);
    if (numSamples !== 44100) throw new Error(`Expected 44100 samples, got ${numSamples}`);
    if (numChannels !== 1) throw new Error(`Expected 1 channel, got ${numChannels}`);

    // 3. Sound: To Pitch (autocorrelation)
    console.log('3. Running Pitch analysis (Sound_to_Pitch)...');
    const pitchId = praat_bridge_sound_to_pitch(soundId, 0.0, 75.0, 600.0);
    if (pitchId <= 0) {
        throw new Error(`Failed to create Pitch object, returned id: ${pitchId}`);
    }
    const pitchName = praat_bridge_get_object_name(pitchId);
    const pitchClass = praat_bridge_get_object_class(pitchId);
    console.log(`   Pitch object created with ID: ${pitchId}, Name: ${pitchName}, Class: ${pitchClass}`);

    const meanF0 = praat_bridge_pitch_get_mean(pitchId, 0.0, 1.0);
    const valAtMid = praat_bridge_pitch_get_value_at_time(pitchId, 0.5);
    console.log(`   Pitch mean F0: ${meanF0.toFixed(2)} Hz (target: 440 Hz)`);
    console.log(`   Pitch value at t=0.5s: ${valAtMid.toFixed(2)} Hz`);

    if (Math.abs(meanF0 - 440.0) > 2.0) {
        throw new Error(`Pitch mean ${meanF0} is not within 2 Hz of target 440.0 Hz!`);
    }

    // 4. Sound: To Formant (burg)
    console.log('4. Running Formant analysis (Sound_to_Formant_burg)...');
    const formantId = praat_bridge_sound_to_formant(soundId, 0.0, 5, 5500.0, 0.025);
    if (formantId <= 0) {
        throw new Error(`Failed to create Formant object, returned id: ${formantId}`);
    }
    const formantName = praat_bridge_get_object_name(formantId);
    const formantClass = praat_bridge_get_object_class(formantId);
    console.log(`   Formant object created with ID: ${formantId}, Name: ${formantName}, Class: ${formantClass}`);

    // 5. Sound: To Spectrogram
    console.log('5. Running Spectrogram analysis (Sound_to_Spectrogram)...');
    const spectroId = praat_bridge_sound_to_spectrogram(soundId, 0.005, 5000.0, 0.002, 0);
    if (spectroId <= 0) {
        throw new Error(`Failed to create Spectrogram object, returned id: ${spectroId}`);
    }
    const spectroName = praat_bridge_get_object_name(spectroId);
    const spectroClass = praat_bridge_get_object_class(spectroId);
    console.log(`   Spectrogram object created with ID: ${spectroId}, Name: ${spectroName}, Class: ${spectroClass}`);

    const totalCount = praat_bridge_get_object_count();
    console.log(`   Total active objects in table: ${totalCount}`);
    if (totalCount !== 4) {
        throw new Error(`Expected 4 objects in table, got ${totalCount}`);
    }

    // 6. Cleanup objects
    console.log('6. Destroying objects...');
    praat_bridge_destroy_object(soundId);
    praat_bridge_destroy_object(pitchId);
    praat_bridge_destroy_object(formantId);
    praat_bridge_destroy_object(spectroId);

    const remainingCount = praat_bridge_get_object_count();
    console.log(`   Remaining objects in table: ${remainingCount}`);
    if (remainingCount !== 0) {
        throw new Error(`Expected 0 objects after destruction, got ${remainingCount}`);
    }

    console.log('\n========================================');
    console.log('🎉 ALL PHASE 1 ACCEPTANCE TESTS PASSED!');
    console.log('========================================\n');
}

runTest().catch((err) => {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
});
