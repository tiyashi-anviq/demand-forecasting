import { Header, HeaderMenuButton, HeaderGlobalBar, HeaderGlobalAction, Tag } from '@carbon/react';
import { Light, Asleep } from '@carbon/icons-react';
import { useApp } from '../state/AppState';
import { useData } from '../data/DataProvider';
import { BUNDLED_BACKTEST_MODEL, modelLabel, useApiModels } from '../api/forecastApi';
import './AppTopBar.css';

export function AppTopBar({ onMenu, menuActive }: { onMenu: () => void; menuActive: boolean }) {
  const { theme, toggleTheme, model, setModel } = useApp();
  const models = useApiModels();
  const names = (models.data || []).map((m) => m.model);
  const { source, refetching } = useData();
  return (
    <Header aria-label="Eveready Planner" className="app-topbar">
      <HeaderMenuButton aria-label="Toggle navigation" isActive={menuActive} onClick={onMenu} isCollapsible />
      <div className="app-brand">
        <svg className="app-logo" viewBox="0 0 587 161" role="img" aria-label="AnvIQ logo"><use href="#anviq-mark" /></svg>
        <span className="app-brand-name">Eveready Demand &amp; Supply Planner</span>
      </div>
      <HeaderGlobalBar>
        {names.length > 1 && (
          <label className="app-model" title="Forecast model served by the API">
            <span>Model</span>
            <select value={model} onChange={(e) => setModel(e.target.value)} aria-label="Forecast model">
              {names.map((n) => <option key={n} value={n}>{modelLabel(n)}</option>)}
            </select>
          </label>
        )}
        {names.length > 1 && source.backtestFrom && source.backtestFrom !== model && (
          <span className="app-source" title={`Forecast lines come from ${modelLabel(model)}. The accuracy, backtest and feature-importance figures in the demo are from ${modelLabel(source.backtestFrom || BUNDLED_BACKTEST_MODEL)}.`}>
            <Tag size="sm" type="red">Backtest figures: {modelLabel(source.backtestFrom || BUNDLED_BACKTEST_MODEL)}</Tag>
          </span>
        )}
        <span className={'app-source' + (refetching ? ' pulse-refresh' : '')} title={source.kind === 'live' ? `Forecast served by the API (${source.model}), history to ${source.historyEnd}` : source.kind === 'sample' ? `API not reachable (${source.error}). Showing the bundled sample forecast.` : 'Connecting to the forecast API…'}>
          <Tag size="sm" type={source.kind === 'live' ? 'green' : source.kind === 'sample' ? 'warm-gray' : 'cool-gray'}>
            {source.kind === 'live' ? `Live · ${modelLabel(source.model || '')}` : source.kind === 'sample' ? 'Sample data · API offline' : 'Connecting…'}
          </Tag>
        </span>
        <HeaderGlobalAction aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} onClick={toggleTheme}>
          {theme === 'dark' ? <Light size={20} /> : <Asleep size={20} />}
        </HeaderGlobalAction>
      </HeaderGlobalBar>
    </Header>
  );
}
