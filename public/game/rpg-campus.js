/** Shared presentation for campus care, cadet progression and saved rewards. */
import { RPG_CARE } from './rpg-progress.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const amount = value => Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 100;
const careStyle = {
  water: { label: 'Drink water', icon: 'heart', habit: 'Water break' },
  meal: { label: 'Eat a balanced meal', icon: 'sun', habit: 'Meal enjoyed' },
  rest: { label: 'Take a quiet break', icon: 'moon', habit: 'Rest taken' },
};
const careActions = RPG_CARE.map(action => ({ ...action, ...careStyle[action.id],
  description: Object.entries(action.restores).map(([meter, value]) => `+${value} ${meter}`).join(' · ') }));

export function rpgOverviewMarkup(state, icon = () => '') {
  const rpg = state?.rpg;
  if (!rpg) return '';
  const selected = rpg.traits?.selected || [];
  return `<section class="rpg-campus-overview"><span class="rpg-campus-emblem">${icon('compass')}</span><div><small>YOUR CADET RPG</small><h3>Level ${esc(rpg.level)} · ${esc(rpg.totalXp)} XP</h3><p>${selected.length ? 'Grow your skills through every new challenge. Care for your cadet between lessons.' : 'Choose two starter traits and begin building your skills, fitness and daily habits.'}</p></div><button type="button" class="button secondary" data-open-rpg>${selected.length ? 'Skills & wellbeing' : 'Choose RPG traits'}</button></section>`;
}

export function careMarkup(state, location, icon = () => '') {
  const wellbeing = state?.rpg?.wellbeing;
  if (!wellbeing || !['garden', 'cafe', 'dorm'].includes(location)) return '';
  const meters = [['energy', 'Energy'], ['hydration', 'Hydration'], ['nourishment', 'Nourishment']];
  const values = meters.map(([key, label]) => {
    const value = amount(wellbeing[key]);
    return `<div class="rpg-care-meter ${value < 40 ? 'needs-care' : ''}"><div><span>${label}</span><strong>${value}<small> / 100</small></strong></div><div class="rpg-care-track" role="progressbar" aria-label="${label}" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="100"><i style="width:${value}%"></i></div></div>`;
  }).join('');
  return `<section class="rpg-campus-care" data-care-location="${location}"><div class="rpg-care-heading"><div><small>DAILY CADET CARE</small><h3>A moment to recharge.</h3></div><button type="button" class="text-button" data-open-rpg>Character record →</button></div><p class="rpg-care-intro">Build a routine around learning, food, water, movement and rest. Keep all three meters at 40 or above to earn a readiness bonus on the next new challenge.</p><div class="rpg-care-meters">${values}</div><div class="rpg-care-actions">${careActions.map(action => {
    const done = wellbeing.careToday?.[action.id] === true;
    return `<button type="button" class="rpg-care-action ${done ? 'done' : ''}" data-rpg-care="${action.id}" ${done ? 'disabled' : ''}><span class="rpg-care-symbol">${icon(done ? 'check' : action.icon)}</span><strong>${done ? action.habit : action.label}</strong><span>${action.description}</span><small>${done ? 'Saved for this game day' : `+${action.xp} character XP · +${action.skillXp} fitness XP`}</small></button>`;
  }).join('')}</div><p class="rpg-care-note">Each care action earns its reward once per game day. Sleep opens a fresh routine. Your wellbeing stays as saved while you are away.</p></section>`;
}

export function rewardMarkup(reward) {
  if (!reward || !Number.isFinite(reward.xp) || reward.xp <= 0) return '';
  const skills = Array.isArray(reward.skills) ? reward.skills.filter(skill => Number.isFinite(skill.xp) && skill.xp > 0) : [];
  const levelUps = Array.isArray(reward.levelUps) ? reward.levelUps : [];
  const earned = Array.isArray(reward.earnedTraits) ? reward.earnedTraits : [];
  const levelGained = Number(reward.level) > Number(reward.previousLevel);
  return `<span class="rpg-reward-mark" aria-hidden="true">✦</span><div><small>${levelGained ? `LEVEL ${esc(reward.level)} REACHED` : 'CADET PROGRESS SAVED'}</small><strong>+${esc(reward.xp)} XP</strong><p>${skills.map(skill => `${esc(skill.label)} +${esc(skill.xp)}`).join(' · ')}</p>${reward.careBonus || reward.traitBonus ? `<span class="rpg-reward-bonuses">${[reward.traitBonus ? 'Trait bonus included' : '', reward.careBonus ? 'Readiness bonus included' : ''].filter(Boolean).join(' · ')}</span>` : ''}${levelUps.length || earned.length ? `<span class="rpg-reward-unlocks">${[...levelUps.map(skill => `${esc(skill.label)} reached Lv ${esc(skill.to)}`), ...earned.map(trait => `${esc(trait.label || trait.name || trait.id || trait)} earned`)].join(' · ')}</span>` : ''}</div>`;
}
