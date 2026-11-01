#include "portaudio.h"
#include <stddef.h>

static PaDeviceInfo s_dummyDeviceInfo = {
    2,
    "WebAudio Dummy Device",
    0,
    2,
    2,
    0.01,
    0.05,
    0.01,
    0.05,
    44100.0
};

static PaHostApiInfo s_dummyHostApiInfo = {
    1,
    paInDevelopment,
    "WebAudio Host API",
    1,
    0,
    0
};

static PaStreamInfo s_dummyStreamInfo = {
    1,
    0.01,
    0.01,
    44100.0
};

PaError Pa_Initialize(void) { return paNoError; }
PaError Pa_Terminate(void) { return paNoError; }
const char *Pa_GetErrorText(PaError errorCode) { (void)errorCode; return "No error"; }
PaDeviceIndex Pa_GetDeviceCount(void) { return 1; }
PaDeviceIndex Pa_GetDefaultInputDevice(void) { return 0; }
PaDeviceIndex Pa_GetDefaultOutputDevice(void) { return 0; }
const PaDeviceInfo *Pa_GetDeviceInfo(PaDeviceIndex device) { (void)device; return &s_dummyDeviceInfo; }
PaHostApiIndex Pa_GetDefaultHostApi(void) { return 0; }
const PaHostApiInfo *Pa_GetHostApiInfo(PaHostApiIndex hostApi) { (void)hostApi; return &s_dummyHostApiInfo; }

PaError Pa_OpenStream(
    PaStream** stream,
    const PaStreamParameters *inputParameters,
    const PaStreamParameters *outputParameters,
    double sampleRate,
    unsigned long framesPerBuffer,
    PaStreamFlags streamFlags,
    PaStreamCallback *streamCallback,
    void *userData
) {
    (void)inputParameters;
    (void)outputParameters;
    (void)sampleRate;
    (void)framesPerBuffer;
    (void)streamFlags;
    (void)streamCallback;
    (void)userData;
    if (stream) {
        *stream = (PaStream*)1;
    }
    return paNoError;
}

PaError Pa_CloseStream(PaStream *stream) { (void)stream; return paNoError; }
PaError Pa_StartStream(PaStream *stream) { (void)stream; return paNoError; }
PaError Pa_StopStream(PaStream *stream) { (void)stream; return paNoError; }
PaError Pa_AbortStream(PaStream *stream) { (void)stream; return paNoError; }
PaError Pa_IsStreamActive(PaStream *stream) { (void)stream; return 0; }
PaTime Pa_GetStreamTime(PaStream *stream) { (void)stream; return 0.0; }
double Pa_GetStreamCpuLoad(PaStream *stream) { (void)stream; return 0.0; }
const PaStreamInfo *Pa_GetStreamInfo(PaStream *stream) { (void)stream; return &s_dummyStreamInfo; }
void Pa_Sleep(long msec) { (void)msec; }
