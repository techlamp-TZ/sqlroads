// SQL Drills: Waffles' default avatar was brand artwork; this is a neutral one (a person on a grey circle),
// coloured from the palette tokens.
import palette from '../../../../tokens/palette.js';

const bg = palette.light['--wf-w-grey-400'];
const fg = palette.light['--wf-w-navy'];
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="62" height="62" viewBox="0 0 62 62"><circle cx="31" cy="31" r="31" fill="${bg}"/><circle cx="31" cy="24" r="10" fill="${fg}" fill-opacity="0.55"/><path d="M12 52c3-10 11-15 19-15s16 5 19 15" fill="${fg}" fill-opacity="0.55"/></svg>`;
const defaultAvatar = 'data:image/svg+xml,' + encodeURIComponent(svg);

export default defaultAvatar;
