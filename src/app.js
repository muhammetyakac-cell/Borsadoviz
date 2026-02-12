import React, { useEffect, useMemo, useState } from 'https://esm.sh/react@18.3.1';
import { createRoot } from 'https://esm.sh/react-dom@18.3.1/client';
import htm from 'https://esm.sh/htm@3.1.1';

const html = htm.bind(React.createElement);
const REFRESH_MS = 3000;

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
  { key: 'gold', label: 'Altın (XAU/USD)', yahoo: 'XAUUSD=X' },
  { key: 'silver', label: 'Gümüş (XAG/USD)', yahoo: 'XAGUSD=X' }
];

const FRANKFURTER_API = `https://api.frankfurter.dev/v1/latest?base=TRY&symbols=${CURRENCY_SYMBOLS.map((x) => x.code).join(',')}`;
const YAHOO_COMMODITY_API = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(
  COMMODITY_SYMBOLS.map((x) => x.yahoo).join(',')
)}`;
const YAHOO_COMMODITY_PROXY = `https://api.allorigins.win/raw?url=${encodeURIComponent(YAHOO_COMMODITY_API)}`;

function formatPrice(value, max = 6) {
  if (value == null || Number.isNaN(value)) return '-';
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: max
  }).format(value);
}

async function fetchCurrenciesFromFrankfurter() {
  const response = await fetch(FRANKFURTER_API, { cache: 'no-store' });
  if (!response.ok) throw new Error('Frankfurter döviz verisi alınamadı.');

  const payload = await response.json();
  const rates = payload?.rates || {};

  const usdPerTry = Number(rates.USD) || null;
  const usdTry = usdPerTry ? 1 / usdPerTry : null;

  const currencies = CURRENCY_SYMBOLS.map((item) => {
    const perTry = Number(rates[item.code]) || null;
    return {
      ...item,
      value: perTry ? 1 / perTry : null
    };
  });

  return { currencies, usdTry };
}

async function fetchCommodityPrices(usdTry) {
  const response = await fetch(YAHOO_COMMODITY_PROXY, { cache: 'no-store' });
  if (!response.ok) throw new Error('Emtia verisi alınamadı.');

  const payload = await response.json();
  const list = payload?.quoteResponse?.result;
  if (!Array.isArray(list) || !list.length) throw new Error('Emtia fiyat verisi boş geldi.');

  const bySymbol = new Map(list.map((item) => [item.symbol, item.regularMarketPrice]));

  return COMMODITY_SYMBOLS.map((item) => {
    const usd = Number(bySymbol.get(item.yahoo)) || null;
    return {
      ...item,
      usd,
      try: usd && usdTry ? usd * usdTry : null
    };
  });
}

function App() {
  const [currencies, setCurrencies] = useState(CURRENCY_SYMBOLS.map((x) => ({ ...x, value: null })));
  const [commodities, setCommodities] = useState(COMMODITY_SYMBOLS.map((x) => ({ ...x, usd: null, try: null })));
  const [status, setStatus] = useState('Bağlanıyor...');
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let timer;
    let mounted = true;

    const refresh = async () => {
      try {
        const { currencies: fxRows, usdTry } = await fetchCurrenciesFromFrankfurter();
        const commodityRows = await fetchCommodityPrices(usdTry);

        if (!mounted) return;
        setCurrencies(fxRows);
        setCommodities(commodityRows);
        setLastUpdate(new Date());
        setTick((v) => v + 1);
        setStatus('Canlı (3 sn yenileme)');
        setError('');
      } catch (requestError) {
        if (!mounted) return;
        setStatus('Bağlantı sorunu');
        setError(requestError.message || 'Veri alınırken hata oluştu.');
      }
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
        <p>20 para birimi Frankfurter API ile, altın/gümüş fiyatları ise canlı emtia kaynağından güncellenir.</p>
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
        <h2>Emtia - Altın & Gümüş</h2>
        <ul>
          ${commodities.map(
            (item) => html`
              <li key=${item.key}>
                <span>${item.label}</span>
                <strong>${formatPrice(item.usd, 4)} $ / ${formatPrice(item.try, 2)} ₺</strong>
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
              <p>${FRANKFURTER_API}</p>
              <small>Kaynak: frankfurter.dev (ECB tabanlı kur verisi).</small>
            </div>
          </li>
          <li>
            <div>
              <strong>Yahoo Finance + AllOrigins (Emtia)</strong>
              <p>${YAHOO_COMMODITY_API}</p>
              <small>Altın ve gümüş USD fiyatları alınır, USD/TRY ile TL'ye çevrilir.</small>
            </div>
          </li>
        </ul>
      </article>
    </main>
  `;
}

createRoot(document.getElementById('root')).render(html`<${App} />`);
