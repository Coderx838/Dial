// doodle.js - tiny 2-line ascci faces for users

// will add more in later versions

const DOODLES = [
  { top: "(o_o)",      bot: "/| |\\" },
  { top: "(^_^)~",     bot: "/| |" },
  { top: "c(^.^)b",    bot: "/| |\\" },
  { top: "\\m/(>_<)\\m/", bot: "/|   |\\" },
  { top: "(°_°)",      bot: "/| |\\" },
  { top: "(>_<)",      bot: "/| |\\" },
  { top: "(o_o)/",     bot: "/| |\\" },
  { top: "(^-^)b",     bot: "/| |\\" },
  { top: "(:3)",       bot: "/| |\\" },
  { top: "(o,-)o",     bot: "/| |\\" },
];


function getDoodle(i){
    return DOODLES[((i % DOODLES.length) + DOODLES.length) % DOODLES.length];

}


// short one-line verion for the picker

function doodleLabel(i){
    const d = getDoodle(i);
    return d.top
}

module.exports = { DOODLES,  getDoodle, doodleLabel};