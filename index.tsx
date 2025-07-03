import { useRef, useState, useEffect, ChangeEvent } from "react";
import useSpeechRecognition from "../hooks/useSpeechRecognition";
import { mapIntentToEffect } from "../utils/intentMapper";

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [uploadedBuffer, setUploadedBuffer] = useState<AudioBuffer | null>(null);
  const [isFileUploaded, setIsFileUploaded] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);


  const {
    transcript,
    isListening,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition();

  const speak = (text: string) => {
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1;

    stopListening();
    utterance.onend = () => {
      startListening();
    };

    synth.speak(utterance);
  };

  const startMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const micSource = audioContext.createMediaStreamSource(stream);
      micSource.connect(audioContext.destination);

      startListening();
      resetTranscript();
      setIsRecording(true);
      speak("Hey, how may I help you?");
    } catch (err) {
      alert("Mic access denied or not available.");
      console.error(err);
    }
  };

  const stopMic = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    audioContextRef.current?.close();
    stopListening();
    setIsRecording(false);
    speak("Okay, ending the session. See you next time!");
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setAudioFile(file);

      const arrayBuffer = await file.arrayBuffer();

      const audioCtx = new AudioContext();
      const decodedAudio = await audioCtx.decodeAudioData(arrayBuffer);

      setAudioBuffer(decodedAudio);
      audioContextRef.current = audioCtx;

      setIsFileUploaded(true); // <-- Add this line
    };


  const playWithEffect = (effect: string) => {
    const audioCtx = audioContextRef.current;
    const buffer = uploadedBuffer;

    if (!audioCtx || !buffer) return;

    const sourceNode = audioCtx.createBufferSource();
    sourceNode.buffer = buffer;
    sourceNodeRef.current = sourceNode;

    let effectNode: AudioNode | null = null;

    switch (effect) {
      case "reverb":
        const convolver = audioCtx.createConvolver();
        const impulse = audioCtx.createBuffer(2, audioCtx.sampleRate, audioCtx.sampleRate);
        for (let i = 0; i < impulse.numberOfChannels; i++) {
          const ch = impulse.getChannelData(i);
          for (let j = 0; j < ch.length; j++) {
            ch[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / ch.length, 2);
          }
        }
        convolver.buffer = impulse;
        effectNode = convolver;
        break;

      case "delay":
        const delayNode = audioCtx.createDelay();
        delayNode.delayTime.value = 0.3;
        effectNode = delayNode;
        break;

      case "lowpass":
      case "highpass":
        const filter = audioCtx.createBiquadFilter();
        filter.type = effect;
        filter.frequency.value = 800;
        effectNode = filter;
        break;

      case "gain+":
      case "gain-":
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = effect === "gain+" ? 1.5 : 0.5;
        effectNode = gainNode;
        break;

      default:
        alert("Unknown effect: " + effect);
        return;
    }

    if (effectNode) {
      sourceNode.connect(effectNode);
      effectNode.connect(audioCtx.destination);
    } else {
      sourceNode.connect(audioCtx.destination);
    }

    sourceNode.start();
  };
  const playAudio = () => {
  if (!audioBuffer || !audioContextRef.current) return;

  const source = audioContextRef.current.createBufferSource();
  source.buffer = audioBuffer;

  // Add effects here if you want: reverbNode, filterNode, etc.
  source.connect(audioContextRef.current.destination);
  source.start(0);
};


  useEffect(() => {
    if (!transcript) return;

    const effect = mapIntentToEffect(transcript);
    if (effect) {
      console.log("🎯 Detected effect:", effect);

      if (isFileUploaded) {
        playWithEffect(effect);
      } else {
        speak("Please upload an audio file first.");
        return;
      }

      speak(`Sure, applying ${effect.replace("+", " increase").replace("-", " decrease")}`);

      setTimeout(() => {
        speak("What would you like to do next?");
      }, 1000);
    } else {
      speak("Sorry, I didn't catch that effect. Can you repeat?");
    }
  }, [transcript]);

  function handleFileUpload(event: ChangeEvent<HTMLInputElement>): void {
    throw new Error("Function not implemented.");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 bg-black text-white">
      <h1 className="text-3xl font-bold">🎙️ Soundverse Voice Assistant</h1>

      <div className="flex gap-4">
        <button
          onClick={startMic}
          disabled={isRecording}
          className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded text-lg"
        >
          Talk
        </button>

        <button
          onClick={stopMic}
          disabled={!isRecording}
          className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded text-lg"
        >
          Stop
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded text-lg"
        >
          Upload Audio File
        </button>
        <input
          type="file"
          accept="audio/*"
          ref={fileInputRef}
          onChange={handleAudioUpload}
          className="hidden"
        />

        <button
          onClick={playAudio}
          className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded text-lg"
        >
          ▶️ Play Uploaded Audio
        </button>

      </div>

      {isFileUploaded && (
        <p className="text-green-400">✅ Audio file uploaded and ready!</p>
      )}

      {isRecording && (
        <>
          <p className="text-green-400">
            🎧 Listening for your commands...
          </p>
          <div className="mt-4 text-center max-w-xl">
            <p className="text-gray-400">🎤 Transcript:</p>
            <p className="text-lg font-mono text-white break-words">
              {transcript || "Say something..."}
            </p>
          </div>
        </>
      )}
    </main>
  );
}
