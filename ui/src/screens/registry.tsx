import type { ComponentType } from 'react';
import { Dashboard, ChartLine, Analytics, Rocket, Calendar, Delivery, ChartNetwork, Chat, Book } from '@carbon/icons-react';
import type { CarbonIconType } from '@carbon/icons-react';
import Overview from './overview/Overview';
import Forecast from './forecast/Forecast';
import Xai from './xai/Xai';
import NewProducts from './newp/NewProducts';
import FestivalCalendar from './calendar/FestivalCalendar';
import Supply from './supply/Supply';
import Channels from './channels/Channels';
import Ask from './ask/Ask';
import Guide from './guide/Guide';

export interface ScreenDef { id: string; path: string; title: string; subtitle: string; group: 'Plan' | 'Operate' | 'Assist'; icon: CarbonIconType; Component: ComponentType }
export const SCREENS: ScreenDef[] = [
  { id: 'overview', path: '/overview', title: 'Overview', group: 'Plan', icon: Dashboard, Component: Overview, subtitle: 'KPIs and the LightGBM demand outlook to January 2027.' },
  { id: 'forecast', path: '/forecast', title: 'Forecast & accuracy', group: 'Plan', icon: ChartLine, Component: Forecast, subtitle: '13 / 9 / 4-week-ahead forecasts, backtested over 52 weeks against the sales forecast and a seasonal baseline.' },
  { id: 'explain', path: '/explain', title: 'Explainability', group: 'Plan', icon: Analytics, Component: Xai, subtitle: 'Why the selected model forecasts what it does for a chosen week, with the inputs and its own backtest record.' },
  { id: 'newp', path: '/new-products', title: 'New products', group: 'Plan', icon: Rocket, Component: NewProducts, subtitle: 'Launch ramps, timing, cannibalisation, similarity analogues and the mosquito vaporizer.' },
  { id: 'cal', path: '/calendar', title: 'Festival calendar', group: 'Plan', icon: Calendar, Component: FestivalCalendar, subtitle: 'Pick a festival to see the forecast around it.' },
  { id: 'supply', path: '/supply', title: 'Supply & inventory', group: 'Operate', icon: Delivery, Component: Supply, subtitle: 'Depot cover, replenishment and OTIF, plant capacity, transfers and MOQ.' },
  { id: 'chan', path: '/channels', title: 'Channels & events', group: 'Operate', icon: ChartNetwork, Component: Channels, subtitle: 'Quick commerce, delayed monsoon, Kolkata festivals, influencer tests and competitor actions.' },
  { id: 'ask', path: '/ask', title: 'Ask the data', group: 'Assist', icon: Chat, Component: Ask, subtitle: 'Plain-English questions answered from the demo data.' },
  { id: 'guide', path: '/guide', title: 'Guide', group: 'Assist', icon: Book, Component: Guide, subtitle: 'How to read this demo and a suggested 10-minute walk-through.' },
];
