import { aiPack as pack } from '@grad-sim/content';
import { runBot, findVenue, graduationStatus } from '../src/index';
for (const strat of ['diligent','allnighter','balanced'] as const) {
  const tiers: Record<string, number> = {}; let papers=0, qsum=0, qn=0, research=0, stress=0, ext=0, subs=0, rej=0, score=0, top1=0;
  const fail: Record<string, number> = {}; const N=150;
  for (let i=0;i<N;i++){ const {state:s}=runBot(pack, `${strat}-${i}`, strat);
    research+=s.stats.research; stress+=s.hidden.stressSum/s.week; if(s.extended) ext++; score+=s.ending!.score;
    if(!s.ending?.careerId){ const g=graduationStatus(pack,s); const k=s.hidden.maxStressWeeks>=6?'burnout':Object.entries(g).filter(([,v])=>!v).map(([k])=>k).join('+'); fail[k]=(fail[k]??0)+1; }
    if (s.papers.some(p=>p.stage==='accepted'&&p.authorOrder===1&&p.venueId&&['A+','S'].includes(findVenue(pack,p.venueId)!.tier))) top1++;
    for(const p of s.papers.filter(p=>p.kind==='paper')){ papers++; subs+=p.reviews.length; rej+=p.reviews.filter(r=>r.decision==='reject').length;
      if(p.stage==='accepted'){ const t=findVenue(pack,p.venueId!)!.tier; tiers[t]=(tiers[t]??0)+1; qsum+=p.quality; qn++; } } }
  console.log(strat, JSON.stringify({papers:+(papers/N).toFixed(2), subs:+(subs/N).toFixed(2), rej:+(rej/N).toFixed(2), accepted: tiers, avgAccQ: Math.round(qsum/qn), research: Math.round(research/N), avgStress: Math.round(stress/N), fail, ext: ext/N, top1: top1/N, score: Math.round(score/N)}));
}
