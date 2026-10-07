import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
/** The 19 use cases (ported from the old demo's UCS). `path` is the route; `view` is the ?view= sub-view; `anchor` an element id to scroll to. */
export interface UseCase { n: string; path: string; view?: string; title: string; desc: string; anchor?: string }
export const USE_CASES: UseCase[] = [
  { n: '1', path: '/overview', title: 'Demand outlook to Jan 2027', desc: 'LightGBM forecast to the end of the test window with adjustable what-if levers.', anchor: 'ovo' },
  { n: '2', path: '/forecast', title: 'LightGBM forecast & accuracy', desc: '13/9/4-week-ahead forecasts, backtested over 52 weeks against the sales forecast and a seasonal baseline.', anchor: 'fch' },
  { n: '3', path: '/forecast', title: 'Challenge flags', desc: 'Sales and procurement submissions that deviate from budget, last year or depot stock.', anchor: 'ffl' },
  { n: '4', path: '/forecast', title: 'Does LightGBM add value?', desc: 'Gain over the sales forecast, stability across windows, what drives the model.', anchor: 'fva' },
  { n: '5', path: '/new-products', view: 'launch', title: 'Five new product launches', desc: 'Ramp vs budget, influencer lift, launch slip.' },
  { n: '6', path: '/new-products', view: 'timing', title: 'Launch timing', desc: 'Best and worst launch month for each product.' },
  { n: '7', path: '/new-products', view: 'sim', title: 'Similarity index', desc: 'Automated 0–1 ranking of existing products as analogues, plus vaporizer vs incumbents.' },
  { n: '8', path: '/new-products', view: 'launch', title: 'Mosquito vaporizer (new product, no history)', desc: 'New-product forecast with no history: plan vs market-share build vs recalibration.' },
  { n: '9', path: '/new-products', view: 'cannib', title: 'Cannibalisation', desc: 'Internal and external volume losses.' },
  { n: '10', path: '/supply', view: 'cover', title: 'Depot stock & cover', desc: 'Weeks of cover, stock vs safety stock, low and high cover alerts.' },
  { n: '11', path: '/supply', view: 'repl', title: 'Replenishment & OTIF', desc: 'Friday/Saturday trucks, slot slips, short-shipping.' },
  { n: '12', path: '/supply', view: 'plant', title: 'Plant capacity & priority', desc: 'B2C → P1 → P2 allocation and lost sales.' },
  { n: '13', path: '/supply', view: 'trf', title: 'Depot transfers', desc: 'Stock moved from surplus to short depots.' },
  { n: '14', path: '/supply', view: 'moq', title: 'MOQ & price breaks', desc: 'Savings captured vs foregone.' },
  { n: '15', path: '/channels', view: 'qc', title: 'Quick commerce', desc: 'Over-ordering at dark-store hubs, OTIF vs allocation.' },
  { n: '16', path: '/channels', view: 'mon', title: 'Delayed monsoon', desc: 'Shock and recovery weeks for rain-sensitive products.' },
  { n: '17', path: '/channels', view: 'fest', title: 'Kolkata festivals', desc: 'Durga Puja, Kali Puja / Diwali and depot sell-in windows.' },
  { n: '18', path: '/channels', view: 'inf', title: 'Influencer test vs control', desc: 'Lift in test depots vs control depots.' },
  { n: '19', path: '/channels', view: 'comp', title: 'Competitor actions', desc: 'Price wars and launches that take volume.' },
];
/** Navigate to a use case and scroll to its anchor (if any). */
export function useGoUseCase() {
  const nav = useNavigate();
  return useCallback((u: UseCase) => {
    nav(u.path + (u.view ? `?view=${u.view}` : ''));
    setTimeout(() => { const el = u.anchor ? document.getElementById(u.anchor) : null; if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); else document.querySelector('.module-shell-content')?.scrollTo(0, 0); }, 120);
  }, [nav]);
}
