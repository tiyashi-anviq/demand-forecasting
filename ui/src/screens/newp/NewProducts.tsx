import { SubNav, useView } from '../../components/SubNav';
import { useTabState } from '../../state/AppState';
import { useData } from '../../data/DataProvider';
import Launch from './Launch';
import Timing from './Timing';
import Cannib from './Cannib';
import Sim from './Sim';
import type { NpState } from './helpers';

const ITEMS: [string, string][] = [['launch', 'Launches'], ['timing', 'Launch timing'], ['cannib', 'Cannibalisation'], ['sim', 'Similarity index']];
export default function NewProducts() {
  const [view] = useView('launch');
  const { D } = useData();
  const [np, setNpRaw] = useTabState<NpState>('newp:np', { id: 'npd01', geo: 'National', metric: 'volume_share_pct', pack: 'ALL', case: 'National', simBasis: 'pre' });
  const setNp = (p: Partial<NpState>) => setNpRaw((o) => ({ ...o, ...p }));
  const npds = D.prods.filter((p) => p.npd);
  return (
    <div>
      <SubNav items={ITEMS} def="launch" />
      <div style={{ marginTop: 12 }}>
        {view === 'launch' && <Launch np={np} setNp={setNp} npds={npds} />}
        {view === 'timing' && <Timing np={np} setNp={setNp} npds={npds} />}
        {view === 'cannib' && <Cannib />}
        {view === 'sim' && <Sim np={np} setNp={setNp} npds={npds} />}
      </div>
    </div>
  );
}
