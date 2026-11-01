#include "whisper.h"
#include <cstdlib>

extern "C" {

struct whisper_context_params whisper_context_default_params(void) {
    struct whisper_context_params p = {};
    return p;
}

struct whisper_full_params whisper_full_default_params(enum whisper_sampling_strategy /*strategy*/) {
    struct whisper_full_params p = {};
    return p;
}

struct whisper_vad_context_params whisper_vad_default_context_params(void) {
    struct whisper_vad_context_params p = {};
    return p;
}

struct whisper_vad_params whisper_vad_default_params(void) {
    struct whisper_vad_params p = {};
    return p;
}

struct whisper_context * whisper_init_from_file_with_params(const char * /*path_model*/, struct whisper_context_params /*params*/) {
    return nullptr;
}

struct whisper_vad_context * whisper_vad_init_from_memory_with_params(const void * /*buffer*/, size_t /*buffer_size*/, struct whisper_vad_context_params /*params*/) {
    return nullptr;
}

void whisper_free(struct whisper_context * /*ctx*/) {}
void whisper_vad_free(struct whisper_vad_context * /*ctx*/) {}
void whisper_vad_free_segments(struct whisper_vad_segments * /*segments*/) {}

struct whisper_vad_segments * whisper_vad_segments_from_samples(struct whisper_vad_context * /*ctx*/, struct whisper_vad_params /*params*/, const float * /*samples*/, int /*n_samples*/) {
    return nullptr;
}

int whisper_vad_segments_n_segments(struct whisper_vad_segments * /*segments*/) {
    return 0;
}

float whisper_vad_segments_get_segment_t0(struct whisper_vad_segments * /*segments*/, int /*i*/) {
    return 0.0f;
}

float whisper_vad_segments_get_segment_t1(struct whisper_vad_segments * /*segments*/, int /*i*/) {
    return 0.0f;
}

int whisper_full(struct whisper_context * /*ctx*/, struct whisper_full_params /*params*/, const float * /*samples*/, int /*n_samples*/) {
    return -1;
}

int whisper_full_n_segments(struct whisper_context * /*ctx*/) {
    return 0;
}

int64_t whisper_full_get_segment_t0(struct whisper_context * /*ctx*/, int /*i_segment*/) {
    return 0;
}

int64_t whisper_full_get_segment_t1(struct whisper_context * /*ctx*/, int /*i_segment*/) {
    return 0;
}

int whisper_full_n_tokens(struct whisper_context * /*ctx*/, int /*i_segment*/) {
    return 0;
}

whisper_token_data whisper_full_get_token_data(struct whisper_context * /*ctx*/, int /*i_segment*/, int /*i_token*/) {
    whisper_token_data d = {};
    return d;
}

const char * whisper_full_get_token_text(struct whisper_context * /*ctx*/, int /*i_segment*/, int /*i_token*/) {
    return "";
}

int whisper_full_n_vad_segments(struct whisper_context * /*ctx*/) {
    return 0;
}

int64_t whisper_full_get_vad_segment_orig_start(struct whisper_context * /*ctx*/, int /*i_segment*/) {
    return 0;
}

int64_t whisper_full_get_vad_segment_orig_end(struct whisper_context * /*ctx*/, int /*i_segment*/) {
    return 0;
}

int64_t whisper_full_get_vad_segment_vad_start(struct whisper_context * /*ctx*/, int /*i_segment*/) {
    return 0;
}

int64_t whisper_full_get_vad_segment_vad_end(struct whisper_context * /*ctx*/, int /*i_segment*/) {
    return 0;
}

int whisper_is_multilingual(struct whisper_context * /*ctx*/) {
    return 0;
}

int whisper_lang_max_id(void) {
    return 0;
}

int whisper_lang_id(const char * /*lang*/) {
    return 0;
}

const char * whisper_lang_str(int /*id*/) {
    return "";
}

const char * whisper_lang_str_full(int /*id*/) {
    return "";
}

void whisper_print_timings(struct whisper_context * /*ctx*/) {}

void whisper_log_set(ggml_log_callback /*log_callback*/, void * /*user_data*/) {}

}
