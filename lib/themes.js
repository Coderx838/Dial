// themes.js -- paper & ink palettes

const THEMES = {
  // classic moleskine journal
  parchment: {
    name: "parchment",
    bg: "#F4ECD8",
    ink: "#2B2B2B",
    accent: "#2B5B84",
    clear: "#2E6B4F",
    muted: "#8A8478",
    margin: "#C45B5B",
  },
  // doodled classroom notes
  pad: {
    name: "pad",
    bg: "#FEF9D9",
    ink: "#434343",
    accent: "#D9534F",
    clear: "#3D7A4E",
    muted: "#9A9480",
    margin: "#D9534F",
  },
  // cafe blackboard
  chalk: {
    name: "chalk",
    bg: "#1E222A",
    ink: "#E0E6ED",
    accent: "#88D49E",
    clear: "#88D49E",
    muted: "#5A6270",
    margin: "#88D49E",
  },
  // architectural sketch
  blueprint: {
    name: "blueprint",
    bg: "#1B3B6F",
    ink: "#F0F3F4",
    accent: "#2E5B9A",
    clear: "#7EC8A2",
    muted: "#6B85A8",
    margin: "#F0F3F4",
  },
};

const THEME_ORDER = ["parchment", "pad", "chalk", "blueprint"];

function getTheme(name){
    return THEMES[name] || THEMES.parchment;
}

function nextTheme(current){
    const i = THEME_ORDER.indexOf(current);
    return THEMES[THEME_ORDER[(i+1) % THEME_ORDER.length]];

}

module.exports = {THEMES, THEME_ORDER, getTheme, nextTheme};
