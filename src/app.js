import React, { useMemo, useState } from 'https://esm.sh/react@18.3.1';
import { createRoot } from 'https://esm.sh/react-dom@18.3.1/client';
import htm from 'https://esm.sh/htm@3.1.1';

const html = htm.bind(React.createElement);
const STORAGE_KEY = 'gemini-watch-api-key';
const MODEL = 'gemini-2.5-flash';
const DEFAULT_API_KEY = globalThis.DEFAULT_API_KEY || '';

function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(STORAGE_KEY) || DEFAULT_API_KEY);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('Yanıt burada görünecek.');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canAsk = useMemo(() => apiKey.trim() && question.trim() && !loading, [apiKey, question, loading]);

  const saveKey = (value) => {
    setApiKey(value);
    localStorage.setItem(STORAGE_KEY, value);
  };

  const askGemini = async (event) => {
    event.preventDefault();
    const safeQuestion = question.trim();
    const safeKey = apiKey.trim();

    if (!safeKey || !safeQuestion || loading) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(safeKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: safeQuestion }] }],
            generationConfig: {
              temperature: 0.5,
              maxOutputTokens: 1024
            }
          })
        }
      );

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error?.message || 'Gemini isteği başarısız oldu.');
      }

      const text =
        payload?.candidates?.[0]?.content?.parts
          ?.map((part) => part.text)
          .filter(Boolean)
          .join('\n') || 'Boş yanıt geldi.';

      setAnswer(text);
    } catch (requestError) {
      setError(requestError.message || 'Beklenmeyen bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return html`
    <main className="watch-shell">
      <h1>Gemini Mini</h1>

      <form className="watch-form" onSubmit=${askGemini}>
        <label>
          API Key
          <input
            type="password"
            value=${apiKey}
            onInput=${(e) => saveKey(e.target.value)}
            placeholder="AIza..."
            autoComplete="off"
          />
        </label>

        <label>
          Sorun
          <textarea
            rows="4"
            value=${question}
            onInput=${(e) => setQuestion(e.target.value)}
            placeholder="Kısa bir soru yaz..."
          ></textarea>
        </label>

        <button type="submit" disabled=${!canAsk}>${loading ? 'Soruluyor...' : 'Gönder'}</button>
      </form>

      ${error ? html`<p className="error">${error}</p>` : null}

      <section className="answer">
        <h2>Cevap</h2>
        <p>${answer}</p>
      </section>
    </main>
  `;
}

createRoot(document.getElementById('root')).render(html`<${App} />`);
