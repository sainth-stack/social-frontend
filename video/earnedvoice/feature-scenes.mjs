export const W = 1920;
export const H = 1080;
export const fps = 60;
const C = { bg: '#fffaf5', ink: '#241e19', muted: '#6b5b50', orange: '#c2410c', pale: '#fff0e3', line: '#e7d9cc' };
const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const box = (x, y, w, h, fill = '#fff', r = 18, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;
const t = (x, y, s, size = 22, color = C.ink, weight = 400, extra = '') => `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}" ${extra}>${esc(s)}</text>`;
const rows = (x, y, a, size = 22, color = C.ink, weight = 400, gap = size * 1.5) => a.map((s, i) => t(x, y + i * gap, s, size, color, weight)).join('');
const badge = (x, y, label, active = false, w = label.length * 10 + 36) => box(x, y, w, 38, active ? C.pale : '#faf7f3', 19) + t(x + 18, y + 26, label, 17, active ? C.orange : C.muted, 600);
const button = (x, y, label, w = 210) => box(x, y, w, 50, C.orange, 12) + t(x + w / 2, y + 33, label, 19, '#fff', 600, 'text-anchor="middle"');
const field = (x, y, label, value, w) => t(x, y, label, 17, C.muted, 600) + box(x, y + 15, w, 58, '#fffdfb', 11, `stroke="${C.line}"`) + t(x + 18, y + 52, value, 21);
const logo = (x, y, h = 40, word = true) => `<g transform="translate(${x} ${y})"><svg width="${h}" height="${h}" viewBox="4 16 112 98"><path d="M9 27Q6 20 14 20H37L65 78L51 106Q48 111 44 103Z" fill="#9a3412"/><path d="M51 106L88 20H109Q116 20 112 28L77 104Q75 110 68 110H55Q49 110 51 106Z" fill="#ea580c"/><path d="M14 32H40L45 43H19ZM23 52H49L54 63H28Z" fill="#fed7aa"/></svg>${word ? t(h * 1.23, h * .79, 'EarnedVoice', h * .76, C.orange, 700, 'letter-spacing="-1.6"') : ''}</g>`;
const platform = (x, y, name, size = 44) => {
  const color = { LinkedIn: '#0a66c2', Instagram: '#bf2776', Facebook: '#1877f2' }[name];
  const mark = name === 'Instagram' ? `<rect x="12" y="12" width="26" height="26" rx="8" fill="none" stroke="white" stroke-width="2.5"/><circle cx="25" cy="25" r="7" fill="none" stroke="white" stroke-width="2.5"/><circle cx="34" cy="16" r="2" fill="white"/>` : t(25, name === 'LinkedIn' ? 36 : 42, name === 'LinkedIn' ? 'in' : 'f', name === 'LinkedIn' ? 31 : 43, '#fff', 700, 'text-anchor="middle"');
  return `<g transform="translate(${x} ${y}) scale(${size / 50})">${box(0, 0, 50, 50, color, 13)}${mark}</g>`;
};
export const cursor = (x, y) => `<g transform="translate(${x} ${y}) rotate(-12)"><path d="M0 0v36l10-10 9 18 7-4-9-17 15-1Z" fill="${C.ink}" stroke="white" stroke-width="3" stroke-linejoin="round"/></g>`;
const defs = `<defs><radialGradient id="glow"><stop stop-color="#f3d0b6" stop-opacity=".8"/><stop offset="1" stop-color="#fffaf5" stop-opacity="0"/></radialGradient><filter id="shadow" x="-25%" y="-30%" width="150%" height="180%"><feDropShadow dx="0" dy="24" stdDeviation="28" flood-color="#493b32" flood-opacity=".13"/></filter></defs>`;
export const svg = (body, background = true) => `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"><g font-family="Segoe UI, Arial, sans-serif">${defs}${background ? box(0, 0, W, H, C.bg, 0) + '<ellipse cx="980" cy="650" rx="1100" ry="750" fill="url(#glow)"/>' : ''}${body}</g></svg>`;
const shell = (title, body, active = 'AI Studio') => `<g filter="url(#shadow)">${box(260, 246, 1400, 675, '#fff', 22, `stroke="${C.line}"`)}</g>${box(261, 247, 219, 673, '#fcf8f3', 21)}${box(460, 247, 20, 673, '#fcf8f3', 0)}${logo(288, 275, 30)}${box(283, 340, 172, 49, '#f2e9df', 10)}${t(301, 372, 'Northstar', 20, C.ink, 600)}${['Dashboard', 'AI Studio', 'Content Planner', 'Calendar', 'Posts', 'Accounts', 'Analytics'].map((n, i) => (n === active ? box(281, 415 + i * 58, 176, 44, C.pale, 10) : '') + t(299, 444 + i * 58, n, 18, n === active ? C.orange : C.muted, n === active ? 650 : 400)).join('')}${t(516, 296, title, 28, C.ink, 650)}${t(1620, 294, 'Northstar · Illustrative workspace', 15, C.muted, 400, 'text-anchor="end"')}${body}`;
const scene = (headline, subtitle, body) => logo(100, 65, 34) + t(960, 160, headline, 53, C.ink, 650, 'text-anchor="middle" letter-spacing="-1.6"') + t(960, 207, subtitle, 23, C.muted, 400, 'text-anchor="middle"') + body + t(960, 1008, 'Illustrative product scenes', 15, C.muted, 400, 'text-anchor="middle"');
const art = (x, y, w = 340, h = 260, variant = 0) => `<g transform="translate(${x} ${y})"><svg width="${w}" height="${h}" viewBox="0 0 420 320">${box(0, 0, 420, 320, variant ? '#efe8dd' : '#f4e3d2', 16)}<path d="${variant ? 'M380-60C130 30 380 160 170 320' : 'M245-30C98 32 358 135 205 241S205 380 360 330'}" fill="none" stroke="${variant ? '#9a6b45' : '#c2410c'}" stroke-width="82"/><circle cx="340" cy="61" r="37" fill="#ffeedd"/>${t(29, 42, 'NORTHSTAR', 12, '#5c341f', 700, 'letter-spacing="3"')}${rows(29, 112, variant ? ['Good ideas.', 'Clear direction.'] : ['Clarity before', 'complexity.'], 34, '#442818', 650, 39)}${t(30, 207, 'Practical ideas for growing teams.', 13, '#5c341f')}${t(29, 290, 'IDEAS WORTH SHARING', 10, '#5c341f', 600, 'letter-spacing="2"')}</svg></g>`;

function opening() {
  return logo(672, 303, 94) + t(960, 530, 'Your expertise. Amplified.', 83, C.ink, 650, 'text-anchor="middle" letter-spacing="-2.7"') + t(960, 608, 'One place to create, plan and publish.', 31, C.muted, 400, 'text-anchor="middle"') + platform(424, 228, 'LinkedIn', 85) + platform(1434, 321, 'Instagram', 85) + platform(1234, 754, 'Facebook', 85) + platform(545, 740, 'Instagram', 62) + t(960, 908, 'GIVE YOUR EXPERTISE A VOICE', 18, C.orange, 600, 'text-anchor="middle" letter-spacing="4"');
}
function accounts() {
  const names = ['LinkedIn', 'Instagram', 'Facebook'];
  const body = t(520, 372, 'Connected accounts', 25, C.ink, 600) + t(520, 409, 'Unlimited accounts on every plan.', 20, C.muted) + names.map((p, i) => {const y = 455 + i * 116; return box(518, y, 1088, 94, '#fffdfb', 15, `stroke="${C.line}"`) + platform(544, y + 23, p, 48) + t(615, y + 39, `Northstar · ${p}`, 23, C.ink, 600) + t(615, y + 69, 'Company account', 17, C.muted) + badge(1270, y + 27, 'Connected', true) + t(1440, y + 57, 'Sync now', 19, C.orange, 600);}).join('');
  return scene('Your channels. One workspace.', 'Bring LinkedIn, Instagram and Facebook together.', shell('Accounts', body, 'Accounts'));
}
function brand() {
  const body = badge(519, 337, 'Create') + badge(635, 337, 'Brand Profile', true) + badge(817, 337, 'Media Library') + field(520, 441, 'Business name', 'Northstar Consulting', 520) + field(1070, 441, 'Industry', 'Consulting', 534) + field(520, 557, 'What you do', 'Help teams turn complex projects into clear plans.', 1084) + field(520, 673, 'Who you serve', 'Founders and growing product teams', 1084) + t(520, 801, 'Brand tone', 18, C.muted, 600) + badge(663, 773, 'Professional', true) + badge(850, 773, 'Clear', true) + button(1348, 784, 'Save brand profile', 256);
  return scene('Content that starts with your brand.', 'Your business, your audience, your tone.', shell('AI Studio', body));
}
function composer() {
  const body = badge(520, 337, 'Create', true) + badge(635, 337, 'Brand Profile') + t(520, 440, 'What do you want to post?', 25, C.ink, 600) + box(520, 464, 1084, 155, '#fffcf9', 15, `stroke="#dc9d78" stroke-width="2"`) + rows(548, 518, ['Share three practical questions', 'that make a project brief clearer.'], 29, C.ink, 400, 43) + t(520, 673, 'Content type', 18, C.muted, 600) + badge(520, 696, 'Educational', true) + t(818, 673, 'Channels', 18, C.muted, 600) + platform(818, 698, 'LinkedIn', 42) + platform(879, 698, 'Instagram', 42) + platform(940, 698, 'Facebook', 42) + t(520, 824, 'Tone: Professional', 21, C.muted) + button(1363, 784, 'Create copy', 241);
  return scene('Turn a thought into your next post.', 'Start with an idea. Let AI help shape the words.', shell('AI Studio', body));
}
function writing() {
  const body = t(520, 367, 'Channel copy', 23, C.ink, 600) + badge(520, 393, 'LinkedIn', true) + badge(658, 393, 'Instagram') + badge(813, 393, 'Facebook') + box(520, 453, 583, 383, '#fffdfb', 15, `stroke="${C.line}"`) + rows(547, 497, ['A better brief starts with three questions.', '', 'Who are we helping?', 'What needs to change?', 'What does success look like?', '', 'Clarity before complexity.'], 23, C.ink, 400, 39) + t(547, 804, '#ProjectPlanning   #TeamClarity', 18, '#0a66c2') + t(1140, 367, 'Live preview', 23, C.ink, 600) + box(1137, 393, 467, 444, '#fff', 17, `stroke="${C.line}"`) + platform(1162, 419, 'LinkedIn', 41) + t(1220, 441, 'Northstar Consulting', 20, C.ink, 650) + t(1220, 465, 'Company update', 15, C.muted) + rows(1163, 524, ['A better brief starts with', 'three questions.', '', 'Who are we helping?', 'What needs to change?', 'What does success look like?', '', 'Clarity before complexity.'], 22, C.ink, 400, 35);
  return scene('One idea. A voice for each channel.', 'Create and refine copy with a live post preview.', shell('AI Studio', body));
}
function calendar() {
  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
  let body = t(520, 369, 'November 2026', 25, C.ink, 600) + badge(1394, 341, 'Month', true) + badge(1507, 341, 'Agenda');
  body += days.map((d, i) => t(548 + i * 216, 428, d, 16, C.muted, 600)).join('');
  for (let i = 0; i < 10; i++) {const x = 520 + i % 5 * 216, y = 452 + Math.floor(i / 5) * 183; body += box(x, y, 205, 172, '#fdfaf7', 11, `stroke="${C.line}"`) + t(x + 17, y + 31, 2 + i + (i >= 5 ? 2 : 0), 19, C.muted, 500); if ([1, 3, 5, 8].includes(i)) body += box(x + 10, y + 53, 185, 105, C.pale, 9) + platform(x + 20, y + 65, ['LinkedIn', 'Instagram', 'Facebook'][i % 3], 27) + t(x + 57, y + 85, '9:00 AM', 15, C.orange, 600) + rows(x + 20, y + 115, i % 2 ? ['A clearer', 'project brief'] : ['A fresh', 'perspective'], 17, C.ink, 600, 23);}
  return scene('See your content come together.', 'A clear calendar for your social presence.', shell('Calendar', body, 'Calendar'));
}
function media() {
  const body = badge(520, 337, 'Media Library', true) + t(520, 425, 'Your media, ready for your next idea.', 27, C.ink, 600) + art(520, 464, 340, 259) + art(890, 464, 340, 259, 1) + art(1260, 464, 340, 259) + t(520, 764, 'brand-story.jpg', 20, C.ink, 600) + t(890, 764, 'project-insight.jpg', 20, C.ink, 600) + t(1260, 764, 'next-perspective.jpg', 20, C.ink, 600) + t(520, 813, 'Bring your own images. Keep your content recognizably yours.', 21, C.muted);
  return scene('Give your ideas a visual identity.', 'Your images and brand assets, together in one place.', shell('AI Studio', body));
}
function publishing() {
  const body = t(520, 365, 'Posts', 25, C.ink, 600) + badge(1291, 337, 'Scheduled', true) + badge(1450, 337, 'All channels') + ['LinkedIn', 'Instagram', 'Facebook'].map((p, i) => {const y = 410 + i * 145; return box(520, y, 1084, 128, '#fffdfb', 14, `stroke="${C.line}"`) + art(537, y + 13, 131, 100, i % 2) + platform(692, y + 20, p, 32) + t(738, y + 44, p, 19, C.ink, 600) + t(692, y + 85, ['A better brief starts with three questions.', 'Clarity before complexity.', 'Practical ideas for growing teams.'][i], 22) + badge(1360, y + 20, 'Scheduled', true) + t(1334, y + 89, `Nov ${3 + i * 2} · 9:00 AM`, 18, C.muted);}).join('');
  return scene('Keep your next posts in view.', 'Plan your publishing across the channels that matter.', shell('Posts', body, 'Posts'));
}
function analytics(breakdown = false) {
  let body = badge(520, 337, breakdown ? 'LinkedIn' : 'All channels', true) + badge(1408, 337, 'Last 30 days') + t(520, 439, breakdown ? 'Channel performance' : 'Engagement over time', 27, C.ink, 600) + t(520, 477, 'Illustrative chart · Not customer performance data', 17, C.muted);
  if (!breakdown) {
    body += box(520, 502, 705, 326, '#fffdfb', 15, `stroke="${C.line}"`) + [570, 640, 710, 780].map(y => `<path d="M550 ${y}H1194" stroke="${C.line}"/>`).join('') + '<path d="M550 725C585 725 595 620 635 640S690 743 732 681S790 579 828 619S880 719 918 660S974 560 1012 592S1080 702 1120 634S1167 596 1194 620" fill="none" stroke="#c2410c" stroke-width="5" stroke-linecap="round"/>' + t(550, 807, 'Earlier', 15, C.muted) + t(1142, 807, 'Later', 15, C.muted) + box(1251, 502, 353, 326, '#fcf8f3', 15) + rows(1279, 551, ['Channel performance', '', 'LinkedIn', '', 'Instagram', '', 'Facebook'], 21, C.ink, 600, 33) + platform(1517, 595, 'LinkedIn', 31) + platform(1517, 663, 'Instagram', 31) + platform(1517, 730, 'Facebook', 31);
  } else {
    body += ['Channel', 'Posts', 'Reach', 'Impressions', 'Engagements'].map((s, i) => t(520 + [0, 360, 500, 680, 900][i], 545, s, 18, C.muted, 600)).join('');
    body += ['LinkedIn', 'Instagram', 'Facebook'].map((p, i) => {const y = 580 + i * 83; return box(520, y, 1084, 69, i % 2 ? '#fff' : '#fcf8f3', 10) + platform(537, y + 17, p, 34) + t(587, y + 43, p, 21, C.ink, 600) + [880, 1020, 1200, 1420].map(x => t(x, y + 43, '—', 24, C.muted)).join('');}).join('');
    body += t(520, 877, 'Metrics vary by platform and account permissions.', 17, C.muted);
  }
  return scene(breakdown ? 'A clearer view of every channel.' : 'Understand how your content performs.', breakdown ? 'Compare supported metrics in one place.' : 'Explore engagement and channel-level reporting.', shell('Analytics', body, 'Analytics'));
}
function overview() {
  return scene('From one idea to your social presence.', 'Create. Plan. Publish. Understand.', box(276, 298, 593, 581, '#fff', 22, 'filter="url(#shadow)"') + t(310, 350, 'CREATE', 17, C.orange, 650, 'letter-spacing="2"') + art(310, 380, 525, 366) + t(310, 815, 'Bring your expertise to life.', 28, C.ink, 600) + box(901, 298, 742, 268, '#fff', 22, 'filter="url(#shadow)"') + t(935, 350, 'PLAN & PUBLISH', 17, C.orange, 650, 'letter-spacing="2"') + platform(935, 389, 'LinkedIn', 48) + platform(1005, 389, 'Instagram', 48) + platform(1075, 389, 'Facebook', 48) + t(935, 510, 'Your channels, connected.', 28, C.ink, 600) + box(901, 596, 742, 283, '#fff', 22, 'filter="url(#shadow)"') + t(935, 648, 'UNDERSTAND', 17, C.orange, 650, 'letter-spacing="2"') + '<path d="M938 765C990 765 1003 687 1059 721S1140 817 1210 746S1320 702 1370 743S1510 802 1598 710" fill="none" stroke="#c2410c" stroke-width="5" stroke-linecap="round"/>' + t(935, 840, 'See the story behind your content.', 25, C.ink, 600));
}
function closing() {
  return logo(672, 287, 94) + t(960, 533, 'Give your expertise a voice.', 79, C.ink, 650, 'text-anchor="middle" letter-spacing="-2.6"') + t(960, 614, 'Create with AI. Publish with intention.', 31, C.muted, 400, 'text-anchor="middle"') + button(727, 703, 'Start free with EarnedVoice', 466) + t(960, 806, 'No credit card required', 21, C.muted, 400, 'text-anchor="middle"') + platform(404, 278, 'LinkedIn', 83) + platform(1434, 370, 'Instagram', 83) + platform(1270, 797, 'Facebook', 72);
}

export const scenes = [
  { id: '01-introduction', duration: 5.5, content: opening, caption: 'Your expertise. Amplified. One place to create, plan and publish.' },
  { id: '02-accounts', duration: 5.5, content: accounts, caption: 'Bring LinkedIn, Instagram and Facebook together in one workspace.' },
  { id: '03-brand-voice', duration: 5.5, content: brand, caption: 'Content that starts with your brand. Your business, your audience, your tone.' },
  { id: '04-composer', duration: 5.5, content: composer, caption: 'Turn a thought into your next post. Start with an idea and let AI help shape the words.' },
  { id: '05-channel-copy', duration: 5.5, content: writing, caption: 'One idea. A voice for each channel. Create and refine copy with a live post preview.' },
  { id: '06-calendar', duration: 5.5, content: calendar, caption: 'See your content come together in a clear publishing calendar.' },
  { id: '07-media', duration: 5.5, content: media, caption: 'Give your ideas a visual identity. Your images and brand assets, together in one place.' },
  { id: '08-publishing', duration: 5.5, content: publishing, caption: 'Keep your next posts in view. Plan your publishing across your channels.' },
  { id: '09-analytics', duration: 5.5, content: () => analytics(false), caption: 'Understand how your content performs with engagement and channel-level reporting. Chart is illustrative.' },
  { id: '10-channels', duration: 5.5, content: () => analytics(true), caption: 'A clearer view of every channel. Compare supported metrics in one place.' },
  { id: '11-workspace', duration: 5.5, content: overview, caption: 'From one idea to your social presence. Create. Plan. Publish. Understand.' },
  { id: '12-closing', duration: 5, content: closing, caption: 'Give your expertise a voice. Start free with EarnedVoice. No credit card required.' },
];