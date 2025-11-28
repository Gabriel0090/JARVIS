import os
import json
import psutil
import webbrowser
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import google.generativeai as genai

# --- NOVIDADE: Importar AppOpener ---
from AppOpener import open as open_app

# 1. Carregar configurações
load_dotenv()
API_KEY = os.getenv("VITE_GEMINI_API_KEY")

if not API_KEY:
    print("ERRO: Chave API não encontrada no arquivo .env")

genai.configure(api_key=API_KEY)

generation_config = {
  "temperature": 0.7,
  "top_p": 1,
  "top_k": 1,
  "max_output_tokens": 2048,
}

model = genai.GenerativeModel(model_name="gemini-2.5-flash", generation_config=generation_config)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 2. SISTEMA DE MEMÓRIA ---
CEREBRO_FILE = "cerebro.json"

def carregar_memoria():
    try:
        with open(CEREBRO_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {"nome_usuario": "Senhor", "preferencias": {}, "lembretes": []}

def salvar_memoria(dados):
    with open(CEREBRO_FILE, "w", encoding="utf-8") as f:
        json.dump(dados, f, indent=4)

historico_conversa = []

# --- 3. FERRAMENTAS DO SISTEMA (ATUALIZADO) ---
def executar_comando(comando_json):
    acao = comando_json.get("acao")
    parametro = comando_json.get("parametro")

    if acao == "abrir_site":
        webbrowser.open(parametro)
        return f"Abrindo {parametro} no navegador."
    
    # --- AQUI ESTÁ A MÁGICA DO APPOPENER ---
    elif acao == "abrir_programa":
        try:
            print(f"Tentando abrir: {parametro}")
            # match_closest=True faz ele abrir o 'Google Chrome' mesmo se você disser só 'Chrome'
            open_app(parametro, match_closest=True, throw_error=True)
            return f"Iniciando {parametro}, senhor."
        except Exception as e:
            # Se não achar, ele avisa
            return f"Não consegui encontrar o programa {parametro} instalado."
            
    elif acao == "sistema":
        if "desligar" in parametro:
            # os.system("shutdown /s /t 10") 
            return "Protocolo de desligamento iniciado (Simulação)."
    
    elif acao == "memorizar":
        memoria = carregar_memoria()
        memoria["lembretes"].append(parametro)
        salvar_memoria(memoria)
        return "Informação salva na memória."

    return "Comando não reconhecido."

# --- 4. INTELIGÊNCIA ARTIFICIAL ---
@app.post("/chat")
async def chat_endpoint(data: dict):
    user_message = data.get("message", "")
    memoria = carregar_memoria()

    # Atualizei o prompt para instruir o Gemini a mandar apenas o nome limpo do app
    sistema_prompt = f"""
    Você é J.A.R.V.I.S., assistente de {memoria['nome_usuario']}.
    
    MEMÓRIA: {memoria['lembretes']}
    
    CAPACIDADES (TOOLS):
    Responda APENAS um JSON no formato: {{"acao": "nome_acao", "parametro": "valor"}} se for um comando.
    
    1. "abrir_site" (parametro: url completa)
    2. "abrir_programa" (parametro: APENAS O NOME DO PROGRAMA) 
       Ex: Se pedirem "abre o discord", parametro deve ser "discord". 
       Se pedirem "abre o gta", parametro deve ser "grand theft auto".
    3. "memorizar" (parametro: info a salvar)
    
    Se não for comando, responda texto normal curto e prestativo.
    """

    # Mantendo histórico curto simplificado
    try:
        chat = model.start_chat(history=[]) # Histórico limpo por requisição para evitar loops no json
        response = chat.send_message(f"{sistema_prompt}\n\nUsuário: {user_message}")
        resposta_texto = response.text.strip()

        # Tenta detectar JSON (muitas vezes vem dentro de blocos ```json ... ```)
        # Vamos limpar caso o Gemini mande markdown
        texto_limpo = resposta_texto.replace("```json", "").replace("```", "").strip()

        if texto_limpo.startswith("{") and "acao" in texto_limpo:
            try:
                comando = json.loads(texto_limpo)
                resultado = executar_comando(comando)
                return {"response": resultado}
            except json.JSONDecodeError:
                pass 

        return {"response": resposta_texto}

    except Exception as e:
        print(f"Erro: {e}")
        return {"response": "Erro nos sistemas."}

@app.get("/system-status")
async def get_system_status():
    return {
        "cpu": psutil.cpu_percent(),
        "ram": psutil.virtual_memory().percent,
        "disk": psutil.disk_usage('/').percent,
        "battery": psutil.sensors_battery().percent if psutil.sensors_battery() else 100
    }