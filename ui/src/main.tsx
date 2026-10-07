import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GlobalTheme } from '@carbon/react';
import '@carbon/styles/css/styles.css';
import './design/tokens.css';
import './design/global.css';
import App from './App';
import { AppStateProvider, useApp } from './state/AppState';
import { DataProvider } from './data/DataProvider';
import { TipProvider } from './components/Tip';

const qc = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } });
function Themed({ children }: { children: React.ReactNode }) {
  const { theme } = useApp();
  return <GlobalTheme theme={theme === 'dark' ? 'g100' : 'white'}>{children}</GlobalTheme>;
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <AppStateProvider>
        <Themed>
          <DataProvider>
            <TipProvider><App /></TipProvider>
          </DataProvider>
        </Themed>
      </AppStateProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
