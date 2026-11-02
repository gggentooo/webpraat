#include "praat_bridge.h"

#include <unordered_map>
#include <string>
#include <sstream>

// Praat core headers
#include "praat.h"
#include "praatP.h"
#include "praat_script.h"
#include "Sound.h"
#include "Pitch.h"
#include "Formant.h"
#include "Spectrogram.h"
#include "Intensity.h"
#include "TextGrid.h"
#include "Data.h"
#include "Sound_to_Pitch.h"
#include "Sound_to_Formant.h"
#include "Sound_and_Spectrogram.h"
#include "Sound_to_Intensity.h"
#include "melder_audiofiles.h"

// Phase 7 Advanced DSP & Synthesis headers
#include "Matrix.h"
#include "Spectrum.h"
#include "PointProcess.h"
#include "RealTier.h"
#include "PitchTier.h"
#include "IntensityTier.h"
#include "FormantGrid.h"
#include "Table.h"
#include "TableOfReal.h"
#include "PowerCepstrum.h"
#include "PowerCepstrogram.h"
#include "Sound_to_PowerCepstrogram.h"
#include "Sound_to_CPP.h"
#include "CPP.h"
#include "LPC.h"
#include "Sound_and_LPC.h"
#include "LPC_and_Formant.h"
#include "MFCC.h"
#include "Sound_to_MFCC.h"
#include "KlattGrid.h"
#include "Speaker.h"
#include "Articulation.h"
#include "Artword.h"
#include "Artword_Speaker_to_Sound.h"
#include "praatM.h"
#include "Strings_.h"
#include "UiPause.h"
#include "praat_TimeFunction.h"
#include <sys/stat.h>

// Object table store
static std::unordered_map<int, autoThing> g_objectTable;
static int g_nextId = 1;
static std::string g_infoAccumulator;

static int allocate_id() {
    if (theCurrentPraatObjects) {
        return (int)(++ theCurrentPraatObjects -> sequentialUniqueIdOfLatestObjectInList);
    }
    return g_nextId++;
}

static int register_new_object(autoDaata obj, const char* name) {
    if (!obj) return 0;
    if (name && name[0] != '\0') {
        Thing_setName(obj.get(), Melder_8to32_e(name).get());
    }
    if (theCurrentPraatObjects) {
        autostring32 name32 = Melder_8to32_e(name && name[0] ? name : "untitled");
        praat_newWithFile(obj.move(), nullptr, name32.get());
        praat_updateSelection();
        return (int)theCurrentPraatObjects->sequentialUniqueIdOfLatestObjectInList;
    } else {
        int id = allocate_id();
        g_objectTable[id] = obj.move();
        return id;
    }
}

static void s_webPraatInfoProc(conststring32 message) {
    if (message) {
        g_infoAccumulator += Melder_peek32to8(message);
    }
}

static Thing get_object(int id) {
    if (theCurrentPraatObjects) {
        for (integer i = 1; i <= theCurrentPraatObjects -> n; ++i) {
            if (theCurrentPraatObjects -> list [i]. id == id && theCurrentPraatObjects -> list [i]. object) {
                return theCurrentPraatObjects -> list [i]. object;
            }
        }
    }
    auto it = g_objectTable.find(id);
    if (it != g_objectTable.end() && it->second) {
        return it->second.get();
    }
    return nullptr;
}

// Phase 9 Editor Events & Headless Commands
static std::string g_lastEditorEvent;
static autoInterpreterStack s_activeInterpreterStack;

static autoDaata s_soundFileRecognizer(integer nread, const char *header, MelderFile file) {
    if (nread < 16) return autoDaata();
    if (strnequ(header, "FORM", 4) && strnequ(header + 8, "AIF", 3)) return Sound_readFromSoundFile(file);
    if (strnequ(header, "RIFF", 4) && (strnequ(header + 8, "WAVE", 4) || strnequ(header + 8, "CDDA", 4))) return Sound_readFromSoundFile(file);
    if (strnequ(header, ".snd", 4)) return Sound_readFromSoundFile(file);
    if (strnequ(header, "NIST_1A", 7)) return Sound_readFromSoundFile(file);
    if (strnequ(header, "fLaC", 4)) return Sound_readFromSoundFile(file);
    if (Melder_endsWith_caseAware(MelderFile_name(file), U".mp3")) return Sound_readFromSoundFile(file);
    return autoDaata();
}

static void WEB_DO_Sound_TextGrid_edit (UiForm, integer, Stackel, conststring32, Interpreter, conststring32, bool, void *, Editor) {
    int soundId = 0, tgId = 0;
    if (theCurrentPraatObjects) {
        for (integer i = 1; i <= theCurrentPraatObjects->n; ++i) {
            if (theCurrentPraatObjects->list[i].isSelected && theCurrentPraatObjects->list[i].object) {
                Thing obj = theCurrentPraatObjects->list[i].object;
                if (Thing_isa(obj, classSound) && soundId == 0) {
                    soundId = theCurrentPraatObjects->list[i].id;
                } else if (Thing_isa(obj, classTextGrid) && tgId == 0) {
                    tgId = theCurrentPraatObjects->list[i].id;
                }
            }
        }
    }
    std::ostringstream oss;
    oss << "{\"action\":\"open\",\"editor\":\"TextGridEditor\",\"soundId\":" << soundId << ",\"textGridId\":" << tgId << "}";
    g_lastEditorEvent = oss.str();
}

static void WEB_DO_Sound_edit (UiForm, integer, Stackel, conststring32, Interpreter, conststring32, bool, void *, Editor) {
    int soundId = 0;
    if (theCurrentPraatObjects) {
        for (integer i = 1; i <= theCurrentPraatObjects->n; ++i) {
            if (theCurrentPraatObjects->list[i].isSelected && theCurrentPraatObjects->list[i].object) {
                if (Thing_isa(theCurrentPraatObjects->list[i].object, classSound)) {
                    soundId = theCurrentPraatObjects->list[i].id;
                    break;
                }
            }
        }
    }
    std::ostringstream oss;
    oss << "{\"action\":\"open\",\"editor\":\"SoundEditor\",\"soundId\":" << soundId << "}";
    g_lastEditorEvent = oss.str();
}

static void WEB_DO_TextGrid_edit (UiForm, integer, Stackel, conststring32, Interpreter, conststring32, bool, void *, Editor) {
    int tgId = 0;
    if (theCurrentPraatObjects) {
        for (integer i = 1; i <= theCurrentPraatObjects->n; ++i) {
            if (theCurrentPraatObjects->list[i].isSelected && theCurrentPraatObjects->list[i].object) {
                if (Thing_isa(theCurrentPraatObjects->list[i].object, classTextGrid)) {
                    tgId = theCurrentPraatObjects->list[i].id;
                    break;
                }
            }
        }
    }
    std::ostringstream oss;
    oss << "{\"action\":\"open\",\"editor\":\"TextGridEditor\",\"textGridId\":" << tgId << "}";
    g_lastEditorEvent = oss.str();
}

FORM (NEW1_Strings_createAsFileList, U"Create Strings as file list", U"Create Strings as file list...") {
    SENTENCE (name, U"Name", U"fileList")
    FOLDER (path, U"File path", U"*.wav")
    OK
DO
    CREATE_ONE
        autoStrings result = Strings_createAsFileList (path);
    CREATE_ONE_END (name)
}

FORM (NEW1_Strings_createAsFolderList, U"Create Strings as folder list", U"Create Strings as folder list...") {
    SENTENCE (name, U"Name", U"folderList")
    FOLDER (path, U"Folder path", U"*")
    OK
DO
    CREATE_ONE
        autoStrings result = Strings_createAsFolderList (path);
    CREATE_ONE_END (name)
}

DIRECT (INTEGER_Strings_getNumberOfStrings) {
    QUERY_ONE_FOR_REAL (Strings)
        const integer result = my numberOfStrings;
    QUERY_ONE_FOR_REAL_END (U" strings")
}

FORM (STRING_Strings_getString, U"Get string", nullptr) {
    NATURAL (position, U"Position", U"1")
    OK
DO
    QUERY_ONE_FOR_STRING (Strings)
        const conststring32 result = position > my numberOfStrings ? U"" : my strings [position].get();
    QUERY_ONE_FOR_STRING_END
}

DIRECT (INTEGER_TextGrid_getNumberOfTiers) {
    QUERY_ONE_FOR_REAL (TextGrid)
        integer result = my tiers->size;
    QUERY_ONE_FOR_REAL_END (U" tiers")
}

FORM (STRING_TextGrid_getTierName, U"TextGrid: Get tier name", nullptr) {
    NATURAL (tierNumber, U"Tier number", U"1")
    OK
DO
    QUERY_ONE_FOR_STRING (TextGrid)
        if (tierNumber > my tiers->size) Melder_throw (U"Tier number too large.");
        Function tier = my tiers->at [tierNumber];
        conststring32 result = tier -> name.get();
    QUERY_ONE_FOR_STRING_END
}

FORM (BOOLEAN_TextGrid_isIntervalTier, U"TextGrid: Is interval tier?", nullptr) {
    NATURAL (tierNumber, U"Tier number", U"1")
    OK
DO
    QUERY_ONE_FOR_REAL (TextGrid)
        if (tierNumber > my tiers->size) Melder_throw (U"Tier number too large.");
        Function tier = my tiers->at [tierNumber];
        integer result = ( tier -> classInfo == classIntervalTier );
    QUERY_ONE_FOR_REAL_END (result ? U" (yes)" : U" (no)")
}

FORM (INTEGER_TextGrid_getNumberOfIntervals, U"TextGrid: Get number of intervals", nullptr) {
    NATURAL (tierNumber, U"Tier number", U"1")
    OK
DO
    QUERY_ONE_FOR_REAL (TextGrid)
        if (tierNumber > my tiers->size) Melder_throw (U"Tier number too large.");
        Function tier = my tiers->at [tierNumber];
        if (tier -> classInfo != classIntervalTier) Melder_throw (U"Not an interval tier.");
        IntervalTier intervalTier = (IntervalTier) tier;
        integer result = intervalTier -> intervals.size;
    QUERY_ONE_FOR_REAL_END (U" intervals")
}

FORM (STRING_TextGrid_getLabelOfInterval, U"TextGrid: Get label of interval", nullptr) {
    NATURAL (tierNumber, U"Tier number", U"1")
    NATURAL (intervalNumber, U"Interval number", U"1")
    OK
DO
    QUERY_ONE_FOR_STRING (TextGrid)
        if (tierNumber > my tiers->size) Melder_throw (U"Tier number too large.");
        Function tier = my tiers->at [tierNumber];
        if (tier -> classInfo != classIntervalTier) Melder_throw (U"Not an interval tier.");
        IntervalTier intervalTier = (IntervalTier) tier;
        if (intervalNumber > intervalTier -> intervals.size) Melder_throw (U"Interval number too large.");
        TextInterval interval = intervalTier -> intervals.at [intervalNumber];
        conststring32 result = interval -> text.get();
    QUERY_ONE_FOR_STRING_END
}

FORM (REAL_TextGrid_getStartTimeOfInterval, U"TextGrid: Get start time of interval", nullptr) {
    NATURAL (tierNumber, U"Tier number", U"1")
    NATURAL (intervalNumber, U"Interval number", U"1")
    OK
DO
    QUERY_ONE_FOR_REAL (TextGrid)
        if (tierNumber > my tiers->size) Melder_throw (U"Tier number too large.");
        Function tier = my tiers->at [tierNumber];
        if (tier -> classInfo != classIntervalTier) Melder_throw (U"Not an interval tier.");
        IntervalTier intervalTier = (IntervalTier) tier;
        if (intervalNumber > intervalTier -> intervals.size) Melder_throw (U"Interval number too large.");
        TextInterval interval = intervalTier -> intervals.at [intervalNumber];
        double result = interval -> xmin;
    QUERY_ONE_FOR_REAL_END (U" seconds")
}

FORM (REAL_TextGrid_getEndTimeOfInterval, U"TextGrid: Get end time of interval", nullptr) {
    NATURAL (tierNumber, U"Tier number", U"1")
    NATURAL (intervalNumber, U"Interval number", U"1")
    OK
DO
    QUERY_ONE_FOR_REAL (TextGrid)
        if (tierNumber > my tiers->size) Melder_throw (U"Tier number too large.");
        Function tier = my tiers->at [tierNumber];
        if (tier -> classInfo != classIntervalTier) Melder_throw (U"Not an interval tier.");
        IntervalTier intervalTier = (IntervalTier) tier;
        if (intervalNumber > intervalTier -> intervals.size) Melder_throw (U"Interval number too large.");
        TextInterval interval = intervalTier -> intervals.at [intervalNumber];
        double result = interval -> xmax;
    QUERY_ONE_FOR_REAL_END (U" seconds")
}

FORM (INTEGER_TextGrid_getIntervalAtTime, U"TextGrid: Get interval at time", nullptr) {
    NATURAL (tierNumber, U"Tier number", U"1")
    REAL (time, U"Time (s)", U"0.5")
    OK
DO
    QUERY_ONE_FOR_REAL (TextGrid)
        if (tierNumber > my tiers->size) Melder_throw (U"Tier number too large.");
        Function tier = my tiers->at [tierNumber];
        if (tier -> classInfo != classIntervalTier) Melder_throw (U"Not an interval tier.");
        IntervalTier intervalTier = (IntervalTier) tier;
        integer result = IntervalTier_timeToLowIndex (intervalTier, time);
    QUERY_ONE_FOR_REAL_END (U" (interval at ", time, U" seconds)")
}

FORM (MODIFY_TextGrid_setIntervalText, U"TextGrid: Set interval text", nullptr) {
    NATURAL (tierNumber, U"Tier number", U"1")
    NATURAL (intervalNumber, U"Interval number", U"1")
    TEXTFIELD (text, U"Text", U"", 10)
    OK
DO
    MODIFY_EACH (TextGrid)
        TextGrid_setIntervalText (me, tierNumber, intervalNumber, text);
    MODIFY_EACH_END
}

FORM (MODIFY_TextGrid_insertIntervalTier, U"TextGrid: Insert interval tier", nullptr) {
    NATURAL (position, U"Position", U"1 (= at top)")
    WORD (name, U"Name", U"")
    OK
DO
    MODIFY_EACH (TextGrid)
        autoIntervalTier tier = IntervalTier_create (my xmin, my xmax);
        Melder_clipRight (& position, my tiers->size + 1);
        Thing_setName (tier.get(), name);
        my tiers -> addItemAtPosition_move (tier.move(), position);
    MODIFY_EACH_END
}

FORM (MODIFY_TextGrid_insertPointTier, U"TextGrid: Insert point tier", nullptr) {
    NATURAL (position, U"Position", U"1 (= at top)")
    WORD (name, U"Name", U"")
    OK
DO
    MODIFY_EACH (TextGrid)
        autoTextTier tier = TextTier_create (my xmin, my xmax);
        Melder_clipRight (& position, my tiers->size + 1);
        Thing_setName (tier.get(), name);
        my tiers -> addItemAtPosition_move (tier.move(), position);
    MODIFY_EACH_END
}

FORM (MODIFY_TextGrid_removeTier, U"TextGrid: Remove tier", nullptr) {
    NATURAL (tierNumber, U"Tier number", U"1")
    OK
DO
    MODIFY_EACH (TextGrid)
        if (my tiers->size <= 1)
            Melder_throw (U"Sorry, I refuse to remove the last tier.");
        Melder_clipRight (& tierNumber, my tiers->size);
        my tiers -> removeItem (tierNumber);
    MODIFY_EACH_END
}

FORM (MODIFY_TextGrid_insertBoundary, U"TextGrid: Insert boundary", nullptr) {
    NATURAL (tierNumber, U"Tier number", U"1")
    REAL (time, U"Time (s)", U"0.5")
    OK
DO
    MODIFY_EACH (TextGrid)
        TextGrid_insertBoundary (me, tierNumber, time);
    MODIFY_EACH_END
}

FORM (MODIFY_TextGrid_removeBoundaryAtTime, U"TextGrid: Remove boundary at time", nullptr) {
    NATURAL (tierNumber, U"Tier number", U"1")
    REAL (time, U"Time (s)", U"0.5")
    OK
DO
    MODIFY_EACH (TextGrid)
        TextGrid_removeBoundaryAtTime (me, tierNumber, time);
    MODIFY_EACH_END
}

extern "C" {

int praat_bridge_init(void) {
    try {
        static bool s_initialized = false;
        if (s_initialized) return 1;

        praatlib_init();
        MelderConsole_init();
        Melder_setInformationProc(s_webPraatInfoProc);
        Thing_recognizeClassesByName(
            classSound,
            classPitch,
            classFormant,
            classSpectrogram,
            classIntensity,
            classTextGrid,
            classIntervalTier,
            classTextTier,
            classTextInterval,
            classTextPoint,
            classStrings,
            classMatrix,
            classSpectrum,
            classPointProcess,
            classRealPoint,
            classRealTier,
            classPitchTier,
            classIntensityTier,
            classFormantGrid,
            classTable,
            classTableOfReal,
            classPowerCepstrum,
            classPowerCepstrogram,
            classCPP,
            classLPC,
            classMFCC,
            classKlattGrid,
            classPhonationGrid,
            classVocalTractGrid,
            classCouplingGrid,
            classFricationGrid,
            classSpeaker,
            classArtword,
            classArt
        );

        // Register sound file recognizer for WAV/AIFF/FLAC/MP3
        Data_recognizeFileType(s_soundFileRecognizer);

        // Register Strings commands
        praat_addMenuCommand (U"Objects", U"New", U"Create Strings as file list...", nullptr, 1, NEW1_Strings_createAsFileList);
        praat_addMenuCommand (U"Objects", U"New", U"Create Strings as folder list...", nullptr, 1, NEW1_Strings_createAsFolderList);
        praat_addAction1 (classStrings, 1, U"Get number of strings", nullptr, 1, INTEGER_Strings_getNumberOfStrings);
        praat_addAction1 (classStrings, 1, U"Get string...", nullptr, 1, STRING_Strings_getString);

        // Register TextGrid query & modification actions
        praat_addAction1 (classTextGrid, 1, U"Get number of tiers", nullptr, 1, INTEGER_TextGrid_getNumberOfTiers);
        praat_addAction1 (classTextGrid, 1, U"Get tier name...", nullptr, 1, STRING_TextGrid_getTierName);
        praat_addAction1 (classTextGrid, 1, U"Is interval tier...", nullptr, 1, BOOLEAN_TextGrid_isIntervalTier);
        praat_addAction1 (classTextGrid, 1, U"Get number of intervals...", nullptr, 1, INTEGER_TextGrid_getNumberOfIntervals);
        praat_addAction1 (classTextGrid, 1, U"Get start time of interval... || Get starting point... || Get start point...", nullptr, 1, REAL_TextGrid_getStartTimeOfInterval);
        praat_addAction1 (classTextGrid, 1, U"Get end time of interval... || Get end point...", nullptr, 1, REAL_TextGrid_getEndTimeOfInterval);
        praat_addAction1 (classTextGrid, 1, U"Get label of interval...", nullptr, 1, STRING_TextGrid_getLabelOfInterval);
        praat_addAction1 (classTextGrid, 1, U"Get interval at time...", nullptr, 1, INTEGER_TextGrid_getIntervalAtTime);
        praat_addAction1 (classTextGrid, 0, U"Set interval text...", nullptr, 1, MODIFY_TextGrid_setIntervalText);
        praat_addAction1 (classTextGrid, 0, U"Insert interval tier...", nullptr, 1, MODIFY_TextGrid_insertIntervalTier);
        praat_addAction1 (classTextGrid, 0, U"Insert point tier...", nullptr, 1, MODIFY_TextGrid_insertPointTier);
        praat_addAction1 (classTextGrid, 0, U"Remove tier...", nullptr, 1, MODIFY_TextGrid_removeTier);
        praat_addAction1 (classTextGrid, 0, U"Insert boundary...", nullptr, 1, MODIFY_TextGrid_insertBoundary);
        praat_addAction1 (classTextGrid, 0, U"Remove boundary at time...", nullptr, 1, MODIFY_TextGrid_removeBoundaryAtTime);

        // Register Sound & TextGrid time queries (duration, start, end)
        praat_TimeFunction_query_init (classSound);
        praat_TimeFunction_query_init (classTextGrid);

        // Register Edit / View & Edit actions
        praat_addAction2 (classSound, 1, classTextGrid, 1, U"View & Edit || Edit", nullptr, GuiMenu_ATTRACTIVE, WEB_DO_Sound_TextGrid_edit);
        praat_addAction1 (classSound, 1, U"View & Edit || Edit || Open", nullptr, GuiMenu_ATTRACTIVE, WEB_DO_Sound_edit);
        praat_addAction1 (classTextGrid, 1, U"View & Edit alone || View & Edit || Edit", nullptr, 0, WEB_DO_TextGrid_edit);

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

        return register_new_object(sound.move(), name && name[0] ? name : "sound");
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

int praat_bridge_sound_read_from_memory(const unsigned char* buffer, int length, const char* name) {
    if (!buffer || length <= 0) return 0;
    try {
        static int s_tempFileCounter = 0;
        char tempPath[64];
        snprintf(tempPath, sizeof(tempPath), "/tmp/praat_temp_audio_%d.dat", ++s_tempFileCounter);

        FILE* f = fopen(tempPath, "wb");
        if (!f) return 0;
        fwrite(buffer, 1, length, f);
        fclose(f);

        structMelderFile file;
        Melder_pathToFile(Melder_peek8to32_u(tempPath), &file);

        autoSound sound = Sound_readFromSoundFile(&file);
        remove(tempPath);

        if (!sound) return 0;

        return register_new_object(sound.move(), name && name[0] ? name : "sound");
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

void praat_bridge_destroy_object(int id) {
    if (theCurrentPraatObjects) {
        for (integer i = 1; i <= theCurrentPraatObjects -> n; ++i) {
            if (theCurrentPraatObjects -> list [i]. id == id) {
                praat_removeObject(i);
                return;
            }
        }
    }
    auto it = g_objectTable.find(id);
    if (it != g_objectTable.end()) {
        g_objectTable.erase(it);
    }
}

int praat_bridge_get_object_count(void) {
    int count = theCurrentPraatObjects ? (int)theCurrentPraatObjects -> n : 0;
    count += (int)g_objectTable.size();
    return count;
}

const char* praat_bridge_get_object_name(int id) {
    static std::string s_name;
    Thing obj = get_object(id);
    if (!obj) return "";

    conststring32 name32 = Thing_getName(obj);
    s_name = name32 ? Melder_peek32to8(name32) : "";
    return s_name.c_str();
}

const char* praat_bridge_get_object_class(int id) {
    static std::string s_class;
    Thing obj = get_object(id);
    if (!obj) return "";

    conststring32 class32 = Thing_className(obj);
    s_class = class32 ? Melder_peek32to8(class32) : "";
    return s_class.c_str();
}

int praat_bridge_rename_object(int id, const char* new_name) {
    if (!new_name || new_name[0] == '\0') return 0;
    Thing obj = get_object(id);
    if (!obj) return 0;

    try {
        autostring32 name32 = Melder_8to32_e(new_name);
        Thing_setName(obj, name32.get());
        return 1;
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

int praat_bridge_object_save_to_binary_file(int id, const char* path) {
    if (!path || path[0] == '\0') return 0;
    Thing obj = get_object(id);
    if (!obj || !Thing_isa(obj, classDaata)) return 0;

    try {
        structMelderFile file;
        Melder_pathToFile(Melder_8to32_e(path).get(), &file);
        Data_writeToBinaryFile((Daata)obj, &file);
        return 1;
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

int praat_bridge_object_read_from_file(const char* path, const char* name) {
    if (!path || path[0] == '\0') return 0;
    try {
        structMelderFile file;
        Melder_pathToFile(Melder_8to32_e(path).get(), &file);
        autoDaata obj = Data_readFromFile(&file);
        if (!obj) return 0;

        return register_new_object(obj.move(), name && name[0] ? name : "");
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

double praat_bridge_sound_get_duration(int sound_id) {
    Thing obj = get_object(sound_id);
    if (!obj || !Thing_isa(obj, classSound)) return 0.0;
    Sound sound = (Sound)obj;
    return sound->xmax - sound->xmin;
}

double praat_bridge_sound_get_sample_rate(int sound_id) {
    Thing obj = get_object(sound_id);
    if (!obj || !Thing_isa(obj, classSound)) return 0.0;
    Sound sound = (Sound)obj;
    return sound->dx > 0.0 ? 1.0 / sound->dx : 0.0;
}

int praat_bridge_sound_get_num_samples(int sound_id) {
    Thing obj = get_object(sound_id);
    if (!obj || !Thing_isa(obj, classSound)) return 0;
    Sound sound = (Sound)obj;
    return (int)sound->nx;
}

int praat_bridge_sound_get_num_channels(int sound_id) {
    Thing obj = get_object(sound_id);
    if (!obj || !Thing_isa(obj, classSound)) return 0;
    Sound sound = (Sound)obj;
    return (int)sound->ny;
}

int praat_bridge_sound_get_channel_samples(int sound_id, int channel, double* dest, int max_samples) {
    Thing obj = get_object(sound_id);
    if (!obj || !Thing_isa(obj, classSound)) return 0;
    Sound sound = (Sound)obj;
    if (channel < 1 || channel > sound->ny || !dest || max_samples <= 0) return 0;

    int count = (int)sound->nx;
    if (count > max_samples) count = max_samples;

    for (int i = 1; i <= count; ++i) {
        dest[i - 1] = sound->z[channel][i];
    }
    return count;
}

int praat_bridge_sound_save_as_wav_file(int sound_id, const char* path) {
    Thing obj = get_object(sound_id);
    if (!obj || !Thing_isa(obj, classSound)) return 0;
    Sound sound = (Sound)obj;
    if (!path || path[0] == '\0') return 0;

    try {
        structMelderFile file;
        Melder_pathToFile(Melder_peek8to32_u(path), &file);
        autoMelderFile mfile = MelderFile_create(&file);

        integer numberOfChannels = sound->ny;
        integer numberOfSamples = sound->nx;
        integer sampleRate = Melder_iround_tieDown(1.0 / sound->dx);

        MelderFile_writeAudioFileHeader(&file, Melder_WAV, sampleRate, numberOfSamples, numberOfChannels, 16);
        MelderFile_writeFloatToAudio(&file, sound->z.get(), Melder_LINEAR_16_LITTLE_ENDIAN, true);
        MelderFile_writeAudioFileTrailer(&file, Melder_WAV, sampleRate, numberOfSamples, numberOfChannels, 16);

        mfile.close();
        return 1;
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

int praat_bridge_sound_to_pitch(int sound_id, double time_step, double pitch_floor, double pitch_ceiling) {
    Thing obj = get_object(sound_id);
    if (!obj || !Thing_isa(obj, classSound)) return 0;
    Sound sound = (Sound)obj;

    if (pitch_floor <= 0.0) pitch_floor = 75.0;
    if (pitch_ceiling <= 0.0) pitch_ceiling = 600.0;

    try {
        autoPitch pitch = Sound_to_Pitch(sound, time_step, pitch_floor, pitch_ceiling);
        if (!pitch) return 0;

        Thing_setName(pitch.get(), Melder_cat(Thing_getName(sound), U"_pitch"));

        int id = allocate_id();
        g_objectTable[id] = pitch.move();
        return id;
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

int praat_bridge_sound_to_formant(int sound_id, double time_step, int n_formants, double max_formant, double window_length) {
    Thing obj = get_object(sound_id);
    if (!obj || !Thing_isa(obj, classSound)) return 0;
    Sound sound = (Sound)obj;

    if (n_formants <= 0) n_formants = 5;
    if (max_formant <= 0.0) max_formant = 5500.0;
    if (window_length <= 0.0) window_length = 0.025;

    try {
        autoFormant formant = Sound_to_Formant_burg(sound, time_step, (double)n_formants, max_formant, window_length, 50.0);
        if (!formant) return 0;

        Thing_setName(formant.get(), Melder_cat(Thing_getName(sound), U"_formant"));

        int id = allocate_id();
        g_objectTable[id] = formant.move();
        return id;
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

int praat_bridge_sound_to_spectrogram(int sound_id, double window_length, double max_freq, double time_step, double window_shape) {
    Thing obj = get_object(sound_id);
    if (!obj || !Thing_isa(obj, classSound)) return 0;
    Sound sound = (Sound)obj;

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

        int id = allocate_id();
        g_objectTable[id] = spectro.move();
        return id;
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

int praat_bridge_sound_to_intensity(int sound_id, double pitch_floor, double time_step, int subtract_mean) {
    Thing obj = get_object(sound_id);
    if (!obj || !Thing_isa(obj, classSound)) return 0;
    Sound sound = (Sound)obj;

    if (pitch_floor <= 0.0) pitch_floor = 100.0;
    try {
        autoIntensity intensity = Sound_to_Intensity(sound, pitch_floor, time_step, subtract_mean != 0);
        if (!intensity) return 0;

        Thing_setName(intensity.get(), Melder_cat(Thing_getName(sound), U"_intensity"));

        int id = allocate_id();
        g_objectTable[id] = intensity.move();
        return id;
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

int praat_bridge_spectrogram_get_info(int spectro_id, double* out_info) {
    if (!out_info) return 0;
    Thing obj = get_object(spectro_id);
    if (!obj || !Thing_isa(obj, classSpectrogram)) return 0;
    Spectrogram spectro = (Spectrogram)obj;

    out_info[0] = spectro->xmin;
    out_info[1] = spectro->xmax;
    out_info[2] = (double)spectro->nx;
    out_info[3] = spectro->dx;
    out_info[4] = spectro->x1;
    out_info[5] = spectro->ymin;
    out_info[6] = spectro->ymax;
    out_info[7] = (double)spectro->ny;
    out_info[8] = spectro->dy;
    out_info[9] = spectro->y1;
    return 1;
}

int praat_bridge_spectrogram_get_matrix(int spectro_id, double* out_data) {
    if (!out_data) return 0;
    Thing obj = get_object(spectro_id);
    if (!obj || !Thing_isa(obj, classSpectrogram)) return 0;
    Spectrogram spectro = (Spectrogram)obj;

    integer nx = spectro->nx;
    integer ny = spectro->ny;
    for (integer iy = 1; iy <= ny; ++iy) {
        for (integer ix = 1; ix <= nx; ++ix) {
            out_data[(iy - 1) * nx + (ix - 1)] = spectro->z[iy][ix];
        }
    }
    return 1;
}

int praat_bridge_pitch_get_info(int pitch_id, double* out_info) {
    if (!out_info) return 0;
    Thing obj = get_object(pitch_id);
    if (!obj || !Thing_isa(obj, classPitch)) return 0;
    Pitch pitch = (Pitch)obj;

    out_info[0] = pitch->xmin;
    out_info[1] = pitch->xmax;
    out_info[2] = (double)pitch->nx;
    out_info[3] = pitch->dx;
    out_info[4] = pitch->x1;
    out_info[5] = pitch->ceiling;
    return 1;
}

int praat_bridge_pitch_get_frames(int pitch_id, double* out_frequencies) {
    if (!out_frequencies) return 0;
    Thing obj = get_object(pitch_id);
    if (!obj || !Thing_isa(obj, classPitch)) return 0;
    Pitch pitch = (Pitch)obj;

    for (integer i = 1; i <= pitch->nx; ++i) {
        double f = 0.0;
        if (pitch->frames[i].nCandidates > 0) {
            double cand = pitch->frames[i].candidates[1].frequency;
            if (Pitch_util_frequencyIsVoiced(cand, pitch->ceiling)) {
                f = cand;
            }
        }
        out_frequencies[i - 1] = f;
    }
    return 1;
}

int praat_bridge_formant_get_info(int formant_id, double* out_info) {
    if (!out_info) return 0;
    Thing obj = get_object(formant_id);
    if (!obj || !Thing_isa(obj, classFormant)) return 0;
    Formant formant = (Formant)obj;

    out_info[0] = formant->xmin;
    out_info[1] = formant->xmax;
    out_info[2] = (double)formant->nx;
    out_info[3] = formant->dx;
    out_info[4] = formant->x1;
    out_info[5] = (double)formant->maxnFormants;
    return 1;
}

int praat_bridge_formant_get_frames(int formant_id, double* out_frequencies) {
    if (!out_frequencies) return 0;
    Thing obj = get_object(formant_id);
    if (!obj || !Thing_isa(obj, classFormant)) return 0;
    Formant formant = (Formant)obj;

    integer maxP = formant->maxnFormants;
    for (integer i = 1; i <= formant->nx; ++i) {
        integer nFormants = formant->frames[i].numberOfFormants;
        for (integer k = 1; k <= maxP; ++k) {
            double f = (k <= nFormants) ? formant->frames[i].formant[k].frequency : 0.0;
            out_frequencies[(i - 1) * maxP + (k - 1)] = f;
        }
    }
    return 1;
}

int praat_bridge_intensity_get_info(int intensity_id, double* out_info) {
    if (!out_info) return 0;
    Thing obj = get_object(intensity_id);
    if (!obj || !Thing_isa(obj, classIntensity)) return 0;
    Intensity intensity = (Intensity)obj;

    out_info[0] = intensity->xmin;
    out_info[1] = intensity->xmax;
    out_info[2] = (double)intensity->nx;
    out_info[3] = intensity->dx;
    out_info[4] = intensity->x1;
    return 1;
}

int praat_bridge_intensity_get_frames(int intensity_id, double* out_values) {
    if (!out_values) return 0;
    Thing obj = get_object(intensity_id);
    if (!obj || !Thing_isa(obj, classIntensity)) return 0;
    Intensity intensity = (Intensity)obj;

    for (integer i = 1; i <= intensity->nx; ++i) {
        out_values[i - 1] = intensity->z[1][i];
    }
    return 1;
}

double praat_bridge_pitch_get_mean(int pitch_id, double tmin, double tmax) {
    Thing obj = get_object(pitch_id);
    if (!obj || !Thing_isa(obj, classPitch)) return 0.0;
    Pitch pitch = (Pitch)obj;

    try {
        return Pitch_getMean(pitch, tmin, tmax, kPitch_unit::HERTZ);
    } catch (MelderError) {
        Melder_clearError();
        return 0.0;
    }
}

double praat_bridge_pitch_get_value_at_time(int pitch_id, double time) {
    Thing obj = get_object(pitch_id);
    if (!obj || !Thing_isa(obj, classPitch)) return 0.0;
    Pitch pitch = (Pitch)obj;

    try {
        return Pitch_getValueAtTime(pitch, time, kPitch_unit::HERTZ, true);
    } catch (MelderError) {
        Melder_clearError();
        return 0.0;
    }
}

int praat_bridge_create_textgrid(double tmin, double tmax, const char* tier_names, const char* point_tiers, const char* name) {
    if (tmax <= tmin) return 0;
    try {
        autostring32 tierNames32 = Melder_8to32_e(tier_names ? tier_names : "");
        autostring32 pointTiers32 = Melder_8to32_e(point_tiers ? point_tiers : "");
        autoTextGrid grid = TextGrid_create(tmin, tmax, tierNames32.get(), pointTiers32.get());
        if (!grid) return 0;

        return register_new_object(grid.move(), name && name[0] ? name : "grid");
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

int praat_bridge_sound_to_textgrid(int sound_id, const char* tier_names, const char* point_tiers) {
    Thing obj = get_object(sound_id);
    if (!obj || !Thing_isa(obj, classSound)) return 0;
    Sound sound = (Sound)obj;

    try {
        autostring32 tierNames32 = Melder_8to32_e(tier_names ? tier_names : "sentence");
        autostring32 pointTiers32 = Melder_8to32_e(point_tiers ? point_tiers : "");
        autoTextGrid grid = TextGrid_create(sound->xmin, sound->xmax, tierNames32.get(), pointTiers32.get());
        if (!grid) return 0;

        const char32* soundName = Thing_getName(sound);
        std::string baseName = soundName ? Melder_peek32to8(soundName) : "sound";
        baseName += "_grid";

        return register_new_object(grid.move(), baseName.c_str());
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

const char* praat_bridge_textgrid_to_json(int textgrid_id) {
    static std::string s_json;
    Thing obj = get_object(textgrid_id);
    if (!obj || !Thing_isa(obj, classTextGrid)) return "{}";
    TextGrid grid = (TextGrid)obj;

    std::ostringstream ss;
    ss << "{\"xmin\":" << grid->xmin << ",\"xmax\":" << grid->xmax << ",\"tiers\":[";

    integer nTiers = grid->tiers ? grid->tiers->size : 0;
    for (integer itier = 1; itier <= nTiers; ++itier) {
        Function tier = (Function)grid->tiers->at[itier];
        if (itier > 1) ss << ",";
        const char* tierName = tier->name ? Melder_peek32to8(tier->name.get()) : "";
        if (Thing_isa(tier, classIntervalTier)) {
            IntervalTier it = (IntervalTier)tier;
            ss << "{\"type\":\"IntervalTier\",\"name\":\"";
            for (const char* p = tierName; *p; ++p) {
                if (*p == '"') ss << "\\\"";
                else if (*p == '\\') ss << "\\\\";
                else ss << *p;
            }
            ss << "\",\"xmin\":" << it->xmin << ",\"xmax\":" << it->xmax << ",\"intervals\":[";
            integer nInt = it->intervals.size;
            for (integer j = 1; j <= nInt; ++j) {
                if (j > 1) ss << ",";
                TextInterval interval = it->intervals.at[j];
                const char* txt = interval->text ? Melder_peek32to8(interval->text.get()) : "";
                ss << "{\"xmin\":" << interval->xmin << ",\"xmax\":" << interval->xmax << ",\"text\":\"";
                for (const char* p = txt; *p; ++p) {
                    if (*p == '"') ss << "\\\"";
                    else if (*p == '\\') ss << "\\\\";
                    else if (*p == '\n') ss << "\\n";
                    else if (*p == '\r') ss << "\\r";
                    else if (*p == '\t') ss << "\\t";
                    else ss << *p;
                }
                ss << "\"}";
            }
            ss << "]}";
        } else if (Thing_isa(tier, classTextTier)) {
            TextTier pt = (TextTier)tier;
            ss << "{\"type\":\"TextTier\",\"name\":\"";
            for (const char* p = tierName; *p; ++p) {
                if (*p == '"') ss << "\\\"";
                else if (*p == '\\') ss << "\\\\";
                else ss << *p;
            }
            ss << "\",\"xmin\":" << pt->xmin << ",\"xmax\":" << pt->xmax << ",\"points\":[";
            integer nPts = pt->points.size;
            for (integer j = 1; j <= nPts; ++j) {
                if (j > 1) ss << ",";
                TextPoint point = pt->points.at[j];
                const char* txt = point->mark ? Melder_peek32to8(point->mark.get()) : "";
                ss << "{\"time\":" << point->number << ",\"mark\":\"";
                for (const char* p = txt; *p; ++p) {
                    if (*p == '"') ss << "\\\"";
                    else if (*p == '\\') ss << "\\\\";
                    else if (*p == '\n') ss << "\\n";
                    else if (*p == '\r') ss << "\\r";
                    else if (*p == '\t') ss << "\\t";
                    else ss << *p;
                }
                ss << "\"}";
            }
            ss << "]}";
        }
    }
    ss << "]}";
    s_json = ss.str();
    return s_json.c_str();
}

int praat_bridge_textgrid_save_to_file(int textgrid_id, const char* path) {
    if (!path || path[0] == '\0') return 0;
    Thing obj = get_object(textgrid_id);
    if (!obj || !Thing_isa(obj, classTextGrid)) return 0;
    TextGrid grid = (TextGrid)obj;

    try {
        structMelderFile file;
        Melder_pathToFile(Melder_8to32_e(path).get(), &file);
        Data_writeToTextFile((Daata)grid, &file);
        return 1;
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

int praat_bridge_textgrid_read_from_file(const char* path, const char* name) {
    if (!path || path[0] == '\0') return 0;
    try {
        structMelderFile file;
        Melder_pathToFile(Melder_8to32_e(path).get(), &file);
        autoDaata obj = Data_readFromTextFile(&file);
        if (!obj || !Thing_isa(obj.get(), classTextGrid)) {
            obj = Data_readFromFile(&file);
            if (!obj || !Thing_isa(obj.get(), classTextGrid)) return 0;
        }

        return register_new_object(obj.move(), name && name[0] ? name : "");
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

int praat_bridge_textgrid_replace_from_file(int textgrid_id, const char* path) {
    if (!path || path[0] == '\0') return 0;
    try {
        structMelderFile file;
        Melder_pathToFile(Melder_8to32_e(path).get(), &file);
        autoDaata obj = Data_readFromTextFile(&file);
        if (!obj || !Thing_isa(obj.get(), classTextGrid)) {
            obj = Data_readFromFile(&file);
            if (!obj || !Thing_isa(obj.get(), classTextGrid)) return 0;
        }

        if (theCurrentPraatObjects) {
            for (integer i = 1; i <= theCurrentPraatObjects -> n; ++i) {
                if (theCurrentPraatObjects -> list [i]. id == textgrid_id) {
                    if (theCurrentPraatObjects -> list [i]. object) {
                        const char32* oldName = Thing_getName(theCurrentPraatObjects -> list [i]. object);
                        if (oldName && oldName[0] != '\0') {
                            Thing_setName(obj.get(), oldName);
                        }
                        forget(theCurrentPraatObjects -> list [i]. object);
                    }
                    theCurrentPraatObjects -> list [i]. object = obj.releaseToAmbiguousOwner();
                    return 1;
                }
            }
        }

        auto it = g_objectTable.find(textgrid_id);
        if (it != g_objectTable.end()) {
            if (it->second) {
                const char32* oldName = Thing_getName(it->second.get());
                if (oldName && oldName[0] != '\0') {
                    Thing_setName(obj.get(), oldName);
                }
            }
            it->second.adoptFromAmbiguousOwner(obj.releaseToAmbiguousOwner());
            return 1;
        }
        return 0;
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

int praat_bridge_textgrid_insert_boundary(int textgrid_id, int tier_number, double time) {
    Thing obj = get_object(textgrid_id);
    if (!obj || !Thing_isa(obj, classTextGrid)) return 0;
    TextGrid grid = (TextGrid)obj;

    try {
        TextGrid_insertBoundary(grid, tier_number, time);
        return 1;
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

int praat_bridge_textgrid_remove_boundary_at_time(int textgrid_id, int tier_number, double time) {
    Thing obj = get_object(textgrid_id);
    if (!obj || !Thing_isa(obj, classTextGrid)) return 0;
    TextGrid grid = (TextGrid)obj;

    try {
        TextGrid_removeBoundaryAtTime(grid, tier_number, time);
        return 1;
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

int praat_bridge_textgrid_set_interval_text(int textgrid_id, int tier_number, int interval_number, const char* text) {
    Thing obj = get_object(textgrid_id);
    if (!obj || !Thing_isa(obj, classTextGrid)) return 0;
    TextGrid grid = (TextGrid)obj;

    try {
        TextGrid_setIntervalText(grid, tier_number, interval_number, Melder_8to32_e(text ? text : "").get());
        return 1;
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

int praat_bridge_textgrid_insert_point(int textgrid_id, int tier_number, double time, const char* mark) {
    Thing obj = get_object(textgrid_id);
    if (!obj || !Thing_isa(obj, classTextGrid)) return 0;
    TextGrid grid = (TextGrid)obj;

    try {
        TextGrid_insertPoint(grid, tier_number, time, Melder_8to32_e(mark ? mark : "").get());
        return 1;
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

int praat_bridge_textgrid_set_point_text(int textgrid_id, int tier_number, int point_number, const char* text) {
    Thing obj = get_object(textgrid_id);
    if (!obj || !Thing_isa(obj, classTextGrid)) return 0;
    TextGrid grid = (TextGrid)obj;

    try {
        TextGrid_setPointText(grid, tier_number, point_number, Melder_8to32_e(text ? text : "").get());
        return 1;
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

int praat_bridge_textgrid_add_tier(int textgrid_id, int position, const char* name, int is_interval_tier) {
    Thing obj = get_object(textgrid_id);
    if (!obj || !Thing_isa(obj, classTextGrid)) return 0;
    TextGrid grid = (TextGrid)obj;

    try {
        autostring32 name32 = Melder_8to32_e(name ? name : "");
        integer pos = position;
        if (pos <= 0 || pos > grid->tiers->size + 1) {
            pos = grid->tiers->size + 1;
        }

        if (is_interval_tier) {
            autoIntervalTier tier = IntervalTier_create(grid->xmin, grid->xmax);
            Thing_setName(tier.get(), name32.get());
            grid->tiers->addItemAtPosition_move(tier.move(), pos);
        } else {
            autoTextTier tier = TextTier_create(grid->xmin, grid->xmax);
            Thing_setName(tier.get(), name32.get());
            grid->tiers->addItemAtPosition_move(tier.move(), pos);
        }
        return 1;
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

int praat_bridge_textgrid_remove_tier(int textgrid_id, int tier_number) {
    Thing obj = get_object(textgrid_id);
    if (!obj || !Thing_isa(obj, classTextGrid)) return 0;
    TextGrid grid = (TextGrid)obj;

    try {
        if (grid->tiers->size <= 1) return 0;
        if (tier_number < 1 || tier_number > grid->tiers->size) return 0;
        grid->tiers->removeItem(tier_number);
        return 1;
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

int praat_bridge_textgrid_duplicate_tier(int textgrid_id, int tier_number, int position, const char* name) {
    Thing obj = get_object(textgrid_id);
    if (!obj || !Thing_isa(obj, classTextGrid)) return 0;
    TextGrid grid = (TextGrid)obj;

    try {
        if (tier_number < 1 || tier_number > grid->tiers->size) return 0;
        autostring32 name32 = Melder_8to32_e(name ? name : "");
        integer pos = position;
        if (pos <= 0 || pos > grid->tiers->size + 1) {
            pos = grid->tiers->size + 1;
        }

        autoFunction newTier = Data_copy(grid->tiers->at[tier_number]);
        if (name && name[0] != '\0') {
            Thing_setName(newTier.get(), name32.get());
        }
        grid->tiers->addItemAtPosition_move(newTier.move(), pos);
        return 1;
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

int praat_bridge_textgrid_rename_tier(int textgrid_id, int tier_number, const char* name) {
    Thing obj = get_object(textgrid_id);
    if (!obj || !Thing_isa(obj, classTextGrid)) return 0;
    TextGrid grid = (TextGrid)obj;

    try {
        if (tier_number < 1 || tier_number > grid->tiers->size) return 0;
        autostring32 name32 = Melder_8to32_e(name ? name : "");
        Thing_setName(grid->tiers->at[tier_number], name32.get());
        return 1;
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

#define kInterpreter_WORD 1
#define kInterpreter_SENTENCE 2
#define kInterpreter_TEXT 3
#define kInterpreter_INFILE 4
#define kInterpreter_OUTFILE 5
#define kInterpreter_FOLDER 6
#define kInterpreter_REAL 7
#define kInterpreter_NONNEGATIVE 8
#define kInterpreter_POSITIVE 9
#define kInterpreter_INTEGER 10
#define kInterpreter_NATURAL0 11
#define kInterpreter_NATURAL1 12
#define kInterpreter_BOOLEAN 13
#define kInterpreter_REALVECTOR 14
#define kInterpreter_NONNEGATIVEVECTOR 15
#define kInterpreter_POSITIVEVECTOR 16
#define kInterpreter_INTEGERVECTOR 17
#define kInterpreter_NATURAL0VECTOR 18
#define kInterpreter_NATURAL1VECTOR 19
#define kInterpreter_REALMATRIX 20
#define kInterpreter_CHOICE 21
#define kInterpreter_OPTIONMENU 22
#define kInterpreter_MAXIMUM_TYPE_WITH_VARIABLE_NAME 22
#define kInterpreter_BUTTON 23
#define kInterpreter_OPTION 24
#define kInterpreter_HEADING 25
#define kInterpreter_COMMENT 26
#define kInterpreter_CAPTION 27

static std::string s_escapeJson(const std::string& in) {
    std::string out;
    out.reserve(in.size() + 16);
    for (char c : in) {
        if (c == '"') out += "\\\"";
        else if (c == '\\') out += "\\\\";
        else if (c == '\n') out += "\\n";
        else if (c == '\r') out += "\\r";
        else if (c == '\t') out += "\\t";
        else out += c;
    }
    return out;
}

static std::unordered_map<std::string, std::string> s_parseArgsJson(const char* args_json) {
    std::unordered_map<std::string, std::string> map;
    if (!args_json || args_json[0] == '\0') return map;

    std::string s = args_json;
    size_t pos = 0;
    while (pos < s.length()) {
        size_t keyStart = s.find('"', pos);
        if (keyStart == std::string::npos) break;
        size_t keyEnd = s.find('"', keyStart + 1);
        if (keyEnd == std::string::npos) break;
        std::string key = s.substr(keyStart + 1, keyEnd - keyStart - 1);

        size_t colon = s.find(':', keyEnd + 1);
        if (colon == std::string::npos) break;

        size_t valStart = s.find_first_not_of(" \t\r\n", colon + 1);
        if (valStart == std::string::npos) break;

        std::string val;
        if (s[valStart] == '"') {
            size_t valEnd = s.find('"', valStart + 1);
            if (valEnd == std::string::npos) break;
            val = s.substr(valStart + 1, valEnd - valStart - 1);
            pos = valEnd + 1;
        } else {
            size_t valEnd = s.find_first_of(",}", valStart);
            if (valEnd == std::string::npos) valEnd = s.length();
            val = s.substr(valStart, valEnd - valStart);
            size_t trimEnd = val.find_last_not_of(" \t\r\n");
            if (trimEnd != std::string::npos) val = val.substr(0, trimEnd + 1);
            pos = valEnd;
        }

        std::string normKey = key;
        for (char& c : normKey) c = tolower(c);
        if (!normKey.empty() && normKey.back() == '$') normKey.pop_back();

        map[normKey] = val;
        map[key] = val;
    }
    return map;
}

const char* praat_bridge_parse_script_form(const char* script_text) {
    static std::string s_json;
    if (!script_text || script_text[0] == '\0') {
        s_json = "{\"hasForm\":false,\"parameters\":[]}";
        return s_json.c_str();
    }

    try {
        autostring32 script32 = Melder_8to32_e(script_text);
        autoInterpreterStack stack = InterpreterStack_create(nullptr);
        autoInterpreter interpreter = Interpreter_createFromEnvironment(stack.get(), nullptr, nullptr);

        integer npar = Interpreter_readParameters(interpreter.get(), script32.get());
        if (npar == 0 || interpreter->numberOfParameters == 0) {
            s_json = "{\"hasForm\":false,\"parameters\":[]}";
            return s_json.c_str();
        }

        std::ostringstream oss;
        oss << "{\"hasForm\":true";
        if (interpreter->dialogTitle && interpreter->dialogTitle[0]) {
            oss << ",\"title\":\"" << s_escapeJson(Melder_peek32to8(interpreter->dialogTitle.get())) << "\"";
        } else {
            oss << ",\"title\":\"\"";
        }
        oss << ",\"parameters\":[";

        bool first = true;
        for (int i = 1; i <= interpreter->numberOfParameters; ++i) {
            int type = interpreter->types[i];
            const char32* paramName = interpreter->parameters[i];
            const char32* argVal = interpreter->arguments[i] ? interpreter->arguments[i].get() : U"";

            std::string nameStr = paramName ? Melder_peek32to8(paramName) : "";
            std::string valStr = argVal ? Melder_peek32to8(argVal) : "";
            std::string typeStr;
            std::string varName;

            if (type <= kInterpreter_MAXIMUM_TYPE_WITH_VARIABLE_NAME && !nameStr.empty()) {
                varName = nameStr;
                for (char& c : varName) c = tolower(c);
                if (!varName.empty() && varName.back() == '$') {
                    varName.pop_back();
                }
            }

            switch (type) {
                case kInterpreter_WORD: typeStr = "word"; break;
                case kInterpreter_SENTENCE: typeStr = "sentence"; break;
                case kInterpreter_TEXT: typeStr = "text"; break;
                case kInterpreter_INFILE: typeStr = "infile"; break;
                case kInterpreter_OUTFILE: typeStr = "outfile"; break;
                case kInterpreter_FOLDER: typeStr = "folder"; break;
                case kInterpreter_REAL: typeStr = "real"; break;
                case kInterpreter_NONNEGATIVE: typeStr = "nonnegative"; break;
                case kInterpreter_POSITIVE: typeStr = "positive"; break;
                case kInterpreter_INTEGER: typeStr = "integer"; break;
                case kInterpreter_NATURAL0: typeStr = "natural0"; break;
                case kInterpreter_NATURAL1: typeStr = "natural"; break;
                case kInterpreter_BOOLEAN: typeStr = "boolean"; break;
                case kInterpreter_CHOICE: typeStr = "choice"; break;
                case kInterpreter_OPTIONMENU: typeStr = "optionmenu"; break;
                case kInterpreter_BUTTON: typeStr = "button"; break;
                case kInterpreter_OPTION: typeStr = "option"; break;
                case kInterpreter_COMMENT: typeStr = "comment"; break;
                default: typeStr = "unknown"; break;
            }

            if (!first) oss << ",";
            first = false;

            oss << "{"
                << "\"name\":\"" << s_escapeJson(nameStr) << "\""
                << ",\"varName\":\"" << s_escapeJson(varName) << "\""
                << ",\"type\":\"" << typeStr << "\""
                << ",\"defaultValue\":\"" << s_escapeJson(valStr) << "\"";

            if (type == kInterpreter_CHOICE || type == kInterpreter_OPTIONMENU) {
                oss << ",\"options\":[";
                bool firstOpt = true;
                int j = i + 1;
                while (j <= interpreter->numberOfParameters &&
                       (interpreter->types[j] == kInterpreter_BUTTON || interpreter->types[j] == kInterpreter_OPTION)) {
                    if (!firstOpt) oss << ",";
                    firstOpt = false;
                    const char32* optVal = interpreter->arguments[j] ? interpreter->arguments[j].get() : U"";
                    oss << "\"" << s_escapeJson(optVal ? Melder_peek32to8(optVal) : "") << "\"";
                    j++;
                }
                oss << "]";
            }

            oss << "}";
        }

        oss << "]}";
        s_json = oss.str();
        return s_json.c_str();
    } catch (MelderError) {
        Melder_clearError();
        s_json = "{\"hasForm\":false,\"parameters\":[]}";
        return s_json.c_str();
    } catch (...) {
        s_json = "{\"hasForm\":false,\"parameters\":[]}";
        return s_json.c_str();
    }
}

const char* praat_bridge_execute_script_with_args(const char* script_text, const char* args_json) {
    static std::string s_resultJson;
    if (!script_text || script_text[0] == '\0') {
        s_resultJson = "{\"status\":\"COMPLETED\",\"info\":\"\"}";
        return s_resultJson.c_str();
    }

    try {
        g_infoAccumulator.clear();
        Melder_clearInfo();

        autostring32 script32 = Melder_8to32_e(script_text);
        s_activeInterpreterStack = InterpreterStack_create(nullptr);
        autoInterpreter interpreter = Interpreter_createFromEnvironment(s_activeInterpreterStack.get(), nullptr, nullptr);
        Melder_getCurrentFolder(&interpreter->workingDirectory);

        integer npar = Interpreter_readParameters(interpreter.get(), script32.get());
        if (npar > 0 && args_json && args_json[0] != '\0') {
            auto argsMap = s_parseArgsJson(args_json);
            for (int ipar = 1; ipar <= interpreter->numberOfParameters; ++ipar) {
                int type = interpreter->types[ipar];
                const char32* pName = interpreter->parameters[ipar];
                if (!pName || !pName[0]) continue;
                std::string name8 = Melder_peek32to8(pName);
                std::string normName = name8;
                for (char& c : normName) c = tolower(c);
                if (!normName.empty() && normName.back() == '$') normName.pop_back();

                auto it = argsMap.find(normName);
                if (it != argsMap.end()) {
                    if (type == kInterpreter_BOOLEAN) {
                        std::string boolVal = (it->second == "1" || it->second == "true") ? "1" : "0";
                        interpreter->arguments[ipar] = Melder_8to32_e(boolVal.c_str());
                    } else {
                        interpreter->arguments[ipar] = Melder_8to32_e(it->second.c_str());
                    }
                }
            }
        }

        s_activeInterpreterStack->emptyAll();
        s_activeInterpreterStack->runDown(interpreter.move(), script32.move(), false);

        conststring32 info32 = Melder_getInfo();
        std::string infoStr = (info32 && info32[0] != '\0') ? Melder_peek32to8(info32) : g_infoAccumulator;

        if (UiPause_isPaused()) {
            std::ostringstream oss;
            oss << "{\"status\":\"PAUSED\",\"pauseData\":" << UiPause_getPauseDataJson()
                << ",\"info\":\"" << s_escapeJson(infoStr) << "\"}";
            s_resultJson = oss.str();
        } else {
            std::ostringstream oss;
            oss << "{\"status\":\"COMPLETED\",\"info\":\"" << s_escapeJson(infoStr) << "\"}";
            s_resultJson = oss.str();
        }
    } catch (MelderError) {
        conststring32 err = Melder_getError();
        std::string errMsg = err ? Melder_peek32to8(err) : "Script error";
        Melder_clearError();
        std::ostringstream oss;
        oss << "{\"status\":\"ERROR\",\"error\":\"" << s_escapeJson(errMsg) << "\"}";
        s_resultJson = oss.str();
    } catch (const std::exception& e) {
        std::ostringstream oss;
        oss << "{\"status\":\"ERROR\",\"error\":\"" << s_escapeJson(e.what()) << "\"}";
        s_resultJson = oss.str();
    } catch (...) {
        s_resultJson = "{\"status\":\"ERROR\",\"error\":\"Unknown error during script execution\"}";
    }
    return s_resultJson.c_str();
}

const char* praat_bridge_resume_script(int clicked_button, const char* args_json) {
    static std::string s_resumeResult;
    try {
        g_infoAccumulator.clear();
        Melder_clearInfo();

        int ok = UiPause_resume(clicked_button, args_json);
        (void)ok;

        conststring32 info32 = Melder_getInfo();
        std::string infoStr = (info32 && info32[0] != '\0') ? Melder_peek32to8(info32) : g_infoAccumulator;

        if (UiPause_isPaused()) {
            std::ostringstream oss;
            oss << "{\"status\":\"PAUSED\",\"pauseData\":" << UiPause_getPauseDataJson()
                << ",\"info\":\"" << s_escapeJson(infoStr) << "\"}";
            s_resumeResult = oss.str();
        } else {
            std::ostringstream oss;
            oss << "{\"status\":\"COMPLETED\",\"info\":\"" << s_escapeJson(infoStr) << "\"}";
            s_resumeResult = oss.str();
        }
    } catch (MelderError) {
        conststring32 err = Melder_getError();
        std::string errMsg = err ? Melder_peek32to8(err) : "Error resuming script";
        Melder_clearError();
        std::ostringstream oss;
        oss << "{\"status\":\"ERROR\",\"error\":\"" << s_escapeJson(errMsg) << "\"}";
        s_resumeResult = oss.str();
    } catch (const std::exception& e) {
        std::ostringstream oss;
        oss << "{\"status\":\"ERROR\",\"error\":\"" << s_escapeJson(e.what()) << "\"}";
        s_resumeResult = oss.str();
    } catch (...) {
        s_resumeResult = "{\"status\":\"ERROR\",\"error\":\"Unknown error resuming script\"}";
    }
    return s_resumeResult.c_str();
}

int praat_bridge_abort_script(void) {
    UiPause_abort();
    if (s_activeInterpreterStack) {
        s_activeInterpreterStack->emptyAll();
    }
    return 1;
}

const char* praat_bridge_get_last_editor_event(void) {
    static std::string s_event;
    s_event = g_lastEditorEvent;
    g_lastEditorEvent.clear();
    return s_event.c_str();
}

int praat_bridge_set_current_directory(const char* path) {
    if (!path || path[0] == '\0') return 0;
    try {
        structMelderFolder folder { };
        Melder_pathToFolder(Melder_peek8to32_u(path), &folder);
        Melder_setCurrentFolder(&folder);
        return 1;
    } catch (...) {
        return 0;
    }
}

int praat_bridge_vfs_write_file(const char* path, const unsigned char* data, int length) {
    if (!path || !data || length < 0) return 0;
    std::string sPath = path;
    size_t lastSlash = sPath.find_last_of('/');
    if (lastSlash != std::string::npos && lastSlash > 0) {
        std::string dir = sPath.substr(0, lastSlash);
        for (size_t i = 1; i <= dir.length(); ++i) {
            if (i == dir.length() || dir[i] == '/') {
                std::string sub = dir.substr(0, i);
                mkdir(sub.c_str(), 0777);
            }
        }
    }
    FILE* f = fopen(path, "wb");
    if (!f) return 0;
    size_t written = fwrite(data, 1, length, f);
    fclose(f);
    return written == (size_t)length ? 1 : 0;
}

const char* praat_bridge_execute_script(const char* script_text) {
    static std::string s_out;
    if (!script_text || script_text[0] == '\0') return "";

    try {
        g_infoAccumulator.clear();
        Melder_clearInfo();
        autostring32 script32 = Melder_8to32_e(script_text);

        s_activeInterpreterStack = InterpreterStack_create(nullptr);
        autoInterpreter interpreter = Interpreter_createFromEnvironment(s_activeInterpreterStack.get(), nullptr, nullptr);
        Melder_getCurrentFolder(&interpreter->workingDirectory);

        Interpreter_readParameters(interpreter.get(), script32.get());

        s_activeInterpreterStack->emptyAll();
        s_activeInterpreterStack->runDown(interpreter.move(), script32.move(), false);

        conststring32 info32 = Melder_getInfo();
        std::string infoStr = (info32 && info32[0] != '\0') ? Melder_peek32to8(info32) : "";
        if (!infoStr.empty()) {
            s_out = infoStr;
        } else {
            s_out = g_infoAccumulator;
        }
    } catch (MelderError) {
        conststring32 err = Melder_getError();
        std::string errMsg = err ? Melder_peek32to8(err) : "Script error";
        s_out = "Error: " + errMsg;
        Melder_clearError();
    } catch (const std::exception& e) {
        s_out = std::string("Error: ") + e.what();
    } catch (...) {
        s_out = "Error: Unknown error during script execution";
    }
    return s_out.c_str();
}

const char* praat_bridge_get_info_output(void) {
    static std::string s_info;
    conststring32 info32 = Melder_getInfo();
    if (info32 && info32[0] != '\0') {
        s_info = Melder_peek32to8(info32);
    } else {
        s_info = g_infoAccumulator;
    }
    return s_info.c_str();
}

void praat_bridge_clear_info_output(void) {
    g_infoAccumulator.clear();
    Melder_clearInfo();
}

const char* praat_bridge_get_objects_json(void) {
    static std::string s_json;
    std::ostringstream oss;
    oss << "[";

    bool first = true;
    if (theCurrentPraatObjects) {
        for (integer i = 1; i <= theCurrentPraatObjects -> n; ++i) {
            Thing obj = theCurrentPraatObjects -> list [i]. object;
            if (!obj) continue;

            int id = (int)theCurrentPraatObjects -> list [i]. id;
            const char* className = Melder_peek32to8(Thing_className(obj));
            const char* name = Melder_peek32to8(Thing_getName(obj));

            if (!first) oss << ",";
            first = false;

            oss << "{\"id\":" << id
                << ",\"className\":\"" << (className ? className : "") << "\""
                << ",\"name\":\"" << (name ? name : "") << "\"";

            if (Thing_isa(obj, classSound)) {
                Sound s = (Sound)obj;
                double duration = s->xmax - s->xmin;
                double fs = s->dx > 0.0 ? 1.0 / s->dx : 0.0;
                oss << ",\"duration\":" << duration
                    << ",\"sampleRate\":" << fs
                    << ",\"numChannels\":" << s->ny
                    << ",\"numSamples\":" << (int)s->nx;
            }

            oss << "}";
        }
    }

    for (const auto& pair : g_objectTable) {
        if (!pair.second) continue;
        Thing obj = pair.second.get();
        int id = pair.first;
        const char* className = Melder_peek32to8(Thing_className(obj));
        const char* name = Melder_peek32to8(Thing_getName(obj));

        if (!first) oss << ",";
        first = false;

        oss << "{\"id\":" << id
            << ",\"className\":\"" << (className ? className : "") << "\""
            << ",\"name\":\"" << (name ? name : "") << "\"";

        if (Thing_isa(obj, classSound)) {
            Sound s = (Sound)obj;
            double duration = s->xmax - s->xmin;
            double fs = s->dx > 0.0 ? 1.0 / s->dx : 0.0;
            oss << ",\"duration\":" << duration
                << ",\"sampleRate\":" << fs
                << ",\"numChannels\":" << s->ny
                << ",\"numSamples\":" << (int)s->nx;
        }

        oss << "}";
    }

    oss << "]";
    s_json = oss.str();
    return s_json.c_str();
}

int praat_bridge_select_object(int id) {
    if (!theCurrentPraatObjects) return 0;
    praat_deselectAll();
    for (integer i = 1; i <= theCurrentPraatObjects -> n; ++i) {
        if (theCurrentPraatObjects -> list [i]. id == id) {
            praat_select(i);
            return 1;
        }
    }
    return 0;
}

// ============================================================================
// Phase 7 Advanced DSP: Cepstral Peak Prominence (PowerCepstrogram & CPP)
// ============================================================================

int praat_bridge_sound_to_power_cepstrogram(int sound_id, double pitch_floor, double time_step, double max_freq, double pre_emphasis) {
    Thing obj = get_object(sound_id);
    if (!obj || !Thing_isa(obj, classSound)) return 0;
    Sound sound = (Sound)obj;

    if (pitch_floor <= 0.0) pitch_floor = 60.0;
    if (time_step <= 0.0) time_step = 0.002;
    if (max_freq <= 0.0) max_freq = 5000.0;
    if (pre_emphasis < 0.0) pre_emphasis = 50.0;

    try {
        autoPowerCepstrogram cepstro = Sound_to_PowerCepstrogram(sound, pitch_floor, time_step, max_freq, pre_emphasis);
        if (!cepstro) return 0;

        Thing_setName(cepstro.get(), Melder_cat(Thing_getName(sound), U"_cepstrogram"));
        int id = allocate_id();
        g_objectTable[id] = cepstro.move();
        return id;
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

double praat_bridge_power_cepstrogram_get_cpps(
    int cepstrogram_id,
    int subtract_trend,
    double time_avg_window,
    double quefrency_avg_window,
    double pitch_floor,
    double pitch_ceiling
) {
    Thing obj = get_object(cepstrogram_id);
    if (!obj || !Thing_isa(obj, classPowerCepstrogram)) return 0.0;
    PowerCepstrogram cepstro = (PowerCepstrogram)obj;

    if (time_avg_window < 0.0) time_avg_window = 0.02;
    if (quefrency_avg_window < 0.0) quefrency_avg_window = 0.0005;
    if (pitch_floor <= 0.0) pitch_floor = 60.0;
    if (pitch_ceiling <= pitch_floor) pitch_ceiling = 330.0;

    try {
        return PowerCepstrogram_getCPPS(
            cepstro,
            subtract_trend != 0,
            time_avg_window,
            quefrency_avg_window,
            pitch_floor,
            pitch_ceiling,
            0.05,
            kVector_peakInterpolation::PARABOLIC,
            0.001,
            0.05,
            kCepstrum_trendType::DEFAULT,
            kCepstrum_trendFit::DEFAULT
        );
    } catch (MelderError) {
        Melder_clearError();
        return 0.0;
    }
}

int praat_bridge_power_cepstrogram_to_cpp(int cepstrogram_id, double pitch_floor, double pitch_ceiling) {
    Thing obj = get_object(cepstrogram_id);
    if (!obj || !Thing_isa(obj, classPowerCepstrogram)) return 0;
    PowerCepstrogram cepstro = (PowerCepstrogram)obj;

    if (pitch_floor <= 0.0) pitch_floor = 60.0;
    if (pitch_ceiling <= pitch_floor) pitch_ceiling = 330.0;

    try {
        autoCPP cpp = PowerCepstrogram_to_CPP(
            cepstro,
            pitch_floor,
            pitch_ceiling,
            kVector_peakInterpolation::PARABOLIC,
            0.001,
            0.05,
            kCepstrum_trendType::DEFAULT,
            kCepstrum_trendFit::DEFAULT
        );
        if (!cpp) return 0;

        Thing_setName(cpp.get(), Melder_cat(Thing_getName(cepstro), U"_cpp"));
        int id = allocate_id();
        g_objectTable[id] = cpp.move();
        return id;
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

int praat_bridge_sound_to_cpp(int sound_id, double pitch_floor, double pitch_ceiling, double time_step) {
    Thing obj = get_object(sound_id);
    if (!obj || !Thing_isa(obj, classSound)) return 0;
    Sound sound = (Sound)obj;

    if (pitch_floor <= 0.0) pitch_floor = 60.0;
    if (pitch_ceiling <= pitch_floor) pitch_ceiling = 330.0;
    if (time_step <= 0.0) time_step = 0.002;

    try {
        autoCPP cpp = Sound_to_CPP(
            sound,
            pitch_floor,
            pitch_ceiling,
            time_step,
            5000.0,
            50.0,
            true,
            0.02,
            0.0005,
            kVector_peakInterpolation::PARABOLIC,
            0.001,
            0.05,
            kCepstrum_trendType::DEFAULT,
            kCepstrum_trendFit::DEFAULT
        );
        if (!cpp) return 0;

        Thing_setName(cpp.get(), Melder_cat(Thing_getName(sound), U"_cpp"));
        int id = allocate_id();
        g_objectTable[id] = cpp.move();
        return id;
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

double praat_bridge_cpp_get_mean(int cpp_id, double tmin, double tmax) {
    Thing obj = get_object(cpp_id);
    if (!obj || !Thing_isa(obj, classCPP)) return 0.0;
    CPP cpp = (CPP)obj;

    try {
        double voicedMean = CPP_getMean(cpp, tmin, tmax);
        if (isdefined(voicedMean)) return voicedMean;
        double allMean = Vector_getMean(cpp, tmin, tmax, 1);
        return isdefined(allMean) ? allMean : 0.0;
    } catch (MelderError) {
        Melder_clearError();
        return 0.0;
    }
}

int praat_bridge_cpp_get_info(int cpp_id, double* out_info) {
    if (!out_info) return 0;
    Thing obj = get_object(cpp_id);
    if (!obj || !Thing_isa(obj, classCPP)) return 0;
    CPP cpp = (CPP)obj;

    out_info[0] = cpp->xmin;
    out_info[1] = cpp->xmax;
    out_info[2] = (double)cpp->nx;
    out_info[3] = cpp->dx;
    out_info[4] = cpp->x1;
    return 1;
}

int praat_bridge_cpp_get_frames(int cpp_id, double* out_values) {
    if (!out_values) return 0;
    Thing obj = get_object(cpp_id);
    if (!obj || !Thing_isa(obj, classCPP)) return 0;
    CPP cpp = (CPP)obj;

    for (integer i = 1; i <= cpp->nx; ++i) {
        out_values[i - 1] = cpp->z[1][i];
    }
    return 1;
}

// ============================================================================
// Phase 7 Advanced DSP: KlattGrid Speech Synthesis (dwtools)
// ============================================================================

int praat_bridge_create_klattgrid_from_vowel(
    const char* name,
    double duration,
    double f0_start,
    double f1,
    double b1,
    double f2,
    double b2,
    double f3,
    double b3,
    double f4
) {
    if (duration <= 0.0) duration = 0.4;
    if (f0_start <= 0.0) f0_start = 125.0;
    if (f1 <= 0.0) f1 = 800.0;
    if (b1 <= 0.0) b1 = 50.0;
    if (f2 <= 0.0) f2 = 1200.0;
    if (b2 <= 0.0) b2 = 50.0;
    if (f3 <= 0.0) f3 = 2300.0;
    if (b3 <= 0.0) b3 = 100.0;
    if (f4 <= 0.0) f4 = 2800.0;

    try {
        autoKlattGrid kg = KlattGrid_createFromVowel(
            duration, f0_start, f1, b1, f2, b2, f3, b3, f4, 0.05, 1000.0
        );
        if (!kg) return 0;

        if (name && name[0] != '\0') {
            Thing_setName(kg.get(), Melder_8to32_e(name).get());
        } else {
            Thing_setName(kg.get(), U"a");
        }

        int id = allocate_id();
        g_objectTable[id] = kg.move();
        return id;
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

int praat_bridge_sound_to_klattgrid(
    int sound_id,
    double time_step,
    int n_formants,
    double max_formant,
    double window_length,
    double pitch_floor,
    double pitch_ceiling
) {
    Thing obj = get_object(sound_id);
    if (!obj || !Thing_isa(obj, classSound)) return 0;
    Sound sound = (Sound)obj;

    if (time_step <= 0.0) time_step = 0.005;
    if (n_formants <= 0) n_formants = 5;
    if (max_formant <= 0.0) max_formant = 5500.0;
    if (window_length <= 0.0) window_length = 0.025;
    if (pitch_floor <= 0.0) pitch_floor = 75.0;
    if (pitch_ceiling <= pitch_floor) pitch_ceiling = 600.0;

    try {
        autoKlattGrid kg = Sound_to_KlattGrid_simple(
            sound,
            time_step,
            n_formants,
            max_formant,
            window_length,
            50.0,
            pitch_floor,
            pitch_ceiling,
            pitch_floor,
            true
        );
        if (!kg) return 0;

        Thing_setName(kg.get(), Melder_cat(Thing_getName(sound), U"_klatt"));
        int id = allocate_id();
        g_objectTable[id] = kg.move();
        return id;
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

int praat_bridge_klattgrid_to_sound(int klattgrid_id) {
    Thing obj = get_object(klattgrid_id);
    if (!obj || !Thing_isa(obj, classKlattGrid)) return 0;
    KlattGrid kg = (KlattGrid)obj;

    try {
        autoSound sound = KlattGrid_to_Sound(kg);
        if (!sound) return 0;

        Thing_setName(sound.get(), Melder_cat(Thing_getName(kg), U"_synth"));
        int id = allocate_id();
        g_objectTable[id] = sound.move();
        return id;
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

// ============================================================================
// Phase 7 Advanced DSP: LPC & MFCC (LPC / dwtools)
// ============================================================================

int praat_bridge_sound_to_lpc_burg(
    int sound_id,
    int prediction_order,
    double window_length,
    double time_step,
    double pre_emphasis
) {
    Thing obj = get_object(sound_id);
    if (!obj || !Thing_isa(obj, classSound)) return 0;
    Sound sound = (Sound)obj;

    if (prediction_order <= 0) prediction_order = 16;
    if (window_length <= 0.0) window_length = 0.025;
    if (time_step <= 0.0) time_step = 0.005;
    if (pre_emphasis < 0.0) pre_emphasis = 50.0;

    try {
        autoLPC lpc = Sound_to_LPC_burg(sound, prediction_order, window_length, time_step, pre_emphasis);
        if (!lpc) return 0;

        Thing_setName(lpc.get(), Melder_cat(Thing_getName(sound), U"_lpc"));
        int id = allocate_id();
        g_objectTable[id] = lpc.move();
        return id;
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

int praat_bridge_lpc_to_formant(int lpc_id) {
    Thing obj = get_object(lpc_id);
    if (!obj || !Thing_isa(obj, classLPC)) return 0;
    LPC lpc = (LPC)obj;

    try {
        autoFormant formant = LPC_to_Formant(lpc, 50.0);
        if (!formant) return 0;

        Thing_setName(formant.get(), Melder_cat(Thing_getName(lpc), U"_formant"));
        int id = allocate_id();
        g_objectTable[id] = formant.move();
        return id;
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

int praat_bridge_sound_to_mfcc(
    int sound_id,
    int num_coefficients,
    double window_length,
    double time_step,
    double f1_mel,
    double fmax_mel,
    double df_mel
) {
    Thing obj = get_object(sound_id);
    if (!obj || !Thing_isa(obj, classSound)) return 0;
    Sound sound = (Sound)obj;

    if (num_coefficients <= 0) num_coefficients = 12;
    if (window_length <= 0.0) window_length = 0.015;
    if (time_step <= 0.0) time_step = 0.005;
    if (f1_mel <= 0.0) f1_mel = 100.0;
    if (df_mel <= 0.0) df_mel = 100.0;
    if (fmax_mel < 0.0) fmax_mel = 0.0;

    try {
        autoMFCC mfcc = Sound_to_MFCC(sound, num_coefficients, window_length, time_step, f1_mel, fmax_mel, df_mel);
        if (!mfcc) return 0;

        Thing_setName(mfcc.get(), Melder_cat(Thing_getName(sound), U"_mfcc"));
        int id = allocate_id();
        g_objectTable[id] = mfcc.move();
        return id;
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

int praat_bridge_mfcc_get_info(int mfcc_id, double* out_info) {
    if (!out_info) return 0;
    Thing obj = get_object(mfcc_id);
    if (!obj || !Thing_isa(obj, classMFCC)) return 0;
    MFCC mfcc = (MFCC)obj;

    out_info[0] = mfcc->xmin;
    out_info[1] = mfcc->xmax;
    out_info[2] = (double)mfcc->nx;
    out_info[3] = mfcc->dx;
    out_info[4] = mfcc->x1;
    out_info[5] = (double)CC_getMaximumNumberOfCoefficientsUsed((CC)mfcc);
    return 1;
}

// ============================================================================
// Phase 7 Advanced DSP: Articulatory Synthesis (artsynth)
// ============================================================================

int praat_bridge_create_speaker(const char* name, const char* kind_of_speaker, int num_vocal_cord_masses) {
    try {
        autostring32 kind32 = Melder_8to32_e(kind_of_speaker && kind_of_speaker[0] ? kind_of_speaker : "female");
        if (num_vocal_cord_masses != 1 && num_vocal_cord_masses != 2 && num_vocal_cord_masses != 10) {
            num_vocal_cord_masses = 2;
        }
        autoSpeaker speaker = Speaker_create(kind32.get(), (int16)num_vocal_cord_masses);
        if (!speaker) return 0;

        if (name && name[0] != '\0') {
            Thing_setName(speaker.get(), Melder_8to32_e(name).get());
        } else {
            Thing_setName(speaker.get(), U"speaker");
        }

        int id = allocate_id();
        g_objectTable[id] = speaker.move();
        return id;
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

int praat_bridge_create_artword(const char* name, double duration, int default_voiced) {
    if (duration <= 0.0) duration = 0.5;
    try {
        autoArtword artword = Artword_create(duration);
        if (!artword) return 0;

        if (default_voiced) {
            // Standard Praat Articulatory Synthesis tutorial phonation gesture:
            // Lungs subglottal pressure pulse + Interarytenoid glottal adduction + LevatorPalatini oral closure
            Artword_setTarget(artword.get(), kArt_muscle::LUNGS, 0.0, 0.1);
            Artword_setTarget(artword.get(), kArt_muscle::LUNGS, duration * 0.85, 0.1);
            Artword_setTarget(artword.get(), kArt_muscle::LUNGS, duration, 0.0);

            Artword_setTarget(artword.get(), kArt_muscle::INTERARYTENOID, 0.0, 0.5);
            Artword_setTarget(artword.get(), kArt_muscle::INTERARYTENOID, duration, 0.5);

            Artword_setTarget(artword.get(), kArt_muscle::LEVATOR_PALATINI, 0.0, 1.0);
            Artword_setTarget(artword.get(), kArt_muscle::LEVATOR_PALATINI, duration, 1.0);

            // Subtle jaw opening-closing syllable gesture
            Artword_setTarget(artword.get(), kArt_muscle::MASSETER, 0.0, 0.4);
            Artword_setTarget(artword.get(), kArt_muscle::MASSETER, duration * 0.4, -0.2);
            Artword_setTarget(artword.get(), kArt_muscle::MASSETER, duration, 0.2);
        }

        if (name && name[0] != '\0') {
            Thing_setName(artword.get(), Melder_8to32_e(name).get());
        } else {
            Thing_setName(artword.get(), U"hallo");
        }

        int id = allocate_id();
        g_objectTable[id] = artword.move();
        return id;
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

int praat_bridge_artword_set_target(int artword_id, int muscle, double time, double value) {
    Thing obj = get_object(artword_id);
    if (!obj || !Thing_isa(obj, classArtword)) return 0;
    Artword artword = (Artword)obj;

    if (muscle < 1 || muscle > (int)kArt_muscle::MAX) return 0;
    try {
        Artword_setTarget(artword, (kArt_muscle)muscle, time, value);
        return 1;
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

double praat_bridge_artword_get_target(int artword_id, int muscle, double time) {
    Thing obj = get_object(artword_id);
    if (!obj || !Thing_isa(obj, classArtword)) return 0.0;
    Artword artword = (Artword)obj;

    if (muscle < 1 || muscle > (int)kArt_muscle::MAX) return 0.0;
    try {
        return Artword_getTarget(artword, (kArt_muscle)muscle, time);
    } catch (MelderError) {
        Melder_clearError();
        return 0.0;
    }
}

int praat_bridge_artword_speaker_to_sound(int artword_id, int speaker_id, double sample_rate, int oversampling) {
    Thing artObj = get_object(artword_id);
    Thing spkObj = get_object(speaker_id);
    if (!artObj || !Thing_isa(artObj, classArtword)) return 0;
    if (!spkObj || !Thing_isa(spkObj, classSpeaker)) return 0;

    Artword artword = (Artword)artObj;
    Speaker speaker = (Speaker)spkObj;

    if (sample_rate <= 0.0) sample_rate = 22050.0;
    if (oversampling <= 0) oversampling = 25;

    try {
        autoSound w1, w2, w3, p1, p2, p3, v1, v2, v3;
        autoSound sound = Artword_Speaker_to_Sound(
            artword,
            speaker,
            sample_rate,
            oversampling,
            &w1, 0, &w2, 0, &w3, 0,
            &p1, 0, &p2, 0, &p3, 0,
            &v1, 0, &v2, 0, &v3, 0
        );
        if (!sound) return 0;

        Thing_setName(sound.get(), Melder_cat(Thing_getName(artword), U"_", Thing_getName(speaker)));
        int id = allocate_id();
        g_objectTable[id] = sound.move();
        return id;
    } catch (MelderError) {
        Melder_clearError();
        return 0;
    }
}

}
