import React, { useEffect, useState, useRef } from 'react';
import './App.css';

function App() {
  const [stats, setStats] = useState({ cpu: 0, ram: 0, disk: 0, battery: 100 });
  const [jarvisResponse, setJarvisResponse] = useState("INICIALIZANDO SISTEMAS...");
  
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const recognitionRef = useRef(null);
  const terminalBodyRef = useRef(null);

  const GATILHOS = ["jarvis", "ei jarvis", "olá jarvis", "oi jarvis"];

  // 🔥 ---- FUNÇÃO AGORA ESTÁ ACIMA DAS CHAMADAS ----
  const startContinuousListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = true;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        setJarvisResponse("SISTEMA ONLINE. ESCUTA ATIVA.");
      };

      recognition.onerror = (event) => {
        if (event.error === 'not-allowed') {
          setJarvisResponse("ERRO: PERMISSÃO DE MICROFONE NEGADA PELA PÁGINA.");
        }
      };

      recognition.onresult = (event) => {
        const current = event.resultIndex;
        const transcript = event.results[current][0].transcript.toLowerCase().trim();
        console.log("Escutou:", transcript);

        const gatilho = GATILHOS.find(g => transcript.includes(g));

        if (gatilho) {
          let comando = transcript.replace(gatilho, "").trim();
          if (!comando) comando = "Olá";
          setJarvisResponse(prev => prev + "\n> COMANDO: " + comando.toUpperCase());
          processarComando(comando);
        }
      };

      recognition.onend = () => {
        recognition.start();
      };

      recognitionRef.current = recognition;
      recognition.start();

    } catch (e) {
      console.error("Erro ao iniciar voz:", e);
    }
  };

  const processarComando = async (text) => {
    try {
      if (recognitionRef.current) recognitionRef.current.stop();

      const response = await fetch('http://localhost:8000', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text })
      });
      
      const data = await response.json();
      falarResposta(data.response);
      setJarvisResponse(prev => prev + "\nJARVIS: " + data.response);

    } catch {
      setJarvisResponse(prev => prev + "\nERRO DE CONEXÃO.");
      recognitionRef.current.start();
    }
  };

  const falarResposta = (texto) => {
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = "pt-BR";
    utterance.rate = 1.1; 
    
    utterance.onstart = () => setIsSpeaking(true);
    
    utterance.onend = () => {
      setIsSpeaking(false);
      if (recognitionRef.current) recognitionRef.current.start(); 
    };

    window.speechSynthesis.speak(utterance);
  };

  // 🔥 AUTO-ROLAR CONSOLE
  useEffect(() => {
    if (terminalBodyRef.current) {
      terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
    }
  }, [jarvisResponse]);

  // 🔥 BUSCAR STATUS DO SISTEMA
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/system-status');
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error("Erro ao buscar status do sistema:", error);
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 2000);
    return () => clearInterval(interval);
  }, []);

  // 🔥 INICIAR JARVIS AUTOMATICAMENTE
  useEffect(() => {
    setTimeout(() => {
      startContinuousListening();
    }, 1000);
  }, []);

  return (
    <div className="hud-container">
      <div className="tech-background"></div>

      <div className="arc-reactor">
        <div className={`core-circle ${isSpeaking ? 'speaking' : ''} ${!isListening ? 'offline' : ''}`}>
           <div className="core-inner-glow"></div>
        </div>
        <div className={`core-ring ${isSpeaking ? 'ring-fast' : ''}`}></div>
        <div className="core-outer-ring"></div>
      </div>

      <div className="data-panel left-panel">
        <PanelItem label="CPU CORE" value={stats.cpu} />
        <PanelItem label="RAM MEMORY" value={stats.ram} />
      </div>

      <div className="data-panel right-panel">
        <PanelItem label="DISK SPACE" value={stats.disk} />
        <PanelItem label="BATTERY" value={stats.battery} isBattery={true} />
      </div>

      <div className="chat-console">
        <div className="terminal-header">JARVIS SYSTEM LOG // {isListening ? "ONLINE" : "BOOTING..."}</div>
        <div className="terminal-body" ref={terminalBodyRef}>
          <pre>{jarvisResponse}</pre>
        </div>
        <div className="status-line">
            {isListening ? (isSpeaking ? "PROCESSANDO RESPOSTA..." : "ESCUTA ATIVA - AGUARDANDO COMANDO") : "INICIALIZANDO DRIVERS DE ÁUDIO..."}
        </div>
      </div>

      <div className="overlay-scanlines"></div>
      <div className="overlay-vignette"></div>
    </div>
  );
}

function PanelItem({ label, value, isBattery }) {
  let barColor = 'var(--jarvis-cyan)';
  if (value > 90 && !isBattery) barColor = '#ff3333'; 
  if (value < 20 && isBattery) barColor = '#ff3333'; 

  return (
    <div className="data-row">
      <div className="data-header">
        <span className="label">{label}</span>
        <span className="value">{value}%</span>
      </div>
      <div className="bar-container">
        <div className="bar-fill" style={{ width: `${value}%`, backgroundColor: barColor, boxShadow: `0 0 10px ${barColor}` }}></div>
      </div>
    </div>
  );
}

export default App;
