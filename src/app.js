import React, { useEffect, useMemo, useState } from 'https://esm.sh/react@18.3.1';
import { createRoot } from 'https://esm.sh/react-dom@18.3.1/client';
import htm from 'https://esm.sh/htm@3.1.1';

const html = htm.bind(React.createElement);
const MODEL = 'gemini-2.5-flash';
const FALLBACK_API_KEY = globalThis.DEFAULT_API_KEY || '';

function App() {
  const [apiKey, setApiKey] = useState(FALLBACK_API_KEY);
  const [configError, setConfigError] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('Yanıt burada görünecek.');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadApiKey = async () => {
      if (FALLBACK_API_KEY.trim()) return;

      try {
        const response = await fetch('/api/config', { cache: 'no-store' });
        const payload = await response.json();
        const runtimeKey = payload?.defaultApiKey?.trim();

        if (!response.ok || !runtimeKey) {
          throw new Error(payload?.error || 'DEFAULT_API_KEY bulunamadı.');
        }

        if (mounted) {
          setApiKey(runtimeKey);
          setConfigError('');
        }
      } catch (requestError) {
        if (mounted) {
          setConfigError(requestError.message || 'DEFAULT_API_KEY yüklenemedi.');
        }
      }
    };

    loadApiKey();

    return () => {
      mounted = false;
    };
  }, []);

  const canAsk = useMemo(() => Boolean(apiKey.trim()) && question.trim() && !loading, [apiKey, question, loading]);

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

      ${configError ? html`<p className="error">${configError}</p>` : null}
      ${error ? html`<p className="error">${error}</p>` : null}

      <section className="answer">
        <h2>Cevap</h2>
        <p>${answer}</p>
      </section>
    </main>
  `;
}

createRoot(document.getElementById('root')).render(html`<${App} />`);
