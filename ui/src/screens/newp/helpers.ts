export interface NpState { id: string; geo: string; metric: string; pack: string; case: string; simBasis: string }
export interface NpProps { np: NpState; setNp: (p: Partial<NpState>) => void; npds: any[] }
