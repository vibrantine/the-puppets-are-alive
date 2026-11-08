// Copies microphone samples off the audio thread in small batches. It produces
// silence at its output: microphone sound must never be played through speakers.
// AudienceInput owns detection, recording lifetime and network requests.
class MicrophoneCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(2048);
    this.offset = 0;
  }
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel) {
      for (const sample of channel) {
        this.buffer[this.offset++] = sample;
        if (this.offset === this.buffer.length) {
          this.port.postMessage(this.buffer, [this.buffer.buffer]);
          this.buffer = new Float32Array(2048);
          this.offset = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('microphone-capture', MicrophoneCapture);
