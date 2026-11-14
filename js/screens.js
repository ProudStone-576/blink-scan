import { predict } from "./words.js";

// `icon` names a symbol in the sprite at the top of index.html
const back = { icon: "back", label: "Back", go: "home" };
const say = (label, spoken = label) => ({ label, say: spoken });

const chunk = (items, size) => {
  const rows = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
};

const STATIC = {
  home: {
    scan: "flat",
    cols: 3,
    items: [
      { icon: "keyboard", label: "Type", go: "type" },
      { icon: "chat", label: "Chat", go: "chat" },
      { icon: "bolt", label: "Quick", go: "quick" },
      { icon: "drop", label: "Needs", go: "needs" },
      { icon: "star", label: "Saved", go: "saved" },
      { icon: "bell", label: "Alarm", run: (ctx) => ctx.alert() },
    ],
  },
  chat: {
    scan: "rows",
    cols: 4,
    phoneCols: 2,
    items: [
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
      back,
    ],
  },
  quick: {
    scan: "rows",
    cols: 4,
    phoneCols: 2,
    items: [
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
      back,
    ],
  },
  needs: {
    scan: "rows",
    cols: 4,
    phoneCols: 2,
    items: [
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
      back,
    ],
  },
};

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

  if (ctx.countMode()) {
    return {
      scan: "rows",
      pick: "count",
      rows: [
        [...predict(ctx.currentWord(), 3).map(word), action("Space", "space", () => ctx.space()), action("Delete", "backspace", () => ctx.backspace())],
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
      predict(ctx.currentWord()).map(word),
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
  if (id === "type") return keyboardScreen(ctx);
  if (id === "saved") return savedScreen(ctx);
  const { scan, cols, phoneCols, items } = STATIC[id];
  return { scan, cols, phoneCols, rows: chunk(items, cols) };
}
