// A scene is a visual composition. Palettes remain independently selectable.
export const SCENES = [
  { id:'observatory', name:'Observatory', category:'Minimal', description:'The original. One planet, every moment.', theme:'observatory', mode:'dark', effect:'none', clock:'light', composition:'globe', label:'EARTH, IN REAL TIME' },
  { id:'matrix', name:'Matrix', category:'Digital', description:'Falling code. Phosphor green. Follow the time.', theme:'terminal', mode:'dark', effect:'rain', clock:'mono', composition:'globe', label:'SYSTEM TIME / SIGNAL ACTIVE' },
  { id:'cupertino', name:'Cupertino', category:'Minimal', description:'Apple-inspired clarity, glass and quiet space.', theme:'silver', mode:'light', effect:'none', clock:'light', composition:'center', label:'A LITTLE MORE PRESENT' },
  { id:'spectrum', name:'Spectrum', category:'Playful', description:'Google-inspired primary colours, pure optimism.', theme:'whiteout', mode:'light', effect:'none', clock:'bold', composition:'center', label:'MAKE TIME FOR SOMETHING GOOD' },
  { id:'split-flap', name:'Split-flap', category:'Retro', description:'A station clock, with nowhere to rush.', theme:'graphite', mode:'dark', effect:'none', clock:'flap', composition:'center', label:'DEPARTURES / NOW' },
  { id:'terminal', name:'Terminal', category:'Digital', description:'A command line for the present tense.', theme:'terminal', mode:'dark', effect:'scan', clock:'mono', composition:'globe', label:'> TIMESCREEN --LIVE' },
  { id:'swiss', name:'Swiss', category:'Minimal', description:'Oversized numerals. Exacting red. No noise.', theme:'monochrome', mode:'light', effect:'none', clock:'bold', composition:'editorial', label:'THE PRESENT / STANDARD TIME' },
  { id:'bauhaus', name:'Bauhaus', category:'Playful', description:'Primary shapes. Time as a composition.', theme:'paper', mode:'light', effect:'none', clock:'bold', composition:'globe', label:'FORM FOLLOWS TIME' },
  { id:'tokyo', name:'Tokyo neon', category:'Digital', description:'Pink neon and electric-blue after-hours.', theme:'orchid', mode:'dark', effect:'scan', clock:'outline', composition:'globe', label:'AFTER HOURS / STILL AWAKE' },
  { id:'outrun', name:'Outrun', category:'Retro', description:'A sunset, an endless grid, one more minute.', theme:'violet', mode:'dark', effect:'grid', clock:'outline', composition:'center', label:'SOMEWHERE IN THE FUTURE, 1986' },
  { id:'nixie', name:'Nixie', category:'Retro', description:'Warm amber numerals behind glass.', theme:'amber', mode:'dark', effect:'none', clock:'nixie', composition:'center', label:'ELECTRIC TIME / WARM GLOW' },
  { id:'blueprint', name:'Blueprint', category:'Digital', description:'Drafting-paper precision on deep blue.', theme:'blueprint', mode:'dark', effect:'none', clock:'mono', composition:'globe', label:'FIG. 01 / THE EARTH AT THIS INSTANT' },
  { id:'sonar', name:'Sonar', category:'Digital', description:'A slow radar sweep across a living planet.', theme:'sonar', mode:'dark', effect:'radar', clock:'mono', composition:'globe', label:'TRACKING THE PRESENT' },
  { id:'mission-control', name:'Mission control', category:'Digital', description:'Orbital telemetry for your desk.', theme:'petrol', mode:'dark', effect:'none', clock:'mono', composition:'dashboard', label:'MISSION ELAPSED / PLANET EARTH' },
  { id:'eclipse', name:'Eclipse', category:'Atmospheric', description:'A dark sky. A perfect ring. Nothing else.', theme:'oled', mode:'dark', effect:'eclipse', clock:'light', composition:'center', label:'BETWEEN LIGHT AND SHADOW' },
  { id:'aurora', name:'Aurora', category:'Atmospheric', description:'Slow northern ribbons, without the cold.', theme:'ocean-mist', mode:'dark', effect:'aurora', clock:'light', composition:'center', label:'LET THE NIGHT UNFOLD' },
  { id:'liquid-chrome', name:'Liquid chrome', category:'Digital', description:'Polished metal and a liquid reflection.', theme:'silver', mode:'dark', effect:'chrome', clock:'chrome', composition:'center', label:'TIME, CAST IN SILVER' },
  { id:'candy', name:'Candy', category:'Playful', description:'Soft pink, round numerals, a sugar rush.', theme:'blush', mode:'light', effect:'none', clock:'bold', composition:'center', label:'A SWEETER KIND OF SECOND' },
  { id:'memphis', name:'Memphis', category:'Playful', description:'Graphic pattern, playful angles, zero rules.', theme:'citrus', mode:'light', effect:'confetti', clock:'bold', composition:'globe', label:'GOOD TIMES, BY DESIGN' },
  { id:'mondrian', name:'Mondrian', category:'Playful', description:'Primary blocks, strong lines, perfect balance.', theme:'whiteout', mode:'light', effect:'none', clock:'bold', composition:'globe', label:'A COMPOSITION IN TIME' },
  { id:'noir', name:'Noir', category:'Editorial', description:'A cinematic serif, black tie optional.', theme:'monochrome', mode:'dark', effect:'none', clock:'serif', composition:'editorial', label:'THE NIGHT EDITION' },
  { id:'paper', name:'Sunday paper', category:'Editorial', description:'Warm newsprint. Time worth slowing down for.', theme:'paper', mode:'light', effect:'none', clock:'serif', composition:'editorial', label:'THE DAILY PRESENT / EST. RIGHT NOW' },
  { id:'zen', name:'Zen', category:'Minimal', description:'Less on the screen. More in the moment.', theme:'porcelain', mode:'light', effect:'none', clock:'serif', composition:'center', label:'JUST THIS MOMENT' },
  { id:'ocean', name:'Deep ocean', category:'Atmospheric', description:'Blue currents, slow waves, a quieter tide.', theme:'azure', mode:'dark', effect:'waves', clock:'light', composition:'globe', label:'TIME MOVES IN WAVES' },
  { id:'forest', name:'Forest', category:'Atmospheric', description:'Green contours and the rhythm of nature.', theme:'emerald', mode:'dark', effect:'canopy', clock:'serif', composition:'globe', label:'GROW AT YOUR OWN PACE' },
  { id:'desert', name:'Desert', category:'Atmospheric', description:'Terracotta dunes beneath a low, warm sun.', theme:'clay', mode:'light', effect:'dunes', clock:'serif', composition:'globe', label:'NO HURRY UNDER THIS SUN' },
  { id:'solar-flare', name:'Solar flare', category:'Atmospheric', description:'Molten orange and the edge of a star.', theme:'copper', mode:'dark', effect:'flare', clock:'bold', composition:'center', label:'EVERY SECOND, A LITTLE FIRE' },
  { id:'pixel-arcade', name:'Pixel arcade', category:'Retro', description:'A dot-matrix clock with another life left.', theme:'phosphor', mode:'dark', effect:'pixels', clock:'pixel', composition:'globe', label:'PLAYER ONE / TIME IS RUNNING' },
];

export const SCENE_CATEGORIES = ['All', 'Minimal', 'Digital', 'Retro', 'Playful', 'Atmospheric', 'Editorial'];
export const getScene = id => SCENES.find(scene => scene.id === id) || SCENES[0];
export const sceneMatches = (scene, query = '', category = 'All') => {
  const text = `${scene.name} ${scene.description} ${scene.category}`.toLowerCase();
  return (category === 'All' || scene.category === category) && text.includes(query.trim().toLowerCase());
};
export function sceneSettings(id) {
  const scene = getScene(id);
  return { scene:scene.id, theme:scene.theme, mode:scene.mode, accent:null };
}
