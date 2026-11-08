# The Puppets are Alive (live voices)

An interactive 3D puppet mystery built in p5.js. The Producer is dead. Arthur Christie calls three suspects forward to give their alibis. Speak into your microphone to question a suspect and change the scene.

## Run on Windows

1. Install Python 3 and Node.js with support for `--use-env-proxy` (tested with Node 25.1.0).
2. Copy `.dev.vars.example` to `.dev.vars` beside the launcher. Enter your key after `OPENAI_API_KEY=` and save. An existing `OPENAI_API_KEY` environment variable takes precedence. If this edition has no `.dev.vars`, it can use the one in the adjacent `the-puppets-are-alive` folder. Only the `public/` directory is served to the browser.
3. Double-click **Start Puppet Theatre.cmd**. Click **Start show** and allow microphone access.
4. Say **“I accuse Claire.”** In the private interrogation, ask **“Claire, where were you?”** Say **“back to the lineup”** to return. **End show** releases the microphone and voice connections.

All dialogue is voiced live, including the scripted opening. A silent voice gets one retry before the caption-only fallback. Live voice, transcription and Director requests use the operator’s OpenAI account and incur charges. The stage and relay listen on loopback ports 8816 and 8817. The relay sends microphone clips for transcription and attaches the API key to server-side requests to OpenAI. Run it on a trusted local machine.

See [third-party notices](THIRD_PARTY.md).

