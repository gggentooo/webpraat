#include "praat_bridge.h"

#include <unordered_map>
#include <string>

// Praat core headers
#include "praat.h"
#include "praatP.h"
#include "praat_script.h"
#include "Sound.h"
#include "Pitch.h"
#include "Formant.h"
#include "Spectrogram.h"
#include "Sound_to_Pitch.h"
#include "Sound_to_Formant.h"
#include "Sound_and_Spectrogram.h"

// Object table store
static std::unordered_map<int, autoThing> g_objectTable;
static int g_nextId = 1;

extern "C" {

int praat_bridge_init(void) {
    try {
        static bool s_initialized = false;
        if (s_initialized) return 1;

        praatlib_init();
        Thing_recognizeClassesByName(
            classSound,
            classPitch,
            classFormant,
            classSpectrogram
        );

        s_initialized = true;
        return 1;
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

int praat_bridge_create_sound(const double* samples, int n, int channels, double fs, const char* name) {
    if (!samples || n <= 0 || channels <= 0 || fs <= 0.0) return 0;

    try {
        const double duration = (double)n / fs;
        autoSound sound = Sound_create(channels, 0.0, duration, n, 1.0 / fs, 0.5 / fs);

        if (name && name[0] != '\0') {
            Thing_setName(sound.get(), Melder_peek8to32_u(name));
        } else {
            Thing_setName(sound.get(), U"sound");
        }

        // Copy samples into sound->z (Praat channels and samples are 1-based)
        for (int ch = 1; ch <= channels; ++ch) {
            const double* src = samples + (ch - 1) * n;
            for (int i = 1; i <= n; ++i) {
                sound->z[ch][i] = src[i - 1];
            }
        }

        int id = g_nextId++;
        g_objectTable[id] = sound.move();
        return id;
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

void praat_bridge_destroy_object(int id) {
    auto it = g_objectTable.find(id);
    if (it != g_objectTable.end()) {
        g_objectTable.erase(it);
    }
}

int praat_bridge_get_object_count(void) {
    return (int)g_objectTable.size();
}

const char* praat_bridge_get_object_name(int id) {
    static std::string s_name;
    auto it = g_objectTable.find(id);
    if (it == g_objectTable.end() || !it->second) return "";

    conststring32 name32 = Thing_getName(it->second.get());
    s_name = name32 ? Melder_peek32to8(name32) : "";
    return s_name.c_str();
}

const char* praat_bridge_get_object_class(int id) {
    static std::string s_class;
    auto it = g_objectTable.find(id);
    if (it == g_objectTable.end() || !it->second) return "";

    conststring32 class32 = Thing_className(it->second.get());
    s_class = class32 ? Melder_peek32to8(class32) : "";
    return s_class.c_str();
}

double praat_bridge_sound_get_duration(int sound_id) {
    auto it = g_objectTable.find(sound_id);
    if (it == g_objectTable.end() || !it->second || !Thing_isa(it->second.get(), classSound)) return 0.0;
    Sound sound = (Sound)it->second.get();
    return sound->xmax - sound->xmin;
}

double praat_bridge_sound_get_sample_rate(int sound_id) {
    auto it = g_objectTable.find(sound_id);
    if (it == g_objectTable.end() || !it->second || !Thing_isa(it->second.get(), classSound)) return 0.0;
    Sound sound = (Sound)it->second.get();
    return sound->dx > 0.0 ? 1.0 / sound->dx : 0.0;
}

int praat_bridge_sound_get_num_samples(int sound_id) {
    auto it = g_objectTable.find(sound_id);
    if (it == g_objectTable.end() || !it->second || !Thing_isa(it->second.get(), classSound)) return 0;
    Sound sound = (Sound)it->second.get();
    return (int)sound->nx;
}

int praat_bridge_sound_get_num_channels(int sound_id) {
    auto it = g_objectTable.find(sound_id);
    if (it == g_objectTable.end() || !it->second || !Thing_isa(it->second.get(), classSound)) return 0;
    Sound sound = (Sound)it->second.get();
    return (int)sound->ny;
}

int praat_bridge_sound_to_pitch(int sound_id, double time_step, double pitch_floor, double pitch_ceiling) {
    auto it = g_objectTable.find(sound_id);
    if (it == g_objectTable.end() || !it->second || !Thing_isa(it->second.get(), classSound)) return 0;
    Sound sound = (Sound)it->second.get();

    if (pitch_floor <= 0.0) pitch_floor = 75.0;
    if (pitch_ceiling <= 0.0) pitch_ceiling = 600.0;

    try {
        autoPitch pitch = Sound_to_Pitch(sound, time_step, pitch_floor, pitch_ceiling);
        if (!pitch) return 0;

        Thing_setName(pitch.get(), Melder_cat(Thing_getName(sound), U"_pitch"));

        int id = g_nextId++;
        g_objectTable[id] = pitch.move();
        return id;
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

int praat_bridge_sound_to_formant(int sound_id, double time_step, int n_formants, double max_formant, double window_length) {
    auto it = g_objectTable.find(sound_id);
    if (it == g_objectTable.end() || !it->second || !Thing_isa(it->second.get(), classSound)) return 0;
    Sound sound = (Sound)it->second.get();

    if (n_formants <= 0) n_formants = 5;
    if (max_formant <= 0.0) max_formant = 5500.0;
    if (window_length <= 0.0) window_length = 0.025;

    try {
        autoFormant formant = Sound_to_Formant_burg(sound, time_step, (double)n_formants, max_formant, window_length, 50.0);
        if (!formant) return 0;

        Thing_setName(formant.get(), Melder_cat(Thing_getName(sound), U"_formant"));

        int id = g_nextId++;
        g_objectTable[id] = formant.move();
        return id;
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

int praat_bridge_sound_to_spectrogram(int sound_id, double window_length, double max_freq, double time_step, double window_shape) {
    auto it = g_objectTable.find(sound_id);
    if (it == g_objectTable.end() || !it->second || !Thing_isa(it->second.get(), classSound)) return 0;
    Sound sound = (Sound)it->second.get();

    if (window_length <= 0.0) window_length = 0.005;
    if (max_freq <= 0.0) max_freq = 5000.0;
    if (time_step <= 0.0) time_step = 0.002;

    kSound_to_Spectrogram_windowShape shape = kSound_to_Spectrogram_windowShape::DEFAULT;
    if (window_shape >= 0 && window_shape <= 5) {
        shape = (kSound_to_Spectrogram_windowShape)(int)window_shape;
    }

    try {
        autoSpectrogram spectro = Sound_to_Spectrogram_e(sound, window_length, max_freq, time_step, 20.0, shape, 8.0, 8.0);
        if (!spectro) return 0;

        Thing_setName(spectro.get(), Melder_cat(Thing_getName(sound), U"_spectrogram"));

        int id = g_nextId++;
        g_objectTable[id] = spectro.move();
        return id;
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

double praat_bridge_pitch_get_mean(int pitch_id, double tmin, double tmax) {
    auto it = g_objectTable.find(pitch_id);
    if (it == g_objectTable.end() || !it->second || !Thing_isa(it->second.get(), classPitch)) return 0.0;
    Pitch pitch = (Pitch)it->second.get();

    try {
        return Pitch_getMean(pitch, tmin, tmax, kPitch_unit::HERTZ);
    } catch (MelderError) {
        Melder_clearError();
        return 0.0;
    }
}

double praat_bridge_pitch_get_value_at_time(int pitch_id, double time) {
    auto it = g_objectTable.find(pitch_id);
    if (it == g_objectTable.end() || !it->second || !Thing_isa(it->second.get(), classPitch)) return 0.0;
    Pitch pitch = (Pitch)it->second.get();

    try {
        return Pitch_getValueAtTime(pitch, time, kPitch_unit::HERTZ, true);
    } catch (MelderError) {
        Melder_clearError();
        return 0.0;
    }
}

const char* praat_bridge_execute_script(const char* script_text) {
    static std::string s_out;
    if (!script_text || script_text[0] == '\0') return "";

    try {
        autostring32 script32 = Melder_8to32_e(script_text);
        praat_executeScriptFromText(script32.get());
        s_out = "OK";
    } catch (MelderError) {
        s_out = Melder_peek32to8(Melder_getError());
        Melder_clearError();
    }
    return s_out.c_str();
}

const char* praat_bridge_get_info_output(void) {
    static std::string s_info;
    conststring32 info32 = Melder_getInfo();
    s_info = info32 ? Melder_peek32to8(info32) : "";
    return s_info.c_str();
}

}
