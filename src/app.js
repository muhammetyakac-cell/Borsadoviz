import React, { useEffect, useMemo, useState } from 'https://esm.sh/react@18.3.1';
import { createRoot } from 'https://esm.sh/react-dom@18.3.1/client';
import htm from 'https://esm.sh/htm@3.1.1';

const html = htm.bind(React.createElement);
const REFRESH_MS = 5000;

const CURRENCY_SYMBOLS = [
  { code: 'USD', label: 'USD/TRY' },
  { code: 'EUR', label: 'EUR/TRY' },
  { code: 'GBP', label: 'GBP/TRY' },
  { code: 'CHF', label: 'CHF/TRY' },
  { code: 'JPY', label: 'JPY/TRY' },
  { code: 'AUD', label: 'AUD/TRY' },
  { code: 'CAD', label: 'CAD/TRY' },
  { code: 'NZD', label: 'NZD/TRY' },
  { code: 'SEK', label: 'SEK/TRY' },
  { code: 'NOK', label: 'NOK/TRY' },
  { code: 'DKK', label: 'DKK/TRY' },
  { code: 'CNY', label: 'CNY/TRY' },
  { code: 'HKD', label: 'HKD/TRY' },
  { code: 'SGD', label: 'SGD/TRY' },
  { code: 'PLN', label: 'PLN/TRY' },
  { code: 'CZK', label: 'CZK/TRY' },
  { code: 'HUF', label: 'HUF/TRY' },
  { code: 'RON', label: 'RON/TRY' },
  { code: 'BGN', label: 'BGN/TRY' },
  { code: 'MXN', label: 'MXN/TRY' }
];

const COMMODITY_SYMBOLS = [
  { key: 'gold', label: 'Altın (Ons)', stooq: 'xauusd', yahoo: 'XAUUSD=X', unit: 'USD' },
  { key: 'silver', label: 'Gümüş (Ons)', stooq: 'xagusd', yahoo: 'XAGUSD=X', unit: 'USD' }
];

const FRANKFURTER_DIRECT = `https://api.frankfurter.dev/v1/latest?base=TRY&symbols=${CURRENCY_SYMBOLS.map((x) => x.code).join(',')}`;
const FRANKFURTER_FALLBACKS = [
  FRANKFURTER_DIRECT,
  `https://api.allorigins.win/raw?url=${encodeURIComponent(FRANKFURTER_DIRECT)}`,
  `https://api.allorigins.win/get?url=${encodeURIComponent(FRANKFURTER_DIRECT)}`
];

function formatPrice(value, max = 6) {
  if (value == null || Number.isNaN(value)) return '-';
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: max
  }).format(value);
}

async function fetchJsonWithFallback(urls) {
  let lastError = null;

  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      if (url.includes('/raw?url=')) {
        const text = await response.text();
        return JSON.parse(text);
      }

      const payload = await response.json();
      if (payload?.contents) {
        return JSON.parse(payload.contents);
      }

      return payload;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Veri alınamadı.');
}

async function fetchTextWithFallback(urls) {
  let lastError = null;

  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Metin veri alınamadı.');
}

async function fetchCurrenciesFromFrankfurter() {
  const payload = await fetchJsonWithFallback(FRANKFURTER_FALLBACKS);
  const rates = payload?.rates || {};

  const usdPerTry = Number(rates.USD) || null;
  const usdTry = usdPerTry ? 1 / usdPerTry : null;

  return {
    usdTry,
    rows: CURRENCY_SYMBOLS.map((item) => {
      const perTry = Number(rates[item.code]) || null;
      return { ...item, value: perTry ? 1 / perTry : null };
    })
  };
}

function parseStooqCsv(csvText) {
  const lines = csvText.trim().split('\n').slice(1);
  const bySymbol = new Map();

  lines.forEach((line) => {
    const columns = line.split(',').map((part) => part.replace(/^"|"$/g, '').trim());
    const [symbol, , close] = columns;
    const parsed = Number.parseFloat(close);
    if (symbol && Number.isFinite(parsed)) {
      bySymbol.set(symbol.toLowerCase(), parsed);
    }
  });

  return bySymbol;
}

async function fetchCommoditiesFromStooq(usdTry) {
  const symbols = COMMODITY_SYMBOLS.map((item) => item.stooq).join(',');
  const sourceUrl = `https://stooq.com/q/l/?s=${symbols}&f=sd2t2ohlcvn&e=csv`;
  const urls = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(sourceUrl)}`,
    `https://api.allorigins.win/get?url=${encodeURIComponent(sourceUrl)}`
  ];

  const rawData = await fetchTextWithFallback(urls);
  const normalized = rawData.startsWith('{') ? JSON.parse(rawData).contents || '' : rawData;
  const bySymbol = parseStooqCsv(normalized);

  return COMMODITY_SYMBOLS.map((item) => {
    const usd = bySymbol.get(item.stooq) ?? null;
    return { ...item, usd, try: usdTry && usd ? usdTry * usd : null };
  });
}

async function fetchCommoditiesFromYahoo(usdTry) {
  const query = COMMODITY_SYMBOLS.map((item) => item.yahoo).join(',');
  const yahooUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(query)}`;
  const urls = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(yahooUrl)}`,
    `https://api.allorigins.win/get?url=${encodeURIComponent(yahooUrl)}`
  ];

  const payload = await fetchJsonWithFallback(urls);
  const rows = payload?.quoteResponse?.result || [];
  const bySymbol = new Map(rows.map((item) => [item.symbol, Number(item.regularMarketPrice)]));

  return COMMODITY_SYMBOLS.map((item) => {
    const usd = bySymbol.get(item.yahoo) || null;
    return { ...item, usd, try: usdTry && usd ? usdTry * usd : null };
  });
}

function App() {
  const [currencies, setCurrencies] = useState(CURRENCY_SYMBOLS.map((x) => ({ ...x, value: null })));
  const [commodities, setCommodities] = useState(COMMODITY_SYMBOLS.map((x) => ({ ...x, usd: null, try: null })));
  const [commoditySource, setCommoditySource] = useState('bekleniyor');
  const [status, setStatus] = useState('Bağlanıyor...');
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let timer;
    let mounted = true;

    const refresh = async () => {
      const errors = [];
      let usdTry = null;

      try {
        const fx = await fetchCurrenciesFromFrankfurter();
        if (mounted) setCurrencies(fx.rows);
        usdTry = fx.usdTry;
      } catch (err) {
        errors.push('Frankfurter döviz verisi alınamadı.');
      }

      let commodityRows = null;
      try {
        commodityRows = await fetchCommoditiesFromStooq(usdTry);
        if (mounted) setCommoditySource('Stooq');
      } catch (err) {
        errors.push('Stooq emtia verisi alınamadı. Yahoo deneniyor.');
      }

      if (!commodityRows) {
        try {
          commodityRows = await fetchCommoditiesFromYahoo(usdTry);
          if (mounted) setCommoditySource('Yahoo');
        } catch (err) {
          errors.push('Yahoo emtia verisi alınamadı.');
        }
      }

      if (commodityRows && mounted) {
        setCommodities((prev) =>
          commodityRows.map((nextRow, idx) => ({
            ...nextRow,
            usd: nextRow.usd ?? prev[idx]?.usd ?? null,
            try: nextRow.try ?? prev[idx]?.try ?? null
          }))
        );
      }

      if (!mounted) return;
      setLastUpdate(new Date());
      setTick((v) => v + 1);
      setStatus(errors.length ? 'Kısmi veri alındı' : 'Canlı (5 sn yenileme)');
      setError(errors.join(' '));
    };

    refresh();
    timer = window.setInterval(refresh, REFRESH_MS);

    return () => {
      mounted = false;
      if (timer) window.clearInterval(timer);
    };
  }, []);

  const summary = useMemo(() => {
    if (!lastUpdate) return 'Henüz veri alınmadı';
    return `Son güncelleme: ${lastUpdate.toLocaleTimeString('tr-TR')}`;
  }, [lastUpdate]);

  return html`
    <main className="page">
      <header className="hero">
        <h1>Anlık Döviz + Emtia Takip Paneli</h1>
        <p>Dövizler Frankfurter API'den gelir; altın/gümüş için çoklu kaynak fallback uygulanır.</p>
      </header>

      <section className="statusBar">
        <span><strong>Durum:</strong> ${status}</span>
        <span><strong>${summary}</strong></span>
        <span>Tick: ${tick}</span>
      </section>

      ${error ? html`<p className="error">⚠️ ${error}</p>` : null}

      <article className="card">
        <h2>20 Para Birimi - TRY Fiyatları (Frankfurter)</h2>
        <ul>
          ${currencies.map(
            (item) => html`<li key=${item.code}><span>${item.label}</span><strong>${formatPrice(item.value, 5)} ₺</strong></li>`
          )}
        </ul>
      </article>

      <article className="card">
        <h2>Emtia - Altın & Gümüş <small>(kaynak: ${commoditySource})</small></h2>
        <ul>
          ${commodities.map(
            (item) => html`
              <li key=${item.key}>
                <span>${item.label}</span>
                <strong>${formatPrice(item.usd, 4)} ${item.unit} / ${formatPrice(item.try, 2)} ₺</strong>
              </li>
            `
          )}
        </ul>
      </article>

      <article className="card apiCard">
        <h2>Kullanılan Veri API'leri</h2>
        <ul>
          <li>
            <div>
              <strong>Frankfurter (Döviz)</strong>
              <p>${FRANKFURTER_DIRECT}</p>
              <small>Verdiğiniz API birincil kaynak olarak kullanılıyor.</small>
            </div>
          </li>
          <li>
            <div>
              <strong>Emtia Fallback</strong>
              <p>Stooq CSV + Yahoo Quote (AllOrigins proxy üzerinden)</p>
              <small>Altın/gümüşte veri boş gelirse otomatik kaynak değiştirir.</small>
            </div>
          </li>
        </ul>
      </article>
    </main>
  `;
}

createRoot(document.getElementById('root')).render(html`<${App} />`);
