import { predict } from "./words.js";

// `icon` names a symbol in the sprite at the top of index.html
const back = { icon: "back", label: "Back", go: "home" };
const say = (label, spoken = label) => ({ label, say: spoken });

const chunk = (items, size) => {
  const rows = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
};

// rows of the given sizes, for screens whose rows differ in length
const splitBy = (items, sizes) => {
  let start = 0;
  return sizes.map((size) => items.slice(start, (start += size)));
};

// Punjabi is written in English letters, the way the family writes it. Spellings are a best guess:
// edit them to match how your family spells them. The speaker is a woman, so verbs agree with that.
const PHRASES = {
  en: {
    chat: [
      say("Really?"),
      say("No way!"),
      say("Haha", "Ha ha ha!"),
      say("Tell me more", "Tell me more."),
      say("Then what?", "And then what happened?"),
      say("I knew it", "I knew it!"),
      say("Seriously?"),
      say("What's new?", "What's the latest news?"),
      say("Poor thing", "Oh, poor thing."),
      say("I agree", "I agree with you."),
      say("Not sure", "I'm not so sure about that."),
      say("Who said?", "Who told you that?"),
      say("Don't tell", "Don't tell anyone I said this."),
      say("Come closer", "Come closer, I have something to say."),
      say("Thank you", "Thank you."),
    ],
    quick: [
      say("Yes", "Yes."),
      say("No", "No."),
      say("Maybe", "Maybe."),
      say("Stop", "Stop, please."),
      say("Wait", "Wait a moment."),
      say("Okay", "Okay."),
      say("Please", "Please."),
      say("Sorry", "Sorry."),
      say("Hello", "Hello!"),
      say("Love you", "I love you."),
      say("Later", "Let's talk later."),
    ],
    needs: [
      say("Water", "I need some water."),
      say("Toilet", "I need the toilet."),
      say("Hungry", "I am hungry."),
      say("Pain", "I am in pain."),
      say("Hot", "I am too hot."),
      say("Cold", "I am cold."),
      say("Tired", "I am tired and want to rest."),
      say("Reposition", "Please change my position."),
      say("Breathing", "I am having trouble breathing."),
      say("Nurse", "Please call the nurse."),
      say("Help", "I need help now."),
    ],
  },
  pa: {
    chat: [
      say("Sachi?", "Sachi?"),
      say("Haye rabba!", "Haye rabba!"),
      say("Haha", "Ha ha ha!"),
      say("Hor das", "Hor das."),
      say("Fer ki hoya?", "Fer ki hoya?"),
      say("Mainu pata si", "Mainu pata si."),
      say("Sach ch?", "Sach ch?"),
      say("Navi gal?", "Hor ki navi gal hai?"),
      say("Bura hoya", "Haye, bahut bura hoya."),
      say("Main sehmat", "Main tere naal sehmat haan."),
      say("Pakka nahin", "Mainu pakka nahin pata."),
      say("Kisne dasya?", "Tainu eh kisne dasya?"),
      say("Kise nu na dasi", "Kise nu na dasi ke main eh kiha."),
      say("Nede aa", "Nede aa, kujh gal karni hai."),
      say("Shukriya", "Shukriya."),
    ],
    quick: [
      say("Haan ji", "Haan ji."),
      say("Nahin", "Nahin."),
      say("Shayad", "Shayad."),
      say("Ruko", "Ruko zara."),
      say("Theek hai", "Theek hai."),
      say("Meharbani", "Meharbani karke."),
      say("Maaf karna", "Maaf karna."),
      say("Sat sri akal", "Sat sri akal ji."),
      say("Pyar", "Main tainu bahut pyar kardi haan."),
      say("Baad ch", "Baad ch gal karaange."),
      say("Shukriya", "Shukriya ji."),
    ],
    needs: [
      say("Paani", "Mainu paani chahida hai."),
      say("Washroom", "Mainu washroom jaana hai."),
      say("Bhukh", "Mainu bhukh lagi hai."),
      say("Dard", "Mainu dard ho rahi hai."),
      say("Garmi", "Mainu bahut garmi lag rahi hai."),
      say("Thand", "Mainu thand lag rahi hai."),
      say("Thakaan", "Main thak gayi haan, aaram karna hai."),
      say("Position", "Meri position badal deo."),
      say("Saah", "Mainu saah lain ch mushkil ho rahi hai."),
      say("Nurse", "Nurse nu bulao."),
      say("Madad", "Mainu hune madad chahidi hai."),
    ],
  },
};

const LAYOUT = { chat: { cols: 4, phoneCols: 2 }, quick: { cols: 4, phoneCols: 2 }, needs: { cols: 4, phoneCols: 2 } };

function homeScreen(ctx) {
  const punjabi = ctx.language() === "pa";
  const items = [
    { icon: "keyboard", label: "Type", go: "type" },
    { icon: "chat", label: "Chat", go: "chat" },
    { icon: "bolt", label: "Quick", go: "quick" },
    { icon: "drop", label: "Needs", go: "needs" },
    { icon: "star", label: "Saved", go: "saved" },
    { icon: "globe", label: punjabi ? "English" : "Punjabi", run: (c) => c.toggleLanguage() },
    { icon: "moon", label: "Rest", run: (c) => c.rest() },
    { icon: "bell", label: "Alarm", run: (c) => c.alert() },
  ];
  return { scan: "flat", rows: splitBy(items, [3, 3, 2]) };
}

const LETTER_ROWS = ["etaoin", "srhldc", "umfpgw", "ybvkxj"];
const PUNCTUATION = ["q", "z", ".", ",", "?", "!", "'"];

// Count mode: blink N times for row N. Alphabetical rows are easy to find by eye;
// words and the Space/Delete keys sit in row 1 because they are used the most.
const COUNT_ROWS = ["abcdef", "ghijkl", "mnopqr", "stuvwx"];
const COUNT_PUNCTUATION = ["y", "z", ".", ",", "?", "!", "'"];

function keyboardScreen(ctx) {
  const key = (ch) => ({ label: ch.toUpperCase(), run: () => ctx.type(ch), key: true });
  const action = (label, icon, run) => ({ label, icon, run, key: true });
  const word = (w) => ({ label: w, run: () => ctx.pickWord(w), key: true });
  const suggest = (count) => predict(ctx.currentWord(), count, ctx.language()).map(word);

  if (ctx.countMode()) {
    return {
      scan: "rows",
      pick: "count",
      rows: [
        [...suggest(3), action("Space", "space", () => ctx.space()), action("Delete", "backspace", () => ctx.backspace())],
        ...COUNT_ROWS.map((letters) => [...letters].map(key)),
        COUNT_PUNCTUATION.map(key),
        [
          action("Speak", "speaker", () => ctx.speakBuffer()),
          action("Save", "save", () => ctx.saveBuffer()),
          action("Back", "back", () => ctx.go("home")),
        ],
      ],
    };
  }

  return {
    scan: "rows",
    rows: [
      suggest(4),
      ...LETTER_ROWS.map((letters) => [...letters].map(key)),
      PUNCTUATION.map(key),
      [
        action("Space", "space", () => ctx.space()),
        action("Delete", "backspace", () => ctx.backspace()),
        action("Speak", "speaker", () => ctx.speakBuffer()),
        action("Save", "save", () => ctx.saveBuffer()),
        action("Back", "back", () => ctx.go("home")),
      ],
    ],
  };
}

function savedScreen(ctx) {
  const phrases = ctx.savedPhrases();
  const items = phrases.length
    ? phrases.map((text) => say(text, text))
    : [{ label: "Nothing saved yet. Choose Save while typing.", run: () => {} }];
  return { scan: "rows", cols: 2, phoneCols: 1, rows: chunk([...items, back], 2) };
}

export function getScreen(id, ctx) {
  if (id === "home") return homeScreen(ctx);
  if (id === "type") return keyboardScreen(ctx);
  if (id === "saved") return savedScreen(ctx);
  const { cols, phoneCols } = LAYOUT[id];
  return { scan: "rows", cols, phoneCols, rows: chunk([...PHRASES[ctx.language()][id], back], cols) };
}
