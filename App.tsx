
import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Sparkles, 
  Info, 
  ExternalLink,
  Users,
  CheckCircle2,
  Clock,
  User
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

// --- SOZLAMALAR ---
// Google Script URL manzilini bu yerga qo'ying (Deploy qilganingizdan so'ng)
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzquRFIbUZoLCVf2JUVFDCQkUSl42pscQbgMMllDzFrSf5ZNlYAheVpVEkBykNHafV8/exec"; 

const TELEGRAM_BOT_TOKEN = "7344852995:AAGSUcQkkkK5h0hiYvTryd4aBhtDukqF1FQ"; 
const TELEGRAM_CHAT_ID = "-1001848996738"; 

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      setUserData(tg.initDataUnsafe?.user);
      
      const firstName = tg.initDataUnsafe?.user?.first_name || "do'stim";
      setMessages([
        {
          role: 'assistant',
          content: `Assalomu alaykum, ${firstName}! 😊\n\nBritaniyaga 2026-yilda ishlashga ketish bo'yicha savollaringiz bormi? Marhamat yozing, men eng dolzarb ma'lumotlarni qisqa va aniq beraman.`,
          timestamp: new Date()
        }
      ]);
    } else {
      setMessages([
        {
          role: 'assistant',
          content: "Assalomu alaykum! Britaniyaga 2026-yilda ishlashga ketish bo'yicha eng so'nggi va aniq ma'lumotlarni beraman. Savolingiz bormi? 😊",
          timestamp: new Date()
        }
      ]);
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const postToBackend = async (question: string, answer: string) => {
    const payload = {
      question,
      answer,
      userName: userData?.first_name || 'Web User',
      userId: userData?.id || 'N/A',
      userUsername: userData?.username || ''
    };

    // Agar Google Script URL bo'lsa, ma'lumotni unga yuboramiz
    if (GOOGLE_SCRIPT_URL) {
      try {
        await fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors', // Apps Script CORS bilan muammosi bor, no-cors ishlatamiz
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        return;
      } catch (e) {
        console.error("Backend xatosi:", e);
      }
    }

    // Agar URL bo'lmasa yoki xato bo'lsa, to'g'ridan-to'g'ri Telegram API ishlatiladi
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      const userIdentifier = userData 
        ? `👤 *User:* ${userData.first_name}${userData.username ? ` (@${userData.username})` : ''} (ID: ${userData.id})`
        : '👤 *User:* Web foydalanuvchisi';

      const text = `📬 *Yangi Savol-Javob (2026 Season)*\n\n${userIdentifier}\n\n❓ *Savol:* ${question}\n\n✅ *Javob:* ${answer}\n\n🚀 [Mavsumiy Ishchilar AI](https://t.me/Mavsumiy_Ishchilar)`;
      
      try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: text,
            parse_mode: 'Markdown'
          })
        });
      } catch (e) {
        console.error("Telegram xatosi:", e);
      }
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setInput("");
    setMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: new Date() }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        config: {
          systemInstruction: `Siz 2026-yil holatiga ko'ra Buyuk Britaniya 'Seasonal Worker Scheme' bo'yicha bosh ekspertsiz. 
Sizga O'zbekistonlik ishchilar Telegram Web App orqali murojaat qilmoqda.

USLUB:
1. LAKONIK: Javoblar o'ta qisqa va aniq bo'lsin.
2. GAPLASHUV USLUBI: Oddiy xalq tilida, Telegram chatidagi kabi.
3. 2026 AKTUAL: Ma'lumotlar 2026-yilga mos bo'lishi shart.

RASMIY OPERATORLAR: Agri-HR, Concordia, Fruitful Jobs, Pro-Force, HOPS, RE People.
DIQQAT: Boshqalari firibgar!`,
        },
        contents: userMessage,
      });

      const aiResponseText = response.text || "Xatolik bo'ldi, qaytadan yozing.";
      setMessages(prev => [...prev, { role: 'assistant', content: aiResponseText, timestamp: new Date() }]);
      
      postToBackend(userMessage, aiResponseText);
      (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium');
      
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Internet aloqasini tekshiring.", timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-white overflow-hidden">
      <header className="p-4 bg-[#2D6A4F] text-white flex items-center justify-between shadow-lg z-10">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-xl">
            <Sparkles size={20} className="text-emerald-200" />
          </div>
          <div>
            <h1 className="font-bold text-base leading-tight">UK 2026 AI</h1>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
              <span className="text-[9px] text-emerald-100 font-bold uppercase tracking-widest">Onlayn</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
           {userData && (
             <div className="flex items-center gap-2 bg-black/10 px-2 py-1 rounded-lg">
                <span className="text-[10px] font-bold max-w-[80px] truncate">{userData.first_name}</span>
             </div>
           )}
           <a href="https://t.me/Mavsumiy_Ishchilar" target="_blank" className="p-2 bg-white/20 rounded-lg">
             <ExternalLink size={16} />
           </a>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F0F2F5]">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] rounded-[20px] p-3 shadow-sm ${
              msg.role === 'user' ? 'bg-[#2D6A4F] text-white rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none'
            }`}>
              <div className="text-sm leading-relaxed whitespace-pre-wrap font-medium">{msg.content}</div>
              <div className={`text-[8px] mt-1 flex items-center gap-1 ${msg.role === 'user' ? 'text-emerald-100 justify-end' : 'text-slate-400'}`}>
                <Clock size={8} />
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white rounded-[20px] p-3 shadow-sm flex gap-1">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce delay-75"></div>
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce delay-150"></div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="p-3 bg-white border-t border-slate-100 pb-safe">
        <div className="flex items-end gap-2 bg-slate-100 p-1.5 rounded-[24px]">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
            placeholder="Savol yozing..."
            className="flex-1 bg-transparent border-none outline-none px-3 py-2 text-sm resize-none max-h-32 min-h-[40px]"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="p-2.5 bg-[#2D6A4F] text-white rounded-full disabled:opacity-50"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
