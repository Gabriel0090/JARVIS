from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI()

# Permitir que o React converse com o Python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/chat")
async def chat_with_jarvis(user_message: str):
    # LÓGICA DO GEMINI AQUI
    
    # Exemplo simples sem IA ainda:
    if "spotify" in user_message.lower():
        # Isso abre o Spotify no Windows
        os.system("start spotify") 
        return {"response": "Abrindo Spotify, senhor."}
    
    if "navegador" in user_message.lower():
        os.system("start chrome")
        return {"response": "Navegador iniciado."}

    return {"response": "Não entendi o comando de sistema, mas aqui está sua resposta..."}