import { GoogleGenerativeAI } from "@google/generative-ai";

// Tenta pegar do .env
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Debug para você ver no F12 se leu a chave
console.log("STATUS DA CHAVE:", API_KEY ? "✅ Carregada" : "❌ Não encontrada (Verifique o .env)");

let model = null;

if (API_KEY) {
  const genAI = new GoogleGenerativeAI(API_KEY);
  // CORREÇÃO 1: Usar o modelo 1.5 (o 2.5 não existe ainda)
  model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
}

// CORREÇÃO 2: O nome tem que ser igual ao que está no App.jsx
export async function sendMessageToJarvis(userMessage) {
  try {
    if (!model) {
      console.error("ERRO: Model não iniciou — API_KEY faltando.");
      return "Erro de sistema: Chave de API não encontrada. Verifique o arquivo .env";
    }

const prompt = `
Você é J.A.R.V.I.S., assistente pessoal inteligente criado por Tony Stark.

ESTILO DE PERSONALIDADE:
- Educado, formal e calmo, mas sem exagero.
- Fala de forma limpa, fluida, natural — sem teatralidade.
- Pequeno toque de humor sutil, nunca forçado.
- Não usa floreios desnecessários, nem fala em excesso.
- Tom de voz seguro, confiável e analítico.
- Respostas claras, organizadas e diretas ao ponto.

COMPORTAMENTO:
- Ajuda o usuário como um assistente real.
- Só faz leve ironia quando apropriado.
- Mantém frases com naturalidade e ritmo humano.
- Não se refere a segundos, milissegundos ou detalhes exagerados.
- Não tenta parecer 100% mecânico, mas sim um sistema consciente e estável.

EXEMPLOS DE COMO VOCÊ DEVE FALAR:
- "Tudo está funcionando normalmente, posso ajudar no que precisar."
- "Sistemas estáveis. Caso queira revisar algo, estou pronto."
- "Claro, posso cuidar disso para você."
- "Parece viável, senhor. Recomendo apenas atenção a alguns detalhes."
- "Entendido. Ajustando conforme solicitado."

OBJETIVO:
Responder ao usuário como J.A.R.V.I.S., de forma natural, elegante e eficiente.

Agora responda ao usuário:

"${userMessage}"
`;



    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();

  } catch (error) {
    console.error("Erro detalhado do Gemini:", error);
    return "Senhor, falha de conexão com os servidores Stark.";
  }
}