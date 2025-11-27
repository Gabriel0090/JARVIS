import React, { useRef, useEffect, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { FilesetResolver, HandLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import './App.css';
import { sendMessageToJarvis } from "./services/gemini";

// URL do Holograma
const HOLOGRAM_URL = "https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Earth_Western_Hemisphere_transparent_background.png/600px-Earth_Western_Hemisphere_transparent_background.png";

function App() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);

  // Estados Visuais
  const [handLandmarker, setHandLandmarker] = useState(null);
  const [hologramImg, setHologramImg] = useState(null);
  const [systemStatus, setSystemStatus] = useState("SISTEMA ONLINE");

  // Estados de Voz e IA
  const [jarvisResponse, setJarvisResponse] = useState("Aguardando ativação...");
  const [isListening, setIsListening] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(null);

  // Gatilho de callback
  const [shouldStartListening, setShouldStartListening] = useState(false);

  // --- 1. CONFIGURAÇÃO DE VOZ ---
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      const bestVoice = voices.find(v =>
        (v.name.includes("Google") || v.name.includes("Microsoft")) &&
        v.lang.includes("pt-BR")
      );
      if (bestVoice) setSelectedVoice(bestVoice);
    };

    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();

    // Carrega imagem
    const img = new Image();
    img.src = HOLOGRAM_URL;
    img.onload = () => setHologramImg(img);
  }, []);

  // --- 2. FUNÇÃO DE FALA (MEMORIZADA) ---
  const speak = useCallback((text) => {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.2;

    if (selectedVoice) utterance.voice = selectedVoice;

    utterance.onend = () => {
      setSystemStatus("AGUARDANDO RÉPLICA...");
      setTimeout(() => setShouldStartListening(true), 300);
    };

    window.speechSynthesis.speak(utterance);
  }, [selectedVoice]);

  // --- 3. FUNÇÃO DE ESCUTA ---
const startListening = useCallback(() => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return;

  const recognition = new SpeechRecognition();
  recognition.lang = 'pt-BR';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  // <<< RESET DO TRIGGER AQUI! (evita warning)
  setShouldStartListening(false);

  setIsListening(true);
  setSystemStatus("🎤 OUVINDO...");

  recognition.onresult = async (event) => {
    const text = event.results[0][0].transcript;

    setSystemStatus("PROCESSANDO...");
    setIsListening(false);

    const resposta = await sendMessageToJarvis(text);

    setJarvisResponse(resposta);
    setSystemStatus("RESPONDENDO...");

    speak(resposta);
  };

  recognition.onerror = () => {
    setIsListening(false);
    setSystemStatus("SISTEMA ONLINE (STANDBY)");
  };

try {
  recognition.start();
} catch (e) {
  console.warn("Erro ao iniciar reconhecimento de voz:", e);
}

}, [speak]);


  // --- 4. TRIGGER DO MICROFONE ---
useEffect(() => {
  if (shouldStartListening) {

    // EXECUTA startListening FORA do ciclo síncrono do efeito
    setTimeout(() => {
      startListening();
    }, 0);
  }
}, [shouldStartListening, startListening]);



  // --- 5. GESTO DE ATIVAÇÃO ---
  const detectActivationGesture = (landmarks) => {
    const p9 = landmarks[9];
    const p0 = landmarks[0];
    const dist = Math.sqrt(Math.pow(p9.x - p0.x, 2) + Math.pow(p9.y - p0.y, 2));
    return dist > 0.15;
  };

  // --- 6. LOOP DE DETECÇÃO ---
  useEffect(() => {
    let animationFrameId;
    let gestureCooldown = false;

    const renderLoop = () => {
      if (
        handLandmarker &&
        webcamRef.current &&
        webcamRef.current.video &&
        webcamRef.current.video.readyState === 4
      ) {
        const video = webcamRef.current.video;
        const startTimeMs = performance.now();
        const result = handLandmarker.detectForVideo(video, startTimeMs);

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        if (result.landmarks && result.landmarks.length > 0) {
          const landmarks = result.landmarks[0];
          const utils = new DrawingUtils(ctx);

          utils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
            color: "#00f3ff",
            lineWidth: 2
          });

          utils.drawLandmarks(landmarks, {
            color: "white",
            lineWidth: 1,
            radius: 3
          });

          if (hologramImg) {
            const p9 = landmarks[9];
            const p0 = landmarks[0];
            const size = Math.sqrt(
              Math.pow((p9.x - p0.x) * ctx.canvas.width, 2) +
              Math.pow((p9.y - p0.y) * ctx.canvas.height, 2)
            ) * 3.5;

            ctx.drawImage(
              hologramImg,
              p9.x * ctx.canvas.width - size / 2,
              p9.y * ctx.canvas.height - size / 2 - 50,
              size,
              size
            );
          }

          const isHandOpen = detectActivationGesture(landmarks);
          if (isHandOpen && !isListening && !gestureCooldown && systemStatus.includes("STANDBY")) {
            gestureCooldown = true;
            setShouldStartListening(true);
            setTimeout(() => gestureCooldown = false, 3000);
          }
        }
      }

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    if (handLandmarker) renderLoop();

    return () => cancelAnimationFrame(animationFrameId);
  }, [handLandmarker, hologramImg, isListening, systemStatus]);

  // --- 7. CARREGAR MODELO ---
  useEffect(() => {
    const startMediaPipe = async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      const landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 1
      });

      setHandLandmarker(landmarker);
      setSystemStatus("SISTEMA ONLINE (STANDBY)");
    };

    startMediaPipe();
  }, []);

  return (
    <div className="container">

      <div className="ui-layer">
        <div className="status-text"
          style={{
            color: isListening ? '#ff3333' : '#00f3ff',
            textShadow: isListening ? '0 0 10px red' : 'none'
          }}>
          {systemStatus}
        </div>
      </div>

      <div className="chat-interface">
        <div className="jarvis-output">
          <span className="label">J.A.R.V.I.S.</span>
          <p>{jarvisResponse}</p>
        </div>

        <div className="input-area" style={{ justifyContent: 'center' }}>
          <button
            onClick={() => setShouldStartListening(true)}
            style={{
              borderRadius: '50%',
              width: '60px',
              height: '60px',
              background: isListening ? 'red' : 'var(--jarvis-blue)',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              boxShadow: isListening ? '0 0 20px red' : '0 0 15px var(--jarvis-blue)',
              transition: '0.3s'
            }}
          >
            {isListening ? '👂' : '🎙️'}
          </button>
        </div>

        <p style={{ textAlign: 'center', fontSize: '10px', marginTop: '5px', opacity: 0.7 }}>
          FALE "OLÁ JARVIS" OU LEVANTE A MÃO
        </p>
      </div>

      <Webcam ref={webcamRef} className="webcam-feed" mirrored={false} />
      <canvas ref={canvasRef} className="overlay-canvas" />
    </div>
  );
}

export default App;
