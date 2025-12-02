import React, { useEffect, useState, useRef } from 'react';
import './App.css';

function App() {
  const [stats, setStats] = useState({ cpu: 0, ram: 0, disk: 0, battery: 100 });
  const [jarvisResponse, setJarvisResponse] = useState("SISTEMA EM ESPERA...");
  
  // Novos estados para controle
  const [isInitialized, setIsInitialized] = useState(false); // Só inicia após clique
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const recognitionRef = useRef(null);
  const terminalBodyRef = useRef(null);
  
  // Controle para evitar que o mic ligue enquanto Jarvis fala
  const shouldRestartRef = useRef(false);

  const GATILHOS = ["jarvis", "ei jarvis", "olá jarvis", "oi jarvis"];

  // --- 1. CONFIGURAÇÃO DE VOZ (SPEECH SYNTHESIS) ---
  const [voices, setVoices] = useState([]);

  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
    };
    
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // --- 2. LÓGICA DO MICROFONE ---
  const initRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Seu navegador não suporta reconhecimento de voz.");
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false; // Mudei para false para controlar manualmente o reinício
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
      setJarvisResponse("SISTEMA ONLINE. ESCUTA ATIVA.");
    };

    recognition.onend = () => {
      setIsListening(false);
      // Só reinicia se a flag permitir (não estiver falando ou processando)
      if (shouldRestartRef.current) {
        try {
          recognition.start();
        } catch {
          console.log("Mic já estava ativo");
        }
      }
    };

    recognition.onerror = (event) => {
      console.error("Erro no reconhecimento:", event.error);
      if (event.error === 'not-allowed') {
        setJarvisResponse("ERRO: ACESSO AO MICROFONE NEGADO.");
      }
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.toLowerCase().trim();
      console.log("Escutou:", transcript);

      const gatilho = GATILHOS.find(g => transcript.includes(g));

      if (gatilho) {
        // Encontrou gatilho: PAUSA a escuta para não ouvir a si mesmo
        shouldRestartRef.current = false; 
        recognition.stop(); 
        
        let comando = transcript.replace(gatilho, "").trim();
        if (!comando) comando = "Olá";
        
        setJarvisResponse(prev => prev + "\n> COMANDO: " + comando.toUpperCase());
        processarComando(comando);
      } else {
        // Se falou algo sem "Jarvis", continua ouvindo
        // Isso é necessário pois mudamos continuous para false
        // Mas como onend reinicia baseada na ref, ele vai religar sozinho
      }
    };

    return recognition;
  };

  // --- 3. INICIALIZAR SISTEMA (CLIQUE OBRIGATÓRIO) ---
  const handleStartSystem = () => {
    setIsInitialized(true);
    shouldRestartRef.current = true; // Permite o loop do mic
    
    const recognition = initRecognition();
    if (recognition) {
      recognitionRef.current = recognition;
      recognition.start();
    }
  };

  const processarComando = async (text) => {
    try {
      const response = await fetch('http://localhost:8000/chat', { // Endpoint corrigido para /chat
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text })
      });
      
      const data = await response.json();
      
      // Atualiza texto e fala
      setJarvisResponse(prev => prev + "\nJARVIS: " + data.response);
      falarResposta(data.response);

    } catch (error) {
      console.error(error);
      setJarvisResponse(prev => prev + "\nERRO DE CONEXÃO.");
      // Se der erro, volta a ouvir
      shouldRestartRef.current = true;
      if (recognitionRef.current) recognitionRef.current.start();
    }
  };

  const falarResposta = (texto) => {
    // Cancela falas anteriores
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = "pt-BR";
    utterance.rate = 1.2; // Um pouco mais rápido para ficar natural
    
    // Tenta encontrar uma voz masculina em PT-BR (Google ou Microsoft)
    const vozPreferida = voices.find(v => v.lang === 'pt-BR' && (v.name.includes('Google') || v.name.includes('Microsoft Daniel')));
    if (vozPreferida) utterance.voice = vozPreferida;

    utterance.onstart = () => {
      setIsSpeaking(true);
      shouldRestartRef.current = false; // Garante que o mic não ligue
    };
    
    utterance.onend = () => {
      setIsSpeaking(false);
      // Assim que terminar de falar, reativa o mic
      shouldRestartRef.current = true;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch { 
          console.log("Mic já estava ativo");
         }
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  // Auto-scroll do terminal
  useEffect(() => {
    if (terminalBodyRef.current) {
      terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
    }
  }, [jarvisResponse]);

  // Status do Sistema
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/system-status');
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error("Erro ao buscar status do sistema:", error);}
    };
    if (isInitialized) {
        fetchStats();
        const interval = setInterval(fetchStats, 2000);
        return () => clearInterval(interval);
    }
  }, [isInitialized]);

  // --- TELA DE INÍCIO (IMPORTANTE PARA O ÁUDIO FUNCIONAR) ---
  if (!isInitialized) {
    return (
      <div className="hud-container" style={{ flexDirection: 'column', gap: '20px' }}>
        <div className="tech-background"></div>
        <h1 style={{ zIndex: 10, textShadow: '0 0 10px cyan' }}>SISTEMA J.A.R.V.I.S.</h1>
        <button 
            className="mic-button" 
            onClick={handleStartSystem}
            style={{ zIndex: 10, padding: '20px 40px', fontSize: '20px', cursor: 'pointer' }}
        >
          INICIALIZAR PROTOCOLO DE VOZ
        </button>
      </div>
    );
  }

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
        <div className="terminal-header">JARVIS SYSTEM LOG // {isListening ? "ESCUTA ATIVA" : "AGUARDANDO..."}</div>
        <div className="terminal-body" ref={terminalBodyRef}>
          <pre>{jarvisResponse}</pre>
        </div>
        <div className="status-line">
            {isSpeaking ? ">>> PROCESSANDO SÍNTESE DE VOZ..." : (isListening ? ">>> AGUARDANDO COMANDO DE VOZ..." : ">>> STANDBY")}
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