import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ModuleShell } from './layouts/ModuleShell';
import { ModulePageHeader } from './layouts/ModulePageHeader';
import { LeversDrawer } from './layouts/LeversDrawer';
import { ExplainDrawer } from './xai/ExplainDrawer';
import { UseCasesModal } from './layouts/UseCasesModal';
import { SCREENS } from './screens/registry';
import { useApp } from './state/AppState';
import './layouts/ModuleShell.css';

function Page({ id }: { id: string }) {
  const s = SCREENS.find((x) => x.id === id)!;
  const { levBusy } = useApp();
  const C = s.Component;
  useLocation();
  return (
    <>
      <ModulePageHeader group={s.group} title={s.title} subtitle={s.subtitle} />
      <div className={levBusy ? 'pulse-refresh' : ''}><C /></div>
    </>
  );
}
export default function App() {
  return (
    <HashRouter>
      <ModuleShell>
        <Routes>
          <Route path="/" element={<Navigate to="/overview" replace />} />
          {SCREENS.map((s) => <Route key={s.id} path={s.path} element={<Page id={s.id} />} />)}
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Routes>
      </ModuleShell>
      <LeversDrawer />
      <ExplainDrawer />
      <UseCasesModal />
    </HashRouter>
  );
}
